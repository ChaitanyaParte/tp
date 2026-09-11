"""
detector.py — Nighttime Lone Woman & Surrounding Threat Detection Pipeline
===========================================================================

Production inference pipeline using YOLOv8 with:
  • Multi-class detection (woman / man)
  • Nighttime context awareness (auto-activates 8 PM – 6 AM)
  • Spatial proximity analysis (center distance + bbox IoU)
  • Real-time threat scoring with state machine
  • Automatic alert dispatch on HIGH_RISK_SURROUNDED

Author: SIH Women Safety Team
"""

from __future__ import annotations

import time
import math
import logging
from enum import Enum
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict

# pyrefly: ignore [missing-import]
import cv2
import numpy as np
from ultralytics import YOLO

from config import (
    DetectionConfig,
    ProximityConfig,
    NightConfig,
    AlertConfig,
    StreamConfig,
    AutoSOSConfig,
)
from alert_engine import AlertEngine, AlertPayload, SOSPromptPayload, AutoSOSPayload

# ─── Logging ────────────────────────────────────────────────────────────────
logger = logging.getLogger("safety.detector")
logger.setLevel(logging.DEBUG)
_handler = logging.StreamHandler()
_handler.setFormatter(
    logging.Formatter("[%(asctime)s] %(levelname)s | %(name)s | %(message)s")
)
logger.addHandler(_handler)


# ─── Enums & Data Structures ───────────────────────────────────────────────

class ThreatState(str, Enum):
    """Finite-state threat levels for the current scene."""
    SAFE = "SAFE"
    MONITORING = "MONITORING"               # night + lone woman, no surrounding men
    ELEVATED = "ELEVATED"                   # 1 man nearby at night
    HIGH_RISK_SURROUNDED = "HIGH_RISK_SURROUNDED"  # >= 2 men surrounding


@dataclass
class Detection:
    """Single detected person with class, confidence, and bbox."""
    class_name: str          # "woman" or "man"
    confidence: float
    bbox: Tuple[int, int, int, int]   # (x1, y1, x2, y2)
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
    threat_score: float               # 0.0 – 1.0
    nearby_men_count: int
    nearby_men_distances: List[float]
    detections: List[Detection]
    frame_index: int


# ─── Core Detection Pipeline ───────────────────────────────────────────────

