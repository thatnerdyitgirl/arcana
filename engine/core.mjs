// Arcana — ядро движка анализа расклада (без ИИ, без Node). Колода: Манара.
// Данные передаются через init(data): { elements, pairs, spreads, cards: { [id]: card } }.
// Все выводы помечаются слоем: VISUAL_FACT / SOURCE / TRADITION / ARCANA_SYNTHESIS / CALCULATION.

import { THEMES, themesOf, cardText, valenceOf, questionLean } from "./themes.mjs";
import { LENS_BY_THEME, LENS_NOTE, LENS_QUESTION, applyLens } from "./lenses.mjs";
import { cmpFlow, buildScreen, cmpLayer, cmpLayerKey } from "./compose.mjs";
import { scanSubject, adaptCard, situationFrame, romanticFilter, cardFacets } from "./adapt.mjs";

let DATA = null;
let ELEMENTS = null;
let ELEMENTS_RWS = null;
let REVERSAL = null;
let PAIRS = [];
let CONTEXT = [];
let META_VEC = null;
let SEMANTIC = { groups: [], level_weights: {} };
export let SPREADS = [];

// Связи CARD_LINKS карт RWS → пары сочетаний (каждая пара один раз; порядок учитывается)
function linkPairs(cards = {}) {
  const out = [], seen = new Set();
  for (const [id, c] of Object.entries(cards)) {
    if (deckOf(id) !== "RWS") continue;
    for (const l of c.CARD_LINKS ?? []) {
      const [a, b] = l.order === "this_second" ? [l.with, id] : [id, l.with];
      const key = [a, b, l.type, l.order === "any" ? "any" : "ord"].sort().join("|");
      if (seen.has(key)) continue; seen.add(key);
      out.push({ a, b, ordered: l.order !== "any", type: "synthesis", rel: l.type, source: l.source, claim: l.claim });
    }
  }
  return out;
}

export function init(data) {
  DATA = data;
  ELEMENTS = data.elements;
  ELEMENTS_RWS = data.elementsRws ?? data.elements;
  REVERSAL = data.reversal ?? null;
  PAIRS = [...data.pairs, ...linkPairs(data.cards)];
  CONTEXT = data.context ?? [];
  META_VEC = data.meta ?? null;
  SEMANTIC = data.semantic ?? SEMANTIC;
  SEM_RE = null;
  SPREADS = data.spreads;
}

const SUITS = ["FIRE", "WATER", "AIR", "EARTH"];           // стихии (общий ключ для анализа)
const COURTS = ["KNAVE", "KNIGHT", "QUEEN", "KING"];
const COURT_RANK = { KNAVE: 11, PAGE: 11, KNIGHT: 12, QUEEN: 13, KING: 14 };
// Две отдельные системы. Масти RWS отображаются на стихии только для анализа стихий (Golden Dawn); значения не смешиваются.
export const DECKS = {
  MANARA: { id: "MANARA", label: "Манара", full: "Таро Манара (Lo Scarabeo)", suits: SUITS, courts: COURTS, elementOf: (s) => s, reversals: false },
  RWS: { id: "RWS", label: "Райдер–Уэйт", full: "Таро Райдера–Уэйта–Смит", suits: ["WANDS", "CUPS", "SWORDS", "PENTACLES"], courts: ["PAGE", "KNIGHT", "QUEEN", "KING"],
    elementOf: (s) => ({ WANDS: "FIRE", CUPS: "WATER", SWORDS: "AIR", PENTACLES: "EARTH" })[s], reversals: true },
};
export const deckOf = (id) => String(id).split("_")[0];
const ROLE_TITLES = { situation: "Что происходит", influence: "Что влияет", notice: "Что важно заметить", action: "Что можно сделать" };

// ---------- утилиты ----------

const digitSum = (n) => String(n).split("").reduce((s, d) => s + Number(d), 0);
const firstSentence = (t) => (t ? (String(t).match(/^.+?[.!?](\s|$)/)?.[0] ?? String(t)).trim() : "");
// Инфинитив в начале фразы («Цепляться…»), но не существительное на «-ость/-сть» («Отстранённость…»)
const isInfinitive = (t) => {
  const m = String(t).match(/^(?:Мысленно\s+)?([А-ЯЁа-яё]+)(?=[\s,.;:]|$)(.*)/);
  return !!m && /(?:ть|ться|ти)$/.test(m[1]) && !/сть$/.test(m[1]) && !/ости$/.test(m[1]) && !/^\s+(?:может|могут|можно|стоит|нужно)(?=[\s,.;:]|$)/i.test(m[2]);     // «Мешать может…» — не инфинитив-действие
};
const lowerFirst = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const clean = (t) => (t ? String(t).replace(/\s*\((?:[^()]*\bsrc\.[^()]*)\)/g, "").replace(/\s{2,}/g, " ").trim() : t);
const META = /изображени|источник|базовый текст|lunaro|tarotman|src\./i;
const RELATIONAL = /связ|партн|отношени|флирт|любов|влюбл|союз|близост/i;
const textOf = (v) => (typeof v === "string" ? v : Array.isArray(v) ? textOf(v[0]) : v?.hypothesis ?? v?.q ?? v?.action ?? v?.default ?? "");

// ---------- загрузка карт ----------

export function loadCard(id) {
  const card = DATA.cards[id];
  if (!card) throw new Error(`нет карты ${id}`);
  const [deck, group, rank] = id.split("_");
  const isMajor = group === "MAJOR";
  const D = DECKS[deck];
  return {
    id, card, deck,
    name: card.identity?.name_ru ?? id,
    isMajor,
    element: isMajor ? null : D.elementOf(group),
    suit: isMajor ? null : group,
    court: !isMajor && D.courts.includes(rank) ? rank : null,
    number: isMajor ? Number(rank) : D.courts.includes(rank) ? null : Number(rank),
  };
}

