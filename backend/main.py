from __future__ import annotations

import sys
import time
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from database import SessionLocal, Base, engine
from models import (Location, Camera, DetectionEvent, Alert, AlertType, Hotspot)
from safety_engine import analyze_detection
from hotspot_engine import calculate_risk_score, get_risk_level
from alert_engine import AlertEngine, SOSPayload, AlertPayload
from config import AlertConfig, NightConfig, AutoSOSConfig

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("safety.main")

# ─── DB Setup ───────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ─── Alert Engine ───────────────────────────────────────────────────────────
alert_engine = AlertEngine(AlertConfig())

# ─── Frame Buffer (for MJPEG stream) ────────────────────────────────────────
latest_frame: Optional[bytes] = None
frame_lock = threading.Lock()


# ─── DB Seeding ─────────────────────────────────────────────────────────────
def _seed_alert_types(db: Session):
    """Ensure base alert types exist so /detections can resolve them by name."""
    defaults = [
        {"name": "LONE_WOMAN",  "description": "Woman detected alone at night",       "severity": "HIGH"},
        {"name": "SURROUNDED",  "description": "Woman surrounded by men at night",     "severity": "HIGH"},
        {"name": "SOS",         "description": "SOS gesture or button activated",      "severity": "CRITICAL"},
    ]
    for d in defaults:
        if not db.query(AlertType).filter_by(name=d["name"]).first():
            db.add(AlertType(**d))
    db.commit()


# ─── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    alert_engine.set_event_loop(asyncio.get_running_loop())
    db = SessionLocal()
    try:
        _seed_alert_types(db)
    finally:
        db.close()
    yield


# ─── App ────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Women Safety Analytics API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── DB Dependency ──────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Pydantic Models ────────────────────────────────────────────────────────
class SOSRequest(BaseModel):
    device_id: str
    user_id: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    message: str = "SOS triggered by user"


class SOSConfirmRequest(BaseModel):
    prompt_id: str
    device_id: str
    user_id: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None


class SOSDismissRequest(BaseModel):
    prompt_id: str
    device_id: str
    reason: str = "User indicated they are safe"


class DispatchRequest(BaseModel):
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


# ─── Basic ──────────────────────────────────────────────────────────────────
@app.get("/")
def home():
    return {"message": "Women Safety Analytics API is running!"}


# ─── Locations ──────────────────────────────────────────────────────────────
@app.post("/locations")
def create_location(
    name: str,
    latitude: float,
    longitude: float,
    db: Session = Depends(get_db)
):
    location = Location(name=name, latitude=latitude, longitude=longitude)
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@app.get("/locations")
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).all()


# ─── Cameras ────────────────────────────────────────────────────────────────
@app.post("/cameras")
def create_camera(
    location_id: int,
    camera_name: str,
    camera_source: str,
    db: Session = Depends(get_db)
):
    camera = Camera(
        location_id=location_id,
        camera_name=camera_name,
        camera_source=camera_source
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@app.get("/cameras")
def get_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).all()


# ─── Detections ─────────────────────────────────────────────────────────────
@app.get("/detections/summary")
def get_detection_summary(db: Session = Depends(get_db)):
    """
    Returns aggregated gender counts from the most recent detection event
    plus totals across all events today. Used by dashboard and mobile app.
    """
    from sqlalchemy import func as sqlfunc

    # Latest single event (for "right now" display)
    latest = (
        db.query(DetectionEvent)
        .order_by(DetectionEvent.timestamp.desc())
        .first()
    )

    # Today's totals
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today = db.query(
        sqlfunc.sum(DetectionEvent.total_people).label("total_people"),
        sqlfunc.sum(DetectionEvent.male_count).label("male_count"),
        sqlfunc.sum(DetectionEvent.female_count).label("female_count"),
        sqlfunc.count(DetectionEvent.id).label("event_count"),
    ).filter(DetectionEvent.timestamp >= today_start).one()

    return {
        "latest": {
            "total_people": latest.total_people if latest else 0,
            "male_count": latest.male_count if latest else 0,
            "female_count": latest.female_count if latest else 0,
            "timestamp": latest.timestamp.isoformat() if latest else None,
        },
        "today": {
            "total_people": int(today.total_people or 0),
            "male_count": int(today.male_count or 0),
            "female_count": int(today.female_count or 0),
            "event_count": int(today.event_count or 0),
        },
    }


@app.post("/detections")
def create_detection(
    camera_id: int,
    total_people: int,
    male_count: int,
    female_count: int,
    db: Session = Depends(get_db)
):
    detection = DetectionEvent(
        camera_id=camera_id,
        total_people=total_people,
        male_count=male_count,
        female_count=female_count
    )
    db.add(detection)
    db.commit()
    db.refresh(detection)

    detected_alerts = analyze_detection(total_people, male_count, female_count)
    created_alerts = []

    for alert_data in detected_alerts:
        alert_type = (
            db.query(AlertType)
            .filter(AlertType.name == alert_data["type"])
            .first()
        )
        if alert_type:
            alert = Alert(
                camera_id=camera_id,
                alert_type_id=alert_type.id,
                severity=alert_data["severity"],
                confidence=alert_data["confidence"],
                status="ACTIVE",
                description=alert_data["description"]
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            created_alerts.append(alert)

            alert_engine.log_event({
                "type": "CV_ALERT",
                "severity": alert_data["severity"],
                "description": alert_data["description"],
                "timestamp": time.time()
            })

    return {"detection": detection, "alerts_generated": created_alerts}


# ─── Alerts ─────────────────────────────────────────────────────────────────
@app.post("/alerts")
def create_alert(
    camera_id: int,
    alert_type_id: int,
    severity: str,
    confidence: float,
    description: str,
    db: Session = Depends(get_db)
):
    alert = Alert(
        camera_id=camera_id,
        alert_type_id=alert_type_id,
        severity=severity,
        confidence=confidence,
        description=description
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@app.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).all()


# ─── MJPEG Stream ────────────────────────────────────────────────────────────
@app.post("/frame")
async def receive_frame(request: Request):
    """Receives annotated frame from AI pipeline and stores it."""
    global latest_frame
    body = await request.body()
    with frame_lock:
        latest_frame = body
    return {"status": "ok"}


async def mjpeg_generator():
    """Generates continuous MJPEG stream from latest frame."""
    while True:
        with frame_lock:
            frame = latest_frame
        if frame:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            )
        await asyncio.sleep(0.033)  # ~30 FPS cap


