"""
alert_engine.py — Threat Alert Dispatch & Escalation Engine
============================================================

Manages:
  • Cooldown gating — prevents alert spam for the same scene
  • Escalation tracking — sustained HIGH_RISK triggers priority upgrade
  • HTTP dispatch to safety control room / police backend
  • WebSocket broadcast to connected mobile clients
  • Full audit log of every alert fired

Author: SIH Women Safety Team
"""

from __future__ import annotations

import json
import time
import uuid
import asyncio
import logging
import threading
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Callable, Dict, Any

import httpx

from config import AlertConfig

logger = logging.getLogger("safety.alert_engine")
logger.setLevel(logging.DEBUG)
_handler = logging.StreamHandler()
_handler.setFormatter(
    logging.Formatter("[%(asctime)s] %(levelname)s | %(name)s | %(message)s")
)
logger.addHandler(_handler)


# ─── Alert Payload ──────────────────────────────────────────────────────────

@dataclass
class AlertPayload:
    """Structured alert data sent to dispatch + mobile clients."""
    timestamp: float
    threat_state: str
    threat_score: float
    women_count: int
    nearby_men_count: int
    avg_proximity_px: float
    is_escalated: bool
    frame_index: int
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: str = "CV_PIPELINE"  # or "SOS_BUTTON"
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    device_id: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class SOSPayload:
    """Payload generated from the mobile SOS button."""
    timestamp: float
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: str = "SOS_BUTTON"
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    device_id: Optional[str] = None
    user_id: Optional[str] = None
    message: str = "SOS triggered by user"

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class SOSPromptPayload:
    """Prompt sent via WebSocket asking the mobile user to confirm SOS."""
    timestamp: float
    prompt_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "SOS_PROMPT"
    threat_state: str = "HIGH_RISK_SURROUNDED"
    threat_score: float = 0.0
    women_count: int = 0
    nearby_men_count: int = 0
    avg_proximity_px: float = 0.0
    auto_confirm_seconds: int = 30
    message: str = "Threat detected — confirm SOS?"

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class AutoSOSPayload:
    """Payload for auto-dispatched SOS (nighttime high-threat, no user action)."""
    timestamp: float
    alert_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: str = "AUTO_SOS"
    threat_state: str = "HIGH_RISK_SURROUNDED"
    threat_score: float = 0.0
    women_count: int = 0
    nearby_men_count: int = 0
    avg_proximity_px: float = 0.0
    frame_index: int = 0
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    message: str = "Auto-SOS: nighttime high-risk threat detected"

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


# ─── Alert Engine ───────────────────────────────────────────────────────────

