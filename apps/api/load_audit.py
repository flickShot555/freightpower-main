from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional

from .database import db
from .settings import settings


def _now() -> float:
    return float(time.time())


def _firestore_timeout_s(default: float = 8.0) -> float:
    try:
        return float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", default) or default)
    except Exception:
        return float(default)


def _fs_set(doc_ref, data: Dict[str, Any], *, merge: bool = False) -> None:
    t = _firestore_timeout_s()
    try:
        doc_ref.set(data, merge=merge, timeout=t)
        return
    except TypeError:
        doc_ref.set(data, merge=merge)
        return


def _fs_get(doc_ref):
    t = _firestore_timeout_s()
    try:
        return doc_ref.get(timeout=t)
    except TypeError:
        return doc_ref.get()


def snapshot_user(uid: str) -> Optional[Dict[str, Any]]:
    uid_s = str(uid or "").strip()
    if not uid_s:
        return None
    try:
        snap = _fs_get(db.collection("users").document(uid_s))
        if not getattr(snap, "exists", False):
            return {"uid": uid_s}
        d = snap.to_dict() or {}
        out = {
            "uid": uid_s,
            "role": d.get("role"),
            "email": d.get("email"),
            "name": d.get("name") or d.get("full_name") or d.get("display_name"),
            "company_name": d.get("company_name"),
            "phone": d.get("phone") or d.get("phone_number"),
            "updated_at": d.get("updated_at"),
        }
        # Drop empty keys for compactness.
        return {k: v for k, v in out.items() if v not in (None, "")}
    except Exception:
        return {"uid": uid_s}


def upsert_load_admin_snapshot(load_id: str, patch: Dict[str, Any]) -> None:
    """Write admin-only snapshot data for a load.

    Stored in subcollection so it is never returned by normal load fetches.

    Path: loads/{load_id}/admin/snapshot
    """

    load_id_s = str(load_id or "").strip()
    if not load_id_s:
        return
    try:
        base = dict(patch or {})
        base["updated_at"] = _now()
        ref = db.collection("loads").document(load_id_s).collection("admin").document("snapshot")
        _fs_set(ref, base, merge=True)
    except Exception:
        return


def record_load_admin_event(
    *,
    load_id: str,
    event_type: str,
    actor: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Append an admin-only event record for audit/debugging.

    Path: loads/{load_id}/admin_events/{event_id}
    """

    load_id_s = str(load_id or "").strip()
    if not load_id_s:
        return None

    try:
        now = _now()
        actor = actor or {}
        event_id = str(uuid.uuid4())
        payload: Dict[str, Any] = {
            "event_id": event_id,
            "load_id": load_id_s,
            "event_type": str(event_type or "").strip() or "event",
            "created_at": now,
            "actor_uid": actor.get("uid"),
            "actor_role": actor.get("role"),
            "actor_email": actor.get("email"),
            "actor_name": actor.get("display_name") or actor.get("name"),
            "data": dict(data or {}),
        }
        ref = db.collection("loads").document(load_id_s).collection("admin_events").document(event_id)
        _fs_set(ref, payload, merge=False)
        return event_id
    except Exception:
        return None
