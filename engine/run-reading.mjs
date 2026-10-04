// Запуск:
//   node engine/run-reading.mjs tests/readings/<file>.json
//   node engine/run-reading.mjs --draw <spreadId> [--topic relationships] [--seed 42] [--question "..."]
import fs from "node:fs";
import { reading, allCardIds } from "./arcana.mjs";

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

let input;
if (args[0] === "--draw") {
  // Детерминированный «случайный» выбор карт (чтобы тест можно было повторить)
  let seed = Number(opt("--seed") ?? Date.now());
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const deck = allCardIds();
  const cards = [];
  while (cards.length < 3) { const id = deck[Math.floor(rand() * deck.length)]; if (!cards.includes(id)) cards.push(id); }
  input = { spreadId: args[1], topic: opt("--topic"), question: opt("--question"), cards, seed: opt("--seed") };
} else {
  input = JSON.parse(fs.readFileSync(args[0], "utf8"));
}

const r = reading(input);
const s = r.synthesis;
const out = [];
out.push(`# ${r.spread.name}`, "", `**Вопрос:** ${r.question}` + (r.topic ? `  \n**Тема:** ${r.topic}` : ""), "");
out.push("## Карты", "");
r.cards.forEach((c, i) => out.push(`${i + 1}. **${r.positions[i].name}** — ${c.name}`));
out.push("", "## Позиции", "");
const MODE = { plus: "в плюсе", shadow: "в тени", both: "обе стороны" };
r.cards.forEach((c, i) => {
  const p = r.positions[i], pol = r.polarity[i];
  out.push(`**${p.name} — ${c.name}**  `);
  out.push(`${p.frame ? p.frame + " " : ""}${r.readings[i].text ?? "— нет текста для этой позиции"}  `);
  if (p.grounding) out.push(`_${p.grounding}_  `);
  out.push(`Акцент: **${MODE[pol.mode]}** _(${pol.why})_  `);
  if (pol.mode !== "shadow" && pol.plus && pol.plus !== r.readings[i].text) out.push(`↑ В плюсе: ${pol.plus}  `);
  if (pol.mode !== "plus" && pol.shadow && pol.shadow !== r.readings[i].text) out.push(`↓ В тени: ${pol.shadow}  `);
  out.push("");
});
out.push("## Итог", "");
for (const l of s.lines) out.push(`- **${l.role}.** ${l.text}`);
out.push("", `**${s.comparison.chain}** — ${s.comparison.pattern}.`);
for (const n of s.comparison.notes) out.push(`- ${n}`);
for (const l of s.links) out.push(`- ${l}`);
out.push("", `**Главный вывод.** ${s.main}`, "", `**Вопрос себе.** ${s.question}`, "", `**Маленькое действие.** ${s.action}`, "");
out.push(`**Квинтэссенция.** ${s.quintLine}`, "");
out.push("## Глубже", "", "**Все сигналы движка:**");
for (const f of r.findings) out.push(`- [${f.detector}] ${f.text} _(${f.layer}${f.source ? " · " + f.source : ""}${f.note ? " · " + f.note : ""})_`);
out.push("", "**Другие способы расчёта квинтэссенции:**");
for (const q of r.quint) out.push(q.note ? `- ${q.method}: ${q.note}` : `- ${q.method}: ${q.calculation} → **${q.card}**${q.levels ? ` (уровни: ${q.levels.join(" → ")})` : ""}${q.caveat ? ` — ${q.caveat}` : ""}`);
out.push("", "**Традиционное значение (базовый текст):**");
r.cards.forEach((c) => out.push(`- ${c.name}: ${c.card.TRADITIONAL_MEANING?.summary}`));
if (input.seed) out.push("", `<sub>карты вытянуты движком, seed ${input.seed}</sub>`);
console.log(out.join("\n"));
