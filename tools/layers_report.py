#!/usr/bin/env python3
"""Отчёт по слоям Манары: python3 tools/layers_report.py            — статистика по всей базе
                           python3 tools/layers_report.py show ID   — карта во всех шести категориях"""
import json, os, sys, re, glob, itertools, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from validate_manara_layers import ALL, path, CATS, EROS, sim
NAMES = {"relationships": "Отношения", "work": "Работа и бизнес", "decision": "Решения и перемены", "self_development": "Саморазвитие", "psychology": "Психология", "creative": "Творчество"}
def card(i): return json.load(open(path(i), encoding="utf8"))
if len(sys.argv) > 2 and sys.argv[1] == "show":
    for i in sys.argv[2:]:
        c = card(i); print(f"\n=== {i} · {c['identity']['name_ru']}\nВ силе: {c['IN_STRENGTH']}\nВ тени: {c['IN_SHADOW']}")
        for k in CATS:
            e = c["THEMATIC_LAYERS"][k]; print(f"\n[{NAMES[k]}] ({e['fit']}; {', '.join(e['focus'])}; опора: {e['anchor']['layer']})\n  {e['text']}")
    sys.exit()
fit = collections.Counter(); eros = collections.Counter(); maxsim = []; n = 0; missing = []
firsts = collections.Counter(); lens_s = []; lens_h = []; shared_focus = collections.Counter()
for i in ALL:
    try: c = card(i)
    except Exception: continue
    if "THEMATIC_LAYERS" not in c: missing.append(i); continue
    n += 1; T = c["THEMATIC_LAYERS"]
    for k in CATS:
        fit[(k, T[k]["fit"])] += 1; firsts[T[k]["text"].split()[0].lower()] += 1
        if EROS.search(T[k]["text"]): eros[k] += 1
        for f in T[k]["focus"]: shared_focus[(k, f)] += 1
    maxsim.append(max(sim(T[a]["text"], T[b]["text"]) for a, b in itertools.combinations(CATS, 2)))
    lens_s.append(len(c["IN_STRENGTH"])); lens_h.append(len(c["IN_SHADOW"]))
print(f"карт со слоями: {n} из {len(ALL)}" + (f"; без слоёв: {len(missing)}" if missing else ""))
print("fit по категориям (strong/partial/weak):")
for k in CATS: print(f"  {NAMES[k]:20s}", *(f"{f}={fit[(k, f)]}" for f in ("strong", "partial", "weak")), f"| доля текстов с эротической лексикой: {eros[k] / max(1, n):.0%}")
print(f"макс. сходство между категориями внутри карты: среднее {sum(maxsim)/len(maxsim):.2f}, худшее {max(maxsim):.2f}")
print(f"длина IN_STRENGTH: среднее {sum(lens_s)//len(lens_s)}, IN_SHADOW: среднее {sum(lens_h)//len(lens_h)} знаков")
print("самые частые первые слова категорий:", firsts.most_common(5))
