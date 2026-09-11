"""
detector.py — Unified Women Safety Surveillance Pipeline
=========================================================

Merged from:
  • Women-safety/ai/test_yolo.py  (YOLOv11 + ByteTrack tracking, gender voting,
    SOS gesture via MediaPipe Pose, threaded frame buffer, Kalman predictor,
    backend detection/alert POSTs, MJPEG frame push)
  • SOS_Alert/detector.py  (threat state machine, threat scoring, proximity
    analysis with IoU, alert engine dispatch, auto-SOS, density map)

Public API (used by server.py and CLI):
  SafetyDetector.process_frame(frame)  → SceneAnalysis
  SafetyDetector.run(source, show)     → blocking video loop
  SafetyDetector.is_nighttime(cfg)     → bool  (static)
  SafetyDetector.is_auto_sos_window(cfg) → bool (static)
  ThreatState                          → enum  (imported by server.py)
"""

from __future__ import annotations

import math
import queue
import logging
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import requests
from ultralytics import YOLO

try:
    import mediapipe as mp
    _mp_pose = mp.solutions.pose  # type: ignore
    _MEDIAPIPE_AVAILABLE = True
except ImportError:
    _mp_pose = None
    _MEDIAPIPE_AVAILABLE = False

from config import (
    AlertConfig,
    AutoSOSConfig,
    DetectionConfig,
    NightConfig,
    ProximityConfig,
    StreamConfig,
)
from alert_engine import AlertEngine, AlertPayload, AutoSOSPayload, SOSPromptPayload

logger = logging.getLogger("safety.detector")
logger.setLevel(logging.DEBUG)
_handler = logging.StreamHandler()
_handler.setFormatter(
    logging.Formatter("[%(asctime)s] %(levelname)s | %(name)s | %(message)s")
)
logger.addHandler(_handler)


# ─── Enums & Data Structures ─────────────────────────────────────────────────

class ThreatState(str, Enum):
    """Finite-state threat levels for the current scene."""
    SAFE = "SAFE"
    MONITORING = "MONITORING"                    # night + lone woman, no surrounding men
    ELEVATED = "ELEVATED"                        # 1 man nearby at night
    HIGH_RISK_SURROUNDED = "HIGH_RISK_SURROUNDED"  # >= MIN_MEN_SURROUND nearby


@dataclass
class Detection:
    """Single detected person with class, confidence, bbox, and track ID."""
    class_name: str           # "woman", "man", or "person"
    confidence: float
    bbox: Tuple[int, int, int, int]   # (x1, y1, x2, y2)
    track_id: int = -1
    center: Tuple[float, float] = field(init=False)

    def __post_init__(self):
        x1, y1, x2, y2 = self.bbox
        self.center = ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


@dataclass
class SceneAnalysis:
    """Aggregated frame-level analysis result."""
    timestamp: float
    is_nighttime: bool
    total_women: int
    total_men: int
    threat_state: ThreatState
    threat_score: float              # 0.0 – 1.0
    nearby_men_count: int
    nearby_men_distances: List[float]
    detections: List[Detection]
    frame_index: int
    sos_detected: bool = False
    sos_track_ids: List[int] = field(default_factory=list)


# ─── Threaded Frame Buffer ────────────────────────────────────────────────────

class ThreadedFrameBuffer:
    """
    Reads video frames asynchronously into a thread-safe queue.
    Rewinds video files on EOF for continuous loop.
    Timestamps each frame using CAP_PROP_POS_MSEC or computed from FPS.
    """

    def __init__(self, source, queue_size: int = 30):
        self.cap = cv2.VideoCapture(source)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # reduces latency for IP cameras
        self.q: queue.Queue = queue.Queue(maxsize=queue_size)
        self.stopped = False
        self.frame_idx = 0
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        if self.fps <= 0:
            self.fps = 30.0

    def start(self) -> "ThreadedFrameBuffer":
        threading.Thread(target=self._update, daemon=True).start()
        return self

    def _update(self):
        while not self.stopped:
            if not self.q.full():
                ret, frame = self.cap.read()
                if not ret:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                    if not ret:
                        self.stopped = True
                        break
                self.frame_idx += 1
                msec = self.cap.get(cv2.CAP_PROP_POS_MSEC)
                ts = (msec / 1000.0) if msec > 0 else (self.frame_idx / self.fps)
                self.q.put((frame, self.frame_idx, ts))
            else:
                time.sleep(0.005)

    def read(self) -> Tuple[Optional[np.ndarray], int, float]:
        try:
            return self.q.get(timeout=0.2)
        except queue.Empty:
            return None, 0, 0.0

    def running(self) -> bool:
        return not self.stopped or not self.q.empty()

    def stop(self):
        self.stopped = True
        if self.cap.isOpened():
            self.cap.release()


