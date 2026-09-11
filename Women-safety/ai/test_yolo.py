import os
import time
import queue
import threading
from typing import Optional
from collections import Counter
from pathlib import Path
import cv2
import requests
import mediapipe as mp
from ultralytics import YOLO

# ─── Path Resolution ────────────────────────────────────────────────────────
_SCRIPT_DIR = Path(__file__).resolve().parent
_WS_ROOT = _SCRIPT_DIR.parent

def _find_file(*candidates: Path) -> str:
    for cand in candidates:
        if cand.exists():
            return str(cand.resolve())
    return str(candidates[0].resolve())

model_path = _find_file(
    _SCRIPT_DIR / "yolo11n.pt",
    _WS_ROOT / "yolo11n.pt",
    _WS_ROOT.parent / "yolo11n.pt",
)
model = YOLO(model_path)

proto_path = _find_file(
    _WS_ROOT / "models" / "gender_deploy.prototxt",
    _SCRIPT_DIR / "gender_deploy.prototxt",
)
caffe_path = _find_file(
    _WS_ROOT / "models" / "gender_net.caffemodel",
    _SCRIPT_DIR / "gender_net.caffemodel",
)

gender_net = cv2.dnn.readNetFromCaffe(proto_path, caffe_path)
gender_list = ['Male', 'Female']
MODEL_MEAN_VALUES = (78.4263377603, 87.7689143744, 114.895847746)

# --- OpenCV Face Cascade for precise head/face cropping ---
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')  # type: ignore

# --- MediaPipe Pose setup ---
mp_pose = mp.solutions.pose  # type: ignore
pose = mp_pose.Pose(  # type: ignore
    static_image_mode=False,
    model_complexity=0,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)


# ─── Requirement 4: Asynchronous Thread-Safe Frame Reader & Sync Buffer ───────
class ThreadedFrameBuffer:
    """Reads video frames asynchronously into a thread-safe queue with actual timestamps."""
    def __init__(self, video_source: str, queue_size: int = 30):
        self.cap = cv2.VideoCapture(video_source)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # reduces latency for IP camera
        self.q = queue.Queue(maxsize=queue_size)
        self.stopped = False
        self.frame_idx = 0
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or 30.0
        if self.fps <= 0:
            self.fps = 30.0

    def start(self):
        threading.Thread(target=self._update, daemon=True).start()
        return self

    def _update(self):
        while not self.stopped:
            if not self.q.full():
                ret, frame = self.cap.read()
                if not ret:
                    # Rewind video on EOF for continuous loop
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = self.cap.read()
                    if not ret:
                        self.stopped = True
                        break
                
                self.frame_idx += 1
                msec = self.cap.get(cv2.CAP_PROP_POS_MSEC)
                timestamp = (msec / 1000.0) if msec > 0 else (self.frame_idx / self.fps)
                self.q.put((frame, self.frame_idx, timestamp))
            else:
                time.sleep(0.005)

    def read(self):
        try:
            return self.q.get(timeout=0.2)
        except queue.Empty:
            return None, 0, 0.0

    def running(self):
        return not self.stopped or not self.q.empty()

    def stop(self):
        self.stopped = True
        if self.cap.isOpened():
            self.cap.release()


