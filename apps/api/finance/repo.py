from __future__ import annotations

import time
import uuid
import json
import re
from typing import Any, Dict, List, Optional, Tuple
import io
import zipfile

import httpx

from firebase_admin import firestore

from ..database import db
from ..storage import ResponseStore
from .factoring_provider import get_provider
from .models import (
    FactoringSubmissionRecord,
    FactoringSubmissionStatus,
    InvoiceAttachment,
    InvoiceCreateRequest,
    InvoiceRecord,
    InvoiceStatus,
    PaymentCreateRequest,
    PaymentTransactionRecord,
    WebhookEventRecord,
)
from .state import InvoiceRequirements, assert_transition, required_docs_present


def _load_id(load: Dict[str, Any]) -> str:
    return str(load.get("load_id") or load.get("id") or "").strip()


def _is_carrier_assigned_to_load(load: Dict[str, Any], uid: str) -> bool:
    assigned = str(load.get("assigned_carrier") or load.get("assigned_carrier_id") or "").strip()
    if assigned:
        return assigned == uid
    # If the carrier created the load, treat it as theirs.
    return str(load.get("created_by") or "").strip() == uid and str(load.get("creator_role") or "").strip().lower() == "carrier"


def _load_payer_from_load(load: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    payer_uid = str(load.get("payer_uid") or "").strip() or None
    payer_role = str(load.get("payer_role") or "").strip().lower() or None
    if payer_uid and payer_role in {"shipper", "broker"}:
        return payer_uid, payer_role

    role = str(load.get("creator_role") or "").strip().lower()
    uid = str(load.get("created_by") or "").strip() or None
    if uid and role in {"shipper", "broker"}:
        return uid, role
    return None, None


def _invoice_exists_for_load(load_id: str) -> bool:
    try:
        snaps = list(db.collection("invoices").where("load_id", "==", load_id).limit(1).stream())
        return bool(snaps)
    except Exception:
        # If Firestore query fails, fall back to a conservative answer (allow creation).
        return False


def list_eligible_loads(*, user: Dict[str, Any], store: ResponseStore, limit: int = 200) -> List[Dict[str, Any]]:
    """Return delivered/completed loads eligible for invoicing by the current carrier.

    Eligibility (DAT-style):
    - load status is delivered or completed
    - load is assigned to this carrier (or created by this carrier)
    - no invoice exists yet for this load
    """
    uid = user["uid"]
    role = str(user.get("role") or "").strip().lower()
    if role != "carrier":
        raise ValueError("Only carriers can list eligible loads")

    candidates: Dict[str, Dict[str, Any]] = {}

    # Firestore candidates (best-effort).
    try:
        loads_ref = db.collection("loads")
        queries = [
            loads_ref.where("assigned_carrier", "==", uid),
            loads_ref.where("assigned_carrier_id", "==", uid),
            loads_ref.where("created_by", "==", uid),
        ]
        for q in queries:
            for snap in q.limit(int(limit)).stream():
                d = snap.to_dict() or {}
                d.setdefault("load_id", snap.id)
                lid = _load_id(d)
                if lid:
                    candidates[lid] = d
    except Exception:
        pass

    # Local store candidates.
    try:
        for l in store.list_loads({"created_by": uid}):
            lid = _load_id(l)
            if lid:
                candidates[lid] = l
        for l in store.list_loads({"assigned_carrier": uid}):
            lid = _load_id(l)
            if lid:
                candidates[lid] = l
    except Exception:
        pass

    out: List[Dict[str, Any]] = []
    for lid, load in candidates.items():
        status = str(load.get("status") or "").strip().lower()
        if status not in {"delivered", "completed"}:
            continue
        if not _is_carrier_assigned_to_load(load, uid):
            continue
        if _invoice_exists_for_load(lid):
            continue

        payment_terms_raw = load.get("payment_terms")
        payment_terms = (str(payment_terms_raw).strip() if payment_terms_raw is not None else None) or None
        terms_days: Optional[int] = None
        if payment_terms:
            try:
                terms_days = _validate_terms_days(_days_from_payment_terms(payment_terms))
            except Exception:
                terms_days = None

        out.append(
            {
                "load_id": lid,
                "load_number": load.get("load_number"),
                "status": status,
                "has_pod": bool(load.get("delivery_photo_url"))
                or any(
                    str(d.get("kind") or "").strip().upper() == "POD" and (d.get("url") or d.get("storage_path"))
                    for d in _load_linked_document_vault_docs(lid)
                ),
                "creator_role": load.get("creator_role"),
                "created_by": load.get("created_by"),
                "origin": load.get("origin"),
                "destination": load.get("destination"),
                "pickup_date": load.get("pickup_date"),
                "delivery_date": load.get("delivery_date"),

                "payment_terms": payment_terms,
                "terms_days": terms_days,
                "payment_done": False,
            }
        )

    # Sort newest-ish first using updated_at/created_at.
    out.sort(key=lambda l: float((candidates.get(l["load_id"], {}) or {}).get("updated_at") or (candidates.get(l["load_id"], {}) or {}).get("created_at") or 0.0), reverse=True)
    return out[: int(limit)]


def _now() -> float:
    return float(time.time())


def _days_from_payment_terms(payment_terms: Optional[str]) -> Optional[int]:
    """Parse payment terms string into days.

    Supports:
    - NET30/NET45/NET60 (and NET<1..120>)
    - "30 Days" / "45 Days" / "60 Days" (and any integer 1..120)
    - Back-compat: Quick Pay -> 2, 7 Days -> 7, 15 Days -> 15
    """

    if not payment_terms:
        return None
    raw = str(payment_terms).strip()
    if not raw:
        return None

    s = raw.strip().lower()

    # Back-compat keyword mapping.
    if "quick" in s:
        return 2

    # Normalize to parse NETxx and other variants.
    compact = re.sub(r"[^a-z0-9]+", "", s)
    if compact.startswith("net"):
        rest = compact[3:]
        if rest.isdigit():
            return int(rest)
        return None

    # Common human-friendly strings: "45 days" / "60" etc.
    m = re.search(r"\d+", s)
    if not m:
        return None
    try:
        return int(m.group(0))
    except Exception:
        return None


def _validate_terms_days(days: Optional[int]) -> Optional[int]:
    if days is None:
        return None
    try:
        d = int(days)
    except Exception:
        raise ValueError("Invalid payment terms")
    if d < 1 or d > 120:
        raise ValueError("Invalid payment terms: must be between 1 and 120 days")
    return d


def _terms_days_for_invoice(*, load: Dict[str, Any], invoice: Optional[InvoiceRecord] = None) -> Optional[int]:
    """Return validated terms days for due date computation.

    Priority:
    1) load.payment_terms
    2) invoice.metadata.terms_days (best-effort)
    """
    days = _days_from_payment_terms(load.get("payment_terms"))
    if days is None and invoice is not None:
        md = invoice.metadata if isinstance(invoice.metadata, dict) else {}
        days = md.get("terms_days")
    return _validate_terms_days(days)


def _generate_invoice_number() -> str:
    # Legacy fallback. Prefer _generate_invoice_number_for_load for new records.
    return f"INV-{uuid.uuid4().hex[:8].upper()}"


_INVOICE_NUMBER_ALLOWED = re.compile(r"[^A-Z0-9._-]+")


def _normalize_invoice_number(value: str) -> str:
    s = str(value or "").strip().upper()
    s = re.sub(r"\s+", "-", s)
    s = _INVOICE_NUMBER_ALLOWED.sub("-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def _uid_tag(uid: str) -> str:
    u = str(uid or "").strip().upper()
    if not u:
        return "U0000"
    # Stable tag that does not reveal the full uid.
    return "U" + (u[:4].ljust(4, "0"))


def _invoice_number_counter_ref():
    return db.collection("counters").document("invoice_number")


def _invoice_number_index_ref(invoice_number: str):
    return db.collection("invoice_number_index").document(str(invoice_number))


def _load_invoice_index_ref(load_id: str):
    return db.collection("load_invoice_index").document(str(load_id))


def _next_invoice_sequence() -> Optional[int]:
    """Return the next invoice sequence integer (best-effort)."""
    now = _now()
    ref = _invoice_number_counter_ref()

    if hasattr(db, "transaction"):
        try:
            @firestore.transactional
            def txn_next(txn: firestore.Transaction) -> int:
                snap = ref.get(transaction=txn)
                cur = 0
                if snap.exists:
                    d = snap.to_dict() or {}
                    try:
                        cur = int(d.get("value") or 0)
                    except Exception:
                        cur = 0
                nxt = cur + 1
                txn.set(ref, {"value": nxt, "updated_at": now}, merge=True)
                return nxt

            txn = db.transaction()
            return int(txn_next(txn))
        except Exception:
            return None
    return None


def _generate_invoice_number_for_load(*, load_number: Optional[str], load_id: str, issuer_uid: str, payer_uid: str) -> str:
    ln = str(load_number or "").strip().upper() or str(load_id or "").strip().upper()
    issuer_tag = _uid_tag(issuer_uid)
    payer_tag = _uid_tag(payer_uid)

    seq = _next_invoice_sequence()
    if seq is None:
        # No counter available (e.g. unit tests with fake db). Still include required fields.
        suffix = uuid.uuid4().hex[:6].upper()
        return _normalize_invoice_number(f"FP-INV-{ln}-{issuer_tag}-{payer_tag}-{suffix}")
    return _normalize_invoice_number(f"FP-INV-{ln}-{issuer_tag}-{payer_tag}-{seq:06d}")


def _invoice_number_exists(invoice_number: str) -> bool:
    n = _normalize_invoice_number(invoice_number)
    if not n:
        return False
    try:
        snaps = list(db.collection("invoices").where("invoice_number", "==", n).limit(1).stream())
        return bool(snaps)
    except Exception:
        return False


def _invoice_doc_ref(invoice_id: str):
    return db.collection("invoices").document(invoice_id)


def _submission_doc_ref(submission_id: str):
    return db.collection("factoring_submissions").document(submission_id)


def _event_doc_ref(provider: str, event_id: str):
    key = f"{provider}:{event_id}"
    return db.collection("factoring_webhook_events").document(key)


def _payment_doc_ref(payment_id: str):
    return db.collection("payment_transactions").document(payment_id)


def _load_from_sources(load_id: str, store: ResponseStore) -> Optional[Dict[str, Any]]:
    # Prefer Firestore, fallback to JSON store.
    try:
        snap = db.collection("loads").document(load_id).get()
        if snap.exists:
            d = snap.to_dict() or {}
            d["load_id"] = snap.id
            # If the Firestore doc is partial (e.g., created via merge patch),
            # enrich from local store so business rules still have required fields.
            store_copy = store.get_load(load_id) or {}
            if isinstance(store_copy, dict) and (not d.get("status") or not d.get("creator_role") or not d.get("created_by")):
                merged = dict(store_copy)
                merged.update(d)
                return merged
            return d
    except Exception:
        pass
    return store.get_load(load_id)


def _safe_get_doc(collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
    if not doc_id:
        return None
    try:
        snap = db.collection(collection).document(str(doc_id)).get()
        if not snap.exists:
            return None
        d = snap.to_dict() or {}
        # Make sure id fields are present for UI convenience
        d.setdefault("id", snap.id)
        d.setdefault(f"{collection[:-1]}_id", snap.id)
        return d
    except Exception:
        return None


def _extract_address(data: Dict[str, Any]) -> Optional[str]:
    if not isinstance(data, dict):
        return None

    # Common direct fields
    direct = data.get("address") or data.get("company_address") or data.get("business_address")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    # Structured address fields
    parts = [
        data.get("street"),
        data.get("street1"),
        data.get("street2"),
        data.get("city"),
        data.get("state"),
        data.get("zip"),
        data.get("postal_code"),
        data.get("country"),
    ]
    parts = [str(p).strip() for p in parts if p]
    if parts:
        return ", ".join(dict.fromkeys(parts))

    # onboarding_data sometimes stores nested company/contact info
    onboarding = data.get("onboarding_data")
    if isinstance(onboarding, str):
        try:
            onboarding = json.loads(onboarding)
        except Exception:
            onboarding = None
    if isinstance(onboarding, dict):
        company = onboarding.get("company") if isinstance(onboarding.get("company"), dict) else {}
        addr = company.get("address") or company.get("company_address")
        if isinstance(addr, str) and addr.strip():
            return addr.strip()
    return None


def _build_party_profile(uid: str) -> Dict[str, Any]:
    """Build a stable profile dict for PDF generation (best-effort)."""
    user_doc = _safe_get_doc("users", uid) or {}
    role = str(user_doc.get("role") or "").strip().lower()
    carrier_doc = _safe_get_doc("carriers", uid) if role == "carrier" else None
    driver_doc = _safe_get_doc("drivers", uid) if role == "driver" else None

    merged: Dict[str, Any] = {}
    if carrier_doc:
        merged.update(carrier_doc)
    if driver_doc:
        merged.update(driver_doc)
    merged.update(user_doc)

    return {
        "uid": uid,
        "role": role or None,
        "company_name": merged.get("company_name") or merged.get("name") or merged.get("company") or merged.get("business_name"),
        "name": merged.get("name") or merged.get("company_name"),
        "email": merged.get("email"),
        "phone": merged.get("phone"),
        "address": _extract_address(merged),
        "dot_number": merged.get("dot_number") or merged.get("usdot") or merged.get("dot"),
        "mc_number": merged.get("mc_number") or merged.get("mc"),
    }


def get_invoice_pdf_context(*, invoice_id: str, user: Dict[str, Any], store: ResponseStore) -> Dict[str, Any]:
    """Return Firestore-backed context for rendering an invoice PDF."""
    inv = get_invoice(invoice_id=invoice_id)
    uid = str(user.get("uid") or "")
    role = str(user.get("role") or "").strip().lower()

    if role not in {"admin", "super_admin"} and uid not in {inv.issuer_uid, inv.payer_uid}:
        raise ValueError("Not authorized")

    load = _load_from_sources(inv.load_id, store) or {}
    load_id = str(load.get("load_id") or load.get("id") or inv.load_id or "")
    if load_id:
        load["load_id"] = load_id

    # Assigned driver best-effort
    driver_uid = (
        str(load.get("assigned_driver") or load.get("assigned_driver_id") or load.get("driver_id") or "").strip()
    )

    ctx: Dict[str, Any] = {
        "invoice": inv.model_dump(mode="json"),
        "carrier": _build_party_profile(inv.issuer_uid),
        "shipper": _build_party_profile(inv.payer_uid),
        "load": load,
        "driver": (_build_party_profile(driver_uid) if driver_uid else None),
    }
    return ctx


def _parse_onboarding_documents(onboarding_data_str: Any) -> List[Dict[str, Any]]:
    """Parse the user's onboarding_data JSON and return the documents array.

    Stored format is a JSON string in users/{uid}.onboarding_data.
    """
    if not onboarding_data_str:
        return []
    if isinstance(onboarding_data_str, dict):
        data = onboarding_data_str
    elif isinstance(onboarding_data_str, str):
        try:
            data = json.loads(onboarding_data_str)
        except Exception:
            return []
    else:
        return []

    if not isinstance(data, dict):
        return []
    docs = data.get("documents")
    if not isinstance(docs, list):
        return []
    out: List[Dict[str, Any]] = []
    for d in docs:
        if isinstance(d, dict):
            out.append(d)
    return out


def _user_document_vault_docs(uid: str) -> List[Dict[str, Any]]:
    """Fetch the user's document vault docs (best-effort)."""
    try:
        snap = db.collection("users").document(uid).get()
        if not snap.exists:
            return []
        data = snap.to_dict() or {}
        return _parse_onboarding_documents(data.get("onboarding_data"))
    except Exception:
        return []


def _doc_type_from_vault_doc(doc: Dict[str, Any]) -> str:
    # Primary: extracted_fields.document_type, fallback: doc_type.
    extracted = doc.get("extracted_fields") if isinstance(doc.get("extracted_fields"), dict) else {}
    dt = extracted.get("document_type") or doc.get("doc_type") or ""
    return str(dt).strip().upper()


def _vault_doc_to_attachment(doc: Dict[str, Any], kind: str) -> InvoiceAttachment:
    return InvoiceAttachment(
        kind=kind,
        url=(doc.get("download_url") or None),
        document_id=(doc.get("doc_id") or doc.get("id") or None),
        filename=(doc.get("filename") or None),
        metadata={
            "source": "document_vault",
            "uploaded_at": doc.get("uploaded_at"),
            "storage_path": doc.get("storage_path"),
        },
    )


def _maybe_expand_document_id_attachments(uid: str, attachments: List[InvoiceAttachment]) -> List[InvoiceAttachment]:
    """If caller passes attachments with document_id but missing url/filename, fill from vault."""
    needs_lookup = [a for a in attachments if (a.document_id and (not a.url or not a.filename))]
    if not needs_lookup:
        return attachments

    vault_docs = _user_document_vault_docs(uid)
    by_id: Dict[str, Dict[str, Any]] = {}
    for d in vault_docs:
        did = d.get("doc_id") or d.get("id")
        if did:
            by_id[str(did)] = d

    out: List[InvoiceAttachment] = []
    for a in attachments:
        if a.document_id and str(a.document_id) in by_id:
            d = by_id[str(a.document_id)]
            # Prefer explicitly provided kind, else infer from vault doc type.
            inferred_kind = _doc_type_from_vault_doc(d) or (a.kind or "OTHER")
            out.append(
                InvoiceAttachment(
                    kind=(a.kind or inferred_kind),
                    url=(a.url or d.get("download_url") or None),
                    document_id=a.document_id,
                    filename=(a.filename or d.get("filename") or None),
                    metadata={
                        **(a.metadata or {}),
                        "source": (a.metadata or {}).get("source") or "document_vault",
                        "storage_path": d.get("storage_path"),
                        "uploaded_at": d.get("uploaded_at"),
                    },
                )
            )
        else:
            out.append(a)
    return out


def _load_linked_document_vault_docs(load_id: str) -> List[Dict[str, Any]]:
    """Return load-linked documents from Firestore (best-effort).

    Schema: loads/{load_id}/documents/{doc_id}
    """
    load_id = str(load_id or "").strip()
    if not load_id:
        return []
    try:
        snaps = list(db.collection("loads").document(load_id).collection("documents").stream())
        out = []
        for s in snaps:
            d = s.to_dict() or {}
            d.setdefault("doc_id", s.id)
            d.setdefault("load_id", load_id)
            out.append(d)
        # newest first
        out.sort(key=lambda d: float(d.get("uploaded_at") or d.get("created_at") or 0.0), reverse=True)
        return out
    except Exception:
        return []


_INVOICE_LOAD_DOC_KINDS = {"POD", "BOL", "RATE_CONFIRMATION"}


def _load_linked_document_attachments_for_invoice(load_id: str) -> List[InvoiceAttachment]:
    """Return load-linked docs as invoice attachments.

    Only documents under loads/{load_id}/documents are eligible for the core
    invoicing attachments (POD/BOL/RATE_CONFIRMATION).
    """
    out: List[InvoiceAttachment] = []
    for d in _load_linked_document_vault_docs(load_id):
        kind = str(d.get("kind") or "").strip().upper()
        if kind not in _INVOICE_LOAD_DOC_KINDS:
            continue
        url = d.get("url") or None
        if not url:
            continue
        doc_id = d.get("doc_id") or d.get("id") or None
        out.append(
            InvoiceAttachment(
                kind=kind,
                url=str(url),
                filename=(d.get("filename") or None),
                document_id=(str(doc_id) if doc_id else None),
                metadata={
                    "source": "load_document_vault",
                    "load_id": str(load_id),
                    "load_document_id": (str(doc_id) if doc_id else None),
                    "uploaded_at": d.get("uploaded_at") or d.get("created_at"),
                    "storage_path": d.get("storage_path"),
                },
            )
        )

    # De-dupe by (kind,url)
    seen = set()
    deduped: List[InvoiceAttachment] = []
    for a in out:
        key = (str(a.kind or "").strip().upper(), str(a.url or "").strip())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(a)
    return deduped


def _apply_load_linked_doc_policy(
    *,
    load_id: str,
    attachments: List[InvoiceAttachment],
    require_pod: bool,
    error_context: str,
) -> List[InvoiceAttachment]:
    """Enforce that POD/BOL/RATE_CONFIRMATION attachments come only from load docs."""
    load_id = str(load_id or "").strip()
    keep: List[InvoiceAttachment] = []
    for a in list(attachments or []):
        kind = str(a.kind or "").strip().upper()
        if kind in _INVOICE_LOAD_DOC_KINDS:
            continue
        keep.append(a)

    load_atts = _load_linked_document_attachments_for_invoice(load_id)
    if require_pod and not any((a.kind or "").strip().upper() == "POD" for a in load_atts):
        raise ValueError(f"Missing required documents (POD) linked to this load to {error_context}")

    return [*keep, *load_atts]


def _maybe_auto_attach_from_vault(uid: str, attachments: List[InvoiceAttachment], load_id: Optional[str] = None) -> List[InvoiceAttachment]:
    """Auto-attach latest POD/BOL from vault (best-effort).

    Priority:
    1) Load-linked vault (loads/{load_id}/documents)
    2) User onboarding vault (/documents)

    This is a fallback when load-level POD photo isn't present.
    """
    have = {str(a.kind or "").strip().upper() for a in attachments}
    if "POD" in have and "BOL" in have:
        return attachments

    load_docs = _load_linked_document_vault_docs(str(load_id or "").strip()) if load_id else []

    user_docs = _user_document_vault_docs(uid)
    # newest first
    user_docs.sort(key=lambda d: float(d.get("uploaded_at") or 0.0), reverse=True)

    def pick(doc_type: str) -> Optional[Dict[str, Any]]:
        for d in load_docs:
            if str(d.get("kind") or "").strip().upper() == doc_type and (d.get("url") or d.get("storage_path")):
                return {
                    "doc_id": d.get("doc_id") or d.get("id"),
                    "filename": d.get("filename"),
                    "download_url": d.get("url"),
                    "storage_path": d.get("storage_path"),
                    "uploaded_at": d.get("uploaded_at") or d.get("created_at"),
                    "type": doc_type,
                }

        for d in user_docs:
            if _doc_type_from_vault_doc(d) == doc_type and (d.get("download_url") or d.get("storage_path")):
                return d
        return None

    out = list(attachments)
    if "POD" not in have:
        d = pick("POD")
        if d:
            out.append(_vault_doc_to_attachment(d, "POD"))
    if "BOL" not in have:
        d = pick("BOL")
        if d:
            out.append(_vault_doc_to_attachment(d, "BOL"))
    return out


def create_invoice(*, request: InvoiceCreateRequest, user: Dict[str, Any], store: ResponseStore) -> InvoiceRecord:
    uid = user["uid"]
    role = str(user.get("role") or "").strip().lower()
    if role != "carrier":
        raise ValueError("Only carriers can create invoices")

    load = _load_from_sources(request.load_id, store)
    if not load:
        raise ValueError("Load not found")

    load_status = str(load.get("status") or "").lower()
    if load_status not in {"delivered", "completed"}:
        raise ValueError("Invoice can only be created for delivered/completed loads")

    if not _is_carrier_assigned_to_load(load, uid):
        raise ValueError("Invoice can only be created for loads assigned to this carrier")

    # Prevent multiple invoices per load.
    if _invoice_exists_for_load(request.load_id):
        raise ValueError("An invoice already exists for this load")

    payer_uid, payer_role = None, None
    if request.payer_uid:
        payer_uid = str(request.payer_uid)
        payer_role = str(request.payer_role or "").strip().lower() or None
    else:
        payer_uid, payer_role = _load_payer_from_load(load)

    if not payer_uid or not payer_role:
        raise ValueError("payer_uid/payer_role must be provided (load creator is not a shipper/broker)")
    if payer_role not in {"shipper", "broker"}:
        raise ValueError("payer_role must be shipper or broker")

    if not payer_uid:
        raise ValueError("payer_uid could not be determined")

    invoice_id = str(uuid.uuid4())
    load_number = (load.get("load_number") or None)

    if request.invoice_number:
        invoice_number = _normalize_invoice_number(request.invoice_number)
        if not invoice_number:
            raise ValueError("invoice_number is invalid")
        # Client requirement: include load_number when we have it.
        if load_number and str(load_number).upper() not in invoice_number:
            raise ValueError("invoice_number must include load_number")
        if _invoice_number_exists(invoice_number):
            raise ValueError("invoice_number must be unique")
    else:
        invoice_number = _generate_invoice_number_for_load(
            load_number=(str(load_number) if load_number else None),
            load_id=request.load_id,
            issuer_uid=uid,
            payer_uid=payer_uid,
        )

    now = _now()

    payment_terms_raw = load.get("payment_terms")
    terms_days: Optional[int] = None
    if request.due_in_days is not None:
        terms_days = _validate_terms_days(request.due_in_days)
    else:
        terms_days = _validate_terms_days(_days_from_payment_terms(payment_terms_raw))

    due_date = float(request.due_date) if request.due_date is not None else None

    attachments: List[InvoiceAttachment] = list(request.attachments or [])
    # If caller referenced document vault doc_ids, fill URL/filename best-effort.
    attachments = _maybe_expand_document_id_attachments(uid, attachments)

    # DAT-style rule: POD required to issue/send the invoice.
    # Draft invoices can be created without POD; they must be issued later.
    is_draft = bool(getattr(request, "save_as_draft", False))
    # Enforce that invoicing-required documents come ONLY from load-linked docs.
    attachments = _apply_load_linked_doc_policy(
        load_id=request.load_id,
        attachments=attachments,
        require_pod=(not is_draft),
        error_context="issue invoice",
    )

    if not is_draft:
        if not required_docs_present([a.model_dump() for a in attachments], InvoiceRequirements(require_pod=True, require_bol=False)):
            raise ValueError("Missing required documents (POD) for invoice issuance")

    record = InvoiceRecord(
        invoice_id=invoice_id,
        invoice_number=invoice_number,
        load_id=request.load_id,
        load_number=(str(load_number) if load_number else None),
        issuer_uid=uid,
        issuer_role=role,
        payer_uid=payer_uid,
        payer_role=payer_role,
        status=(InvoiceStatus.DRAFT if is_draft else InvoiceStatus.ISSUED),
        amount_total=float(request.amount_total),
        amount_paid=0.0,
        currency=request.currency,
        due_date=due_date,
        issued_at=(None if is_draft else now),
        sent_at=None,
        disputed_at=None,
        disputed_by_uid=None,
        dispute_reason=None,
        paid_at=None,
        overdue_at=None,
        voided_at=None,
        factoring_enabled=bool(request.factoring_enabled),
        factoring_provider=(request.factoring_provider or None),
        factoring_submission_id=None,
        attachments=attachments,
        notes=request.notes,
        created_at=now,
        updated_at=now,
        metadata={
            **dict(getattr(request, "metadata", None) or {}),
            "payment_terms": (str(payment_terms_raw).strip() if payment_terms_raw is not None else None),
            "terms_days": terms_days,
        },
    )

    # Enforce uniqueness (invoice_number + one invoice per load) transactionally when supported.
    if hasattr(db, "transaction"):
        try:
            inv_ref = _invoice_doc_ref(invoice_id)
            num_ref = _invoice_number_index_ref(invoice_number)
            load_ref = _load_invoice_index_ref(request.load_id)

            @firestore.transactional
            def txn_create(txn: firestore.Transaction) -> None:
                if num_ref.get(transaction=txn).exists:
                    raise ValueError("invoice_number must be unique")
                if load_ref.get(transaction=txn).exists:
                    raise ValueError("An invoice already exists for this load")
                txn.set(inv_ref, record.model_dump(mode="json"), merge=True)
                txn.set(
                    num_ref,
                    {
                        "invoice_id": invoice_id,
                        "invoice_number": invoice_number,
                        "load_id": request.load_id,
                        "load_number": (str(load_number) if load_number else None),
                        "issuer_uid": uid,
                        "payer_uid": payer_uid,
                        "created_at": now,
                    },
                    merge=True,
                )
                txn.set(
                    load_ref,
                    {
                        "invoice_id": invoice_id,
                        "invoice_number": invoice_number,
                        "created_at": now,
                    },
                    merge=True,
                )

            txn = db.transaction()
            txn_create(txn)
        except ValueError:
            raise
        except Exception:
            # Fallback when Firestore transactions/indexing aren't available.
            if _invoice_number_exists(invoice_number):
                raise ValueError("invoice_number must be unique")
            if _invoice_exists_for_load(request.load_id):
                raise ValueError("An invoice already exists for this load")
            _invoice_doc_ref(invoice_id).set(record.model_dump(mode="json"), merge=True)
    else:
        # Unit tests and fallback stores.
        if _invoice_number_exists(invoice_number):
            raise ValueError("invoice_number must be unique")
        if _invoice_exists_for_load(request.load_id):
            raise ValueError("An invoice already exists for this load")
        _invoice_doc_ref(invoice_id).set(record.model_dump(mode="json"), merge=True)

    # Best-effort: write invoice_number back to load for UI convenience.
    try:
        db.collection("loads").document(request.load_id).set(
            {"invoice_id": invoice_id, "invoice_number": invoice_number, "load_number": (str(load_number) if load_number else None), "invoiced_at": now, "updated_at": now},
            merge=True,
        )
    except Exception:
        pass
    try:
        store.update_load(request.load_id, {"invoice_id": invoice_id, "invoice_number": invoice_number, "invoiced_at": now, "updated_at": now})
    except Exception:
        pass

    return record


def list_invoices_for_user(*, user: Dict[str, Any], limit: int = 200) -> List[InvoiceRecord]:
    uid = user["uid"]
    role = str(user.get("role") or "")

    col = db.collection("invoices")

    snaps = []
    if role in {"carrier", "driver"}:
        snaps = list(col.where("issuer_uid", "==", uid).limit(int(limit)).stream())
    elif role in {"shipper"}:
        snaps = list(col.where("payer_uid", "==", uid).limit(int(limit)).stream())
    elif role in {"broker"}:
        # Firestore has no OR; merge both sides.
        a = list(col.where("issuer_uid", "==", uid).limit(int(limit)).stream())
        b = list(col.where("payer_uid", "==", uid).limit(int(limit)).stream())
        seen = set()
        for s in a + b:
            if s.id in seen:
                continue
            snaps.append(s)
            seen.add(s.id)
    else:
        # Admin/super_admin: return latest
        snaps = list(col.limit(int(limit)).stream())

    out: List[InvoiceRecord] = []
    for s in snaps:
        d = s.to_dict() or {}
        d.setdefault("invoice_id", s.id)
        out.append(InvoiceRecord(**d))

    # Sort by created_at desc (best-effort).
    out.sort(key=lambda r: float(r.created_at or 0), reverse=True)
    return out


def list_invoices_for_payer(
    *,
    user: Dict[str, Any],
    limit: int = 200,
    status: Optional[str] = None,
    date_from: Optional[float] = None,
    date_to: Optional[float] = None,
    overdue_only: bool = False,
) -> List[InvoiceRecord]:
    """Return invoices visible in the payer portal.

    Scope: invoices where payer_uid == current_user.uid.
    Filters:
    - status: exact match (case-insensitive)
    - date_from/date_to: filters on the most relevant timestamp for the payer view
      (sent_at, else issued_at, else created_at)
    - overdue_only: include only invoices past due (computed if status isn't already overdue)
    """
    uid = str(user.get("uid") or "").strip()
    role = str(user.get("role") or "").strip().lower()
    if not uid:
        return []
    if role not in {"shipper", "broker", "admin", "super_admin"}:
        raise ValueError("Only payers can list payer invoices")

    col = db.collection("invoices")
    # Firestore: query by payer_uid then filter locally for everything else.
    snaps = list(col.where("payer_uid", "==", uid).limit(int(limit)).stream())

    want_status = str(status or "").strip().lower() or None
    now = _now()

    out: List[InvoiceRecord] = []
    for s in snaps:
        d = s.to_dict() or {}
        d.setdefault("invoice_id", s.id)
        inv = InvoiceRecord(**d)

        if want_status and str(inv.status or "").strip().lower() != want_status:
            continue

        t = float(inv.sent_at or inv.issued_at or inv.created_at or 0.0)
        if date_from is not None and t < float(date_from):
            continue
        if date_to is not None and t > float(date_to):
            continue

        if overdue_only:
            due = inv.due_date
            if not due:
                continue
            if float(due) >= now:
                continue
            st = str(inv.status or "").strip().lower()
            if st in {InvoiceStatus.PAID.value, InvoiceStatus.VOID.value}:
                continue

        out.append(inv)

    # newest-ish first
    out.sort(key=lambda r: float(r.sent_at or r.issued_at or r.created_at or 0.0), reverse=True)
    return out[: int(limit)]


def get_invoice(*, invoice_id: str) -> InvoiceRecord:
    snap = _invoice_doc_ref(invoice_id).get()
    if not snap.exists:
        raise ValueError("Invoice not found")
    d = snap.to_dict() or {}
    d.setdefault("invoice_id", snap.id)
    return InvoiceRecord(**d)


def _update_invoice_status(*, invoice_id: str, new_status: InvoiceStatus, now: float, extra: Dict[str, Any] | None = None) -> InvoiceRecord:
    ref = _invoice_doc_ref(invoice_id)

    @firestore.transactional
    def txn_update(txn: firestore.Transaction) -> Dict[str, Any]:
        snap = ref.get(transaction=txn)
        if not snap.exists:
            raise ValueError("Invoice not found")
        current = snap.to_dict() or {}
        cur_status = InvoiceStatus(str(current.get("status") or InvoiceStatus.DRAFT.value))
        assert_transition(cur_status, new_status)

        patch: Dict[str, Any] = {"status": new_status.value, "updated_at": now}
        if new_status == InvoiceStatus.SENT:
            patch["sent_at"] = now
        if new_status == InvoiceStatus.OVERDUE:
            patch["overdue_at"] = now
        if new_status == InvoiceStatus.VOID:
            patch["voided_at"] = now

        if extra:
            patch.update(extra)

        txn.set(ref, patch, merge=True)
        updated = dict(current)
        updated.update(patch)
        updated.setdefault("invoice_id", invoice_id)
        return updated

    txn = db.transaction()
    updated = txn_update(txn)
    return InvoiceRecord(**updated)


def send_invoice(*, invoice_id: str, user: Dict[str, Any]) -> InvoiceRecord:
    raise ValueError("send_invoice requires store; use send_invoice_with_store")


def send_invoice_with_store(*, invoice_id: str, user: Dict[str, Any], store: ResponseStore) -> InvoiceRecord:
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    role = str(user.get("role") or "").strip().lower()
    if inv.issuer_uid != uid and role not in {"admin", "super_admin"}:
        raise ValueError("Not authorized to send this invoice")

    # If draft, issue first (keeps state machine intact).
    if inv.status == InvoiceStatus.DRAFT:
        inv = issue_invoice(invoice_id=invoice_id, user=user, store=store)

    load = _load_from_sources(inv.load_id, store) or {}

    attachments: List[InvoiceAttachment] = list(inv.attachments or [])
    attachments = _maybe_expand_document_id_attachments(inv.issuer_uid, attachments)

    # Enforce load-linked-only policy for required invoicing docs.
    attachments = _apply_load_linked_doc_policy(
        load_id=inv.load_id,
        attachments=attachments,
        require_pod=True,
        error_context="send invoice",
    )

    # Enforce POD presence before sending.
    if not required_docs_present([a.model_dump() for a in attachments], InvoiceRequirements(require_pod=True, require_bol=False)):
        raise ValueError("Missing required documents (POD) to send invoice")

    now = _now()
    terms_days = _terms_days_for_invoice(load=load, invoice=inv)
    due_date = (now + float(terms_days) * 86400.0) if terms_days is not None else (inv.due_date or None)

    metadata = dict(inv.metadata or {})
    metadata["payment_terms"] = (str(load.get("payment_terms")).strip() if load.get("payment_terms") is not None else metadata.get("payment_terms"))
    metadata["terms_days"] = terms_days

    return _update_invoice_status(
        invoice_id=invoice_id,
        new_status=InvoiceStatus.SENT,
        now=now,
        extra={
            "attachments": [a.model_dump(mode="json") for a in attachments],
            "sent_at": now,
            "due_date": due_date,
            "metadata": metadata,
        },
    )


def dispute_invoice(*, invoice_id: str, user: Dict[str, Any], reason: str, message: Optional[str] = None) -> InvoiceRecord:
    inv = get_invoice(invoice_id=invoice_id)
    uid = str(user.get("uid") or "")
    role = str(user.get("role") or "").strip().lower()

    if role not in {"admin", "super_admin"} and uid != inv.payer_uid:
        raise ValueError("Not authorized to dispute this invoice")

    now = _now()
    dispute_reason = str(reason or "").strip()
    if not dispute_reason:
        raise ValueError("reason is required")

    metadata = dict(inv.metadata or {})
    metadata["dispute"] = {
        "reason": dispute_reason,
        "message": (str(message).strip() if message else None),
        "created_at": now,
        "created_by_uid": uid,
        "created_by_role": role,
    }

    return _update_invoice_status(
        invoice_id=invoice_id,
        new_status=InvoiceStatus.DISPUTED,
        now=now,
        extra={
            "disputed_at": now,
            "disputed_by_uid": uid,
            "dispute_reason": dispute_reason,
            "metadata": metadata,
        },
    )


def resolve_dispute(*, invoice_id: str, user: Dict[str, Any], message: Optional[str] = None) -> InvoiceRecord:
    inv = get_invoice(invoice_id=invoice_id)
    uid = str(user.get("uid") or "")
    role = str(user.get("role") or "").strip().lower()

    if role not in {"admin", "super_admin"} and uid != inv.issuer_uid:
        raise ValueError("Not authorized to resolve this dispute")
    if inv.status != InvoiceStatus.DISPUTED:
        raise ValueError("Invoice is not disputed")

    now = _now()
    metadata = dict(inv.metadata or {})
    dispute = dict(metadata.get("dispute") or {}) if isinstance(metadata.get("dispute"), dict) else {}
    dispute["resolved_at"] = now
    dispute["resolved_by_uid"] = uid
    dispute["resolved_by_role"] = role
    if message:
        dispute["resolution_message"] = str(message).strip()
    metadata["dispute"] = dispute

    # Resolution returns invoice to SENT (payer sees it again as payable).
    return _update_invoice_status(
        invoice_id=invoice_id,
        new_status=InvoiceStatus.SENT,
        now=now,
        extra={"metadata": metadata},
    )


def _download_bytes(url: str) -> Tuple[Optional[bytes], Optional[str], Optional[str]]:
    """Best-effort HTTP download. Returns (bytes, content_type, filename_guess)."""
    u = str(url or "").strip()
    if not u:
        return None, None, None
    try:
        r = httpx.get(u, timeout=15.0, follow_redirects=True)
        if r.status_code >= 400:
            return None, None, None
        ct = r.headers.get("content-type")
        name = None
        # naive filename guess from url path
        try:
            name = u.split("?")[0].split("/")[-1] or None
        except Exception:
            name = None
        return bytes(r.content), (ct or None), name
    except Exception:
        return None, None, None


def build_invoice_package_zip(*, invoice_id: str, user: Dict[str, Any], store: ResponseStore) -> Tuple[bytes, str]:
    inv = get_invoice(invoice_id=invoice_id)
    uid = str(user.get("uid") or "")
    role = str(user.get("role") or "").strip().lower()
    if role not in {"admin", "super_admin"} and uid not in {inv.issuer_uid, inv.payer_uid}:
        raise ValueError("Not authorized")

    load = _load_from_sources(inv.load_id, store) or {}
    load_id = str(load.get("load_id") or inv.load_id or "")
    load_number = str(load.get("load_number") or inv.load_number or "").strip()

    # Collect documents:
    # - Non-core invoice attachments are included as-is.
    # - Core invoicing docs (POD/BOL/RATE_CONFIRMATION) are sourced ONLY from the load-linked document vault.
    docs: List[Dict[str, Any]] = []

    for a in list(inv.attachments or []):
        k = str(a.kind or "OTHER").strip().upper()
        if k in _INVOICE_LOAD_DOC_KINDS:
            continue
        docs.append(
            {
                "kind": k,
                "url": a.url,
                "filename": a.filename,
                "document_id": a.document_id,
                "source": (a.metadata or {}).get("source") or "invoice_attachment",
            }
        )

    for d in _load_linked_document_vault_docs(load_id):
        k = str(d.get("kind") or "").strip().upper()
        if k not in _INVOICE_LOAD_DOC_KINDS:
            continue
        url = d.get("url") or None
        if not url:
            continue
        docs.append(
            {
                "kind": k,
                "url": str(url),
                "filename": d.get("filename"),
                "document_id": (d.get("doc_id") or d.get("id")),
                "source": "load_document_vault",
            }
        )

    if not any(str(d.get("kind") or "").strip().upper() == "POD" for d in docs):
        raise ValueError("Missing required documents (POD) linked to this load to build invoice package")

    # De-dupe by (kind,url)
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for d in docs:
        key = (d.get("kind"), d.get("url"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(d)

    manifest = {
        "invoice_id": inv.invoice_id,
        "invoice_number": inv.invoice_number,
        "load_id": inv.load_id,
        "load_number": load_number or None,
        "generated_at": _now(),
        "documents": deduped,
    }

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as z:
        z.writestr("invoice.json", json.dumps(inv.model_dump(mode="json"), indent=2))
        z.writestr("load.json", json.dumps(load, indent=2, default=str))
        z.writestr("manifest.json", json.dumps(manifest, indent=2))

        for i, d in enumerate(deduped, start=1):
            url = d.get("url")
            content, _ct, guessed = _download_bytes(url) if url else (None, None, None)
            if not content:
                continue

            kind = str(d.get("kind") or "OTHER").strip().upper()
            filename = d.get("filename") or guessed or f"doc_{i}"
            safe = filename.replace("/", "_").replace("\\", "_")
            z.writestr(f"documents/{kind}_{safe}", content)

    out = buf.getvalue()
    fn = f"invoice_package_{(inv.invoice_number or invoice_id)}.zip"
    fn = fn.replace(" ", "_")
    return out, fn


def issue_invoice(*, invoice_id: str, user: Dict[str, Any], store: ResponseStore) -> InvoiceRecord:
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    if inv.issuer_uid != uid and user.get("role") not in {"admin", "super_admin"}:
        raise ValueError("Not authorized to issue this invoice")

    if inv.status != InvoiceStatus.DRAFT:
        raise ValueError("Only draft invoices can be issued")

    load = _load_from_sources(inv.load_id, store)
    if not load:
        raise ValueError("Load not found")

    attachments: List[InvoiceAttachment] = list(inv.attachments or [])
    attachments = _maybe_expand_document_id_attachments(inv.issuer_uid, attachments)

    # Enforce load-linked-only policy for required invoicing docs.
    attachments = _apply_load_linked_doc_policy(
        load_id=inv.load_id,
        attachments=attachments,
        require_pod=True,
        error_context="issue invoice",
    )

    if not required_docs_present([a.model_dump() for a in attachments], InvoiceRequirements(require_pod=True, require_bol=False)):
        raise ValueError("Missing required documents (POD) for invoice issuance")

    now = _now()
    return _update_invoice_status(
        invoice_id=invoice_id,
        new_status=InvoiceStatus.ISSUED,
        now=now,
        extra={"issued_at": now, "attachments": [a.model_dump(mode="json") for a in attachments]},
    )


def void_invoice(*, invoice_id: str, user: Dict[str, Any]) -> InvoiceRecord:
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    if inv.issuer_uid != uid and user.get("role") not in {"admin", "super_admin"}:
        raise ValueError("Not authorized to void this invoice")
    return _update_invoice_status(invoice_id=invoice_id, new_status=InvoiceStatus.VOID, now=_now())


def submit_to_factoring(*, invoice_id: str, user: Dict[str, Any], provider_name: str) -> Tuple[InvoiceRecord, FactoringSubmissionRecord]:
    now = _now()
    inv = get_invoice(invoice_id=invoice_id)
    uid = user["uid"]
    if inv.issuer_uid != uid and user.get("role") not in {"admin", "super_admin"}:
        raise ValueError("Not authorized to submit this invoice")

    if not inv.factoring_enabled:
        raise ValueError("Factoring not enabled for this invoice")

    # Enforce minimal document requirement before factoring.
    if not required_docs_present([a.model_dump() for a in inv.attachments], InvoiceRequirements(require_pod=True, require_bol=False)):
        raise ValueError("Missing required documents (POD) for factoring submission")

    provider = get_provider(provider_name)

    submission_id = str(uuid.uuid4())

    # First transition invoice into factoring_submitted and create a submitted record.
    inv_submitted = _update_invoice_status(
        invoice_id=invoice_id,
        new_status=InvoiceStatus.FACTORING_SUBMITTED,
        now=now,
        extra={"factoring_provider": provider_name, "factoring_submission_id": submission_id},
    )

    sub = FactoringSubmissionRecord(
        submission_id=submission_id,
        invoice_id=invoice_id,
        provider=provider_name,
        status=FactoringSubmissionStatus.SUBMITTED,
        provider_reference=None,
        submitted_at=now,
        updated_at=now,
        advance_amount=None,
        fee_amount=None,
        funded_at=None,
        metadata={},
    )
    _submission_doc_ref(submission_id).set(sub.model_dump(mode="json"), merge=True)

    # Provider call (mock provider is synchronous, real providers may be async).
    result = provider.submit_invoice(invoice=inv_submitted.model_dump(mode="json"))

    submission_status = FactoringSubmissionStatus.ACCEPTED if result.accepted else FactoringSubmissionStatus.REJECTED
    sub2 = FactoringSubmissionRecord(
        submission_id=submission_id,
        invoice_id=invoice_id,
        provider=provider_name,
        status=submission_status,
        provider_reference=result.provider_reference,
        submitted_at=sub.submitted_at,
        updated_at=now,
        advance_amount=(float(inv.amount_total) * float(result.metadata.get("advance_rate", 0.9)) if result.accepted else None),
        fee_amount=None,
        funded_at=None,
        metadata=result.metadata,
    )
    _submission_doc_ref(submission_id).set(sub2.model_dump(mode="json"), merge=True)

    inv2 = _update_invoice_status(
        invoice_id=invoice_id,
        new_status=(InvoiceStatus.FACTORING_ACCEPTED if result.accepted else InvoiceStatus.FACTORING_REJECTED),
        now=now,
        extra={"factoring_provider": provider_name, "factoring_submission_id": submission_id},
    )

    return inv2, sub2


def record_payment(*, invoice_id: str, request: PaymentCreateRequest, user: Dict[str, Any]) -> Tuple[InvoiceRecord, PaymentTransactionRecord]:
    now = _now()
    inv = get_invoice(invoice_id=invoice_id)

    uid = user["uid"]
    # Issuer (seller) and payer (buyer) can record payments; admins too.
    if uid not in {inv.issuer_uid, inv.payer_uid} and user.get("role") not in {"admin", "super_admin"}:
        raise ValueError("Not authorized to record payment")

    received_at = float(request.received_at or now)

    payment_id = str(uuid.uuid4())
    pay = PaymentTransactionRecord(
        payment_id=payment_id,
        invoice_id=invoice_id,
        amount=float(request.amount),
        currency=request.currency,
        method=request.method,
        received_at=received_at,
        created_at=now,
        external_id=request.external_id,
        notes=request.notes,
        metadata={},
    )
    _payment_doc_ref(payment_id).set(pay.model_dump(mode="json"), merge=True)

    new_paid = float(inv.amount_paid or 0) + float(pay.amount)
    new_status = InvoiceStatus.PAID if new_paid >= float(inv.amount_total) else InvoiceStatus.PARTIALLY_PAID

    inv2 = _update_invoice_status(
        invoice_id=invoice_id,
        new_status=new_status,
        now=now,
        extra={"amount_paid": new_paid, "paid_at": (now if new_status == InvoiceStatus.PAID else None)},
    )

    return inv2, pay


def process_webhook_event(*, provider: str, req: Dict[str, Any]) -> WebhookEventRecord:
    provider = (provider or "").strip().lower() or "mock"
    event_id = str(req.get("event_id") or "").strip()
    if not event_id:
        raise ValueError("event_id is required")

    now = _now()
    occurred_at = req.get("occurred_at")
    event_type = str(req.get("event_type") or "").strip() or "unknown"
    invoice_id = req.get("invoice_id")
    submission_id = req.get("submission_id")
    payload = req.get("payload") or {}

    event_ref = _event_doc_ref(provider, event_id)

    @firestore.transactional
    def txn_process(txn: firestore.Transaction) -> Dict[str, Any]:
        snap = event_ref.get(transaction=txn)
        if snap.exists:
            existing = snap.to_dict() or {}
            # Idempotent: if already processed, return it.
            if existing.get("processed_at"):
                return existing

        base = {
            "provider": provider,
            "event_id": event_id,
            "event_type": event_type,
            "received_at": now,
            "occurred_at": occurred_at,
            "processed_at": None,
            "processing_error": None,
            "invoice_id": invoice_id,
            "submission_id": submission_id,
            "payload": payload,
        }
        txn.set(event_ref, base, merge=True)

        try:
            # Apply minimal, provider-agnostic effects.
            if invoice_id:
                if event_type in {"invoice.paid", "paid"}:
                    inv = get_invoice(invoice_id=invoice_id)
                    # Mark as paid (no amount info from webhook assumed).
                    assert_transition(InvoiceStatus(inv.status), InvoiceStatus.PAID)
                    txn.set(_invoice_doc_ref(invoice_id), {"status": InvoiceStatus.PAID.value, "paid_at": now, "updated_at": now}, merge=True)
                elif event_type in {"factoring.accepted", "submission.accepted"}:
                    inv = get_invoice(invoice_id=invoice_id)
                    assert_transition(InvoiceStatus(inv.status), InvoiceStatus.FACTORING_ACCEPTED)
                    txn.set(_invoice_doc_ref(invoice_id), {"status": InvoiceStatus.FACTORING_ACCEPTED.value, "updated_at": now}, merge=True)
                elif event_type in {"factoring.rejected", "submission.rejected"}:
                    inv = get_invoice(invoice_id=invoice_id)
                    assert_transition(InvoiceStatus(inv.status), InvoiceStatus.FACTORING_REJECTED)
                    txn.set(_invoice_doc_ref(invoice_id), {"status": InvoiceStatus.FACTORING_REJECTED.value, "updated_at": now}, merge=True)

            # Success: mark processed.
            base["processed_at"] = now
            txn.set(event_ref, {"processed_at": now, "processing_error": None}, merge=True)
            return base
        except Exception as e:
            # Leave processed_at unset so the caller can retry the same event_id.
            base["processing_error"] = str(e)
            txn.set(event_ref, {"processing_error": base["processing_error"], "processed_at": None}, merge=True)
            return base

    txn = db.transaction()
    d = txn_process(txn)
    return WebhookEventRecord(**d)


def mark_overdue_invoices(*, max_docs: int = 250) -> int:
    now = _now()
    col = db.collection("invoices")

    # Fetch candidates by status; due_date filter is not indexed everywhere, so filter in Python.
    statuses = [InvoiceStatus.SENT.value, InvoiceStatus.ISSUED.value, InvoiceStatus.PARTIALLY_PAID.value, InvoiceStatus.FACTORING_SUBMITTED.value, InvoiceStatus.FACTORING_ACCEPTED.value]

    try:
        snaps = list(col.where("status", "in", statuses).limit(int(max_docs)).stream())
    except Exception:
        snaps = list(col.limit(int(max_docs)).stream())

    updated = 0
    for s in snaps:
        d = s.to_dict() or {}
        try:
            due = d.get("due_date")
            if not due:
                continue
            if float(due) >= now:
                continue
            st = str(d.get("status") or "")
            if st == InvoiceStatus.OVERDUE.value or st == InvoiceStatus.PAID.value or st == InvoiceStatus.VOID.value:
                continue
            _invoice_doc_ref(s.id).set({"status": InvoiceStatus.OVERDUE.value, "overdue_at": now, "updated_at": now}, merge=True)
            updated += 1
        except Exception:
            continue

    return updated
