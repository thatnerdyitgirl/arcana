// RWS: база, контекстные линзы, перевёрнутые, связи карт, колоды не смешиваются.
import { reading, SPREADS, allCardIds, loadCard, DECKS } from "../engine/arcana.mjs";
import { drawCards } from "../engine/draw.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const ids = allCardIds("RWS");
const R = (sid, q, cards) => reading({ spreadId: sid, question: q, cards: cards.map((c) => (typeof c === "string" ? { id: `RWS_${c}` } : { id: `RWS_${c.id}`, reversed: true })) });

check(ids.length === 78, "в колоде RWS 78 идентификаторов (22 + 4×14)");
const missing = ids.filter((id) => { try { loadCard(id); return false; } catch { return true; } });
check(missing.length === 0, `все 78 карт RWS загружены${missing.length ? ": нет " + missing.join(", ") : ""}`);

// Один Отшельник — разные ситуации
const job = R("decision.blind", "Не могу понять, хочу ли я увольняться", ["MAJOR_09", "MAJOR_16", "MAJOR_14"]);
const lone = R("rel.unfinished", "Мне одиноко после расставания, прошло полгода", ["MAJOR_09", "MAJOR_16", "MAJOR_14"]);
check(job.inContext[0] && lone.inContext[0] && job.inContext[0].text !== lone.inContext[0].text, "Отшельник читается по-разному: «увольняться» и «одиноко после расставания»");
check(/критерии|шум/i.test(job.inContext[0].text) && /расставани|одиночеств|пауз/i.test(lone.inContext[0].text), "линзы соответствуют ситуациям (критерии/шум против расставания/пауза)");
check(job.synthesis.question !== lone.synthesis.question, "вопрос расклада меняется вместе с ситуацией");

// Перевёрнутые: единая система режимов
const up = R("rel.unfinished", "Мне одиноко", ["MAJOR_09", "MAJOR_16", "MAJOR_14"]);
const rv = R("rel.unfinished", "Мне одиноко", [{ id: "MAJOR_09" }, "MAJOR_16", "MAJOR_14"]);
check(rv.readings[0].text !== up.readings[0].text && !!rv.readings[0].mode, `перевёрнутый Отшельник читается через режим «${rv.readings[0].mode}», а не как прямой`);
const exc = R("rel.unfinished", "Я слишком замкнулась, постоянно одна", [{ id: "MAJOR_09" }, "MAJOR_16", "MAJOR_14"]);
const blk = R("rel.unfinished", "Не могу выйти к людям, у меня блок", [{ id: "MAJOR_09" }, "MAJOR_16", "MAJOR_14"]);
check(exc.readings[0].mode === "excess" && blk.readings[0].mode === "blocked", "режим выбирается по словам вопроса (слишком → избыток, не могу/блок → блокировка)");
const modes = ["blocked", "excess", "distorted", "internal", "delayed", "hard_to_express"];
let badRev = 0;
for (const id of ids) { try { const rvd = loadCard(id).card.REVERSED; if (!rvd || !modes.includes(rvd.primary_mode) || Object.keys(rvd.modes).length < 3 || !rvd.resource) badRev++; } catch { badRev++; } }
check(badRev === 0, "у каждой карты есть REVERSED: режим по умолчанию, ≥3 режимов, ресурс");
check(!rv.cards[0].card.REVERSED.modes[rv.readings[0].mode].match(/^(Отсутствие|Нет )/), "перевёрнутое — не «отсутствие карты»");

// Связи карт между собой
check(["cause_effect", "transition", "contradict", "reinforce", "inner_outer", "resource_obstacle", "motif"].includes(job.synthesis.comparison.rels[0]), `связь A→B берётся из CARD_LINKS: ${job.synthesis.comparison.rels.join(", ")}`);
check(/позици[июя] «/.test(job.synthesis.flow) && job.cards.every((c) => job.synthesis.flow.includes(c.name)), "сквозной рассказ A → B → C упоминает все три карты");
check(job.synthesis.links.length > 0 || job.synthesis.comparison.notes.length > 0, "связи карт показываются в «Как карты связаны»");
const types = new Set(); for (const id of ids) { try { loadCard(id).card.CARD_LINKS.forEach((l) => types.add(l.type)); } catch {} }
check(types.size >= 5, `в базе используются разные типы связей: ${[...types].join(", ")}`);

// Колоды не смешиваются
let threw = false; try { reading({ spreadId: "decision.blind", question: "тест", cards: [{ id: "RWS_MAJOR_09" }, { id: "MANARA_MAJOR_16" }, { id: "RWS_MAJOR_14" }] }); } catch { threw = true; }
check(threw, "карты разных колод в одном раскладе — ошибка");
check(!job.synthesis.projection, "в RWS нет проекции «эротика → дело» (это правило Манары)");
const man = reading({ spreadId: "decision.blind", question: "Стоит ли принимать оффер?", cards: ["MANARA_MAJOR_09", "MANARA_MAJOR_16", "MANARA_MAJOR_14"].map((id) => ({ id })) });
check(man.deck === "MANARA" && !man.readings.some((x) => x.mode), "Манара не использует режимы перевёрнутых");

// Нет утечек: ни «Манара», ни undefined/null в текстах
const BAD = /undefined|null|\[object|Манар|оборотен|\{\w+\}/;
let dirty = 0, runs = 0, thrown = 0;
const questions = ["Не могу понять, хочу ли я увольняться", "Мне одиноко после расставания", "Боюсь показать свой проект", "Постоянно устаю и нет мотивации", "Хочу научиться медитировать", "Мы поссорились и не разговариваем", "Стоит ли переезжать в другой город?"];
for (let i = 0; i < 360; i++) {
  const sp = SPREADS[i % SPREADS.length];
  const cards = drawCards({ deck: "RWS", count: sp.positions.length, reversals: i % 2 === 0 });
  try {
    const r = reading({ spreadId: sp.id, question: questions[i % questions.length], cards });
    runs++;
    const strings = []; const walk = (v) => { if (typeof v === "string") strings.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
    walk([r.readings.map((x) => x.text), r.inContext, r.synthesis.flow, r.synthesis.insight, r.synthesis.question, r.synthesis.action, r.synthesis.lesson, r.views]);
    const hit = strings.find((t) => BAD.test(t));
    if (hit) { dirty++; if (dirty < 4) console.log("   утечка:", sp.id, cards.map((c) => c.id).join(","), hit.match(BAD)[0], "в:", hit.slice(0, 120)); }
  } catch (e) { thrown++; if (thrown < 4) console.log("   ошибка:", sp.id, cards.map((c) => c.id).join(","), e.message); }
}
check(thrown === 0 && runs === 360, `360 случайных раскладов по всем ${SPREADS.length} шаблонам без ошибок`);
check(dirty === 0, "в текстах нет undefined/null/«Манара»/нераскрытых шаблонов");
process.exit(ok ? 0 : 1);
