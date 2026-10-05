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
const js = ["engine/themes.mjs", "engine/lenses.mjs", "engine/compose.mjs", "engine/adapt.mjs", "engine/core.mjs", "engine/parser.mjs", "engine/handoff.mjs", "engine/draw.mjs", "engine/lunar.mjs", "engine/practices.mjs", "engine/matrix.mjs", "engine/matrix_text.mjs", "engine/fx.mjs", "engine/scene.mjs", "app/matrix_ui.mjs", "app/app.mjs"]
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
for (const f of ["og-arcana.jpg", "favicon.svg", "favicon-32.png", "apple-touch-icon.png"]) if (fs.existsSync(path.join(ROOT, "assets", f))) fs.copyFileSync(path.join(ROOT, "assets", f), path.join(site, "assets", f));
fs.writeFileSync(path.join(site, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`);
fs.writeFileSync(path.join(site, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}</loc></url></urlset>\n`);
console.log("build/site готова:", fs.readdirSync(site).join(", "));
