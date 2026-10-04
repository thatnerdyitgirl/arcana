#!/usr/bin/env python3
"""Аудит дублей внутри карт: одна и та же формулировка в нескольких полях. python3 tools/kb_dupes.py [MANARA|RWS] [--fix]"""
import json, glob, re, sys, collections, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
deck = next((a for a in sys.argv[1:] if a in ("MANARA", "RWS")), None)
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"[^а-яa-z0-9 ]+", " ", s.lower().replace("ё", "е"))).strip()
toks = lambda s: {w for w in norm(s).split() if len(w) > 2}
def sim(a, b):
    A, B = toks(a), toks(b)
    if not A or not B: return False
    i = len(A & B); small, big = min(len(A), len(B)), max(len(A), len(B))
    return i / big >= 0.8 or (small >= 5 and i / small >= 0.95)
SKIP = {"_status", "status", "applies_when", "basis", "source", "type", "layer", "order", "with", "id", "deck", "schema_version"}
def leaves(v, path=""):
    if isinstance(v, str):
        if len(v) > 30: yield path, v
    elif isinstance(v, list):
        for i, x in enumerate(v): yield from leaves(x, f"{path}[{i}]")
    elif isinstance(v, dict):
        for k, x in v.items():
            if k in SKIP: continue
            yield from leaves(x, f"{path}.{k}" if path else k)
SHOWN = ("ARCANA_SYNTHESIS", "POSITIONAL_APPLICATION", "REVERSED")
pairs = collections.Counter(); total = 0; cards = 0; examples = []
for f in sorted(glob.glob(os.path.join(ROOT, "knowledge/*/cards/**/*.json"), recursive=True)):
    c = json.load(open(f))
    if deck and c.get("deck", "").upper() != deck: continue
    cards += 1
    items = [(p, t) for k in SHOWN for p, t in leaves({k: c.get(k)})]
    for i in range(len(items)):
        for j in range(i + 1, len(items)):
            (pa, ta), (pb, tb) = items[i], items[j]
            ga, gb = re.sub(r"\[\d+\]", "", pa), re.sub(r"\[\d+\]", "", pb)
            if ga == gb: continue                      # варианты одного поля — не дубль
            if sim(ta, tb):
                total += 1; pairs[tuple(sorted((ga.split(".")[0] + "." + ga.split(".")[1] if "." in ga else ga, gb.split(".")[0] + "." + gb.split(".")[1] if "." in gb else gb)))] += 1
                if len(examples) < 6: examples.append((os.path.basename(f), pa, pb, ta[:90]))
print(f"карт: {cards}; пар почти одинаковых строк в разных полях: {total}")
for (a, b), n in pairs.most_common(12): print(f"  {n:4d}  {a}  ≈  {b}")
for e in examples: print("  пример:", *e)
