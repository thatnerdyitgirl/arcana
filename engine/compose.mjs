// Компоновка экрана расклада. Один рендерер, один реестр показанных фраз:
// ни одно предложение (и ни одна почти такая же его копия) не выводится на экране дважды.
// Порядок реестра = порядок на экране: инсайт → квинтэссенция → рассказ → вопрос/шаг → разбор по картам.

import { THEMES, themesOf, cardText } from "./themes.mjs";
import { romanticFilter } from "./adapt.mjs";

// ---------- предложения и сравнение ----------

export const cmpSentences = (t) => (String(t ?? "").match(/[^.!?…]+(?:[.!?…]+|$)/g) ?? []).map((s) => s.trim()).filter(Boolean);
const cmpNorm = (s) => String(s).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const cmpTokens = (s) => new Set(cmpNorm(s).split(" ").filter((w) => w.length > 2));

// Почти одинаковые предложения: большое пересечение слов или целиком вложенное достаточно длинное предложение
export function cmpSimilar(a, b) {
  const A = cmpTokens(a), B = cmpTokens(b);
  if (!A.size || !B.size) return false;
  let both = 0; for (const w of A) if (B.has(w)) both++;
  const small = Math.min(A.size, B.size), big = Math.max(A.size, B.size);
  return both / big >= 0.75 || (small >= 5 && both / small >= 0.95);
}

// Длинные фрагменты внутри предложения (между «:», «;», «—»), по которым ловим повтор целой мысли
const cmpClauses = (s) => String(s).split(/[:;—]+/).map((x) => cmpNorm(x)).filter((x) => x.split(" ").length >= 6);

function cmpSeen() {
  const list = [], clauses = [];
  const has = (s) => list.some((x) => cmpSimilar(x, s)) || cmpClauses(s).some((c) => clauses.some((k) => cmpSimilar(k, c)));
  return {
    has,
    // оставляет только новые предложения и запоминает их
    take(text) {
      const out = [];
      for (const s of cmpSentences(text)) { if (!has(s)) { list.push(s); clauses.push(...cmpClauses(s)); out.push(s); } }
      return out.join(" ");
    },
  };
}

const cmpText = (v) => (typeof v === "string" ? v : Array.isArray(v) ? cmpText(v[0]) : v?.hypothesis ?? v?.q ?? v?.default ?? "");
const cmpLower = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);
const cmpCap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const cmpDot = (t) => { const x = String(t ?? "").trim(); return !x ? "" : /[.!?…]$/.test(x) ? x : x + "."; };
// Инфинитив в начале («Цепляться…») — не существительное на «-ость/-сть» и не «Мешать может…»
function cmpIsInf(t) {
  const m = String(t).match(/^(?:Мысленно\s+)?([А-ЯЁа-яё]+)(?=[\s,.;:]|$)(.*)/);
  return !!m && /(?:ть|ться|ти)$/.test(m[1]) && !/сть$/.test(m[1]) && !/ости$/.test(m[1]) && !/^\s+(?:может|могут|можно|стоит|нужно)(?=[\s,.;:]|$)/i.test(m[2]);
}
const cmpTrim = (t) => String(t ?? "").replace(/[.\s]+$/, "");

// ---------- сквозной рассказ без служебных скобок ----------

// Короткая тема карты: ключевые слова RWS или темы по тексту карты (без копирования её предложений)
function cmpKeywords(c) {
  const kw = c.card.TRADITIONAL_MEANING?.keywords;
  if (Array.isArray(kw) && kw.length) return kw.slice(0, 3).join(", ");
  const th = themesOf(cardText(c.card)).slice(0, 2).map((k) => THEMES[k].ru);
  return th.join(", ");
}

