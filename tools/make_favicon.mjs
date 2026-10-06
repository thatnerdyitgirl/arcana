// Скруглённые иконки вкладки браузера из assets/logo-source.png (прозрачные углы, как у ChatGPT).
// Запуск: node tools/make_favicon.mjs (нужен Google Chrome и sips на macOS)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const tmp = fs.mkdtempSync("/tmp/arcana-fav-"), big = path.join(tmp, "big.png");
const src = "data:image/png;base64," + fs.readFileSync(path.join(ROOT, "assets/logo-source.png")).toString("base64");
fs.writeFileSync(path.join(tmp, "p.html"), `<!doctype html><body style="margin:0;background:transparent"><canvas id="c" width="512" height="512" style="display:block"></canvas><script>
const c=document.getElementById("c"),x=c.getContext("2d"),i=new Image();i.onload=()=>{x.beginPath();x.roundRect(0,0,512,512,512*0.22);x.clip();x.drawImage(i,0,0,512,512)};i.src="${src}";</script>`);
execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000", "--window-size=512,512", "--virtual-time-budget=2000", `--screenshot=${big}`, "file://" + path.join(tmp, "p.html")], { stdio: "ignore" });
const out = (n) => path.join(ROOT, "assets", n);
execFileSync("sips", ["-z", "32", "32", big, "--out", out("favicon-32.png")], { stdio: "ignore" });
execFileSync("sips", ["-z", "64", "64", big, "--out", out("favicon-64.png")], { stdio: "ignore" });
execFileSync("sips", ["-z", "48", "48", "-s", "format", "ico", big, "--out", out("favicon.ico")], { stdio: "ignore" });
fs.rmSync(tmp, { recursive: true, force: true });
console.log("готово: favicon-32.png, favicon-64.png, favicon.ico");
