// Библиотека «Отношения» и «Работа и бизнес»: структура, рекомендации, режим 18+ только в «Ночной туши».
import { SPREADS, recommendSpreads, reading, loadCard } from "../engine/arcana.mjs";
import { drawCards } from "../engine/draw.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const REL = SPREADS.filter((s) => s.theme === "Отношения" && !s.hidden), WORK = SPREADS.filter((s) => s.theme === "Работа и бизнес");
const adult = REL.filter((s) => s.adult), pub = REL.filter((s) => !s.adult);
const ROLES = new Set(["situation", "influence", "notice", "action"]);
const READ = /^(PA:(present|blind_spot|influence|obstacle|resource|understand|tendency|advice|shadow)|SYN:(core_reading|shadow|relationships|work_decision|psychology))$/;

check(pub.length === 9 && adult.length === 3, `Отношения: ${pub.length} обычных и ${adult.length} в режиме 18+ (каталог 3 × 4)`);
check(WORK.length >= 7, `Работа и бизнес: ${WORK.length} раскладов`);
for (const s of [...REL, ...WORK]) {
  const bad = [];
  if (s.positions.length !== 3) bad.push("не 3 позиции");
  if (!s.name || !s.when || !s.question || !s.why || !s.tags?.length) bad.push("нет названия/описания/вопроса/пользы/тегов");
  if (s.why.length < 60) bad.push("короткое «зачем»");
  for (const p of s.positions) { if (!ROLES.has(p.role)) bad.push("роль " + p.role); if (!p.read?.length || !p.read.every((r) => READ.test(r))) bad.push("read " + p.read); if (!p.name) bad.push("имя позиции"); }
  if (!(s.question_from >= 1 && s.question_from <= 3 && s.action_from >= 1 && s.action_from <= 3)) bad.push("question_from/action_from");
  check(bad.length === 0, `${s.id} · «${s.name}»${bad.length ? ": " + bad.join("; ") : ""}`);
}
const names = [...REL, ...WORK].map((s) => s.name.toLowerCase());
check(new Set(names).size === names.length, "названия не повторяются");
const posNames = [...REL, ...WORK].flatMap((s) => s.positions.map((p) => p.name.toLowerCase()));
check(new Set(posNames).size === posNames.length, "нет двух одинаковых названий позиций");
// отношения и работа звучат по-разному: словарь позиций почти не пересекается
const words = (arr) => new Set(arr.flatMap((s) => s.positions.flatMap((p) => p.name.toLowerCase().split(/[^а-яё]+/).filter((w) => w.length > 5))));
const wr = words(REL), ww = words(WORK); const common = [...wr].filter((w) => ww.has(w));
check(common.length / Math.min(wr.size, ww.size) < 0.2, `лексика позиций «Отношений» и «Работы» различается (общих слов ${common.length})`);
check(adult.every((s) => s.adult === true) && SPREADS.filter((s) => s.adult).every((s) => s.theme === "Отношения"), "18+ только в категории «Отношения»");

