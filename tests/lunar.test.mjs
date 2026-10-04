// Лунный гид: астрономия (сверка с NASA и Life-Moon), границы суток, данные, предупреждение 9/19/29.
import fs from "node:fs";
import { Astronomy as A } from "./_astronomy.mjs";
import { ASTANA, lunarSnapshot, phaseName, signOf, localDayBounds, fmtTime, fmtWhen, fmtLeft, moonLitPath, waxLabel, lunarDay, isWarningDay, warningText, dayShifted, dayOnDate, dayBytes } from "../engine/lunar.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const data = JSON.parse(fs.readFileSync(new URL("../knowledge/lunar/lunar-days.json", import.meta.url), "utf8"));
const iso = (d) => d.toISOString();

// 1. Астрономические опорные точки (NASA): новолуние и полнолуние до двух минут
const nm = A.SearchMoonPhase(0, new Date("2025-01-20T00:00:00Z"), 20).date, fm = A.SearchMoonPhase(180, new Date("2025-03-01T00:00:00Z"), 20).date;
check(Math.abs(nm - new Date("2025-01-29T12:36:00Z")) < 2 * 60e3, `новолуние ${iso(nm)} совпадает с NASA (2025-01-29 12:36 UTC)`);
check(Math.abs(fm - new Date("2025-03-14T06:55:00Z")) < 2 * 60e3, `полнолуние ${iso(fm)} совпадает с NASA (2025-03-14 06:55 UTC)`);

// 2. Сверка нумерации с Life-Moon: 3 октября 2026 — 22-е лунные сутки
for (const t of ["2026-10-03T00:30:00+05:00", "2026-10-03T12:00:00+05:00", "2026-10-03T19:00:00+05:00"]) {
  const s = lunarSnapshot(new Date(t), A); check(s.day === 22, `${t} → ${s.day}-е сутки (Life-Moon: 22-е)`);
}
// переход в 23-е: после восхода Луны вечером 3 октября
const snap = lunarSnapshot(new Date("2026-10-03T19:00:00+05:00"), A);
check(snap.nextDay === 23 && snap.dayEnd > snap.now && snap.msLeft > 0 && snap.msLeft < 27 * 3600e3, `следующие сутки: ${snap.nextDay}-е в ${fmtTime(snap.dayEnd)} (${fmtLeft(snap.msLeft)})`);

// 3. Целостность циклов: год с шагом 6 часов (границы), 4 месяца с шагом 20 минут (последовательность)
let bounds = 0, steps = 0;
const t0 = new Date("2026-01-01T00:00:00+05:00").getTime();
for (let k = 0; k < 4 * 365; k++) { const s = lunarSnapshot(new Date(t0 + k * 6 * 3600e3), A); steps++; if (!(s.dayStart <= s.now && s.now < s.dayEnd && s.day >= 1 && s.day <= 30)) bounds++; }
check(bounds === 0, `${steps} моментов за год: момент всегда внутри границ своих суток, номер 1–30`);
let prev = null, lengths = [], bad = 0, minDay = 99, maxDay = 0, n2 = 0;
const t1 = new Date("2026-08-01T00:00:00+05:00").getTime();
for (let k = 0; k < 3 * 24 * 120; k++) {
  const s = lunarSnapshot(new Date(t1 + k * 20 * 60e3), A); n2++;
  minDay = Math.min(minDay, s.day); maxDay = Math.max(maxDay, s.day);
  if (prev && s.day !== prev.day) { const ok2 = s.day === prev.day + 1 || (s.day === 1 && prev.nextIsNewMoon); if (!ok2) bad++; if (s.day === 1) lengths.push(prev.totalDays); }
  prev = s;
}
check(bad === 0, `${n2} моментов за 120 дней: сутки идут строго по порядку (+1; после последних — 1-е с новолуния)`);
check(minDay === 1 && maxDay <= 30 && lengths.length >= 3 && lengths.every((n) => n === 29 || n === 30), `в лунном месяце 29 или 30 суток: ${lengths.join(", ")}`);

