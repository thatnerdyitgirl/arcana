// Слои Манары в движке: THEMATIC_LAYERS по категории расклада, IN_STRENGTH / IN_SHADOW, адаптация и отсутствие повторов.
import { reading, SPREADS, allCardIds, loadCard } from "../engine/arcana.mjs";
import { cmpSimilar, cmpSentences, screenBlocks, cmpLayer } from "../engine/compose.mjs";
import { handoff } from "./_handoff.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const cards = (...a) => a.map((id) => ({ id: `MANARA_${id}` }));
const byTheme = Object.fromEntries(["Отношения", "Работа и бизнес", "Решения и перемены", "Саморазвитие", "Психология", "Творчество"].map((t) => [t, SPREADS.find((s) => s.theme === t && !s.adult)]));

// Одна карта — разные категории: разбор опирается на слой своей категории и различается
const texts = {};
for (const [theme, sp] of Object.entries(byTheme)) {
  const r = reading({ spreadId: sp.id, question: "Хочу понять, что здесь происходит", cards: cards("MAJOR_15", "AIR_06", "MAJOR_09") });
  texts[theme] = r.screen.cards[0].analysis;
  const L = cmpLayer(r.cards[0], theme);
  const first = cmpSentences(L.text)[0];
  check(cmpSentences(r.screen.cards[0].analysis).some((x) => cmpSimilar(x, first)) || r.screen.insight.includes(first.slice(0, 30).toLowerCase()) , `Дьявол · «${theme}»: разбор содержит смысл слоя категории`);
}
const themes = Object.keys(texts); let maxsim = 0;
for (let i = 0; i < themes.length; i++) for (let j = i + 1; j < themes.length; j++) {
  const A = cmpSentences(texts[themes[i]]), B = cmpSentences(texts[themes[j]]);
  const same = A.filter((a) => B.some((b) => cmpSimilar(a, b))).length / Math.max(A.length, B.length);
  maxsim = Math.max(maxsim, same);
}
check(maxsim <= 0.5, `разбор одной карты в разных категориях различается (общих предложений не больше ${(maxsim * 100).toFixed(0)}%)`);
check(!/в деле это/.test(Object.values(texts).join(" ")), "нет механической замены «страсть → творческий драйв»");

// Быстрый обзор: у каждой карты обеих колод
let missing = 0;
for (const deck of ["MANARA", "RWS"]) for (const id of allCardIds(deck)) {
  const c = loadCard(id), sp = byTheme["Отношения"];
  const r = reading({ spreadId: sp.id, question: "Что между нами", cards: [id, allCardIds(deck)[(allCardIds(deck).indexOf(id) + 7) % 78], allCardIds(deck)[(allCardIds(deck).indexOf(id) + 31) % 78]].map((x) => ({ id: x })) });
  const sc = r.screen.cards[0];
  if (!sc.strength || !sc.shadow) missing++;
}
check(missing <= 4, `быстрый обзор «В силе / В тени» есть у ${156 - missing} из 156 карт (недостающие — когда строка слишком совпадает с уже показанным текстом и скрыта как повтор)`);
const d = reading({ spreadId: byTheme["Отношения"].id, question: "Что между нами", cards: cards("MAJOR_15", "AIR_06", "MAJOR_09") }).screen.cards[0];
check(d.strength.startsWith("Признанное желание") && d.shadow.startsWith("Фантазия, которая заменяет"), "Манара: обзор берётся из IN_STRENGTH / IN_SHADOW");
check(d.strength !== d.shadow && !cmpSimilar(d.strength, d.shadow), "тень — не копия силы");

// Слабая связь с темой подаётся осторожно
const weak = reading({ spreadId: byTheme["Творчество"].id, question: "Не могу творить", cards: cards("MAJOR_09", "AIR_06", "MAJOR_15") }).screen.cards[0].analysis;
check(/скромнее|косвенн/.test(weak), "fit=weak: тема подаётся осторожно («связь скромнее»)");

// Адаптация под контекст: слой + контекстная рамка, а не копия
const ctx = reading({ spreadId: "rel.unfinished", question: "Мы расстались полгода назад, я до сих пор думаю о нём", cards: cards("MAJOR_15", "AIR_06", "MAJOR_09") });
check(/полгода/.test(ctx.screen.cards[1].analysis) && cmpLayer(ctx.cards[1], "Отношения").text !== ctx.screen.cards[1].analysis, "контекст «полгода назад» вплетён в разбор поверх слоя");

// Общие акценты соседних карт
const shared = reading({ spreadId: byTheme["Отношения"].id, question: "Что между нами", cards: cards("MAJOR_06", "MAJOR_15", "AIR_06") }).screen.synergy;
check(/общая тема/.test(shared), "соседние карты: общий акцент слоёв («В нескольких картах звучит общая тема…»)");

// Нигде нет повторов предложений на экране
let dirty = 0, runs = 0;
const ids = allCardIds("MANARA");
for (let i = 0; i < 300; i++) {
  const sp = SPREADS.filter((s) => !s.adult)[i % SPREADS.filter((s) => !s.adult).length];
  const pick = [ids[(i * 7) % 78], ids[(i * 13 + 5) % 78], ids[(i * 29 + 11) % 78]].filter((x, k, a) => a.indexOf(x) === k);
  if (pick.length < 3) continue;
  const r = reading({ spreadId: sp.id, question: ["Мы расстались полгода назад", "Не могу творить", "Стоит ли менять работу", "Хочу понять себя"][i % 4], cards: pick.map((id) => ({ id })) });
  runs++;
  const seen = [];
  for (const b of screenBlocks(r.screen)) for (const s of cmpSentences(b)) { if (s.split(/\s+/).length < 5) continue; if (seen.some((x) => cmpSimilar(x, s))) dirty++; else seen.push(s); }
}
check(dirty === 0, `${runs} раскладов Манары со слоями: ни одно предложение экрана не повторяется`);

// Handoff передаёт слой как гипотезу Arcana
const h = handoff(ctx);
check(/В силе:/.test(h) && /В тени:/.test(h) && /Тематический слой/.test(h) && /гипотез/i.test(h), "промпт для чата содержит «В силе / В тени» и тематический слой с пометкой «гипотеза Arcana»");
process.exit(ok ? 0 : 1);
