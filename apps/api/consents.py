# File: apps/api/consents.py
from __future__ import annotations

import hashlib
import base64
import re
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .auth import get_current_user
from .database import bucket, db, log_action


router = APIRouter(prefix="/consents", tags=["Consents"])


CONSENT_CATALOG: List[Dict[str, Any]] = [
    {
        "key": "data_sharing_consent",
        "title": "Data Sharing Consent (Per Carrier)",
        "category": "Consent",
        "note": "Consent to share your documents and profile with your associated carrier for marketplace participation.",
        "version": "v1",
        "scope": "per_carrier",
    },
    {
        "key": "background_check_consent",
        "title": "Background Check Consent",
        "category": "Consent",
        "note": "Authorization for FreightPower to conduct background verification as required for commercial drivers.",
        "version": "v1",
        "scope": "global",
    },
    {
        "key": "drug_alcohol_testing_consent",
        "title": "Drug & Alcohol Testing Consent",
        "category": "Consent",
        "note": "Consent for mandatory drug and alcohol testing, where applicable.",
        "version": "v1",
        "scope": "global",
    },
    {
        "key": "medical_certificate_acknowledgement",
        "title": "Medical Certificate Acknowledgement",
        "category": "Consent",
        "note": "Acknowledgement regarding your medical certificate obligations and reporting.",
        "version": "v1",
        "scope": "global",
    },
    {
        "key": "mvr_release",
        "title": "Motor Vehicle Record (MVR) Release",
        "category": "Consent",
        "note": "Authorization to request and review your motor vehicle record.",
        "version": "v1",
        "scope": "global",
    },
    {
        "key": "clearinghouse_consent",
        "title": "FMCSA Clearinghouse Consent",
        "category": "Consent",
        "note": "Consent related to FMCSA Clearinghouse checks, where applicable.",
        "version": "v1",
        "scope": "global",
    },
]


def _catalog_by_key() -> Dict[str, Dict[str, Any]]:
    return {c["key"]: dict(c) for c in CONSENT_CATALOG}


def required_marketplace_consents_for_role(role: str) -> List[str]:
    """Keys required to unlock the driver marketplace.

    Per requirement: ALL consent keys must be signed for marketplace unlock.
    """
    r = (role or "").strip().lower()
    if r != "driver":
        return []
    return [c["key"] for c in CONSENT_CATALOG]


def _driver_primary_carrier_id(uid: str) -> Optional[str]:
    try:
        snap = db.collection("drivers").document(uid).get()
        if not snap.exists:
            return None
        d = snap.to_dict() or {}
        cid = str(d.get("carrier_id") or "").strip()
        return cid or None
    except Exception:
        return None


def _carrier_name(carrier_id: str) -> Optional[str]:
    try:
        snap = db.collection("carriers").document(carrier_id).get()
        if not snap.exists:
            return None
        d = snap.to_dict() or {}
        return str(d.get("company_name") or d.get("name") or "").strip() or None
    except Exception:
        return None


def _driver_signature_meta(uid: str) -> Dict[str, Any]:
    """Fast lookup for signature image metadata in drivers collection."""
    try:
        driver_snap = db.collection("drivers").document(uid).get()
        driver_data = driver_snap.to_dict() if driver_snap.exists else {}
        available = bool(driver_data.get("esign_signature_image_available"))
        path = str(driver_data.get("esign_signature_image_path") or "").strip() or None
        updated_at = driver_data.get("esign_signature_image_updated_at")
        return {"available": available, "path": path, "updated_at": updated_at}
    except Exception:
        return {"available": False, "path": None, "updated_at": None}


