import { recommendSpreads, analyzeIntent } from "../engine/arcana.mjs";
let ok = true;
function run(q, wantTop3, wantFirst) {
  const f = analyzeIntent(q), recs = recommendSpreads(q, 36), top = recs.slice(0, 3).map((r) => r.spread.id);
  console.log(`\n«${q}»`);
  for (const lv of ["theme", "intent", "problem", "context"]) if (f[lv].length) console.log(`  ${lv.padEnd(8)}: ${f[lv].map((m) => m.label).join(" · ")}`);
  recs.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.spread.name}  [${r.score.toFixed(1)}]  ${r.because.join(", ")}`));
  const miss = wantTop3.filter((id) => !top.includes(id));
  const good = !miss.length && (!wantFirst || top[0] === wantFirst);
  console.log(good ? "  ✓" : `  ✗ нет в топ-3: ${miss.join(", ")}${wantFirst && top[0] !== wantFirst ? "; первым должен быть " + wantFirst : ""}`);
  if (!good) ok = false;
}
// Твои два примера
run("Хочу научиться медитировать, но не хватает дисциплины", ["self.pattern", "self.resistance", "self.resource"]);
run("Всё время уставшая, нет мотивации ничего делать, не знаю, как вернуть искру", ["self.resource"], "self.resource");
// Контроль: старые случаи не сломались, слова из tags не обязательны
run("Мы расстались, а я всё ещё думаю о нём", ["rel.unfinished"], "rel.unfinished");
run("Боюсь показать свои рисунки, вдруг осудят", ["art.show"], "art.show");
run("Выбираю между двумя оффеками или остаться", ["decision.ab"], "decision.ab");
run("Меня бесит, когда люди хвастаются", ["psy.shadow"], "psy.shadow");
run("Мне предложили новую должность, но боюсь не справиться", ["work.new_role"]);
run("Постоянно не могу отказать маме", ["self.boundaries"], "self.boundaries");
run("У меня есть идея книги, но я уже год не могу начать", ["art.postponed"]);
process.exit(ok ? 0 : 1);
