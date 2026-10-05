// Arcana — запуск движка в Node: читает базу знаний с диска и инициализирует ядро.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { init, allCardIds } from "./core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const K = path.join(ROOT, "knowledge");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(K, p), "utf8"));

export function cardPath(id) {
  const deck = id.split("_")[0].toLowerCase();
  if (id.includes("_MAJOR_")) return `${deck}/cards/major/${id}.json`;
  return `${deck}/cards/minor/${id.split("_")[1].toLowerCase()}/${id}.json`;
}

export function loadData() {
  const data = {
    elements: readJson("manara/elements.json"),
    pairs: readJson("manara/combinations/pairs.json").pairs,
    spreads: readJson("spreads/triplets.json").spreads,
    spreadRows: readJson("spreads/triplets.json").rows,
    context: readJson("context/context-rules.json").rules,
    semantic: readJson("context/semantic-groups.json"),
    meta: readJson("context/meta-markers.json"),
    elementsRws: readJson("rws/elements.json"),
    reversal: readJson("rws/reversal-system.json"),
    lunar: readJson("lunar/lunar-days.json"),
    practices: readJson("practices/practices.json"),
    about: readJson("about/about.json"),
    quotes: readJson("quotes/daily.json").quotes,
    matrix: { energies: readJson("matrix/energies.json").energies, positions: readJson("matrix/positions.json").positions, config: readJson("matrix/config.json") },
    cards: {},
  };
  for (const id of allCardIds("MANARA")) data.cards[id] = readJson(cardPath(id));
  // RWS: читаем те карты, которые уже написаны (база достраивается)
  for (const id of allCardIds("RWS")) { try { data.cards[id] = readJson(cardPath(id)); } catch { /* карта ещё не написана */ } }
  init(data);
  return data;
}

loadData();
export * from "./core.mjs";
