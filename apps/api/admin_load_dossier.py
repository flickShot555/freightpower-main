from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from .auth import require_admin
from .database import db, signed_download_url
from .settings import settings


router = APIRouter(tags=["admin-load-dossier"])


def _firestore_timeout_s(default: float = 10.0) -> float:
    try:
        return float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", default) or default)
    except Exception:
        return float(default)


def _fs_get(doc_ref):
    t = _firestore_timeout_s()
    try:
        return doc_ref.get(timeout=t)
    except TypeError:
        return doc_ref.get()


def _stream(col_ref, *, limit: Optional[int] = None, order_by: Optional[str] = None, descending: bool = True) -> List[Dict[str, Any]]:
    t = _firestore_timeout_s()
    q = col_ref
    if order_by:
        try:
            q = q.order_by(order_by, direction="DESCENDING" if descending else "ASCENDING")
        except Exception:
            q = col_ref
    if limit is not None:
        try:
            q = q.limit(int(limit))
        except Exception:
            pass

    try:
        snaps = list(q.stream(timeout=t))
    except TypeError:
        snaps = list(q.stream())
    out: List[Dict[str, Any]] = []
    for s in snaps:
        try:
            d = s.to_dict() or {}
            out.append(d)
        except Exception:
            continue
    return out


def _with_signed_urls(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for d in docs:
        row = dict(d or {})
        try:
            sp = str(row.get("storage_path") or "").strip()
            if sp:
                row["url"] = signed_download_url(
                    sp,
                    filename=(row.get("filename") or None),
                    disposition="attachment",
                    ttl_seconds=3600,
                )
        except Exception:
            pass
        out.append(row)
    return out


@router.get("/admin/loads/{load_id}/dossier")
async def get_load_dossier(load_id: str, user: Dict[str, Any] = Depends(require_admin)):
    load_id_s = str(load_id or "").strip()
    if not load_id_s:
        raise HTTPException(status_code=400, detail="load_id is required")

    snap = _fs_get(db.collection("loads").document(load_id_s))
    if not getattr(snap, "exists", False):
        raise HTTPException(status_code=404, detail="Load not found")

    load = snap.to_dict() or {}
    load.setdefault("load_id", load_id_s)

    docs = _with_signed_urls(_stream(db.collection("loads").document(load_id_s).collection("documents"), order_by="created_at", limit=500))
    workflow = _stream(db.collection("loads").document(load_id_s).collection("workflow_status_logs"), order_by="timestamp", limit=500)
    workflow.sort(key=lambda r: float(r.get("timestamp") or 0.0))

    pickup_events = _stream(db.collection("loads").document(load_id_s).collection("pickup"), order_by="timestamp", limit=200)
    pickup_events.sort(key=lambda r: float(r.get("timestamp") or 0.0))

    epod_events = _stream(db.collection("loads").document(load_id_s).collection("epod"), order_by="timestamp", limit=200)
    epod_events.sort(key=lambda r: float(r.get("timestamp") or 0.0))

    admin_snapshot = None
    try:
        s2 = _fs_get(db.collection("loads").document(load_id_s).collection("admin").document("snapshot"))
        if getattr(s2, "exists", False):
            admin_snapshot = s2.to_dict() or {}
    except Exception:
        admin_snapshot = None

    admin_events = _stream(db.collection("loads").document(load_id_s).collection("admin_events"), order_by="created_at", limit=500)
    admin_events.sort(key=lambda r: float(r.get("created_at") or 0.0))

    return {
        "load_id": load_id_s,
        "load": load,
        "documents": docs,
        "workflow_history": workflow,
        "pickup_events": pickup_events,
        "epod_events": epod_events,
        "admin_snapshot": admin_snapshot,
        "admin_events": admin_events,
    }
