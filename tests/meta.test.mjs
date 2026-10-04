// Мета-движок: психологические векторы по всем категориям и формула «Главного инсайта».
import { reading, scanMeta } from "../engine/arcana.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const cards = (...ids) => ids.map((id) => ({ id: `MANARA_${id}` }));
const run = (spreadId, q, ids) => reading({ spreadId, question: q, cards: cards(...ids) });

const cases = [
  // [категория, расклад, текст, ожидаемые вектора, фрагмент формулы инсайта]
  ["Отношения", "rel.unfinished", "Я сама ушла 7 месяцев назад, но продолжаю проверять его страницу", { activity: "initiator", time: "past", search: "власти" }, "позиции Инициатора, и спустя 7 месяцев"],
  ["Отношения", "rel.unfinished", "Меня бросили 2 месяца назад, и я не понимаю, как жить дальше", { activity: "passive", search: "безопасности" }, "позиции Ведомого, и спустя 2 месяца"],
  ["Работа и бизнес", "work.team_climate", "Начальник давит и не замечает моих результатов, уже полгода тяну", { activity: "passive", time: "past", search: "безопасности" }, "позиции Ведомого, и спустя полгода"],
  ["Творчество", "art.show", "Боюсь вести сторис, стесняюсь показывать себя, хотя хочу запустить свой блог", { activity: "initiator", expression: "block", search: "ресурса" }, "внутренний поиск ресурса"],
  ["Решения и перемены", "decision.ab", "Стоит ли мне принимать оффер? Боюсь, как будет на новом месте", { time: "future", activity: "passive" }, "эта история ещё не случилась"],
  ["Психология", "psy.inner_conflict", "Часть меня хочет перемен, а другая цепляется за привычное, не знаю куда идти", { expression: "block", search: "ресурса" }, "внутренний поиск ресурса"],
  ["Саморазвитие", "self.pattern", "Я решила бросить курить, но срываюсь, полгода одно и то же", { activity: "initiator", time: "past" }, "позиции Инициатора"],
];
for (const [theme, sid, q, want, formula] of cases) {
  const r = run(sid, q, ["FIRE_04", "AIR_06", "MAJOR_15"]);
  const m = r.meta;
  check(r.spread.theme === theme, `[${theme}] расклад из нужной категории`);
  for (const [k, v] of Object.entries(want)) check(m[k] === v, `[${theme}] вектор ${k} = ${v} (получилось ${m[k]})`);
  check(r.synthesis.insight.includes(formula), `[${theme}] инсайт по формуле: «…${formula}…»`);
  check(!!r.synthesis.projection, `[${theme}] есть правило проекции для категории`);
}
// контроль: нейтральный текст не получает ложных векторов
const n = scanMeta("Хочу понять, что мне важно увидеть в этой ситуации", "Саморазвитие");
check(!n.activity && !n.time && !n.expression, "нейтральный текст — векторов нет");
// безопасность важнее формулы
const sf = run("rel.unfinished", "Мы расстались, а он преследует меня, мне страшно", ["FIRE_04", "AIR_06", "MAJOR_15"]);
check(!!sf.synthesis.safetyNote && sf.synthesis.insight.startsWith("Расклад здесь не про его намерения"), "при угрозе безопасности инсайт начинается с границ, а не с формулы");
process.exit(ok ? 0 : 1);
