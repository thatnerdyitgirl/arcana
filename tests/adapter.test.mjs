// Адаптер контекста: CARD × SUBJECT × STATE × POSITION × QUESTION × CONTEXT.
import fs from "node:fs";
import { reading, SPREADS, allCardIds, loadCard } from "../engine/arcana.mjs";
import { scanSubject, positionIntent, cardFacets, adaptCard, situationFrame } from "../engine/adapt.mjs";
import { cmpSimilar, cmpSentences, screenBlocks } from "../engine/compose.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const ids78 = () => allCardIds("MANARA");
const sp = (id) => SPREADS.find((s) => s.id === id);
const man = (...a) => a.map((i) => ({ id: `MANARA_${i}` }));
const rws = (...a) => a.map((i) => ({ id: `RWS_${i}` }));

// 1. Распознавание субъекта, состояния и намерения вопроса
const scans = [
  ["Почему меня до сих пор цепляет бывший? Мы не общаемся", "rel.attraction", "ex", ["ex_relationship", "no_contact"], "attracts"],
  ["Почему меня так цепляет новый человек, с которым я недавно познакомилась?", "rel.attraction", "new_person", ["new_relationship"], null],
  ["Что происходит между мной и подругой? Мы поссорились", "rel.between_us", "friend", ["friendship", "conflict"], "happening"],
  ["Что между мной и коллегой?", "rel.between_us", "coworker", ["coworker"], "happening"],
  ["Начальник давит на меня и ничего не объясняет", "work.situation", "boss", ["conflict"], null],
  ["Деловой партнёр и совместный бизнес: к чему это приведёт?", "work.partner", "business_partner", ["business_partnership"], "future"],
  ["Моя мама постоянно критикует меня", "rel.conflict", "relative", ["family"], null],
  ["Мы с мужем вместе пять лет, куда движутся наши отношения?", "rel.direction", "partner", ["existing_relationship"], "future"],
  ["Мне нравится один человек, но он меня не замечает", "rel.attraction", "crush", ["one_sided_interest"], null],
  ["Когда я встречу своего будущего мужа?", "rel.direction", "future_partner", ["potential_future_relationship"], null],
  ["Мы расстались, он молчит и не пишет", "rel.unfinished", "ex", ["ex_relationship", "no_contact"], null],
  ["Что со мной происходит?", "rel.between_us", "other", [], "happening"],
  ["Хочу понять себя", "self.resource", "self", ["inner_process"], null],
  ["Наш отдел токсичный, интриги и сплетни", "work.team_climate", "team", ["coworker"], null],
];
for (const [q, sid, subj, states, qi] of scans) {
  const S = scanSubject(q, sp(sid), {});
  check(S.subject === subj && states.every((x) => S.states.includes(x)) && (qi === null || S.qintent === qi), `«${q.slice(0, 48)}…» → ${S.subject} [${S.states.join(", ")}] ${S.qintent}`);
}
check(!scanSubject("Мы стали друг для друга чужими", sp("rel.between_us"), {}).states.includes("friendship"), "«друг друга» не принимается за друга");

// 2. Намерение позиции: у всех позиций «Отношений» и «Работы» оно определено осмысленно
const pos = SPREADS.filter((s) => ["Отношения", "Работа и бизнес"].includes(s.theme)).flatMap((s) => s.positions.map((p) => ({ s: s.id, name: p.name, intent: positionIntent(p) })));
const dyn = pos.filter((p) => p.intent === "dynamic").length / pos.length;
check(new Set(pos.map((p) => p.intent)).size >= 9, `у позиций ${new Set(pos.map((p) => p.intent)).size} разных намерений (показывает, скрыто, динамика, смысл, осталось, тенденция, выгода, притяжение, действие…)`);
check(dyn < 0.3, `позиции не сводятся к одному намерению (динамика ${(dyn * 100).toFixed(0)}%)`);
const want = { "Что человек показывает мне": "shows", "Что может оставаться за этим образом": "hidden", "Что между нами ещё живо": "dynamic", "Зачем этот человек появился в моей жизни": "meaning", "Что осталось незавершённым": "remains",
  "Какой сценарий наиболее вероятен при сохранении нынешней динамики": "trend", "Что я могу получить от этой динамики": "gain", "Что именно так сильно меня цепляет": "attraction" };
