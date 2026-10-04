// Слой адаптации контекста: CARD × SUBJECT × RELATIONSHIP STATE × POSITION × QUESTION × CONTEXT.
// У карты есть контекстно-независимое смысловое ядро (грани: CORE, STRENGTH, SHADOW, REL, PSY, DESIRE, POWER, CHANGE, WORK, SELF).
// Адаптер определяет, кто фигурирует в ситуации и в каком состоянии связь, что означает позиция,
// и по этим трём признакам выбирает, какие грани карты и в какой рамке прочитать. Отдельных текстов «карта × роль» нет.
// Работает одинаково для двух колод, но грани берёт только из полей самой карты: колоды не смешиваются.

import { cmpSentences } from "./compose.mjs";

// ---------- распознавание субъекта и состояния связи ----------

const normA = (t) => " " + String(t ?? "").toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ")
  .replace(/друг (друга|другу|с другом|от друга|о друге|для друга|на друга|в друга|за другом)/g, " ") + " ";
const stemRe = (st) => { const whole = st.endsWith("|"), core = (whole ? st.slice(0, -1) : st).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp(`(?:^|[^\\p{L}])${core}${whole ? "(?![\\p{L}])" : ""}`, "u"); };
const firstAt = (t, stems) => { let best = -1; for (const st of stems) { const m = stemRe(st).exec(t); if (m && (best < 0 || m.index < best)) best = m.index; } return best; };
const hasAny = (t, stems) => firstAt(t, stems) >= 0;

const SUBJECT_MARKERS = {
  boss: ["начальник", "руководител", "босс", "шеф", "директор", "менеджер"],
  business_partner: ["деловой партнер", "партнер по бизнесу", "партнер по делу", "компаньон", "соучредител", "совладелец", "инвестор", "совместный бизнес", "партнерств", "заказчик", "клиент"],
  coworker: ["коллег", "сотрудник", "в офисе", "напарник"],
  team: ["команд", "коллектив", "отдел", "в группе", "наш отдел"],
  ex: ["бывш", "расстал", "после расставан", "мы разошл", "разошлись", "развод", "экс|", "ушел от меня", "ушла от меня", "бросил меня", "бросила меня", "я бросила", "я бросил"],
  partner: ["парн", "парен", "муж|", "мужа|", "мужем|", "мужу|", "мужем", "мой партнер", "моим партнером", "моего партнера", "жена|", "жену|", "женой|", "мужчин", "любим", "мы вместе", "живем вместе", "в отношениях", "молодой человек", "молодого человека", "молодым человеком", "моя девушка", "моей девушк", "супруг", "жених", "невест", "избранник"],
  new_person: ["новый человек", "новый знаком", "недавно познаком", "познакомил", "появился человек", "появилась девушка", "появился парень", "появился мужчина", "новое знакомство", "только начали", "недавно начал", "недавно встреч", "свидани", "новый парень", "новая девушка", "новый мужчина"],
  future_partner: ["будущий партнер", "будущий муж", "будущая жена", "встречу ли", "появится ли", "найду ли", "мой следующий", "кто будет рядом", "суженый", "предназначен", "встретить любовь", "когда я встречу", "мой будущий"],
  crush: ["нравится", "цепляет", "влюбил", "влюблен", "запала", "увлечен", "притягива", "тянет к", "не могу перестать думать", "симпати", "зацепил"],
  friend: ["подруг", "друг|", "друга|", "друзь", "дружб", "приятел"],
  relative: ["мама", "мамой", "маме", "мамы", "папа", "папой", "отец", "мать|", "родител", "брат|", "сестр", "бабушк", "дедушк", "свекров", "тещ", "теща", "дочь", "сын|", "семья", "семье"],
};
const WORK_SUBJECTS = ["boss", "business_partner", "coworker", "team"];
const PRIORITY = ["boss", "business_partner", "coworker", "team", "ex", "partner", "new_person", "future_partner", "crush", "friend", "relative"];

