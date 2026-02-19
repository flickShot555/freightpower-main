from __future__ import annotations

from typing import Any, Dict, Optional, Tuple


_ALLOWED_PAYER_ROLES = {"shipper", "broker"}


def normalize_payer_fields(load: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Return (payer_uid, payer_role) using normalized fields first.

    Falls back to legacy fields (created_by/creator_role).
    """
    payer_uid = str(load.get("payer_uid") or "").strip() or None
    payer_role = str(load.get("payer_role") or "").strip().lower() or None

    if payer_uid and payer_role in _ALLOWED_PAYER_ROLES:
        return payer_uid, payer_role

    role = str(load.get("creator_role") or "").strip().lower()
    uid = str(load.get("created_by") or "").strip() or None
    if uid and role in _ALLOWED_PAYER_ROLES:
        return uid, role

    return None, None


def normalized_ownership_patch_for_load(load: Dict[str, Any]) -> Dict[str, Any]:
    """Compute a minimal patch to backfill normalized ownership fields.

    This is intentionally best-effort and backward compatible.
    """
    patch: Dict[str, Any] = {}

    payer_uid, payer_role = normalize_payer_fields(load)
    if payer_uid and not load.get("payer_uid"):
        patch["payer_uid"] = payer_uid
    if payer_role and not load.get("payer_role"):
        patch["payer_role"] = payer_role

    # broker_id: only meaningful for broker-paid loads.
    broker_id = load.get("broker_id")
    if broker_id is None:
        if payer_role == "broker" and payer_uid:
            patch["broker_id"] = payer_uid
        else:
            patch["broker_id"] = None

    # carrier_id/carrier_uid: derive from assigned_carrier_id (legacy) if present.
    assigned = str(load.get("assigned_carrier_id") or load.get("assigned_carrier") or "").strip() or None

    if load.get("carrier_id") is None and assigned:
        patch["carrier_id"] = assigned

    carrier_id = str(load.get("carrier_id") or patch.get("carrier_id") or "").strip() or None
    if load.get("carrier_uid") is None and carrier_id:
        patch["carrier_uid"] = carrier_id

    # Ensure fields exist (nullable) so clients can rely on keys.
    if "carrier_id" not in load and "carrier_id" not in patch:
        patch["carrier_id"] = None
    if "carrier_uid" not in load and "carrier_uid" not in patch:
        patch["carrier_uid"] = None

    return patch


def normalized_fields_for_new_load(*, creator_uid: str, creator_role: str) -> Dict[str, Any]:
    """Fields that should be set at load creation time."""
    role = str(creator_role or "").strip().lower()
    uid = str(creator_uid or "").strip()

    payer_uid: Optional[str] = None
    payer_role: Optional[str] = None
    broker_id: Optional[str] = None

    if role in _ALLOWED_PAYER_ROLES and uid:
        payer_uid = uid
        payer_role = role
        broker_id = uid if role == "broker" else None

    return {
        "payer_uid": payer_uid,
        "payer_role": payer_role,
        "broker_id": broker_id,
        "carrier_id": None,
        "carrier_uid": None,
    }
