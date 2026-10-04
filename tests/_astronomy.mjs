// Загрузка vendor/astronomy.browser.min.js в Node (в браузере она подключается обычным <script>)
import fs from "node:fs";
const code = fs.readFileSync(new URL("../vendor/astronomy.browser.min.js", import.meta.url), "utf8");
const g = {}; new Function("self", "window", code)(g, g);
export const Astronomy = g.Astronomy;
