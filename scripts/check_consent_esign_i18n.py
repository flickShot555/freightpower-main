import re
from pathlib import Path


def extract_keys(text: str) -> set[str]:
    keys = set(re.findall(r"\btr\(\s*['\"]([^'\"]+)['\"]", text))
    return keys


def main() -> None:
    files = [
        Path('src/components/driver/ConsentESignature.jsx'),
        Path('src/components/driver/SignDocumentModal.jsx'),
    ]
    translate_file = Path('src/i18n/translate.js')
    tr_text = translate_file.read_text(encoding='utf-8')

    keys: set[str] = set()
    for file in files:
        keys |= extract_keys(file.read_text(encoding='utf-8'))

    prefixes = ('consentEsign.', 'signDocumentModal.')
    keys = {k for k in keys if k.startswith(prefixes)}

    missing = sorted([k for k in keys if ("'" + k + "'") not in tr_text])

    print('Keys referenced:', len(keys))
    print('Missing in translate.js:', len(missing))
    if missing:
        print('First 50 missing:')
        for k in missing[:50]:
            print('-', k)


if __name__ == '__main__':
    main()
