import { loadData } from "../engine/arcana.mjs";
import { buildCardIndex, parseCards } from "../engine/parser.mjs";
const ALL = loadData().cards;
const idx = buildCardIndex(ALL, "MANARA");
const rws = buildCardIndex(ALL, "RWS");
const cases = [
  ["Король Воздуха, Луна, 2 Воды перев.", ["MANARA_AIR_KING", "MANARA_MAJOR_18", "MANARA_WATER_02+R"]],
  ["Отшельник, 3 мечей перев, Звезда", ["MANARA_MAJOR_09", "MANARA_AIR_03+R", "MANARA_MAJOR_17"]],
  ["тройка огня; королева земли; колесо фортуны", ["MANARA_FIRE_03", "MANARA_EARTH_QUEEN", "MANARA_MAJOR_10"]],
  ["Туз Воды, Повешенный, рыцарь огня (п)", ["MANARA_WATER_01", "MANARA_MAJOR_12", "MANARA_FIRE_KNIGHT+R"]],
  ["Отшельнк, IX, 9 аркан", ["MANARA_MAJOR_09", "MANARA_MAJOR_09", "MANARA_MAJOR_09"]],
  ["Императрица, Император, Влюблённые", ["MANARA_MAJOR_03", "MANARA_MAJOR_04", "MANARA_MAJOR_06"]],
  ["Слуга Земли, Всадница Воды, десятка пентаклей", ["MANARA_EARTH_KNAVE", "MANARA_WATER_KNIGHT", "MANARA_EARTH_10"]],
  ["Справедливость, Сила, Страшный суд", ["MANARA_MAJOR_08", "MANARA_MAJOR_11", "MANARA_MAJOR_20"]],
  ["Король, Луна, Звезда", ["ASK:король", "MANARA_MAJOR_18", "MANARA_MAJOR_17"]],
  ["Король Воздуха / Луна / 2 Воды", ["MANARA_AIR_KING", "MANARA_MAJOR_18", "MANARA_WATER_02"]],
  ["Король Воздуха Луна 2 Воды", ["MANARA_AIR_KING", "MANARA_MAJOR_18", "MANARA_WATER_02"]],
  ["Король Воздуха Луна 2 Воды перев", ["MANARA_AIR_KING", "MANARA_MAJOR_18", "MANARA_WATER_02+R"]],
  ["перевёрнутая 3 мечей Колесо Фортуны Страшный суд", ["MANARA_AIR_03+R", "MANARA_MAJOR_10", "MANARA_MAJOR_20"]],
  ["8 Воды, Звезду, королеву огня", ["MANARA_WATER_08", "MANARA_MAJOR_17", "MANARA_FIRE_QUEEN"]],
  ["9, Луна, Солнце", ["ASK:9", "MANARA_MAJOR_18", "MANARA_MAJOR_19"]],
];
let fail = 0;
for (const [input, want] of cases) {
  const got = parseCards(input, idx).map((r) => (r.id ?? (r.options ? "ASK:" : "ERR:") + r.raw) + (r.reversed ? "+R" : ""));
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", input, ok ? "" : "→ " + got.join(", "));
}
// RWS: свой индекс, свои названия, масти — только Жезлы/Кубки/Мечи/Пентакли
const rwsCases = [
  ["Отшельник, 3 мечей перев, Башня", ["RWS_MAJOR_09", "RWS_SWORDS_03+R", "RWS_MAJOR_16"]],
  ["Сила Справедливость Колесо Фортуны", ["RWS_MAJOR_08", "RWS_MAJOR_11", "RWS_MAJOR_10"]],
  ["Паж Кубков, рыцарь пентаклей, королева мечей", ["RWS_CUPS_PAGE", "RWS_PENTACLES_KNIGHT", "RWS_SWORDS_QUEEN"]],
  ["тройка жезлов, 6 кубков, десятка мечей", ["RWS_WANDS_03", "RWS_CUPS_06", "RWS_SWORDS_10"]],
  ["туз кубков, король жезлов, Мир", ["RWS_CUPS_01", "RWS_WANDS_KING", "RWS_MAJOR_21"]],
  ["Повешенный перевёрнутый Смерть Умеренность", ["RWS_MAJOR_12+R", "RWS_MAJOR_13", "RWS_MAJOR_14"]],
  ["9, Звезда, Солнце", ["ASK:9", "RWS_MAJOR_17", "RWS_MAJOR_19"]],
  ["2 Огня", ["ASK:2", "ERR:огня"]],            // «Огонь» — масть Манары, в RWS её нет
];
for (const [input, want] of rwsCases) {
  const got = parseCards(input, rws).map((r) => (r.id ?? (r.options ? "ASK:" : "ERR:") + r.raw) + (r.reversed ? "+R" : ""));
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(ok ? "ok  " : "FAIL", "[RWS]", input, ok ? "" : "→ " + got.join(", "));
}
// колоды не смешиваются
const mixed = parseCards("Колесо Фортуны Зеркало", rws).map((r) => r.id ?? "ERR");
const noMix = !mixed.some((x) => String(x).startsWith("MANARA"));
if (!noMix) fail++; console.log(noMix ? "ok  " : "FAIL", "[RWS] нет карт Манары в индексе RWS");
process.exit(fail ? 1 : 0);