# ─── Requirement 3: Bounding Box Motion Interpolation / Kalman Filter ───────
class KalmanTrackPredictor:
    """Estimates motion velocity and interpolates bounding box positions during video freezes/lags."""
    def __init__(self):
        self.tracks = {}

    def update(self, track_id: int, box: list, timestamp: float):
        x1, y1, x2, y2 = box
        w = x2 - x1
        h = y2 - y1

        if track_id in self.tracks:
            prev = self.tracks[track_id]
            dt = timestamp - prev['last_time']
            if dt > 0.001 and dt < 2.0:
                prev_x1, prev_y1, prev_x2, prev_y2 = prev['last_box']
                vx = (x1 - prev_x1) / dt
                vy = (y1 - prev_y1) / dt
                vw = (w - (prev_x2 - prev_x1)) / dt
                vh = (h - (prev_y2 - prev_y1)) / dt
                alpha = 0.6
                prev['velocity'] = [
                    alpha * vx + (1 - alpha) * prev['velocity'][0],
                    alpha * vy + (1 - alpha) * prev['velocity'][1],
                    alpha * vw + (1 - alpha) * prev['velocity'][2],
                    alpha * vh + (1 - alpha) * prev['velocity'][3],
                ]
            prev['last_box'] = [x1, y1, x2, y2]
            prev['last_time'] = timestamp
            prev['missed'] = 0
        else:
            self.tracks[track_id] = {
                'last_box': [x1, y1, x2, y2],
                'last_time': timestamp,
                'velocity': [0.0, 0.0, 0.0, 0.0],
                'missed': 0
            }

    def predict(self, track_id: int, current_time: float) -> Optional[list]:
        if track_id not in self.tracks:
            return None
        track = self.tracks[track_id]
        dt = current_time - track['last_time']
        if dt <= 0:
            return track['last_box']
        
        x1, y1, x2, y2 = track['last_box']
        vx, vy, vw, vh = track['velocity']
        
        pred_x1 = int(x1 + vx * dt)
        pred_y1 = int(y1 + vy * dt)
        pred_w = int((x2 - x1) + vw * dt)
        pred_h = int((y2 - y1) + vh * dt)
        
        pred_x2 = pred_x1 + max(20, pred_w)
        pred_y2 = pred_y1 + max(20, pred_h)
        return [pred_x1, pred_y1, pred_x2, pred_y2]


def get_track_id(box) -> int:
    """Safely extract track_id from Ultralytics box without type stub errors."""
    if hasattr(box, "id") and box.id is not None:
        try:
            return int(box.id[0])  # type: ignore
        except Exception:
            return -1
    return -1

def draw_label(img, text, x, y, bg_color, text_color=(255, 255, 255), font_scale=0.55, thickness=2):
    """Draw text with solid background box to prevent text overlap."""
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
    pad = 4
    if y - th - pad * 2 < 0:
        y_bg1 = y
        y_bg2 = y + th + pad * 2
        y_text = y + th + pad
    else:
        y_bg1 = y - th - pad * 2
        y_bg2 = y
        y_text = y - pad
    cv2.rectangle(img, (x, y_bg1), (x + tw + pad * 2, y_bg2), bg_color, -1)
    cv2.putText(img, text, (x + pad, y_text), cv2.FONT_HERSHEY_SIMPLEX, font_scale, text_color, thickness, cv2.LINE_AA)

# --- Requirement 1: Baseline Confidence Threshold = 0.60 ---
CONFIDENCE_DETECTION_THRESHOLD = 0.60
GENDER_CONF_THRESHOLD = 0.50
MAX_SAMPLES_PER_PERSON = 25
MIN_SAMPLES_FOR_DECISION = 3
MAJORITY_RATIO_REQUIRED = 0.60

# --- Backend settings ---
BACKEND_URL = os.getenv("BACKEND_URL", "http://172.23.79.101:8000") 
CAMERA_ID = 1
SEND_EVERY_N_FRAMES = 30

# --- Alert engine settings ---
SURROUNDED_DISTANCE_THRESHOLD = 150
SURROUNDED_MIN_MEN = 3
SURROUNDED_ALERT_FRAMES = 10
surrounded_frame_count = {}

SOS_HOLD_FRAMES = 15
sos_frame_count = {}

gender_history = {}
gender_attempts = {}
stable_gender = {}
person_centers = {}


# --- Push annotated frame to backend stream (Non-blocking Threaded) ---
def _async_post_frame(data_bytes):
    try:
        requests.post(
            f"{BACKEND_URL}/frame",
            data=data_bytes,
            headers={"Content-Type": "application/octet-stream"},
            timeout=0.3
        )
    except Exception:
        pass

def push_frame(frame):
    try:
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 65])
        threading.Thread(target=_async_post_frame, args=(buffer.tobytes(),), daemon=True).start()
    except Exception:
        pass


# IP Webcam phone camera
video_path = "http://172.23.79.168:8080/video"

