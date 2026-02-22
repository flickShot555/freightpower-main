import re
from pathlib import Path


def main() -> None:
    marketplace_file = Path('src/components/driver/Marketplace.jsx')
    translate_file = Path('src/i18n/translate.js')

    mp_text = marketplace_file.read_text(encoding='utf-8')
    tr_text = translate_file.read_text(encoding='utf-8')

    keys = set(re.findall(r"\btr\(\s*['\"](marketplace\.[^'\"]+)['\"]", mp_text))
    keys |= set(re.findall(r"\bkey\s*:\s*['\"](marketplace\.[^'\"]+)['\"]", mp_text))
    keys = {k for k in keys if k.startswith('marketplace.')}

    missing = sorted([k for k in keys if ("'" + k + "'") not in tr_text])

    print('Marketplace keys referenced:', len(keys))
    print('Missing in translate.js:', len(missing))
    if missing:
        print('First 50 missing:')
        for k in missing[:50]:
            print('-', k)


if __name__ == '__main__':
    main()
