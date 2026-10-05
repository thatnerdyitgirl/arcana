// Матрица судьбы: расчёты (сверка с опубликованными примерами и независимой реализацией), база знаний, тексты, лексика.
import fs from "node:fs";
import { red, parseBirth, calcMatrix, ageCircle, currentPeriod, pairMatrix, matrixEnergies, POINT_KEYS } from "../engine/matrix.mjs";
import { makeMatrixText } from "../engine/matrix_text.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const rd = (f) => JSON.parse(fs.readFileSync(new URL("../knowledge/matrix/" + f, import.meta.url), "utf8"));
const KB = { energies: rd("energies.json").energies, positions: rd("positions.json").positions, config: rd("config.json") };
const T = makeMatrixText(KB);

// 1. сведение чисел (сложение цифр; ≤ 22 не трогаем)
check([1, 22, 23, 24, 30, 31, 27, 87, 100, 1999].map(red).join() === "1,22,5,6,3,4,9,15,1,28".split(",").map((x, i) => i === 9 ? 10 : Number(x)).join(), "сведение: 22 остаётся, 23→5, 30→3, 87→15, 100→1, 1999→28→10");
check(red(44) === 8 && red(29) === 11 && red(2000) === 2, "сведение: 44→8, 29→11, 2000→2");

// 2. Опубликованный пример 1 (Прибылова, фрагмент книги): 08.03.1960 — точки, «физика», «энергия», «эмоции»
const a = calcMatrix({ d: 8, m: 3, y: 1960 }), p = a.pts;
check([p.A, p.B, p.V, p.G, p.D].join() === "8,3,16,9,9" && [p.E, p.Zh, p.Z, p.I].join() === "11,19,7,17", "08.03.1960: A=8 Б=3 В=16 Г=9 Д=9; Е=11 Ж=19 З=7 И=17");
check(p.A + p.L + p.K + red(p.K + p.D) + p.D + p.O + p.V === 8 + 7 + 17 + 8 + 9 + 7 + 16, "08.03.1960: столбец «Физика» 8+7+17+8+9+7+16 = 72 (как в книге)");
check(p.B + p.N + p.M + red(p.M + p.D) + p.D + p.R + p.G === 3 + 15 + 12 + 21 + 9 + 18 + 9, "08.03.1960: столбец «Энергия» 3+15+12+21+9+18+9 = 87 (как в книге)");
check([red(p.A + p.B), red(p.L + p.N), red(p.K + p.M), red(red(p.K + p.D) + red(p.M + p.D)), red(p.D + p.D), red(p.R + p.O), red(p.G + p.V)].join() === "11,22,11,11,18,7,7", "08.03.1960: столбец «Эмоции» 11,22,11,11,18,7,7 (как в книге)");
const c = ageCircle(p);
check([c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8]].join() === "8,17,9,10,19,22,3,14,11", "08.03.1960: круг лет 0–10: 8, 17, 9, 10, 19, 22, 3, 14, 11 (как в книге)");
check(c[44] === 16 && c[12] === 14 && red(c[44] + c[12]) === 3, "08.03.1960: «троичный код года» в 55 лет = 16, 14, 3 (как в книге)");
const per = currentPeriod(a, new Date(2015, 2, 20));
check(Math.floor(per.age) === 55 && per.first === 16 && per.second === 14 && per.result === 3, "currentPeriod: в 55 лет 16 / 14 / 3");

// 3. Опубликованный пример 2 (разбор по методу Ладини, 26.08.1989): точки и предназначения
const b = calcMatrix({ d: 26, m: 8, y: 1989 });
check([b.pts.A, b.pts.B, b.pts.V, b.pts.G, b.pts.D].join() === "8,8,9,7,5" && b.purposes.sky === 15 && b.purposes.earth === 17 && b.purposes.personal === 5, "26.08.1989: 8,8,9,7,5; Небо 15, Земля 17, личное 5");
check([b.pts.E, b.pts.Z, b.purposes.male, b.pts.Zh, b.pts.I, b.purposes.female, b.purposes.social, b.purposes.general].join() === "16,16,5,17,15,5,10,15", "26.08.1989: 16,16→5; 17,15→5; социальное 10; общее 15");

// 4. Независимая реализация на 12 датах (в т. ч. 29.02, границы месяцев, 01.01, 31.12)
const ind = JSON.parse(fs.readFileSync(new URL("./fixtures/matrix-indep.json", import.meta.url), "utf8")); let all = 0, bad = [];
for (const [s, exp] of Object.entries(ind)) {
  const q = parseBirth(s, new Date(2030, 0, 1)); if (q.error) { bad.push(s + " parse"); continue; }
  const mx = calcMatrix(q), circ = ageCircle(mx.pts); all++;
  const same = Object.entries(exp.pts).every(([k, v]) => mx.pts[k] === v) && Object.entries(exp.purposes).every(([k, v]) => mx.purposes[k] === v) && mx.kinPower === exp.kin && mx.innerPower === exp.inner && circ.join() === exp.circle.join();
  if (!same) bad.push(s);
}
check(all === 12 && bad.length === 0, `12 дат: точки, предназначения, сила рода и круг лет совпали с независимой реализацией ${bad.join(", ")}`);
check(POINT_KEYS.length === 28 && POINT_KEYS.every((k) => Number.isInteger(a.pts[k]) && a.pts[k] >= 1 && a.pts[k] <= 22), "28 точек, все в диапазоне 1–22");
check(ageCircle(p).length === 64 && ageCircle(p).every((x) => x >= 1 && x <= 22), "круг лет: 64 точки, 1–22");