export function allCardIds(deck = "MANARA") {
  const D = DECKS[deck];
  const ranks = [...Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0")), ...D.courts];
  return [
    ...Array.from({ length: 22 }, (_, i) => `${deck}_MAJOR_${String(i).padStart(2, "0")}`),
    ...D.suits.flatMap((s) => ranks.map((r) => `${deck}_${s}_${r}`)),
  ];
}
export const majorIds = (deck = "MANARA") => Array.from({ length: 22 }, (_, i) => `${deck}_MAJOR_${String(i).padStart(2, "0")}`);

// ---------- текст карты в позиции ----------

function readField(c, ref, topic) {
  const [kind, key] = ref.split(":");
  if (kind === "PA") {
    const slot = c.card.POSITIONAL_APPLICATION?.[key] ?? {};
    return slot[topic] ?? slot.default ?? null;
  }
  return textOf(c.card.ARCANA_SYNTHESIS?.[key]) || null;
}

// Перевёрнутая карта RWS: та же энергия в изменённом состоянии (режимы), а не «значение наоборот»
export function reversalMode(c, question = "") {
  const rv = c.card.REVERSED;
  if (!rv) return null;
  const t = normText(question);
  for (const [mode, def] of Object.entries(REVERSAL?.modes ?? {})) {
    if (rv.modes?.[mode] && (def.select_stems ?? []).some((st) => t.includes(st))) return mode;
  }
  return rv.primary_mode;
}

export function cardInPosition(c, position, topic, question = "") {
  if (c.deck === "RWS" && c.reversed && c.card.REVERSED) {
    const rv = c.card.REVERSED, mode = reversalMode(c, question);
    const role = position.read.join(" ");
    const text = /PA:resource/.test(role) ? rv.resource : /PA:advice/.test(role) ? rv.advice : rv.modes[mode];
    return { text: clean(text), from: `REVERSED:${mode}`, mode };
  }
  for (const ref of position.read) {
    let text = readField(c, ref, topic), from = ref;
    if (!text) continue;
    // Мета-комментарий базы («изображение не говорит…», ссылки на источники) — не для краткого ответа
    if (ref === "SYN:core_reading" && META.test(text)) {
      const alt = c.card.POSITIONAL_APPLICATION?.present?.default;
      if (alt) { text = alt; from = "PA:present"; }
    }
    // Манара написана языком отношений: в вопросах о работе/решении берём рабочий слой карты
    if (c.deck === "MANARA" && (topic === "work" || topic === "decision") && RELATIONAL.test(text) && c.card.ARCANA_SYNTHESIS?.work_decision) {
      text = c.card.ARCANA_SYNTHESIS.work_decision; from = `SYN:work_decision (вместо ${ref})`;
    }
    return { text: clean(text), from };
  }
  return { text: null, from: null };
}

// ---------- квинтэссенция ----------

function reduceDigits(n) { const steps = [n]; while (n > 22) { n = digitSum(n); steps.push(n); } return { result: n, steps }; }
function reduceSubtract(n) { const steps = [n]; while (n > 22) { n -= 22; steps.push(n); } return { result: n, steps }; }

export const QUINT_METHODS = {
  banzhaf: { label: "Банцхаф (придворные 0, Шут 22, сумма цифр)", value: (c) => (c.isMajor ? c.number || 22 : c.court ? 0 : c.number), include: () => true, reduce: reduceDigits, levels: true },
  subtract22: { label: "Вычитание 22 (придворные 0)", value: (c) => (c.court ? 0 : c.number), include: () => true, reduce: reduceSubtract },
  majorsOnly: { label: "Только старшие (tirage en croix)", value: (c) => c.number || 22, include: (c) => c.isMajor, reduce: reduceDigits },
  courts11to14: { label: "Банцхаф, придворные 11–14", value: (c) => (c.isMajor ? c.number || 22 : c.court ? COURT_RANK[c.court] : c.number), include: () => true, reduce: reduceDigits },
};

const majorId = (n, deck = "MANARA") => `${deck}_MAJOR_${String(n === 22 ? 0 : n).padStart(2, "0")}`;

export function quintessence(cards, key) {
  const m = QUINT_METHODS[key];
  const used = cards.filter(m.include);
  if (!used.length) return { key, method: m.label, note: "нет карт для расчёта" };
  const values = used.map(m.value);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return { key, method: m.label, note: "сумма 0 — метод не даёт результата" };
  const { result, steps } = m.reduce(sum);
  const levels = [result];
  for (let x = result; m.levels && x >= 10;) { x = digitSum(x); levels.push(x); }
  const nonZero = used.filter((c) => m.value(c) !== 0);
  const deck = cards[0].deck;
  const repeats = cards.find((c) => c.id === majorId(result, deck));
  const note2 = nonZero.length === 1 ? `расчёт фактически опирается на одну карту (${nonZero[0].name}) — слабый сигнал`
    : repeats ? `повторяет карту расклада «${repeats.name}» — тема усиливается` : null;
  return {
    key, method: m.label, result, cardId: majorId(result, deck), card: loadCard(majorId(result, deck)).name, caveat: note2,
    calculation: `${values.join(" + ")} = ${steps.join(" → ")}`,
    levels: levels.length > 1 ? levels.map((l) => loadCard(majorId(l, deck)).name) : null,
  };
}

// ---------- детекторы ----------

function dignity(a, b) {
  if (a === b) return "same";
  const pair = [a, b].sort().join("+");
  if (ELEMENTS.dignities.friendly.some((p) => [...p].sort().join("+") === pair)) return "friendly";
  if (ELEMENTS.dignities.contrary.some((p) => [...p].sort().join("+") === pair)) return "contrary";
  return "neutral";
}

export function analyze(cards, positions, topic) {
  const f = [];
  const n = cards.length;
  const minors = cards.filter((c) => !c.isMajor);
  const majors = cards.filter((c) => c.isMajor);
  const posName = (c) => positions[cards.indexOf(c)]?.name;

  // Старшие арканы — привязаны к позициям
  if (majors.length) {
    const ratio = majors.length / n;
    f.push({
      detector: "major_density", layer: "TRADITION", main: ratio >= 0.6, weight: ratio >= 0.6 ? 3 : 1,
      text: `Старшие арканы в раскладе: ${majors.map((c) => `${c.name} в позиции «${posName(c)}»`).join(", ")}` +
        (ratio >= 0.6 ? " — тема может быть глубже бытовой: это скорее этап, чем эпизод." : "."),
    });
  } else {
    f.push({ detector: "major_density", layer: "TRADITION", main: false, weight: 1, text: "Старших арканов нет — ситуация может быть скорее повседневной, в зоне прямого влияния." });
  }

  // Стихии: в Манаре масть = стихия; в RWS масти отображаются на стихии (Golden Dawn)
  const EL = cards[0]?.deck === "RWS" ? ELEMENTS_RWS : ELEMENTS;
  const rwsDeck = cards[0]?.deck === "RWS";
  const count = Object.fromEntries(SUITS.map((s) => [s, minors.filter((c) => c.element === s).length]));
  if (minors.length >= 2) {
    f.push({ detector: "element_balance", layer: "CALCULATION", main: false, weight: 1, text: "Стихии: " + SUITS.map((s) => `${EL[s].ru} ${count[s]}`).join(" · ") });
    const max = Math.max(...Object.values(count));
    const dom = SUITS.filter((s) => count[s] === max);
    if (max >= 2 && dom.length === 1) {
      const s = dom[0];
      f.push({ detector: "dominant_element", layer: "SOURCE", source: EL[s].source, main: true, weight: 2,
        text: `Преобладает ${EL[s].ru} (${count[s]} карты): ${EL[s].claim}.` });
    }
  }
  if (n >= 4 && minors.length >= 3) {
    const missing = SUITS.filter((s) => count[s] === 0);
    if (missing.length && missing.length < 4) f.push({ detector: "missing_element", layer: "ARCANA_SYNTHESIS", main: false, weight: 1,
      text: `Нет стихии ${missing.map((s) => EL[s].ru).join(", ")} — можно проверить, не недостаёт ли этого в ситуации.` });
  }

  // Достоинства соседних младших — с именами позиций
  for (let i = 0; i < n - 1; i++) {
    const a = cards[i], b = cards[i + 1];
    if (!a.element || !b.element) continue;
    const rel = dignity(a.element, b.element);
    const pa = `«${positions[i].name}»`, pb = `«${positions[i + 1].name}»`;
    const text = {
      same: `${pa} и ${pb} — одна стихия (${EL[a.element].ru}): эти позиции усиливают друг друга.`,
      friendly: `${pa} и ${pb} — дружественные стихии (${EL[a.element].ru} и ${EL[b.element].ru}): эти позиции поддерживают друг друга.`,
      contrary: `${pa} и ${pb} — враждебные стихии (${EL[a.element].ru} и ${EL[b.element].ru}): эти позиции могут тянуть в разные стороны.`,
      neutral: null,
    }[rel];
    if (text) f.push({ detector: "elemental_dignity", layer: "TRADITION", note: rwsDeck ? "Golden Dawn" : "Golden Dawn; для Манары — допущение", main: rel === "contrary", weight: rel === "contrary" ? 2 : 1, text });
  }

  // Числа — только как паттерн, привязанный к картам; общий смысл числа не используется
  const pips = minors.filter((c) => c.number);
  const byNum = {};
  for (const c of pips) (byNum[c.number] ??= []).push(c);
  for (const [num, group] of Object.entries(byNum)) if (group.length >= 2) f.push({
    detector: "number_repeat", layer: "CALCULATION", main: false, weight: 1,
    text: `Повторяется число ${num}: ${group.map((c) => c.name).join(", ")}. Смысл этих конкретных карт важнее числа; можно сравнить, что общего в их сюжетах.`,
  });
  const nums = [...new Set(pips.map((c) => c.number))].sort((a, b) => a - b);
  if (nums.length >= 3 && nums.every((x, i) => i === 0 || x === nums[i - 1] + 1)) f.push({
    detector: "number_sequence", layer: "CALCULATION", main: false, weight: 1, text: `Числа идут подряд (${nums.join(", ")}) — возможно, это этапы одного процесса.`,
  });
  if (pips.length >= 3 && pips.every((c) => c.number <= 3)) f.push({ detector: "number_range", layer: "TRADITION", main: false, weight: 1, text: "Все числовые карты — малые (1–3): ситуация может быть в начале." });
  if (pips.length >= 3 && pips.every((c) => c.number >= 8)) f.push({ detector: "number_range", layer: "TRADITION", main: false, weight: 1, text: "Все числовые карты — старшие числа (8–10): ситуация может быть ближе к завершению этапа." });

  // Придворные
  const courts = cards.filter((c) => c.court);
  if (courts.length) f.push({
    detector: "court_pattern", layer: "TRADITION", main: courts.length >= 2, weight: courts.length >= 2 ? 2 : 1,
    text: courts.length >= 2
      ? `Придворных карт ${courts.length} — в ситуации могут быть важны люди или разные стороны тебя самой.`
      : `${courts[0].name} в позиции «${posName(courts[0])}» может описывать человека с такими чертами или сторону тебя самой.`,
  });

  const RANK_RU = { KNAVE: "Слуги", PAGE: "Пажи", KNIGHT: rwsDeck ? "Рыцари" : "Всадницы/Рыцари", QUEEN: "Королевы", KING: "Короли" };
  for (const rank of DECKS[cards[0]?.deck ?? "MANARA"].courts) {
    const same = courts.filter((c) => c.court === rank);
    if (same.length >= 2) f.push({ detector: "court_same_rank", layer: "ARCANA_SYNTHESIS", main: true, weight: 2,
      text: `Две карты одного ранга — ${RANK_RU[rank]} (${same.map((c) => `${c.name} в «${posName(c)}»`).join(", ")}): позиции могут описывать похожую роль с разной ${rwsDeck ? "мастью" : "стихией"} — стоит сравнить, чем они отличаются.` });
  }

  // Пары из базы
  const ids = cards.map((c) => c.id);
  for (const p of PAIRS) if (ids.includes(p.a) && ids.includes(p.b) && (!p.context || p.context === topic)) f.push({
    detector: "pair", layer: p.type === "source" ? "SOURCE" : "ARCANA_SYNTHESIS", source: p.source, main: true, weight: 3, text: p.claim,
  });

  // Расхождения источников по смыслу карты
  for (const c of cards) {
    const dis = (c.card.SOURCE_DISAGREEMENT ?? []).filter((d) => /полярн|тяжест|тон|смысл|оценк|значени|акцент/i.test(d.topic ?? ""));
    if (dis.length) f.push({ detector: "source_disagreement", layer: "SOURCE", main: false, weight: 1,
      text: `У карты «${c.name}» источники расходятся (${dis.map((d) => d.topic).join("; ")}) — толкование стоит держать открытым.` });
  }
  return f.sort((a, b) => b.weight - a.weight);
}

// ---------- в плюсе / в тени ----------

const SHADOW_POS = /меша|страх|тен|отпуст|утека|препятств|повторя/i;
const PLUS_POS = /помо|ресурс|оставить|развива|следующ|усили|сделать иначе/i;

function positionLean(p) {
  const r = p.read.join(" ");
  if (/SYN:shadow|PA:obstacle|PA:shadow/.test(r) || SHADOW_POS.test(p.name)) return -1;
  if (/PA:resource|PA:advice/.test(r) || PLUS_POS.test(p.name)) return 1;
  return 0;
}

export function polarity(cards, positions, readings, i, question, ctx = []) {
  const c = cards[i], p = positions[i];
  const pl = positionLean(p);
  const others = cards.filter((_, j) => j !== i).map((x) => valenceOf(x.card));
  const nb = others.reduce((a, b) => a + b, 0) / Math.max(others.length, 1);
  const nbLean = Math.abs(nb) > 0.2 ? Math.sign(nb) : 0;
  const ql = questionLean(question);
  const ctxBias = Math.sign(ctx.slice(0, 2).reduce((a, r) => a + (r.polarity_bias ?? 0), 0));
  const score = pl * 2 + nbLean + ql + ctxBias;
  const mode = score >= 2 ? "plus" : score <= -2 ? "shadow" : "both";
  const pa = c.card.POSITIONAL_APPLICATION ?? {};
  const rev = c.deck === "RWS" && c.reversed && c.card.REVERSED ? c.card.REVERSED : null;
  const adviceSlot = /PA:advice/.test(p.read.join(" "));      // совет звучит императивом — в «балансе» берём слот ресурса
  const plus = rev ? rev.resource : pl > 0 && !adviceSlot ? readings[i].text : pa.resource?.default ?? (pl > 0 ? readings[i].text : null);
  const shadow = rev ? (rev.modes[readings[i].mode] ?? rev.modes[rev.primary_mode]) : pl < 0 ? readings[i].text : pa.shadow?.default ?? textOf(c.card.ARCANA_SYNTHESIS?.shadow) ?? null;
  const why = [
    pl > 0 ? "позиция о ресурсе" : pl < 0 ? "позиция о трудности" : "нейтральная позиция",
    nbLean > 0 ? "соседние карты скорее лёгкие" : nbLean < 0 ? "соседние карты скорее тяжёлые" : "соседи смешанные",
    ql < 0 ? "вопрос о трудности" : ql > 0 ? "вопрос о развитии" : null,
    ctxBias && ctx[0] ? `контекст: ${ctx[0].label}` : null,
  ].filter(Boolean).join(", ");
  const blended = blendStrengthShadow(clean(plus), clean(shadow), readings[i].text);
  return { mode, plus: clean(plus), shadow: clean(shadow), why, blended, blendParts: blendParts(clean(plus), clean(shadow), readings[i].text) };
}


// ---------- единый текст «сила и ловушка» ----------

const LEADS = [
  /^Ресурсом (?:может|могут) (?:стать|быть)\s+/i, /^Помочь может\s+/i, /^Поможет\s+/i,
  /^В этой позиции карта может подсветить\s+/i, /^В тени (?:может быть|может проявляться)\s+/i, /^В тени\s+/i,
  /^С твоей стороны карта может показывать:\s*/i, /^Может (?:указывать на|говорить о|показывать)\s+/i,
  /^Можно прочитать как\s+/i, /^В теневой позиции карта может (?:подсветить|показывать)\s+/i, /^Карта может (?:показывать|указывать на|говорить о|подсвечивать)\s+/i,
  /^Тенью может стать\s+/i, /^Мешать может\s+/i,
];
const stripLead = (t) => { let x = String(t ?? "").trim(); for (const re of LEADS) x = x.replace(re, ""); return x.replace(/[.\s]+$/, ""); };
const endDot = (t) => (/[.!?…]$/.test(t) ? t : t + ".");
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// Две половины «баланса» без повторов: опора и тень, каждая только если отличается от основного текста позиции
// bAcc: тень была записана после глагола («карта может подсветить …») — фраза в винительном падеже
export function blendParts(plus, shadow, main) {
  const a = stripLead(plus), b = stripLead(shadow), m = stripLead(main);
  const bAcc = /^(?:В этой позиции |В тени )?(?:карта )?(?:Может )?(?:может )?(?:подсветить|подсвечивать|показывать|указывать на|говорить о)|^Можно прочитать как/i.test(String(shadow ?? "").trim());
  return { a: a && a !== m ? a : null, b: b && b !== m && b !== a ? b : null, bAcc };
}

// Психологический баланс карты: опора и уязвимость одной мыслью, без деления на плюсы и минусы
export function blendStrengthShadow(plus, shadow, main) {
  const a = stripLead(plus), b = stripLead(shadow);
  const mainNorm = stripLead(main);
  const sameA = !a || a === mainNorm, sameB = !b || b === mainNorm;
  if (a && b && a !== b) {
    return `Здесь опора и уязвимость растут из одного корня: ${lowerFirst(a)}. Та же энергия может обернуться так: ${lowerFirst(b)}.`;
  }
  if (!sameA) return `Главное в состоянии этой карты — ${lowerFirst(a)}.`;
  if (!sameB) return `Главное, за чем стоит следить в этой карте: ${lowerFirst(b)}.`;
  return null;
}

// ---------- сопоставление карт ----------

// Связь двух карт RWS из CARD_LINKS с учётом порядка (a → b)
export function linkBetween(a, b) {
  return PAIRS.find((p) => p.rel && ((p.a === a && p.b === b) || (!p.ordered && p.a === b && p.b === a))) ?? null;
}

export function compareCards(cards, positions) {
  // «Эффективная» тяжесть: карта в позиции ресурса читается легче, в позиции трудности — тяжелее
  const info = cards.map((c, i) => ({ c, themes: themesOf(cardText(c.card)), v: valenceOf(c.card) + 0.6 * positionLean(positions[i]) - (c.deck === "RWS" && c.reversed ? 0.3 : 0) }));
  const lab = (i) => `карта «${cards[i].name}» из позиции «${positions[i].name}»`;
  const notes = [];
  const pairs = [[0, 1], [1, 2], [0, 2]].filter(([a, b]) => b < cards.length);
  const shared = {};
  for (const [a, b] of pairs) {
    const common = info[a].themes.filter((t) => info[b].themes.includes(t));
    for (const t of common) (shared[t] ??= new Set()).add(a).add(b);
    const diff = info[b].v - info[a].v;
    if (common.length) notes.push(`${cap(lab(a))} и ${lab(b)} усиливают друг друга: обе карты про ${common.slice(0, 2).map((t) => THEMES[t].acc).join(" и ")}.`);
    else if (Math.abs(diff) >= 0.8) notes.push(`${cap(lab(a))} и ${lab(b)} контрастируют: ${diff > 0 ? "вторая звучит заметно легче" : "вторая звучит заметно тяжелее"}.`);
  }
  const vs = info.map((x) => x.v);
  let pattern;
  const motif = Object.entries(shared).sort((x, y) => y[1].size - x[1].size)[0];
  if (motif && motif[1].size >= 3) pattern = `общий мотив всех трёх карт — ${THEMES[motif[0]].ru}`;
  else if (vs.length === 3 && vs[0] < vs[1] && vs[1] < vs[2] && vs[2] - vs[0] >= 0.6) pattern = "переход: от более тяжёлого к более ресурсному";
  else if (vs.length === 3 && vs[0] > vs[1] && vs[1] > vs[2] && vs[0] - vs[2] >= 0.6) pattern = "переход: от более лёгкого к более напряжённому";
  else if (motif) pattern = `повторяющийся мотив — ${THEMES[motif[0]].ru}`;
  else if (notes.some((n) => n.includes("контраст"))) pattern = "контраст: карты тянут в разные стороны";
  else pattern = "разнородная картина: явного общего мотива нет";
  const linkRels = [[0, 1], [1, 2]].filter(([, b]) => b < cards.length).map(([a, b]) => linkBetween(cards[a].id, cards[b].id)?.rel).filter(Boolean);
  if (linkRels.length) {
    const PAT = { contradict: "противоречие: карты тянут в разные стороны", cause_effect: "причина → проявление: одно вытекает из другого", transition: "переход: один этап сменяется другим",
      inner_outer: "внутреннее → внешнее: то, что внутри, выходит наружу", resource_obstacle: "ресурс и препятствие в одной связке", reinforce: "усиление: карты подкрепляют друг друга", motif: "повторяющийся мотив" };
    pattern = PAT[linkRels.find((x) => x === "contradict") ?? linkRels[0]] ?? pattern;
  }
  const chain = cards.map((c) => c.name).join(" → ");
  // как каждая карта соотносится со следующей: усиливает, контрастирует или просто продолжает
  const rels = [[0, 1], [1, 2]].filter(([, b]) => b < cards.length).map(([a, b]) => {
    const link = linkBetween(cards[a].id, cards[b].id);
    if (link) return link.rel;
    const common = info[a].themes.filter((t) => info[b].themes.includes(t));
    const diff = info[b].v - info[a].v;
    return common.length ? "reinforce" : Math.abs(diff) >= 0.8 ? (diff > 0 ? "lighter" : "heavier") : "plain";
  });
  return { chain, notes, pattern, motif: motif?.[0] ?? null, rels };
}


// ---------- сюжет расклада: три карты как одна история ----------

function buildStory(r, keyIdx) {
  const { cards, positions, readings, inContext, synthesis } = r;
  const comp = synthesis.comparison;
  const say = (i) => {
    let t = (firstSentence(readings[i].text) || firstSentence(cards[i].card.ARCANA_SYNTHESIS?.core_reading)).replace(/[.\s]+$/, "");
    if (/^Ресурсом (?:может|могут)/i.test(t) || /^Помочь может/i.test(t)) t = `Здесь твоя опора — ${lowerFirst(stripLead(t))}`;
    else if (isInfinitive(t)) t = `Привычная реакция здесь — ${lowerFirst(t)}`;     // инфинитив без подлежащего
    return endDot(t);
  };
  // Каждый абзац — шаг истории: «позиция» — карта, затем связка с предыдущим шагом и суть
  const head = (i) => `«${positions[i].name}» — ${cards[i].name}.`;
  const out = [];
  out.push({ head: head(0), text: `Здесь узел расклада. ${say(0)}` });
  const r1 = comp.rels?.[0] ?? "plain";
  out.push({ head: head(1), text: `${{
    reinforce: "Это усиливается, а не затихает.",
    lighter: "Но внутри есть и более светлая сторона.",
    heavier: "Отсюда внутри становится тяжелее.",
    plain: "Рядом проявляется и другое.",
  }[r1]} ${say(1)}` });
  if (cards.length > 2) {
    const r2 = comp.rels?.[1] ?? "plain";
    out.push({ head: head(2), text: `${{
      reinforce: "Тот же мотив подсказывает, куда двигаться дальше.",
      lighter: "Выход рядом.",
      heavier: "Чтобы завершить этот круг, придётся посмотреть и на непростое.",
      plain: "Чтобы завершить этот круг, нужен вот какой шаг.",
    }[r2]} ${say(2)}` });
  }
  return out;
}



// ---------- квинтэссенция как главный урок ситуации ----------

function buildLesson(r) {
  const q = r.quint.find((x) => x.key === "banzhaf");
  if (!q?.cardId) return null;
  const qc = loadCard(q.cardId), syn = qc.card.ARCANA_SYNTHESIS ?? {};
  const { cards, positions } = r;
  const last = cards.length - 1;
  const courts = cards.filter((c) => c.court).length;
  const weak = courts >= 2 ? `В раскладе ${courts} придворных (они считаются за 0), поэтому расчёт слабый. Читай этот урок как дополнительную подсказку, а не как главный вывод.` : q.caveat ? `Расчёт слабый: ${q.caveat}. Читай этот урок как дополнительную подсказку.` : null;
  const core = firstSentence(clean(syn.core_reading ?? ""));
  const shadow = firstSentence(clean(textOf(syn.shadow)));
  const psych = clean(textOf(syn.psychology));
  const inSpread = cards.findIndex((c) => c.id === q.cardId);
  const ps = [];
  ps.push(`Все три карты сходятся в одной точке — ${qc.name}.` + (inSpread >= 0 ? ` Эта карта уже выпала в позиции «${positions[inSpread].name}», поэтому её тема в раскладе звучит особенно сильно.` : ""));
  if (core) ps.push(`Эта карта просит заметить главное: ${lowerFirst(endDot(core.replace(/[.\s]+$/, "")))}`);
  if (psych) ps.push(`Возможная динамика: ${lowerFirst(endDot(psych.replace(/[.\s]+$/, "")))}`);
  if (shadow) ps.push(`Внутренний блок, на который она указывает: ${lowerFirst(endDot(shadow.replace(/[.\s]+$/, "")))}`);
  ps.push(`Она связывает карту «${cards[0].name}» из позиции «${positions[0].name}» и карту «${cards[last].name}» из позиции «${positions[last].name}»: то, с чего начался этот круг, и то, чем его можно завершить.`);
  const rq = clean(textOf(syn.reflection_questions));
  if (rq) ps.push(`Вопрос на вывод: ${rq}`);
  return { card: qc.name, cardId: q.cardId, result: q.result, calculation: q.calculation, paragraphs: ps, weak };
}

// ---------- главный инсайт: контекст вживлён в текст ----------

const SAFETY_NOTE = "Если тебе кажется, что за тобой следят, тебе угрожают или просто страшно, личная безопасность важнее любых карт. Поговори с близким человеком, ограничь доступ к своим страницам и при необходимости обратись за профессиональной помощью. Расклад ниже — про твои внутренние процессы, а не руководство к действиям.";

function buildInsight(r) {
  const { personal: P, meta: M, cards, positions, synthesis: s, inContext, readings } = r;
  const parts = [];
  const frame = !P.safety ? situationFrame(r.situation) : null;
  if (frame) parts.push(frame);
  const pos = M?.activity === "initiator" ? "Инициатора" : M?.activity === "passive" ? "Ведомого" : null;
  const span = M?.duration && M.bucket !== "fresh" ? `спустя ${M.duration}` : null;
  if (P.safety) parts.push("Расклад здесь не про его намерения, а про твоё состояние и твои границы.");
  else if (M?.time === "future") parts.push(`${pos ? `Ты находишься в позиции ${pos}, и эта` : "Эта"} история ещё не случилась: сейчас ты проецируешь страхи и ищешь опору, а не видишь реальные события. Это твой внутренний поиск ${M.search ?? "опоры"}.`);
  else if (pos) parts.push(`Ты находишься в позиции ${pos}, и ${span ?? "сейчас"} эта история для тебя — это уже не внешние события, а твой внутренний поиск ${M.search}.`);
  else if (M?.time === "past" || M?.expression === "block") parts.push(`${span ? `${span[0].toUpperCase() + span.slice(1)} э` : "Э"}та история для тебя — это уже не внешние события, а твой внутренний поиск ${M.search ?? "ресурса"}.`);
  const k = s.keyIdx;
  // Ключевая мысль инсайта — из контекстной линзы; без неё из общей сути карты (не из текста позиции, он покажется ниже, в разборе карты)
  const synCore = firstSentence(clean(textOf(cards[k].card.ARCANA_SYNTHESIS?.core_reading) ?? ""));
  // С адаптером ключевая мысль берётся из общего смысла карты (не из тех граней, что читаются ниже в разборе карты)
  let adaptCore = null;
  if (r.adapted?.[k]) {
    const re = romanticFilter(r.situation.group);
    adaptCore = firstSentence(clean(cardFacets(cards[k], r.situation.group).CORE ?? ""));
    if (adaptCore && ((re && re.test(adaptCore)) || META.test(adaptCore))) adaptCore = null;
  }
  let core = (adaptCore ?? inContext?.[k]?.core ?? (synCore && !META.test(synCore) ? synCore : firstSentence(readings[k].text))).replace(/[.\s]+$/, "");
  const infinitive = isInfinitive(core);
  parts.push(`Сильнее всего звучит карта «${cards[k].name}» в позиции «${positions[k].name}»${infinitive ? ", привычная реакция" : ""}: ${lowerFirst(endDot(core))}`);
  return parts.join(" ");
}

// ---------- синтез ----------

function keyPosition(cards, positions, question, comparison) {
  const qThemes = themesOf(question ?? "");
  const scores = cards.map((c, i) => {
    const t = themesOf(cardText(c.card));
    const p = positions[i];
    let score = 1;
    const qOverlap = t.filter((x) => qThemes.includes(x)).length;
    const motif = comparison.motif && t.includes(comparison.motif) ? 1 : 0;
    score += qOverlap + motif;
    if (p.role === "notice") score += 0.5;
    // Старший аркан получает вес только при поддержке вопросом или другими картами
    if (c.isMajor && (qOverlap || motif)) score += 1;
    return { i, score, support: qOverlap ? "совпадает с темой вопроса" : motif ? "поддержана другими картами" : p.role === "notice" ? "позиция, которую важно заметить" : "нет явной поддержки" };
  });
  return scores.sort((a, b) => b.score - a.score)[0];
}

export function synthesize(r) {
  const { cards, positions, readings, findings, quint, question } = r;
  const lines = [];
  for (const role of ["situation", "influence", "notice", "action"]) {
    const i = positions.findIndex((p) => p.role === role);
    if (i < 0) continue;
    const t = firstSentence(readings[i].text);
    if (t) lines.push({ role: ROLE_TITLES[role], text: `${cards[i].name} («${positions[i].name}»): ${lowerFirst(t)}` });
  }
  const comparison = compareCards(cards, positions);
  const links = findings.filter((x) => x.main).map((x) => x.text);

  const key = keyPosition(cards, positions, question, comparison);
  const kc = cards[key.i];
  const core = firstSentence(readings[key.i].text) || firstSentence(kc.card.ARCANA_SYNTHESIS?.core_reading);
  const ctxLabels = (r.context ?? []).slice(0, 2).map((t) => t.label);
  const keyText = (r.inContext?.[key.i]?.text) || lowerFirst(core);
  const main = (ctxLabels.length ? `С учётом твоей ситуации (${ctxLabels.join(", ")}): ключ` : "Ключ") +
    ` расклада — ${kc.name} в позиции «${positions[key.i].name}» (${key.support}). ${keyText[0].toUpperCase() + keyText.slice(1)}`;

  // Вопрос и действие: сначала из назначенной позиции; для работы/решения — без языка отношений
  const avoidRel = r.topic === "work" || r.topic === "decision";
  const pick = (first, field) => {
    const order = [first, key.i, ...cards.map((_, j) => j)];
    const all = order.map((j) => textOf(cards[j].card.ARCANA_SYNTHESIS?.[field])).filter(Boolean);
    return (avoidRel && all.find((t) => !RELATIONAL.test(t))) || all[0];
  };
  // Если ситуация распознана, вопрос и действие берутся из контекста (ARCANA_SYNTHESIS); иначе — из карт
  const ctxRule = (r.contextRules ?? []).find((x) => x.question);
  const lensCard = (r.inContext ?? [])[key.i]?.lens ? r.inContext[key.i] : (r.inContext ?? []).find((x) => x?.lens);
  const role = r.personal?.role;
  const questionOut = (role === "initiator" && ctxRule?.question_initiator) || (role === "left" && ctxRule?.question_left) || lensCard?.question || ctxRule?.question || pick((r.spread.question_from ?? key.i + 1) - 1, "reflection_questions");
  const action = (role === "initiator" && ctxRule?.action_initiator) || (role === "left" && ctxRule?.action_left) || lensCard?.action || ctxRule?.action || pick((r.spread.action_from ?? cards.length) - 1, "small_actions");
  const cardQuestion = pick((r.spread.question_from ?? key.i + 1) - 1, "reflection_questions");

  // Квинтэссенция по умолчанию — метод Банцхафа; слабость расчёта показывается честно
  const q = quint.find((x) => x.key === "banzhaf");
  const courts = cards.filter((c) => c.court).length;
  const weak = courts >= 2 ? `в раскладе ${courts} придворных (они считаются за 0) — расчёт слабый` : q?.caveat;
  const quintLine = q?.cardId ? `${q.card} (по методу Банцхафа: ${q.calculation})` + (weak ? `. Внимание: ${weak}.` : ".")
    : `не рассчитывается: ${q?.note}.`;

  return { lines, comparison, links, main, question: clean(questionOut), action: clean(action), cardQuestion: ctxRule ? clean(cardQuestion) : null, quintLine, keyCard: kc.name, keyIdx: key.i };
}


// ---------- разбор контекста: время, кто инициатор, безопасность ----------

const plural = (n, one, few, many) => { const a = n % 100, b = n % 10; return a >= 11 && a <= 14 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };

export function scanSituation(text) {
  const t = normText(text);
  const out = { months: null, phrase: null, bucket: null, role: null, safety: false };
  // время
  let m;
  if ((m = t.match(/(\d+)\s*(дн(?:я|ей|ь)|недел\p{L}*|месяц\p{L}*|мес\b|год\p{L}*|лет\b)/u))) {
    const n = Number(m[1]), u = m[2];
    if (u.startsWith("дн")) { out.phrase = `${n} ${plural(n, "день", "дня", "дней")}`; out.months = n / 30; }
    else if (u.startsWith("недел")) { out.phrase = `${n} ${plural(n, "неделя", "недели", "недель")}`; out.months = n / 4.3; }
    else if (u.startsWith("мес")) { out.phrase = `${n} ${plural(n, "месяц", "месяца", "месяцев")}`; out.months = n; }
    else { out.phrase = `${n} ${plural(n, "год", "года", "лет")}`; out.months = n * 12; }
  } else if (/пол ?года/.test(t)) { out.phrase = "полгода"; out.months = 6; }
  else if (/(пару|пара|несколько) месяц/.test(t)) { out.phrase = "пару месяцев"; out.months = 2.5; }
  else if (/(год назад|уже год|целый год|больше года)/.test(t)) { out.phrase = "год"; out.months = 12; }
  else if (/(недавно|на днях|на прошлой неделе|вчера|сегодня)/.test(t)) { out.phrase = "совсем недавно"; out.months = 0.3; }
  if (out.months != null) out.bucket = out.months <= 1.5 ? "fresh" : out.months < 5 ? "mid" : "long";
  // кто инициатор
  const left = /(меня (бросил|бросила|оставил|оставила|кинул|кинула)|бросил(?:а)? меня|оставил(?:а)? меня|ушел от меня|ушла от меня|со мной расстал|он ушел|она ушла|он бросил|она бросила|меня оставили|меня бросили|от меня ушел|от меня ушла)/;
  const initiator = /(я (сама |сам )?(ушла|ушел|бросила|бросил|порвала|порвал|прекратила|прекратил|закончила|закончил|разорвала|разорвал|заблокировала|заблокировал|оборвала|оборвал)|мое решение|моё решение|я решила расстаться|я решил расстаться|я поставила точку|я поставил точку)/;
  if (left.test(t)) out.role = "left"; else if (initiator.test(t)) out.role = "initiator"; else if (/мы (расстал|разошл)/.test(t)) out.role = "mutual";
  // безопасность
  out.safety = /(преслед|сталк|угрожа|угроз|караул|поджида|следит за мо|следит за каждым|боюсь (его|ее|её)|не даёт покоя|не дает покоя|пишет с (других|чужих)|боюсь выкладыв|боюсь заходить в соцсет|боюсь, что (он|она) увид)/.test(t);
  return out;
}


// ---------- МЕТА-ДВИЖОК: психологические векторы контекста ----------

const stemTest = (t, st) => {
  const whole = st.endsWith("|"), core = (whole ? st.slice(0, -1) : st).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}])${core}${whole ? "(?![\\p{L}])" : ""}`, "u").test(t);
};
const countStems = (t, list = []) => list.reduce((n, st) => n + (stemTest(t, st) ? 1 : 0), 0);

// Вектор активности (кто управляет), времени (прошлое/будущее) и проявленности (зажатость)
export function scanMeta(text, theme, personal = scanSituation(text)) {
  if (!META_VEC) return null;
  const t = normText(text);
  const A = META_VEC.activity, T = META_VEC.time, E = META_VEC.expression;
  let iScore = countStems(t, A.initiator.stems) + (personal.role === "initiator" ? 2 : 0);
  let pScore = countStems(t, A.passive.stems) + 0.5 * countStems(t, A.passive.weak) + (personal.role === "left" ? 2 : 0);
  const activity = iScore === 0 && pScore === 0 ? null : iScore > pScore ? "initiator" : pScore > iScore ? "passive" : null;
  const past = countStems(t, T.past.stems) + (personal.bucket === "long" ? 2 : personal.bucket === "mid" ? 1 : 0);
  const future = countStems(t, T.future.stems);
  const time = past === 0 && future === 0 ? null : past >= future ? "past" : "future";
  const block = countStems(t, E.block.stems) > 0 ? "block" : null;
  const search = block ? "ресурса" : activity === "initiator" ? "власти" : activity === "passive" ? "безопасности" : time ? "ресурса" : null;     // зажатость — это поиск зажатого ресурса, даже если человек у руля
  return { activity, time, expression: block, search, theme, projection: META_VEC.projection?.[theme] ?? null, duration: personal.phrase, bucket: personal.bucket };
}

// Одно предложение-гипотеза о том, как читать карты при главном векторе (приоритет: прошлое → будущее → зажатость → активность)
function metaLensSentence(meta, personal) {
  if (!meta) return null;
  const since = personal.phrase ? ` ${personal.phrase}` : "";
  if (meta.time === "past") return META_VEC.time.past.lens.replace("уже{since}", personal.phrase ? `уже${since}` : "давно").replace("{since}", since);
  if (meta.time === "future") return META_VEC.time.future.lens;
  if (meta.expression === "block") return META_VEC.expression.block.lens;
  if (meta.activity) return META_VEC.activity[meta.activity].lens;
  return null;
}

// ---------- контекст пользователя ----------

const normText = (t) => " " + String(t ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ") + " ";
export const THEME_TOPIC = { "Отношения": "relationships", "Работа и бизнес": "work", "Решения и перемены": "decision", "Саморазвитие": "self", "Психология": "self", "Творчество": "work" };

// Теги ситуации из свободного текста (rule-based). Исходный текст не заменяется — теги лишь выбирают слой и рамку.
export function detectContext(text) {
  const t = normText(text);
  return CONTEXT.filter((r) => r.patterns.some((p) => t.includes(p))).sort((a, b) => b.priority - a.priority);
}

// ---------- рекомендации раскладов: тема → намерение → проблема → контекст ----------
let SEM_RE = null;
function semRegexes() {
  if (SEM_RE) return SEM_RE;
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  SEM_RE = SEMANTIC.groups.map((g) => ({
    g,
    res: g.stems.map((st) => {
      const whole = st.endsWith("|"), core = esc(whole ? st.slice(0, -1) : st);
      return new RegExp(`(?:^|[^\\p{L}])${core}${whole ? "(?![\\p{L}])" : ""}`, "u");
    }),
  }));
  return SEM_RE;
}

// Разбор текста пользователя по смысловым группам; сила группы растёт, если совпало несколько её слов
export function analyzeIntent(text) {
  const t = normText(text);
  const out = { theme: [], intent: [], problem: [], context: [] };
  for (const { g, res } of semRegexes()) {
    const hits = res.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0);
    if (hits) out[g.level]?.push({ id: g.id, label: g.label, strength: Math.min(1.6, 1 + 0.25 * (hits - 1)), group: g });
  }
  return out;
}

export function recommendSpreads(text, n = 3, opts = {}) {
  if (!String(text ?? "").trim()) return [];
  const found = analyzeIntent(text);
  const LW = SEMANTIC.level_weights;
  const tags = detectContext(text);
  const scored = SPREADS.filter((s) => !s.adult || opts.adult).map((s) => {      // расклады 18+ — только в режиме «Ночная тушь»
    let score = 0;
    const why = [];
    for (const level of ["theme", "intent", "problem", "context"]) {
      for (const m of found[level]) {
        const g = m.group;
        let gain = 0;
        if (level === "theme") gain = (g.themes?.[s.theme] ?? 0) * m.strength * LW.theme;
        else gain = (g.spreads?.[s.id] ?? 0) * m.strength * LW[level];
        if (gain > 0) { score += gain; if (level !== "theme") why.push({ label: m.label, gain }); }
      }
    }
    // прежние теги ситуации остаются мягкой добавкой, но не обязательны
    tags.forEach((t, k) => { if (s.tags?.includes(t.id)) { const add = (t.priority / 9) * (k === 0 ? 1.4 : 0.8); score += add; if (!why.some((w) => w.label === t.label)) why.push({ label: t.label, gain: add }); } });
    return { spread: s, score, because: why.sort((a, b) => b.gain - a.gain).slice(0, 2).map((w) => w.label) };
  });
  // Если понятно, кто ушёл (или кого оставили), расклады про расставание получают заметный бонус
  const P = scanSituation(text);
  if (P.role) for (const x of scored) {
    const bonus = { "rel.unfinished": 4, "rel.second_act": 2, "self.pattern": 1.5, "change.threshold": 1.5, "psy.projection": 1 }[x.spread.id];
    if (bonus) { x.score += bonus; if (!x.because.includes("расставание")) x.because = ["расставание", ...x.because].slice(0, 2); }
  }
  return scored.filter((x) => x.score >= 0.9).sort((a, b) => b.score - a.score).slice(0, n);
}

// «В твоём вопросе»: сцена карты, прочитанная через контекст. Это ARCANA_SYNTHESIS, не факт.
function contextLines(cards, positions, readings, ctx, personal, meta, theme, situation) {
  if (!ctx.length) return cards.map(() => null);
  const used = new Set();
  const order = [...positions.keys()].sort((a, b) => (positions[b].role === "notice") - (positions[a].role === "notice"));
  const out = cards.map(() => null);
  let metaUsed = false;
  const ago = personal.phrase && personal.bucket !== "fresh" ? ` ${personal.phrase} назад` : "";
  const since = personal.phrase ? `${personal.phrase}` : "время";
  const pickLens = (rule) => {
    if (personal.role === "initiator" && rule.lens_initiator) return rule.lens_initiator;
    if (personal.role === "left" && rule.lens_left) return rule.lens_left;
    if (personal.bucket === "long" && rule.lens_long) return rule.lens_long;
    return rule.lens;
  };
  for (const i of order) {
    const c = cards[i];
    // RWS: у карты есть собственные контекстные линзы — берём ту, что совпала с тегами ситуации
    if (c.deck === "RWS" && c.card.ARCANA_SYNTHESIS?.context_lenses?.length) {
      const tagIds = ctx.map((r) => r.id);
      let lens = null, tag = null;
      for (const id of tagIds) { lens = c.card.ARCANA_SYNTHESIS.context_lenses.find((l) => (l.when ?? []).includes(id)); if (lens) { tag = ctx.find((r) => r.id === id); break; } }
      if (lens) {
        const ml = !metaUsed ? metaLensSentence(meta, personal) : null; if (ml) metaUsed = true;
        const rv = readings[i].mode ? `Вопрос в твоей ситуации: ${lens.question}` : null;     // состояние перевёрнутой карты уже в тексте позиции, не повторяем
        out[i] = { tag: tag.id, label: tag.label, text: (ml ? ml + " " : "") + (rv ?? lens.text),
          core: lowerFirst(firstSentence(readings[i].mode ? readings[i].text : lens.text)).replace(/[.\s]+$/, ""), question: lens.question, action: lens.action, lens: true };
        continue;
      }
    }
    const posText = lowerFirst(firstSentence(clean(readings[i].text)));
    const psych = lowerFirst(firstSentence(clean(textOf(c.card.ARCANA_SYNTHESIS?.psychology))));
    const shadow = lowerFirst(firstSentence(clean(textOf(c.card.ARCANA_SYNTHESIS?.shadow))));
    const rule = ctx.find((r) => !used.has(r.id)) ?? null;
    // Тяжёлый контекст (расставание, страх, тишина) читает сцену через тень карты, остальные — через психологический слой
    const heavy = (rule ?? ctx[0]).polarity_bias < 0;
    // Манара: смысл берётся из тематического слоя категории расклада (если связь с темой не слабая), дальше он адаптируется контекстной рамкой
    const L = c.deck === "MANARA" ? cmpLayer(c, theme) : null;
    const layerSentence = L && L.fit !== "weak" ? lowerFirst(firstSentence(clean(L.text)).replace(/[.\s]+$/, "")) : null;
    const romRe = romanticFilter(situation?.group);      // дружба, работа, семья: романтические формулировки пропускаем
    const clear = (x) => (x && romRe && romRe.test(x) ? null : x);
    const pickClean = clear(layerSentence) ?? [clear(heavy ? shadow : psych), clear(heavy ? psych : shadow), clear(posText)].find((x) => x && x !== posText) ?? clear(posText);
    if (!pickClean && romRe) continue;      // все варианты романтические, а ситуация нет — контекстную рамку не строим
    const pick = pickClean ?? posText;
    const reading = pick;
    const workRaw = lowerFirst(firstSentence(clean(c.card.ARCANA_SYNTHESIS?.work_decision)));
    const work = (workRaw && !(romRe && romRe.test(workRaw)) ? workRaw : null) || reading;
    if (!reading) continue;
    const fill = (tpl) => tpl.replace("{reading}", reading).replace("{work}", work).replace("{ago}", ago).replace("{since}", since);
    // Если из текста понятна роль (ушла сама / оставили) или прошло много времени — все карты читаются через неё;
    // длинная вводная фраза нужна только у первой карты, у остальных — короткая
    const primary = ctx[0];
    const roleDriven = (personal.role === "initiator" && primary.lens_initiator) || (personal.role === "left" && primary.lens_left) || (personal.bucket === "long" && primary.lens_long);
    if (roleDriven) {
      const first = !used.has("__role");
      used.add("__role");
      const short = personal.role === "initiator" ? "Если смотреть на это со стороны того, кто сам поставил точку: " : personal.role === "left" ? "Если смотреть на это со стороны того, кого оставили: " : `Спустя ${since} это может звучать так: `;
      out[i] = { tag: primary.id, label: primary.label, text: first ? fill(pickLens(primary)) : short + reading, core: reading };
      continue;
    }
    if (rule) {
      used.add(rule.id);
      const ml = !metaUsed ? metaLensSentence(meta, personal) : null; if (ml) metaUsed = true;
      out[i] = { tag: rule.id, label: rule.label, text: (ml ? ml + " " : "") + fill(pickLens(rule)), core: reading };
    } else {
      const ml2 = !metaUsed ? metaLensSentence(meta, personal) : null; if (ml2) metaUsed = true;
      out[i] = { tag: ctx[0].id, label: ctx[0].label, text: (ml2 ? ml2 + " " : "") + `В твоей ситуации (${ctx[0].label}) эта позиция может звучать так: ${reading}`, core: reading };
    }
  }
  return out;
}

// ---------- линза категории: переписывание смысла карт под Отношения / Работу и бизнес / Саморазвитие ----------

function cardSource(c) {
  const s = c.card.ARCANA_SYNTHESIS ?? {};
  return [c.card.RECOGNITION?.signature, textOf(s.core_reading), textOf(s.psychology), textOf(s.shadow)].filter(Boolean).join(" ");
}

function applyCategoryLens(r) {
  // Линза категории остаётся только для «Отношений» (глаголы действия → мысленные при векторе «прошлое»).
  // Бизнес и саморазвитие Манары читаются через THEMATIC_LAYERS карты, а не через механическую замену «эротика → термин».
  r.lens = r.deck === "MANARA" && LENS_BY_THEME[r.spread.theme] === "rel" ? "rel" : null;
  if (!r.lens) return;
  const past = r.meta?.time === "past";
  r.readings.forEach((x, i) => {
    const source = cardSource(r.cards[i]);
    x.raw = x.text;
    if (x.text) x.text = x.text.replace(/^В источниках слоя нет\.\s*/, "");
    if (x.text) x.text = applyLens(x.text, { cat: r.lens, past, source });
    if (r.polarity[i].blended) r.polarity[i].blended = applyLens(r.polarity[i].blended, { cat: r.lens, past, source, extra: false });
    const bp = r.polarity[i].blendParts;
    if (bp) { if (bp.a) bp.a = applyLens(bp.a, { cat: r.lens, past, source, extra: false }); if (bp.b) bp.b = applyLens(bp.b, { cat: r.lens, past, source, extra: false }); }
    const ic = r.inContext[i];
    if (ic) { ic.text = applyLens(ic.text, { cat: r.lens, past, source, extra: false }); ic.core = applyLens(ic.core, { cat: r.lens, past, source, extra: false }); }
  });
}

// Сквозной рассказ: Точка А → динамика → Точка Б человеческим языком (без скобок и без цитат из текстов карт)
function buildFlow(r) {
  return cmpFlow(r.cards.slice(0, 3), r.positions, r.synthesis.comparison.rels);
}

// ---------- полный разбор ----------

export function reading({ spreadId, spread: inlineSpread, question, topic, cards: picks }) {
  const spread = inlineSpread ?? SPREADS.find((s) => s.id === spreadId);
  if (!spread) throw new Error(`нет расклада ${spreadId}`);
  const cards = picks.map((x) => ({ ...loadCard(x.id ?? x), reversed: !!x.reversed }));
  const deck = cards[0]?.deck ?? "MANARA";
  if (cards.some((c) => c.deck !== deck)) throw new Error("Карты из разных колод в одном раскладе: системы не смешиваются");

  const q = question ?? spread.question;
  let ctx = detectContext(q);
  const personal = scanSituation(q);
  if (personal.role && !ctx.some((r) => ["breakup", "ex", "no_contact"].includes(r.id))) {      // «я сама ушла» — это уже история о расставании
    const b = CONTEXT.find((r) => r.id === "breakup"); if (b) ctx = [b, ...ctx];
  }
  // Тема: явная → из контекста (например, «коллега» → работа) → из темы расклада
  // Кто в ситуации и в каком состоянии связь (адаптер контекста)
  const situation = scanSubject(q, spread, personal);
  const SUBJECT_CTX = { ex: "ex", friend: "friend", coworker: "coworker", boss: "coworker", team: "coworker", relative: "family", crush: "attraction", new_person: "attraction", future_partner: "attraction", business_partner: "business" };
  const subjRule = situation.subject !== "self" ? CONTEXT.find((x) => x.id === SUBJECT_CTX[situation.subject]) : null;
  // «не знакомы» противоречит известному субъекту (бывший, партнёр, друг…)
  if (["ex", "partner", "friend", "relative", "coworker", "boss", "team", "business_partner"].includes(situation.subject)) ctx = ctx.filter((x) => x.id !== "not_acquainted");
  if (subjRule && !ctx.some((x) => x.id === subjRule.id) && !(situation.subject === "ex" && ctx.some((x) => ["breakup", "ex", "no_contact"].includes(x.id)))) ctx = [...ctx, subjRule];
  const t = topic ?? ctx.find((r) => r.topic && r.topic !== "change")?.topic ?? THEME_TOPIC[spread.theme];
  const defaultRoles = ["situation", "influence", "notice", "action", "action"];
  const positions = spread.positions.map((p, i) => {
    const pos = { role: defaultRoles[i], ...p, read: p.read ?? [`PA:${p.type}`] };
    // Контекст может сдвинуть, какой слой карты читается в позиции
    const pref = ctx.slice(0, 2).map((r) => r.prefer?.[pos.role]).find(Boolean);
    if (pref) pos.read = [pref, ...pos.read.filter((x) => x !== pref)];
    const frame = ctx.find((r) => r.frame_other)?.frame_other;
    if (pos.grounding && frame) pos.grounding = frame;
    return pos;
  });
  const readings = cards.map((c, i) => cardInPosition(c, positions[i], t, q));
  const findings = analyze(cards, positions, t);
  const quint = Object.keys(QUINT_METHODS).map((k) => quintessence(cards, k));
  const r = { deck, spread, question: q, topic: t, cards, positions, readings, findings, quint,
    situation,
    context: [...new Map([...situation.labels.map((label) => ({ id: "subject", label })), ...ctx.map(({ id, label }) => ({ id, label }))].map((x) => [x.label, x])).values()], contextRules: ctx };
  r.personal = personal;
  r.meta = scanMeta(q, spread.theme, personal);
  r.inContext = contextLines(cards, positions, readings, ctx, r.personal, r.meta, cmpLayerKey(spread, situation), situation);
  r.polarity = cards.map((_, i) => polarity(cards, positions, readings, i, q, ctx));
  applyCategoryLens(r);
  r.adapted = cards.map((c, i) => adaptCard(c, i, r, cardInPosition));
  r.synthesis = synthesize(r);
  if (r.personal.safety) r.synthesis.action = "Сначала безопасность: написать близкому человеку, что тебе тревожно, и ограничить доступ к своим страницам и перепискам.";
  r.synthesis.story = buildStory(r, r.synthesis.keyIdx);
  r.synthesis.flow = buildFlow(r);
  r.synthesis.lensNote = r.lens ? LENS_NOTE[r.lens] : null;
  r.synthesis.lensQuestion = r.lens ? LENS_QUESTION[r.lens](r.meta?.time === "past") : null;
  r.synthesis.insight = buildInsight(r);
  r.synthesis.lesson = buildLesson(r);
  r.synthesis.safetyNote = r.personal.safety ? SAFETY_NOTE : null;
  r.synthesis.projection = r.deck !== "MANARA" ? null : r.lens ? LENS_NOTE[r.lens] : (r.meta?.projection ?? null);     // проекция «эротика → дело» — только для Манары
  // что показывать по каждой карте: сюжет карты, смысл в позиции, сила и ловушка одним текстом, что сделать
  r.views = cards.map((c, i) => ({
    visual: (String(c.card.RECOGNITION?.signature ?? "").match(/(?:[^.!?]+[.!?]+){1,2}/)?.[0] ?? "").trim(),
    inQuestion: r.inContext[i]?.text ?? null,
    blended: r.polarity[i].blended,
    doNow: clean(textOf(c.card.ARCANA_SYNTHESIS?.small_actions)) || null,
  }));
  r.screen = buildScreen(r);       // единый реестр: ни одна фраза на экране не повторяется
  return r;
}
