// Проверка собранного сайта: весь скрипт должен компилироваться (ловит дубли имён между модулями).
import fs from "node:fs";
import vm from "node:vm";
const html = fs.readFileSync(new URL("../build/arcana.html", import.meta.url), "utf8");
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim().length > 1000);
let bad = 0;
scripts.forEach((code, i) => { try { new vm.Script("(async () => {\n" + code + "\n})", { filename: `bundle-${i}.js` }); } catch (e) { bad++; console.error(`ОШИБКА В СБОРКЕ (скрипт ${i}): ${e.message}`); } });
if (bad) process.exit(1);
console.log(`сборка компилируется: ${scripts.length} скрипт(а)`);
