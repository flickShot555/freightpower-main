from __future__ import annotations

import json
from typing import Dict, Any

from .documents import DOC_DEFINITIONS, DocumentDefinition
from .utils import utcnow


VALID_DOC_TYPES = list(DOC_DEFINITIONS.keys()) + ["OTHER"]

CLASSIFICATION_PROMPT = (
    "You classify freight onboarding documents into the supported types.\n"
    f"Supported codes: {', '.join(VALID_DOC_TYPES)}.\n"
    'Respond with JSON: {"document_type":"CODE","confidence":0-1,"reason":""}. '
    "If unsure, return OTHER with low confidence."
)


def render_classification_payload(signals: Dict[str, Any], text_snippet: str) -> str:
    top_signals = sorted(signals.items(), key=lambda kv: kv[1], reverse=True)[:10]
    summary = {code: hits for code, hits in top_signals if hits}
    return (
        "Keyword hits by document type:\n"
        + json.dumps(summary, ensure_ascii=False, indent=2)
        + "\n\nDocument text excerpt:\n"
        + text_snippet
    )


def _fields_block(defn: DocumentDefinition) -> str:
    req = "\n".join(f"- {name}" for name in defn.required_fields)
    if defn.optional_fields:
        opt = "\n".join(f"- {name}" for name in defn.optional_fields)
    else:
        opt = "None"
    return f"Required fields:\n{req}\n\nOptional fields:\n{opt}"


def _rules_block(defn: DocumentDefinition) -> str:
    rules = defn.validation_rules or ["Ensure document is authentic and matches the entity profile."]
    bullets = "\n".join(f"- {rule}" for rule in rules)
    alerts = ""
    if defn.expiry_alert_days:
        alerts = (
            "\nExpiry alerts: trigger warnings at "
            + ", ".join(f"{days} days" for days in defn.expiry_alert_days)
            + " before the expiration date."
        )
    return f"Validation rules:\n{bullets}{alerts}"


def render_extraction_prompt(doc_type: str, prefill: Dict[str, Any]) -> str:
    doc_type_upper = doc_type.upper()
    definition = DOC_DEFINITIONS.get(doc_type_upper)
    today = utcnow().date().isoformat()
    prefill_json = json.dumps(prefill or {}, ensure_ascii=False)
    if not definition:
        return (
            f"You are inspecting an unknown onboarding document (code={doc_type_upper}). "
            "Return JSON with the document_type and a `text` summary."
        )
    return (
        f"You extract structured data for: {definition.title} ({doc_type_upper}).\n"
        f"Description: {definition.description}\n"
        f"Today's date: {today}. Use it to determine whether documents are expired or about to expire.\n\n"
        f"{_fields_block(definition)}\n\n"
        f"{_rules_block(definition)}\n\n"
        "If a field is missing, set it to null or an empty list. "
        "Use ISO 8601 format for dates (YYYY-MM-DD). "
        "If you detect validation issues, add concise notes under a `warnings` list.\n\n"
        f"Prefill hints (from heuristics): {prefill_json}"
    )