const FLOW_MID = {
  reinforce: (p, n, k) => `Это усиливается в позиции «${p}», где проявляется карта «${n}»${k}.`,
  lighter: (p, n, k) => `Но внутри есть и более светлая сторона: в позиции «${p}» проявляется карта «${n}»${k}.`,
  heavier: (p, n, k) => `Отсюда становится тяжелее: в позиции «${p}» проявляется карта «${n}»${k}.`,
  cause_effect: (p, n, k) => `Это становится причиной того, что в позиции «${p}» проявляется карта «${n}»${k}.`,
  inner_outer: (p, n, k) => `То, что происходит внутри, выходит наружу в позиции «${p}»: это карта «${n}»${k}.`,
  contradict: (p, n, k) => `Этому противоречит позиция «${p}»: карта «${n}»${k} тянет в другую сторону.`,
  resource_obstacle: (p, n, k) => `Позиция «${p}» показывает, что здесь есть и опора, и препятствие одновременно: карта «${n}»${k}.`,
  transition: (p, n, k) => `Дальше это переходит в позицию «${p}»: карта «${n}»${k}.`,
  motif: (p, n, k) => `Тот же мотив повторяется в позиции «${p}»: карта «${n}»${k}.`,
  plain: (p, n, k) => `Это проецируется на позицию «${p}», где проявляется карта «${n}»${k}.`,
};
const FLOW_END = {
  lighter: (p, n, k) => `Выход рядом: он в позиции «${p}», это карта «${n}»${k}.`,
  reinforce: (p, n, k) => `Реальный выход начнётся тогда, когда ты дойдёшь до позиции «${p}»: карта «${n}»${k}.`,
  heavier: (p, n, k) => `Чтобы выйти из этого узла, придётся пройти через непростое: позиция «${p}», карта «${n}»${k}.`,
  cause_effect: (p, n, k) => `Из этого вытекает следующий шаг: позиция «${p}», карта «${n}»${k}.`,
  inner_outer: (p, n, k) => `Выход — вынести внутреннее наружу: позиция «${p}», карта «${n}»${k}.`,
  contradict: (p, n, k) => `Чтобы примирить это противоречие, нужна позиция «${p}»: карта «${n}»${k}.`,
  resource_obstacle: (p, n, k) => `Опору для следующего шага можно найти в позиции «${p}»: карта «${n}»${k}.`,
  transition: (p, n, k) => `Следующий этап — позиция «${p}», карта «${n}»${k}.`,
  motif: (p, n, k) => `Тот же мотив подсказывает, куда идти дальше: позиция «${p}», карта «${n}»${k}.`,
  plain: (p, n, k) => `Реальный выход начнётся тогда, когда ты дойдёшь до позиции «${p}»: карта «${n}»${k}.`,
};

export function cmpFlow(cards, positions, rels = []) {
  const usedKw = new Set();
  const kw = (c) => { const k = cmpKeywords(c); if (!k || usedKw.has(k)) return ""; usedKw.add(k); return ` — ${k}`; };
  const [a, b, c] = cards;
  if (!a) return "";
  let out = `В основе, в позиции «${positions[0].name}», лежит состояние карты «${a.name}»${kw(a)}.`;
  if (b) out += " " + (FLOW_MID[rels[0]] ?? FLOW_MID.plain)(positions[1].name, b.name, kw(b));
  if (c) out += " " + (FLOW_END[rels[1]] ?? FLOW_END.plain)(positions[2].name, c.name, kw(c));
  return out;
}

// ---------- «Общий рисунок»: стихии, числа, сочетания, паттерн — человеческим языком ----------