def _sync_driver_signature_flag_from_user(uid: str) -> Dict[str, Any]:
    """Back-compat: sync signature path from users/{uid} to drivers flag (best-effort)."""
    try:
        user_snap = db.collection("users").document(uid).get()
        user_data = user_snap.to_dict() if user_snap.exists else {}
        path = str(user_data.get("signature_image_path") or "").strip() or None
        if not path:
            return {"available": False, "path": None, "updated_at": None}

        now = time.time()
        try:
            db.collection("drivers").document(uid).set(
                {
                    "esign_signature_image_available": True,
                    "esign_signature_image_path": path,
                    "esign_signature_image_updated_at": now,
                    "updated_at": now,
                },
                merge=True,
            )
        except Exception:
            pass

        return {"available": True, "path": path, "updated_at": now}
    except Exception:
        return {"available": False, "path": None, "updated_at": None}


def _consent_doc_ref(uid: str, consent_key: str, carrier_id: Optional[str] = None):
    # Global consent
    if not carrier_id:
        return db.collection("users").document(uid).collection("consents").document(consent_key)
    # Per-carrier consent
    return (
        db.collection("users")
        .document(uid)
        .collection("carrier_consents")
        .document(str(carrier_id))
        .collection("consents")
        .document(consent_key)
    )


def _is_signed(doc: Dict[str, Any]) -> bool:
    if not doc:
        return False
    if doc.get("revoked_at"):
        return False
    return bool(doc.get("signed_at"))


def get_user_missing_marketplace_consents(*, uid: str, role: str) -> List[str]:
    required = required_marketplace_consents_for_role(role)
    if not required:
        return []

    catalog = _catalog_by_key()
    carrier_id = _driver_primary_carrier_id(uid)
    missing: List[str] = []
    for key in required:
        meta = catalog.get(key) or {}
        scope = str(meta.get("scope") or "global").strip().lower()
        if scope == "per_carrier":
            if not carrier_id:
                missing.append(key)
                continue
            snap = _consent_doc_ref(uid, key, carrier_id=carrier_id).get()
        else:
            snap = _consent_doc_ref(uid, key).get()
        data = snap.to_dict() if getattr(snap, "exists", False) else {}
        if not _is_signed(data or {}):
            missing.append(key)
    return missing


class ConsentSignRequest(BaseModel):
    version: str = Field(..., min_length=1, max_length=40)
    method: str = Field("typed", max_length=20)  # typed | image
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None


class ConsentRevokeRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