// Рекомендации: 18+ скрыты без «Ночной туши»
const top = (q, o) => recommendSpreads(q, 3, o).map((r) => r.spread.id);
check(!recommendSpreads("Хочу вернуть либидо, пропало желание и страсть угасла", 36).some((r) => r.spread.adult), "без «Ночной туши» расклады 18+ не рекомендуются");
check(["adult.alchemy", "adult.body_block"].includes(top("Хочу вернуть либидо, пропало желание и страсть угасла", { adult: true })[0]), "в «Ночной туши»: либидо → «Алхимия страсти» или «Тело и блок»");
check(top("Меня накрыло желание, избыток энергии, не знаю куда деть возбуждение", { adult: true })[0] === "adult.alchemy", "в «Ночной туши»: избыток возбуждения → «Алхимия страсти»");
check(!SPREADS.some((s) => s.id === "adult.power"), "расклад «Власть и согласие» удалён");
check(top("У нас разная частота желаний и разные фантазии, подходим ли мы в постели", { adult: true }).some((id) => ["adult.compat", "adult.passion_anatomy", "adult.fantasy"].includes(id)), "в «Ночной туши»: совместимость → расклад 18+");
const cases = [
  ["В моей жизни появился новый человек, меня к нему тянет, но не понимаю что это за история", "rel.new_person"],
  ["Он кажется загадочным, что-то недоговаривает, хочу снять розовые очки", "rel.true_face"],
  ["Куда движется наша связь, есть ли перспектива", "rel.vector"],
  ["Почему именно этот человек появился в моей жизни, зачем эта встреча", "rel.why_this_person"],
  ["Есть ли шанс помириться и вернуть отношения", "rel.second_act"],
  ["Что у нас происходит, как мы друг к другу относимся", "rel.diagnostics"],
  ["У меня есть бизнес-идея, взлетит ли она, что проверить перед запуском", "work.idea_value"],
  ["Хочу своё дело, но не знаю какое, как найти нишу", "work.find_niche"],
  ["Как представить идею инвесторам и найти союзников, нужен питч", "work.pitch"],
  ["Деловой партнёр и совместный бизнес, к чему это приведёт", "work.partner"],
  ["В коллективе сплетни и интриги, кажется что меня подсиживают", "work.team_climate"],
  ["Не понимаю, что происходит с моим положением на работе", "work.situation"],
];
for (const [q, id] of cases) { const t = top(q); check(t.slice(0, 2).includes(id), `«${q.slice(0, 55)}…» → ${id} (топ: ${t.join(", ")})`); }

// Все расклады читаются на обеих колодах, а формулировки не обещают будущее как гарантию
const GUARANTEE = /(?<!не )(?<!как )гарантир|точно (будет|случится|вернётся)|обязательно (будет|случится|вернётся)|непременно|(?<!знаю об этом человеке )наверняка/i;   // «Что я знаю об этом человеке наверняка…» — вопрос для размышления, а не гарантия

