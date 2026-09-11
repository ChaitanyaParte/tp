from pathlib import Path
import cv2
from ultralytics import YOLO

_SCRIPT_DIR = Path(__file__).resolve().parent
_WS_ROOT = _SCRIPT_DIR.parent

def _find_file(*candidates: Path) -> str:
    for cand in candidates:
        if cand.exists():
            return str(cand.resolve())
    return str(candidates[0].resolve())

model_path = _find_file(_SCRIPT_DIR / "yolo11n.pt", _WS_ROOT / "yolo11n.pt", _WS_ROOT.parent / "yolo11n.pt")
model = YOLO(model_path)

video_path = _find_file(_WS_ROOT / "videos" / "tp.mp4", _SCRIPT_DIR / "tp.mp4")
cap = cv2.VideoCapture(video_path)

# We need to run tracking on a few frames so ByteTrack has time to
# assign stable IDs. We grab crops from the Nth frame.
FRAME_TO_GRAB = 30   # ~1 second in at 30fps

frame_num = 0
grabbed = False

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    frame_num += 1

    # Same track call as your main pipeline
    results = model.track(frame, persist=True, classes=[0],
                          conf=0.3, imgsz=480, verbose=False)

    if frame_num == FRAME_TO_GRAB:
        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            print(f"No people detected in frame {frame_num}")
            break

        # box.id may be None early on before tracks are confirmed
        ids = boxes.id
        if ids is None:
            print(f"Boxes found but track IDs not assigned yet at frame "
                  f"{frame_num} — try a later frame")
            break

        boxes_list = [boxes[i] for i in range(len(boxes))]
        for box, track_id in zip(boxes_list, ids):
            tid = int(track_id)
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            crop = frame[y1:y2, x1:x2]
            h, w = crop.shape[:2]
            out_path = f"../videos/person_id{tid}.jpg"
            cv2.imwrite(out_path, crop)
            print(f"  person_id{tid}.jpg  size: {w}x{h}  "
                  f"det_conf: {float(box.conf[0]):.2f}")

        grabbed = True
        break

cap.release()

if not grabbed:
    print("Video ended before reaching the target frame")