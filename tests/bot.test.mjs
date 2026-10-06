// Telegram-бот: разбор времени и пояса, расчёт минуты по UTC, команды, рассылка по расписанию (без сети и без D1).
import { parseTime, parseTz, utcMinute, localDate, dayIndex, tzLabel, createBot, calcMatrix as wCalc, pairMatrix as wPair, parseBirth as wParse, moonOnDay } from "../bot/worker.mjs";
import { calcMatrix, pairMatrix, parseBirth } from "../engine/matrix.mjs";
import { readFileSync } from "node:fs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };

check(parseTime("8:05") === "08:05" && parseTime("22.22") === "22:22" && parseTime("2222") === "22:22" && parseTime("24:00") === null && parseTime("8:61") === null && parseTime("abc") === null, "время: разные записи, ошибки");
check(parseTz("+5") === 300 && parseTz("5") === 300 && parseTz("UTC+5:30") === 330 && parseTz("-3") === -180 && parseTz("+20") === null && parseTz("x") === null, "часовой пояс");
check(tzLabel(300) === "UTC+5" && tzLabel(-180) === "UTC-3" && tzLabel(330) === "UTC+5:30", "подпись пояса");
check(utcMinute("01:00", 300) === 1200 && utcMinute("23:30", -300) === (23 * 60 + 30 + 300) % 1440, "минута по UTC: переход через полночь");
// дата и индекс: совпадают с формулой сайта (локальная дата × 7 по модулю N)
const at = Date.UTC(2026, 9, 6, 20, 0);            // 6 октября 20:00 UTC = 7 октября 01:00 в Астане
check(localDate(at, 300) === "2026-10-07" && localDate(at, 0) === "2026-10-06", "местная дата зависит от пояса");
const siteIdx = (y, m, d, n) => ((Math.floor(Date.UTC(y, m, d) / 86400000) * 7) % n + n) % n;
check(dayIndex(58, at, 300) === siteIdx(2026, 9, 7, 58) && dayIndex(58, at, 0) === siteIdx(2026, 9, 6, 58), "индекс цитаты как на сайте");

// ---- бот на выдуманных зависимостях ----
const mem = new Map(); const calls = [];
const store = { get: async (c) => mem.get(c) ?? null, put: async (s) => { mem.set(s.chat, { ...s }); }, del: async (c) => { mem.delete(c); },
  due: async (m) => [...mem.values()].filter((s) => s.morning_utc === m || s.med_utc === m).map((s) => ({ ...s })) };
let clock = Date.UTC(2026, 9, 7, 3, 0);              // 08:00 в Астане
const tg = async (method, body) => { calls.push([method, body]); };
const quotes = Array.from({ length: 58 }, (_, i) => ({ t: "цитата " + i, s: "источник " + i }));
const b = createBot({ store, tg, site: "https://x.dev", getQuotes: async () => quotes, getBuddha: async () => [{ t: "совет", s: "Дхаммапада, 1" }], now: () => clock });
const msg = (text, chat = 1) => b.handleUpdate({ message: { chat: { id: chat }, text } });
const last = () => calls[calls.length - 1];

