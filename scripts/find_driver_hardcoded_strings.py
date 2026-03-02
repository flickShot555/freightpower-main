import re
from dataclasses import dataclass
from pathlib import Path


DRIVER_GLOB = "src/components/driver/**/*.[jt]sx"


@dataclass(frozen=True)
class Finding:
    file: Path
    kind: str
    snippet: str
    index: int


def _is_probably_ok_text(text: str) -> bool:
    t = " ".join(text.split())
    if not t:
        return True

    # Mostly symbols or very short pieces are often chevrons/separators.
    if len(t) <= 2 and not any(ch.isalnum() for ch in t):
        return True

    # Common non-user-visible fragments.
    if t in {"/", "|", "·", "•", "…"}:
        return True

    return False


def scan_file(path: Path) -> list[Finding]:
    text = path.read_text(encoding="utf-8", errors="replace")

    findings: list[Finding] = []

    # 1) JSX text nodes: >Some text< (including across newlines)
    # Exclude if the node contains "{" (meaning it's likely {tr(...)} or expression).
    jsx_text = re.compile(r">([^<>{}]*[A-Za-z][^<>{}]*)<", re.DOTALL)
    for m in jsx_text.finditer(text):
        raw = m.group(1)
        if "{" in raw or "}" in raw:
            continue
        if _is_probably_ok_text(raw):
            continue
        snippet = " ".join(raw.strip().split())
        findings.append(Finding(path, "jsx-text", snippet[:120], m.start()))

    # 2) String-literal attributes that are almost always user-visible.
    # Note: we only match literal quotes, not {tr(...)}.
    attr_pat = re.compile(
        r"\b(placeholder|title|aria-label|alt|label)\s*=\s*\"([^\"]*[A-Za-z][^\"]*)\""
    )
    for m in attr_pat.finditer(text):
        val = m.group(2)
        if _is_probably_ok_text(val):
            continue
        snippet = f"{m.group(1)}=\"{val.strip()}\""
        findings.append(Finding(path, "attr-literal", snippet[:120], m.start()))

    # 3) setMessage({ text: '...' }) / setMessage({ text: "..." })
    msg_pat = re.compile(r"\bsetMessage\(\s*\{[^}]*\btext\s*:\s*(['\"])(.+?)\1", re.DOTALL)
    for m in msg_pat.finditer(text):
        val = " ".join(m.group(2).strip().split())
        if _is_probably_ok_text(val):
            continue
        findings.append(Finding(path, "setMessage-text", val[:120], m.start()))

    return findings


def main() -> int:
    root = Path(".")
    files = sorted(root.glob(DRIVER_GLOB))
    all_findings: list[Finding] = []
    for f in files:
        all_findings.extend(scan_file(f))

    # Sort stable for diffability
    all_findings.sort(key=lambda x: (str(x.file), x.kind, x.index))

    print("Driver component files:", len(files))
    print("Findings:", len(all_findings))

    # Show a compact report, grouped by file.
    by_file: dict[Path, list[Finding]] = {}
    for it in all_findings:
        by_file.setdefault(it.file, []).append(it)

    shown = 0
    for file, items in by_file.items():
        print(f"\n{file.as_posix()} ({len(items)})")
        for it in items[:30]:
            print(f"- {it.kind}: {it.snippet}")
            shown += 1
            if shown >= 200:
                print("\n(Truncated after 200 findings)")
                return 1

    return 1 if all_findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
