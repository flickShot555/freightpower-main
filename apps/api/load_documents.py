from __future__ import annotations

import hashlib
import time
import uuid
import os
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from .auth import get_current_user
from .database import bucket, db, signed_download_url
from .load_audit import record_load_admin_event, snapshot_user, upsert_load_admin_snapshot
from .load_ownership import normalize_payer_fields
from .load_workflow_utils import is_rate_con_carrier_signed, set_contract_bol_signature
from .settings import settings

try:
    from .finance.emailer import send_invoice_notification_email
except Exception:  # pragma: no cover
    send_invoice_notification_email = None

try:
    import fitz  # PyMuPDF
except Exception:  # pragma: no cover
    fitz = None


router = APIRouter(tags=["load-documents"])


_ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}


def _get_user_email(uid: str) -> Optional[str]:
    try:
        snap = db.collection("users").document(str(uid)).get()
        if not getattr(snap, "exists", False):
            return None
        d = snap.to_dict() or {}
        email = str(d.get("email") or "").strip()
        return email or None
    except Exception:
        return None


def _notify_payer_pod_uploaded(*, load: Dict[str, Any], doc: Dict[str, Any], actor: Dict[str, Any]) -> None:
    """Create an in-app notification (and optional email) for the payer when a POD is uploaded."""

    try:
        if str(doc.get("kind") or "").strip().upper() != "POD":
            return

        payer_uid, payer_role = normalize_payer_fields(load)
        if not payer_uid:
            return

        actor_uid = str(actor.get("uid") or "").strip()
        if actor_uid and actor_uid == payer_uid:
            # Avoid notifying someone about their own upload.
            return

        load_id = str(load.get("load_id") or "").strip()
        load_number = str(load.get("load_number") or "").strip() or load_id
        doc_id = str(doc.get("doc_id") or doc.get("id") or "").strip() or None

        now = _now()
        notification_id = str(uuid.uuid4())
        action_url = f"/shipper-dashboard?nav=my-loads&load_id={load_id}" if load_id else "/shipper-dashboard?nav=my-loads"
        title = f"POD uploaded for Load {load_number}"
        message = f"A POD was uploaded to Load {load_number}. You can now review it in the portal."

        notification_data = {
            "id": notification_id,
            "user_id": payer_uid,
            "notification_type": "pod_uploaded",
            "title": title,
            "message": message,
            "resource_type": "load_document",
            "resource_id": doc_id or load_id,
            "action_url": action_url,
            "is_read": False,
            "created_at": int(now),
            "load_id": load_id,
            "load_number": load.get("load_number"),
            "payer_role": payer_role,
            "doc_id": doc_id,
            "doc_kind": "POD",
        }

        db.collection("notifications").document(notification_id).set(notification_data)

        # Optional email notification (best-effort).
        try:
            if getattr(settings, "ENABLE_POD_UPLOADED_EMAIL_NOTIFICATIONS", False) and send_invoice_notification_email is not None:
                payer_email = _get_user_email(payer_uid)
                if payer_email:
                    link = f"{getattr(settings, 'FRONTEND_BASE_URL', '').rstrip('/')}{action_url}"
                    subj = f"POD uploaded: Load {load_number}"
                    body = f"A POD was uploaded for Load {load_number} in FreightPower.\n\nView: {link}\n"
                    send_invoice_notification_email(to_email=payer_email, subject=subj, body=body)
        except Exception:
            pass
    except Exception:
        # Never fail document upload due to notification issues.
        return


def _now() -> float:
    return float(time.time())


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _content_type_for_filename(filename: str) -> str:
    fn = (filename or "").lower()
    if fn.endswith(".pdf"):
        return "application/pdf"
    if fn.endswith(".jpg") or fn.endswith(".jpeg"):
        return "image/jpeg"
    if fn.endswith(".png"):
        return "image/png"
    return "application/octet-stream"


def _storage_path_for_load_doc(load_id: str, doc_id: str, filename: str) -> str:
    safe_name = (filename or "file").replace("/", "_").replace("\\", "_")
    return f"load_documents/{load_id}/{doc_id}_{safe_name}"


def _load_doc_ref(load_id: str, doc_id: str):
    return db.collection("loads").document(load_id).collection("documents").document(doc_id)