# Initialize Requirement 4: Threaded Frame Reader
buffer = ThreadedFrameBuffer(video_path, queue_size=30).start()

# Initialize Requirement 3: Kalman Motion Predictor
motion_predictor = KalmanTrackPredictor()

prev_time = time.time()
last_processed_timestamp = 0.0

while buffer.running():
    frame, frame_count, timestamp = buffer.read()
    if frame is None:
        time.sleep(0.01)
        continue

    # Detect video freeze or timestamp lag gap (> 0.2s)
    time_gap = timestamp - last_processed_timestamp if last_processed_timestamp > 0 else 0.033
    last_processed_timestamp = timestamp

    # ── Requirement 1 & 2: YOLOv11 Person Detection + ByteTrack (conf=0.60) ──
    results = model.track(
        frame, 
        persist=True, 
        tracker="bytetrack.yaml", 
        classes=[0], 
        conf=CONFIDENCE_DETECTION_THRESHOLD
    )
    boxes = results[0].boxes
    boxes_list = [boxes[i] for i in range(len(boxes))] if boxes is not None else []

    men_count = 0
    women_count = 0
    unknown_count = 0
    surrounded_alerts = 0
    sos_alerts = 0

    annotated_frame = frame.copy()
    current_track_ids = set()

    # ── FIRST PASS: Update tracks, Kalman Filter, Gender & SOS ────────────────
    for box in boxes_list:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        track_id = get_track_id(box)
        if track_id != -1:
            current_track_ids.add(track_id)
            # Update Requirement 3: Kalman motion velocity
            motion_predictor.update(track_id, [x1, y1, x2, y2], timestamp)
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            person_centers[track_id] = (cx, cy)

        gender_attempts.setdefault(track_id, 0)
        gender_history.setdefault(track_id, [])
        sos_frame_count.setdefault(track_id, 0)

        # ── Gender classification ─────────────────────────────────────────────
        if track_id not in stable_gender:
            if gender_attempts[track_id] < MAX_SAMPLES_PER_PERSON:
                fh, fw = frame.shape[:2]
                px1 = max(0, x1)
                py1 = max(0, y1)
                px2 = min(fw, x2)
                py2 = min(fh, y2)
                h_box = py2 - py1
                w_box = px2 - px1

                # 85% height crop + 5% width padding for optimal gender classification
                cy2 = min(fh, py1 + int(h_box * 0.85))
                pad_w = int(w_box * 0.05)
                cx1 = max(0, px1 - pad_w)
                cx2 = min(fw, px2 + pad_w)
                person_crop = frame[py1:cy2, cx1:cx2]

                if person_crop is not None and person_crop.size != 0 and person_crop.shape[0] > 15 and person_crop.shape[1] > 15:
                    blob = cv2.dnn.blobFromImage(
                        person_crop, 1.0, (227, 227), MODEL_MEAN_VALUES, swapRB=False
                    )
                    gender_net.setInput(blob)
                    prediction = gender_net.forward()
                    predicted_label = gender_list[prediction[0].argmax()]
                    confidence = float(prediction[0].max())

                    gender_attempts[track_id] += 1

                    if confidence >= GENDER_CONF_THRESHOLD:
                        gender_history[track_id].append(predicted_label)

                    votes = gender_history[track_id]
                    if len(votes) >= MIN_SAMPLES_FOR_DECISION:
                        counts = Counter(votes)
                        top_label, top_count = counts.most_common(1)[0]
                        agreement = top_count / len(votes)
                        if agreement >= MAJORITY_RATIO_REQUIRED:
                            stable_gender[track_id] = top_label

        gender = stable_gender.get(track_id, "Unknown")
        if gender == 'Male':
            men_count += 1
        elif gender == 'Female':
            women_count += 1
        else:
            unknown_count += 1

        # ── SOS Gesture Detection ─────────────────────────────────────────────
        pad = 10
        px1 = max(0, x1 - pad)
        py1 = max(0, y1 - pad)
        px2 = min(frame.shape[1], x2 + pad)
        py2 = min(frame.shape[0], y2 + pad)
        person_full_crop = frame[py1:py2, px1:px2]

        if (frame_count + track_id) % 4 == 0 and person_full_crop.size != 0 and person_full_crop.shape[0] > 50:
            rgb_crop = cv2.cvtColor(person_full_crop, cv2.COLOR_BGR2RGB)
            pose_result = pose.process(rgb_crop)

            pose_landmarks = getattr(pose_result, "pose_landmarks", None) if pose_result else None
            if pose_landmarks is not None:
                lm = getattr(pose_landmarks, "landmark", None)
                if lm is not None and len(lm) > 16:
                    nose_y        = lm[0].y
                    left_wrist_y  = lm[15].y
                    right_wrist_y = lm[16].y

                    nose_visible        = lm[0].visibility > 0.5
                    left_wrist_visible  = lm[15].visibility > 0.5
                    right_wrist_visible = lm[16].visibility > 0.5

                    if nose_visible and left_wrist_visible and right_wrist_visible:
                        both_hands_raised = (
                            left_wrist_y  < nose_y and
                            right_wrist_y < nose_y
                        )
                        if both_hands_raised:
                            sos_frame_count[track_id] += 1
                        else:
                            sos_frame_count[track_id] = max(0, sos_frame_count[track_id] - 1)
                    else:
                        sos_frame_count[track_id] = max(0, sos_frame_count[track_id] - 1)
                else:
                    sos_frame_count[track_id] = max(0, sos_frame_count[track_id] - 1)
            else:
                sos_frame_count[track_id] = max(0, sos_frame_count[track_id] - 1)

    # ── Requirement 3: Interpolate Missing Tracks During Video Freezes ───────
    for tid, trk in list(motion_predictor.tracks.items()):
        if tid not in current_track_ids:
            trk['missed'] += 1
            if trk['missed'] <= 15: # Interpolate up to 15 freeze frames (~0.5s)
                pred_box = motion_predictor.predict(tid, timestamp)
                if pred_box:
                    px1, py1, px2, py2 = pred_box
                    gender = stable_gender.get(tid, "Unknown")
                    draw_label(annotated_frame, f"ID:{tid} {gender} (interpolated)", px1, py1, (100, 100, 100))
                    cv2.rectangle(annotated_frame, (px1, py1), (px2, py2), (100, 100, 100), 1, cv2.LINE_AA)

    # SOS state per track_id
    sos_active = {
        tid: (sos_frame_count.get(tid, 0) >= SOS_HOLD_FRAMES)
        for tid in sos_frame_count
    }

    # ── SECOND PASS: Surrounded Detection + Draw Bounding Boxes ─────────────
    men_centers = [
        person_centers[get_track_id(b)]
        for b in boxes_list
        if get_track_id(b) in person_centers and stable_gender.get(get_track_id(b), "Unknown") == "Male"
    ]
    women_ids = [
        get_track_id(b)
        for b in boxes_list
        if get_track_id(b) != -1 and stable_gender.get(get_track_id(b), "Unknown") == "Female"
    ]

    for box in boxes_list:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        track_id = get_track_id(box)
        gender = stable_gender.get(track_id, "Unknown")

        is_surrounded = False
        is_sos = sos_active.get(track_id, False)

        if gender == "Female" and track_id in women_ids and track_id in person_centers:
            cx, cy = person_centers[track_id]
            nearby_men = sum(
                1 for mcx, mcy in men_centers
                if ((cx - mcx) ** 2 + (cy - mcy) ** 2) ** 0.5 <= SURROUNDED_DISTANCE_THRESHOLD
            )
            surrounded_frame_count.setdefault(track_id, 0)
            if nearby_men >= SURROUNDED_MIN_MEN:
                surrounded_frame_count[track_id] += 1
            else:
                surrounded_frame_count[track_id] = 0

            if surrounded_frame_count[track_id] >= SURROUNDED_ALERT_FRAMES:
                is_surrounded = True
                surrounded_alerts += 1

        # ── Render Bounding Boxes ─────────────────────────────────────────────
        if is_sos:
            sos_alerts += 1
            color = (0, 0, 255)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 3)
            draw_label(annotated_frame, f"ID:{track_id} SOS DETECTED", x1, y1, color)

        elif is_surrounded:
            color = (0, 165, 255)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 3)
            draw_label(annotated_frame, f"ID:{track_id} SURROUNDED", x1, y1, color)

        elif gender == 'Male':
            color = (255, 120, 0)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            draw_label(annotated_frame, f"ID:{track_id} Male", x1, y1, color)

        elif gender == 'Female':
            color = (203, 0, 255)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            draw_label(annotated_frame, f"ID:{track_id} Female", x1, y1, color)

        else:
            color = (120, 120, 120)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            draw_label(annotated_frame, f"ID:{track_id} Unknown", x1, y1, color)

    # ── BACKEND ALERTS ────────────────────────────────────────────────────────
    if frame_count % SEND_EVERY_N_FRAMES == 0:
        total_people = men_count + women_count + unknown_count
        try:
            resp = requests.post(f"{BACKEND_URL}/detections", params={
                "camera_id": CAMERA_ID,
                "total_people": total_people,
                "male_count": men_count,
                "female_count": women_count
            }, timeout=0.5)
            if resp.status_code == 200:
                data = resp.json()
                alerts = data.get("alerts_generated", [])
                if alerts:
                    print(f"[Frame {frame_count}] ⚠️  {len(alerts)} alert(s) generated!")
                    for a in alerts:
                        print(f"   → {a['severity']} | {a['description']}")
                else:
                    print(f"[Frame {frame_count}] ✅ Detection sent — no alerts")
        except requests.exceptions.RequestException:
            print(f"[Frame {frame_count}] ℹ️ Backend server offline ({BACKEND_URL})")
        except Exception as e:
            print(f"[Frame {frame_count}] ❌ Backend error: {e}")

        if surrounded_alerts > 0:
            try:
                requests.post(f"{BACKEND_URL}/alerts", params={
                    "camera_id": CAMERA_ID,
                    "alert_type_id": 1,
                    "severity": "HIGH",
                    "confidence": 0.9,
                    "description": f"Woman surrounded by men — {surrounded_alerts} instance(s)"
                }, timeout=0.5)
                print(f"[Frame {frame_count}] 🚨 SURROUNDED alert sent!")
            except Exception:
                pass

        if sos_alerts > 0:
            try:
                requests.post(f"{BACKEND_URL}/api/v1/sos", json={
                    "device_id": f"camera-{CAMERA_ID}",
                    "user_id": "cv-pipeline",
                    "gps_lat": None,
                    "gps_lon": None,
                    "message": f"SOS gesture detected by camera {CAMERA_ID}"
                }, timeout=0.5)
                print(f"[Frame {frame_count}] 🆘 SOS alert sent!")
            except Exception:
                pass

    # ── STATUS BAR ────────────────────────────────────────────────────────────
    status = f"Total: {len(boxes_list)}  Men: {men_count}  Women: {women_count}  Unknown: {unknown_count}"
    if surrounded_alerts > 0:
        status += f"  | SURROUNDED: {surrounded_alerts}"
    if sos_alerts > 0:
        status += f"  | SOS: {sos_alerts}"
    cv2.putText(annotated_frame, status,
                (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

    # ── FPS ───────────────────────────────────────────────────────────────────
    curr_time = time.time()
    dt = curr_time - prev_time
    fps = 1.0 / dt if dt > 0 else 0.0
    prev_time = curr_time
    fps_text = f"FPS: {fps:.1f}"
    text_size = cv2.getTextSize(fps_text, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
    fps_x = annotated_frame.shape[1] - text_size[0] - 15
    cv2.putText(annotated_frame, fps_text,
                (fps_x, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

    # ── PUSH FRAME TO BACKEND MJPEG STREAM ────────────────────────────────────
    push_frame(annotated_frame)

    try:
        cv2.imshow("Women Safety Analytics", annotated_frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
    except Exception:
        pass

pose.close()
buffer.stop()
cv2.destroyAllWindows()