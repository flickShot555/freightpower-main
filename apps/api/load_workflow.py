from __future__ import annotations

import time
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import get_current_user
from .database import bucket, db, log_action
from .load_documents import (
    create_load_document_from_url,
    ensure_rate_confirmation_document,
    stamp_rate_confirmation_signatures_pdf_bytes,
    upload_load_document_bytes,
)
from .load_workflow_utils import (
    decode_data_url_base64,
    haversine_distance_meters,
    is_rate_con_carrier_signed,
    is_rate_con_shipper_signed,
    set_contract_bol_signature,
    notify_previous_carriers_new_load,
    now_ts,
    parse_datetime_best_effort,
    sanitize_load_for_viewer,
    set_contract_rate_con_signature,
)
from .settings import settings

from .load_audit import record_load_admin_event, snapshot_user, upsert_load_admin_snapshot


router = APIRouter(tags=["load-workflow"])


def _firestore_timeout_s() -> float:
    """Best-effort Firestore call timeout.

    Without explicit timeouts, Firestore client calls can hang long enough for
    the frontend to abort. We default to a conservative value and allow
    overriding via Settings/env.
    """
    try:
        return float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 15) or 15)
    except Exception:
        return 15.0


def _fs_get(doc_ref):
    t = _firestore_timeout_s()
    try:
        return doc_ref.get(timeout=t)
    except TypeError:
        return doc_ref.get()


def _fs_set(doc_ref, data: Dict[str, Any], *, merge: bool = False) -> None:
    t = _firestore_timeout_s()
    try:
        doc_ref.set(data, merge=merge, timeout=t)
        return
    except TypeError:
        doc_ref.set(data, merge=merge)
        return


# Workflow status ordering (monotonic). We allow skipping forward, but disallow moving backwards.
_WORKFLOW_ORDER = [
    "Posted",
    "Tendered",
    "Awarded",
    "Dispatched",
    "Assigned to Driver",
    "At Pickup",
    "Picked Up",
    "In Transit",
    "Arrived at Delivery",
    "Delivered",
    "POD Submitted",
    "Invoiced",
    "Payment Settled",
]


def _workflow_index(status: Optional[str]) -> Optional[int]:
    if not status:
        return None
    s = str(status).strip()
    if not s:
        return None
    try:
        return _WORKFLOW_ORDER.index(s)
    except ValueError:
        return None


def _log_workflow_status(load_id: str, *, old_status: Optional[str], new_status: str, actor: Dict[str, Any], notes: str, ts: float) -> None:
    """Best-effort append-only log for shipment tracking UI."""
    try:
        entry = {
            "timestamp": ts,
            "actor_uid": actor.get("uid"),
            "actor_role": actor.get("role"),
            "old_workflow_status": old_status,
            "new_workflow_status": str(new_status),
            "notes": notes,
        }
        _fs_set(db.collection("loads").document(str(load_id)).collection("workflow_status_logs").document(), entry)
    except Exception:
        pass


class PrivateDetailsUpdate(BaseModel):
    pickup_exact_address: Optional[str] = None
    delivery_exact_address: Optional[str] = None

    receiver_company_name: Optional[str] = None
    receiver_exact_address: Optional[str] = None
    receiver_contact_name: Optional[str] = None
    receiver_contact_phone: Optional[str] = None
    receiver_contact_email: Optional[str] = None
    receiver_handling_instructions: Optional[str] = None

    reference_numbers: Optional[Dict[str, str]] = None
    special_instructions: Optional[str] = None

    # Optional coordinates for delivery validation
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None

    # Optional coordinates for pickup validation
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None


class RateConSignRequest(BaseModel):
    signer_name: Optional[str] = None
    signature_data_url: Optional[str] = None


def _stamp_rate_confirmation_pdf(
    *,
    load_id: str,
    storage_path: str,
    shipper_signature_png: Optional[bytes] = None,
    carrier_signature_png: Optional[bytes] = None,
    shipper_name: Optional[str] = None,
    carrier_name: Optional[str] = None,
    shipper_signed_at: Optional[float] = None,
    carrier_signed_at: Optional[float] = None,
) -> None:
    sp = str(storage_path or "").strip()
    if not sp:
        raise HTTPException(status_code=400, detail="Rate Confirmation storage path not found")
    try:
        blob = bucket.blob(sp)
        current = blob.download_as_bytes()
        stamped = stamp_rate_confirmation_signatures_pdf_bytes(
            pdf_bytes=current,
            shipper_signature_png=shipper_signature_png,
            carrier_signature_png=carrier_signature_png,
            shipper_name=shipper_name,
            carrier_name=carrier_name,
            shipper_signed_at=shipper_signed_at,
            carrier_signed_at=carrier_signed_at,
        )
        blob.upload_from_string(stamped, content_type="application/pdf")
        try:
            db.collection("loads").document(str(load_id)).set({"updated_at": now_ts()}, merge=True)
        except Exception:
            pass
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stamp rate confirmation PDF: {e}")


