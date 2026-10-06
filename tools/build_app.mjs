import { createRequire as __cr } from "node:module";
const require_astronomy = () => __cr(import.meta.url)("../vendor/astronomy.browser.min.js");
// Сборка: app/data.json (для разработки) и build/arcana.html (один файл, без бэкенда).
// Запуск: node tools/build_app.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadData } from "../engine/arcana.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

// Карты урезаются до полей, которые нужны движку и интерфейсу
const KEEP = ["identity", "RECOGNITION", "TRADITIONAL_MEANING", "ARCANA_SYNTHESIS", "POSITIONAL_APPLICATION", "SOURCE_DISAGREEMENT", "REVERSED", "CARD_LINKS", "IN_STRENGTH", "IN_SHADOW", "THEMATIC_LAYERS"];
const full = loadData();
const data = { ...full, cards: Object.fromEntries(Object.entries(full.cards).map(([id, c]) => [id, Object.fromEntries(KEEP.map((k) => [k, c[k]]))])) };
const json = JSON.stringify(data);
fs.writeFileSync(path.join(ROOT, "app/data.json"), json);

// Модули склеиваются в один: убираем import, снимаем export
const strip = (src) => src.replace(/^import[^;]+;\s*$/gm, "").replace(/^export \* from[^;]+;\s*$/gm, "").replace(/^export\s+(?=(const|let|function|async))/gm, "");
const js = ["engine/themes.mjs", "engine/lenses.mjs", "engine/solo.mjs", "engine/compose.mjs", "engine/adapt.mjs", "engine/core.mjs", "engine/parser.mjs", "engine/handoff.mjs", "engine/draw.mjs", "engine/lunar.mjs", "engine/practices.mjs", "engine/matrix.mjs", "engine/matrix_text.mjs", "engine/fx.mjs", "engine/scene.mjs", "app/matrix_ui.mjs", "app/daycard.mjs", "app/app.mjs"]
  .map((f) => `// ---- ${f}\n${strip(read(f))}`).join("\n");

// Лёгкие SVG-иллюстрации RWS: id → разметка без XML-обёртки
const artDir = path.join(ROOT, "knowledge/rws/art");
const art = Object.fromEntries((fs.existsSync(artDir) ? fs.readdirSync(artDir).filter((f) => f.endsWith(".svg")) : [])
  .map((f) => [f.replace(".svg", ""), fs.readFileSync(path.join(artDir, f), "utf8").replace(/<\?xml[^>]*>\s*/, "").replace(/\s*\n\s*/g, " ").trim()]));
const artJson = JSON.stringify(art);
const sound = "data:audio/mpeg;base64," + fs.readFileSync(path.join(ROOT, "assets/read.mp3")).toString("base64");
const b64 = (f) => "data:audio/mpeg;base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64");
const sfx = JSON.stringify({ start: b64("assets/wind-chimes.mp3"), end: b64("assets/singing-bowl.mp3") });
let html = read("app/index.html")
  .replace('<link rel="stylesheet" href="./styles.css">', () => `<style>\n${read("app/styles.css")}\n</style>`)
  .replace('<script src="../vendor/astronomy.browser.min.js"></script>', () => `<script>\n${read("vendor/astronomy.browser.min.js").replace(/<\/script/g, "<\\/script")}\n</script>`)
  .replace('<script type="module" src="./app.mjs"></script>', () => `<script>const ARCANA_DATA = ${json.replace(/<\/script/g, "<\\/script")}; const ARCANA_SOUND = "${sound}"; const ARCANA_ART = ${artJson}; const ARCANA_SFX = ${sfx};</script>\n<script type="module">\n${js}\n</script>`);
fs.mkdirSync(path.join(ROOT, "build"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "build/arcana.html"), html);
// Вариант для хостинга по ссылке: хостинг сам оборачивает страницу, поэтому без <html>/<head>/<body>
const parts = html.match(/<head>([\s\S]*?)<\/head>\s*<body[^>]*>([\s\S]*)<\/body>/);
const headInner = parts[1].replace(/<meta[^>]*>\s*/g, "");
const hosted = `${headInner}\n<script>document.body.dataset.world = "lotus";</script>\n${parts[2]}`;
fs.writeFileSync(path.join(ROOT, "build/arcana-hosted.html"), hosted);

console.log(`иллюстраций RWS: ${Object.keys(art).length} (${(artJson.length / 1024).toFixed(0)} KB)`);
console.log(`data.json ${(json.length / 1024).toFixed(0)} KB · arcana.html ${(html.length / 1024).toFixed(0)} KB`);

