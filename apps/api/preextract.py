from __future__ import annotations

import re
from typing import Dict, Any, List, Optional

from .documents import DOC_DEFINITIONS
from .textops import find_date_near_keywords


TIN_PATTERN = re.compile(r"\b\d{2}-\d{7}\b")
USDOT_PATTERN = re.compile(r"\bUSDOT[:\s#]*(\d{6,})\b", re.IGNORECASE)
MC_PATTERN = re.compile(r"\bMC[:\s#]*(\d{5,})\b", re.IGNORECASE)
POLICY_PATTERN = re.compile(r"(policy number|policy no\.?)[:\s#]*([A-Za-z0-9\-\/]+)", re.IGNORECASE)
LICENSE_PATTERN = re.compile(r"(license|lic\.)[:\s#]*([A-Za-z0-9\-]+)", re.IGNORECASE)


def _keyword_hits(text: str, keywords: List[str]) -> int:
    lowered = text.lower()
    return sum(1 for kw in keywords if kw in lowered)


def _match(pattern: re.Pattern, text: str, group_index: int = -1) -> Optional[str]:
    match = pattern.search(text)
    if not match:
        return None
    if group_index == -1:
        return match.group(0)
    return match.group(group_index)


def _sanitize_name(line: str) -> Optional[str]:
    line = line.strip()
    if not line:
        return None
    if len(line.split()) >= 2 and all(part[0].isalpha() for part in line.split()[:2]):
        return line
    return None


def _find_name(text: str, labels: List[str]) -> Optional[str]:
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        lower = line.lower()
        if any(label in lower for label in labels):
            # try same line after colon
            parts = line.split(":")
            if len(parts) > 1:
                candidate = _sanitize_name(parts[1])
                if candidate:
                    return candidate
            # fallback to next line
            if idx + 1 < len(lines):
                candidate = _sanitize_name(lines[idx + 1])
                if candidate:
                    return candidate
    return None


def _find_address_block(text: str, label: str) -> Optional[str]:
    pattern = re.compile(label + r"[:\s]*(.+)", re.IGNORECASE)
    match = pattern.search(text)
    if match:
        candidate = match.group(1).strip()
        if len(candidate.split()) >= 3:
            return candidate
    return None


def _extract_dates(text: str, keywords_map: Dict[str, List[str]] | None = None) -> Dict[str, Optional[str]]:
    keywords_map = keywords_map or {
        "effective_date": ["effective", "policy effective", "date effective"],
        "expiry_date": ["expiry", "expiration", "expires", "valid through"],
        "issue_date": ["issue date", "issued"],
        "signature_date": ["signature date", "signed"],
    }
    results: Dict[str, Optional[str]] = {}
    for field, keywords in keywords_map.items():
        results[field] = find_date_near_keywords(text, keywords)
    return results