// 4. Фаза, знак, восход и заход
check(phaseName(0) === "Новолуние" && phaseName(90) === "Первая четверть" && phaseName(180) === "Полнолуние" && phaseName(270) === "Последняя четверть" && phaseName(40) === "Растущий серп" && phaseName(140) === "Растущая Луна" && phaseName(220) === "Убывающая Луна" && phaseName(320) === "Убывающий серп", "названия фаз по углу Луна–Солнце");
check(signOf(0).name === "Овен" && signOf(100.7).inName === "Раке" && signOf(359).name === "Рыбы", "знак по эклиптической долготе (100,7° — Рак)");
check(snap.sign.name === "Рак" && snap.phase.name === "Последняя четверть", `3.10.2026 19:00 (Астана): ${snap.phase.name}, Луна в ${snap.sign.inName}`);
check(snap.moonrise && snap.moonset && snap.moonrise > localDayBounds(snap.now, ASTANA.tz).start && snap.moonrise < localDayBounds(snap.now, ASTANA.tz).end, `восход ${fmtTime(snap.moonrise)}, заход ${fmtTime(snap.moonset)} (местное время Астаны)`);
const b = localDayBounds(new Date("2026-10-03T19:00:00+05:00"), ASTANA.tz);
check(b.end - b.start === 24 * 3600e3 && fmtTime(b.start) === "00:00", "местные сутки Asia/Almaty: 24 ч, начало 00:00");
check(fmtTime(new Date("2026-10-03T16:47:00Z")) === "21:47", "время в Asia/Almaty: UTC+5");
check(fmtWhen(new Date("2026-10-04T02:03:00+05:00"), new Date("2026-10-03T19:00:00+05:00")) === "завтра в 02:03", "«завтра в 02:03»");
check(fmtLeft(2 * 3600e3 + 47 * 60e3) === "2 ч 47 мин" && fmtLeft(40 * 60e3) === "40 мин", "«через 2 ч 47 мин»");
check(moonLitPath(0) === "" && moonLitPath(180).length > 10 && moonLitPath(90).includes("A"), "контур освещённой части Луны для рисунка");

// 5. Библиотека данных: 30 суток по Rivendel, структура, нет лишних категорий и медицины
const days = data.days;
check(days.length === 30 && days.every((d, i) => d.n === i + 1), "30 лунных суток по порядку");
const RIVENDEL = ["Светильник", "Рог изобилия", "Леопард", "Древо познания добра и зла", "Единорог", "Журавль", "Роза ветров", "Феникс", "Летучая мышь", "Фонтан", "Кундалини", "Сердце", "Колесо", "Две трубы", "Огненный змей", "Бабочка", "Шакти", "Зеркало", "Паук", "Орел", "Табун лошадей", "Ганеша", "Крокодил Маккара", "Шива", "Черепаха", "Болото", "Трезубец", "Лотос", "Гидра", "Золотой лебедь"];
const norm = (x) => x.replace(/ё/g, "е");
check(days.every((d, i) => norm(d.symbol) === RIVENDEL[i]), "символы всех 30 суток совпадают с Rivendel (moonday.php?md=1–30)");
check(days[21].symbol === "Ганеша" && days[22].symbol === "Крокодил Маккара" && days[23].symbol === "Шива", "22-е — Ганеша, 23-е — Крокодил Маккара, 24-е — Шива");
const need = ["symbol", "character", "recommended", "avoid", "practice", "reflection_question", "spheres", "readings", "source_notes"];
check(days.every((d) => need.every((k) => d[k])), "у каждых суток: символ, характер, рекомендуется, лучше не делать, практика, вопрос, сферы, расклады, источник");
check(days.every((d) => d.recommended.length >= 4 && d.recommended.length <= 6 && d.avoid.length >= 3 && d.avoid.length <= 5), "«Рекомендуется» 4–6 пунктов, «Лучше не делать» 3–5 пунктов у всех суток");
const SPH = Object.keys(data.sphere_labels);
check(SPH.join() === "relationships,work,business,self_development,creative,rest,meditation,reflection", "8 сфер: отношения, работа, бизнес, саморазвитие, творчество, отдых, медитация, рефлексия");
check(days.every((d) => SPH.every((k) => ["good", "neutral", "caution"].includes(d.spheres[k]))), "у каждой сферы статус: подходит / нейтрально / осторожно");
check(JSON.stringify(data.sphere_status_labels) === JSON.stringify({ good: "подходит", neutral: "нейтрально", caution: "осторожно" }), "подписи статусов сфер");
const BANNED = /лечен|болезн|диет|похуд|давлен|зачат|беремен|стрижк|окрашив|маникюр|садовод|огород|рассад|свадьб|брак[ае]?\b|ЗАГС|лекарств|здоровь|врач|таблетк|питани|кулинар/i;
check(!days.some((d) => BANNED.test(JSON.stringify(d.recommended) + JSON.stringify(d.avoid) + d.character + d.practice)), "нет лишних категорий и медицинских утверждений (стрижки, питание, садоводство, зачатие, свадьбы, здоровье)");
check(days.every((d) => d.character.length < 230 && d.practice.length < 150 && d.recommended.every((x) => x.length < 55) && d.avoid.every((x) => x.length < 55)), "тексты короткие");
check(days.every((d) => /rivendel\.ru\/moonday\.php\?md=\d+/.test(d.source_notes)), "у каждых суток указан источник (Rivendel moonday.php?md=N)");
check(days.filter((d) => d.readings === "postpone").map((d) => d.n).join() === "9,19,29", "«лучше отложить» для раскладов: 9, 19, 29");
check(days.filter((d) => d.readings === "favorable").map((d) => d.n).join() === "3,7,12,16,21,26", "«подходит» для раскладов: 3, 7, 12, 16, 21, 26 (по ряду источников)");
check(JSON.stringify(data.readings_labels) === JSON.stringify({ favorable: "подходит", neutral: "нейтрально", postpone: "лучше отложить" }), "индикатор раскладов: подходит / нейтрально / лучше отложить");
check(/традиционн/i.test(data._status) && /не научный прогноз/i.test(days[0].source_notes), "данные помечены как традиционная система, не научный прогноз");
check(waxLabel(40) === "Растущая Луна" && waxLabel(179) === "Растущая Луна" && waxLabel(181) === "Убывающая Луна" && waxLabel(270) === "Убывающая Луна" && waxLabel(350) === "Убывающая Луна", "основная подпись фазы: только «Растущая / Убывающая Луна»");
check(snap.phase.angle >= 180 && waxLabel(snap.phase.angle) === "Убывающая Луна", "3.10.2026 (после полнолуния): Убывающая Луна");