await msg("/start"); check(last()[0] === "sendMessage" && /utro/.test(last()[1].text) && last()[1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/", "/start: помощь и кнопка Mini App");
await msg("/utro 08:00"); check(mem.get(1).morning === "08:00" && mem.get(1).morning_utc === 180, "/utro: время и минута по UTC сохранены (Астана +5)");
await msg("/med"); check(mem.get(1).med === "22:22" && mem.get(1).med_utc === 1042, "/med без аргумента: 22:22");
await msg("/utro 99:99"); check(/Не поняла/.test(last()[1].text) && mem.get(1).morning === "08:00", "неверное время не портит настройки");
await msg("/tz +6"); check(mem.get(1).tz === 360 && mem.get(1).morning_utc === 120 && mem.get(1).med_utc === 982, "/tz пересчитывает минуты");
await msg("/tz +5");

calls.length = 0; clock = Date.UTC(2026, 9, 7, 3, 0);
let n = await b.tick(); check(n === 1 && calls.length === 1 && calls[0][0] === "sendPhoto", "утром приходит фото карты дня");
const idx = dayIndex(58, clock, 300);
check(calls[0][1].photo === `https://x.dev/cards/${String(idx).padStart(2, "0")}.jpg` && calls[0][1].caption.includes("цитата " + idx), "фото и подпись — цитата этого дня");
check(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#day", "кнопка ведёт на карту дня");
await b.tick(); check(calls.length === 1, "в ту же минуту повторно не отправляется");
clock = Date.UTC(2026, 9, 7, 3, 1); calls.length = 0; await b.tick(); check(calls.length === 0, "в другую минуту ничего не приходит");
clock = Date.UTC(2026, 9, 7, 17, 22); await b.tick(); check(calls.length === 1 && calls[0][0] === "sendMessage" && /#practices/.test(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url), "в 22:22 приходит напоминание о медитации");
clock = Date.UTC(2026, 9, 8, 3, 0); calls.length = 0; await b.tick(); check(calls.length === 1, "на следующий день снова приходит");

// блокировка бота пользователем → подписка удаляется
const blocked = createBot({ store, tg: async () => { const e = new Error("403"); e.blocked = true; throw e; }, site: "https://x.dev", getQuotes: async () => quotes, getBuddha: async () => [], now: () => Date.UTC(2026, 9, 9, 3, 0) });
await blocked.tick(); check(!mem.has(1), "если бот заблокирован, подписка удаляется");

await msg("/utro 07:30", 2); await msg("/stop", 2); check(!mem.has(2), "/stop удаляет все данные");
calls.length = 0; await msg("/sovet"); check(/совет/.test(calls[0][1].text) && calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#sovet" && calls[0][1].reply_markup.inline_keyboard[0][0].text === "Ещё совет", "/sovet: совет и кнопка «Ещё совет» ведёт на вкладку совета");
calls.length = 0; await msg("/matrix"); check(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#matrix", "/matrix без даты открывает Матрицу в приложении");
calls.length = 0; await msg("/pair"); check(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#matrix/together", "/pair открывает «Мы вместе»");
await msg("привет"); check(/utro/.test(last()[1].text), "непонятный текст → подсказка");
// лимит за один запуск
for (let c = 100; c < 160; c++) mem.set(c, { chat: c, tz: 300, morning: "08:00", med: null, morning_utc: 180, med_utc: null, last_morning: null, last_med: null });
clock = Date.UTC(2026, 9, 10, 3, 0); calls.length = 0; n = await b.tick(); check(n <= 40 && calls.length <= 40, "за один запуск не больше 40 отправок (лимит бесплатного тарифа)");

// ---- Матрица в чате: формулы бота совпадают с приложением ----
let same = 0, total = 0;
for (let y = 1950; y <= 2020; y += 3) for (let m = 1; m <= 12; m += 5) for (const d of [1, 9, 17, 28]) {
  const a = calcMatrix({ d, m, y }), b = wCalc({ d, m, y }); total++;
  if (["A", "B", "V", "G", "D", "E", "Zh", "Z", "I"].every((k) => a.pts[k] === b.pts[k]) && a.purposes.personal === b.purposes.personal && a.purposes.social === b.purposes.social && a.purposes.general === b.purposes.general) same++;
}
check(same === total, `расчёт матрицы в боте = приложению (${total} дат)`);
const p1 = pairMatrix(calcMatrix({ d: 14, m: 3, y: 1992 }), calcMatrix({ d: 2, m: 11, y: 1990 })), p2 = wPair(wCalc({ d: 14, m: 3, y: 1992 }), wCalc({ d: 2, m: 11, y: 1990 }));
check(JSON.stringify(p1.pair) === JSON.stringify(p2.pair) && JSON.stringify([...new Set(p1.shared.map((x) => x.energy))].sort((x, y) => x - y)) === JSON.stringify(p2.shared), "пара в боте = приложению");
check(wParse("31.02.1990").error && wParse("14/03/1992").d === 14 && wParse("14031992").y === 1992 && wParse("01.01.2999").error, "разбор даты: ошибки и форматы");
const LITE = JSON.parse(readFileSync(new URL("../build/site/matrix-lite.json", import.meta.url), "utf8")).energies;
const calls2 = []; const b2 = createBot({ store, tg: async (m, bd) => { calls2.push([m, bd]); }, site: "https://x.dev", getQuotes: async () => quotes, getBuddha: async () => [], getMatrix: async () => LITE, now: () => Date.UTC(2026, 9, 7, 3, 0) });
const m2 = (t, c = 7) => b2.handleUpdate({ message: { chat: { id: c }, text: t } });
await m2("/matrix 14.03.1992"); check(/Матрица судьбы · 14\.03\.1992/.test(calls2[0][1].text) && /Характер и ресурс/.test(calls2[0][1].text) && /Я ничего не сохраняю/.test(calls2[0][1].text), "/matrix с датой: разбор в чате и заметка о приватности");
check(!JSON.stringify([...mem.values()]).includes("1992"), "дата рождения нигде не сохраняется");
calls2.length = 0; await m2("/matrix 99.99.1992"); check(/не существует|формате/.test(calls2[0][1].text), "/matrix: неверная дата → понятная ошибка");
calls2.length = 0; await m2("/pair 14.03.1992 02.11.1990"); check(/Совместимость · 14\.03\.1992 и 02\.11\.1990/.test(calls2[0][1].text) && /Вопрос для разговора/.test(calls2[0][1].text) && /не оценка союза/.test(calls2[0][1].text), "/pair с двумя датами: разбор и вопрос для разговора");
calls2.length = 0; await m2("/pair 14.03.1992"); check(/две даты/.test(calls2[0][1].text), "/pair с одной датой → подсказка");
calls2.length = 0; await m2("/matrix"); check(/двумя способами/.test(calls2[0][1].text) && calls2[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#matrix", "/matrix без даты: выбор между чатом и приложением");

// ---- новолуния и полнолуния ----
const EV = [{ t: Date.UTC(2026, 9, 10, 15, 50), type: "new" }, { t: Date.UTC(2026, 9, 26, 4, 12), type: "full" }];
check(moonOnDay(EV, Date.UTC(2026, 9, 10, 4, 0), 300)?.type === "new" && moonOnDay(EV, Date.UTC(2026, 9, 11, 4, 0), 300) === null && moonOnDay(EV, Date.UTC(2026, 9, 26, 4, 0), 300)?.type === "full", "день события считается по местной дате");
let now3 = Date.UTC(2026, 9, 10, 4, 0);                                  // 09:00 в Астане, день новолуния
const mem3 = new Map(), calls3 = [];
const store3 = { get: async (c) => mem3.get(c) ?? null, put: async (x) => { mem3.set(x.chat, { ...x }); }, del: async (c) => { mem3.delete(c); }, due: async (m) => [...mem3.values()].filter((x) => x.morning_utc === m || x.med_utc === m || x.luna_utc === m).map((x) => ({ ...x })) };
const b3 = createBot({ store: store3, tg: async (m, bd) => { calls3.push([m, bd]); }, site: "https://x.dev", getQuotes: async () => quotes, getBuddha: async () => [], getMoon: async () => EV, now: () => now3 });
await b3.handleUpdate({ message: { chat: { id: 9 }, text: "/luna" } });
check(mem3.get(9).luna === "09:00" && mem3.get(9).luna_utc === 240 && /новолуние 10 октября|полнолуние 26 октября/.test(calls3[0][1].text), "/luna: включено на 09:00, показаны ближайшие даты");
calls3.length = 0; await b3.tick(); check(calls3.length === 1 && /Сегодня новолуние/.test(calls3[0][1].text) && /20:50/.test(calls3[0][1].text), "в день новолуния приходит сообщение с точным временем");
await b3.tick(); check(calls3.length === 1, "в ту же минуту повторно не приходит");
now3 = Date.UTC(2026, 9, 11, 4, 0); calls3.length = 0; await b3.tick(); check(calls3.length === 0, "в обычный день ничего не приходит");
now3 = Date.UTC(2026, 9, 26, 4, 0); await b3.tick(); check(calls3.length === 1 && /Сегодня полнолуние/.test(calls3[0][1].text) && !/притягива|загадай желание|ритуал обязател/i.test(calls3[0][1].text), "в день полнолуния приходит сообщение без магического мышления");
await b3.handleUpdate({ message: { chat: { id: 9 }, text: "/luna off" } }); check(mem3.get(9).luna === null, "/luna off отключает");
process.exit(ok ? 0 : 1);
