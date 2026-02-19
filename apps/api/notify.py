from __future__ import annotations

import json
from typing import Dict, Any

import httpx


def send_webhook(url: str, payload: Dict[str, Any]) -> bool:
    try:
        resp = httpx.post(url, json=payload, timeout=5.0)
        resp.raise_for_status()
        return True
    except Exception:
        return False
