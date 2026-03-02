from __future__ import annotations

import re
from typing import Iterable, List, Optional

from .utils import parse_any_date, to_isoformat


DATE_PATTERN = re.compile(r"(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})")


def iter_lines(text: str) -> Iterable[str]:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            yield stripped


def find_date_in_text(line: str) -> Optional[str]:
    match = DATE_PATTERN.search(line)
    if not match:
        return None
    dt = parse_any_date(match.group(0))
    return to_isoformat(dt)


def find_date_near_keywords(text: str, keywords: List[str]) -> Optional[str]:
    lowered = [k.lower() for k in keywords]
    for line in iter_lines(text):
        ll = line.lower()
        if any(k in ll for k in lowered):
            found = find_date_in_text(line)
            if found:
                return found
    return None