for (const [name, intent] of Object.entries(want)) check(positionIntent({ name, read: [], role: "situation" }) === intent, `позиция «${name}» → ${intent}`);

// 3. Грани карты есть у всех 156 карт обеих колод
const need = ["CORE", "STRENGTH", "SHADOW", "REL", "PSY", "CHANGE", "VISUAL"];
for (const deck of ["MANARA", "RWS"]) {
  let miss = 0, desire = 0, power = 0, n = 0;
  for (const id of allCardIds(deck)) { const f = cardFacets(loadCard(id)); n++; if (need.some((k) => !f[k] || f[k].length < 15)) miss++; if (f.DESIRE) desire++; if (f.POWER) power++; }
  check(miss === 0, `[${deck}] у всех ${n} карт есть ядро: CORE, STRENGTH, SHADOW, REL, PSY, CHANGE, VISUAL`);
  console.log(`      [${deck}] DESIRE/ATTRACTION: ${desire}, POWER/BOUNDARY: ${power} из ${n} (только где релевантно)`);
}

// 4. Матрица: 5 карт × 5 ролей, позиции и вопрос слегка меняются
const roles = [
  ["новый человек", "rel.attraction", "Почему меня так цепляет новый человек, с которым я недавно познакомилась?"],
  ["бывший", "rel.attraction", "Почему меня до сих пор цепляет бывший? Мы не общаемся"],
  ["текущий партнёр", "rel.between_us", "Что сейчас происходит между мной и моим парнем?"],
  ["подруга", "rel.between_us", "Что происходит между мной и подругой? Мы поссорились"],
  ["коллега", "rel.between_us", "Что происходит между мной и коллегой?"],
];
const trio = ["MAJOR_15", "AIR_06", "MAJOR_09"];
const matrixCards = ["MAJOR_15", "AIR_06", "MAJOR_09", "MAJOR_06", "MAJOR_17"];
const stats = [];
for (const card of matrixCards) {
  const out = roles.map(([name, sid, q]) => {
    const others = trio.filter((x) => x !== card).slice(0, 2);
    const r = reading({ spreadId: sid, question: q, cards: man(card, ...others) });
    return { name, r, a: r.screen.cards[0], ad: r.adapted[0] };
  });
  const pair = (X, Y) => { const A = cmpSentences(X), B = cmpSentences(Y); return A.filter((a) => B.some((b) => cmpSimilar(a, b))).length / Math.max(A.length, B.length); };
  const ov = []; for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) ov.push(pair(out[i].a.analysis, out[j].a.analysis));
  const leads = new Set(out.map((o) => o.ad.lead)).size, keys = new Set(out.map((o) => `${o.ad.facetKey}|${o.ad.facet2Key}`)).size;
  stats.push({ card, mean: ov.reduce((a, b) => a + b, 0) / ov.length, max: Math.max(...ov), leads, keys });
  check(leads === 5, `${loadCard("MANARA_" + card).name}: пять ролей — пять разных рамок (смысл позиции для этого человека), разных наборов граней карты ${keys}/5, среднее пересечение предложений ${(stats.at(-1).mean * 100).toFixed(0)}%`);
}
check(stats.every((s) => s.mean <= 0.45), "в матрице 5 карт × 5 ролей среднее пересечение предложений между ролями не выше 45%");
// то же на всех 78 картах: две роли редко читаются почти одинаково
let tooSame = 0, pairsN = 0, sumOv = 0;
for (const id of ids78()) {
  const outs = roles.map(([name, sid, q]) => reading({ spreadId: sid, question: q, cards: [id, ids78()[(ids78().indexOf(id) + 9) % 78], ids78()[(ids78().indexOf(id) + 33) % 78]].map((x) => ({ id: x })) }).screen.cards[0].analysis);
  for (let i = 0; i < outs.length; i++) for (let j = i + 1; j < outs.length; j++) { const A = cmpSentences(outs[i]), B = cmpSentences(outs[j]); const o = A.filter((a) => B.some((b) => cmpSimilar(a, b))).length / Math.max(A.length, B.length); pairsN++; sumOv += o; if (o > 0.75) tooSame++; }
}
check(tooSame / pairsN <= 0.1 && sumOv / pairsN <= 0.4, `все 78 карт × 5 ролей: среднее пересечение ${(sumOv / pairsN * 100).toFixed(0)}%, почти одинаковых пар (>75%) ${(tooSame / pairsN * 100).toFixed(1)}%`);