class DeliveryCompleteRequest(BaseModel):
    latitude: float = Field(..., description="Driver current latitude")
    longitude: float = Field(..., description="Driver current longitude")

    receiver_name: str = Field(..., min_length=1, max_length=120)
    receiver_signature_data_url: str = Field(..., min_length=20, description="data:image/png;base64,...")

    remarks: Optional[str] = None
    delivered_at: Optional[float] = None


class PickupCompleteRequest(BaseModel):
    latitude: float = Field(..., description="Driver current latitude")
    longitude: float = Field(..., description="Driver current longitude")

    shipper_name: str = Field(..., min_length=1, max_length=120)
    shipper_signature_data_url: str = Field(..., min_length=20, description="data:image/png;base64,...")

    bol_photo_url: Optional[str] = None
    remarks: Optional[str] = None
    picked_up_at: Optional[float] = None


class InvoiceCreateRequest(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    notes: Optional[str] = None


def _get_load(load_id: str) -> Optional[Dict[str, Any]]:
    try:
        snap = _fs_get(db.collection("loads").document(str(load_id)))
        if getattr(snap, "exists", False):
            d = snap.to_dict() or {}
            d.setdefault("load_id", str(load_id))
            return d
    except Exception:
        return None
    return None


def _require_role(user: Dict[str, Any], roles: set[str]) -> None:
    r = str(user.get("role") or "").strip().lower()
    if r not in roles:
        raise HTTPException(status_code=403, detail="Not authorized")


def _require_shipper_owner(load: Dict[str, Any], user: Dict[str, Any]) -> None:
    uid = str(user.get("uid") or "").strip()
    role = str(user.get("role") or "").strip().lower()
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only shipper/broker can perform this action")
    if role in {"admin", "super_admin"}:
        return
    if str(load.get("created_by") or "").strip() != uid:
        raise HTTPException(status_code=403, detail="You can only modify loads you created")


def _require_assigned_carrier(load: Dict[str, Any], user: Dict[str, Any]) -> None:
    uid = str(user.get("uid") or "").strip()
    role = str(user.get("role") or "").strip().lower()
    if role not in {"carrier", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only carrier can perform this action")
    if role in {"admin", "super_admin"}:
        return
    assigned = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or load.get("carrier_id") or "").strip()
    if not assigned or assigned != uid:
        raise HTTPException(status_code=403, detail="Load is not assigned to your carrier")


def _set_workflow_status(load_id: str, *, new_status: str, actor: Dict[str, Any], notes: str) -> None:
    ts = now_ts()

    # Read current status for validation/logging.
    old_ws: Optional[str] = None
    try:
        snap = _fs_get(db.collection("loads").document(str(load_id)))
        if getattr(snap, "exists", False):
            old_ws = str((snap.to_dict() or {}).get("workflow_status") or "").strip() or None
    except Exception:
        old_ws = None

    # Disallow moving backwards in the workflow (best-effort).
    try:
        old_i = _workflow_index(old_ws)
        new_i = _workflow_index(new_status)
        if old_i is not None and new_i is not None and new_i < old_i:
            raise HTTPException(status_code=400, detail=f"Invalid workflow transition from '{old_ws}' to '{new_status}'")
    except HTTPException:
        raise
    except Exception:
        # If we cannot validate ordering, do not block the workflow.
        pass

    patch = {
        "workflow_status": str(new_status),
        "workflow_status_updated_at": ts,
        "updated_at": ts,
    }

    try:
        _fs_set(db.collection("loads").document(str(load_id)), patch, merge=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update workflow_status: {e}")

    _log_workflow_status(load_id, old_status=old_ws, new_status=str(new_status), actor=actor, notes=notes, ts=ts)


@router.get("/loads/{load_id}/workflow/history")
async def get_workflow_history(load_id: str, limit: int = 50, user: Dict[str, Any] = Depends(get_current_user)):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Reuse viewer access logic: if you can view the load, you can view its history.
    redacted = sanitize_load_for_viewer(load, viewer_uid=str(user.get("uid")), viewer_role=str(user.get("role")))
    if not redacted:
        raise HTTPException(status_code=403, detail="Not authorized")

    rows = []
    try:
        snaps = list(
            db.collection("loads")
            .document(str(load_id))
            .collection("workflow_status_logs")
            .order_by("timestamp", direction="DESCENDING")
            .limit(int(limit))
            .stream()
        )
        for s in snaps:
            d = s.to_dict() or {}
            rows.append(d)
    except Exception:
        rows = []

    # Return oldest->newest for UI timeline.
    rows.sort(key=lambda r: float(r.get("timestamp") or 0.0))
    return {"load_id": load_id, "workflow_status": load.get("workflow_status"), "events": rows}


class ArriveEventRequest(BaseModel):
    latitude: float = Field(..., description="Driver current latitude")
    longitude: float = Field(..., description="Driver current longitude")
    arrived_at: Optional[float] = None


@router.post("/loads/{load_id}/pickup/arrive")
async def driver_arrive_pickup(
    load_id: str,
    req: ArriveEventRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    role = str(user.get("role") or "").strip().lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can mark arrival")

    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    if str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip() != str(user.get("uid") or "").strip():
        raise HTTPException(status_code=403, detail="Load is not assigned to you")

    # Basic guard: arrival at pickup must occur before in_transit.
    s = str(load.get("status") or "").strip().lower()
    if s in {"in_transit", "delivered", "completed"}:
        raise HTTPException(status_code=400, detail=f"Cannot mark pickup arrival while status is '{s}'")

    private_details = load.get("private_details") if isinstance(load.get("private_details"), dict) else {}
    pickup_lat = private_details.get("pickup_lat")
    pickup_lng = private_details.get("pickup_lng")
    if pickup_lat is not None and pickup_lng is not None:
        dist = haversine_distance_meters(req.latitude, req.longitude, float(pickup_lat), float(pickup_lng))
        if dist > 10.0:
            raise HTTPException(status_code=400, detail=f"GPS check failed: {dist:.1f}m from pickup location")

    ts = float(req.arrived_at) if req.arrived_at is not None else now_ts()
    try:
        db.collection("loads").document(str(load_id)).set({"at_pickup_at": ts, "updated_at": now_ts()}, merge=True)
    except Exception:
        pass

    _set_workflow_status(load_id, new_status="At Pickup", actor=user, notes="Driver arrived at pickup")
    log_action(str(user.get("uid")), "DRIVER_ARRIVE_PICKUP", f"Load {load_id}: arrived at pickup")
    return {"success": True, "load_id": load_id, "workflow_status": "At Pickup"}


@router.post("/loads/{load_id}/delivery/arrive")
async def driver_arrive_delivery(
    load_id: str,
    req: ArriveEventRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    role = str(user.get("role") or "").strip().lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can mark arrival")

    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    if str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip() != str(user.get("uid") or "").strip():
        raise HTTPException(status_code=403, detail="Load is not assigned to you")

    s = str(load.get("status") or "").strip().lower()
    if s not in {"in_transit"}:
        raise HTTPException(status_code=400, detail=f"Cannot mark delivery arrival while status is '{s}'")

    private_details = load.get("private_details") if isinstance(load.get("private_details"), dict) else {}
    delivery_lat = private_details.get("delivery_lat")
    delivery_lng = private_details.get("delivery_lng")
    if delivery_lat is not None and delivery_lng is not None:
        dist = haversine_distance_meters(req.latitude, req.longitude, float(delivery_lat), float(delivery_lng))
        if dist > 10.0:
            raise HTTPException(status_code=400, detail=f"GPS check failed: {dist:.1f}m from delivery location")

    ts = float(req.arrived_at) if req.arrived_at is not None else now_ts()
    try:
        db.collection("loads").document(str(load_id)).set({"arrived_delivery_at": ts, "updated_at": now_ts()}, merge=True)
    except Exception:
        pass

    _set_workflow_status(load_id, new_status="Arrived at Delivery", actor=user, notes="Driver arrived at delivery")
    log_action(str(user.get("uid")), "DRIVER_ARRIVE_DELIVERY", f"Load {load_id}: arrived at delivery")
    return {"success": True, "load_id": load_id, "workflow_status": "Arrived at Delivery"}


@router.patch("/loads/{load_id}/private-details")
async def update_load_private_details(
    load_id: str,
    payload: PrivateDetailsUpdate,
    user: Dict[str, Any] = Depends(get_current_user),
):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    _require_shipper_owner(load, user)

    ts = now_ts()
    private_details = dict(load.get("private_details") or {}) if isinstance(load.get("private_details"), dict) else {}

    if payload.pickup_exact_address is not None:
        private_details["pickup_exact_address"] = payload.pickup_exact_address
    if payload.delivery_exact_address is not None:
        private_details["delivery_exact_address"] = payload.delivery_exact_address

    receiver = dict(private_details.get("receiver") or {}) if isinstance(private_details.get("receiver"), dict) else {}
    if payload.receiver_company_name is not None:
        receiver["company_name"] = payload.receiver_company_name
    if payload.receiver_exact_address is not None:
        receiver["exact_address"] = payload.receiver_exact_address
    if payload.receiver_contact_name is not None:
        receiver["contact_name"] = payload.receiver_contact_name
    if payload.receiver_contact_phone is not None:
        receiver["contact_phone"] = payload.receiver_contact_phone
    if payload.receiver_contact_email is not None:
        receiver["contact_email"] = payload.receiver_contact_email
    if payload.receiver_handling_instructions is not None:
        receiver["handling_instructions"] = payload.receiver_handling_instructions

    if receiver:
        private_details["receiver"] = receiver

    if payload.reference_numbers is not None:
        private_details["reference_numbers"] = payload.reference_numbers
    if payload.special_instructions is not None:
        private_details["special_instructions"] = payload.special_instructions

    if payload.delivery_lat is not None:
        private_details["delivery_lat"] = float(payload.delivery_lat)
    if payload.delivery_lng is not None:
        private_details["delivery_lng"] = float(payload.delivery_lng)

    if payload.pickup_lat is not None:
        private_details["pickup_lat"] = float(payload.pickup_lat)
    if payload.pickup_lng is not None:
        private_details["pickup_lng"] = float(payload.pickup_lng)

    patch = {
        "private_details": private_details,
        "updated_at": ts,
    }

    try:
        db.collection("loads").document(str(load_id)).set(patch, merge=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update private details: {e}")

    log_action(str(user.get("uid")), "LOAD_PRIVATE_DETAILS_UPDATE", f"Updated private details for load {load_id}")

    return {"success": True, "load_id": load_id, "private_details": private_details}


@router.post("/loads/{load_id}/pickup/complete")
async def driver_complete_pickup(
    load_id: str,
    req: PickupCompleteRequest,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user),
):
    role = str(user.get("role") or "").strip().lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can complete pickup")

    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Idempotency: if pickup already recorded, return success.
    try:
        if str(load.get("status") or "").strip().lower() in {"in_transit", "delivered", "completed"} and load.get("picked_up_at"):
            return {
                "success": True,
                "load_id": load_id,
                "pickup_event_id": None,
                "workflow_status": str(load.get("workflow_status") or "In Transit"),
                "message": "Pickup already completed",
            }
    except Exception:
        pass

    # Must be assigned to this driver.
    if str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip() != str(user.get("uid") or "").strip():
        raise HTTPException(status_code=403, detail="Load is not assigned to you")

    # Minimal state-machine guard: if this load uses contract workflow, require carrier signature before pickup.
    try:
        contract = load.get("contract")
        if isinstance(contract, dict) and isinstance(contract.get("rate_confirmation"), dict):
            if not is_rate_con_carrier_signed(load):
                raise HTTPException(status_code=400, detail="Carrier must sign rate confirmation before pickup")
    except HTTPException:
        raise
    except Exception:
        pass

    # If workflow_status is present, enforce the expected transition into In Transit.
    try:
        ws = str(load.get("workflow_status") or "").strip()
        if ws:
            # Normal progression for driver-facing flow is:
            # Assigned to Driver -> (optional) At Pickup -> In Transit
            allowed = {"Awarded", "Dispatched", "Assigned to Driver", "At Pickup", "Picked Up", "In Transit"}
            ws_i = _workflow_index(ws)
            assigned_i = _workflow_index("Assigned to Driver")
            in_transit_i = _workflow_index("In Transit")

            # If we recognize the workflow status, block pickup completion for loads that
            # haven't reached driver assignment yet.
            if ws_i is not None and assigned_i is not None and ws_i < assigned_i:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot complete pickup while workflow_status is '{ws}'. Expected 'Assigned to Driver' (or later).",
                )

            # If the workflow status is later than In Transit, completing pickup would be a backwards move.
            if ws_i is not None and in_transit_i is not None and ws_i > in_transit_i:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot complete pickup while workflow_status is '{ws}'.",
                )

            if ws not in allowed:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Invalid workflow transition from '{ws}' to 'In Transit'. "
                        "Expected workflow_status to be one of: Awarded, Dispatched, Assigned to Driver, At Pickup."
                    ),
                )
    except HTTPException:
        raise
    except Exception:
        pass

    picked_up_ts = float(req.picked_up_at) if req.picked_up_at is not None else now_ts()

    private_details = load.get("private_details") if isinstance(load.get("private_details"), dict) else {}
    pickup_lat = private_details.get("pickup_lat")
    pickup_lng = private_details.get("pickup_lng")

    gps_ok = True
    gps_distance_m = None
    if pickup_lat is not None and pickup_lng is not None:
        gps_distance_m = haversine_distance_meters(req.latitude, req.longitude, float(pickup_lat), float(pickup_lng))
        gps_ok = gps_distance_m <= 10.0

    eta_ok = True
    eta_diff_hours = None
    eta_dt = parse_datetime_best_effort(load.get("pickup_date"))
    picked_up_dt = parse_datetime_best_effort(picked_up_ts)
    if eta_dt and picked_up_dt:
        eta_diff_hours = abs((picked_up_dt - eta_dt).total_seconds()) / 3600.0
        eta_ok = eta_diff_hours <= 48.0

    if not gps_ok:
        raise HTTPException(status_code=400, detail=f"GPS check failed: {gps_distance_m:.1f}m from pickup location")
    if not eta_ok:
        raise HTTPException(status_code=400, detail=f"Pickup ETA check failed: pickup time differs by {eta_diff_hours:.1f}h")

    # Require a real BOL file upload before pickup completion.
    # This prevents completing pickup via external URLs and keeps strict ordering.
    try:
        bol_ok = False
        firestore_timeout_s = float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 8) or 8)
        snaps = list(
            db.collection("loads").document(str(load_id)).collection("documents").where("kind", "==", "BOL").stream(timeout=firestore_timeout_s)
        )
        for sdoc in snaps:
            d = sdoc.to_dict() or {}
            if d.get("storage_path"):
                bol_ok = True
                break
        if not bol_ok:
            raise HTTPException(status_code=400, detail="Upload BOL document before completing pickup")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to verify BOL document (timeout or connectivity). Try again.")

    # Upload shipper/warehouse signature as a document (best-effort).
    # This can be slow/hang if storage is misconfigured, so run it in the background.
    def _bg_upload_pickup_signature() -> None:
        try:
            latest = _get_load(load_id) or load
            raw, content_type = decode_data_url_base64(req.shipper_signature_data_url)
            ext = "png" if "png" in (content_type or "").lower() else "bin"
            filename = f"bol_signature_{load_id}_{int(picked_up_ts)}.{ext}"
            upload_load_document_bytes(load=latest, kind="BOL_SIGNATURE", filename=filename, data=raw, actor=user, source="pickup")
        except Exception:
            return

    try:
        if req.shipper_signature_data_url:
            background_tasks.add_task(_bg_upload_pickup_signature)
    except Exception:
        pass

    updates = {
        "status": "in_transit",
        "picked_up_at": picked_up_ts,
        "bol_locked_at": picked_up_ts,
        "bol_locked_by_uid": user.get("uid"),
        "updated_at": now_ts(),
    }

    # Record BOL driver signature status (best-effort).
    try:
        contract = set_contract_bol_signature(
            load=load,
            signer_role="driver",
            signer_uid=str(user.get("uid") or ""),
            signer_name=str(user.get("display_name") or user.get("email") or "").strip() or None,
        )
        updates["contract"] = contract
    except Exception:
        contract = None

    pickup_event_id = str(uuid.uuid4())
    pickup_event = {
        "pickup_event_id": pickup_event_id,
        "load_id": load_id,
        "timestamp": picked_up_ts,
        "gps": {"lat": req.latitude, "lng": req.longitude},
        "shipper": {"name": req.shipper_name},
        "remarks": req.remarks,
        "driver": {"uid": user.get("uid"), "name": user.get("display_name") or user.get("email")},
        "validation": {
            "gps_distance_m": gps_distance_m,
            "gps_ok": gps_ok,
            "eta_diff_hours": eta_diff_hours,
            "eta_ok": eta_ok,
        },
        "created_at": picked_up_ts,
    }

    try:
        load_ref = db.collection("loads").document(str(load_id))
        _fs_set(load_ref, updates, merge=True)
        _fs_set(load_ref.collection("pickup").document(pickup_event_id), pickup_event)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save pickup: {e}")

    # Log the "Picked Up" milestone for tracking UI (without changing the primary workflow_status).
    try:
        _log_workflow_status(
            load_id,
            old_status=str(load.get("workflow_status") or "").strip() or None,
            new_status="Picked Up",
            actor=user,
            notes="Pickup completed (signatures captured)",
            ts=picked_up_ts,
        )
    except Exception:
        pass

    _set_workflow_status(load_id, new_status="In Transit", actor=user, notes="Driver completed pickup")

    log_action(str(user.get("uid")), "DRIVER_PICKUP_COMPLETE", f"Load {load_id}: pickup completed and BOL locked")

    # Admin snapshot/event (best-effort).
    try:
        upsert_load_admin_snapshot(
            str(load_id),
            {
                "load_id": str(load_id),
                "participants": {
                    "shipper": snapshot_user(str(load.get("created_by") or "")),
                    "carrier": snapshot_user(str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "")),
                    "driver": snapshot_user(str(user.get("uid") or "")),
                },
                "timestamps": {"picked_up_at": picked_up_ts, "bol_locked_at": picked_up_ts},
            },
        )
        record_load_admin_event(load_id=str(load_id), event_type="PICKUP_COMPLETED", actor=user, data={"picked_up_at": picked_up_ts})
    except Exception:
        pass

    return {"success": True, "load_id": load_id, "pickup_event_id": pickup_event_id, "workflow_status": "In Transit"}


