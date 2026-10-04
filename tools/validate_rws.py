#!/usr/bin/env python3
"""Валидатор базы RWS: python3 tools/validate_rws.py [id ...]  (без аргументов — все найденные карты)."""
import json, sys, glob, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
K = os.path.join(ROOT, "knowledge")
SUITS = ["WANDS", "CUPS", "SWORDS", "PENTACLES"]
COURTS = ["PAGE", "KNIGHT", "QUEEN", "KING"]
RANKS = [f"{i:02d}" for i in range(1, 11)] + COURTS
ALL_IDS = [f"RWS_MAJOR_{i:02d}" for i in range(22)] + [f"RWS_{s}_{r}" for s in SUITS for r in RANKS]
MODES = {"blocked", "excess", "distorted", "internal", "delayed", "hard_to_express"}
LINK_TYPES = {"reinforce", "contradict", "transition", "cause_effect", "inner_outer", "resource_obstacle", "motif"}
POSITIONS = ["present", "blind_spot", "influence", "obstacle", "resource", "understand", "tendency", "advice", "shadow"]
SOURCES = set(json.load(open(os.path.join(K, "sources/rws-sources.json")))["sources"])
CTX = {r["id"] for r in json.load(open(os.path.join(K, "context/context-rules.json")))["rules"]}
TOPICS = {"relationships", "work", "decision", "self"}
BAD = re.compile(r"тебя ждёт|тебя ждет|обязательно случится|точно будет|он вернётся|она вернётся|он вернется|она вернется|непременно|судьба решила|неизбежно случится|оборотен|Манар|эротич", re.I)

def path(i):
    if i.startswith("RWS_MAJOR_"): return os.path.join(K, "rws/cards/major", i + ".json")
    return os.path.join(K, "rws/cards/minor", i.split("_")[1].lower(), i + ".json")

def text_of(v):
    if isinstance(v, str): return v
    if isinstance(v, list): return " ".join(text_of(x) for x in v)
    if isinstance(v, dict): return " ".join(text_of(x) for x in v.values())
    return ""