let runs = 0, bad = 0, errors = 0;
for (const s of [...REL, ...WORK]) for (const deck of ["MANARA", "RWS"]) for (let k = 0; k < 6; k++) {
  const q = s.adult ? "Хочу понять наше желание и близость" : "Хочу понять, что происходит в этой ситуации и куда она движется";
  try {
    const r = reading({ spreadId: s.id, question: q, cards: drawCards({ deck, count: 3, reversals: deck === "RWS" && k % 2 === 0 }) });
    runs++;
    const strings = []; const walk = (v) => { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
    walk([r.screen.insight, r.screen.flow, r.screen.synergy, r.screen.cards.map((c) => [c.analysis, c.doNow])]);
    if (strings.some((x) => GUARANTEE.test(x) || /undefined|\bnull\b/.test(x))) bad++;
  } catch (e) { errors++; console.log("   ошибка", s.id, deck, e.message); }
}
check(errors === 0 && bad === 0, `${runs} раскладов по новым схемам (обе колоды): без ошибок, без «гарантий» и пустых мест`);
// соло-расклады 18+ читаются через слой «Саморазвитие», а не «Отношения» (про пару)
check(["adult.alchemy", "adult.libido", "adult.fantasy"].every((id) => SPREADS.find((s) => s.id === id).layer === "self_development"), "соло-расклады 18+ используют слой «Саморазвитие»");
// перспективные позиции опираются на слот «тенденция»
const trend = SPREADS.filter((s) => ["rel.new_person", "rel.direction", "rel.second_act", "work.partner"].includes(s.id));
check(trend.every((s) => s.positions[2].read.includes("PA:tendency")), "перспективные расклады читают третью позицию через «тенденцию»");
// Каталог «Отношения»: 4 ряда по 3 расклада, короткие названия и подписи, ряд 18+ только для adult
import { readFileSync } from "node:fs";
const rows = JSON.parse(readFileSync(new URL("../knowledge/spreads/triplets.json", import.meta.url), "utf8")).rows["Отношения"];
check(rows.length === 4 && rows.every((r) => r.ids.length === 3) && rows.filter((r) => r.adult).length === 1 && rows[3].adult, "каталог «Отношения»: 4 ряда × 3 расклада, 4-й ряд 18+");
const ids12 = rows.flatMap((r) => r.ids), by = Object.fromEntries(SPREADS.map((s) => [s.id, s]));
check(ids12.length === 12 && new Set(ids12).size === 12 && ids12.every((id) => by[id] && !by[id].hidden && by[id].theme === "Отношения"), "12 раскладов каталога существуют и не скрыты");
check(rows.slice(0, 3).flatMap((r) => r.ids).every((id) => !by[id].adult) && rows[3].ids.every((id) => by[id].adult), "18+ только в 4-м ряду");
check(["Крючок", "Искра и маршрут", "Человек за образом", "Двое и пространство", "Вектор связи", "Зеркало", "Конфликт", "Второй акт", "Стоп-кран", "Анатомия страсти", "Алхимия страсти", "Тело и блок"].every((n, i) => by[ids12[i]].name === n), "названия и порядок как в ТЗ");
check(ids12.every((id) => by[id].name.length <= 22 && by[id].when.length <= 64 && by[id].positions.every((p) => p.name.length <= 48)), "названия, подписи и позиции короткие");
check(["rel.between_us", "rel.direction", "rel.needs", "rel.unfinished", "adult.eros_shadow", "adult.libido", "adult.compat", "adult.fantasy"].every((id) => by[id].hidden === true), "старые расклады скрыты из каталога");
const alch = by["adult.alchemy"].positions[2];
check(/сублимац/i.test(alch.name + alch.analyze) && !/разрядк/i.test(JSON.stringify(by["adult.alchemy"].positions)), "«Алхимия страсти»: третья позиция про сублимацию, без «разрядки»");
check(!/(?:секс|оргазм|минет|член)\w*/i.test(JSON.stringify([by["adult.body_block"], by["adult.passion_anatomy"], by["adult.alchemy"]].map((s) => s.positions.map((p) => p.name)))), "названия позиций 18+ без грубой лексики");
check(top("Он токсичный, манипулирует мной, контролирует каждый шаг, это красные флаги")[0] === "rel.stop_crane", "«токсичный / манипулирует / красные флаги» → «Стоп-кран»");
check(top("Не могу расслабиться в близости, зажим и нет удовольствия", { adult: true })[0] === "adult.body_block", "«не могу расслабиться» (в «Ночной туши») → «Тело и блок»");
check(!recommendSpreads("Не могу расслабиться в близости, зажим и нет удовольствия", 36).some((r) => r.spread.adult), "«Тело и блок» без «Ночной туши» не рекомендуется");
check(SPREADS.filter((s) => s.id === "rel.stop_crane" || s.id === "adult.body_block").every((s) => s.positions.some((p) => p.grounding)) , "«Стоп-кран» и «Тело и блок» читаются как гипотеза, а не диагноз (grounding или осторожные позиции)");
// Каталог «Работа и бизнес»: 4 ряда × 3 расклада
const wrows = JSON.parse(readFileSync(new URL("../knowledge/spreads/triplets.json", import.meta.url), "utf8")).rows["Работа и бизнес"];
const wids = wrows.flatMap((r) => r.ids);
check(wrows.length === 4 && wrows.every((r) => r.ids.length === 3) && wids.length === 12 && new Set(wids).size === 12 && wids.every((id) => by[id] && by[id].theme === "Работа и бизнес" && !by[id].hidden), "каталог «Работа и бизнес»: 4 ряда × 3 расклада");
check(["Поиск ниши", "Бизнес-идея", "Новая роль", "Моя позиция", "Питч", "Самозванец", "Партнёр по делу", "Коллектив", "Босс", "Финансовая опора", "Стеклянный потолок", "План Б"].every((n, i) => by[wids[i]].name === n), "работа: названия и порядок как в ТЗ");
check(top("Синдром самозванца, боюсь заявить о себе и поднять чек")[0] === "work.impostor", "самозванец → «Самозванец»");
check(top("Выгорание, тупик и застой, не вижу роста на работе")[0] === "work.ceiling", "выгорание → «Стеклянный потолок»");
check(top("Меня могут уволить, провал на проекте, кризис на работе")[0] === "work.plan_b", "увольнение → «План Б»");
check(top("Не понимаю, что хочет от меня начальник")[0] === "work.boss", "начальник → «Босс»");
check(by["work.boss"].positions[0].grounding && /гипотеза/i.test(by["work.boss"].positions[0].grounding), "«Босс»: ожидания руководителя читаются как гипотеза");
process.exit(ok ? 0 : 1);
