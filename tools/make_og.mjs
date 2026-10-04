// Превью ссылки Arcana Zen: рисуется самой сценой приложения (мир «лотос») + оверлей с луной, двумя картами и текстом.
// Запуск: node tools/make_og.mjs  → assets/og-arcana.png (1200×630), assets/favicon-32.png, assets/apple-touch-icon.png
// Нужен установленный Google Chrome (headless). Без него просто положите свой og-arcana.png в assets/.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TMP = path.join(process.env.TMPDIR || "/tmp", "arcana-og"); fs.mkdirSync(TMP, { recursive: true });

const shot = (file, w, h, out, wait = 9000) => execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${w},${h}`, `--virtual-time-budget=${wait}`, `--screenshot=${out}`, "file://" + file], { stdio: "ignore" });

// ---------- OG 1200×630 ----------
const card = (rot, x, y, inner, tone) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <rect x="-70" y="-112" width="140" height="224" rx="9" fill="${tone}" stroke="#4a5a52" stroke-width="1.1" opacity=".97"/>
    <rect x="-61" y="-103" width="122" height="206" rx="5" fill="none" stroke="#4a5a52" stroke-opacity=".45" stroke-width=".8"/>
    ${inner}
  </g>`;
const moonCard = `<circle cx="0" cy="-22" r="34" fill="#f6f1e6" stroke="#4a5a52" stroke-opacity=".6" stroke-width="1"/><path d="M-6 -54 A34 34 0 1 0 -6 10 A27 27 0 1 1 -6 -54Z" fill="#cfd6cf" opacity=".7"/><path d="M-46 52 C-20 44 20 44 46 52" fill="none" stroke="#6d8a86" stroke-width="1.2"/><path d="M-34 66 C-12 60 14 60 34 66" fill="none" stroke="#6d8a86" stroke-width="1" opacity=".7"/>`;
const lotusCard = `<g fill="none" stroke="#b9737f" stroke-width="1.3" stroke-linecap="round"><path d="M0 40 C-26 28 -30 -2 0 -34 C30 -2 26 28 0 40Z"/><path d="M0 40 C-44 36 -50 6 -30 -12"/><path d="M0 40 C44 36 50 6 30 -12"/></g><path d="M-38 62 C-14 56 14 56 38 62" fill="none" stroke="#6d8a86" stroke-width="1.2"/><circle cx="0" cy="-70" r="2.2" fill="#4a5a52" opacity=".6"/>`;
const html = fs.readFileSync(path.join(ROOT, "build/arcana.html"), "utf8").replace("</body>", `
<style>
  body::before, #petal-canvas, .shell, .koi-orbit { display: none !important; }
  .lotus-layer { opacity: 1 !important; visibility: visible !important; z-index: 40 !important; }
  #og { position: fixed; inset: 0; z-index: 50; pointer-events: none; font-family: "Golos Text", "Helvetica Neue", sans-serif; }
  #og .veil { position: absolute; inset: 0; background: radial-gradient(ellipse at 22% 48%, rgba(246,241,230,.88) 0, rgba(246,241,230,.55) 38%, rgba(246,241,230,0) 66%); }
  #og h1 { position: absolute; left: 96px; top: 230px; margin: 0; font: 400 76px/1 "Forum", Georgia, serif; letter-spacing: .3em; color: #2f3b36; }
  #og p { position: absolute; left: 100px; top: 338px; margin: 0; font-size: 22px; letter-spacing: .12em; color: #5d6b65; }
  #og .line { position: absolute; left: 100px; top: 318px; width: 64px; height: 1px; background: #b9737f; opacity: .8; }
  #og svg.art { position: absolute; inset: 0; width: 1200px; height: 630px; }
</style>
<div id="og">
  <div class="veil"></div>
  <svg class="art" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="mg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fbf8f0"/><stop offset=".7" stop-color="#f3eee1"/><stop offset="1" stop-color="#f3eee1" stop-opacity="0"/></radialGradient></defs>
    <circle cx="940" cy="150" r="96" fill="url(#mg)"/><circle cx="940" cy="150" r="70" fill="#fbf8f0" opacity=".95"/><circle cx="940" cy="150" r="70" fill="none" stroke="#4a5a52" stroke-opacity=".35" stroke-width="1"/>
    ${card(-9, 868, 392, moonCard, "#f8f3e8")}
    ${card(7, 1022, 408, lotusCard, "#f4eee1")}
  </svg>
  <h1>ARCANA ZEN</h1><div class="line"></div>
  <p>Таро · Луна · Практики</p>
</div></body>`);
const src = path.join(TMP, "og.html"); fs.writeFileSync(src, html);
const out = path.join(ROOT, "assets/og-arcana.png");
shot(src, 1200, 630, out);

// ---------- favicon 32 и apple-touch 180 ----------
const iconSvg = (s) => `<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:transparent}</style>${fs.readFileSync(path.join(ROOT, "assets/favicon.svg"), "utf8").replace("<svg ", `<svg width="${s}" height="${s}" `)}`;
for (const [s, name] of [[32, "favicon-32.png"], [180, "apple-touch-icon.png"]]) { const f = path.join(TMP, name + ".html"); fs.writeFileSync(f, iconSvg(s)); shot(f, s, s, path.join(ROOT, "assets", name), 800); }
console.log("OG и иконки готовы:", fs.statSync(out).size, "байт");
