"""
server.py — FastAPI Backend for Women Safety Surveillance System
=================================================================

Endpoints:
  POST /api/v1/sos          — Mobile SOS button trigger
  POST /api/v1/dispatch     — Internal dispatch (receives CV pipeline alerts)
  GET  /api/v1/alerts       — Recent alert log
  GET  /api/v1/status       — System health + current threat state
  POST /api/v1/frame        — Submit a frame for analysis (base64 JPEG)
  WS   /ws/alerts           — Real-time alert push to mobile clients

Author: SIH Women Safety Team
"""

from __future__ import annotations

import time
import asyncio
import base64
import logging
import threading
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import DetectionConfig, AlertConfig, NightConfig, AutoSOSConfig
from alert_engine import AlertEngine, SOSPayload, AlertPayload
from detector import SafetyDetector, ThreatState

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("safety.server")

# ─── Global instances ──────────────────────────────────────────────────────
alert_engine = AlertEngine(AlertConfig())

_detector: Optional[SafetyDetector] = None
_detector_lock = threading.Lock()


def get_detector() -> SafetyDetector:
    global _detector
    if _detector is not None:
        return _detector
    with _detector_lock:
        if _detector is None:
            det = SafetyDetector(alert_cfg=AlertConfig())
            det.alert_engine = alert_engine
            _detector = det
    return _detector


# ─── Lifespan (replaces deprecated @app.on_event) ─────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    alert_engine.set_event_loop(asyncio.get_running_loop())
    yield


# ─── App Init ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Women Safety Surveillance API",
    version="1.0.0",
    description="Real-time threat detection and SOS dispatch backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ──────────────────────────────────────────────

class SOSRequest(BaseModel):
    device_id: str
    user_id: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    message: str = "SOS triggered by user"


class FrameRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded JPEG frame")
    device_id: Optional[str] = None


class DispatchRequest(BaseModel):
    """Incoming alert from the CV pipeline or external system."""
    threat_state: str
    threat_score: float
    women_count: int = 0
    nearby_men_count: int = 0
    avg_proximity_px: float = 0.0
    is_escalated: bool = False
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    device_id: Optional[str] = None


class AlertResponse(BaseModel):
    status: str
    alert_id: str
    message: str


class SOSConfirmRequest(BaseModel):
    """Mobile app confirms an SOS prompt."""
    prompt_id: str
    device_id: str
    user_id: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None


class SOSDismissRequest(BaseModel):
    """Mobile app dismisses an SOS prompt."""
    prompt_id: str
    device_id: str
    reason: str = "User indicated they are safe"


# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.post("/api/v1/sos", response_model=AlertResponse)
async def sos_trigger(req: SOSRequest):
    payload = SOSPayload(
        timestamp=time.time(),
        gps_lat=req.gps_lat,
        gps_lon=req.gps_lon,
        device_id=req.device_id,
        user_id=req.user_id,
        message=req.message,
    )
    alert_engine.dispatch_sos(payload)
    return AlertResponse(
        status="dispatched",
        alert_id=payload.alert_id,
        message="SOS alert sent to all dispatch channels",
    )


@app.post("/api/v1/sos/confirm", response_model=AlertResponse)
async def sos_confirm(req: SOSConfirmRequest):
    payload = SOSPayload(
        timestamp=time.time(),
        gps_lat=req.gps_lat,
        gps_lon=req.gps_lon,
        device_id=req.device_id,
        user_id=req.user_id,
        message=f"SOS confirmed by user (prompt_id={req.prompt_id})",
    )
    alert_engine.dispatch_sos(payload)
    logger.info(
        "SOS CONFIRMED | prompt=%s | device=%s",
        req.prompt_id, req.device_id,
    )
    return AlertResponse(
        status="dispatched",
        alert_id=payload.alert_id,
        message="SOS confirmed and dispatched",
    )


@app.post("/api/v1/sos/dismiss")
async def sos_dismiss(req: SOSDismissRequest):
    logger.info(
        "SOS DISMISSED | prompt=%s | device=%s | reason=%s",
        req.prompt_id, req.device_id, req.reason,
    )
    alert_engine.log_event({
        "type": "SOS_DISMISSED",
        "prompt_id": req.prompt_id,
        "device_id": req.device_id,
        "reason": req.reason,
        "timestamp": time.time(),
    })
    return {
        "status": "dismissed",
        "prompt_id": req.prompt_id,
        "message": "SOS prompt dismissed — no alert dispatched",
    }


@app.post("/api/v1/dispatch", response_model=AlertResponse)
async def dispatch_alert(req: DispatchRequest):
    payload = AlertPayload(
        timestamp=time.time(),
        threat_state=req.threat_state,
        threat_score=req.threat_score,
        women_count=req.women_count,
        nearby_men_count=req.nearby_men_count,
        avg_proximity_px=req.avg_proximity_px,
        is_escalated=req.is_escalated,
        frame_index=0,
        gps_lat=req.gps_lat,
        gps_lon=req.gps_lon,
        device_id=req.device_id,
    )
    sent = alert_engine.dispatch(payload)
    return AlertResponse(
        status="dispatched" if sent else "cooldown",
        alert_id=payload.alert_id,
        message="Alert dispatched" if sent else "Alert suppressed (cooldown active)",
    )


@app.post("/api/v1/frame")
async def analyze_frame(req: FrameRequest):
    try:
        b64_data = req.image_b64
        if "," in b64_data:
            b64_data = b64_data.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_data)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            raise ValueError("Could not decode image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {e}")

    detector = get_detector()
    analysis = await asyncio.to_thread(detector.process_frame, frame)

    return {
        "timestamp": analysis.timestamp,
        "is_nighttime": analysis.is_nighttime,
        "total_women": analysis.total_women,
        "total_men": analysis.total_men,
        "threat_state": analysis.threat_state.value,
        "threat_score": analysis.threat_score,
        "nearby_men_count": analysis.nearby_men_count,
        "frame_index": analysis.frame_index,
        "detections": [
            {
                "class": d.class_name,
                "confidence": d.confidence,
                "bbox": list(d.bbox),
                "center": list(d.center),
            }
            for d in analysis.detections
        ],
    }


@app.get("/api/v1/alerts")
async def get_alerts(limit: int = 20):
    return {
        "total": alert_engine.get_alert_count(),
        "alerts": alert_engine.get_recent_alerts(limit),
    }


@app.get("/api/v1/status")
async def system_status():
    is_night = SafetyDetector.is_nighttime(NightConfig())
    in_auto_sos = SafetyDetector.is_auto_sos_window(AutoSOSConfig())
    return {
        "status": "operational",
        "is_nighttime": is_night,
        "in_auto_sos_window": in_auto_sos,
        "active_ws_clients": alert_engine.get_ws_client_count(),
        "total_alerts_fired": alert_engine.get_alert_count(),
        "uptime": "healthy",
    }


# ─── WebSocket — Real-time alert push ──────────────────────────────────────

@app.websocket("/ws/alerts")
async def websocket_alerts(ws: WebSocket):
    await ws.accept()
    alert_engine.register_ws_client(ws)
    logger.info("WebSocket client connected. Total: %d", alert_engine.get_ws_client_count())
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except (WebSocketDisconnect, Exception):
        alert_engine.unregister_ws_client(ws)
        logger.info("WebSocket client disconnected.")


# ─── Run ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