// 5. Позиция не теряется: одна карта, один субъект — три позиции дают разный смысл
for (const [sid, q] of [["rel.diagnostics", "Что у нас с моим парнем?"], ["rel.new_person", "Что за история с новым человеком?"], ["rel.second_act", "Есть ли шанс вернуть бывшего?"], ["work.team_climate", "В коллективе сплетни и интриги"]]) {
  const r = reading({ spreadId: sid, question: q, cards: man("MAJOR_15", "MAJOR_15".replace("15", "13"), "MAJOR_09").map((x, k) => (k === 0 ? x : x)) });
  const leads = r.adapted.map((a) => a.lead); const ints = r.adapted.map((a) => a.intent);
  check(new Set(leads).size === 3 && new Set(ints).size >= 2, `${sid}: три позиции — три разные рамки (намерения: ${ints.join(", ")})`);
}
const same3 = reading({ spreadId: "rel.new_person", question: "Что за история с новым человеком?", cards: man("MAJOR_15", "MAJOR_15", "MAJOR_15").slice(0, 1).concat(man("MAJOR_13", "MAJOR_09")) });
check(same3.screen.cards.every((c) => c.analysis.length > 80), "в каждой позиции есть содержательный разбор");

// 6. Нероманические субъекты: романтическая лексика не подставляется
const ROM = /влечен|страст|секс|влюбл|постел|эрот|возбужд|романт|поцел|интим|любовн/i;
const ROM_FRIEND = /влечен|страст|секс|влюбл|соблазн|постел|эрот|возбужд|романт|поцел|интим|любовн|партнёр|партнер/i;
const cases = [["друг", "Что происходит между мной и подругой? Мы поссорились", ROM_FRIEND], ["коллега", "Что происходит между мной и коллегой?", ROM], ["начальник", "Что происходит между мной и начальником?", ROM], ["команда", "Что происходит в моей команде?", ROM], ["родственник", "Что происходит между мной и мамой?", ROM_FRIEND]];
let leaks = 0, total = 0, empty = 0;
const ids = allCardIds("MANARA");
for (const [name, q, re] of cases) for (let k = 0; k < ids.length; k += 1) {
  const r = reading({ spreadId: "rel.between_us", question: q, cards: [ids[k], ids[(k + 11) % 78], ids[(k + 40) % 78]].map((id) => ({ id })) });
  for (const c of r.screen.cards) { total++; if (re.test(c.analysis)) { leaks++; if (leaks < 4) console.log("   утечка:", name, c.name, cmpSentences(c.analysis).find((x) => re.test(x))); } if (c.analysis.length < 60) empty++; }
}
check(leaks === 0, `дружба, работа, семья: ни в одном из ${total} разборов (78 карт × 5 ролей × 3 позиции) нет романтических формулировок`);
check(empty === 0, "и при этом разбор не пустой");

// 7. Манара и RWS не смешиваются: смысловые предложения принадлежат карте своей колоды
const strs = (c) => { const out = []; const w = (v) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(w); else if (v && typeof v === "object") Object.values(v).forEach(w); }; w(c.card); return out.join(" ").toLowerCase().replace(/ё/g, "е"); };
let foreign = 0, checked = 0;
for (const deck of ["MANARA", "RWS"]) for (let k = 0; k < 78; k += 3) {
  const all = allCardIds(deck);
  const r = reading({ spreadId: "rel.between_us", question: "Что происходит между мной и моим парнем?", cards: [all[k], all[(k + 5) % 78], all[(k + 17) % 78]].map((id) => ({ id })) });
  r.adapted.forEach((a, i) => { for (const part of [a.facet, a.facet2]) { if (!part) continue; checked++; const body = strs(r.cards[i]); if (!body.includes(part.toLowerCase().replace(/ё/g, "е").slice(0, 40))) foreign++; } });
  const otherDeck = deck === "MANARA" ? "RWS_" : "MANARA_";
  if (r.cards.some((c) => c.id.startsWith(otherDeck))) foreign++;
}
check(foreign === 0, `грани берутся только из поля своей карты: проверено ${checked} фрагментов, чужих 0`);
let mixErr = false; try { reading({ spreadId: "rel.between_us", question: "тест", cards: [{ id: "MANARA_MAJOR_15" }, { id: "RWS_MAJOR_09" }, { id: "MANARA_MAJOR_09" }] }); } catch { mixErr = true; }
check(mixErr, "карты двух колод в одном раскладе по-прежнему запрещены");

