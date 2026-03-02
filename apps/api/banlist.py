from __future__ import annotations

import hashlib
import re
import time
from typing import Any, Dict, Iterable, Optional, Tuple

from fastapi import HTTPException

from .database import db


def _sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_email(email: Optional[str]) -> Optional[str]:
    s = str(email or "").strip().lower()
    return s or None


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    # Best-effort normalization. Auth signup already normalizes into E.164 in some flows.
    s = str(phone or "").strip()
    s = re.sub(r"\s+", "", s)
    return s or None


def normalize_identifier(value: Optional[str]) -> Optional[str]:
    s = str(value or "").strip()
    if not s:
        return None
    # Keep alphanumerics only; uppercase for stable comparisons.
    s = re.sub(r"[^0-9A-Za-z]", "", s).upper()
    return s or None


def banned_key(kind: str, normalized_value: str) -> str:
    return f"{kind}_{_sha256_hex(f'{kind}:{normalized_value}')[:32]}"


def is_banned(kind: str, normalized_value: str) -> bool:
    if not normalized_value:
        return False
    doc_id = banned_key(kind, normalized_value)
    return db.collection("banned_identity_keys").document(doc_id).get().exists


def assert_not_banned(
    *,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    dot_number: Optional[str] = None,
    cdl_number: Optional[str] = None,
) -> None:
    checks: Iterable[Tuple[str, Optional[str]]] = (
        ("email", normalize_email(email)),
        ("phone", normalize_phone(phone)),
        ("dot_number", normalize_identifier(dot_number)),
        ("cdl_number", normalize_identifier(cdl_number)),
    )

    for kind, val in checks:
        if val and is_banned(kind, val):
            raise HTTPException(status_code=403, detail="This account cannot be created (banned identity)")


def record_bans(
    *,
    target_uid: str,
    banned_by_uid: str,
    banned_by_email: Optional[str],
    request_id: Optional[str],
    reason: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
    dot_number: Optional[str] = None,
    cdl_number: Optional[str] = None,
) -> Dict[str, Any]:
    now = time.time()

    items = []
    pairs: Iterable[Tuple[str, Optional[str]]] = (
        ("email", normalize_email(email)),
        ("phone", normalize_phone(phone)),
        ("dot_number", normalize_identifier(dot_number)),
        ("cdl_number", normalize_identifier(cdl_number)),
    )

    for kind, normalized in pairs:
        if not normalized:
            continue
        doc_id = banned_key(kind, normalized)
        doc = {
            "id": doc_id,
            "kind": kind,
            "value": normalized,
            "target_uid": target_uid,
            "request_id": request_id,
            "reason": reason,
            "banned_by_uid": banned_by_uid,
            "banned_by_email": banned_by_email,
            "created_at": now,
            "updated_at": now,
        }
        db.collection("banned_identity_keys").document(doc_id).set(doc, merge=True)
        items.append(doc)

    return {"count": len(items), "items": items}