def _load_docs_collection(load_id: str):
    return db.collection("loads").document(load_id).collection("documents")


def _get_load(load_id: str) -> Optional[Dict[str, Any]]:
    try:
        timeout_s = float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 15) or 15)
        try:
            snap = db.collection("loads").document(load_id).get(timeout=timeout_s)
        except TypeError:
            snap = db.collection("loads").document(load_id).get()
        if snap.exists:
            d = snap.to_dict() or {}
            d.setdefault("load_id", load_id)
            return d
    except Exception:
        return None
    return None


def _can_access_load_documents(load: Dict[str, Any], uid: str, role: str) -> bool:
    role = (role or "").strip().lower()
    if role in {"admin", "super_admin"}:
        return True

    if role in {"shipper", "broker"} and str(load.get("created_by") or "").strip() == uid:
        return True

    assigned_carrier = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "").strip()
    if role == "carrier" and assigned_carrier and assigned_carrier == uid:
        return True

    assigned_driver = str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip()
    if role == "driver" and assigned_driver and assigned_driver == uid:
        return True

    return False


def list_load_documents(load_id: str) -> List[Dict[str, Any]]:
    try:
        timeout_s = float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 15) or 15)
        docs = [snap.to_dict() or {} for snap in _load_docs_collection(load_id).stream(timeout=timeout_s)]
        for d in docs:
            d.setdefault("load_id", load_id)
        docs.sort(key=lambda x: float(x.get("created_at") or x.get("uploaded_at") or 0.0), reverse=True)
        return docs
    except Exception:
        return []


def _find_existing_by_url(load_id: str, kind: str, url: str) -> Optional[Dict[str, Any]]:
    kind_u = (kind or "OTHER").strip().upper()
    url_s = (url or "").strip()
    if not url_s:
        return None

    for d in list_load_documents(load_id):
        if (str(d.get("kind") or "").strip().upper() == kind_u) and (str(d.get("url") or "").strip() == url_s):
            return d
    return None


def create_load_document_from_url(
    *,
    load: Dict[str, Any],
    kind: str,
    url: str,
    actor: Dict[str, Any],
    filename: Optional[str] = None,
    source: str = "external_url",
    storage_path: Optional[str] = None,
) -> Dict[str, Any]:
    load_id = str(load.get("load_id") or "").strip()
    if not load_id:
        raise ValueError("load_id required")

    existing = _find_existing_by_url(load_id, kind, url)
    if existing:
        return existing

    now = _now()
    doc_id = str(uuid.uuid4())
    record = {
        "doc_id": doc_id,
        "load_id": load_id,
        "load_number": load.get("load_number"),
        "kind": (kind or "OTHER").strip().upper(),
        "filename": filename,
        "content_type": None,
        "size_bytes": None,
        "sha256": None,
        "storage_path": storage_path,
        "url": url,
        "source": source,
        "uploaded_by_uid": actor.get("uid"),
        "uploaded_by_role": actor.get("role"),
        "created_at": now,
        "uploaded_at": now,
        "updated_at": now,
        "metadata": {},
    }

    try:
        timeout_s = float(getattr(settings, "FIRESTORE_JOB_TIMEOUT_SECONDS", 15) or 15)
        try:
            _load_doc_ref(load_id, doc_id).set(record, merge=True, timeout=timeout_s)
        except TypeError:
            _load_doc_ref(load_id, doc_id).set(record, merge=True)
    except Exception:
        # best-effort only
        pass

    _notify_payer_pod_uploaded(load=load, doc=record, actor=actor)

    return record