// Папка для выкладки на хостинг (Netlify / Cloudflare Pages): загружайте СОДЕРЖИМОЕ build/site, чтобы index.html лежал в корне
const SITE_URL = "https://arcanazen.pages.dev/";
const site = path.join(ROOT, "build/site");
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, "assets"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "build/arcana.html"), path.join(site, "index.html"));
for (const f of ["og-arcana.jpg", "favicon.svg", "favicon-32.png", "favicon-64.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"]) if (fs.existsSync(path.join(ROOT, "assets", f))) fs.copyFileSync(path.join(ROOT, "assets", f), path.join(site, "assets", f));
// иконки в корне сайта: Safari и другие браузеры сами ищут /favicon.ico и /apple-touch-icon.png
for (const [from, to] of [["favicon.ico", "favicon.ico"], ["apple-touch-icon.png", "apple-touch-icon.png"]]) if (fs.existsSync(path.join(ROOT, "assets", from))) fs.copyFileSync(path.join(ROOT, "assets", from), path.join(site, to));
fs.writeFileSync(path.join(site, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
fs.writeFileSync(path.join(site, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc></url></urlset>\n`);
// Для Telegram-бота: картинки карты дня и списки цитат (публичные тексты сайта)
const cardsDir = path.join(ROOT, "assets/cards");
if (fs.existsSync(cardsDir)) { fs.mkdirSync(path.join(site, "cards"), { recursive: true }); for (const f of fs.readdirSync(cardsDir)) if (f.endsWith(".jpg")) fs.copyFileSync(path.join(cardsDir, f), path.join(site, "cards", f)); }
for (const [src, dst] of [["knowledge/quotes/daily.json", "day-quotes.json"], ["knowledge/quotes/buddha.json", "buddha.json"]]) {
  const q = JSON.parse(fs.readFileSync(path.join(ROOT, src), "utf8")).quotes; fs.writeFileSync(path.join(site, dst), JSON.stringify({ quotes: q }));
}
// Для бота: новолуния и полнолуния на ~3 года вперёд и короткие тексты энергий Матрицы (публичные данные сайта)
{
  const A = require_astronomy();
  const events = []; let mq = A.SearchMoonQuarter(A.MakeTime(new Date(Date.now() - 40 * 86400000)));
  while (mq.time.date.getTime() < Date.now() + 1100 * 86400000) { if (mq.quarter === 0 || mq.quarter === 2) events.push({ t: mq.time.date.getTime(), type: mq.quarter === 0 ? "new" : "full" }); mq = A.NextMoonQuarter(mq); }
  fs.writeFileSync(path.join(site, "moon-events.json"), JSON.stringify({ events }));
  const energies = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge/matrix/energies.json"), "utf8")).energies.map((e) => [e.n, { name: e.name, short: e.short, pair_q: e.pair_q }]));
  fs.writeFileSync(path.join(site, "matrix-lite.json"), JSON.stringify({ energies }));
}
// PWA: установка на главный экран + офлайн. Версия кэша = время сборки, чтобы обновления доходили сами.
fs.writeFileSync(path.join(site, "manifest.webmanifest"), JSON.stringify({
  name: "Arcana Zen", short_name: "Arcana", description: "Рефлексивное таро, лунный календарь и практики с таймером.", lang: "ru",
  start_url: "/", scope: "/", display: "standalone", orientation: "portrait", background_color: "#f6f1e6", theme_color: "#f6f1e6",
  icons: [{ src: "/assets/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" }, { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }],
}, null, 2));
fs.writeFileSync(path.join(site, "sw.js"), `// Arcana Zen service worker (сборка ${Date.now()})
const CACHE = "arcana-${Date.now()}";
const SHELL = ["/", "/manifest.webmanifest", "/assets/icon-192.png", "/assets/icon-512.png", "/assets/favicon.svg", "/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  // страница: сначала сеть (свежая версия), без сети — из кэша
  if (r.mode === "navigate") { e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put("/", cp)); return res; }).catch(() => caches.match("/"))); return; }
  e.respondWith(caches.match(r).then((hit) => hit || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); } return res; })));
});
`);
console.log("build/site готова:", fs.readdirSync(site).join(", "));
// Проверка: собранный скрипт обязан компилироваться (иначе сайт покажет пустую страницу)
import { execFileSync as __chk } from "node:child_process";
__chk(process.execPath, [path.join(ROOT, "tools/check_bundle.mjs")], { stdio: "inherit" });