# ─── Kalman Motion Predictor ─────────────────────────────────────────────────

class KalmanTrackPredictor:
    """
    Estimates bounding-box velocity and interpolates positions during
    tracking gaps (video freezes, occlusions up to ~15 frames).
    Uses exponentially weighted moving average for velocity smoothing.
    """

    def __init__(self):
        self.tracks: Dict[int, dict] = {}

    def update(self, track_id: int, box: list, timestamp: float):
        x1, y1, x2, y2 = box
        if track_id in self.tracks:
            prev = self.tracks[track_id]
            dt = timestamp - prev["last_time"]
            if 0.001 < dt < 2.0:
                px1, py1, px2, py2 = prev["last_box"]
                vx = (x1 - px1) / dt
                vy = (y1 - py1) / dt
                vw = ((x2 - x1) - (px2 - px1)) / dt
                vh = ((y2 - y1) - (py2 - py1)) / dt
                a = 0.6
                pv = prev["velocity"]
                prev["velocity"] = [
                    a * vx + (1 - a) * pv[0],
                    a * vy + (1 - a) * pv[1],
                    a * vw + (1 - a) * pv[2],
                    a * vh + (1 - a) * pv[3],
                ]
            prev["last_box"] = [x1, y1, x2, y2]
            prev["last_time"] = timestamp
            prev["missed"] = 0
        else:
            self.tracks[track_id] = {
                "last_box": [x1, y1, x2, y2],
                "last_time": timestamp,
                "velocity": [0.0, 0.0, 0.0, 0.0],
                "missed": 0,
            }

    def predict(self, track_id: int, current_time: float) -> Optional[list]:
        if track_id not in self.tracks:
            return None
        t = self.tracks[track_id]
        dt = current_time - t["last_time"]
        if dt <= 0:
            return t["last_box"]
        x1, y1, x2, y2 = t["last_box"]
        vx, vy, vw, vh = t["velocity"]
        nx1 = int(x1 + vx * dt)
        ny1 = int(y1 + vy * dt)
        nw = int((x2 - x1) + vw * dt)
        nh = int((y2 - y1) + vh * dt)
        return [nx1, ny1, nx1 + max(20, nw), ny1 + max(20, nh)]


# ─── SafetyDetector ─────────────────────────────────────────────────────────