const PATTERN_RU = [
  [/^общий мотив всех трёх карт — (.+)$/, (m) => `Через все три карты проходит один мотив: ${m[1]}.`],
  [/^переход: от более тяжёлого к более ресурсному$/, () => "Картина движется от более тяжёлого состояния к более ресурсному."],
  [/^переход: от более лёгкого к более напряжённому$/, () => "Картина движется от более лёгкого состояния к более напряжённому: стоит заметить, что именно добавляет напряжения."],
  [/^повторяющийся мотив — (.+)$/, (m) => `Повторяется мотив: ${m[1]}.`],
  [/^контраст: карты тянут в разные стороны$/, () => "Карты тянут в разные стороны, и это, возможно, отражает внутреннее противоречие."],
  [/^противоречие: карты тянут в разные стороны$/, () => "Карты тянут в разные стороны, и это, возможно, отражает внутреннее противоречие."],
  [/^причина → проявление: одно вытекает из другого$/, () => "Карты складываются в цепочку: одно вытекает из другого."],
  [/^переход: один этап сменяется другим$/, () => "Это скорее смена этапов, чем один и тот же момент."],
  [/^внутреннее → внешнее: то, что внутри, выходит наружу$/, () => "То, что внутри, постепенно выходит наружу."],
  [/^ресурс и препятствие в одной связке$/, () => "Опора и препятствие в этой истории идут рядом."],
  [/^усиление: карты подкрепляют друг друга$/, () => "Карты подкрепляют друг друга."],
];
export function cmpPattern(p) {
  for (const [re, f] of PATTERN_RU) { const m = String(p ?? "").match(re); if (m) return f(m); }
  return null;      // «разнородная картина…» — без вывода
}

const cmpNoParens = (t) => String(t ?? "").replace(/\s*\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim();

function cmpSynergy(r) {
  const s = r.synthesis, out = [];
  const pat = cmpPattern(s.comparison.pattern); if (pat) out.push(pat);
  for (const n of s.comparison.notes.slice(0, 2)) out.push(cmpDot(cmpNoParens(n)));
  for (const l of s.links.slice(0, 3)) out.push(cmpDot(cmpNoParens(l)));
  const shared = cmpSharedFocus(r); if (shared) out.push(shared);
  return out;
}

// ---------- тематические слои Манары (THEMATIC_LAYERS): база для категории расклада ----------

const CMP_CAT = { "Отношения": "relationships", "Работа и бизнес": "work", "Решения и перемены": "decision", "Саморазвитие": "self_development", "Психология": "psychology", "Творчество": "creative" };
// theme — название категории или готовый ключ слоя; соло-расклады (spread.layer) читаются через слой «Саморазвитие», а не «Отношения»
export const cmpLayerKey = (spread, situation) => spread.layer ?? situation?.layerOverride ?? spread.theme;
export function cmpLayer(c, theme) {
  const L = c.card.THEMATIC_LAYERS?.[CMP_CAT[theme] ?? theme];
  return L?.text ? L : null;
}
const FOCUS_RU = { boundaries: "границы", desire: "желание", blind_spot: "слепая зона", self_worth: "самоценность", dependence: "зависимость", criterion: "критерий выбора", defense: "защита", resistance: "сопротивление",
  control: "контроль", inner_dynamics: "внутренняя динамика", interaction: "взаимодействие", vulnerability: "уязвимость", motivation: "мотивация", identity: "идентичность", inner_conflict: "внутренний конфликт", impulse: "импульс",
  distance: "дистанция", power: "власть", projection: "проекция", inspiration: "вдохновение", price_of_choice: "цена выбора", fear: "страх", recognition: "признание", craft: "ремесло", embodiment: "телесность", repression: "вытеснение",
  shadow: "тень", motive: "мотив", attraction: "притяжение", fear_of_being_seen: "страх быть увиденной", audience: "зрители", competition: "конкуренция", solitude: "одиночество", block: "блок", temptation: "соблазн",
  desire_to_create: "желание творить", muse: "муза", passion: "страсть", perfectionism: "перфекционизм", envy: "зависть" };

// Общие акценты слоёв у соседних карт: «в нескольких картах звучит одна тема»
function cmpSharedFocus(r) {
  if (r.deck !== "MANARA") return null;
  const count = {};
  r.cards.forEach((c) => { const L = cmpLayer(c, cmpLayerKey(r.spread, r.situation)); (L?.focus ?? []).forEach((f) => { count[f] = (count[f] ?? 0) + 1; }); });
  const shared = Object.entries(count).filter(([f, n]) => n >= 2 && FOCUS_RU[f]).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f]) => FOCUS_RU[f]);
  return shared.length ? `В нескольких картах звучит общая тема: ${shared.join(" и ")}.` : null;
}