const STATE_MARKERS = {
  no_contact: ["не пишет", "не пишу", "молчит", "пропал", "пропала", "игнор", "не отвечает", "нет контакта", "перестали общаться", "не общаемся", "заблокир", "удалил меня", "удалила меня", "без связи"],
  conflict: ["ссор", "конфликт", "поссор", "ругаемся", "обид", "скандал", "давит", "давление", "напряжени", "не разговариваем"],
  one_sided: ["безответн", "не взаимн", "односторонн", "не замечает меня", "не видит меня", "не знает о моих чувствах", "не отвечает взаимностью", "друзьями называет"],
  sexual: ["секс", "сексуальн", "хочу его", "хочу ее", "возбужд", "страст", "влечени", "эротич", "интим", "желание к"],
  potential: ["потенциал", "перспектив", "куда движ", "к чему приведет", "есть ли будущее", "что будет дальше", "есть ли шанс", "получится ли"],
};

// Если в тексте нет явного субъекта, берём типичного для расклада
const SPREAD_SUBJECT = {
  "rel.new_person": "new_person", "rel.true_face": "new_person", "rel.why_this_person": "new_person", "rel.attraction": "crush",
  "rel.second_act": "ex", "rel.unfinished": "ex", "work.partner": "business_partner", "work.team_climate": "team", "rel.conflict": "other",
};

const SUBJECT_LABEL = { self: "внутренний процесс", new_person: "новый человек", partner: "текущий партнёр", ex: "бывший партнёр", future_partner: "возможный будущий партнёр", crush: "человек, который притягивает",
  friend: "друг или подруга", coworker: "коллега", business_partner: "деловой партнёр", boss: "начальник", team: "команда", relative: "родственник", other: "другой человек" };
const STATE_LABEL = { new_relationship: "новая связь", existing_relationship: "текущие отношения", ex_relationship: "после расставания", no_contact: "нет контакта", one_sided_interest: "односторонний интерес",
  friendship: "дружба", conflict: "конфликт", coworker: "рабочая среда", business_partnership: "деловое партнёрство", potential_future_relationship: "потенциальная связь", family: "семья", sexual_attraction: "сексуальное притяжение", inner_process: "внутренний процесс" };
const GROUP_OF = { self: "self", new_person: "new", crush: "new", future_partner: "new", partner: "partner", ex: "ex", friend: "friend", coworker: "work", business_partner: "work", boss: "work", team: "work", relative: "family", other: "other" };
const BASE_STATE = { self: "inner_process", new_person: "new_relationship", partner: "existing_relationship", ex: "ex_relationship", future_partner: "potential_future_relationship", crush: "one_sided_interest",
  friend: "friendship", coworker: "coworker", boss: "coworker", team: "coworker", business_partner: "business_partnership", relative: "family", other: null };

// ---------- намерение позиции ----------

const INTENT_RULES = [
  [/за (этим )?образ|скрыто|глубже всего|не показываю|приписыва|может оставаться|в тени|стоит за/, "hidden"],
  [/показывает мне|проявляет|образ/, "shows"],
  [/притягива|цепляет|зажигает|запускает притяжени/, "attraction"],
  [/осталось|незаверш|ещё живо/, "remains"],
  [/зачем|почему|пробудила|пробуждает|отражает|чему меня|что она отражает/, "meaning"],
  [/куда|вероятн|потенциал|сценарий|маршрут|развити|движется|вынести|дальше/, "trend"],
  [/получить|получу|выгод|дала/, "gain"],
  [/мешает|тормозит|переступить|риск|напряжени|граница/, "obstacle"],
  [/чего я .*хочу|что мне нужно|хочу получить/, "want"],
  [/шаг|как мне|что делать|как сделать|как я могу|сыграть|как лучше|завершить/, "action"],
  [/как я сейчас отношусь|что я вношу|моя роль|какую роль/, "self_side"],
  [/между нами|динамик|происходит|двигател|что сейчас/, "dynamic"],
];
const READ_INTENT = { "PA:tendency": "trend", "PA:blind_spot": "hidden", "PA:obstacle": "obstacle", "PA:resource": "gain", "PA:advice": "action", "PA:understand": "meaning", "PA:influence": "dynamic", "PA:present": "dynamic", "PA:shadow": "obstacle" };
const ROLE_INTENT = { situation: "dynamic", notice: "hidden", influence: "dynamic", action: "trend" };
const INTENT_CLASS = { shows: "surface", attraction: "surface", hidden: "depth", obstacle: "depth", remains: "depth", meaning: "story", gain: "story", want: "story", trend: "future", action: "action", self_side: "state", dynamic: "state" };