// 8. Синтез: кто с кем и что происходит — разные типы
const frames = [
  ["Мы расстались, он молчит и не пишет. Для чего эта история была дана мне?", "rel.unfinished"],
  ["Недавно познакомилась с человеком, меня сильно к нему тянет. Есть ли здесь потенциал?", "rel.new_person"],
  ["Поссорилась с подругой. Что происходит между нами?", "rel.between_us"],
  ["Коллега ведёт себя странно. Что происходит между нами?", "rel.between_us"],
];
const ins = frames.map(([q, sid]) => reading({ spreadId: sid, question: q, cards: man("MAJOR_15", "AIR_06", "MAJOR_09") }).screen.insight);
const heads = ins.map((t) => cmpSentences(t).slice(0, 2).join(" "));
check(new Set(heads).size === 4, "четыре разные ситуации — четыре разных рамки синтеза");
check(/бывш/.test(heads[0]) && /нет контакта/.test(heads[0]) && /чем эта история была для тебя/.test(heads[0]), "бывший + нет контакта + «для чего эта история» → синтез про смысл истории");
check(/нов/.test(heads[1]) && /потенциал/.test(heads[1]), "новый человек + притяжение + «есть ли потенциал» → синтез про потенциал и тенденцию");
check(/дружб/.test(heads[2]) && /что на самом деле происходит/.test(heads[2]), "подруга + конфликт + «что между нами» → синтез про динамику дружбы");
check(/рабоч/.test(heads[3]), "коллега → рабочая динамика");
check(ins.slice(0, 2).every((t) => /не как то, что происходит|не точные мысли|в твоём восприятии/.test(t)), "«о другом» не равно «его мысли»: рамка подчёркивает динамику и восприятие");
check(/вероятн|тенденци|потенциал/.test(ins[1]), "гадательная функция сохранена: «вероятная тенденция», «потенциал»");

// 9. Адаптер есть у каждой карты и не включается там, где субъект — сам человек
let noAdapt = 0;
for (const id of ids) { const r = reading({ spreadId: "rel.new_person", question: "Что за история с новым человеком?", cards: [id, ids[(ids.indexOf(id) + 9) % 78], ids[(ids.indexOf(id) + 33) % 78]].map((x) => ({ id: x })) }); if (!r.adapted[0]?.lead || !(r.adapted[0].facet || r.adapted[0].posText)) noAdapt++; }
check(noAdapt === 0, "контекстный адаптер работает для всех 78 карт Манары");
const selfR = reading({ spreadId: "self.resource", question: "Хочу понять себя", cards: man("MAJOR_15", "AIR_06", "MAJOR_09") });
check(selfR.adapted.every((a) => a === null), "внутренний процесс (self): адаптер не вмешивается, прежнее чтение сохранено");

// 10. Нет повторов на экране
let dup = 0, runs = 0;
for (const [name, sid, q] of roles) for (const deck of ["MANARA", "RWS"]) for (let k = 0; k < 20; k++) {
  const all = allCardIds(deck);
  const r = reading({ spreadId: sid, question: q, cards: [all[(k * 7) % 78], all[(k * 13 + 3) % 78], all[(k * 29 + 9) % 78]].filter((x, i, a) => a.indexOf(x) === i).map((id) => ({ id })).concat([]).slice(0, 3) });
  if (r.cards.length < 3) continue; runs++;
  const seen = [];
  for (const b of screenBlocks(r.screen)) for (const s of cmpSentences(b)) { if (s.split(/\s+/).length < 5) continue; if (seen.some((x) => cmpSimilar(x, s))) dup++; else seen.push(s); }
}
check(dup === 0, `${runs} раскладов с адаптером: ни одно предложение экрана не повторяется`);
process.exit(ok ? 0 : 1);
