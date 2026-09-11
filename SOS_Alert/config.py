"""
Configuration constants for the Women Safety Surveillance System.
All thresholds, model paths, timing windows, and alert parameters
are centralized here for easy tuning without touching pipeline logic.
"""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple

_BACKEND_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _BACKEND_DIR.parent


def _find_file(*candidates: Path) -> str:
    for cand in candidates:
        if cand.exists():
            return str(cand.resolve())
    return str(candidates[0].resolve())


@dataclass(frozen=True)
class DetectionConfig:
    """YOLOv8 model and inference parameters."""
    MODEL_PATH: str = field(default_factory=lambda: _find_file(
        _PROJECT_ROOT / "yolo11n.pt",
        _PROJECT_ROOT.parent / "yolo11n.pt",
        _PROJECT_ROOT / "Women-safety" / "yolo11n.pt",
        _PROJECT_ROOT / "Women-safety" / "ai" / "yolo11n.pt",
    ))
    CONFIDENCE_THRESHOLD: float = 0.45
    IOU_THRESHOLD: float = 0.5
    INPUT_SIZE: Tuple[int, int] = (640, 640)
    # COCO class 0 = "person". With stock yolov8n.pt we detect all persons
    # and classify gender separately. Replace with {0: "woman", 1: "man"}
    # once a fine-tuned model is trained.
    CLASS_MAP: dict = field(default_factory=lambda: {
        0: "person",
    })
    # Gender classification model (Caffe) — used when CLASS_MAP has "person"
    GENDER_PROTO: str = field(default_factory=lambda: _find_file(
        _PROJECT_ROOT / "Women-safety" / "models" / "gender_deploy.prototxt",
        _PROJECT_ROOT / "models" / "gender_deploy.prototxt",
    ))
    GENDER_MODEL: str = field(default_factory=lambda: _find_file(
        _PROJECT_ROOT / "Women-safety" / "models" / "gender_net.caffemodel",
        _PROJECT_ROOT / "models" / "gender_net.caffemodel",
    ))
    DEVICE: str = "cpu"  # "cuda", "cpu", or "mps"


@dataclass(frozen=True)
class ProximityConfig:
    """Spatial analysis thresholds (in pixels at 640×640 input resolution)."""
    # Max center-to-center distance to count a man as "nearby" a woman
    NEARBY_DISTANCE_PX: float = 180.0
    # Min number of men within proximity radius to flag HIGH_RISK
    MIN_MEN_SURROUND: int = 2
    # Bounding-box IoU overlap threshold for "physical encroachment"
    ENCROACHMENT_IOU: float = 0.05
    # Spatial density grid cell size (for heatmap generation)
    DENSITY_CELL_PX: int = 64


@dataclass(frozen=True)
class NightConfig:
    """Nighttime high-risk monitoring window."""
    # 24-hour format — window wraps midnight
    START_HOUR: int = 20   # 8:00 PM
    END_HOUR: int = 6      # 6:00 AM


@dataclass(frozen=True)
class AlertConfig:
    """Alert dispatch and cooldown parameters."""
    # Minimum seconds between repeated alerts for the same scene
    COOLDOWN_SECONDS: float = 30.0
    # Escalation: if HIGH_RISK persists for N consecutive frames, escalate
    ESCALATION_FRAME_COUNT: int = 15
    # Dispatch API endpoint (safety control room / police backend)
    # TODO: Set to actual safety control room / police backend URL
    DISPATCH_API_URL: str = "http://localhost:9000/api/v1/dispatch"
    # SOS endpoint the mobile app calls
    SOS_API_URL: str = "http://localhost:8000/api/v1/sos"
    # WebSocket path for real-time push to connected mobile clients
    WS_PATH: str = "/ws/alerts"


@dataclass(frozen=True)
class AutoSOSConfig:
    """Automatic SOS dispatch configuration for high-risk nighttime hours."""
    # Auto-SOS window (24-hour format) — wraps midnight
    AUTO_SOS_START_HOUR: int = 22   # 10:00 PM
    AUTO_SOS_END_HOUR: int = 7     # 7:00 AM
    # Minimum threat score to auto-dispatch SOS (0.0 – 1.0)
    AUTO_SOS_SCORE_THRESHOLD: float = 0.75
    # Outside auto-SOS hours, prompt the user instead (requires this many
    # consecutive HIGH_RISK frames before sending the prompt)
    PROMPT_ESCALATION_FRAMES: int = 15
    # Auto-confirm timeout for prompted SOS (seconds) — if user doesn't
    # respond within this window, SOS is dispatched anyway
    PROMPT_AUTO_CONFIRM_SECONDS: int = 30


@dataclass(frozen=True)
class StreamConfig:
    """Video stream ingestion parameters."""
    # Default RTSP / file / webcam source
    DEFAULT_SOURCE: str = "0"  # "0" = default webcam
    # Target FPS for inference (drop frames if source is faster)
    TARGET_FPS: int = 15
    # Buffer size for frame queue
    FRAME_BUFFER_SIZE: int = 32
    # Backend server URL for detection/alert POSTs and MJPEG frame push
    BACKEND_URL: str = field(default_factory=lambda: os.getenv("BACKEND_URL", "http://172.23.79.101:8000"))
    # Camera ID reported in backend payloads
    CAMERA_ID: int = 1
    # How often (in frames) to POST detection counts to the backend
    SEND_EVERY_N_FRAMES: int = 30
