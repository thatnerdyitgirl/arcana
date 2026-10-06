// Telegram-бот: разбор времени и пояса, расчёт минуты по UTC, команды, рассылка по расписанию (без сети и без D1).
import { parseTime, parseTz, utcMinute, localDate, dayIndex, tzLabel, createBot } from "../bot/worker.mjs";
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
calls.length = 0; await msg("/matrix"); check(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#matrix" && !/\d{2}\.\d{2}\.\d{4}/.test(JSON.stringify(calls)), "/matrix открывает Матрицу в приложении, даты в чате не просим");
calls.length = 0; await msg("/pair"); check(calls[0][1].reply_markup.inline_keyboard[0][0].web_app.url === "https://x.dev/#matrix/together", "/pair открывает «Мы вместе»");
await msg("привет"); check(/utro/.test(last()[1].text), "непонятный текст → подсказка");
// лимит за один запуск
for (let c = 100; c < 160; c++) mem.set(c, { chat: c, tz: 300, morning: "08:00", med: null, morning_utc: 180, med_utc: null, last_morning: null, last_med: null });
clock = Date.UTC(2026, 9, 10, 3, 0); calls.length = 0; n = await b.tick(); check(n <= 40 && calls.length <= 40, "за один запуск не больше 40 отправок (лимит бесплатного тарифа)");
process.exit(ok ? 0 : 1);