def check(i):
    p, errs = path(i), []
    if not os.path.exists(p): return ["нет файла"]
    try: c = json.load(open(p))
    except Exception as e: return [f"битый JSON: {e}"]
    E = errs.append
    if c.get("id") != i or c.get("deck") != "RWS": E("id/deck не совпадают")
    for k in ["identity", "RECOGNITION", "VISUAL_FACT", "TRADITIONAL_MEANING", "SOURCE_DISAGREEMENT", "ARCANA_SYNTHESIS", "POSITIONAL_APPLICATION", "REVERSED", "CARD_LINKS", "COMMON_MODEL_ERRORS", "WHAT_THIS_CARD_IS_NOT", "tone_guards", "CONFIDENCE", "review"]:
        if k not in c: E(f"нет блока {k}")
    ident = c.get("identity", {})
    for k in ["number", "name_ru", "name_en", "aliases_ru", "arcana", "element"]:
        if k not in ident: E(f"identity.{k}")
    if len(ident.get("aliases_ru", [])) < 2: E("identity.aliases_ru: нужно ≥2 (для парсера)")
    r = c.get("RECOGNITION", {})
    if len(r.get("signature", "")) < 80: E("RECOGNITION.signature короткий")
    if len(r.get("unique_markers", [])) < 3: E("RECOGNITION.unique_markers <3")
    if not r.get("if_you_see_this_it_is_NOT_this_card"): E("RECOGNITION.if_you_see_this_it_is_NOT_this_card пуст")
    v = c.get("VISUAL_FACT", {})
    syms = v.get("symbols", [])
    if len(syms) < 3: E("VISUAL_FACT.symbols <3")
    for s in syms:
        if s.get("source") not in SOURCES: E(f"symbol source: {s.get('source')}")
        if not s.get("tradition_reading"): E("symbol без tradition_reading")
    t = c.get("TRADITIONAL_MEANING", {})
    for k in ["summary", "keywords", "upright_resource", "upright_shadow", "sources"]:
        if not t.get(k): E(f"TRADITIONAL_MEANING.{k}")
    for s in t.get("sources", []):
        if s.get("source") not in SOURCES: E(f"TRADITIONAL_MEANING source: {s.get('source')}")
    a = c.get("ARCANA_SYNTHESIS", {})
    for k in ["core_reading", "resource", "shadow", "relationships", "work_money", "self_development", "psychology", "decision", "advice", "reflection_questions", "small_actions", "context_lenses"]:
        if not a.get(k): E(f"ARCANA_SYNTHESIS.{k} пуст")
    lenses = a.get("context_lenses", [])
    if len(lenses) < 4: E("context_lenses: нужно ≥4")
    cov = set()
    for L in lenses:
        w = L.get("when", [])
        if not w or any(x not in CTX for x in w): E(f"context_lenses.when: неизвестные теги {[x for x in w if x not in CTX]}")
        cov.update(w)
        if len(L.get("text", "")) < 90: E("context_lens.text короткий (<90)")
        if not L.get("question") or not L.get("action"): E("context_lens без question/action")
    pa = c.get("POSITIONAL_APPLICATION", {})
    for pos in POSITIONS:
        slot = pa.get(pos)
        if not slot or not slot.get("default"): E(f"POSITIONAL_APPLICATION.{pos}.default")
        else:
            for k in slot:
                if k != "default" and k not in TOPICS: E(f"POSITIONAL_APPLICATION.{pos}.{k}: допустимы {sorted(TOPICS)}")
    rv = c.get("REVERSED", {})
    if rv.get("primary_mode") not in MODES: E("REVERSED.primary_mode")
    modes = rv.get("modes", {})
    if len(modes) < 3: E("REVERSED.modes: нужно ≥3")
    if rv.get("primary_mode") not in modes: E("REVERSED.primary_mode отсутствует в modes")
    for m, tx in modes.items():
        if m not in MODES: E(f"REVERSED.mode {m}")
        if len(tx) < 60: E(f"REVERSED.modes.{m} короткий")
    for k in ["resource", "advice", "question"]:
        if not rv.get(k): E(f"REVERSED.{k}")
    ls = c.get("CARD_LINKS", [])
    if len(ls) < 4: E("CARD_LINKS: нужно ≥4")
    for l in ls:
        if l.get("with") not in ALL_IDS or l.get("with") == i: E(f"CARD_LINKS.with: {l.get('with')}")
        if l.get("type") not in LINK_TYPES: E(f"CARD_LINKS.type: {l.get('type')}")
        if l.get("order") not in ("any", "this_first", "this_second"): E("CARD_LINKS.order")
        if len(l.get("claim", "")) < 40: E("CARD_LINKS.claim короткий")
        if l.get("source") not in SOURCES: E(f"CARD_LINKS.source: {l.get('source')}")
    if len({l.get("type") for l in ls}) < 3: E("CARD_LINKS: нужно ≥3 разных типа связей")
    if len(c.get("COMMON_MODEL_ERRORS", [])) < 3: E("COMMON_MODEL_ERRORS <3")
    m = BAD.search(text_of({k: v for k, v in c.items() if k not in ("COMMON_MODEL_ERRORS", "WHAT_THIS_CARD_IS_NOT", "tone_guards", "SOURCE_DISAGREEMENT", "CARD_LINKS")}))
    if m: E(f"запрещённая формулировка: «{m.group(0)}»")
    return errs

if __name__ == "__main__":
    ids = sys.argv[1:] or [i for i in ALL_IDS if os.path.exists(path(i))]
    bad = 0
    for i in ids:
        e = check(i)
        if e:
            bad += 1; print(f"✗ {i}"); [print("   -", x) for x in e]
    print(f"\nКарт проверено: {len(ids)}; с проблемами: {bad}; всего в колоде {len(ALL_IDS)}; файлов {sum(os.path.exists(path(i)) for i in ALL_IDS)}")
    sys.exit(1 if bad else 0)