def upload_load_document_bytes(
    *,
    load: Dict[str, Any],
    kind: str,
    filename: str,
    data: bytes,
    actor: Dict[str, Any],
    source: str = "upload",
) -> Dict[str, Any]:
    load_id = str(load.get("load_id") or "").strip()
    if not load_id:
        raise ValueError("load_id required")

    now = _now()
    doc_id = str(uuid.uuid4())

    content_type = _content_type_for_filename(filename)
    storage_path = _storage_path_for_load_doc(load_id, doc_id, filename)
    url: Optional[str] = None

    upload_timeout_s = float(getattr(settings, "STORAGE_UPLOAD_TIMEOUT_SECONDS", 10) or 10)

    try:
        blob = bucket.blob(storage_path)
        try:
            blob.upload_from_string(data, content_type=content_type, timeout=upload_timeout_s)
        except TypeError:
            blob.upload_from_string(data, content_type=content_type)
        url = signed_download_url(storage_path, filename=filename, disposition="attachment", ttl_seconds=3600)
    except Exception:
        url = None

    record = {
        "doc_id": doc_id,
        "load_id": load_id,
        "load_number": load.get("load_number"),
        "kind": (kind or "OTHER").strip().upper(),
        "filename": filename,
        "content_type": content_type,
        "size_bytes": len(data) if data is not None else None,
        "sha256": _sha256(data) if data is not None else None,
        "storage_path": storage_path,
        # NOTE: Do not persist signed URLs long-term (they expire). We return a fresh URL in API responses.
        "url": None,
        "source": source,
        "uploaded_by_uid": actor.get("uid"),
        "uploaded_by_role": actor.get("role"),
        "created_at": now,
        "uploaded_at": now,
        "updated_at": now,
        "metadata": {},
    }

    try:
        try:
            _load_doc_ref(load_id, doc_id).set(record, merge=True, timeout=upload_timeout_s)
        except TypeError:
            _load_doc_ref(load_id, doc_id).set(record, merge=True)
    except Exception:
        pass

    _notify_payer_pod_uploaded(load=load, doc=record, actor=actor)

    # Return a response-friendly record with a fresh signed URL.
    out = dict(record)
    out["url"] = url
    return out


def generate_rate_confirmation_pdf_bytes(*, load: Dict[str, Any], accepted_offer: Optional[Dict[str, Any]], shipper: Dict[str, Any]) -> bytes:
    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not available")

    load_id = str(load.get("load_id") or "").strip()
    load_number = str(load.get("load_number") or "").strip()
    origin = load.get("origin")
    destination = load.get("destination")

    def _loc_text(v: Any) -> str:
        if isinstance(v, str):
            return v
        if isinstance(v, dict):
            city = v.get("city") or ""
            state = v.get("state") or ""
            text = v.get("text") or ""
            combo = (", ".join([p for p in [city, state] if p])).strip(", ")
            return combo or text or str(v)
        return str(v or "")

    lines: List[str] = []
    lines.append("RATE CONFIRMATION")
    lines.append("")
    lines.append(f"Load Number: {load_number or '—'}")
    lines.append(f"Load ID: {load_id or '—'}")
    lines.append("")
    lines.append(f"Shipper: {(shipper.get('company_name') or shipper.get('name') or shipper.get('email') or shipper.get('uid') or '—')}")
    if shipper.get("email"):
        lines.append(f"Shipper Email: {shipper.get('email')}")
    lines.append("")

    if accepted_offer:
        rate = accepted_offer.get("rate")
        carrier_name = accepted_offer.get("carrier_name")
        carrier_id = accepted_offer.get("carrier_id")
        if carrier_name or carrier_id:
            lines.append(f"Carrier: {carrier_name or carrier_id}")
        if rate is not None:
            lines.append(f"Rate: ${float(rate):,.2f}")
        if accepted_offer.get("notes"):
            lines.append(f"Notes: {accepted_offer.get('notes')}")
        lines.append("")

    lines.append(f"Origin: {_loc_text(origin) or '—'}")
    lines.append(f"Destination: {_loc_text(destination) or '—'}")

    for key, label in [
        ("pickup_date", "Pickup Date"),
        ("delivery_date", "Delivery Date"),
        ("pickup_time", "Pickup Time"),
        ("delivery_time", "Delivery Time"),
    ]:
        if load.get(key):
            lines.append(f"{label}: {load.get(key)}")

    doc = fitz.open()
    page = doc.new_page(width=612, height=792)  # Letter

    y = 72
    for i, line in enumerate(lines):
        size = 16 if i == 0 else 11
        page.insert_text((72, y), line, fontsize=size)
        y += 22 if i == 0 else 16

    # Signature placeholders (for later stamping).
    page.insert_text((72, 625), "Shipper Signature:", fontsize=11)
    page.insert_text((332, 625), "Carrier Signature:", fontsize=11)
    page.insert_text((72, 712), "Shipper Date:", fontsize=9)
    page.insert_text((332, 712), "Carrier Date:", fontsize=9)

    out = doc.tobytes()
    doc.close()
    return out