@router.get("/")
async def list_consents(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    uid = user["uid"]
    role = (user.get("role") or "").lower()

    catalog = _catalog_by_key()
    carrier_id = _driver_primary_carrier_id(uid) if role == "driver" else None
    carrier_name = _carrier_name(carrier_id) if carrier_id else None
    sig_meta = _driver_signature_meta(uid) if role == "driver" else {"available": False, "path": None, "updated_at": None}
    if role == "driver" and (not sig_meta.get("available") or not sig_meta.get("path")):
        sig_meta = _sync_driver_signature_flag_from_user(uid)

    consents: List[Dict[str, Any]] = []
    for key, c in catalog.items():
        scope = str(c.get("scope") or "global").strip().lower()
        if scope == "per_carrier":
            state = {}
            if carrier_id:
                snap = _consent_doc_ref(uid, key, carrier_id=carrier_id).get()
                state = snap.to_dict() if getattr(snap, "exists", False) else {}
            signed = _is_signed(state or {})
            consents.append(
                {
                    "key": key,
                    "title": c.get("title"),
                    "category": c.get("category"),
                    "note": c.get("note"),
                    "version": c.get("version"),
                    "scope": "per_carrier",
                    "carrier_id": carrier_id,
                    "carrier_name": carrier_name,
                    "status": "Signed" if signed else "Unsigned",
                    "signed_at": state.get("signed_at"),
                    "signed_name": state.get("signed_name"),
                    "revoked_at": state.get("revoked_at"),
                    "consented_document_path": state.get("consented_document_path"),
                }
            )
        else:
            snap = _consent_doc_ref(uid, key).get()
            state = snap.to_dict() if getattr(snap, "exists", False) else {}
            signed = _is_signed(state or {})
            consents.append(
                {
                    "key": key,
                    "title": c.get("title"),
                    "category": c.get("category"),
                    "note": c.get("note"),
                    "version": c.get("version"),
                    "scope": "global",
                    "status": "Signed" if signed else ("Revoked" if state.get("revoked_at") else "Unsigned"),
                    "signed_at": state.get("signed_at"),
                    "signed_name": state.get("signed_name"),
                    "revoked_at": state.get("revoked_at"),
                    "consented_document_path": state.get("consented_document_path"),
                }
            )

    missing = get_user_missing_marketplace_consents(uid=uid, role=role)
    return {
        "consents": consents,
        "driver": {
            "carrier_id": carrier_id,
            "carrier_name": carrier_name,
            "esign_signature_image_available": bool(sig_meta.get("available") and sig_meta.get("path")),
        },
        "marketplace": {
            "eligible": len(missing) == 0,
            "missing_consents": missing,
        },
    }


@router.get("/marketplace-eligibility")
async def check_marketplace_eligibility(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    uid = user["uid"]
    role = (user.get("role") or "").lower()

    missing = get_user_missing_marketplace_consents(uid=uid, role=role)
    return {"eligible": len(missing) == 0, "missing_consents": missing}


def _safe_text(s: str) -> str:
        # Preserve printable characters but strip control chars.
        s = re.sub(r"[\x00-\x1F\x7F]", " ", s or "")
        return re.sub(r"\s+", " ", s).strip()


def _render_template_html(*, consent: Dict[str, Any], driver_name: str, driver_id: str, carrier_id: Optional[str], carrier_name: Optional[str]) -> str:
        title = _safe_text(str(consent.get("title") or "Document"))
        category = _safe_text(str(consent.get("category") or "Consent"))
        note = _safe_text(str(consent.get("note") or ""))
        version = _safe_text(str(consent.get("version") or "v1"))
        now_str = time.strftime("%Y-%m-%d")

        carrier_line = ""
        if carrier_id:
                carrier_line = f"<div><strong>Carrier:</strong> { _safe_text(carrier_name or carrier_id) }</div>"

        return f"""<!doctype html>
<html>
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>{title}</title>
        <style>
            body {{ font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111; margin: 0; }}
            .page {{ max-width: 900px; margin: 0 auto; padding: 28px 34px; }}
            .header {{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 18px; }}
            .brand {{ font-weight: 800; letter-spacing: 0.2px; }}
            .doc-title {{ font-size: 20px; font-weight: 800; margin: 0; }}
            .meta {{ font-size: 12px; line-height: 1.4; }}
            .meta div {{ margin: 2px 0; }}
            .section-title {{ margin-top: 18px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; }}
            .body {{ font-size: 13px; line-height: 1.65; }}
            .box {{ border: 1px solid #111; padding: 12px 14px; margin-top: 10px; }}
            .sig-row {{ display:flex; justify-content:space-between; gap: 18px; margin-top: 18px; }}
            .sig-col {{ flex:1; border-top: 1px solid #111; padding-top: 8px; }}
            .sig-label {{ font-size: 12px; }}
            .footnote {{ margin-top: 22px; border-top: 1px solid #cfcfcf; padding-top: 10px; font-size: 11px; color:#333; }}
        </style>
    </head>
    <body>
        <div class=\"page\">
            <div class=\"header\">
                <div>
                    <div class=\"brand\">FreightPower</div>
                    <div class=\"meta\">
                        <div><strong>Document Type:</strong> {category}</div>
                        <div><strong>Version:</strong> {version}</div>
                        <div><strong>Date:</strong> {now_str}</div>
                        <div><strong>Driver:</strong> {_safe_text(driver_name)} (UID: {_safe_text(driver_id)})</div>
                        {carrier_line}
                    </div>
                </div>
                <div>
                    <h1 class=\"doc-title\">{title}</h1>
                </div>
            </div>

            <div class=\"body\">
                <div class=\"section-title\">Summary</div>
                <div class=\"box\">{note or 'This document sets forth the terms of acknowledgement and consent for the selected category.'}</div>

                <div class=\"section-title\">Agreement</div>
                <p>
                    By signing this document, the Driver affirms that they have reviewed the contents, understand the obligations described,
                    and provide their consent/acknowledgement as applicable. This signature is intended to be legally binding.
                </p>
                <p>
                    The Driver understands that consent may be revoked (where permitted). If revoked, access to FreightPower marketplace features
                    may be restricted until required consents are reinstated.
                </p>

                <div class=\"section-title\">Signature</div>
                <div class=\"sig-row\">
                    <div class=\"sig-col\">
                        <div class=\"sig-label\"><strong>Driver Name (auto-filled):</strong> {_safe_text(driver_name)}</div>
                        <!-- SIGNATURE_BLOCK -->
                    </div>
                    <div class=\"sig-col\">
                        <div class=\"sig-label\"><strong>Date:</strong> {now_str}</div>
                    </div>
                </div>

                <div class=\"footnote\">
                    Footnote: This document is created by FreightPower-AI and is completely valid for use.
                </div>
            </div>
        </div>
    </body>
</html>"""


def _render_signed_html(
    *,
    consent: Dict[str, Any],
    driver_name: str,
    driver_id: str,
    carrier_id: Optional[str],
    carrier_name: Optional[str],
    method: str,
    signature_image_base64: Optional[str],
) -> str:
    html = _render_template_html(
        consent=consent,
        driver_name=driver_name,
        driver_id=driver_id,
        carrier_id=carrier_id,
        carrier_name=carrier_name,
    )

    if method == "image" and signature_image_base64:
        block = (
            "<div class=\"sig-label\" style=\"margin-top:10px;\">"
            "<strong>Signature:</strong><br/>"
            f"<img alt=\"signature\" src=\"data:image/png;base64,{signature_image_base64}\" style=\"max-width:340px; max-height:120px; margin-top:6px;\" />"
            "</div>"
        )
    else:
        safe = _safe_text(driver_name)
        block = (
            "<div class=\"sig-label\" style=\"margin-top:10px;\">"
            "<strong>Signature:</strong> "
            f"<span style=\"font-style:italic; font-size:18px;\">{safe}</span>"
            "</div>"
        )

    return html.replace("<!-- SIGNATURE_BLOCK -->", block)


def _store_consented_document_html(*, uid: str, consent_key: str, signed_at: float, html: str) -> str:
    safe_key = re.sub(r"[^a-z0-9._-]", "_", (consent_key or "document").lower())
    ts = str(int(signed_at))
    path = f"consented_documents/{uid}/{safe_key}/{ts}.html"
    blob = bucket.blob(path)
    blob.upload_from_string(html.encode("utf-8"), content_type="text/html; charset=utf-8")
    return path


def _create_in_app_notification(
    *,
    uid: str,
    notification_type: str,
    title: str,
    message: str,
    action_url: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a Firestore notification record (best-effort, never raises)."""

    try:
        now = int(time.time())
        notification_id = str(uuid.uuid4())
        payload: Dict[str, Any] = {
            "id": notification_id,
            "user_id": str(uid),
            "notification_type": str(notification_type or "notification"),
            "title": str(title or "Notification"),
            "message": str(message or ""),
            "resource_type": str(resource_type or "consent"),
            "resource_id": str(resource_id or "").strip() or None,
            "action_url": str(action_url or "").strip() or None,
            "is_read": False,
            "created_at": now,
        }
        if extra and isinstance(extra, dict):
            # Avoid clobbering required keys.
            for k, v in extra.items():
                if k in payload:
                    continue
                payload[k] = v

        db.collection("notifications").document(notification_id).set(payload)
        return payload
    except Exception:
        return {}


@router.get("/{consent_key}/template")
async def get_consent_template(
        consent_key: str,
        user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
        """Return a templated, market-style commercial document (HTML) for preview/signing."""
        uid = user["uid"]
        role = (user.get("role") or "").lower()
        if role != "driver":
                raise HTTPException(status_code=403, detail="Only drivers can access driver consent templates")

        catalog = _catalog_by_key()
        if consent_key not in catalog:
                raise HTTPException(status_code=404, detail="Unknown consent")

        consent = catalog[consent_key]
        carrier_id = _driver_primary_carrier_id(uid) if str(consent.get("scope") or "global").lower() == "per_carrier" else None
        carrier_name = _carrier_name(carrier_id) if carrier_id else None

        driver_name = str(user.get("name") or user.get("full_name") or user.get("email") or "Driver").strip() or "Driver"

        html = _render_template_html(
                consent=consent,
                driver_name=driver_name,
                driver_id=uid,
                carrier_id=carrier_id,
                carrier_name=carrier_name,
        )

        return {
                "key": consent_key,
                "title": consent.get("title"),
                "category": consent.get("category"),
                "note": consent.get("note"),
                "version": consent.get("version"),
                "scope": consent.get("scope") or "global",
                "driver": {"name": driver_name, "uid": uid},
                "carrier": {"carrier_id": carrier_id, "carrier_name": carrier_name},
                "html": html,
        }


@router.get("/signature-image")
async def signature_image_status(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    uid = user["uid"]
    meta = _driver_signature_meta(uid)
    if not meta.get("available") or not meta.get("path"):
        meta = _sync_driver_signature_flag_from_user(uid)
    path = str(meta.get("path") or "").strip() or None
    return {"exists": bool(meta.get("available") and path), "path": path}


@router.get("/signature-image/raw")
async def signature_image_raw(user: Dict[str, Any] = Depends(get_current_user)):
    uid = user["uid"]
    meta = _driver_signature_meta(uid)
    if not meta.get("available") or not meta.get("path"):
        meta = _sync_driver_signature_flag_from_user(uid)
    path = str(meta.get("path") or "").strip() or None
    if not path:
        raise HTTPException(status_code=404, detail="Signature image not found")

    try:
        blob = bucket.blob(path)
        content = blob.download_as_bytes()
        return Response(content=content, media_type="image/png")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signature image download failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load signature image")


@router.post("/signature-image")
async def upload_signature_image(
        file: UploadFile = File(...),
        user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    uid = user["uid"]

    filename = (file.filename or "").lower()
    content_type = (file.content_type or "").lower()
    if not (filename.endswith(".png") or content_type == "image/png"):
        raise HTTPException(status_code=400, detail="Only PNG images are allowed")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")

    path = f"signatures/{uid}/signature.png"
    try:
        blob = bucket.blob(path)
        blob.upload_from_string(data, content_type="image/png")
        # Do not make public; we serve via authenticated /raw endpoint.
        db.collection("users").document(uid).set(
            {"signature_image_path": path, "signature_image_updated_at": time.time()},
            merge=True,
        )

        now = time.time()
        db.collection("drivers").document(uid).set(
            {
                "esign_signature_image_available": True,
                "esign_signature_image_path": path,
                "esign_signature_image_updated_at": now,
                "updated_at": now,
            },
            merge=True,
        )
        log_action(uid, "SIGNATURE_IMAGE_UPLOADED", "Uploaded signature image")
        notif = _create_in_app_notification(
            uid=uid,
            notification_type="consent_signature_image_uploaded",
            title="Signature image uploaded",
            message="Your e-signature image was uploaded and is ready to be used for consent documents.",
            action_url="/driver-dashboard?nav=esign",
            resource_type="signature_image",
            resource_id=uid,
        )
        return {"ok": True, "path": path, "notification": notif or None}
    except Exception as e:
        print(f"Signature image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload signature image")


@router.get("/{consent_key}/signed-document")
async def get_signed_document(
    consent_key: str,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    uid = user["uid"]
    role = (user.get("role") or "").lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can access signed consent documents")

    catalog = _catalog_by_key()
    if consent_key not in catalog:
        raise HTTPException(status_code=404, detail="Unknown consent")

    meta = catalog[consent_key]
    scope = str(meta.get("scope") or "global").strip().lower()
    carrier_id: Optional[str] = None
    if scope == "per_carrier":
        carrier_id = _driver_primary_carrier_id(uid)
        if not carrier_id:
            raise HTTPException(status_code=409, detail="Driver has no associated carrier")

    snap = _consent_doc_ref(uid, consent_key, carrier_id=carrier_id).get()
    state = snap.to_dict() if getattr(snap, "exists", False) else {}
    path = str((state or {}).get("consented_document_path") or "").strip() or None
    if not path:
        raise HTTPException(status_code=404, detail="Signed document not found")

    try:
        blob = bucket.blob(path)
        html_bytes = blob.download_as_bytes()
        html = html_bytes.decode("utf-8", errors="replace")
    except Exception as e:
        print(f"Signed document download failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to load signed document")

    return {
        "ok": True,
        "consent_key": consent_key,
        "scope": scope,
        "carrier_id": carrier_id,
        "signed_at": (state or {}).get("signed_at"),
        "revoked_at": (state or {}).get("revoked_at"),
        "html": html,
    }


@router.post("/{consent_key}/sign")
async def sign_consent(
    consent_key: str,
    payload: ConsentSignRequest,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    uid = user["uid"]
    role = (user.get("role") or "").lower()

    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can sign driver consents")

    catalog = _catalog_by_key()
    if consent_key not in catalog:
        raise HTTPException(status_code=404, detail="Unknown consent")

    catalog_item = catalog[consent_key]
    expected_version = str(catalog_item.get("version") or "").strip()
    if payload.version != expected_version:
        raise HTTPException(status_code=409, detail="Consent version mismatch; please refresh")

    scope = str(catalog_item.get("scope") or "global").strip().lower()
    carrier_id: Optional[str] = None
    carrier_name: Optional[str] = None
    if scope == "per_carrier":
        carrier_id = _driver_primary_carrier_id(uid)
        if not carrier_id:
            raise HTTPException(status_code=409, detail="Driver has no associated carrier")
        carrier_name = _carrier_name(carrier_id)

    ref = _consent_doc_ref(uid, consent_key, carrier_id=carrier_id)
    snap = ref.get()
    existing = snap.to_dict() if getattr(snap, "exists", False) else {}
    if _is_signed(existing or {}):
        raise HTTPException(status_code=409, detail="Consent already signed")

    method = (payload.method or "typed").strip().lower()
    if method not in {"typed", "image"}:
        raise HTTPException(status_code=400, detail="Invalid signing method")

    signature_image_path: Optional[str] = None
    signature_image_base64: Optional[str] = None
    if method == "image":
        sig_meta = _driver_signature_meta(uid)
        if not sig_meta.get("available") or not sig_meta.get("path"):
            sig_meta = _sync_driver_signature_flag_from_user(uid)
        signature_image_path = str(sig_meta.get("path") or "").strip() or None
        if not signature_image_path:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "SIGNATURE_IMAGE_REQUIRED",
                    "message": "Signature image not found. Upload a PNG signature image first.",
                },
            )
        try:
            b = bucket.blob(signature_image_path).download_as_bytes()
            signature_image_base64 = base64.b64encode(b).decode("ascii")
        except Exception as e:
            print(f"Signature image read failed: {e}")
            raise HTTPException(status_code=500, detail="Failed to load signature image")

    user_agent = request.headers.get("user-agent")
    ip = request.headers.get("x-forwarded-for") or getattr(getattr(request, "client", None), "host", None)
    now = time.time()

    # Enforce driver name from DB (no manual entry).
    signed_name = str(user.get("name") or user.get("full_name") or user.get("email") or "Driver").strip() or "Driver"

    # Create a lightweight signature hash so we have an immutable-ish fingerprint
    # even if UI inputs evolve later.
    signature_fingerprint_src = f"{uid}|{consent_key}|{payload.version}|{signed_name}|{method}|{int(now)}"
    signature_hash = hashlib.sha256(signature_fingerprint_src.encode("utf-8")).hexdigest()

    # Store a signed copy of the consent document for future view/export/share.
    signed_html = _render_signed_html(
        consent=catalog_item,
        driver_name=signed_name,
        driver_id=uid,
        carrier_id=carrier_id,
        carrier_name=carrier_name,
        method=method,
        signature_image_base64=signature_image_base64,
    )
    try:
        consented_document_path = _store_consented_document_html(
            uid=uid,
            consent_key=consent_key,
            signed_at=now,
            html=signed_html,
        )
    except Exception as e:
        print(f"Consented document store failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to store signed document")

    doc = {
        "consent_key": consent_key,
        "title": catalog_item.get("title"),
        "version": payload.version,
        "signed_at": now,
        "signed_name": signed_name,
        "method": method,
        "signature_hash": signature_hash,
        "signature_image_path": signature_image_path,
        "consented_document_path": consented_document_path,
        "ip": ip,
        "user_agent": user_agent,
        "gps_lat": payload.gps_lat,
        "gps_lng": payload.gps_lng,
        "carrier_id": carrier_id,
        "carrier_name": carrier_name,
        "revoked_at": None,
        "updated_at": now,
    }

    ref.set(doc, merge=True)
    log_action(uid, "CONSENT_SIGNED", f"Signed consent: {consent_key} ({payload.version})")

    title = str(catalog_item.get("title") or consent_key)
    carrier_suffix = f" for {carrier_name or carrier_id}" if carrier_id else ""
    notif = _create_in_app_notification(
        uid=uid,
        notification_type="consent_signed",
        title=f"Consent signed: {title}",
        message=f"You signed \"{title}\"{carrier_suffix}.",
        action_url="/driver-dashboard?nav=esign",
        resource_type="consent",
        resource_id=consent_key,
        extra={"consent_key": consent_key, "carrier_id": carrier_id, "carrier_name": carrier_name},
    )

    return {"ok": True, "consent_key": consent_key, "signed_at": now, "notification": notif or None}


@router.post("/{consent_key}/revoke")
async def revoke_consent(
    consent_key: str,
    payload: ConsentRevokeRequest,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    uid = user["uid"]
    role = (user.get("role") or "").lower()
    if role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can revoke driver consents")

    catalog = _catalog_by_key()
    if consent_key not in catalog:
        raise HTTPException(status_code=404, detail="Unknown consent")

    meta = catalog[consent_key]
    scope = str(meta.get("scope") or "global").strip().lower()
    carrier_id: Optional[str] = None
    if scope == "per_carrier":
        carrier_id = _driver_primary_carrier_id(uid)
        if not carrier_id:
            raise HTTPException(status_code=409, detail="Driver has no associated carrier")

    ref = _consent_doc_ref(uid, consent_key, carrier_id=carrier_id)
    snap = ref.get()
    existing = snap.to_dict() if getattr(snap, "exists", False) else {}
    if not existing:
        raise HTTPException(status_code=404, detail="Consent not found")

    now = time.time()
    update = {
        "revoked_at": now,
        "revocation_reason": (payload.reason or "").strip() or None,
        "updated_at": now,
    }
    ref.set(update, merge=True)
    log_action(uid, "CONSENT_REVOKED", f"Revoked consent: {consent_key}")

    title = str(meta.get("title") or consent_key)
    carrier_suffix = ""
    if scope == "per_carrier":
        cname = _carrier_name(carrier_id) if carrier_id else None
        carrier_suffix = f" for {cname or carrier_id}" if carrier_id else ""

    notif = _create_in_app_notification(
        uid=uid,
        notification_type="consent_revoked",
        title=f"Consent revoked: {title}",
        message=f"You revoked \"{title}\"{carrier_suffix}. Marketplace access may be restricted until re-signed.",
        action_url="/driver-dashboard?nav=esign",
        resource_type="consent",
        resource_id=consent_key,
        extra={"consent_key": consent_key, "carrier_id": carrier_id},
    )

    return {"ok": True, "consent_key": consent_key, "revoked_at": now, "notification": notif or None}