export function positionIntent(position) {
  const name = String(position.name ?? "").toLowerCase().replace(/ё/g, "е");
  for (const [re, intent] of INTENT_RULES) if (re.test(name)) return intent;
  return READ_INTENT[position.read?.[0]] ?? ROLE_INTENT[position.role] ?? "dynamic";
}

// ---------- намерение вопроса ----------

const QINTENT = [
  ["attracts", ["почему меня цепляет", "почему так цепляет", "почему меня тянет", "почему до сих пор цепляет", "что меня притягива", "почему не могу перестать", "почему меня до сих пор"]],
  ["meaning", ["для чего", "зачем", "что эта история", "почему именно", "смысл", "чему учит", "что это значит для меня", "почему эта встреча"]],
  ["future", ["куда движ", "потенциал", "есть ли будущее", "что будет", "чем закончится", "перспектив", "вероятн", "есть ли шанс", "вернется", "получится ли", "стоит ли", "что дальше", "к чему это приведет", "к чему все приведет", "куда это ведет", "куда идет"]],
  ["shows", ["какой он", "какая она", "что за человек", "настоящее лицо", "истинное лицо", "что скрывает", "недоговарива", "загадочн"]],
  ["remains", ["что осталось", "до сих пор", "отпустить", "закрыть", "завершить", "забыть"]],
  ["happening", ["что происходит", "что между нами", "что между мной", "что между ними", "что со мной и", "как мы", "что у нас", "как он ко мне", "как она ко мне", "что со мной и"]],
  ["act", ["что делать", "как поступить", "как мне", "как быть", "как себя вести"]],
];
const INTENT_TO_Q = { attraction: "attracts", meaning: "meaning", trend: "future", shows: "shows", hidden: "shows", remains: "remains", dynamic: "happening", action: "act", gain: "meaning", want: "attracts" };