@router.post("/loads/{load_id}/rate-confirmation/shipper-sign")
async def shipper_sign_rate_confirmation(
    load_id: str,
    req: RateConSignRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    _require_shipper_owner(load, user)

    # Must be awarded to a carrier first.
    assigned = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "").strip()
    if not assigned:
        raise HTTPException(status_code=400, detail="Load is not awarded to a carrier yet")

    # Ensure a RC document exists (best-effort).
    try:
        rc_doc = ensure_rate_confirmation_document(load_id=load_id, shipper=user)
        if rc_doc and rc_doc.get("doc_id"):
            try:
                db.collection("loads").document(str(load_id)).set(
                    {
                        "rate_confirmation_doc_id": rc_doc.get("doc_id"),
                        "rate_confirmation_url": rc_doc.get("url"),
                        "rate_confirmation_storage_path": rc_doc.get("storage_path"),
                    },
                    merge=True,
                )
            except Exception:
                pass
    except Exception:
        rc_doc = None

    signature_png: Optional[bytes] = None
    if req.signature_data_url:
        try:
            raw, content_type = decode_data_url_base64(req.signature_data_url)
            if "png" not in (content_type or "").lower():
                raise HTTPException(status_code=400, detail="Signature must be a PNG data URL")
            signature_png = raw
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature data")

    contract = set_contract_rate_con_signature(
        load=load,
        signer_role=str(user.get("role")),
        signer_uid=str(user.get("uid")),
        signer_name=req.signer_name,
    )

    # Stamp signature into the RC PDF (required when a signature image is provided).
    if signature_png:
        storage_path = None
        try:
            storage_path = (
                str((rc_doc or {}).get("storage_path") or "").strip()
                or str(load.get("rate_confirmation_storage_path") or "").strip()
            )
        except Exception:
            storage_path = None
        if not storage_path:
            raise HTTPException(status_code=400, detail="Rate Confirmation PDF not found to stamp")
        rc = contract.get("rate_confirmation") if isinstance(contract.get("rate_confirmation"), dict) else {}
        _stamp_rate_confirmation_pdf(
            load_id=load_id,
            storage_path=storage_path,
            shipper_signature_png=signature_png,
            shipper_name=req.signer_name,
            shipper_signed_at=rc.get("shipper_signed_at"),
        )

    ts = now_ts()
    try:
        db.collection("loads").document(str(load_id)).set({"contract": contract, "updated_at": ts}, merge=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save signature: {e}")

    _set_workflow_status(load_id, new_status="Awarded", actor=user, notes="Shipper signed rate confirmation")

    log_action(str(user.get("uid")), "RATE_CON_SIGN_SHIPPER", f"Load {load_id}: shipper signed rate confirmation")

    return {"success": True, "load_id": load_id, "contract": contract, "rate_confirmation": rc_doc}


@router.post("/loads/{load_id}/rate-confirmation/carrier-sign")
async def carrier_sign_rate_confirmation(
    load_id: str,
    req: RateConSignRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    _require_assigned_carrier(load, user)

    if not is_rate_con_shipper_signed(load):
        raise HTTPException(status_code=400, detail="Shipper must sign the rate confirmation first")

    if is_rate_con_carrier_signed(load):
        return {"success": True, "load_id": load_id, "message": "Carrier already signed"}

    contract = set_contract_rate_con_signature(
        load=load,
        signer_role="carrier",
        signer_uid=str(user.get("uid")),
        signer_name=req.signer_name,
    )

    signature_png: Optional[bytes] = None
    if req.signature_data_url:
        try:
            raw, content_type = decode_data_url_base64(req.signature_data_url)
            if "png" not in (content_type or "").lower():
                raise HTTPException(status_code=400, detail="Signature must be a PNG data URL")
            signature_png = raw
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature data")

    # Stamp carrier signature into the RC PDF when provided.
    if signature_png:
        storage_path = str(load.get("rate_confirmation_storage_path") or "").strip()
        if not storage_path:
            # Best-effort fallback via ensure.
            try:
                rc_doc = ensure_rate_confirmation_document(load_id=load_id, shipper={"uid": load.get("created_by"), "role": "shipper"})
                storage_path = str((rc_doc or {}).get("storage_path") or "").strip() or storage_path
            except Exception:
                pass
        if not storage_path:
            raise HTTPException(status_code=400, detail="Rate Confirmation PDF not found to stamp")
        rc = contract.get("rate_confirmation") if isinstance(contract.get("rate_confirmation"), dict) else {}
        _stamp_rate_confirmation_pdf(
            load_id=load_id,
            storage_path=storage_path,
            carrier_signature_png=signature_png,
            carrier_name=req.signer_name,
            carrier_signed_at=rc.get("carrier_signed_at"),
        )

    ts = now_ts()
    patch = {
        "contract": contract,
        "contract_accepted_at": ts,
        "updated_at": ts,
    }

    # This gate controls private address/receiver visibility in API responses.
    patch["private_details_visible_to_carrier"] = True

    try:
        db.collection("loads").document(str(load_id)).set(patch, merge=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save signature: {e}")

    _set_workflow_status(load_id, new_status="Dispatched", actor=user, notes="Carrier signed rate confirmation")

    log_action(str(user.get("uid")), "RATE_CON_SIGN_CARRIER", f"Load {load_id}: carrier signed rate confirmation")

    return {"success": True, "load_id": load_id, "contract": contract}


@router.post("/loads/{load_id}/delivery/complete")
async def driver_complete_delivery(
    load_id: str,
    req: DeliveryCompleteRequest,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user),
):
    role = str(user.get("role") or "").strip().lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can complete delivery")

    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    # Idempotency: if delivery already recorded, return success.
    try:
        if str(load.get("status") or "").strip().lower() in {"delivered", "completed"} and load.get("epod_id"):
            return {
                "success": True,
                "load_id": load_id,
                "epod_id": load.get("epod_id"),
                "workflow_status": str(load.get("workflow_status") or "POD Submitted"),
                "message": "Delivery already completed",
            }
    except Exception:
        pass

    # Must be assigned to this driver.
    if str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip() != str(user.get("uid") or "").strip():
        raise HTTPException(status_code=403, detail="Load is not assigned to you")

    # Minimal state-machine guard: delivery should come after pickup/in-transit.
    try:
        s = str(load.get("status") or "").strip().lower()
        if s and s not in {"in_transit"}:
            raise HTTPException(status_code=400, detail=f"Cannot complete delivery while status is '{s}'")
    except HTTPException:
        raise
    except Exception:
        pass

    # Require a real POD file upload before delivery completion.
    # This prevents completing delivery with only an ePOD marker (e.g. url='epod:...') and no actual POD document.
    try:
        pod_ok = False
        driver_uid = str(user.get("uid") or "").strip()
        firestore_timeout_s = float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 8) or 8)
        snaps = list(
            db.collection("loads").document(str(load_id)).collection("documents").where("kind", "==", "POD").stream(timeout=firestore_timeout_s)
        )
        for sdoc in snaps:
            d = sdoc.to_dict() or {}
            if not d.get("storage_path"):
                continue

            # Enforce responsibility: the driver completing delivery must have uploaded the POD.
            uploaded_by_uid = str(d.get("uploaded_by_uid") or "").strip()
            uploaded_by_role = str(d.get("uploaded_by_role") or "").strip().lower()
            if driver_uid and (uploaded_by_uid == driver_uid or uploaded_by_role == "driver"):
                pod_ok = True
                break
        if not pod_ok:
            raise HTTPException(status_code=400, detail="Driver must upload POD document before completing delivery")
    except HTTPException:
        raise
    except Exception:
        # If we cannot check docs (e.g. transient Firestore issues), fail closed.
        raise HTTPException(status_code=500, detail="Unable to verify POD document (timeout or connectivity). Try again")

    # Delivery checks (mock-friendly): enforce only when we have enough info.
    delivered_ts = float(req.delivered_at) if req.delivered_at is not None else now_ts()

    private_details = load.get("private_details") if isinstance(load.get("private_details"), dict) else {}
    delivery_lat = private_details.get("delivery_lat")
    delivery_lng = private_details.get("delivery_lng")

    gps_ok = True
    gps_distance_m = None
    if delivery_lat is not None and delivery_lng is not None:
        gps_distance_m = haversine_distance_meters(req.latitude, req.longitude, float(delivery_lat), float(delivery_lng))
        gps_ok = gps_distance_m <= 10.0

    eta_ok = True
    eta_diff_hours = None
    eta_dt = parse_datetime_best_effort(load.get("delivery_date"))
    delivered_dt = parse_datetime_best_effort(delivered_ts)
    if eta_dt and delivered_dt:
        eta_diff_hours = abs((delivered_dt - eta_dt).total_seconds()) / 3600.0
        eta_ok = eta_diff_hours <= 48.0

    if not gps_ok:
        raise HTTPException(status_code=400, detail=f"GPS check failed: {gps_distance_m:.1f}m from delivery location")
    if not eta_ok:
        raise HTTPException(status_code=400, detail=f"ETA check failed: delivery time differs by {eta_diff_hours:.1f}h")

    # Create ePOD record
    epod_id = str(uuid.uuid4())
    epod = {
        "epod_id": epod_id,
        "load_id": load_id,
        "timestamp": delivered_ts,
        "gps": {"lat": req.latitude, "lng": req.longitude},
        "receiver": {"name": req.receiver_name},
        "remarks": req.remarks,
        "driver": {"uid": user.get("uid"), "name": user.get("display_name") or user.get("email")},
        "validation": {
            "gps_distance_m": gps_distance_m,
            "gps_ok": gps_ok,
            "eta_diff_hours": eta_diff_hours,
            "eta_ok": eta_ok,
        },
        "created_at": delivered_ts,
    }

    # Attach the receiver signature into the document vault as a POD artifact (image) (best-effort).
    # Run in background so delivery completion isn't blocked by storage.
    def _bg_upload_delivery_signature() -> None:
        try:
            latest = _get_load(load_id) or load
            raw, content_type = decode_data_url_base64(req.receiver_signature_data_url)
            ext = "png" if "png" in (content_type or "").lower() else "bin"
            filename = f"pod_signature_{epod_id}.{ext}"
            upload_load_document_bytes(load=latest, kind="POD_SIGNATURE", filename=filename, data=raw, actor=user, source="epod")
        except Exception:
            return

    try:
        if req.receiver_signature_data_url:
            background_tasks.add_task(_bg_upload_delivery_signature)
    except Exception:
        pass

    updates = {
        "status": "delivered",
        "delivered_at": delivered_ts,
        "pod_submitted_at": delivered_ts,
        "epod_id": epod_id,
        "updated_at": now_ts(),
    }

    try:
        load_ref = db.collection("loads").document(str(load_id))
        _fs_set(load_ref, updates, merge=True)
        _fs_set(load_ref.collection("epod").document(epod_id), epod)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save delivery: {e}")

    # Log the "Delivered" milestone, then advance workflow_status to POD Submitted.
    try:
        _log_workflow_status(
            load_id,
            old_status=str(load.get("workflow_status") or "").strip() or None,
            new_status="Delivered",
            actor=user,
            notes="Receiver signature captured",
            ts=delivered_ts,
        )
    except Exception:
        pass

    _set_workflow_status(load_id, new_status="POD Submitted", actor=user, notes="Delivery completed and POD submitted")

    # Create a document record pointing to the ePOD (best-effort).
    try:
        create_load_document_from_url(load=load, kind="EPOD", url=f"epod:{epod_id}", actor=user, source="epod")
    except Exception:
        pass

    # Notify shipper + carrier (in-app notification)
    try:
        shipper_uid = str(load.get("created_by") or "").strip() or None
        carrier_uid = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "").strip() or None
        ts_i = int(now_ts())
        for target_uid, ntype in [(shipper_uid, "pod_submitted"), (carrier_uid, "pod_submitted")]:
            if not target_uid:
                continue
            notif_id = str(uuid.uuid4())
            _fs_set(
                db.collection("notifications").document(notif_id),
                {
                    "id": notif_id,
                    "user_id": target_uid,
                    "notification_type": ntype,
                    "title": f"POD submitted for Load {load.get('load_number') or load_id}",
                    "message": "A POD was submitted and is ready for review.",
                    "resource_type": "load",
                    "resource_id": load_id,
                    "action_url": f"/shipper-dashboard?nav=my-loads&load_id={load_id}",
                    "is_read": False,
                    "created_at": ts_i,
                    "load_id": load_id,
                    "epod_id": epod_id,
                },
            )
    except Exception:
        pass

    log_action(str(user.get("uid")), "DRIVER_DELIVERY_COMPLETE", f"Load {load_id}: delivery completed + POD submitted")

    return {"success": True, "load_id": load_id, "epod_id": epod_id, "workflow_status": "POD Submitted"}


