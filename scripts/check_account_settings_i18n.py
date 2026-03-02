import re
import sys
from pathlib import Path


LANGS = ("English", "Spanish", "Arabic")


def extract_tr_keys(text: str) -> set[str]:
    return set(re.findall(r"\btr\(\s*['\"]([^'\"]+)['\"]", text))


def extract_dict_keys_for_language(translate_text: str, language: str) -> set[str]:
    marker = f"{language}: {{"
    start = translate_text.find(marker)
    if start == -1:
        raise ValueError(f"Could not find language block for: {language}")

    start_brace = translate_text.find("{", start)
    if start_brace == -1:
        raise ValueError(f"Could not find opening brace for: {language}")

    # Heuristic: slice until the next language marker.
    next_positions: list[int] = []
    for next_lang in LANGS:
        if next_lang == language:
            continue
        pos = translate_text.find(f"{next_lang}: {{", start_brace + 1)
        if pos != -1:
            next_positions.append(pos)

    end = min(next_positions) if next_positions else len(translate_text)
    section = translate_text[start_brace + 1 : end]

    # Extract keys like:  'some.key': 'value',
    return set(re.findall(r"['\"]([^'\"]+)['\"]\s*:\s*", section))


def main() -> int:
    component_files = [Path("src/components/driver/AccountSettings.jsx")]
    translate_file = Path("src/i18n/translate.js")

    translate_text = translate_file.read_text(encoding="utf-8")

    referenced: set[str] = set()
    for file in component_files:
        referenced |= extract_tr_keys(file.read_text(encoding="utf-8"))

    dict_keys_by_lang = {lang: extract_dict_keys_for_language(translate_text, lang) for lang in LANGS}

    missing_by_lang: dict[str, list[str]] = {}
    for lang in LANGS:
        missing = sorted([k for k in referenced if k not in dict_keys_by_lang[lang]])
        missing_by_lang[lang] = missing

    missing_total = sum(len(v) for v in missing_by_lang.values())

    print("Keys referenced:", len(referenced))
    for lang in LANGS:
        print(f"Missing in {lang}:", len(missing_by_lang[lang]))

    if missing_total:
        print("\nFirst 100 missing per language:")
        for lang in LANGS:
            missing = missing_by_lang[lang]
            if not missing:
                continue
            print(f"\n[{lang}]")
            for k in missing[:100]:
                print("-", k)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