class AlertEngine:
    """
    Thread-safe alert dispatcher with cooldown gating,
    escalation tracking, and async HTTP + WebSocket delivery.
    """

    def __init__(self, cfg: AlertConfig = AlertConfig()):
        self.cfg = cfg
        self._last_dispatch_time: float = 0.0
        self._lock = threading.Lock()
        self._alert_log: List[dict] = []
        self._ws_clients: List[Any] = []  # WebSocket connections (set by server)
        self._on_alert_callbacks: List[Callable[[AlertPayload], None]] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Store a reference to the main asyncio event loop for thread-safe WS sends."""
        self._loop = loop

    # ── Callback registration (for WebSocket broadcast, DB write, etc.) ─
    def on_alert(self, callback: Callable[[AlertPayload], None]):
        """Register a callback that fires on every dispatched alert."""
        self._on_alert_callbacks.append(callback)

    def register_ws_client(self, ws):
        """Register an active WebSocket connection for real-time push."""
        self._ws_clients.append(ws)

    def unregister_ws_client(self, ws):
        """Remove a disconnected WebSocket client."""
        self._ws_clients = [c for c in self._ws_clients if c is not ws]

    # ── Core dispatch logic ─────────────────────────────────────────────

    def dispatch(self, payload: AlertPayload) -> bool:
        """
        Attempt to dispatch an alert. Returns True if sent,
        False if suppressed by cooldown.
        """
        with self._lock:
            now = time.time()
            elapsed = now - self._last_dispatch_time

            if elapsed < self.cfg.COOLDOWN_SECONDS and not payload.is_escalated:
                logger.debug(
                    "Alert suppressed (cooldown: %.1fs remaining)",
                    self.cfg.COOLDOWN_SECONDS - elapsed,
                )
                return False

            self._last_dispatch_time = now
            alert_dict = payload.to_dict()
            self._alert_log.append(alert_dict)
        logger.info(
            "🚨 ALERT DISPATCHED | id=%s | state=%s | score=%.3f | escalated=%s",
            payload.alert_id, payload.threat_state,
            payload.threat_score, payload.is_escalated,
        )

        # ── Fire callbacks ──────────────────────────────────────────────
        for cb in self._on_alert_callbacks:
            try:
                cb(payload)
            except Exception as e:
                logger.error("Alert callback error: %s", e)

        # ── Async HTTP dispatch + WebSocket broadcast ───────────────────
        threading.Thread(
            target=self._send_http_alert,
            args=(alert_dict,),
            daemon=True,
        ).start()

        threading.Thread(
            target=self._broadcast_ws,
            args=(alert_dict,),
            daemon=True,
        ).start()

        return True

    def dispatch_sos(self, payload: SOSPayload) -> bool:
        """Handle SOS button alerts — always dispatched (no cooldown)."""
        alert_dict = payload.to_dict()
        with self._lock:
            self._alert_log.append(alert_dict)
        logger.critical(
            "🆘 SOS DISPATCHED | id=%s | device=%s | lat=%s lon=%s",
            payload.alert_id, payload.device_id,
            payload.gps_lat, payload.gps_lon,
        )

        threading.Thread(
            target=self._send_http_alert,
            args=(alert_dict,),
            daemon=True,
        ).start()

        threading.Thread(
            target=self._broadcast_ws,
            args=(alert_dict,),
            daemon=True,
        ).start()

        return True

    def dispatch_sos_prompt(self, payload: SOSPromptPayload) -> bool:
        """
        Send an SOS confirmation prompt to mobile clients via WebSocket.
        Does NOT dispatch an actual SOS — waits for user confirmation.
        """
        prompt_dict = payload.to_dict()
        with self._lock:
            self._alert_log.append(prompt_dict)
        logger.warning(
            "📲 SOS PROMPT SENT | prompt_id=%s | score=%.3f | men=%d | "
            "auto_confirm=%ds",
            payload.prompt_id, payload.threat_score,
            payload.nearby_men_count, payload.auto_confirm_seconds,
        )

        # Only broadcast via WebSocket (not HTTP — this is a prompt, not an alert)
        threading.Thread(
            target=self._broadcast_ws,
            args=(prompt_dict,),
            daemon=True,
        ).start()

        return True

    def dispatch_auto_sos(self, payload: AutoSOSPayload) -> bool:
        """
        Auto-dispatch SOS during nighttime high-risk hours.
        No user confirmation required — dispatches immediately.
        """
        alert_dict = payload.to_dict()
        with self._lock:
            self._alert_log.append(alert_dict)
        logger.critical(
            "🚨 AUTO-SOS DISPATCHED | id=%s | score=%.3f | men=%d | "
            "source=%s",
            payload.alert_id, payload.threat_score,
            payload.nearby_men_count, payload.source,
        )

        threading.Thread(
            target=self._send_http_alert,
            args=(alert_dict,),
            daemon=True,
        ).start()

        threading.Thread(
            target=self._broadcast_ws,
            args=(alert_dict,),
            daemon=True,
        ).start()

        return True

    # ── HTTP POST to dispatch backend ───────────────────────────────────

    def _send_http_alert(self, alert_dict: dict):
        """Fire-and-forget POST to the safety dispatch API."""
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    self.cfg.DISPATCH_API_URL,
                    json=alert_dict,
                    headers={"Content-Type": "application/json"},
                )
                logger.info(
                    "Dispatch API response: %d %s",
                    resp.status_code, resp.text[:200],
                )
        except httpx.ConnectError:
            logger.warning("Dispatch API unreachable at %s", self.cfg.DISPATCH_API_URL)
        except Exception as e:
            logger.error("HTTP dispatch failed: %s", e)

    # ── WebSocket broadcast ─────────────────────────────────────────────

    def _broadcast_ws(self, alert_dict: dict):
        """Push alert to all connected WebSocket clients."""
        message = json.dumps(alert_dict)
        dead_clients = []
        loop = self._loop
        for ws in self._ws_clients:
            try:
                if loop is not None and loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        ws.send_text(message), loop
                    ).result(timeout=5.0)
                else:
                    asyncio.run(ws.send_text(message))
            except Exception:
                dead_clients.append(ws)
        for dc in dead_clients:
            self.unregister_ws_client(dc)

    # ── Logging ─────────────────────────────────────────────────────────

    def log_event(self, event: dict):
        """Append an arbitrary event dict to the audit log (thread-safe)."""
        with self._lock:
            self._alert_log.append(event)

    def get_ws_client_count(self) -> int:
        return len(self._ws_clients)

    # ── Query ───────────────────────────────────────────────────────────

    def get_recent_alerts(self, n: int = 20) -> List[dict]:
        """Return the last N alerts from the in-memory log."""
        return self._alert_log[-n:]

    def get_alert_count(self) -> int:
        return len(self._alert_log)
