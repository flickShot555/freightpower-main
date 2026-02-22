import re
from pathlib import Path


def extract_keys(text: str) -> set[str]:
    return set(re.findall(r"\btr\(\s*['\"]([^'\"]+)['\"]", text))


def main() -> None:
    files = [Path('src/components/driver/Messaging.jsx')]
    translate_file = Path('src/i18n/translate.js')
    translate_text = translate_file.read_text(encoding='utf-8')

    keys: set[str] = set()
    for file in files:
        keys |= extract_keys(file.read_text(encoding='utf-8'))

    keys = {k for k in keys if k.startswith('messaging.')}
    missing = sorted([k for k in keys if ("'" + k + "'") not in translate_text])

    print('Keys referenced:', len(keys))
    print('Missing in translate.js:', len(missing))
    if missing:
        print('First 50 missing:')
        for k in missing[:50]:
            print('-', k)


if __name__ == '__main__':
    main()
