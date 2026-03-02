from __future__ import annotations

from typing import Dict, Any

from .textops import find_date_near_keywords


def enrich_extraction(extraction: Dict[str, Any], plain_text: str | None) -> Dict[str, Any]:
    """Fill gaps (mainly dates) using raw PDF text heuristics."""
    if not plain_text:
        return extraction

    doc_type = (extraction.get("document_type") or "").upper()
    text = plain_text

    if doc_type == "COI":
        if not extraction.get("effective_date"):
            eff = find_date_near_keywords(text, ["effective", "policy effective"])
            if eff:
                extraction["effective_date"] = eff
        if not extraction.get("expiry_date"):
            exp = find_date_near_keywords(text, ["expiry", "expiration", "expires"])
            if exp:
                extraction["expiry_date"] = exp
    elif doc_type == "CDL":
        if not extraction.get("expiry_date"):
            exp = find_date_near_keywords(text, ["expiry", "expires", "expiration", "exp"])
            if exp:
                extraction["expiry_date"] = exp
    elif doc_type == "W-9":
        if not extraction.get("date"):
            signed = find_date_near_keywords(text, ["signature", "signed", "date of"])
            if signed:
                extraction["date"] = signed

    return extraction
