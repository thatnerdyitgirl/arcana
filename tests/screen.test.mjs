// Экран расклада: ни одна фраза не повторяется, нет «Итога Arcana» и технического блока, рассказ без скобок.
import fs from "node:fs";
import { reading, SPREADS } from "../engine/arcana.mjs";
import { drawCards } from "../engine/draw.mjs";
import { cmpSentences, cmpSimilar, screenBlocks } from "../engine/compose.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };

const questions = [
  "Мы расстались полгода назад, я до сих пор проверяю его профиль", "Не могу понять, хочу ли я увольняться", "Боюсь показать свой проект, стесняюсь",
  "Постоянно устаю и нет мотивации", "Хочу научиться медитировать", "Конфликт с мамой, мы не разговариваем", "Стоит ли переезжать в другой город?",
  "Начальник давит и не замечает моих результатов", "Мне одиноко", "Хочу понять, что мне важно увидеть сейчас",
];

// Все предложения экрана (≥5 слов) не должны быть «почти одинаковыми»
const dupesIn = (blocks) => {
  const seen = []; const bad = [];
  for (const b of blocks) for (const s of cmpSentences(b)) {
    if (s.split(/\s+/).length < 5) continue;
    const hit = seen.find((x) => cmpSimilar(x, s));
    if (hit) bad.push([hit, s]); else seen.push(s);
  }
  return bad;
};
// Отдельно: повтор длинных фрагментов между предложениями (клаузы через «:», «;», «—»)
const clauseDupes = (blocks) => {
  const seen = new Map(); const bad = [];
  for (const b of blocks) for (const frag of String(b).split(/[.;:!?—]+/).map((x) => x.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ")).filter((x) => x.split(" ").length >= 6)) {
    if (seen.has(frag)) bad.push(frag); else seen.set(frag, 1);
  }
  return bad;
};

let runs = 0, dirty = 0, clause = 0, parens = 0, thin = 0, noAction = 0, errors = 0;
for (const deck of ["MANARA", "RWS"]) {
  for (let i = 0; i < 480; i++) {
    const sp = SPREADS[i % SPREADS.length];
    const cards = drawCards({ deck, count: sp.positions.length, reversals: deck === "RWS" && i % 2 === 0 });
    if (deck === "MANARA" && i % 3 === 0) cards[0].reversed = true;
    let r;
    try { r = reading({ spreadId: sp.id, question: questions[i % questions.length], cards }); } catch (e) { errors++; if (errors < 4) console.log("   ошибка:", deck, sp.id, e.message); continue; }
    runs++;
    const blocks = screenBlocks(r.screen);
    const d = dupesIn(blocks); if (d.length) { dirty++; if (dirty < 4) console.log("   повтор:", deck, sp.id, "\n     ", d[0][0], "\n     ", d[0][1]); }
    const c = clauseDupes(blocks); if (c.length) { clause++; if (clause < 4) console.log("   повтор фрагмента:", deck, sp.id, c[0]); }
    if (/[()]/.test(r.screen.flow)) parens++;
    if (r.screen.cards.some((x) => x.analysis.length < 60)) thin++;
    if (r.screen.cards.filter((x) => !x.doNow).length > 1) noAction++;
  }
}
check(errors === 0, `${runs} раскладов (обе колоды, все шаблоны, перевёрнутые) собираются без ошибок`);
check(dirty === 0, "ни одно предложение экрана не повторяется (в том числе почти дословно)");
check(clause === 0, "ни один длинный фрагмент (между «:», «;», «—») не повторяется");
check(parens === 0, "в рассказе «Как карты складываются в одну историю» нет скобок");
check(thin === 0, "в каждой карте есть содержательный «Психологический разбор» (≥60 знаков)");
check(noAction === 0, "у карт есть «Что сделать сейчас» (не более одной без действия)");

// формат рассказа и разбора
const r = reading({ spreadId: "rel.unfinished", question: "Конфликт с мамой, мы не разговариваем", cards: ["MAJOR_09", "MAJOR_16", "MAJOR_14"].map((id) => ({ id: `RWS_${id}` })) });
const f = r.screen.flow;
check(/^В основе, в позиции «.+», лежит состояние карты «Отшельник»/.test(f), "рассказ начинается: «В основе … лежит состояние карты «…»»");
check(!/Поскольку|\bбазис|\([^)]*\)/.test(f), "в рассказе нет «Поскольку в твоём базисе» и скобок");
check(r.cards.every((c) => f.includes(`«${c.name}»`)), "в рассказе названы все три карты");
const card0 = r.screen.cards[0];
check(card0.state === "прямая" && card0.visual && card0.analysis && card0.doNow, "карта: позиция, название, состояние, «Что на карте», «Психологический разбор», «Что сделать сейчас»");
const rv = reading({ spreadId: "rel.unfinished", question: "Постоянно держу всё в себе", cards: [{ id: "RWS_MAJOR_09", reversed: true }, { id: "RWS_MAJOR_16" }, { id: "RWS_MAJOR_14" }] });
check(rv.screen.cards[0].state === "перевёрнута" && /Перевёрнутая карта показывает/.test(rv.screen.cards[0].analysis), "перевёрнутая карта: состояние и режим вшиты в один разбор");

// в приложении нет удалённых блоков
const app = fs.readFileSync(new URL("../app/app.mjs", import.meta.url), "utf8");
for (const gone of ["Итог Arcana", "Как карты связаны между собой", "Что происходит", "Психологический баланс карты</span>", "В твоём вопросе ·", "В этой позиции</span>", "class=\"roles\""]) check(!app.includes(gone), `экран: блок «${gone.replace(/<.*/, "")}» удалён`);
check(app.includes("Психологический разбор") && app.includes("Что на карте") && app.includes("Что сделать сейчас"), "экран: структура карты — Что на карте / Психологический разбор / Что сделать сейчас");
process.exit(ok ? 0 : 1);
