from __future__ import annotations

from typing import Dict, Any, List, Tuple

from .documents import DOC_DEFINITIONS
from .storage import ResponseStore
from .utils import parse_any_date, to_isoformat, utcnow


def _status_from_issues(issues: List[str]) -> str:
    if not issues:
        return "valid"
    if len(issues) == 1:
        return "attention"
    return "invalid"


def _find_expiry(extraction: Dict[str, Any]) -> Tuple[str | None, Any]:
    for key in ["expiry_date", "expiration_date", "medical_cert_expiration", "irp_valid_dates"]:
        value = extraction.get(key)
        if value:
            return key, value
    return None, None


def _normalize_amount(value: Any) -> float:
    if not value:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    digits = "".join(ch for ch in str(value) if ch.isdigit() or ch == ".")
    try:
        return float(digits) if digits else 0.0
    except ValueError:
        return 0.0


def _base_validation(doc_type: str, extraction: Dict[str, Any]) -> Dict[str, Any]:
    definition = DOC_DEFINITIONS.get(doc_type)
    if not definition:
        return {
            "document_type": doc_type,
            "issues": [],
            "warnings": [],
            "fields": {},
            "status": "info",
            "is_valid": True,
        }

    issues: List[str] = []
    warnings: List[str] = []
    fields: Dict[str, Any] = {}

    for field in definition.required_fields:
        value = extraction.get(field)
        if value not in (None, "", []):
            fields[field] = value
        else:
            issues.append(f"Missing field: {field}")

    expiry_key, expiry_value = _find_expiry(extraction)
    if definition.expiry_alert_days:
        if expiry_value:
            exp_dt = parse_any_date(expiry_value)
            if exp_dt:
                fields[expiry_key or "expiry_date"] = to_isoformat(exp_dt)
                days_remaining = (exp_dt - utcnow()).days
                if days_remaining < 0:
                    issues.append("Document is expired")
                else:
                    for window in sorted(definition.expiry_alert_days):
                        if days_remaining <= window:
                            warnings.append(f"Document expires in {days_remaining} days (alert window {window})")
                            break
            else:
                issues.append("Expiry date unreadable")
        else:
            issues.append("Expiry date missing")

    result = {
        "document_type": doc_type,
        "issues": issues,
        "warnings": warnings,
        "fields": fields,
    }
    result["status"] = _status_from_issues(issues)
    result["is_valid"] = len(issues) == 0
    return result


def _coi_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    liability = _normalize_amount(extraction.get("liability_limit"))
    cargo = _normalize_amount(extraction.get("cargo_limit"))
    if liability and liability < 1_000_000:
        result["issues"].append("Liability limit below $1,000,000")
    if cargo and cargo < 100_000:
        result["issues"].append("Cargo limit below $100,000")


def _w9_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    tin = extraction.get("tin")
    signature_present = extraction.get("signature_present")
    if tin:
        digits = "".join(ch for ch in str(tin) if ch.isdigit())
        if len(digits) != 9:
            result["issues"].append("TIN format invalid")
    else:
        result["issues"].append("TIN missing")
    if not signature_present:
        result["issues"].append("Signature not detected")


def _cdl_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    cdl_class = (extraction.get("cdl_class") or "").upper()
    if cdl_class and "A" not in cdl_class:
        result["issues"].append("CDL is not Class A")


def _medical_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    nrc = extraction.get("national_registry_number")
    if nrc:
        digits = "".join(ch for ch in str(nrc) if ch.isdigit())
        if len(digits) != 10:
            result["issues"].append("National Registry Number must be 10 digits")
    else:
        result["issues"].append("National Registry Number missing")


def _voided_check_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    routing = extraction.get("routing_number")
    if routing:
        digits = "".join(ch for ch in str(routing) if ch.isdigit())
        if len(digits) != 9:
            result["issues"].append("Routing number must be 9 digits")
    else:
        result["issues"].append("Routing number missing")


