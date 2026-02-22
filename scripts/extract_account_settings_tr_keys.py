import re
from pathlib import Path


def main() -> None:
    component = Path('src/components/driver/AccountSettings.jsx')
    out_file = Path('extras/account_settings_tr_keys.tsv')
    out_file.parent.mkdir(parents=True, exist_ok=True)

    text = component.read_text(encoding='utf-8')

    # Best-effort extraction: captures tr('key') and tr('key', 'fallback')
    # Fallback is only captured when it's a simple string literal.
    pattern = re.compile(
        r"\btr\(\s*['\"]([^'\"]+)['\"](?:\s*,\s*['\"]([^'\"]*)['\"])?\s*\)",
        re.MULTILINE,
    )

    first_fallback: dict[str, str] = {}
    for match in pattern.finditer(text):
        key = match.group(1)
        fallback = match.group(2) or ''
        if key not in first_fallback:
            first_fallback[key] = fallback

    keys = sorted(first_fallback)
    missing_literal_fallback = [k for k in keys if not first_fallback[k]]

    lines = ["key\tfallback"]
    for key in keys:
        fb = first_fallback[key].replace('\t', ' ').replace('\n', ' ')
        lines.append(f"{key}\t{fb}")

    out_file.write_text("\n".join(lines) + "\n", encoding='utf-8')

    print('Extracted keys:', len(keys))
    print('Wrote:', out_file.as_posix())
    print('Keys without literal fallback:', len(missing_literal_fallback))
    if missing_literal_fallback:
        print('First 25 without literal fallback:')
        for k in missing_literal_fallback[:25]:
            print('-', k)


if __name__ == '__main__':
    main()