def preextract_fields(plain_text: str) -> Dict[str, Any]:
    text = plain_text or ""
    lower = text.lower()

    keyword_hits = {
        code: _keyword_hits(lower, definition.keywords)
        for code, definition in DOC_DEFINITIONS.items()
    }

    tin = _match(TIN_PATTERN, text)
    usdots = USDOT_PATTERN.findall(text)
    mcs = MC_PATTERN.findall(text)
    policy_match = _match(POLICY_PATTERN, text, 2)
    license_match = _match(LICENSE_PATTERN, text, 2)

    coi_fields = {
        "insured_name": _find_name(text, ["insured", "certificate holder", "agent"]),
        "policy_number": policy_match,
        "certificate_holder": _find_address_block(text, "certificate holder"),
    }
    coi_fields.update({k: v for k, v in _extract_dates(text).items() if v})

    w9_fields = {
        "name": _find_name(text, ["name"]),
        "business_name": _find_name(text, ["business name"]),
        "tin": tin,
    }
    w9_fields["address"] = _find_address_block(text, "address") or _find_address_block(text, "street")

    cdl_fields = {
        "driver_name": _find_name(text, ["driver", "name"]),
        "license_number": license_match,
        "state": _match(re.compile(r"\b[A-Z]{2}\s+DL\b"), text),
    }
    cdl_fields["expiry_date"] = find_date_near_keywords(text, ["expiration", "expires", "expiry"])
    cdl_fields["issue_date"] = find_date_near_keywords(text, ["issue", "issued"])

    medical_fields = {
        "driver_name": _find_name(text, ["driver", "name"]),
        "examiner_name": _find_name(text, ["medical examiner", "examiner"]),
        "national_registry_number": _match(re.compile(r"\b[0-9]{10}\b"), text),
        "expiry_date": find_date_near_keywords(text, ["expiration", "expires"]),
    }

    ucr_fields = {
        "legal_name": _find_name(text, ["legal name", "registrant", "entity"]),
        "usdot": _match(USDOT_PATTERN, text, 1),
        "year": _match(re.compile(r"\b20\d{2}\b"), text),
        "receipt_number": _match(re.compile(r"receipt(?: number)?:\s*([A-Z0-9\-]+)", re.IGNORECASE), text, 1),
        "payment_status": _match(re.compile(r"status:\s*(paid|unpaid|pending)", re.IGNORECASE), text, 1),
    }

    irp_fields = {
        "carrier_name": _find_name(text, ["legal name", "carrier"]),
        "issuing_state": _match(re.compile(r"state[:\s]+([A-Z]{2})"), text, 1),
        "account_id": _match(re.compile(r"(account|fleet|customer)\s*(number|id)[:\s]*([A-Z0-9\-]+)", re.IGNORECASE), text, 3),
        "account_type": _match(re.compile(r"(irp|ifta)", re.IGNORECASE), text),
    }
    irp_fields.update({
        "date_issued": find_date_near_keywords(text, ["date issued", "letter date"]),
    })

    cab_fields = {
        "plate_number": _match(re.compile(r"plate[:\s]*([A-Z0-9\-]+)", re.IGNORECASE), text, 1),
        "vin": _match(re.compile(r"\bvin[:\s]*([A-HJ-NPR-Z0-9]{6,})\b", re.IGNORECASE), text, 1),
        "unit_number": _match(re.compile(r"unit[:\s]*([A-Z0-9\-]+)", re.IGNORECASE), text, 1),
        "vehicle_make_model_year": _match(re.compile(r"(make|model|year)[:\s]*([A-Za-z0-9 ]+)", re.IGNORECASE), text, 2),
    }
    cab_fields["irp_valid_dates"] = find_date_near_keywords(text, ["valid", "expires"])

    trailer_fields = {
        "plate": _match(re.compile(r"plate[:\s]*([A-Z0-9\-]+)", re.IGNORECASE), text, 1),
        "vin": _match(re.compile(r"\bvin[:\s]*([A-HJ-NPR-Z0-9]{6,})\b", re.IGNORECASE), text, 1),
        "owner_name": _find_name(text, ["owner", "registered to"]),
    }
    trailer_fields["expiration_date"] = find_date_near_keywords(text, ["expiration", "expires"])

    bank_fields = {
        "routing_number": _match(re.compile(r"\b(\d{9})\b"), text),
        "account_number": _match(re.compile(r"account\s*(number)?[:\s]*([0-9\-]+)", re.IGNORECASE), text, 2),
        "account_holder_name": _find_name(text, ["account name", "pay to the order of"]),
    }

    contract_fields = {
        "carrier_name": _find_name(text, ["carrier", "carrier legal name"]),
        "broker_name": _find_name(text, ["broker", "broker name"]),
        "agreement_date": find_date_near_keywords(text, ["date", "dated"]),
    }

    mc_cert_fields = {
        "carrier_name": _find_name(text, ["carrier", "legal name"]),
        "mc_number": _match(MC_PATTERN, text, 1),
        "usdot": _match(USDOT_PATTERN, text, 1),
        "authority_type": _match(re.compile(r"authority[:\s]*(.+)", re.IGNORECASE), text, 1),
        "status": _match(re.compile(r"status[:\s]*(active|inactive|pending)", re.IGNORECASE), text, 1),
    }
    mc_cert_fields["service_date"] = find_date_near_keywords(text, ["service date", "date granted"])

    ifta_fields = {
        "carrier_name": _find_name(text, ["legal name", "registrant"]),
        "ifta_account_number": _match(re.compile(r"account\s*(number)?[:\s]*([A-Z0-9\-]+)", re.IGNORECASE), text, 2),
        "license_year": _match(re.compile(r"year[:\s]*(20\d{2})", re.IGNORECASE), text, 1),
        "base_jurisdiction": _match(re.compile(r"base jurisdiction[:\s]*([A-Z]{2})", re.IGNORECASE), text, 1),
    }
    ifta_fields["expiry_date"] = find_date_near_keywords(text, ["expires", "expiration"])

    ein_fields = {
        "legal_business_name": _find_name(text, ["legal name", "business name"]),
        "ein": _match(re.compile(r"\b\d{2}-\d{7}\b"), text),
        "business_address": _find_address_block(text, "address"),
    }
    ein_fields["date"] = find_date_near_keywords(text, ["date", "issued"])

    boc3_fields = {
        "carrier_name": _find_name(text, ["carrier", "legal name"]),
        "mc_number": _match(MC_PATTERN, text, 1),
        "usdot": _match(USDOT_PATTERN, text, 1),
        "process_agent_company": _find_name(text, ["process agent", "agent company"]),
    }
    boc3_fields["effective_date"] = find_date_near_keywords(text, ["effective", "filed"])

    broker_coi_fields = {
        "broker_name": _find_name(text, ["insured", "broker"]),
        "policy_number": policy_match,
    }
    broker_coi_fields.update({k: v for k, v in _extract_dates(text).items() if v})

    broker_w9_fields = {
        "name": _find_name(text, ["name"]),
        "business_name": _find_name(text, ["business name", "broker name"]),
        "tin": tin,
    }
    broker_w9_fields["address"] = _find_address_block(text, "address")

    bmc_bond_fields = {
        "broker_name": _find_name(text, ["broker", "principal"]),
        "mc_number": _match(MC_PATTERN, text, 1),
        "usdot": _match(USDOT_PATTERN, text, 1),
        "bond_amount": _match(re.compile(r"\$\s*([0-9,]+)", re.IGNORECASE), text, 1),
        "surety_company": _find_name(text, ["surety", "trust company"]),
    }
    bmc_bond_fields["effective_date"] = find_date_near_keywords(text, ["effective", "date"])

    extras = {
        "tin_detected": bool(tin),
        "usdots": usdots[:3],
        "mcs": mcs[:3],
    }

    return {
        "signals": keyword_hits,
        "extras": extras,
        "prefill": {
            "COI_CARRIER": {k: v for k, v in coi_fields.items() if v},
            "W9_CARRIER": {k: v for k, v in w9_fields.items() if v},
            "CDL": {k: v for k, v in cdl_fields.items() if v},
            "MEDICAL": {k: v for k, v in medical_fields.items() if v},
            "UCR": {k: v for k, v in ucr_fields.items() if v},
            "IRP_IFTA_LETTER": {k: v for k, v in irp_fields.items() if v},
            "CAB_CARD": {k: v for k, v in cab_fields.items() if v},
            "TRAILER_REG": {k: v for k, v in trailer_fields.items() if v},
            "VOIDED_CHECK_CARRIER": {k: v for k, v in bank_fields.items() if v},
            "CARRIER_BROKER_AGREEMENT": {k: v for k, v in contract_fields.items() if v},
            "MC_CERT": {k: v for k, v in mc_cert_fields.items() if v},
            "IFTA_LICENSE": {k: v for k, v in ifta_fields.items() if v},
            "EIN_LETTER": {k: v for k, v in ein_fields.items() if v},
            "BOC3": {k: v for k, v in boc3_fields.items() if v},
            "BROKER_COI": {k: v for k, v in broker_coi_fields.items() if v},
            "BROKER_W9": {k: v for k, v in broker_w9_fields.items() if v},
            "BROKER_BANKING": {k: v for k, v in bank_fields.items() if v},
            "BMC_BOND": {k: v for k, v in bmc_bond_fields.items() if v},
        },
    }
