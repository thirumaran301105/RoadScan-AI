"""
Alert Manager
---------------
Turns a detection into an actual driver-facing warning - the "insist the
driver" part of the system. Two things this deliberately handles:

1. Cooldown per pothole: without this, driving slowly past (or being stuck
   in traffic near) the same pothole would fire dozens of alerts in a row.
   Each known pothole can only re-alert after a cooldown window.
2. Severity-based urgency: a severe pothole gets a more insistent alert
   (visual + audio, repeated) than a minor crack.

Alerts are pushed onto an in-memory queue that the WebSocket endpoint
drains and broadcasts to connected clients (the driver's screen).
"""
import time
import queue
from typing import Optional

import config

ALERT_MESSAGES = {
    "severe": "SEVERE POTHOLE AHEAD - SLOW DOWN",
    "moderate": "Pothole ahead - reduce speed",
    "minor": "Minor road damage ahead",
}


class AlertManager:
    def __init__(self):
        self._last_alert_time: dict = {}  # pothole_id -> timestamp
        self._alert_queue: "queue.Queue[dict]" = queue.Queue()

    def maybe_alert(self, pothole_id: str, severity: str, latitude: float,
                     longitude: float, confidence: float) -> Optional[dict]:
        now = time.time()
        last = self._last_alert_time.get(pothole_id, 0)
        if now - last < config.ALERT_COOLDOWN_SECONDS:
            return None  # still in cooldown for this specific pothole

        self._last_alert_time[pothole_id] = now
        alert = {
            "type": "pothole_alert",
            "pothole_id": pothole_id,
            "severity": severity,
            "message": ALERT_MESSAGES.get(severity, "Road damage ahead"),
            "latitude": latitude,
            "longitude": longitude,
            "confidence": round(confidence, 2),
            "timestamp": now,
            "urgent": severity == "severe",
        }
        self._alert_queue.put(alert)
        return alert

    def get_pending_alerts(self, max_items: int = 20) -> list:
        alerts = []
        while not self._alert_queue.empty() and len(alerts) < max_items:
            alerts.append(self._alert_queue.get_nowait())
        return alerts