def _get_user_profile(uid: str) -> Dict[str, Any]:
    """Best-effort user profile lookup for document generation.

    Returns a compact dict with fields like name/company/email/phone.
    """

    snap = snapshot_user(uid)
    return snap or {"uid": str(uid or "").strip()}


def generate_bol_pdf_bytes(*, load: Dict[str, Any], shipper: Dict[str, Any], carrier: Dict[str, Any], driver: Dict[str, Any]) -> bytes:
    """Generate a Bill of Lading PDF for a load.

    Pricing/rates are intentionally excluded.
    """

    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not available")

    def _s(v: Any) -> str:
        return str(v or "").strip()

    def _who(p: Dict[str, Any]) -> str:
        return _s(p.get("company_name") or p.get("name") or p.get("email") or p.get("uid") or "—") or "—"

    def _phone(p: Dict[str, Any]) -> str:
        return _s(p.get("phone") or p.get("phone_number") or "")

    def _loc_text(v: Any) -> str:
        if isinstance(v, str):
            return v
        if isinstance(v, dict):
            city = v.get("city") or ""
            state = v.get("state") or ""
            text = v.get("text") or ""
            combo = (", ".join([p for p in [city, state] if p])).strip(", ")
            return combo or text or str(v)
        return str(v or "")

    load_id = _s(load.get("load_id"))
    load_number = _s(load.get("load_number"))

    origin = load.get("origin")
    destination = load.get("destination")

    private_details = load.get("private_details") if isinstance(load.get("private_details"), dict) else {}
    pickup_exact = _s(private_details.get("pickup_exact_address"))
    delivery_exact = _s(private_details.get("delivery_exact_address"))

    receiver = private_details.get("receiver") if isinstance(private_details.get("receiver"), dict) else {}
    receiver_company = _s(receiver.get("company_name"))
    receiver_addr = _s(receiver.get("exact_address"))
    receiver_contact = _s(receiver.get("contact_name"))
    receiver_phone = _s(receiver.get("contact_phone"))
    receiver_email = _s(receiver.get("contact_email"))

    ref_numbers = private_details.get("reference_numbers") if isinstance(private_details.get("reference_numbers"), dict) else {}
    special_instructions = _s(private_details.get("special_instructions"))

    contract = load.get("contract") if isinstance(load.get("contract"), dict) else {}
    bol_sig = contract.get("bol") if isinstance(contract.get("bol"), dict) else {}

    lines: List[str] = []
    lines.append("BILL OF LADING (BOL)")
    lines.append("")
    lines.append(f"Load Number: {load_number or '—'}")
    lines.append(f"Load ID: {load_id or '—'}")
    lines.append("")

    lines.append(f"Shipper: {_who(shipper)}")
    if shipper.get("email"):
        lines.append(f"Shipper Email: {_s(shipper.get('email'))}")
    if _phone(shipper):
        lines.append(f"Shipper Phone: {_phone(shipper)}")
    lines.append("")

    lines.append(f"Carrier: {_who(carrier)}")
    if carrier.get("email"):
        lines.append(f"Carrier Email: {_s(carrier.get('email'))}")
    if _phone(carrier):
        lines.append(f"Carrier Phone: {_phone(carrier)}")
    lines.append("")

    lines.append(f"Driver: {_who(driver)}")
    if driver.get("email"):
        lines.append(f"Driver Email: {_s(driver.get('email'))}")
    if _phone(driver):
        lines.append(f"Driver Phone: {_phone(driver)}")
    lines.append("")

    lines.append(f"Origin (City/State): {_loc_text(origin) or '—'}")
    if pickup_exact:
        lines.append(f"Pickup Address: {pickup_exact}")
    lines.append(f"Destination (City/State): {_loc_text(destination) or '—'}")
    if delivery_exact:
        lines.append(f"Delivery Address: {delivery_exact}")
    lines.append("")

    for key, label in [
        ("pickup_date", "Pickup Date"),
        ("pickup_time", "Pickup Time"),
        ("delivery_date", "Delivery Date"),
        ("delivery_time", "Delivery Time"),
        ("equipment_type", "Equipment"),
        ("commodity", "Commodity"),
        ("weight", "Weight"),
        ("pieces", "Pieces"),
        ("pallets", "Pallets"),
    ]:
        if load.get(key) is not None and _s(load.get(key)):
            lines.append(f"{label}: {_s(load.get(key))}")

    if receiver_company or receiver_addr or receiver_contact:
        lines.append("")
        lines.append("Consignee / Receiver:")
        if receiver_company:
            lines.append(f"  Company: {receiver_company}")
        if receiver_addr:
            lines.append(f"  Address: {receiver_addr}")
        if receiver_contact:
            lines.append(f"  Contact: {receiver_contact}")
        if receiver_phone:
            lines.append(f"  Phone: {receiver_phone}")
        if receiver_email:
            lines.append(f"  Email: {receiver_email}")

    if ref_numbers:
        lines.append("")
        lines.append("Reference Numbers:")
        for k, v in sorted(ref_numbers.items()):
            ks = _s(k)
            vs = _s(v)
            if ks and vs:
                lines.append(f"  {ks}: {vs}")

    if special_instructions:
        lines.append("")
        lines.append("Special Instructions:")
        lines.append(f"  {special_instructions}")

    # Add signature status (timestamps) without embedding signature images.
    try:
        shipper_signed_at = bol_sig.get("shipper_signed_at")
        driver_signed_at = bol_sig.get("driver_signed_at")
        if shipper_signed_at or driver_signed_at:
            lines.append("")
            lines.append("Signature Status:")
            lines.append(f"  Shipper Signed At: {_s(shipper_signed_at) or '—'}")
            lines.append(f"  Driver Signed At: {_s(driver_signed_at) or '—'}")
    except Exception:
        pass

    doc = fitz.open()
    page = doc.new_page(width=612, height=792)  # Letter

    y = 54
    x = 54
    max_y = 740
    for i, line in enumerate(lines):
        size = 16 if i == 0 else 10
        page.insert_text((x, y), str(line), fontsize=size)
        y += 20 if i == 0 else 14
        if y > max_y:
            page = doc.new_page(width=612, height=792)
            y = 54

    # Signature placeholders.
    page.insert_text((54, 735), "Shipper Signature: ___________________________", fontsize=10)
    page.insert_text((330, 735), "Driver Signature: ___________________________", fontsize=10)

    out = doc.tobytes()
    doc.close()
    return out


