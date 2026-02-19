from __future__ import annotations

from typing import Any, Dict, List

from .documents import DOC_DEFINITIONS

TYPE_ALIASES = {
    "COI": "COI_CARRIER",
    "W-9": "W9_CARRIER",
    "W9": "W9_CARRIER",
    "BROKER W-9": "BROKER_W9",
    "BROKER COI": "BROKER_COI",
    "VOIDED CHECK": "VOIDED_CHECK_CARRIER",
}


def _normalize(doc_type: str) -> str:
    doc_type = (doc_type or "").upper()
    return TYPE_ALIASES.get(doc_type, doc_type)


def _score_keywords(doc_type: str, keyword_hits: Dict[str, int]) -> float:
    hits = keyword_hits.get(doc_type, 0)
    if not hits:
        return 0.0
    return min(0.4, 0.05 * hits)


def _score_fields(doc_type: str, extraction: Dict[str, Any]) -> float:
    definition = DOC_DEFINITIONS.get(doc_type)
    if not definition or not extraction:
        return 0.0
    required = definition.required_fields
    if not required:
        return 0.0
    filled = sum(1 for field in required if extraction.get(field) not in (None, "", []))
    completion_ratio = filled / len(required)
    return round(min(0.3, completion_ratio * 0.3), 3)


def resolve_document_type(
    detection: Dict[str, Any] | None,
    extraction: Dict[str, Any] | None,
    plain_text: str | None,
    keyword_hits: Dict[str, int] | None = None,
) -> Dict[str, Any]:
    detection = detection or {}
    extraction = extraction or {}
    keyword_hits = keyword_hits or {}
    base_type = _normalize(detection.get("document_type"))
    base_conf = float(detection.get("confidence") or 0.0)

    candidates = list(DOC_DEFINITIONS.keys()) + ["OTHER"]
    scores: Dict[str, float] = {c: 0.0 for c in candidates}
    reasons: List[str] = []

    if base_type in scores:
        scores[base_type] += max(base_conf, 0.2)
        reasons.append(f"vision:{base_type}:{base_conf:.2f}")
    else:
        scores["OTHER"] += 0.1

    extracted_type = _normalize(extraction.get("document_type"))
    if extracted_type in scores:
        scores[extracted_type] += 0.2
        reasons.append(f"extraction:{extracted_type}")

    for doc_type in DOC_DEFINITIONS.keys():
        kw_score = _score_keywords(doc_type, keyword_hits)
        if kw_score:
            scores[doc_type] += kw_score
            reasons.append(f"keywords:{doc_type}:{kw_score:.2f}")
        field_score = _score_fields(doc_type, extraction)
        if field_score:
            scores[doc_type] += field_score
            reasons.append(f"fields:{doc_type}:{field_score:.2f}")

    best_type = max(scores.items(), key=lambda item: item[1])[0]
    best_score = scores[best_type]

    if best_type != "OTHER" and best_score < 0.25:
        best_type = "OTHER"
        best_score = scores["OTHER"]

    confidence = round(min(0.99, 0.2 + best_score), 3)
    return {
        "document_type": best_type,
        "confidence": confidence,
        "reasons": reasons,
        "scores": scores,
    }
