from __future__ import annotations

from typing import Dict, Any

from .storage import ResponseStore


def _find_doc_by_type(store: ResponseStore, doc_type: str) -> Dict[str, Any] | None:
    docs = store.list_documents()
    for doc in docs:
        if (doc.get("doc_type") or "").upper() == doc_type.upper():
            return doc
    return None


def autofill_driver_registration(store: ResponseStore) -> Dict[str, Any]:
    """Compose a draft driver registration form from CDL/medical/FMCSA data."""
    draft: Dict[str, Any] = {
        "driver": {},
        "license": {},
        "medical": {},
        "fmca": {},
        "missing": [],
        "signature_required": True,
    }
    cdl_doc = _find_doc_by_type(store, "CDL")
    medical_doc = _find_doc_by_type(store, "MEDICAL")

    if cdl_doc:
        ext = cdl_doc.get("extraction", {})
        draft["driver"]["name"] = ext.get("driver_name")
        draft["driver"]["date_of_birth"] = ext.get("date_of_birth")
        draft["driver"]["address"] = ext.get("address")
        draft["license"]["number"] = ext.get("license_number")
        draft["license"]["state"] = ext.get("state")
        draft["license"]["class"] = ext.get("cdl_class")
        draft["license"]["endorsements"] = ext.get("endorsements")
        draft["license"]["expiry_date"] = ext.get("expiry_date")
    else:
        draft["missing"].append("CDL document")

    if medical_doc:
        ext = medical_doc.get("extraction", {})
        draft["medical"]["examiner_name"] = ext.get("examiner_name")
        draft["medical"]["expiry_date"] = ext.get("expiry_date")
    else:
        draft["missing"].append("Medical certificate")

    return draft


def autofill_clearinghouse_consent(store: ResponseStore) -> Dict[str, Any]:
    draft: Dict[str, Any] = {"driver": {}, "company": {}, "missing": [], "signature_required": True}
    cdl_doc = _find_doc_by_type(store, "CDL")
    if cdl_doc:
        ext = cdl_doc.get("extraction", {})
        draft["driver"]["name"] = ext.get("driver_name")
        draft["driver"]["license_number"] = ext.get("license_number")
    else:
        draft["missing"].append("CDL document")
    return draft


def autofill_mvr_release(store: ResponseStore) -> Dict[str, Any]:
    draft: Dict[str, Any] = {"driver": {}, "company": {}, "missing": [], "signature_required": True}
    cdl_doc = _find_doc_by_type(store, "CDL")
    if cdl_doc:
        ext = cdl_doc.get("extraction", {})
        draft["driver"]["name"] = ext.get("driver_name")
        draft["driver"]["license_number"] = ext.get("license_number")
        draft["driver"]["license_state"] = ext.get("state")
        draft["driver"]["date_of_birth"] = ext.get("date_of_birth")
    else:
        draft["missing"].append("CDL document")
    return draft
