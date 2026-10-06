// Соло-режим: «Алхимия страсти» и близкие расклады не должны содержать «фантомного партнёра».
import { reading, SPREADS, cardPath } from "../engine/arcana.mjs";
import { SOLO_FORBID } from "../engine/solo.mjs";
import { readFileSync, readdirSync } from "node:fs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const solo = SPREADS.filter((s) => s.solo);
check(solo.map((s) => s.id).sort().join() === "adult.alchemy,adult.body_block,rel.threshold,rel.why_solo", "соло-расклады помечены: " + solo.map((s) => s.id).join(", "));

const KROOT = new URL("../knowledge/", import.meta.url);
const walk = (dir) => readdirSync(new URL(dir, KROOT), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${dir}${e.name}/`) : e.name.endsWith(".json") ? [e.name.replace(".json", "")] : []);
const ids = walk("manara/cards/").sort();
const names = ids.map((id) => JSON.parse(readFileSync(new URL(cardPath(id), KROOT), "utf8")).identity?.name_ru).filter(Boolean).sort((a, b) => b.length - a.length);
check(ids.length === 78, "найдено карт Манары: " + ids.length);
const strip = (t) => names.reduce((a, n) => a.split(n).join("§"), String(t ?? ""));
const BANNED = /в отношениях с ним|скрывать от этого человека|об этом человеке|живого человека|контакт с живым|считаться с другими|эта связь|этой связи|в этом союзе/i;
const strings = (r) => { const sc = r.screen, out = [sc.insight, sc.flow, sc.question === r.spread.question ? "" : sc.question, sc.action, sc.synergy, sc.lensQuestion, sc.projection, r.synthesis.lensNote];
  out.push(...(sc.lesson?.paragraphs ?? []), sc.lesson?.weak);
  for (const c of sc.cards) out.push(c.analysis, c.doNow, c.strength, c.shadow, c.reversedNote);
  return out.filter(Boolean); };

let bad = [], n = 0;
for (const sp of solo) {
  for (let i = 0; i < ids.length; i++) {
    const trio = [ids[i], ids[(i + 13) % ids.length], ids[(i + 31) % ids.length]];
    let r; try { r = reading({ spreadId: sp.id, question: sp.question, cards: trio.map((id) => ({ id })) }); } catch (e) { bad.push(`${sp.id} ${trio}: ошибка ${e.message}`); continue; }
    n++;
    if (r.lens !== null) bad.push(`${sp.id} ${trio}: включена линза ${r.lens}`);
    if (r.context.some((x) => /другой человек|партн/i.test(x.label))) bad.push(`${sp.id}: в контексте чужой человек`);
    for (const s of strings(r)) { const t = strip(s); const m = t.match(SOLO_FORBID) || t.match(BANNED); if (m) bad.push(`${sp.id} ${trio.join("/")}: «${m[0]}» в «${t.slice(0, 120)}»`); }
    if (r.screen.cards.some((c) => !c.analysis || !c.doNow)) bad.push(`${sp.id} ${trio}: пустой текст карты`);
  }
}
console.log(`проверено раскладов: ${n}`);
check(bad.length === 0, "соло-расклады: ни одной фразы про чужого человека, связь или контакт" + (bad.length ? "\n  " + bad.slice(0, 15).join("\n  ") : ""));

// «Алхимия»: позиции читаются как состояние / утечка / канал; тон легализующий
const a = reading({ spreadId: "adult.alchemy", question: "Я одна, хочу близости, но не хочу случайных людей", cards: ["MANARA_FIRE_04", "MANARA_AIR_06", "MANARA_EARTH_03"].map((id) => ({ id })) });
check(/голод|скук|нежност|злост|ярост/i.test(a.screen.cards[0].analysis), "«Природа импульса»: состояние (голод/скука/нежность/ярость)");
check(/жвачк|фантази|самокопан|утекает|уходит/i.test(a.screen.cards[1].analysis), "«Куда уходит избыток»: ментальная жвачка / утечка");
check(/спорт|дневник|арт|массаж|тел|проект|письм|движени/i.test(a.screen.cards[2].analysis), "«Сфера сублимации»: конкретные каналы для одного человека");
check(/нормальн|ресурс/i.test(a.screen.cards[0].analysis) && /буфер|материал для творчества/i.test(a.screen.cards[1].analysis), "тон: желание без пары — ресурс, фантазии — безопасный буфер");
check(!/плох|иллюзи.{0,20}вместо/i.test(JSON.stringify(a.screen)), "нет упрёков «иллюзии вместо контакта»");
// Остальные расклады «Отношений» не затронуты
const other = reading({ spreadId: "rel.attraction", question: "Меня цепляет один человек", cards: ["MANARA_FIRE_04", "MANARA_AIR_06", "MANARA_EARTH_03"].map((id) => ({ id })) });
check(other.lens === "rel" && /человек|связ/i.test(JSON.stringify(other.screen)), "расклады про другого человека не затронуты");
process.exit(ok ? 0 : 1);
