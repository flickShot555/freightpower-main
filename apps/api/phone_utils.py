from __future__ import annotations

from typing import Optional

try:
    import phonenumbers
except Exception:  # pragma: no cover
    phonenumbers = None


def normalize_phone_e164(raw: Optional[str], default_region: str = "US") -> Optional[str]:
    """Normalize a phone number to E.164.

    Accepts either:
    - E.164 input (e.g. +14155552671)
    - National-format input (e.g. 4155552671) when a default region is provided.

    Returns E.164 string or None.
    Raises ValueError when input is non-empty but cannot be normalized.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None

    if phonenumbers is None:
        # Without the lib, we can only accept already-valid E.164.
        if s.startswith("+") and 8 <= len(s) <= 20:
            return s
        raise ValueError('Phone number must be E.164 (e.g. "+14155552671").')

    region = (default_region or "US").strip().upper()
    try:
        parsed = phonenumbers.parse(s, region)
    except Exception as e:
        raise ValueError('Invalid phone number. Use E.164 (e.g. "+14155552671") or include a country code.') from e

    if not phonenumbers.is_valid_number(parsed):
        raise ValueError('Invalid phone number. Use E.164 (e.g. "+14155552671") or include a country code.')

    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