class SafetyDetector:
    """
    Unified real-time women safety surveillance pipeline.

    Combines:
      - YOLOv11 + ByteTrack multi-object tracking
      - Caffe gender classification with majority-vote history
      - MediaPipe Pose SOS gesture detection (both hands raised)
      - Threat state machine (SAFE → MONITORING → ELEVATED → HIGH_RISK_SURROUNDED)
      - Composite threat scoring (nighttime, isolation, surrounding, proximity)
      - Spatial proximity analysis (Euclidean distance + bounding-box IoU)
      - AlertEngine dispatch with cooldown and escalation
      - Non-blocking backend POSTs (detections, alerts, MJPEG frame push)
      - Threaded frame buffer + Kalman motion predictor for the run() loop
    """

    # Gender voting constants
    _GENDER_CONF_THRESHOLD = 0.50
    _MAX_SAMPLES = 25
    _MIN_SAMPLES = 3
    _MAJORITY_RATIO = 0.60
    _SOS_HOLD_FRAMES = 15          # consecutive pose frames to confirm SOS gesture
    _INTERPOLATION_MAX_MISSED = 15  # Kalman interpolation cutoff

    def __init__(
        self,
        det_cfg: Optional[DetectionConfig] = None,
        prox_cfg: Optional[ProximityConfig] = None,
        night_cfg: Optional[NightConfig] = None,
        alert_cfg: Optional[AlertConfig] = None,
        stream_cfg: Optional[StreamConfig] = None,
        auto_sos_cfg: Optional[AutoSOSConfig] = None,
    ):
        self.det_cfg = det_cfg or DetectionConfig()
        self.prox_cfg = prox_cfg or ProximityConfig()
        self.night_cfg = night_cfg or NightConfig()
        self.alert_cfg = alert_cfg or AlertConfig()
        self.stream_cfg = stream_cfg or StreamConfig()
        self.auto_sos_cfg = auto_sos_cfg or AutoSOSConfig()

        # ── YOLO model ────────────────────────────────────────────────────
        logger.info("Loading YOLO model from %s …", self.det_cfg.MODEL_PATH)
        self.model = YOLO(self.det_cfg.MODEL_PATH)
        logger.info("YOLO model loaded (device=%s)", self.det_cfg.DEVICE)

        # ── Caffe gender classifier ───────────────────────────────────────
        self._gender_net = None
        self._gender_labels = ["Male", "Female"]
        self._gender_mean = (78.4263377603, 87.7689143744, 114.895847746)
        try:
            self._gender_net = cv2.dnn.readNetFromCaffe(
                self.det_cfg.GENDER_PROTO, self.det_cfg.GENDER_MODEL
            )
            logger.info("Gender classifier loaded")
        except Exception as e:
            logger.warning("Gender classifier not loaded — all persons labelled 'person': %s", e)

        # ── MediaPipe Pose ────────────────────────────────────────────────
        self._pose = None
        if _MEDIAPIPE_AVAILABLE:
            try:
                self._pose = _mp_pose.Pose(
                    static_image_mode=False,
                    model_complexity=0,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                logger.info("MediaPipe Pose loaded (SOS gesture detection active)")
            except Exception as e:
                logger.warning("MediaPipe Pose not loaded: %s", e)
        else:
            logger.warning("mediapipe not installed — SOS gesture detection disabled")

        # ── Alert engine ──────────────────────────────────────────────────
        self.alert_engine = AlertEngine(self.alert_cfg)

        # ── Per-track state ───────────────────────────────────────────────
        self._gender_history: Dict[int, List[str]] = {}
        self._gender_attempts: Dict[int, int] = {}
        self._stable_gender: Dict[int, str] = {}
        self._person_centers: Dict[int, Tuple[int, int]] = {}
        self._sos_frame_count: Dict[int, int] = {}
        self._surrounded_frame_count: Dict[int, int] = {}

        # ── Global counters ───────────────────────────────────────────────
        self._frame_idx: int = 0
        self._high_risk_streak: int = 0
        self._last_state: ThreatState = ThreatState.SAFE

        # ── Motion predictor (used in run() loop) ─────────────────────────
        self._motion_predictor = KalmanTrackPredictor()

    # ─── Static time-window checks ───────────────────────────────────────────

    @staticmethod
    def is_nighttime(night_cfg: NightConfig, now: Optional[datetime] = None) -> bool:
        """True if current hour is in [START_HOUR, END_HOUR) (handles midnight wrap)."""
        hour = (now or datetime.now()).hour
        s, e = night_cfg.START_HOUR, night_cfg.END_HOUR
        return (hour >= s or hour < e) if s > e else (s <= hour < e)

    @staticmethod
    def is_auto_sos_window(
        auto_cfg: AutoSOSConfig, now: Optional[datetime] = None
    ) -> bool:
        """True if current hour is in the auto-SOS dispatch window."""
        hour = (now or datetime.now()).hour
        s, e = auto_cfg.AUTO_SOS_START_HOUR, auto_cfg.AUTO_SOS_END_HOUR
        return (hour >= s or hour < e) if s > e else (s <= hour < e)

    # ─── Gender classification ────────────────────────────────────────────────

    def _classify_gender_single(
        self, frame: np.ndarray, x1: int, y1: int, x2: int, y2: int
    ) -> Tuple[str, float]:
        """Single-shot Caffe prediction on a person crop. Returns (label, confidence)."""
        if self._gender_net is None:
            return "Unknown", 0.0
        fh, fw = frame.shape[:2]
        h_box = y2 - y1
        w_box = x2 - x1
        cy2 = min(fh, y1 + int(h_box * 0.85))
        pad_w = int(w_box * 0.05)
        cx1, cx2 = max(0, x1 - pad_w), min(fw, x2 + pad_w)
        crop = frame[y1:cy2, cx1:cx2]
        if crop is None or crop.size == 0 or crop.shape[0] < 15 or crop.shape[1] < 15:
            return "Unknown", 0.0
        blob = cv2.dnn.blobFromImage(
            crop, 1.0, (227, 227), self._gender_mean, swapRB=False
        )
        self._gender_net.setInput(blob)
        pred = self._gender_net.forward()
        idx = int(pred[0].argmax())
        return self._gender_labels[idx], float(pred[0].max())

    def _update_gender_vote(
        self, track_id: int, frame: np.ndarray,
        x1: int, y1: int, x2: int, y2: int
    ) -> str:
        """
        Update majority-vote gender history for this track.
        Returns the current best label: "Male", "Female", or "Unknown".
        """
        self._gender_attempts.setdefault(track_id, 0)
        self._gender_history.setdefault(track_id, [])

        if track_id not in self._stable_gender:
            if self._gender_attempts[track_id] < self._MAX_SAMPLES:
                label, conf = self._classify_gender_single(frame, x1, y1, x2, y2)
                self._gender_attempts[track_id] += 1
                if conf >= self._GENDER_CONF_THRESHOLD and label != "Unknown":
                    self._gender_history[track_id].append(label)
                votes = self._gender_history[track_id]
                if len(votes) >= self._MIN_SAMPLES:
                    top, top_count = Counter(votes).most_common(1)[0]
                    if top_count / len(votes) >= self._MAJORITY_RATIO:
                        self._stable_gender[track_id] = top

        return self._stable_gender.get(track_id, "Unknown")

    # ─── SOS gesture detection ────────────────────────────────────────────────

    def _update_sos_gesture(
        self, frame: np.ndarray,
        x1: int, y1: int, x2: int, y2: int,
        track_id: int, frame_count: int
    ) -> bool:
        """
        Detect SOS gesture (both wrists above nose) via MediaPipe Pose.
        Runs every 4th frame per track to save CPU.
        Returns True when the gesture has been held for SOS_HOLD_FRAMES.
        """
        self._sos_frame_count.setdefault(track_id, 0)
        if self._pose is None:
            return False

        # Stagger pose inference across tracks/frames to reduce CPU spike
        if (frame_count + track_id) % 4 != 0:
            return self._sos_frame_count[track_id] >= self._SOS_HOLD_FRAMES

        pad = 10
        px1 = max(0, x1 - pad)
        py1 = max(0, y1 - pad)
        px2 = min(frame.shape[1], x2 + pad)
        py2 = min(frame.shape[0], y2 + pad)
        crop = frame[py1:py2, px1:px2]

        if crop.size == 0 or crop.shape[0] < 50:
            self._sos_frame_count[track_id] = max(0, self._sos_frame_count[track_id] - 1)
            return self._sos_frame_count[track_id] >= self._SOS_HOLD_FRAMES

        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        result = self._pose.process(rgb)
        lms = getattr(getattr(result, "pose_landmarks", None), "landmark", None)

        if lms is None or len(lms) <= 16:
            self._sos_frame_count[track_id] = max(0, self._sos_frame_count[track_id] - 1)
        else:
            nose_visible = lms[0].visibility > 0.5
            lw_visible = lms[15].visibility > 0.5
            rw_visible = lms[16].visibility > 0.5
            # y-coordinate increases downward; wrist above nose ↔ wrist_y < nose_y
            both_raised = (
                nose_visible and lw_visible and rw_visible
                and lms[15].y < lms[0].y
                and lms[16].y < lms[0].y
            )
            if both_raised:
                self._sos_frame_count[track_id] += 1
            else:
                self._sos_frame_count[track_id] = max(0, self._sos_frame_count[track_id] - 1)

        return self._sos_frame_count[track_id] >= self._SOS_HOLD_FRAMES

    # ─── Proximity analysis ───────────────────────────────────────────────────

    @staticmethod
    def _euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])

    @staticmethod
    def _bbox_iou(a: Tuple[int, ...], b: Tuple[int, ...]) -> float:
        """Intersection-over-Union for two (x1,y1,x2,y2) boxes."""
        xa, ya = max(a[0], b[0]), max(a[1], b[1])
        xb, yb = min(a[2], b[2]), min(a[3], b[3])
        inter = max(0, xb - xa) * max(0, yb - ya)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    def _find_nearby_men(
        self, woman: Detection, men: List[Detection]
    ) -> Tuple[List[Detection], List[float]]:
        """
        Return men within NEARBY_DISTANCE_PX of the woman's center
        OR whose bounding boxes overlap above ENCROACHMENT_IOU.
        """
        nearby: List[Detection] = []
        distances: List[float] = []
        for m in men:
            dist = self._euclidean(woman.center, m.center)
            iou = self._bbox_iou(woman.bbox, m.bbox)
            if (dist <= self.prox_cfg.NEARBY_DISTANCE_PX
                    or iou >= self.prox_cfg.ENCROACHMENT_IOU):
                nearby.append(m)
                distances.append(round(dist, 1))
        return nearby, distances

    # ─── Threat scoring & state machine ──────────────────────────────────────

    def _compute_threat_score(
        self, is_night: bool, women: List[Detection],
        nearby_men_count: int, avg_distance: float,
    ) -> float:
        """Composite 0–1 threat score: nighttime + isolation + surrounding + proximity."""
        score = 0.0
        if is_night:
            score += 0.25
        if len(women) == 1:
            score += 0.15
        score += min(nearby_men_count / 4.0, 1.0) * 0.35
        if avg_distance > 0:
            closeness = max(0.0, 1.0 - avg_distance / self.prox_cfg.NEARBY_DISTANCE_PX)
            score += closeness * 0.25
        return round(min(score, 1.0), 3)

    def _resolve_threat_state(
        self, is_night: bool, women: List[Detection], nearby_count: int
    ) -> ThreatState:
        """
        State transitions:
            SAFE → MONITORING → ELEVATED → HIGH_RISK_SURROUNDED
        """
        if not is_night or len(women) == 0:
            return ThreatState.SAFE
        if nearby_count == 0:
            return ThreatState.MONITORING
        if 0 < nearby_count < self.prox_cfg.MIN_MEN_SURROUND:
            return ThreatState.ELEVATED
        return ThreatState.HIGH_RISK_SURROUNDED

    # ─── Density map ─────────────────────────────────────────────────────────

    def compute_density_map(
        self, detections: List[Detection], frame_shape: Tuple[int, int]
    ) -> np.ndarray:
        """Spatial density grid — useful for heatmap overlays in the frontend."""
        h, w = frame_shape[:2]
        cell = self.prox_cfg.DENSITY_CELL_PX
        gh, gw = max(1, h // cell), max(1, w // cell)
        density = np.zeros((gh, gw), dtype=np.float32)
        for det in detections:
            cx, cy = det.center
            gi = min(int(cy // cell), gh - 1)
            gj = min(int(cx // cell), gw - 1)
            density[gi, gj] += 1.0
        return density

    # ─── YOLO inference ───────────────────────────────────────────────────────

    def _run_inference(
        self, frame: np.ndarray, frame_count: int = 0
    ) -> List[Detection]:
        """
        Run YOLO + ByteTrack on one frame.
        Updates gender vote and SOS gesture state per track.
        Returns typed Detection list.
        """
        results = self.model.track(
            frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=[0],  # COCO class 0 = person
            conf=self.det_cfg.CONFIDENCE_THRESHOLD,
            iou=self.det_cfg.IOU_THRESHOLD,
            imgsz=self.det_cfg.INPUT_SIZE[0],
            device=self.det_cfg.DEVICE,
            verbose=False,
        )

        detections: List[Detection] = []
        for result in (results or []):
            boxes = getattr(result, "boxes", None)
            if boxes is None:
                continue
            for box in [boxes[i] for i in range(len(boxes))]:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                track_id = -1
                if hasattr(box, "id") and box.id is not None:
                    try:
                        track_id = int(box.id[0])
                    except Exception:
                        pass

                # Gender via majority-vote history
                gender_label = self._update_gender_vote(
                    track_id, frame, x1, y1, x2, y2
                )
                if gender_label == "Female":
                    class_name = "woman"
                elif gender_label == "Male":
                    class_name = "man"
                else:
                    class_name = "person"

                # Update center map for proximity checks
                if track_id != -1:
                    self._person_centers[track_id] = (
                        (x1 + x2) // 2, (y1 + y2) // 2
                    )

                detections.append(Detection(
                    class_name=class_name,
                    confidence=float(box.conf[0]),
                    bbox=(x1, y1, x2, y2),
                    track_id=track_id,
                ))

        return detections

    # ─── Single-frame analysis (public API used by server.py) ────────────────

    def process_frame(self, frame: np.ndarray) -> SceneAnalysis:
        """
        Full pipeline on one frame:
          inference → gender → proximity → threat → SOS → alert dispatch.
        Thread-safe; can be called from asyncio.to_thread().
        """
        self._frame_idx += 1
        ts = time.time()
        is_night = self.is_nighttime(self.night_cfg)

        detections = self._run_inference(frame, self._frame_idx)
        women = [d for d in detections if d.class_name == "woman"]
        men = [d for d in detections if d.class_name == "man"]

        # Proximity analysis — deduplicated across all women
        nearby_men: List[Detection] = []
        nearby_dists: List[float] = []
        if women:
            seen_ids: set = set()
            for w in women:
                nm, nd = self._find_nearby_men(w, men)
                for m, d in zip(nm, nd):
                    mid = id(m)
                    if mid not in seen_ids:
                        seen_ids.add(mid)
                        nearby_men.append(m)
                        nearby_dists.append(d)

        nearby_count = len(nearby_men)
        avg_dist = (sum(nearby_dists) / nearby_count) if nearby_count else 0.0

        threat_score = self._compute_threat_score(is_night, women, nearby_count, avg_dist)
        threat_state = self._resolve_threat_state(is_night, women, nearby_count)

        # Escalation streak
        if threat_state == ThreatState.HIGH_RISK_SURROUNDED:
            self._high_risk_streak += 1
        else:
            self._high_risk_streak = 0

        # Alert dispatch based on threat level (AlertEngine handles cooldown)
        if threat_state == ThreatState.HIGH_RISK_SURROUNDED:
            escalated = self._high_risk_streak >= self.alert_cfg.ESCALATION_FRAME_COUNT
            payload = AlertPayload(
                timestamp=ts,
                threat_state=threat_state.value,
                threat_score=threat_score,
                women_count=len(women),
                nearby_men_count=nearby_count,
                avg_proximity_px=round(avg_dist, 1),
                is_escalated=escalated,
                frame_index=self._frame_idx,
            )
            self.alert_engine.dispatch(payload)
        elif threat_state in (ThreatState.MONITORING, ThreatState.ELEVATED):
            # Dispatch lower-severity alerts; AlertEngine's COOLDOWN_SECONDS gates frequency
            payload = AlertPayload(
                timestamp=ts,
                threat_state=threat_state.value,
                threat_score=threat_score,
                women_count=len(women),
                nearby_men_count=nearby_count,
                avg_proximity_px=round(avg_dist, 1),
                is_escalated=False,
                frame_index=self._frame_idx,
            )
            self.alert_engine.dispatch(payload)

        # SOS gesture detection per track
        sos_track_ids: List[int] = []
        for det in detections:
            if det.track_id != -1:
                x1, y1, x2, y2 = det.bbox
                if self._update_sos_gesture(
                    frame, x1, y1, x2, y2, det.track_id, self._frame_idx
                ):
                    sos_track_ids.append(det.track_id)

        # Update Kalman predictor with current detections
        for det in detections:
            if det.track_id != -1:
                x1, y1, x2, y2 = det.bbox
                self._motion_predictor.update(
                    det.track_id, [x1, y1, x2, y2], ts
                )

        self._last_state = threat_state

        return SceneAnalysis(
            timestamp=ts,
            is_nighttime=is_night,
            total_women=len(women),
            total_men=len(men),
            threat_state=threat_state,
            threat_score=threat_score,
            nearby_men_count=nearby_count,
            nearby_men_distances=nearby_dists,
            detections=detections,
            frame_index=self._frame_idx,
            sos_detected=bool(sos_track_ids),
            sos_track_ids=sos_track_ids,
        )

    # ─── Frame annotation ────────────────────────────────────────────────────

    @staticmethod
    def _draw_label(
        img: np.ndarray, text: str, x: int, y: int, bg_color: tuple
    ):
        """Draw text with a solid background box (prevents overlap on busy frames)."""
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        pad = 4
        if y - th - pad * 2 < 0:
            y_bg1, y_bg2, y_text = y, y + th + pad * 2, y + th + pad
        else:
            y_bg1, y_bg2, y_text = y - th - pad * 2, y, y - pad
        cv2.rectangle(
            img, (x, y_bg1), (x + tw + pad * 2, y_bg2), bg_color, -1
        )
        cv2.putText(
            img, text, (x + pad, y_text),
            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA,
        )

    def annotate_frame(
        self, frame: np.ndarray, analysis: SceneAnalysis
    ) -> np.ndarray:
        """Draw bounding boxes, labels, proximity lines, and HUD overlay."""
        annotated = frame.copy()
        state_colors = {
            ThreatState.SAFE: (0, 200, 0),
            ThreatState.MONITORING: (0, 200, 255),
            ThreatState.ELEVATED: (0, 140, 255),
            ThreatState.HIGH_RISK_SURROUNDED: (0, 0, 255),
        }
        sos_ids = set(analysis.sos_track_ids)
        women_dets = [d for d in analysis.detections if d.class_name == "woman"]
        men_dets = [d for d in analysis.detections if d.class_name == "man"]

        for det in analysis.detections:
            x1, y1, x2, y2 = det.bbox
            tid = det.track_id

            if tid in sos_ids:
                color = (0, 0, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
                self._draw_label(annotated, f"ID:{tid} SOS DETECTED", x1, y1, color)
            elif (det.class_name == "woman"
                  and self._surrounded_frame_count.get(tid, 0) >= self.prox_cfg.MIN_MEN_SURROUND * 3):
                color = (0, 165, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
                self._draw_label(annotated, f"ID:{tid} SURROUNDED", x1, y1, color)
            elif det.class_name == "man":
                color = (255, 120, 0)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                self._draw_label(annotated, f"ID:{tid} Male", x1, y1, color)
            elif det.class_name == "woman":
                color = (203, 0, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                self._draw_label(annotated, f"ID:{tid} Female", x1, y1, color)
            else:
                color = (120, 120, 120)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                self._draw_label(annotated, f"ID:{tid} Unknown", x1, y1, color)

        # Proximity lines: woman → nearby men
        for w in women_dets:
            for m in men_dets:
                if self._euclidean(w.center, m.center) <= self.prox_cfg.NEARBY_DISTANCE_PX:
                    cv2.line(
                        annotated,
                        (int(w.center[0]), int(w.center[1])),
                        (int(m.center[0]), int(m.center[1])),
                        (0, 0, 255), 2,
                    )

        # HUD overlay
        state_col = state_colors.get(analysis.threat_state, (255, 255, 255))
        hud = [
            f"State: {analysis.threat_state.value}  Score: {analysis.threat_score:.3f}",
            f"Night: {'YES' if analysis.is_nighttime else 'NO'}  "
            f"Women: {analysis.total_women}  Men: {analysis.total_men}",
            f"Nearby Men: {analysis.nearby_men_count}  "
            f"SOS: {'YES' if analysis.sos_detected else 'NO'}",
        ]
        for i, line in enumerate(hud):
            cv2.putText(
                annotated, line, (10, 28 + i * 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, state_col, 2,
            )

        return annotated

    # ─── Backend communication (non-blocking) ────────────────────────────────

    def _push_frame_async(self, frame: np.ndarray):
        """Non-blocking POST of annotated JPEG to backend /frame (MJPEG stream)."""
        try:
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
            data = buf.tobytes()
            url = f"{self.stream_cfg.BACKEND_URL}/frame"

            def _post():
                try:
                    requests.post(
                        url, data=data,
                        headers={"Content-Type": "application/octet-stream"},
                        timeout=0.3,
                    )
                except Exception:
                    pass

            threading.Thread(target=_post, daemon=True).start()
        except Exception:
            pass

    def _post_detection(
        self, frame_count: int,
        men_count: int, women_count: int, unknown_count: int,
    ):
        """POST gender counts to backend /detections."""
        url = f"{self.stream_cfg.BACKEND_URL}/detections"
        total = men_count + women_count + unknown_count
        try:
            resp = requests.post(url, params={
                "camera_id": self.stream_cfg.CAMERA_ID,
                "total_people": total,
                "male_count": men_count,
                "female_count": women_count,
            }, timeout=0.5)
            if resp.status_code == 200:
                alerts = resp.json().get("alerts_generated", [])
                if alerts:
                    logger.warning(
                        "[Frame %d] %d alert(s) generated by backend",
                        frame_count, len(alerts),
                    )
                    for a in alerts:
                        logger.warning("  → %s | %s", a.get("severity"), a.get("description"))
                else:
                    logger.debug("[Frame %d] Detection sent — no alerts", frame_count)
        except requests.exceptions.RequestException:
            logger.debug("Backend offline at %s", url)
        except Exception as e:
            logger.error("Detection POST error: %s", e)

    def _post_surrounded_alert(self, frame_count: int):
        """POST a SURROUNDED alert to backend /alerts."""
        url = f"{self.stream_cfg.BACKEND_URL}/alerts"
        try:
            requests.post(url, params={
                "camera_id": self.stream_cfg.CAMERA_ID,
                "alert_type_id": 1,
                "severity": "HIGH",
                "confidence": 0.9,
                "description": "Woman surrounded by men detected",
            }, timeout=0.5)
            logger.warning("[Frame %d] 🚨 SURROUNDED alert sent", frame_count)
        except Exception:
            pass

    def _post_sos_alert(self, frame_count: int):
        """POST an SOS gesture alert to backend /api/v1/sos."""
        url = f"{self.stream_cfg.BACKEND_URL}/api/v1/sos"
        try:
            requests.post(url, json={
                "device_id": f"camera-{self.stream_cfg.CAMERA_ID}",
                "user_id": "cv-pipeline",
                "gps_lat": None,
                "gps_lon": None,
                "message": (
                    f"SOS gesture detected by camera {self.stream_cfg.CAMERA_ID}"
                ),
            }, timeout=0.5)
            logger.warning("[Frame %d] 🆘 SOS alert sent", frame_count)
        except Exception:
            pass

    # ─── Main video loop ──────────────────────────────────────────────────────

    def run(self, source: Optional[str] = None, show: bool = True):
        """
        Start the real-time detection loop on the given video source.
        Uses ThreadedFrameBuffer for async reading and KalmanTrackPredictor
        for interpolating missing tracks during freeze frames.
        Press 'q' to quit when show=True.
        """
        src: object = source or self.stream_cfg.DEFAULT_SOURCE
        try:
            src = int(src)  # type: ignore[arg-type]
        except (ValueError, TypeError):
            pass

        fb = ThreadedFrameBuffer(src, queue_size=self.stream_cfg.FRAME_BUFFER_SIZE).start()
        prev_time = time.time()
        logger.info("▶ Streaming from source=%s", src)

        try:
            while fb.running():
                frame, frame_count, timestamp = fb.read()
                if frame is None:
                    time.sleep(0.01)
                    continue

                analysis = self.process_frame(frame)

                # Track surrounded-frame counts (for annotation; per-frame update)
                women_dets = [d for d in analysis.detections if d.class_name == "woman"]
                men_dets = [d for d in analysis.detections if d.class_name == "man"]
                men_centers = [d.center for d in men_dets]
                current_ids = {d.track_id for d in analysis.detections if d.track_id != -1}

                for w in women_dets:
                    if w.track_id == -1:
                        continue
                    nearby = sum(
                        1 for mc in men_centers
                        if self._euclidean(w.center, mc) <= self.prox_cfg.NEARBY_DISTANCE_PX
                    )
                    self._surrounded_frame_count.setdefault(w.track_id, 0)
                    if nearby >= self.prox_cfg.MIN_MEN_SURROUND:
                        self._surrounded_frame_count[w.track_id] += 1
                    else:
                        self._surrounded_frame_count[w.track_id] = 0

                # Annotate and draw Kalman interpolated tracks
                annotated = self.annotate_frame(frame, analysis)
                for tid, trk in list(self._motion_predictor.tracks.items()):
                    if tid not in current_ids:
                        trk["missed"] += 1
                        if trk["missed"] <= self._INTERPOLATION_MAX_MISSED:
                            pred = self._motion_predictor.predict(tid, timestamp)
                            if pred:
                                px1, py1, px2, py2 = pred
                                gender = self._stable_gender.get(tid, "Unknown")
                                self._draw_label(
                                    annotated,
                                    f"ID:{tid} {gender} (interpolated)",
                                    px1, py1, (100, 100, 100),
                                )
                                cv2.rectangle(
                                    annotated, (px1, py1), (px2, py2),
                                    (100, 100, 100), 1, cv2.LINE_AA,
                                )

                # Backend: detection counts + alerts every N frames
                if frame_count % self.stream_cfg.SEND_EVERY_N_FRAMES == 0:
                    men_count = sum(1 for d in analysis.detections if d.class_name == "man")
                    women_count = analysis.total_women
                    unknown_count = sum(
                        1 for d in analysis.detections if d.class_name == "person"
                    )
                    self._post_detection(frame_count, men_count, women_count, unknown_count)

                    if analysis.threat_state == ThreatState.HIGH_RISK_SURROUNDED:
                        self._post_surrounded_alert(frame_count)

                    if analysis.sos_detected:
                        self._post_sos_alert(frame_count)

                # Push annotated frame to MJPEG stream endpoint
                self._push_frame_async(annotated)

                # Status bar
                status = (
                    f"Total: {len(analysis.detections)}  "
                    f"Men: {analysis.total_men}  Women: {analysis.total_women}  "
                    f"State: {analysis.threat_state.value}"
                )
                if analysis.sos_detected:
                    status += "  | SOS!"
                cv2.putText(
                    annotated, status, (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
                )

                # FPS counter (top-right)
                now = time.time()
                dt = now - prev_time
                fps = 1.0 / dt if dt > 0 else 0.0
                prev_time = now
                fps_text = f"FPS: {fps:.1f}"
                tw = cv2.getTextSize(fps_text, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0][0]
                cv2.putText(
                    annotated, fps_text,
                    (annotated.shape[1] - tw - 15, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2,
                )

                if show:
                    cv2.imshow("Women Safety Analytics", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

        finally:
            fb.stop()
            if self._pose is not None:
                self._pose.close()
            cv2.destroyAllWindows()
            logger.info("■ Stream stopped.")


# ─── CLI entry point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Women Safety Surveillance Detector")
    parser.add_argument("--source", default=None,
                        help="Video source: file path, RTSP URL, or webcam index (default from config)")
    parser.add_argument("--device", default="cpu",
                        help="Inference device: cpu, cuda, mps (default: cpu)")
    parser.add_argument("--no-show", action="store_true",
                        help="Run headless — no display window")
    args = parser.parse_args()

    det_cfg = DetectionConfig(DEVICE=args.device)
    detector = SafetyDetector(det_cfg=det_cfg)
    detector.run(source=args.source, show=not args.no_show)
