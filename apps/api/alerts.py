from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime

from .storage import ResponseStore


VALID_PRIORITIES = {"critical", "routine"}
SUPPRESSION_WINDOW = 10  # skip duplicates within N alerts


def create_alert(store: ResponseStore, alert: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    payload = {
        "type": alert.get("type") or "info",
        "message": alert.get("message") or "",
        "priority": alert.get("priority") if alert.get("priority") in VALID_PRIORITIES else "routine",
        "entity_id": alert.get("entity_id"),
        "timestamp": now,
    }
    if _recent_duplicate(store, payload):
        return payload
    store.save_alert(payload)
    return payload


def list_alerts(store: ResponseStore, priority: str | None = None) -> List[Dict[str, Any]]:
    return store.list_alerts(priority)


def summarize_alerts(store: ResponseStore) -> Dict[str, int]:
    alerts = store.list_alerts()
    summary: Dict[str, int] = {}
    for alert in alerts:
        pr = alert.get("priority") or "routine"
        summary[pr] = summary.get(pr, 0) + 1
    return summary


def digest_alerts(store: ResponseStore, limit: int = 20) -> Dict[str, Any]:
    alerts = store.list_alerts()
    alerts = sorted(alerts, key=lambda a: a.get("timestamp", ""), reverse=True)[:limit]
    digest = {
        "count": len(alerts),
        "alerts": alerts,
        "summary": summarize_alerts(store),
    }
    store.save_alert_digest(digest)
    return digest


def _recent_duplicate(store: ResponseStore, alert: Dict[str, Any]) -> bool:
    alerts = store.list_alerts()
    tail = alerts[-SUPPRESSION_WINDOW:] if len(alerts) > SUPPRESSION_WINDOW else alerts
    for a in reversed(tail):
        if (
            a.get("type") == alert.get("type")
            and a.get("message") == alert.get("message")
            and a.get("entity_id") == alert.get("entity_id")
        ):
            return True
    return False
