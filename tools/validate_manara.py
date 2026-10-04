"""Проверка базы карт Манары на соответствие стандарту schema 0.3.

Запуск: python3 tools/validate_manara.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "knowledge" / "manara" / "cards"

MAJORS = [f"major/MANARA_MAJOR_{n:02d}.json" for n in range(22)]
RANKS = [f"{n:02d}" for n in range(1, 11)] + ["KNAVE", "KNIGHT", "QUEEN", "KING"]
MINORS = [f"minor/{s.lower()}/MANARA_{s}_{r}.json" for s in ["FIRE", "WATER", "AIR", "EARTH"] for r in RANKS]

REQUIRED = [
    "id", "deck", "schema_version", "identity", "RECOGNITION", "VISUAL_FACT",
    "SOURCE_INTERPRETATION", "TRADITIONAL_MEANING", "ARCANA_SYNTHESIS",
    "POSITIONAL_APPLICATION", "DIFFERENCE_FROM_RWS", "COMMON_MODEL_ERRORS",
    "WHAT_THIS_CARD_IS_NOT", "EDITORIAL_NOTE", "CONFIDENCE",
]
POSITIONS = ["present", "blind_spot", "influence", "obstacle", "resource", "understand", "tendency", "advice", "shadow"]
CONFIDENCE_KEYS = ["visual", "source", "interpretive"]
FORBIDDEN = [r"это означает, что ты", r"ты должна", r"успокойся", r"делулу", r"обязательно случится"]
# Упоминания RWS допустимы только в этих полях
RWS_ALLOWED = {"DIFFERENCE_FROM_RWS", "COMMON_MODEL_ERRORS", "RECOGNITION", "identity", "VISUAL_FACT", "SOURCE_NOTES", "SOURCE_DISAGREEMENT", "WHAT_THIS_CARD_IS_NOT"}
RWS_PATTERN = re.compile(r"\bRWS\b|Уэйт|Rider", re.IGNORECASE)


def check(path):
    problems = []
    try:
        card = json.loads(path.read_text())
    except Exception as exc:
        return [f"невалидный JSON: {exc}"]
    for key in REQUIRED:
        if key not in card:
            problems.append(f"нет поля {key}")
    pa = card.get("POSITIONAL_APPLICATION", {})
    missing = [p for p in POSITIONS if p not in pa]
    if missing:
        problems.append(f"нет позиций: {', '.join(missing)}")
    conf = card.get("CONFIDENCE", {})
    if not all(k in conf for k in CONFIDENCE_KEYS):
        problems.append("CONFIDENCE без visual/source/interpretive")
    for hyp in card.get("ARCANA_SYNTHESIS", {}).get("psychology", []) or []:
        if isinstance(hyp, dict) and not all(k in hyp for k in ("status",)):
            problems.append("гипотеза без status")
    text = json.dumps(card, ensure_ascii=False).lower()
    for pattern in FORBIDDEN:
        if re.search(pattern, text):
            problems.append(f"запрещённая формулировка: «{pattern}»")
    for key, value in card.items():
        if key in RWS_ALLOWED:
            continue
        if key == "SOURCE_INTERPRETATION" and isinstance(value, list):
            value = [v for v in value if not (isinstance(v, dict) and v.get("rws_contamination"))]
        if RWS_PATTERN.search(json.dumps(value, ensure_ascii=False)):
            problems.append(f"упоминание RWS вне разрешённых полей: {key}")
    return problems


def main():
    total_problems = 0
    for rel in MAJORS + MINORS:
        path = ROOT / rel
        if not path.exists():
            print(f"НЕТ ФАЙЛА  {rel}")
            total_problems += 1
            continue
        problems = check(path)
        if problems:
            total_problems += len(problems)
            print(f"ПРОБЛЕМЫ   {rel}: " + "; ".join(problems))
    print(f"\nКарт ожидается: {len(MAJORS) + len(MINORS)}; проблем: {total_problems}")
    sys.exit(1 if total_problems else 0)


if __name__ == "__main__":
    main()
