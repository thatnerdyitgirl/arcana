// Рисует картинки «карты дня» для Telegram-бота: assets/cards/NN.jpg (720×1280, стиль «Рассвет»).
// Запуск (нужен Google Chrome, интернет для шрифтов): node tools/make_cards.mjs
// Цитаты берутся из knowledge/quotes/daily.json; номер файла = индекс цитаты.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const STYLE = process.env.CARD_STYLE || "B";
const quotes = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge/quotes/daily.json"), "utf8")).quotes;
const out = path.join(ROOT, "assets/cards"), tmp = fs.mkdtempSync("/tmp/arcana-cards-");
fs.mkdirSync(out, { recursive: true });
const lib = fs.readFileSync(path.join(ROOT, "app/daycard.mjs"), "utf8");

quotes.forEach((q, i) => {
  const html = `<!doctype html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Forum&family=Golos+Text:wght@400;500&display=swap" rel="stylesheet">
<body style="margin:0"><canvas id="c" width="720" height="1280" style="display:block"></canvas><script>${lib}
Promise.all([document.fonts.load('27px "Forum"'), document.fonts.load('11px "Golos Text"')]).then(() => dcDrawQuote(document.getElementById("c"), ${JSON.stringify(STYLE)}, ${JSON.stringify(q)}));</script>`;
  const f = path.join(tmp, "c.html"), png = path.join(tmp, `${i}.png`), n = String(i).padStart(2, "0");
  fs.writeFileSync(f, html);
  execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=720,1280", "--virtual-time-budget=6000", `--screenshot=${png}`, "file://" + f], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "86", png, "--out", path.join(out, `${n}.jpg`)], { stdio: "ignore" });
  process.stdout.write(`${n} `);
});
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nготово: ${quotes.length} картинок в assets/cards`);