// 6. Предупреждение 9 / 19 / 29
check([9, 19, 29].every((n) => isWarningDay(data, n)) && ![1, 8, 10, 15, 18, 20, 28, 30].some((n) => isWarningDay(data, n)), "предупреждение только для 9, 19, 29");
check(warningText(data, 19) === "Сегодня 19-е лунные сутки. В некоторых традициях это считается неподходящим временем для раскладов.", "текст предупреждения");
check(lunarDay(data, 19).symbol === "Паук" && lunarDay(data, 9).symbol === "Летучая мышь" && lunarDay(data, 29).symbol === "Гидра", "символы 9, 19, 29");

// 7. Реальные даты с 9, 19 и 29 сутками находятся
const found = {};
for (let k = 0; k < 90 * 4 && Object.keys(found).length < 3; k++) { const s = lunarSnapshot(new Date(Date.UTC(2026, 9, 3, 12) + k * 6 * 3600e3), A); if ([9, 19, 29].includes(s.day)) found[s.day] ??= iso(s.now); }
check(Object.keys(found).length === 3, `в ближайшие месяцы встречаются 9, 19 и 29 сутки: ${JSON.stringify(found)}`);

// 8. Байт-советы: 12 знаков, 30 суток, правила стрижки, вчера/завтра
const BY = data.bytes, SIGN_NAMES = ["Овен","Телец","Близнецы","Рак","Лев","Дева","Весы","Скорпион","Стрелец","Козерог","Водолей","Рыбы"];
check(SIGN_NAMES.every((n) => BY.signs[n]?.hair && BY.signs[n].care && BY.signs[n].mind && BY.signs[n].colors.length >= 2 && ["good","neutral","avoid","caution"].includes(BY.signs[n].hair_verdict)), "байт-советы: у всех 12 знаков стрижка, цвета, ментальный фон");
check(Array.from({ length: 30 }, (_, i) => BY.business[String(i + 1)]).every((x) => x && x.length < 110), "байт-советы: бизнес-строка для каждых из 30 суток, коротко");
check(["Рак","Рыбы","Овен","Стрелец"].every((n) => BY.signs[n].hair_verdict === "avoid") && ["Телец","Дева","Козерог","Лев"].every((n) => BY.signs[n].hair_verdict === "good"), "стрижка по знаку: Рак/Рыбы/Овен/Стрелец — нет; Телец/Дева/Козерог/Лев — да (Rivendel)");
check(!/иммунитет|заболева|болезн|лечен|диагноз|здоровь/i.test(JSON.stringify(BY)), "байт-советы без медицинских утверждений");
const sn3 = lunarSnapshot(new Date("2026-10-03T12:00:00+05:00"), A), by3 = dayBytes(data, sn3);
check(sn3.sign.name === "Рак" && by3.beauty.verdict === "avoid" && /маск/.test(by3.beauty.sub) && by3.colors.includes("жемчужный"), "3.10.2026, Луна в Раке: стрижка нет, маска, жемчужный");
const by23 = dayBytes(data, { ...sn3, day: 9, sign: { name: "Телец" } });
check(by23.beauty.verdict === "avoid" && /9-е сутки/.test(by23.beauty.text), "9-е сутки перебивают добрый знак: стрижку отложить");
const yday = lunarSnapshot(dayShifted(sn3.now, -1), A), tmr = lunarSnapshot(dayShifted(sn3.now, 1), A);
check(yday.day === 21 && tmr.day === 23, `вчера ${yday.day}-е, завтра ${tmr.day}-е сутки (3.10.2026 = 22-е)`);
check(dayShifted(sn3.now, 0) === sn3.now, "сдвиг 0 — тот же момент");
const on = lunarSnapshot(dayOnDate("2026-10-18"), A), onNear = lunarSnapshot(dayOnDate("2026-10-03"), A);
check(onNear.day === 22 && on.day >= 8 && on.day <= 10 && fmtTime(dayOnDate("2026-10-03")) === "12:00", `выбор даты: 3.10.2026 → ${onNear.day}-е, 18.10.2026 → ${on.day}-е, полдень по Астане`);
process.exit(ok ? 0 : 1);