def ensure_bol_document(*, load_id: str, actor: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Ensure a storage-backed BOL document exists for this load.

    Returns a response-friendly record with a fresh signed URL when possible.
    """

    load = _get_load(load_id)
    if not load:
        return None

    # Don't create duplicates.
    for d in list_load_documents(load_id):
        if str(d.get("kind") or "").strip().upper() != "BOL":
            continue
        storage_path = str(d.get("storage_path") or "").strip()
        if storage_path:
            try:
                out = dict(d)
                out["url"] = signed_download_url(storage_path, filename=(d.get("filename") or None), disposition="attachment", ttl_seconds=3600)
                return out
            except Exception:
                return d

    shipper_uid = str(load.get("created_by") or "").strip()
    carrier_uid = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "").strip()
    driver_uid = str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip()

    shipper = _get_user_profile(shipper_uid) if shipper_uid else {"uid": shipper_uid or None}
    carrier = _get_user_profile(carrier_uid) if carrier_uid else {"uid": carrier_uid or None}
    driver = _get_user_profile(driver_uid) if driver_uid else {"uid": driver_uid or None, "name": "TBD"}

    pdf_bytes = generate_bol_pdf_bytes(load=load, shipper=shipper, carrier=carrier, driver=driver)
    filename = f"bol_{load.get('load_number') or load_id}.pdf"
    record = upload_load_document_bytes(load=load, kind="BOL", filename=filename, data=pdf_bytes, actor=actor, source="generated")

    # Mirror workflow convenience fields.
    try:
        if record and record.get("doc_id"):
            db.collection("loads").document(str(load_id)).set(
                {
                    "bol_doc_id": record.get("doc_id"),
                    "bol_storage_path": record.get("storage_path"),
                    "bol_uploaded_at": record.get("uploaded_at"),
                },
                merge=True,
            )
    except Exception:
        pass

    return record


@router.post("/loads/{load_id}/documents/generate-bol")
@router.post("/loads/{load_id}/documents/generate-bol/", include_in_schema=False)
async def generate_bol(load_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    role = str(user.get("role") or "").strip().lower()
    uid = str(user.get("uid") or "").strip()
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Only shipper/broker/admin can generate BOL")
    if role in {"shipper", "broker"} and str(load.get("created_by") or "").strip() != uid:
        raise HTTPException(status_code=403, detail="You can only generate documents for loads you created")

    try:
        if not is_rate_con_carrier_signed(load):
            raise HTTPException(status_code=400, detail="Carrier must sign rate confirmation before BOL can be generated")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to verify rate confirmation status")

    if load.get("bol_locked_at"):
        raise HTTPException(status_code=400, detail="BOL is locked after pickup and cannot be modified")

    # Create the PDF record.
    record = ensure_bol_document(load_id=str(load_id), actor=user)
    if not record:
        raise HTTPException(status_code=500, detail="Failed to generate BOL")

    # Record shipper signature status (best-effort): generating BOL implies shipper has prepared/approved it.
    try:
        contract = set_contract_bol_signature(
            load=load,
            signer_role=role,
            signer_uid=uid,
            signer_name=str(user.get("display_name") or user.get("email") or "").strip() or None,
        )
        db.collection("loads").document(str(load_id)).set({"contract": contract, "updated_at": _now()}, merge=True)
    except Exception:
        contract = None

    # Admin snapshot/event (best-effort).
    try:
        upsert_load_admin_snapshot(
            str(load_id),
            {
                "load_id": str(load_id),
                "participants": {
                    "shipper": snapshot_user(str(load.get("created_by") or "")),
                    "carrier": snapshot_user(str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "")),
                    "driver": snapshot_user(str(load.get("assigned_driver") or load.get("assigned_driver_id") or "")),
                },
                "documents_index": {"BOL": {"doc_id": record.get("doc_id"), "uploaded_at": record.get("uploaded_at"), "source": record.get("source")}},
            },
        )
        record_load_admin_event(load_id=str(load_id), event_type="BOL_GENERATED", actor=user, data={"doc_id": record.get("doc_id")})
    except Exception:
        pass

    return {"success": True, "load_id": load_id, "document": record, "contract": contract}


def stamp_rate_confirmation_signatures_pdf_bytes(
    *,
    pdf_bytes: bytes,
    shipper_signature_png: Optional[bytes] = None,
    carrier_signature_png: Optional[bytes] = None,
    shipper_name: Optional[str] = None,
    carrier_name: Optional[str] = None,
    shipper_signed_at: Optional[float] = None,
    carrier_signed_at: Optional[float] = None,
) -> bytes:
    """Embed signature PNG images into a Rate Confirmation PDF.

    Coordinates are aligned with the placeholders added by generate_rate_confirmation_pdf_bytes.
    """

    if fitz is None:
        raise RuntimeError("PyMuPDF (fitz) is not available")

    def _fmt_ts(ts: Optional[float]) -> str:
        try:
            if ts is None:
                return ""
            return time.strftime("%Y-%m-%d %H:%M", time.localtime(float(ts)))
        except Exception:
            return ""

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        page = doc[-1]

        shipper_rect = fitz.Rect(72, 640, 280, 700)
        carrier_rect = fitz.Rect(332, 640, 540, 700)

        if shipper_signature_png:
            page.insert_image(shipper_rect, stream=shipper_signature_png, keep_proportion=True)
        if carrier_signature_png:
            page.insert_image(carrier_rect, stream=carrier_signature_png, keep_proportion=True)

        # Add lightweight audit text under the signature blocks.
        shipper_meta = " ".join([p for p in [shipper_name or "", _fmt_ts(shipper_signed_at)] if p]).strip()
        carrier_meta = " ".join([p for p in [carrier_name or "", _fmt_ts(carrier_signed_at)] if p]).strip()
        if shipper_meta:
            page.insert_text((72, 730), shipper_meta, fontsize=8)
        if carrier_meta:
            page.insert_text((332, 730), carrier_meta, fontsize=8)

        out = doc.tobytes()
        return out
    finally:
        doc.close()


def ensure_rate_confirmation_document(*, load_id: str, shipper: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    load = _get_load(load_id)
    if not load:
        return None

    # Don't create duplicates; but if an existing RC doc has no storage backing (legacy),
    # generate and upload a storage-backed PDF so we can stamp signatures.
    for d in list_load_documents(load_id):
        if str(d.get("kind") or "").strip().upper() != "RATE_CONFIRMATION":
            continue

        storage_path = str(d.get("storage_path") or "").strip()
        if storage_path:
            try:
                d = dict(d)
                d["url"] = signed_download_url(
                    storage_path,
                    filename=(d.get("filename") or None),
                    disposition="attachment",
                    ttl_seconds=3600,
                )
            except Exception:
                pass
            return d

        # If we can't stamp (no storage_path), generate a storage-backed PDF using the same doc_id.
        try:
            doc_id = str(d.get("doc_id") or "").strip()
            if not doc_id:
                break

            accepted_offer = None
            offers = load.get("offers")
            if isinstance(offers, list):
                for o in offers:
                    if isinstance(o, dict) and str(o.get("status") or "").lower() == "accepted":
                        accepted_offer = o
                        break

            pdf_bytes = generate_rate_confirmation_pdf_bytes(load=load, accepted_offer=accepted_offer, shipper=shipper)
            filename = str(d.get("filename") or "").strip() or f"rate_confirmation_{load.get('load_number') or load_id}.pdf"
            storage_path = _storage_path_for_load_doc(load_id, doc_id, filename)

            blob = bucket.blob(storage_path)
            blob.upload_from_string(pdf_bytes, content_type="application/pdf")

            patch = {
                "filename": filename,
                "content_type": "application/pdf",
                "size_bytes": len(pdf_bytes) if pdf_bytes is not None else None,
                "sha256": _sha256(pdf_bytes) if pdf_bytes is not None else None,
                "storage_path": storage_path,
                "source": d.get("source") or "generated",
                "updated_at": _now(),
            }
            try:
                _load_doc_ref(load_id, doc_id).set(patch, merge=True)
            except Exception:
                pass

            out = dict(d)
            out.update(patch)
            try:
                out["url"] = signed_download_url(storage_path, filename=filename, disposition="attachment", ttl_seconds=3600)
            except Exception:
                out["url"] = None
            return out
        except Exception:
            return d

    accepted_offer = None
    offers = load.get("offers")
    if isinstance(offers, list):
        for o in offers:
            if isinstance(o, dict) and str(o.get("status") or "").lower() == "accepted":
                accepted_offer = o
                break

    pdf_bytes = generate_rate_confirmation_pdf_bytes(load=load, accepted_offer=accepted_offer, shipper=shipper)
    filename = f"rate_confirmation_{load.get('load_number') or load_id}.pdf"
    return upload_load_document_bytes(load=load, kind="RATE_CONFIRMATION", filename=filename, data=pdf_bytes, actor=shipper, source="generated")


@router.get("/loads/{load_id}/documents")
async def get_load_documents(load_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    if not _can_access_load_documents(load, user.get("uid"), user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized to view load documents")

    docs = list_load_documents(load_id)
    # Always return fresh signed URLs when we have storage_path.
    for d in docs:
        try:
            sp = str(d.get("storage_path") or "").strip()
            if sp:
                d["url"] = signed_download_url(sp, filename=(d.get("filename") or None), disposition="attachment", ttl_seconds=3600)
        except Exception:
            continue
    return {"load_id": load_id, "total": len(docs), "documents": docs}


@router.post("/loads/{load_id}/documents/upload")
async def upload_load_document(
    load_id: str,
    file: UploadFile = File(...),
    kind: str = Form("OTHER"),
    user: Dict[str, Any] = Depends(get_current_user),
):
    load = _get_load(load_id)
    if not load:
        raise HTTPException(status_code=404, detail="Load not found")

    if not _can_access_load_documents(load, user.get("uid"), user.get("role")):
        raise HTTPException(status_code=403, detail="Not authorized to upload documents for this load")

    kind_upper = str(kind or "OTHER").strip().upper()

    # Enforce strict workflow ordering for operational documents.
    role = str(user.get("role") or "").strip().lower()
    uid = str(user.get("uid") or "").strip()

    if kind_upper == "BOL":
        # BOL is created/uploaded by shipper (or broker/admin) only after RateCon is fully accepted.
        if role not in {"shipper", "broker", "admin", "super_admin"}:
            raise HTTPException(status_code=403, detail="Only shipper/broker can upload BOL")
        try:
            if not is_rate_con_carrier_signed(load):
                raise HTTPException(status_code=400, detail="Carrier must sign rate confirmation before BOL can be uploaded")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Unable to verify rate confirmation status; try again")

    if kind_upper == "POD":
        # POD is submitted by the assigned driver as proof at delivery.
        if role != "driver":
            raise HTTPException(status_code=403, detail="Only the assigned driver can upload POD")
        assigned_driver = str(load.get("assigned_driver") or load.get("assigned_driver_id") or "").strip()
        if assigned_driver and uid and assigned_driver != uid:
            raise HTTPException(status_code=403, detail="Load is not assigned to you")
        # Keep order: POD should only happen after pickup/in transit.
        s = str(load.get("status") or "").strip().lower()
        if s and s not in {"in_transit"}:
            raise HTTPException(status_code=400, detail=f"Cannot upload POD while status is '{s}'")

    if kind_upper == "BOL" and load.get("bol_locked_at"):
        raise HTTPException(status_code=400, detail="BOL is locked after pickup and cannot be modified")

    filename = file.filename or "file"
    ext = ("." + filename.split(".")[-1].lower()) if "." in filename else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF, JPG, JPEG, and PNG files are supported")

    data = await file.read()
    record = upload_load_document_bytes(load=load, kind=kind_upper, filename=filename, data=data, actor=user, source="upload")

    # Best-effort: mark BOL as shipper-signed/prepared when shipper uploads it.
    if kind_upper == "BOL":
        try:
            contract = set_contract_bol_signature(
                load=load,
                signer_role=str(user.get("role") or ""),
                signer_uid=str(user.get("uid") or ""),
                signer_name=str(user.get("display_name") or user.get("email") or "").strip() or None,
            )
            db.collection("loads").document(str(load_id)).set({"contract": contract, "updated_at": _now()}, merge=True)
        except Exception:
            pass

    # For workflow/UI convenience, mirror RC metadata onto the load root.
    try:
        if kind_upper == "RATE_CONFIRMATION" and record and record.get("doc_id"):
            db.collection("loads").document(str(load_id)).set(
                {
                    "rate_confirmation_doc_id": record.get("doc_id"),
                    "rate_confirmation_storage_path": record.get("storage_path"),
                },
                merge=True,
            )
        if kind_upper == "BOL" and record and record.get("doc_id"):
            db.collection("loads").document(str(load_id)).set(
                {
                    "bol_doc_id": record.get("doc_id"),
                    "bol_storage_path": record.get("storage_path"),
                    "bol_uploaded_at": record.get("uploaded_at"),
                },
                merge=True,
            )
        if kind_upper == "POD" and record and record.get("doc_id"):
            db.collection("loads").document(str(load_id)).set(
                {
                    "pod_doc_id": record.get("doc_id"),
                    "pod_storage_path": record.get("storage_path"),
                    "pod_uploaded_at": record.get("uploaded_at"),
                },
                merge=True,
            )
    except Exception:
        pass

    # Admin snapshot/event (best-effort).
    try:
        upsert_load_admin_snapshot(
            str(load_id),
            {
                "load_id": str(load_id),
                "participants": {
                    "shipper": snapshot_user(str(load.get("created_by") or "")),
                    "carrier": snapshot_user(str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "")),
                    "driver": snapshot_user(str(load.get("assigned_driver") or load.get("assigned_driver_id") or "")),
                },
                "documents_index": {
                    kind_upper: {
                        "doc_id": record.get("doc_id"),
                        "uploaded_at": record.get("uploaded_at"),
                        "uploaded_by_uid": record.get("uploaded_by_uid"),
                        "uploaded_by_role": record.get("uploaded_by_role"),
                        "source": record.get("source"),
                    }
                },
            },
        )
        record_load_admin_event(load_id=str(load_id), event_type="LOAD_DOCUMENT_UPLOADED", actor=user, data={"kind": kind_upper, "doc_id": record.get("doc_id")})
    except Exception:
        pass

    return record
