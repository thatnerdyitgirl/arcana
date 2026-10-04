#!/usr/bin/env python3
"""Проверка слоёв Манары: python3 tools/validate_manara_layers.py [--patches] [ID ...]
--patches: проверять файлы _layers (до слияния); иначе — сами карты."""
import json, os, sys, re, glob, itertools
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, "knowledge/manara")
CATS = ["relationships", "work", "decision", "self_development", "psychology", "creative"]
FIT = {"strong", "partial", "weak"}
LAYERS = {"VISUAL_FACT", "SOURCE", "SYNTHESIS"}
SUITS = ["FIRE", "WATER", "AIR", "EARTH"]; RANKS = [f"{i:02d}" for i in range(1, 11)] + ["KNAVE", "KNIGHT", "QUEEN", "KING"]
ALL = [f"MANARA_MAJOR_{i:02d}" for i in range(22)] + [f"MANARA_{s}_{r}" for s in SUITS for r in RANKS]
BAD = re.compile(r"Гипотеза Arcana|не утверждается ничего|тебя ждёт|тебя ждет|обязательно случится|точно будет|он вернётся|она вернётся|непременно|неизбежно случится|жертва сама виновата|сама напросилась|диагноз|расстройство личности", re.I)
EROS = re.compile(r"эрот|секс|обнаж|страст|влечен|соблазн|желан|притяжен|телесн", re.I)
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"[^а-яa-z0-9 ]+", " ", s.lower().replace("ё", "е"))).strip()
toks = lambda s: {w for w in norm(s).split() if len(w) > 3}
def sim(a, b):
    A, B = toks(a), toks(b)
    return len(A & B) / max(1, min(len(A), len(B)))
def path(i): return os.path.join(K, "cards/major", i + ".json") if "_MAJOR_" in i else os.path.join(K, "cards/minor", i.split("_")[1].lower(), i + ".json")
def load(i, patches):
    p = os.path.join(K, "_layers", i + ".json") if patches else path(i)
    return json.load(open(p, encoding="utf8")) if os.path.exists(p) else None
def check(i, patches):
    c = load(i, patches)
    if c is None: return ["нет файла"]
    E = []; add = E.append
    s, sh = c.get("IN_STRENGTH", ""), c.get("IN_SHADOW", "")
    for name, t in (("IN_STRENGTH", s), ("IN_SHADOW", sh)):
        if not (30 <= len(t) <= 150): add(f"{name}: длина {len(t)} (нужно 30–150)")
        if t.count(". ") + t.count("; ") > 1: add(f"{name}: должна быть короткая фраза, а не трактовка")
    if s and sh and sim(s, sh) > 0.45: add("IN_STRENGTH и IN_SHADOW слишком похожи (тень — не «наоборот» силы)")
    T = c.get("THEMATIC_LAYERS", {})
    texts = {}
    for k in CATS:
        e = T.get(k)
        if not e: add(f"нет категории {k}"); continue
        t = e.get("text", ""); texts[k] = t
        if not (90 <= len(t) <= 460): add(f"{k}: длина текста {len(t)} (90–460)")
        if not 2 <= len(e.get("focus", [])) <= 4: add(f"{k}: focus 2–4 тега")
        if e.get("fit") not in FIT: add(f"{k}: fit")
        a = e.get("anchor", {})
        if not a.get("note") or not all(x in LAYERS for x in re.split(r"\+", a.get("layer", "")) if x): add(f"{k}: anchor.layer/note")
        if BAD.search(t): add(f"{k}: запрещённая формулировка «{BAD.search(t).group(0)}»")
        if e.get("fit") == "strong" and a.get("layer") == "SYNTHESIS": add(f"{k}: fit=strong, но опора только SYNTHESIS — поставь partial/weak")
    for a, b in itertools.combinations(texts, 2):
        if sim(texts[a], texts[b]) > 0.5: add(f"{a} и {b} повторяют друг друга (сходство {sim(texts[a], texts[b]):.2f})")
    if sum(1 for t in texts.values() if EROS.search(t)) > 3: add("слишком много категорий сведены к эротике (>3 из 6)")
    if len({texts[k][:25] for k in texts}) < len(texts): add("одинаковое начало текстов разных категорий")
    return E
if __name__ == "__main__":
    patches = "--patches" in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or ([os.path.basename(f)[:-5] for f in sorted(glob.glob(os.path.join(K, "_layers/*.json")))] if patches else ALL)
    bad = 0
    for i in ids:
        e = check(i, patches)
        if e: bad += 1; print("✗", i); [print("   -", x) for x in e]
    print(f"\nпроверено: {len(ids)}; с проблемами: {bad}")
    sys.exit(1 if bad else 0)
