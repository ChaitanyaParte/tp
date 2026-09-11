"""
compare_models.py
Runs the same video through yolo11n.pt and yolo11s.pt (or any two models you list)
and prints a side-by-side comparison: avg detections per frame, total frames with
zero detections (misses), and FPS.

Usage:
    python compare_models.py

Just make sure the VIDEO_PATH below points to the same clip you're testing on
(e.g. the one with the bench/close-up misses).
"""

import time
from pathlib import Path
from ultralytics import YOLO

_SCRIPT_DIR = Path(__file__).resolve().parent
_WS_ROOT = _SCRIPT_DIR.parent

def _find_file(*candidates: Path) -> str:
    for cand in candidates:
        if cand.exists():
            return str(cand.resolve())
    return str(candidates[0].resolve())

# ---- CONFIG: change these to match your setup ----
VIDEO_PATH = _find_file(_WS_ROOT / "videos" / "testing.mp4", _SCRIPT_DIR / "testing.mp4")
MODELS_TO_COMPARE = [
    _find_file(_SCRIPT_DIR / "yolo11n.pt", _WS_ROOT / "yolo11n.pt", _WS_ROOT.parent / "yolo11n.pt"),
    _find_file(_SCRIPT_DIR / "yolo11s.pt", _WS_ROOT / "yolo11s.pt", _WS_ROOT.parent / "yolo11s.pt")
]
CONF_THRESHOLD = 0.5                   # bump down to 0.35 later if you want to test that too
# ----------------------------------------------------


def run_model(model_name, video_path, conf):
    print(f"\n=== Running {model_name} ===")
    model = YOLO(model_name)

    total_frames = 0
    total_person_detections = 0
    frames_with_zero_people = 0

    start_time = time.time()

    results = model.track(
        source=video_path,
        conf=conf,
        classes=[0],   # class 0 = person in COCO
        stream=True,
        verbose=False,
        persist=True,
    )

    for r in results:
        total_frames += 1
        num_people = len(r.boxes) if r.boxes is not None else 0
        total_person_detections += num_people
        if num_people == 0:
            frames_with_zero_people += 1

    elapsed = time.time() - start_time
    fps = total_frames / elapsed if elapsed > 0 else 0
    avg_people_per_frame = (
        total_person_detections / total_frames if total_frames > 0 else 0
    )

    return {
        "model": model_name,
        "total_frames": total_frames,
        "avg_people_per_frame": round(avg_people_per_frame, 2),
        "frames_with_zero_people": frames_with_zero_people,
        "elapsed_sec": round(elapsed, 1),
        "fps": round(fps, 1),
    }


def main():
    results = []
    for model_name in MODELS_TO_COMPARE:
        stats = run_model(model_name, VIDEO_PATH, CONF_THRESHOLD)
        results.append(stats)

    print("\n" + "=" * 60)
    print("COMPARISON RESULTS")
    print("=" * 60)
    header = f"{'Model':<15}{'Avg People/Frame':<20}{'Zero-Detect Frames':<22}{'FPS':<8}"
    print(header)
    print("-" * len(header))
    for r in results:
        print(
            f"{r['model']:<15}"
            f"{r['avg_people_per_frame']:<20}"
            f"{r['frames_with_zero_people']:<22}"
            f"{r['fps']:<8}"
        )

    print("\nNotes:")
    print("- Higher 'Avg People/Frame' generally means better detection (fewer misses).")
    print("- Lower 'Zero-Detect Frames' means fewer frames where NO person was caught.")
    print("- Lower FPS is the tradeoff for better detection — decide what your demo needs.")


if __name__ == "__main__":
    main()