// 5. Ввод даты
check(parseBirth("08.03.1960").d === 8 && parseBirth("8/3/1960").m === 3 && parseBirth("08031960").y === 1960, "ввод даты: разные разделители и без них");
check(parseBirth("31.02.1990").error && parseBirth("00.01.1990").error && parseBirth("1.1.1850").error && parseBirth("01.01.2999").error && parseBirth("abc").error, "ввод даты: несуществующие, до 1900, будущее, мусор отклоняются");
check(!parseBirth("29.02.2000").error && parseBirth("29.02.1900").error, "ввод даты: 29.02.2000 есть, 29.02.1900 нет");

// 6. Пара
const pm = pairMatrix(a, b);
check(pm.pair.A === red(p.A + b.pts.A) && pm.pair.D === red(p.D + b.pts.D), "пара: одноимённые точки складываются");
check(matrixEnergies(a).has(p.A) && matrixEnergies(a).size <= 22, "множество энергий матрицы");

// 7. База знаний
const need = "name short archetype mode themes keywords strength shadow talents potential relations money work growth difficulties recommendations questions sources confidence".split(" ");
check(KB.energies.length === 22 && KB.energies.every((e, i) => e.n === i + 1 && need.every((k) => e[k] && (!Array.isArray(e[k]) || e[k].length))), "22 энергии со всеми полями и источниками");
check(KB.energies[2].name === "Императрица" && KB.energies[2].short === "Создание · изобилие · воплощение" && KB.energies[7].name === "Справедливость" && KB.energies[10].name === "Сила" && KB.energies[21].name === "Шут", "номера: 3 Императрица, 8 Справедливость, 11 Сила, 22 Шут");
const words = JSON.stringify(KB);
const BANNED = /у тебя будет|ты обречена|обречен|токсичн|манипулятор|навсегда|непременно|гарантир|плохая энергия денег|не подходит тебе|диагноз:|болезн|иммунитет|лечит/i;
check(!BANNED.test(words), "нет приговоров и гарантий: «у тебя будет», «обречена», «токсичный», «манипулятор», «плохая энергия денег»");
check(Object.keys(KB.positions).length >= 36 && POINT_KEYS.every((k) => KB.positions[k]), "описаны все 28 точек и предназначения");

// 8. Тексты: 12 дат × 6 тем
let blanks = 0, repeats = 0, topicsRun = 0;
for (const s of Object.keys(ind)) {
  const mx = calcMatrix(parseBirth(s, new Date(2030, 0, 1)));
  for (const t of KB.config.topics) {
    const r = T.ask(mx, t.id, new Date(2026, 9, 5)); topicsRun++;
    const parts = r.period ? [] : r.blocks.map((x) => x.text);
    if (!r.period) { if (parts.some((x) => !x)) blanks++; const sentences = parts.filter(Boolean); if (new Set(sentences).size !== sentences.length) repeats++; if (!r.check.question || !r.check.action) blanks++; }
    else if (!r.period.main.name || r.period.directions.some((d) => !d.text)) blanks++;
  }
}
check(topicsRun === 72 && blanks === 0 && repeats === 0, `72 обзора (12 дат × 6 тем): без пустых блоков и дословных повторов внутри обзора`);
let rep2 = 0;
for (const s of Object.keys(ind)) { const mx = calcMatrix(parseBirth(s, new Date(2030, 0, 1))); for (const z of KB.config.zones) { const v = T.zone(mx, z.id); const tx = v.blocks.map((x) => x.text); if (new Set(tx).size !== tx.length) rep2++; } }
check(rep2 === 0, "8 зон × 12 дат: повторяющаяся энергия не дублирует текст (берётся другое поле)");
const o = T.other(b), tg = T.together(a, b);
check(o.sections.length === 7 && tg.sections.length === 7 && tg.sections.every((x) => x.items.length && x.items.every((i) => i.text)), "«Новый человек» (7 разделов) и «Мы вместе» (7 разделов) заполнены");
check(!/\d+\s?%|процент/.test(JSON.stringify(tg)) && ["rel.attraction", "rel.between_us", "rel.diagnostics"].includes(tg.spread), "«Мы вместе»: без процента совместимости, предложен расклад Таро");
check(!BANNED.test(JSON.stringify([o, tg, T.period(a, new Date(2026, 9, 5))])), "выводы без приговоров");
check(T.search("деньги").length >= 3 && T.search("императрица").length === 1 && T.search("").length === 22, "справочник: поиск «деньги» находит энергии, «императрица» — одну");
process.exit(ok ? 0 : 1);
