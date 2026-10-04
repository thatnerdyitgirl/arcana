"""Сводка по базе Манары: уверенность, расхождения, неопределённости.

Запуск: python3 tools/kb_report.py > docs/MANARA-KB-v1-INDEX.md
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / "knowledge" / "manara" / "cards"


def short(value):
    return str(value).split(" ")[0].split("(")[0].strip(" ;,") if value else "—"


def main():
    rows = []
    for path in sorted(ROOT.rglob("MANARA_*.json")):
        card = json.loads(path.read_text())
        vf = card.get("VISUAL_FACT", {})
        conf = card.get("CONFIDENCE", {})
        rows.append({
            "id": card["id"],
            "name": card.get("identity", {}).get("name_ru", ""),
            "visual": short(conf.get("visual")),
            "source": short(conf.get("source")),
            "interpretive": short(conf.get("interpretive")),
            "uncertain": len(vf.get("uncertain", []) or []),
            "not_est": len(vf.get("NOT_ESTABLISHABLE_FROM_IMAGE", []) or []),
            "disagree": len(card.get("SOURCE_DISAGREEMENT", []) or []),
            "sources": len({s.get("source") for s in card.get("SOURCE_INTERPRETATION", []) if isinstance(s, dict)}),
        })
    print("# Индекс базы Манары v1\n")
    print(f"Карт: {len(rows)}\n")
    print("| id | Карта | visual | source | interpretive | источников | uncertain | неустановимо | расхождений |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['id']} | {r['name']} | {r['visual']} | {r['source']} | {r['interpretive']} | {r['sources']} | {r['uncertain']} | {r['not_est']} | {r['disagree']} |")


if __name__ == "__main__":
    main()