// ---------- разбор одной карты: один связный абзац ----------

const MODE_RU = { blocked: "блокировка", excess: "избыток", distorted: "искажение", internal: "внутреннее проявление", delayed: "задержка", hard_to_express: "трудность выражения" };

function cmpCard(r, i, seen) {
  const c = r.cards[i], p = r.positions[i], rd = r.readings[i], ic = r.inContext[i], pol = r.polarity[i];
  // быстрый обзор: «В силе / В тени» (Манара — IN_STRENGTH/IN_SHADOW, RWS — ресурс и тень карты)
  const syn0 = c.card.ARCANA_SYNTHESIS ?? {};
  const strength = seen.take(cmpDot(c.card.IN_STRENGTH ?? (c.deck === "RWS" ? cmpText(syn0.resource) : "")));
  const shadow = seen.take(cmpDot(c.card.IN_SHADOW ?? (c.deck === "RWS" ? cmpText(syn0.shadow) : "")));
  const A = r.adapted?.[i] ?? null;      // адаптация к субъекту, состоянию связи и позиции
  let layer = c.deck === "MANARA" && !A?.facet ? cmpLayer(c, cmpLayerKey(r.spread, r.situation)) : null;
  const parts = [];
  if (c.deck === "RWS" && c.reversed && rd.mode) parts.push(`Перевёрнутая карта показывает ту же энергию в изменённом состоянии: ${MODE_RU[rd.mode] ?? "изменённое состояние"}.`);
  const posText = A ? A.posText : rd.text;
  if (A?.lead) parts.push(A.lead);
  if (posText) parts.push(cmpIsInf(posText) ? `Привычная реакция здесь — ${cmpLower(cmpDot(posText))}` : cmpDot(posText));
  if (A?.facet) parts.push(cmpDot(A.facet));
  if (A?.facet2) parts.push(cmpDot(A.facet2));
  if (ic?.text) parts.push(cmpDot(ic.text));
  // слой категории: основа тематического смысла; для слабой связи с темой — осторожная подача
  if (layer) {
    // слой категории: без служебных оговорок и, для нероманических субъектов, без романтических формулировок
    const romRe = A ? romanticFilter(A.group) : null;
    const clean = cmpSentences(layer.text).filter((x) => !/Гипотеза Arcana|не утверждается|не патологизируется/i.test(x) && !(romRe && romRe.test(x))).join(" ");
    if (clean) layer = { ...layer, text: clean }; else layer = null;
  }
  if (layer) parts.push(layer.fit === "weak" ? `Для этой темы связь карты скромнее, но возможно: ${cmpLower(cmpDot(layer.text))}` : cmpDot(layer.text));
  const LEAD_A = ["Опора здесь — ", "Ресурс этой карты: ", "Что здесь поддерживает: "][i % 3];
  const LEAD_B = ["Но та же энергия может обернуться так: ", "Обратная сторона этой же энергии: ", "Ловушка здесь в другом: "][i % 3];
  const hasOverview = !!(c.card.IN_STRENGTH || (c.deck === "RWS" && syn0.resource));     // «В силе / В тени» уже выше — не повторяем их в разборе
  if (!hasOverview && pol.blendParts?.a) parts.push(`${LEAD_A}${cmpLower(cmpTrim(pol.blendParts.a))}.`);
  if (!hasOverview && pol.blendParts?.b) parts.push(pol.blendParts.bAcc ? `Карта может подсветить: ${cmpLower(cmpTrim(pol.blendParts.b))}.` : `${LEAD_B}${cmpLower(cmpTrim(pol.blendParts.b))}.`);
  if (p.grounding) parts.push(cmpDot(p.grounding));
  // действие: из контекстной линзы, затем из «малых действий» карты, затем из совета позиции
  const cands = [ic?.action, r.views[i].doNow, c.card.POSITIONAL_APPLICATION?.advice?.default].filter(Boolean).map(cmpDot);
  // вопрос к себе («Вопрос в твоей ситуации: …») — в конец абзаца
  const isQ = (x) => /^Вопрос в твоей ситуации/.test(x);
  const ordered = parts.flatMap((x) => cmpSentences(x)).filter((x) => !isQ(x)).concat(parts.flatMap((x) => cmpSentences(x)).filter(isQ));
  let analysis = seen.take(ordered.join(" "));
  // Если после очистки от повторов разбор короткий — добавляем маркер категории (поле карты по теме вопроса), общую суть и психологическую гипотезу
  if (analysis.length < 170) {
    const syn = c.card.ARCANA_SYNTHESIS ?? {};
    const topicField = { relationships: syn.relationships, work: syn.work_money ?? syn.work_decision, decision: syn.decision ?? syn.work_decision, self: syn.self_development, change: syn.decision ?? syn.work_decision }[r.topic];
    const romRe = A ? romanticFilter(A.group) : null;      // в рабочих, дружеских и семейных ситуациях романтические фразы не подставляем
    for (const extra of [topicField, syn.core_reading, syn.psychology]) {
      let t = cmpText(extra);
      if (romRe && t) t = cmpSentences(t).filter((x) => !romRe.test(x)).slice(0, 2).join(" ");
      if (!t || /изображени|источник|базовый текст/i.test(t)) continue;
      const add = seen.take(cmpDot(cmpSentences(t).slice(0, 2).join(" ")));
      if (add) analysis = (analysis + " " + add).trim();
      if (analysis.length >= 170) break;
    }
  }
  const doNow = cands.map((x) => seen.take(x)).find(Boolean) ?? null;
  // плотность: длинный абзац обрезаем по границе предложения (вопрос к себе и заземление остаются в конце)
  if (analysis.length > 820) {
    const sents = cmpSentences(analysis); let acc = "";
    for (const x of sents) { if ((acc + " " + x).trim().length > 820 && acc) break; acc = (acc + " " + x).trim(); }
    analysis = acc;
  }
  return {
    strength, shadow,
    pos: p.name, name: c.name, state: c.reversed ? "перевёрнута" : "прямая",
    visual: seen.take(r.views[i].visual), analysis, doNow,
    reversedNote: c.reversed && c.deck === "MANARA" ? "В системе Манары перевёрнутых значений нет, поэтому карта читается так же, как прямая." : null,
    traditional: c.card.TRADITIONAL_MEANING?.summary ?? null,
  };
}

// ---------- весь экран ----------

export function buildScreen(r) {
  const seen = cmpSeen(), s = r.synthesis;
  const take = (t) => (t ? seen.take(t) : "");
  const screen = {};
  screen.insight = take(s.insight);
  screen.projection = take(s.projection);
  screen.lesson = s.lesson ? { ...s.lesson, paragraphs: s.lesson.paragraphs.map(take).filter(Boolean) } : null;
  screen.flow = take(s.flow);
  screen.synergy = cmpSynergy(r).map(take).filter(Boolean).join(" ");
  screen.lensQuestion = take(s.lensQuestion);
  screen.question = take(s.question);
  screen.cardQuestion = take(s.cardQuestion);
  screen.action = take(s.action);
  screen.cards = r.cards.map((_, i) => cmpCard(r, i, seen));
  return screen;
}

// Все видимые абзацы в порядке показа (для тестов)
export function screenBlocks(sc) {
  const b = [sc.insight, sc.projection, ...(sc.lesson?.paragraphs ?? []), sc.flow, sc.synergy, sc.lensQuestion, sc.question, sc.cardQuestion, sc.action];
  for (const c of sc.cards) b.push(c.strength, c.shadow, c.visual, c.analysis, c.doNow);
  return b.filter(Boolean);
}
