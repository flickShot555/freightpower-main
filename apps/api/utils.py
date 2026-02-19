from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from dateutil import parser


def _region3(region: str) -> str:
    r = (region or '').strip().upper()
    return (r[:3] if r else 'ATL')


def parse_any_date(value: Any) -> Optional[datetime]:
    """Best-effort date parser that returns naive UTC datetimes."""
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, (int, float)):
        try:
            dt = datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            return None
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            dt = datetime.fromisoformat(text)
        except Exception:
            try:
                dt = parser.parse(text, fuzzy=True)
            except Exception:
                return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def to_isoformat(dt: Optional[datetime]) -> Optional[str]:
    if not dt:
        return None
    return dt.replace(microsecond=0).isoformat()


def utcnow() -> datetime:
    return datetime.utcnow()


def generate_load_id(region: str = "ATL", user_code: str = None) -> str:
    """
    Generate Load ID in format: FP-YYREG-UCODE-SNNNNN
    
    Example: FP-25ATL-AB123-S000001
    
    Args:
        region: 3-letter region code (default: "ATL")
        user_code: Optional user/company code (default: generates from timestamp)
    
    Returns:
        Generated load ID string
    """
    import random
    
    # Get current year (last 2 digits)
    year = datetime.now().strftime("%y")
    
    # Generate user code if not provided (5 alphanumeric chars)
    if not user_code:
        user_code = f"{''.join([chr(random.randint(65, 90)) for _ in range(2)])}{random.randint(100, 999)}"
    
    # Get sequence number (we'll implement proper sequencing in storage layer)
    # For now, use timestamp-based unique number
    sequence = int(datetime.now().timestamp() * 1000) % 1000000
    
    # Format: FP-YYREG-UCODE-SNNNNN
    load_id = f"FP-{year}{region.upper()[:3]}-{user_code[:5]}-S{sequence:06d}"
    
    return load_id


def generate_load_number(*, region: str = "ATL", db_client=None) -> str:
    """Generate a human-friendly FreightPower Load Number.

    Format: FP-<REG>-LD-000001 (sequential per region).

    Uses a Firestore counter document under: counters/load_number_<REG>
    and increments it transactionally when supported.

    This does NOT replace load_id; load_id remains the internal key.
    """
    import time

    reg = _region3(region)

    if db_client is None:
        # Local import to avoid heavy imports at module load.
        from .database import db as db_client

    counter_ref = db_client.collection("counters").document(f"load_number_{reg}")

    # Prefer transactional increment when available.
    try:
        if hasattr(db_client, "transaction"):
            from firebase_admin import firestore as _fb_firestore

            @_fb_firestore.transactional
            def _txn_inc(txn: _fb_firestore.Transaction):
                snap = counter_ref.get(transaction=txn)
                cur = snap.to_dict() or {}
                seq = int(cur.get("seq") or 0) + 1
                txn.set(counter_ref, {"seq": seq, "updated_at": float(time.time())}, merge=True)
                return seq

            txn = db_client.transaction()
            seq = int(_txn_inc(txn))
            return f"FP-{reg}-LD-{seq:06d}"
    except Exception:
        # Fall back to non-transactional best-effort increment.
        pass

    # Best-effort fallback (still usually unique; not guaranteed under concurrency).
    try:
        snap = counter_ref.get()
        cur = snap.to_dict() or {}
        seq = int(cur.get("seq") or 0) + 1
        counter_ref.set({"seq": seq, "updated_at": float(time.time())}, merge=True)
        return f"FP-{reg}-LD-{seq:06d}"
    except Exception:
        # Last-resort fallback: timestamp-based suffix.
        suffix = int(time.time() * 1000) % 1000000
        return f"FP-{reg}-LD-{suffix:06d}"