class SafetyDetector:
    """
    End-to-end pipeline: ingest video → detect → analyse proximity
    → score threat → dispatch alerts.
    """

    def __init__(
        self,
        det_cfg: DetectionConfig = DetectionConfig(),
        prox_cfg: ProximityConfig = ProximityConfig(),
        night_cfg: NightConfig = NightConfig(),
        alert_cfg: AlertConfig = AlertConfig(),
        stream_cfg: StreamConfig = StreamConfig(),
    ):
        self.det_cfg = det_cfg
        self.prox_cfg = prox_cfg
        self.night_cfg = night_cfg
        self.alert_cfg = alert_cfg
        self.stream_cfg = stream_cfg

        # ── Load YOLOv8 model ───────────────────────────────────────────
        logger.info("Loading YOLOv8 model from %s …", det_cfg.MODEL_PATH)
        self.model = YOLO(det_cfg.MODEL_PATH)
        logger.info("Model loaded on device=%s", det_cfg.DEVICE)

        # ── Load gender classifier if using generic "person" detection ──
        self._gender_net = None
        self._gender_labels = ["Male", "Female"]
        self._gender_mean = (78.4263377603, 87.7689143744, 114.895847746)
        needs_gender = "person" in det_cfg.CLASS_MAP.values()
        if needs_gender:
            try:
                self._gender_net = cv2.dnn.readNetFromCaffe(
                    det_cfg.GENDER_PROTO, det_cfg.GENDER_MODEL
                )
                logger.info("Gender classifier loaded (%s)", det_cfg.GENDER_MODEL)
            except Exception as e:
                logger.warning(
                    "Gender classifier not loaded — all persons will be "
                    "labelled 'person': %s", e
                )

        # ── Alert engine (handles dispatch + cooldown + escalation) ─────
        self.alert_engine = AlertEngine(alert_cfg)

        # ── State tracking ──────────────────────────────────────────────
        self._frame_idx: int = 0
        self._high_risk_streak: int = 0
        self._last_state: ThreatState = ThreatState.SAFE

    # ────────────────────────────────────────────────────────────────────
    # 1. NIGHTTIME CONTEXT CHECK
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def is_nighttime(night_cfg: NightConfig, now: Optional[datetime] = None) -> bool:
        """
        Returns True if the current local hour falls within the
        high-risk nighttime window [START_HOUR, END_HOUR).
        Handles midnight-crossing windows correctly.
        """
        hour = (now or datetime.now()).hour
        start, end = night_cfg.START_HOUR, night_cfg.END_HOUR
        if start > end:
            # Window wraps midnight: e.g. 20 → 6
            return hour >= start or hour < end
        return start <= hour < end

    # ────────────────────────────────────────────────────────────────────
    # 2. AUTO-SOS WINDOW CHECK
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def is_auto_sos_window(
        auto_cfg: AutoSOSConfig, now: Optional[datetime] = None
    ) -> bool:
        """
        Returns True if the current hour falls within the auto-SOS
        window [AUTO_SOS_START_HOUR, AUTO_SOS_END_HOUR).
        E.g. 22:00 → 07:00 means 10 PM to 7 AM.
        """
        hour = (now or datetime.now()).hour
        start, end = auto_cfg.AUTO_SOS_START_HOUR, auto_cfg.AUTO_SOS_END_HOUR
        if start > end:
            return hour >= start or hour < end
        return start <= hour < end

    # ────────────────────────────────────────────────────────────────────
    # 3. INFERENCE — RUN YOLO ON A SINGLE FRAME
    # ────────────────────────────────────────────────────────────────────

    def _classify_gender(self, frame: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> str:
        """Run Caffe gender classifier on a person crop. Returns 'woman' or 'man'."""
        if self._gender_net is None:
            return "person"
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return "person"
        blob = cv2.dnn.blobFromImage(crop, 1.0, (227, 227), self._gender_mean, swapRB=False)
        self._gender_net.setInput(blob)
        pred = self._gender_net.forward()
        idx = int(pred[0].argmax())
        return "man" if self._gender_labels[idx] == "Male" else "woman"

    def _run_inference(self, frame: np.ndarray) -> List[Detection]:
        """Run YOLOv8 on a single BGR frame and return typed Detections."""
        results = self.model.predict(
            source=frame,
            conf=self.det_cfg.CONFIDENCE_THRESHOLD,
            iou=self.det_cfg.IOU_THRESHOLD,
            imgsz=self.det_cfg.INPUT_SIZE[0],
            device=self.det_cfg.DEVICE,
            verbose=False,
        )

        detections: List[Detection] = []
        for result in (results or []):
            boxes = getattr(result, "boxes", None)
            boxes_list = [boxes[i] for i in range(len(boxes))] if boxes is not None else []
            for box in boxes_list:
                cls_id = int(box.cls[0])
                class_name = self.det_cfg.CLASS_MAP.get(cls_id)
                if class_name is None:
                    continue
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                if class_name == "person":
                    class_name = self._classify_gender(frame, x1, y1, x2, y2)
                detections.append(Detection(
                    class_name=class_name,
                    confidence=float(box.conf[0]),
                    bbox=(x1, y1, x2, y2),
                ))
        return detections

    # ────────────────────────────────────────────────────────────────────
    # 3. SPATIAL PROXIMITY ANALYSIS
    # ────────────────────────────────────────────────────────────────────

    @staticmethod
    def _euclidean(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        return math.hypot(a[0] - b[0], a[1] - b[1])

    @staticmethod
    def _bbox_iou(a: Tuple[int, ...], b: Tuple[int, ...]) -> float:
        """Compute IoU between two (x1, y1, x2, y2) boxes."""
        xa = max(a[0], b[0])
        ya = max(a[1], b[1])
        xb = min(a[2], b[2])
        yb = min(a[3], b[3])
        inter = max(0, xb - xa) * max(0, yb - ya)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0

    def _find_nearby_men(
        self, woman: Detection, men: List[Detection]
    ) -> Tuple[List[Detection], List[float]]:
        """
        Return men within NEARBY_DISTANCE_PX of the woman
        OR whose bounding boxes overlap above ENCROACHMENT_IOU.
        """
        nearby: List[Detection] = []
        distances: List[float] = []
        for m in men:
            dist = self._euclidean(woman.center, m.center)
            iou = self._bbox_iou(woman.bbox, m.bbox)
            if dist <= self.prox_cfg.NEARBY_DISTANCE_PX or iou >= self.prox_cfg.ENCROACHMENT_IOU:
                nearby.append(m)
                distances.append(round(dist, 1))
        return nearby, distances

    # ────────────────────────────────────────────────────────────────────
    # 4. THREAT SCORE CALCULATION
    # ────────────────────────────────────────────────────────────────────

    def _compute_threat_score(
        self,
        is_night: bool,
        women: List[Detection],
        nearby_men_count: int,
        avg_distance: float,
    ) -> float:
        """
        Composite 0–1 threat score.
        Factors: time-of-day, isolation, surrounding count, proximity.
        """
        score = 0.0

        # Night multiplier (base risk)
        if is_night:
            score += 0.25

        # Lone woman factor
        if len(women) == 1:
            score += 0.15

        # Surrounding men factor (saturates at 4+)
        men_factor = min(nearby_men_count / 4.0, 1.0) * 0.35
        score += men_factor

        # Proximity pressure: closer = higher risk
        if avg_distance > 0:
            max_dist = self.prox_cfg.NEARBY_DISTANCE_PX
            closeness = max(0.0, 1.0 - (avg_distance / max_dist))
            score += closeness * 0.25

        return round(min(score, 1.0), 3)

    # ────────────────────────────────────────────────────────────────────
    # 5. STATE MACHINE — DETERMINE THREAT STATE
    # ────────────────────────────────────────────────────────────────────

    def _resolve_threat_state(
        self,
        is_night: bool,
        women: List[Detection],
        nearby_count: int,
    ) -> ThreatState:
        """
        State transitions:
            SAFE → MONITORING → ELEVATED → HIGH_RISK_SURROUNDED
        """
        if not is_night or len(women) == 0:
            return ThreatState.SAFE

        if len(women) >= 1 and nearby_count == 0:
            return ThreatState.MONITORING

        if len(women) >= 1 and 0 < nearby_count < self.prox_cfg.MIN_MEN_SURROUND:
            return ThreatState.ELEVATED

        if len(women) >= 1 and nearby_count >= self.prox_cfg.MIN_MEN_SURROUND:
            return ThreatState.HIGH_RISK_SURROUNDED

        return ThreatState.SAFE

    # ────────────────────────────────────────────────────────────────────
    # 6. SPATIAL DENSITY MAP (heatmap for UI overlay)
    # ────────────────────────────────────────────────────────────────────

    def compute_density_map(
        self, detections: List[Detection], frame_shape: Tuple[int, int]
    ) -> np.ndarray:
        """
        Generate a spatial density grid counting person detections
        per cell. Useful for heatmap overlays in the frontend.
        """
        h, w = frame_shape[:2]
        cell = self.prox_cfg.DENSITY_CELL_PX
        grid_h, grid_w = max(1, h // cell), max(1, w // cell)
        density = np.zeros((grid_h, grid_w), dtype=np.float32)

        for det in detections:
            cx, cy = det.center
            gi = min(int(cy // cell), grid_h - 1)
            gj = min(int(cx // cell), grid_w - 1)
            density[gi, gj] += 1.0

        return density

    # ────────────────────────────────────────────────────────────────────
    # 7. PROCESS SINGLE FRAME (public API)
    # ────────────────────────────────────────────────────────────────────

    def process_frame(self, frame: np.ndarray) -> SceneAnalysis:
        """
        Full pipeline on one frame:
        detect → classify → proximity → score → state → alert.
        """
        self._frame_idx += 1
        ts = time.time()
        is_night = self.is_nighttime(self.night_cfg)

        # ── Inference ───────────────────────────────────────────────────
        detections = self._run_inference(frame)
        women = [d for d in detections if d.class_name == "woman"]
        men = [d for d in detections if d.class_name == "man"]

        # ── Proximity analysis (relative to the first detected woman) ──
        nearby_men: List[Detection] = []
        nearby_dists: List[float] = []
        if women:
            # Analyze proximity for each woman; aggregate for scene
            for w in women:
                nm, nd = self._find_nearby_men(w, men)
                nearby_men.extend(nm)
                nearby_dists.extend(nd)
            # Deduplicate (a man can be near multiple women)
            seen_ids = set()
            unique_nearby: List[Detection] = []
            unique_dists: List[float] = []
            for m, d in zip(nearby_men, nearby_dists):
                mid = id(m)
                if mid not in seen_ids:
                    seen_ids.add(mid)
                    unique_nearby.append(m)
                    unique_dists.append(d)
            nearby_men, nearby_dists = unique_nearby, unique_dists

        nearby_count = len(nearby_men)
        avg_dist = (sum(nearby_dists) / nearby_count) if nearby_count else 0.0

        # ── Threat scoring & state ──────────────────────────────────────
        threat_score = self._compute_threat_score(
            is_night, women, nearby_count, avg_dist
        )
        threat_state = self._resolve_threat_state(
            is_night, women, nearby_count
        )

        # ── Streak tracking for escalation ──────────────────────────────
        if threat_state == ThreatState.HIGH_RISK_SURROUNDED:
            self._high_risk_streak += 1
        else:
            self._high_risk_streak = 0

        # ── Alert dispatch ──────────────────────────────────────────────
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
            logger.warning(
                "⚠  HIGH_RISK_SURROUNDED | score=%.3f | men_nearby=%d | "
                "avg_dist=%.1fpx | streak=%d | escalated=%s",
                threat_score, nearby_count, avg_dist,
                self._high_risk_streak, escalated,
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
        )

    # ────────────────────────────────────────────────────────────────────
    # 8. ANNOTATE FRAME (debug / monitoring overlay)
    # ────────────────────────────────────────────────────────────────────

    def annotate_frame(
        self, frame: np.ndarray, analysis: SceneAnalysis
    ) -> np.ndarray:
        """Draw bounding boxes, threat state, and proximity lines."""
        annotated = frame.copy()

        color_map = {"woman": (255, 0, 200), "man": (0, 180, 255)}
        state_colors = {
            ThreatState.SAFE: (0, 200, 0),
            ThreatState.MONITORING: (0, 200, 255),
            ThreatState.ELEVATED: (0, 140, 255),
            ThreatState.HIGH_RISK_SURROUNDED: (0, 0, 255),
        }

        for det in analysis.detections:
            x1, y1, x2, y2 = det.bbox
            color = color_map.get(det.class_name, (200, 200, 200))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{det.class_name} {det.confidence:.2f}"
            cv2.putText(
                annotated, label, (x1, y1 - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1,
            )

        # Draw proximity lines from woman → nearby men
        women = [d for d in analysis.detections if d.class_name == "woman"]
        men = [d for d in analysis.detections if d.class_name == "man"]
        if women and men:
            for w in women:
                for m in men:
                    dist = self._euclidean(w.center, m.center)
                    if dist <= self.prox_cfg.NEARBY_DISTANCE_PX:
                        cv2.line(
                            annotated,
                            (int(w.center[0]), int(w.center[1])),
                            (int(m.center[0]), int(m.center[1])),
                            (0, 0, 255), 2,
                        )

        # HUD overlay
        state_col = state_colors.get(analysis.threat_state, (255, 255, 255))
        hud_lines = [
            f"State: {analysis.threat_state.value}",
            f"Score: {analysis.threat_score:.3f}",
            f"Night: {'YES' if analysis.is_nighttime else 'NO'}",
            f"Women: {analysis.total_women}  Men: {analysis.total_men}",
            f"Nearby Men: {analysis.nearby_men_count}",
        ]
        for i, line in enumerate(hud_lines):
            cv2.putText(
                annotated, line, (10, 28 + i * 26),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, state_col, 2,
            )

        return annotated

    # ────────────────────────────────────────────────────────────────────
    # 9. MAIN VIDEO STREAM LOOP
    # ────────────────────────────────────────────────────────────────────

    def run(self, source: Optional[str] = None, show: bool = True):
        """
        Start the real-time detection loop on the given video source.
        Press 'q' to quit when `show=True`.
        """
        src = source or self.stream_cfg.DEFAULT_SOURCE
        # Try integer for webcam index
        try:
            src = int(src)
        except ValueError:
            pass

        cap = cv2.VideoCapture(src)
        if not cap.isOpened():
            logger.error("Cannot open video source: %s", src)
            return

        logger.info("▶ Streaming from source=%s  (target FPS=%d)", src, self.stream_cfg.TARGET_FPS)
        frame_interval = 1.0 / self.stream_cfg.TARGET_FPS

        try:
            while True:
                t0 = time.time()
                ret, frame = cap.read()
                if not ret:
                    logger.info("End of stream.")
                    break

                analysis = self.process_frame(frame)

                if show:
                    annotated = self.annotate_frame(frame, analysis)
                    cv2.imshow("Safety Surveillance", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                # Frame-rate limiter
                elapsed = time.time() - t0
                if elapsed < frame_interval:
                    time.sleep(frame_interval - elapsed)
        finally:
            cap.release()
            cv2.destroyAllWindows()
            logger.info("■ Stream stopped.")


# ─── CLI Entry Point ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Women Safety Surveillance Detector")
    parser.add_argument("--source", type=str, default="0", help="Video source (file path, RTSP URL, or webcam index)")
    parser.add_argument("--model", type=str, default=None, help="Path to YOLOv8 .pt weights")
    parser.add_argument("--device", type=str, default="cuda", help="Inference device: cuda, cpu, mps")
    parser.add_argument("--no-show", action="store_true", help="Disable GUI display (headless mode)")
    args = parser.parse_args()

    det_cfg = DetectionConfig(
        MODEL_PATH=args.model or DetectionConfig.MODEL_PATH,
        DEVICE=args.device,
    )
    detector = SafetyDetector(det_cfg=det_cfg)
    detector.run(source=args.source, show=not args.no_show)
