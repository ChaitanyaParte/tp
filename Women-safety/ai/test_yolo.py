"""
test_yolo.py — CLI entry point for the Women Safety AI pipeline.

Delegates all logic to the unified SafetyDetector in SOS_Alert/detector.py.
Run from the Women-safety/ai/ directory or from the project root:

    python Women-safety/ai/test_yolo.py
    python Women-safety/ai/test_yolo.py --source http://192.168.1.x:8080/video
    python Women-safety/ai/test_yolo.py --source 0 --device cuda --no-show
    python Women-safety/ai/test_yolo.py --backend http://localhost:8000 --camera-id 2
"""

import sys
import argparse
import os
from pathlib import Path

# Add SOS_Alert to sys.path so the unified detector module can be imported
_SOS_ALERT_DIR = Path(__file__).resolve().parent.parent.parent / "SOS_Alert"
if str(_SOS_ALERT_DIR) not in sys.path:
    sys.path.insert(0, str(_SOS_ALERT_DIR))

from detector import SafetyDetector  # noqa: E402
from config import DetectionConfig, StreamConfig  # noqa: E402

parser = argparse.ArgumentParser(description="Women Safety Surveillance (AI pipeline)")
parser.add_argument(
    "--source", default=None,
    help="Video source: file path, RTSP/HTTP URL, or webcam index. "
         "Default: http://172.23.79.168:8080/video (IP Webcam app)"
)
parser.add_argument(
    "--device", default="cpu",
    help="YOLO inference device: cpu, cuda, mps (default: cpu)"
)
parser.add_argument(
    "--backend", default=None,
    help="Backend server URL for detection POSTs and frame stream. "
         "Default from BACKEND_URL env var or http://172.23.79.101:8000"
)
parser.add_argument(
    "--camera-id", type=int, default=1,
    help="Camera ID reported in backend payloads (default: 1)"
)
parser.add_argument(
    "--no-show", action="store_true",
    help="Run headless — no OpenCV display window"
)
args = parser.parse_args()

det_cfg = DetectionConfig(DEVICE=args.device)
stream_cfg = StreamConfig(
    DEFAULT_SOURCE=args.source or "http://172.23.79.168:8080/video",
    BACKEND_URL=args.backend or os.getenv("BACKEND_URL", "http://172.23.79.101:8000"),
    CAMERA_ID=args.camera_id,
)

detector = SafetyDetector(det_cfg=det_cfg, stream_cfg=stream_cfg)
detector.run(show=not args.no_show)