export function scanSubject(text, spread = {}, personal = {}) {
  const t = normA(text);
  const found = {};
  for (const [k, stems] of Object.entries(SUBJECT_MARKERS)) { const i = firstAt(t, stems); if (i >= 0) found[k] = i; }
  // «нравится» не перебивает явных ролей; «друг» не перебивает романтической роли
  if (found.crush !== undefined && ["ex", "partner", "new_person", "future_partner"].some((k) => found[k] !== undefined)) delete found.crush;
  const cand = Object.keys(found);
  let subject;
  if (cand.length) {
    const work = cand.filter((k) => WORK_SUBJECTS.includes(k));
    const pool = work.length && (spread.theme === "Работа и бизнес" || !cand.some((k) => ["ex", "partner", "new_person"].includes(k) && found[k] < Math.min(...work.map((w) => found[w])))) ? work : cand;
    pool.sort((a, b) => found[a] - found[b] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
    subject = pool[0];
  } else if (personal?.role === "initiator" || personal?.role === "left") subject = "ex";
  else subject = SPREAD_SUBJECT[spread.id] ?? (spread.theme === "Отношения" ? "other" : "self");

  const states = [];
  const add = (s) => { if (s && !states.includes(s)) states.push(s); };
  add(BASE_STATE[subject]);
  if (hasAny(t, STATE_MARKERS.no_contact)) add("no_contact");
  if (hasAny(t, STATE_MARKERS.conflict)) add("conflict");
  if (hasAny(t, STATE_MARKERS.sexual)) add("sexual_attraction");
  if (hasAny(t, STATE_MARKERS.one_sided) && !["ex", "partner", "friend"].includes(subject)) add("one_sided_interest");
  if ((subject === "new_person" || subject === "crush") && hasAny(t, STATE_MARKERS.potential)) add("potential_future_relationship");
  if (subject === "crush" && !states.includes("one_sided_interest")) states.unshift("one_sided_interest");

  let q = null;
  for (const [id, stems] of QINTENT) if (hasAny(t, stems)) { q = id; break; }
  if (!q && spread.question) { const tq = normA(spread.question); for (const [id, stems] of QINTENT) if (hasAny(tq, stems)) { q = id; break; } }
  if (!q) q = "happening";
  const group = GROUP_OF[subject];
  const labels = subject === "self" ? [] : [SUBJECT_LABEL[subject], ...states.filter((s) => s !== BASE_STATE[subject] || ["ex_relationship", "new_relationship", "existing_relationship"].includes(s)).map((s) => STATE_LABEL[s])];
  return { subject, group, states, qintent: q, labels: [...new Set(labels.filter(Boolean))],
    // слой категории для текстов: работа — рабочий, дружба/семья — психологический (романтический слой «Отношений» тут не подходит)
    layerOverride: group === "work" ? "work" : group === "friend" || group === "family" ? "psychology" : null };
}

// ---------- грани карты (контекстно независимое ядро) ----------

const txt = (v) => (typeof v === "string" ? v : Array.isArray(v) ? txt(v[0]) : v?.hypothesis ?? v?.text ?? v?.q ?? v?.default ?? "");
const hasFocus = (L, tags) => (L?.focus ?? []).some((f) => tags.includes(f));
const lensText = (c, tags) => (c.card.ARCANA_SYNTHESIS?.context_lenses ?? []).find((l) => (l.when ?? []).some((w) => tags.includes(w)))?.text ?? "";

// порядок слоёв категории для граней «желание» и «власть»: по группе субъекта, чтобы рабочая ситуация не читалась романтическим слоем
const LAYER_ORDER = {
  work: ["work", "decision", "self_development", "psychology", "relationships"],
  friend: ["psychology", "self_development", "decision", "relationships"],
  family: ["psychology", "self_development", "relationships"],
  self: ["self_development", "psychology", "creative", "relationships"],
};
const LAYER_ORDER_DEFAULT = ["relationships", "self_development", "psychology", "creative", "work", "decision"];

export function cardFacets(c, group = "other") {
  const k = c.card, syn = k.ARCANA_SYNTHESIS ?? {}, pa = k.POSITIONAL_APPLICATION ?? {}, L = k.THEMATIC_LAYERS ?? {};
  const layer = (name) => L[name]?.text ?? "";
  const f = {
    CORE: txt(syn.core_reading),
    STRENGTH: k.IN_STRENGTH ?? txt(syn.resource),
    SHADOW: k.IN_SHADOW ?? txt(syn.shadow),
    REL: layer("relationships") || txt(syn.relationships),
    PSY: layer("psychology") || txt(syn.psychology),
    CHANGE: txt(pa.tendency) || txt(pa.advice),
    WORK: layer("work") || txt(syn.work_money) || txt(syn.work_decision),
    SELF: layer("self_development") || txt(syn.self_development),
    DESIRE: "", POWER: "", VISUAL: k.RECOGNITION?.signature ?? "",
  };
  // желание/притяжение и власть/границы: Манара — по акцентам слоёв, RWS — по контекстным линзам
  const layerNames = LAYER_ORDER[group] ?? LAYER_ORDER_DEFAULT;
  f.DESIRE = layerNames.map((n) => L[n]).find((e) => hasFocus(e, ["desire", "attraction", "passion", "embodiment"]))?.text || lensText(c, ["desire", "attraction"]);
  f.POWER = layerNames.map((n) => L[n]).find((e) => hasFocus(e, ["power", "control", "boundaries", "dependence"]))?.text || lensText(c, ["boundaries", "conflict", "coworker"]);
  return f;
}

// ---------- какие грани читаем для субъекта и класса позиции ----------

const PRIORITY_FACETS = {
  new:     { state: ["DESIRE", "REL", "STRENGTH", "PSY", "CORE"], surface: ["DESIRE", "STRENGTH", "REL", "CORE"], depth: ["PSY", "SHADOW", "REL", "CORE"], story: ["PSY", "CHANGE", "STRENGTH", "CORE"], future: ["CHANGE", "STRENGTH", "REL", "CORE"], action: ["CHANGE", "STRENGTH", "SELF", "CORE"] },
  ex:      { state: ["PSY", "SHADOW", "REL", "CORE"], surface: ["SHADOW", "PSY", "DESIRE", "CORE"], depth: ["SHADOW", "PSY", "REL", "CORE"], story: ["PSY", "CHANGE", "SHADOW", "CORE"], future: ["CHANGE", "SHADOW", "PSY", "CORE"], action: ["CHANGE", "SELF", "PSY", "CORE"] },
  partner: { state: ["REL", "POWER", "SHADOW", "STRENGTH", "CORE"], surface: ["STRENGTH", "REL", "DESIRE", "CORE"], depth: ["POWER", "SHADOW", "REL", "CORE"], story: ["REL", "CHANGE", "STRENGTH", "CORE"], future: ["CHANGE", "REL", "STRENGTH", "CORE"], action: ["POWER", "CHANGE", "REL", "CORE"] },
  friend:  { state: ["PSY", "POWER", "STRENGTH", "SHADOW", "CORE"], surface: ["STRENGTH", "PSY", "SELF", "CORE"], depth: ["SHADOW", "PSY", "POWER", "CORE"], story: ["PSY", "SELF", "STRENGTH", "CORE"], future: ["CHANGE", "STRENGTH", "PSY", "CORE"], action: ["CHANGE", "POWER", "SELF", "CORE"] },
  work:    { state: ["WORK", "POWER", "SHADOW", "STRENGTH", "CORE"], surface: ["WORK", "STRENGTH", "POWER", "CORE"], depth: ["POWER", "SHADOW", "WORK", "CORE"], story: ["WORK", "CHANGE", "STRENGTH", "CORE"], future: ["CHANGE", "WORK", "STRENGTH", "CORE"], action: ["POWER", "CHANGE", "WORK", "CORE"] },
  family:  { state: ["PSY", "SELF", "SHADOW", "CORE"], surface: ["STRENGTH", "SELF", "CORE"], depth: ["PSY", "SHADOW", "SELF", "CORE"], story: ["PSY", "SELF", "CHANGE", "CORE"], future: ["CHANGE", "PSY", "SELF", "CORE"], action: ["CHANGE", "SELF", "POWER", "CORE"] },
  other:   { state: ["REL", "PSY", "SHADOW", "CORE"], surface: ["STRENGTH", "REL", "CORE"], depth: ["SHADOW", "PSY", "REL", "CORE"], story: ["PSY", "REL", "CHANGE", "CORE"], future: ["CHANGE", "REL", "STRENGTH", "CORE"], action: ["CHANGE", "POWER", "REL", "CORE"] },
  self:    { state: ["SELF", "PSY", "CORE"], surface: ["STRENGTH", "CORE"], depth: ["SHADOW", "PSY"], story: ["PSY", "SELF"], future: ["CHANGE", "SELF"], action: ["CHANGE", "SELF"] },
};

// Романтическая лексика: в рабочих, дружеских и семейных ситуациях такие предложения не используются
const ROMANTIC = /влечен|страст|секс|влюбл|соблазн|постел|эрот|возбужд|романт|поцел|ласк|интим|измен|жених|свидан|любовн|партнёр|партнер|близост|желани|(?:^|[^а-яё])(?:пары|паре|пара|пару)(?![а-яё])/i;
const ROMANTIC_BIZ = /влечен|страст|секс|влюбл|постел|эрот|возбужд|романт|поцел|ласк|интим|измен|жених|свидан|любовн|близост/i;
export const romanticFilter = (group) => needsFilter(group);
const needsFilter = (group) => (group === "friend" || group === "family" ? ROMANTIC : group === "work" ? ROMANTIC_BIZ : null);

// Состояние связи сдвигает, какие грани читать первыми
function keysFor(S, cls) {
  const base = PRIORITY_FACETS[S.group]?.[cls] ?? PRIORITY_FACETS.other[cls];
  const front = [];
  if (S.states.includes("conflict") && ["state", "depth", "action"].includes(cls)) front.push("POWER");
  if (S.states.includes("sexual_attraction") && ["state", "surface", "depth"].includes(cls)) front.push("DESIRE");
  if (S.states.includes("no_contact") && ["depth", "story", "future"].includes(cls)) front.push("PSY");
  if (S.states.includes("one_sided_interest") && ["state", "surface", "future"].includes(cls)) front.push("DESIRE", "PSY");
  return [...new Set([...front, ...base])];
}

const META_SENT = /Гипотеза Arcana|не утверждается|не патологизируется|авторск|изображени|источник|базовый текст/i;
function pickFacet(facets, keys, group, used) {
  const re = needsFilter(group);
  for (const key of keys) {
    const sents = cmpSentences(facets[key]).filter((s) => (!re || !re.test(s)) && !META_SENT.test(s));
    const s = sents[0];
    if (!s || used.has(s)) continue;
    used.add(s);
    // короткое предложение дополняем следующим
    const second = sents[1] && s.length < 90 && !used.has(sents[1]) ? sents[1] : null;
    if (second) used.add(second);
    return { key, text: second ? `${s} ${second}` : s };
  }
  return null;
}

// ---------- рамка: кто и что читается в этой позиции ----------

const HEDGE = ["В этой позиции карта может показывать ", "Если читать карту как состояние этой связи, она подсвечивает ", "Скорее всего, карта здесь обращает внимание на "];
const OBJ = {
  new: { state: "динамику, которая складывается между вами на старте", surface: "то, что в этом человеке или в этой встрече включает отклик", depth: "то, что за первым впечатлением может оставаться неясным и где легко достроить образ", story: "то, зачем эта встреча может быть в твоей жизни и что она затрагивает", future: "потенциал связи и тенденцию, если всё продолжится так, как идёт", action: "то, что стоит сделать, чтобы связь развивалась по-настоящему, а не в фантазии" },
  ex: { state: "то, как эта история существует сейчас, уже после расставания", surface: "то, что до сих пор держит притяжение к бывшему", depth: "то, что в этой связи осталось нерешённым внутри тебя", story: "то, чему эта история могла тебя научить и зачем она была в твоей жизни", future: "вероятную тенденцию: движется ли история к завершению, паузе или новому витку", action: "то, что поможет завершить или переосмыслить эту связь" },
  partner: { state: "то, как устроена ваша повседневная динамика", surface: "то, что вы друг в друге проявляете и что держит притяжение", depth: "то, где в вашей связи скрыты напряжение, власть и границы", story: "то, что эти отношения дают тебе и чему учат", future: "тенденцию развития отношений при нынешней динамике", action: "то, что может укрепить или изменить эту связь" },
  friend: { state: "то, как сейчас устроена ваша дружба", surface: "то, что вы друг в друге цените", depth: "то, где в дружбе может прятаться обида, зависть или невысказанное", story: "то, что эта дружба значит для тебя и чему учит", future: "то, куда может двигаться эта дружба", action: "то, что поможет сохранить дружбу или честно её пересмотреть" },
  work: { state: "то, как устроена рабочая динамика: роли, статус, влияние", surface: "то, какую роль и силу эта сторона проявляет в работе", depth: "то, где могут скрываться интересы, конкуренция или давление", story: "то, что эта рабочая ситуация даёт тебе по ресурсам и урокам", future: "вероятное развитие в работе при нынешнем курсе", action: "то, какой ход сохранит границы, репутацию и позицию" },
  family: { state: "то, как устроена семейная динамика между вами", surface: "то, какую роль каждый играет в этой семейной истории", depth: "то, какие старые сценарии и обиды могут стоять за напряжением", story: "то, чему эта связь учит тебя", future: "то, куда может двигаться эта семейная история", action: "то, какой шаг может смягчить или прояснить отношения" },
  self: { state: "то, что происходит внутри тебя в этой теме", surface: "то, какая часть тебя здесь на виду", depth: "то, что остаётся в тени внутри", story: "то, что этот процесс может открыть тебе", future: "то, куда может вести этот внутренний процесс", action: "то, какой шаг по отношению к себе здесь важен" },
  other: { state: "динамику между тобой и этим человеком, как её можно прочитать", surface: "то, что в этом человеке или в вашей связи на виду", depth: "то, что может оставаться за этим и в тени", story: "то, что эта связь значит для тебя", future: "тенденцию развития этой связи", action: "то, что поможет в этой ситуации" },
};
// уточнения для конкретных субъектов внутри группы
const OBJ_SUBJECT = {
  crush: { state: "то, как складывается твой интерес и что в нём можно прочитать про ответ другой стороны", future: "потенциал при одностороннем интересе: куда он может вести, если ничего не менять" },
  future_partner: { state: "то, какой тип связи может быть для тебя на подходе", surface: "то, какие качества притягивают тебя в будущем партнёре", future: "то, в каком направлении может развернуться встреча" },
  boss: { state: "расстановку сил с начальником", depth: "то, где скрыты ожидания, давление и границы", action: "то, как держать позицию в отношениях с начальником" },
  team: { state: "динамику группы и твоё место в ней", depth: "то, где в коллективе копится напряжение или недоверие", action: "то, как сохранить границы и репутацию в коллективе" },
  business_partner: { state: "то, как устроен ваш союз по делу", depth: "то, где могут расходиться интересы", future: "тенденцию сотрудничества при нынешней динамике" },
  coworker: { state: "то, как устроена ваша рабочая связь", depth: "то, где может скрываться конкуренция или недосказанность" },
};

function leadFor(subject, group, cls, i) {
  const obj = OBJ_SUBJECT[subject]?.[cls] ?? OBJ[group]?.[cls] ?? OBJ.other[cls];
  const join = /^(как|что|где|зачем|чему) /.test(obj) ? ", " : "";
  return `${HEDGE[i % 3].replace(/ $/, "")}${join || " "}${obj}.`;
}

// ---------- адаптация одной карты ----------

// reader(c, position, topic) — чтение карты в позиции из ядра (cardInPosition); topic=null берёт нейтральный слот
export function adaptCard(c, i, r, reader) {
  const S = r.situation;
  if (!S || S.subject === "self") return null;
  const position = r.positions[i], intent = positionIntent(position), cls = INTENT_CLASS[intent] ?? "state";
  const facets = cardFacets(c, S.group);
  const used = new Set();
  const keys = keysFor(S, cls);
  const first = pickFacet(facets, keys, S.group, used);
  const second = pickFacet(facets, keys.filter((k) => k !== first?.key), S.group, used);
  // Текст позиции из ядра карты: для нероманических групп — из нейтрального слота (без «партнёр, близость»).
  // Общий «core_reading» не берём: он не зависит ни от позиции, ни от субъекта — его роль играют грани выше.
  let posText = r.readings[i].text;
  if (["friend", "family", "work"].includes(S.group) && !c.reversed) {
    const neutral = reader(c, position, null, r.question)?.text;
    if (neutral) posText = neutral;
  }
  const generic = position.read?.[0] === "SYN:core_reading" && !c.reversed;
  const re = needsFilter(S.group);
  if (re && posText) {
    const all = cmpSentences(posText), kept = all.filter((x) => !re.test(x));
    posText = kept.length === all.length ? posText : null;      // часть текста отфильтрована как романтическая — оставшийся обрывок не используем, читаем через грани
  }
  if (generic && (first || second)) posText = null;
  else if (posText && !c.reversed && (first || second)) posText = cmpSentences(posText)[0] ?? null;
  return { intent, cls, group: S.group, subject: S.subject, lead: leadFor(S.subject, S.group, cls, i),
    facet: first?.text ?? null, facetKey: first?.key ?? null, facet2: second?.text ?? null, facet2Key: second?.key ?? null, posText };
}

// ---------- синтез: кто с кем и что читаем ----------

const WHO = { self: "тебя и твой внутренний процесс", new_person: "новую связь с новым человеком", partner: "твои отношения с текущим партнёром", ex: "твою историю с бывшим партнёром",
  future_partner: "возможного будущего партнёра", crush: "тебя и человека, который тебя притягивает", friend: "твою дружбу", coworker: "твою рабочую связь с коллегой",
  business_partner: "твой союз с деловым партнёром", boss: "твои отношения с начальником", team: "динамику в команде", relative: "твою связь с родственником", other: "твою связь с этим человеком" };
const STATE_PHRASE = { no_contact: "в которой сейчас нет контакта", conflict: "где есть напряжение или конфликт", one_sided_interest: "где интерес пока односторонний", sexual_attraction: "с сильным телесным притяжением" };
const LENS = {
  attracts: { new: "что именно включает притяжение и где в нём реальный потенциал, а где достроенная фантазия", ex: "почему связь продолжает держать, хотя она закончилась, и что в ней осталось неоконченным внутри тебя",
    partner: "что продолжает притягивать вас друг к другу и что это притяжение может защищать", _: "что именно цепляет и о чём это притяжение для тебя" },
  meaning: { new: "зачем эта встреча появилась и что она открывает в тебе", ex: "чем эта история была для тебя: чему она учила и что осталось с тобой", partner: "что эти отношения тебе дают и чему учат",
    work: "что эта рабочая ситуация значит для твоего пути", self: "что этот процесс может открыть", _: "что эта связь значит для тебя и чему учит" },
  future: { new: "потенциал связи и вероятную тенденцию, если всё продолжится так, как идёт", ex: "есть ли у истории продолжение, а если нет, как она вероятнее завершается",
    partner: "тенденцию развития отношений при нынешней динамике", work: "вероятное развитие ситуации при нынешнем курсе", _: "вероятную тенденцию, если ничего не менять" },
  happening: { _: "что на самом деле происходит между вами и что этим движет" },
  shows: { _: "что человек показывает и что может стоять за этим образом (как гипотезы, а не факты)" },
  remains: { ex: "что осталось после этой истории и что в ней можно завершить внутри себя", _: "что осталось после этой истории и что в ней можно завершить" },
  act: { _: "какие шаги помогут именно в этой ситуации" },
};
const CAVEAT = "Карты показывают динамику между вами и вероятную тенденцию, а не точные мысли другого человека.";
const STATE_NOTE = {
  no_contact: "Пока контакта нет, связь читается в твоём восприятии и во внутреннем состоянии, а не как то, что происходит у другого в голове.",
  conflict: "В конфликте полезно различать, что карта говорит о твоей позиции, а что о самой динамике спора.",
  one_sided_interest: "При одностороннем интересе карты показывают скорее твой отклик и ожидания, чем ответ другой стороны.",
  sexual_attraction: "Телесное притяжение здесь отдельная линия: стоит различать влечение и то, что за ним стоит.",
};

export function situationFrame(S) {
  if (!S || S.subject === "self") return null;
  const states = S.states.filter((s) => STATE_PHRASE[s]);
  const stateText = states.length ? `, ${states.slice(0, 2).map((s) => STATE_PHRASE[s]).join(" и ")}` : "";
  const q = LENS[S.qintent ?? "happening"] ?? LENS.happening;
  const lens = q[S.group] ?? q._ ?? LENS.happening._;
  const parts = [`Это расклад про ${WHO[S.subject]}${stateText}.`, `Карты читают ${lens}.`];
  const notes = S.states.map((s) => STATE_NOTE[s]).filter(Boolean);
  if (S.subject !== "self" && ["ex", "new_person", "crush", "future_partner", "partner", "other"].includes(S.subject)) parts.push(notes[0] ?? CAVEAT);
  else if (notes[0]) parts.push(notes[0]);
  return parts.join(" ");
}

export const subjectLabels = (S) => S?.labels ?? [];