@router.post("/loads/{load_id}/invoices")
async def carrier_create_invoice(
    load_id: str,
    req: InvoiceCreateRequest,
    user: Dict[str, Any] = Depends(get_current_user),
):
    raise HTTPException(
        status_code=410,
        detail="Deprecated: use POST /invoices (Finance API) for invoice creation",
    )


@router.post("/loads/{load_id}/payment/settle")
async def shipper_settle_payment(
    load_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    _require_shipper_owner(load, user)

    invoice_id = str(load.get("invoice_id") or "").strip() or None
    if not invoice_id:
        raise HTTPException(status_code=400, detail="No invoice found for this load")

    ts = now_ts()
    try:
        db.collection("invoices").document(invoice_id).set({"status": "paid", "paid_at": ts, "updated_at": ts}, merge=True)
        db.collection("loads").document(str(load_id)).set(
            {"status": "completed", "payment_settled_at": ts, "updated_at": ts},
            merge=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to settle payment: {e}")

    _set_workflow_status(load_id, new_status="Payment Settled", actor=user, notes="Shipper settled payment")

    log_action(str(user.get("uid")), "PAYMENT_SETTLED", f"Load {load_id}: payment settled")

    return {"success": True, "load_id": load_id, "workflow_status": "Payment Settled"}


@router.get("/loads/{load_id}/viewer")
async def get_load_for_viewer(
    load_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Convenience endpoint for clients that want server-side redaction applied."""
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    redacted = sanitize_load_for_viewer(load, viewer_uid=str(user.get("uid")), viewer_role=str(user.get("role")))
    return {"load": redacted}


def workflow_notify_previous_carriers_on_post(*, shipper_uid: str, load: Dict[str, Any]) -> int:
    return notify_previous_carriers_new_load(
        db=db,
        shipper_uid=shipper_uid,
        load=load,
        frontend_base_url=str(getattr(settings, "FRONTEND_BASE_URL", "") or "").rstrip("/") or None,
    )
