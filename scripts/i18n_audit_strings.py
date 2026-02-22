"""Audit for likely user-facing hardcoded strings.

Goal: help migrate UI to i18n keys so language switching affects *every* visible word.

This is a best-effort heuristic (regex-based). It reports:
- JSX text nodes like: >Some text<
- Common attributes like placeholder/title/aria-label/alt

It intentionally does NOT try to parse JSX AST (keeps it dependency-free).
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "src"


INCLUDE_EXTS = {".js", ".jsx", ".ts", ".tsx"}
EXCLUDE_DIR_PARTS = {
    "node_modules",
    "dist",
    "build",
    ".git",
}


# DOTALL so it catches patterns like: >\n  Some text\n<
TEXT_NODE_RE = re.compile(r">\s*([^<{][^<]{0,200}?)\s*<", re.DOTALL)
ATTR_RE = re.compile(
    r"\b(placeholder|title|aria-label|alt|label)\s*=\s*([\"'])(.{1,200}?)\2"
)

# Ignore strings that are probably not user-facing.
IGNORE_VALUE_RE = re.compile(
    r"^(?:"
    r"[#./]|"  # paths, hashes
    r"[A-Za-z0-9_-]+\.[A-Za-z0-9_.-]+|"  # keys like common.ok
    r"\{.*\}|"  # template/JSX expression
    r"\s*\)|\s*\(|"  # braces/paren noise
    r")$"
)

# Ignore known non-copy patterns inside a matched snippet.
IGNORE_CONTAINS = (
    "{t(",
    "t(language",
    "t(locale",
    "i18n.",
    "data-testid",
)


@dataclass(frozen=True)
class Finding:
    file: Path
    line_no: int
    kind: str
    text: str


def iter_source_files() -> Iterable[Path]:
    if not SRC_DIR.exists():
        return
    for path in SRC_DIR.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in INCLUDE_EXTS:
            continue
        if any(part in EXCLUDE_DIR_PARTS for part in path.parts):
            continue
        yield path


def iter_paths_from_args(args: list[str]) -> Iterable[Path]:
    for raw in args:
        p = (ROOT / raw).resolve() if not Path(raw).is_absolute() else Path(raw).resolve()
        if p.is_file():
            if p.suffix in INCLUDE_EXTS and not any(part in EXCLUDE_DIR_PARTS for part in p.parts):
                yield p
            continue
        if p.is_dir():
            for child in p.rglob("*"):
                if not child.is_file():
                    continue
                if child.suffix not in INCLUDE_EXTS:
                    continue
                if any(part in EXCLUDE_DIR_PARTS for part in child.parts):
                    continue
                yield child


def should_ignore_value(value: str) -> bool:
    v = value.strip()
    if not v:
        return True
    if any(token in v for token in IGNORE_CONTAINS):
        return True
    # ignore pure punctuation/very short values
    if len(v) <= 1:
        return True
    if IGNORE_VALUE_RE.match(v):
        return True
    # ignore values that look like ids or constants
    if re.fullmatch(r"[A-Z0-9_\-]{4,}", v):
        return True
    return False


def audit_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    try:
        raw = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raw = path.read_text(encoding="utf-8", errors="replace")

    # Scan whole file for JSX text nodes (handles multi-line text).
    for match in TEXT_NODE_RE.finditer(raw):
        text = match.group(1).strip()
        if should_ignore_value(text):
            continue
        if not re.search(r"[A-Za-z]", text):
            continue
        line_no = raw.count("\n", 0, match.start()) + 1
        findings.append(Finding(path, line_no, "jsx-text", " ".join(text.split())))

    # Per-line scan for attributes (simpler and avoids huge false positives).
    for idx, line in enumerate(raw.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("//"):
            continue

        for match in ATTR_RE.finditer(line):
            value = match.group(3).strip()
            if should_ignore_value(value):
                continue
            if not re.search(r"[A-Za-z]", value):
                continue
            findings.append(Finding(path, idx, f"attr:{match.group(1)}", value))

    return findings


def main() -> int:
    # Windows consoles/pipes may default to cp1252; force UTF-8 so we can print emoji/non-ASCII safely.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    all_findings: list[Finding] = []

    argv = sys.argv[1:]
    targets = list(iter_paths_from_args(argv)) if argv else list(iter_source_files())
    for path in targets:
        all_findings.extend(audit_file(path))

    # Sort by file then line
    all_findings.sort(key=lambda f: (str(f.file).lower(), f.line_no, f.kind))

    if not all_findings:
        print("No obvious hardcoded user-facing strings found.")
        return 0

    for f in all_findings:
        rel = f.file.relative_to(ROOT).as_posix()
        print(f"{rel}:{f.line_no} [{f.kind}] {f.text}")

    print(f"\nTotal findings: {len(all_findings)}")
    print("Tip: migrate these to t(language, '...', fallback) + add dict entries.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
