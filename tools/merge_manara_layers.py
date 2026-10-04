#!/usr/bin/env python3
"""Добавляет в карты Манары поля IN_STRENGTH, IN_SHADOW, THEMATIC_LAYERS из knowledge/manara/_layers/<ID>.json.
Только добавление: все прочие поля карты (в том числе RECOGNITION, VISUAL_FACT и тексты) остаются неизменными — это проверяется.
python3 tools/merge_manara_layers.py [ID ...]"""
import json, os, sys, glob, copy
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, "knowledge/manara")
NEW = ("IN_STRENGTH", "IN_SHADOW", "THEMATIC_LAYERS")
def path(i):
    return os.path.join(K, "cards/major", i + ".json") if "_MAJOR_" in i else os.path.join(K, "cards/minor", i.split("_")[1].lower(), i + ".json")
ids = sys.argv[1:] or sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(K, "_layers/*.json")))
done = 0
for i in ids:
    p = path(i); raw = open(p, encoding="utf8").read(); card = json.loads(raw)
    patch = json.load(open(os.path.join(K, "_layers", i + ".json"), encoding="utf8"))
    before = copy.deepcopy({k: v for k, v in card.items() if k not in NEW})
    out = {}
    for k, v in card.items():
        if k in NEW: continue
        out[k] = v
        if k == "ARCANA_SYNTHESIS":
            for n in NEW: out[n] = patch[n]
    for n in NEW: out.setdefault(n, patch[n])
    assert {k: v for k, v in out.items() if k not in NEW} == before, f"{i}: изменены существующие поля"
    json.dump(out, open(p, "w", encoding="utf8"), ensure_ascii=False, indent=2); open(p, "a").write("\n" if raw.endswith("\n") else "")
    done += 1
print(f"слитo карт: {done}")