def _bond_rules(result: Dict[str, Any], extraction: Dict[str, Any]) -> None:
    amount = _normalize_amount(extraction.get("bond_amount"))
    if amount != 75_000:
        result["issues"].append("Bond amount must be exactly $75,000")


SPECIAL_RULES = {
    "COI_CARRIER": _coi_rules,
    "BROKER_COI": _coi_rules,
    "W9_CARRIER": _w9_rules,
    "BROKER_W9": _w9_rules,
    "CDL": _cdl_rules,
    "MEDICAL": _medical_rules,
    "VOIDED_CHECK_CARRIER": _voided_check_rules,
    "BROKER_BANKING": _voided_check_rules,
    "BMC_BOND": _bond_rules,
}


def validate_document(
    extraction: Dict[str, Any],
    doc_type: str | None = None,
    store: ResponseStore | None = None,
) -> Dict[str, Any]:
    doc_type = (doc_type or extraction.get("document_type") or "OTHER").upper()
    base_result = _base_validation(doc_type, extraction)
    rule_fn = SPECIAL_RULES.get(doc_type)
    if rule_fn:
        rule_fn(base_result, extraction)
        base_result["status"] = _status_from_issues(base_result["issues"])
        base_result["is_valid"] = len(base_result["issues"]) == 0
    _apply_profile_checks(base_result, extraction, doc_type, store)
    return base_result


def _apply_profile_checks(result: Dict[str, Any], extraction: Dict[str, Any], doc_type: str, store: ResponseStore | None):
    if not store:
        return
    usdot = extraction.get("usdot") or extraction.get("usdot_number") or extraction.get("dot_number")
    mc_number = extraction.get("mc_number") or extraction.get("mc") or extraction.get("docket_number")
    profile = None
    if usdot:
        profile = store.get_fmcsa_profile(str(usdot))
        if not profile:
            profile = store.get_fmcsa_verification(str(usdot))
    if not profile and mc_number:
        profile = store.get_fmcsa_verification(str(mc_number))
    if not profile:
        return
    result.setdefault("external_checks", {})
    result["external_checks"]["fmcsa"] = profile
    carrier_section = profile.get("raw") or profile.get("sections", {}).get("carrier") or profile
    profile_name = carrier_section.get("legal_name") or carrier_section.get("dba_name")
    profile_mc = carrier_section.get("mc_number") or carrier_section.get("docketNumber") or profile.get("mc_number")
    authority_status = (profile.get("authority_status") or "").lower()
    insurance_status = (profile.get("insurance_status") or "").lower()
    if authority_status and authority_status not in {"active", "authorized"}:
        result["warnings"].append(f"FMCSA authority status: {profile.get('authority_status')}")
    if insurance_status and insurance_status not in {"active"}:
        result["warnings"].append(f"FMCSA insurance status: {profile.get('insurance_status')}")

    if doc_type == "COI_CARRIER" and profile_name:
        insured = extraction.get("insured_name")
        if insured and not _names_match(insured, profile_name):
            result["warnings"].append("Insured name does not match FMCSA legal name")

    if doc_type == "BROKER_COI" and profile_name:
        broker_name = extraction.get("broker_name")
        if broker_name and not _names_match(broker_name, profile_name):
            result["warnings"].append("Broker name differs from FMCSA profile")

    if doc_type == "MC_CERT" and profile_mc:
        doc_mc = extraction.get("mc_number")
        if doc_mc and str(doc_mc).strip().upper() != str(profile_mc).strip().upper():
            result["warnings"].append("MC number on certificate does not match FMCSA records")

    result["status"] = _status_from_issues(result["issues"])
    result["is_valid"] = len(result["issues"]) == 0


def _names_match(a: Any, b: Any) -> bool:
    norm_a = _normalize_name(a)
    norm_b = _normalize_name(b)
    if not norm_a or not norm_b:
        return True
    return norm_a == norm_b


def _normalize_name(value: Any) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value).lower() if ch.isalnum())
