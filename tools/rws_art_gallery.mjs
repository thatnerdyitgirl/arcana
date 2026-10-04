// Галерея и проверка SVG-иллюстраций RWS: node tools/rws_art_gallery.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "knowledge/rws/art");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort() : [];
const BAD = /<style|<filter|Gradient|<image|<text|<script|href=|#[0-9a-fA-F]{3,6}\b/;
let problems = 0;
const cards = files.map((f) => {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  const issues = [];
  if (!/viewBox="0 0 120 200"/.test(s)) issues.push("viewBox");
  if (BAD.test(s)) issues.push("запрещённые элементы/цвета");
  if (Buffer.byteLength(s) > 3200) issues.push(`размер ${Buffer.byteLength(s)} Б`);
  const n = (s.match(/<(path|circle|ellipse|rect|line|polyline|polygon)\b/g) ?? []).length;
  if (n > 60) issues.push(`элементов ${n}`);
  if (issues.length) { problems++; console.log("✗", f, issues.join("; ")); }
  return { f, s, bytes: Buffer.byteLength(s), n };
});
const css = `:root{--paper:#f7f3ea;--ink:#2d3a34;--lotus:#bf7683;--willow:#6c8462;--fog:#6a7f8c;--scene-sun:#f4cf98}
.dark{--paper:#171c1a;--ink:#e9e3d6;--lotus:#e0a7b0;--willow:#a8bb95;--fog:#a3b4bf;--scene-sun:#8f7448}
body{margin:0;background:var(--paper);color:var(--ink);font:12px system-ui}.w{display:grid;grid-template-columns:repeat(auto-fill,150px);gap:14px;padding:16px}
.c{width:150px;text-align:center}.c svg{width:150px;height:250px;border:1px solid color-mix(in srgb,var(--ink) 25%,transparent);border-radius:6px;background:var(--paper)}
.wash{fill:currentColor;opacity:.08}.rose{fill:var(--lotus);opacity:.38}.leaf{fill:var(--willow);opacity:.38}.sun{fill:var(--scene-sun);opacity:.75}.mist{fill:var(--fog);opacity:.25}`;
const html = (cls) => `<div class="${cls}" style="background:var(--paper)"><div class="w">${cards.map((c) => `<div class="c">${c.s}<div>${c.f.replace(".svg", "")}<br>${c.bytes} Б · ${c.n}</div></div>`).join("")}</div></div>`;
fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "build/rws-gallery.html"), `<!doctype html><meta charset=utf-8><title>RWS art</title><style>${css}</style>${html("")}${html("dark")}`);
console.log(`SVG: ${files.length}; с проблемами: ${problems}; галерея: build/rws-gallery.html`);
