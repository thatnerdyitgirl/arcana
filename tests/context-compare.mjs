// Один и тот же триплет в двух контекстах: интерпретация должна заметно меняться.
import { reading } from "../engine/arcana.mjs";
const cards = [{ id: "MANARA_WATER_08" }, { id: "MANARA_MAJOR_18" }, { id: "MANARA_FIRE_KNIGHT" }];
const variants = {
  A: "Мы не знакомы, просто давно наблюдаю за этим человеком и хочу понять, что меня так цепляет.",
  B: "Мы встречались полгода и недавно расстались. Он перестал писать, а я не могу отпустить.",
};
const MODE = { plus: "в плюсе", shadow: "в тени", both: "обе стороны" };
const res = {};
for (const [k, q] of Object.entries(variants)) {
  const r = reading({ spreadId: "rel.between_us", question: q, cards });
  res[k] = r;
  console.log(`\n=== ВАРИАНТ ${k}: «${q}»`);
  console.log(`Контекст: ${r.context.map((t) => t.label).join(", ")} · тема движка: ${r.topic}`);
  r.cards.forEach((c, i) => {
    console.log(`\n${i + 1}. ${r.positions[i].name} — ${c.name}`);
    console.log(`   На карте: ${c.card.RECOGNITION.signature}`);
    console.log(`   В позиции [${r.readings[i].from}]: ${r.readings[i].text}`);
    console.log(`   В твоём вопросе: ${r.inContext[i]?.text ?? "—"}`);
    if (r.positions[i].grounding) console.log(`   Оговорка: ${r.positions[i].grounding}`);
    console.log(`   Акцент: ${MODE[r.polarity[i].mode]} (${r.polarity[i].why})`);
  });
  console.log(`\nГлавный вывод: ${r.synthesis.main}`);
  console.log(`Вопрос: ${r.synthesis.question}`);
  console.log(`Действие: ${r.synthesis.action}`);
}
// Метрика: доля различающихся текстов по позициям
const diff = res.A.cards.map((_, i) => [res.A.readings[i].text !== res.B.readings[i].text, res.A.inContext[i]?.text !== res.B.inContext[i]?.text, res.A.polarity[i].mode !== res.B.polarity[i].mode]);
console.log("\nРазличия по позициям [текст позиции, «в твоём вопросе», акцент]:", JSON.stringify(diff));