@app.get("/stream")
async def video_stream():
    """MJPEG stream endpoint — open this URL in browser or img tag."""
    return StreamingResponse(
        mjpeg_generator(),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )

EMPTY_JPEG = b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\x27 ",#\x1c\x1c(7),01444\x1f\x279=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9'

@app.get("/snapshot")
async def snapshot():
    """Returns latest frame as single JPEG — for React Native polling."""
    from fastapi.responses import Response
    with frame_lock:
        frame = latest_frame
    if frame is None:
        return Response(content=EMPTY_JPEG, media_type="image/jpeg")
    return Response(content=frame, media_type="image/jpeg")

# ─── SOS ────────────────────────────────────────────────────────────────────
@app.post("/api/v1/sos", response_model=AlertResponse)
async def sos_trigger(req: SOSRequest, db: Session = Depends(get_db)):
    alert = Alert(
        camera_id=None,
        alert_type_id=None,
        severity="CRITICAL",
        confidence=1.0,
        status="ACTIVE",
        description=f"SOS triggered by {req.user_id or req.device_id} at ({req.gps_lat}, {req.gps_lon})"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

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
        message="SOS alert saved and dispatched"
    )


@app.post("/api/v1/sos/confirm", response_model=AlertResponse)
async def sos_confirm(req: SOSConfirmRequest, db: Session = Depends(get_db)):
    alert = Alert(
        camera_id=None,
        alert_type_id=None,
        severity="CRITICAL",
        confidence=1.0,
        status="ACTIVE",
        description=f"SOS confirmed by {req.user_id or req.device_id} (prompt={req.prompt_id})"
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    payload = SOSPayload(
        timestamp=time.time(),
        gps_lat=req.gps_lat,
        gps_lon=req.gps_lon,
        device_id=req.device_id,
        user_id=req.user_id,
        message=f"SOS confirmed (prompt_id={req.prompt_id})",
    )
    alert_engine.dispatch_sos(payload)

    return AlertResponse(
        status="dispatched",
        alert_id=payload.alert_id,
        message="SOS confirmed and dispatched"
    )


@app.post("/api/v1/sos/dismiss")
async def sos_dismiss(req: SOSDismissRequest):
    alert_engine.log_event({
        "type": "SOS_DISMISSED",
        "prompt_id": req.prompt_id,
        "device_id": req.device_id,
        "reason": req.reason,
        "timestamp": time.time(),
    })
    return {"status": "dismissed", "prompt_id": req.prompt_id}


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
        message="Alert dispatched" if sent else "Suppressed (cooldown active)"
    )


@app.get("/api/v1/alerts")
async def get_sos_alerts(limit: int = 20):
    return {
        "total": alert_engine.get_alert_count(),
        "alerts": alert_engine.get_recent_alerts(limit)
    }


@app.get("/api/v1/status")
async def system_status():
    return {
        "status": "operational",
        "active_ws_clients": alert_engine.get_ws_client_count(),
        "total_alerts_fired": alert_engine.get_alert_count(),
    }


# ─── WebSocket ───────────────────────────────────────────────────────────────
@app.websocket("/ws/alerts")
async def websocket_alerts(ws: WebSocket):
    await ws.accept()
    alert_engine.register_ws_client(ws)
    logger.info("WS client connected. Total: %d", alert_engine.get_ws_client_count())
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except (WebSocketDisconnect, Exception):
        alert_engine.unregister_ws_client(ws)
        logger.info("WS client disconnected.")


# ─── Hotspots ────────────────────────────────────────────────────────────────
@app.get("/hotspots")
def get_hotspots(db: Session = Depends(get_db)):
    locations = db.query(Location).all()
    results = []
    for location in locations:
        alerts = (
            db.query(Alert)
            .join(Camera, Alert.camera_id == Camera.id)
            .filter(Camera.location_id == location.id)
            .all()
        )
        alert_count = len(alerts)
        risk_score = calculate_risk_score(alerts)
        risk_level = get_risk_level(risk_score)

        # Upsert Hotspot row so DB stays current
        hotspot = db.query(Hotspot).filter_by(location_id=location.id).first()
        if hotspot:
            hotspot.alert_count = alert_count
            hotspot.risk_score = risk_score
            hotspot.risk_level = risk_level
            hotspot.last_calculated = datetime.utcnow()
        else:
            hotspot = Hotspot(
                location_id=location.id,
                alert_count=alert_count,
                risk_score=risk_score,
                risk_level=risk_level,
            )
            db.add(hotspot)
        db.commit()

        results.append({
            "location_id": location.id,
            "location": location.name,
            "alert_count": alert_count,
            "risk_score": float(risk_score),
            "risk_level": risk_level,
            "latitude": float(location.latitude) if location.latitude is not None else None,
            "longitude": float(location.longitude) if location.longitude is not None else None,
        })
    return results


if __name__ == "__main__":
    import os
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"Starting server on http://{host if host != '0.0.0.0' else '172.23.79.101'}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)