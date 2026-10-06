// Arcana Zen: Telegram-бот на Cloudflare Workers (бесплатный тариф) + D1.
// Умеет: карту дня по утрам фотографией, напоминание о медитации, /karta и /sovet по запросу.
// Секреты (BOT_TOKEN, WEBHOOK_SECRET) хранятся только в настройках Worker, в коде их нет.
// Бот не хранит ничего, кроме номера чата, часового пояса и выбранного времени напоминаний.

const DAY_MS = 86400000;
const DEFAULT_TZ = 300;            // Астана, UTC+5 (в минутах)
const MAX_PER_TICK = 40;           // бесплатный лимит: до 50 запросов за один запуск
const SITE_DEFAULT = "https://arcanazen.pages.dev";

// ---------- чистые функции (проверяются тестами) ----------

/** «8:05», «08.05», «2222» → «HH:MM» или null */
export function parseTime(s) {
  const m = String(s ?? "").trim().match(/^(\d{1,2})\s*[:.\-]?\s*(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}` : null;
}
/** «+5», «5», «UTC+5:30», «-3» → минуты смещения или null */
export function parseTz(s) {
  const m = String(s ?? "").trim().replace(/^utc/i, "").match(/^([+-]?)(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const v = (Number(m[2]) * 60 + Number(m[3] ?? 0)) * (m[1] === "-" ? -1 : 1);
  return v >= -720 && v <= 840 ? v : null;
}
/** Время по местным часам → минута суток по UTC (0–1439) */
export function utcMinute(hhmm, tzMin) {
  const [h, m] = hhmm.split(":").map(Number);
  return (((h * 60 + m - tzMin) % 1440) + 1440) % 1440;
}
/** Местная дата YYYY-MM-DD для момента nowMs */
export function localDate(nowMs, tzMin) {
  return new Date(nowMs + tzMin * 60000).toISOString().slice(0, 10);
}
/** Индекс цитаты дня: та же формула, что и на сайте (день × 7 по модулю числа цитат) */
export function dayIndex(n, nowMs, tzMin, shift = 0) {
  const d = new Date(nowMs + tzMin * 60000);
  const day = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
  return (((day * 7 + shift) % n) + n) % n;
}
export const tzLabel = (tzMin) => `UTC${tzMin < 0 ? "-" : "+"}${Math.floor(Math.abs(tzMin) / 60)}${Math.abs(tzMin) % 60 ? ":" + String(Math.abs(tzMin) % 60).padStart(2, "0") : ""}`;

const HELP = `Я Arcana Zen. Присылаю карту дня и напоминаю о практике. Ничего не предсказываю.

/utro 08:00 — карта дня по утрам
/med 22:22 — напоминание о медитации
/karta — карта дня прямо сейчас
/sovet — совет Будды
/matrix — матрица судьбы
/pair — совместимость двух матриц
/tz +5 — часовой пояс (по умолчанию Астана, +5)
/status — мои напоминания
/stop — отключить всё`;
const MED_LINES = [
  "Время для практики. Несколько минут тишины и дыхания.",
  "Пауза для себя: сядь удобно и замедли дыхание.",
  "Самое время вернуться к себе. Хватит и пяти минут.",
  "Отложи телефон после практики. А сейчас просто выдохни.",
];

// ---------- бот: зависимости передаются снаружи (в тестах подменяются) ----------

export function createBot({ store, tg, site = SITE_DEFAULT, getQuotes, getBuddha, now = () => Date.now() }) {
  const app = (path = "", label = "Открыть Arcana") => ({ inline_keyboard: [[{ text: label, web_app: { url: site + "/" + path } }]] });
  const pad2 = (n) => String(n).padStart(2, "0");

  async function sendCard(chat, tzMin, date) {
    const quotes = await getQuotes(); if (!quotes?.length) return;
    const i = dayIndex(quotes.length, now(), tzMin), q = quotes[i];
    await tg("sendPhoto", { chat_id: chat, photo: `${site}/cards/${pad2(i)}.jpg`, caption: `«${q.t}»\n\n${q.s}`, reply_markup: app("#day") });
  }
  async function sendMed(chat) {
    const d = Math.floor(now() / DAY_MS);
    await tg("sendMessage", { chat_id: chat, text: MED_LINES[d % MED_LINES.length], reply_markup: app("#practices") });
  }
  async function sub(chat) { return (await store.get(chat)) ?? { chat, tz: DEFAULT_TZ, morning: null, med: null, morning_utc: null, med_utc: null, last_morning: null, last_med: null }; }
  const save = (s) => store.put({ ...s, morning_utc: s.morning ? utcMinute(s.morning, s.tz) : null, med_utc: s.med ? utcMinute(s.med, s.tz) : null });
  const say = (chat, text, extra = {}) => tg("sendMessage", { chat_id: chat, text, ...extra });

  async function command(chat, name, arg) {
    const s = await sub(chat);
    switch (name) {
      case "start": case "help":
        return say(chat, HELP, { reply_markup: app() });
      case "utro": case "med": {
        const key = name === "utro" ? "morning" : "med", def = name === "utro" ? "08:00" : "22:22";
        if (/^(off|выкл|нет|стоп)$/i.test(arg)) { s[key] = null; await save(s); return say(chat, "Отключила."); }
        const t = arg ? parseTime(arg) : def;
        if (!t) return say(chat, `Не поняла время. Пример: /${name} ${def}`);
        s[key] = t; await save(s);
        return say(chat, name === "utro" ? `Хорошо, карта дня будет приходить в ${t} (${tzLabel(s.tz)}).` : `Хорошо, напомню о медитации в ${t} (${tzLabel(s.tz)}).`);
      }
      case "tz": {
        const v = parseTz(arg);
        if (v === null) return say(chat, `Пришли часовой пояс, например /tz +5. Сейчас ${tzLabel(s.tz)}.`);
        s.tz = v; await save(s); return say(chat, `Часовой пояс: ${tzLabel(v)}. Время напоминаний считается по нему.`);
      }
      case "karta": return sendCard(chat, s.tz);
      case "sovet": {
        const b = await getBuddha(); if (!b?.length) return;
        const q = b[Math.floor(Math.random() * b.length)];
        return say(chat, `«${q.t}»\n\n${q.s}`, { reply_markup: app("#sovet", "Ещё совет") });
      }
      case "matrix":
        return say(chat, "Матрица судьбы считается прямо на твоём устройстве: дату рождения ты вводишь в приложении, она никуда не отправляется и до меня не доходит.", { reply_markup: app("#matrix", "Открыть Матрицу") });
      case "pair":
        return say(chat, "Совместимость двух матриц тоже считается на твоём устройстве. Введи две даты в приложении: это темы для разговора, а не оценка союза.", { reply_markup: app("#matrix/together", "Мы вместе") });
      case "status":
        return say(chat, `Карта дня: ${s.morning ?? "выключена"}\nМедитация: ${s.med ?? "выключена"}\nЧасовой пояс: ${tzLabel(s.tz)}`);
      case "stop": await store.del(chat); return say(chat, "Всё отключила. Если захочешь вернуться, напиши /start.");
      default: return say(chat, HELP, { reply_markup: app() });
    }
  }

  async function handleUpdate(u) {
    const m = u.message; if (!m?.chat || typeof m.text !== "string") return;
    const t = m.text.trim(), mm = t.match(/^\/([a-zA-Z_]+)(?:@\w+)?(?:\s+(.*))?$/s);
    if (!mm) return say(m.chat.id, HELP, { reply_markup: app() });
    return command(m.chat.id, mm[1].toLowerCase(), (mm[2] ?? "").trim());
  }

  /** Вызывается раз в минуту по расписанию */
  async function tick() {
    const nowMs = now(), utcMin = Math.floor(nowMs / 60000) % 1440;
    const subs = (await store.due(utcMin)).slice(0, MAX_PER_TICK);
    for (const s of subs) {
      const today = localDate(nowMs, s.tz);
      try {
        if (s.morning_utc === utcMin && s.last_morning !== today) { await store.put({ ...s, last_morning: today }); await sendCard(s.chat, s.tz); s.last_morning = today; }
        if (s.med_utc === utcMin && s.last_med !== today) { await store.put({ ...s, last_med: today }); await sendMed(s.chat); }
      } catch (e) {
        if (e && e.blocked) await store.del(s.chat);
      }
    }
    return subs.length;
  }
  return { handleUpdate, tick };
}

// ---------- склейка с Cloudflare: D1, fetch к Telegram, маршруты ----------

const d1Store = (db) => ({
  get: (chat) => db.prepare("SELECT * FROM subs WHERE chat = ?").bind(chat).first(),
  put: (s) => db.prepare(`INSERT INTO subs (chat, tz, morning, med, morning_utc, med_utc, last_morning, last_med) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(chat) DO UPDATE SET tz = excluded.tz, morning = excluded.morning, med = excluded.med, morning_utc = excluded.morning_utc, med_utc = excluded.med_utc,
    last_morning = excluded.last_morning, last_med = excluded.last_med`).bind(s.chat, s.tz, s.morning, s.med, s.morning_utc, s.med_utc, s.last_morning, s.last_med).run(),
  del: (chat) => db.prepare("DELETE FROM subs WHERE chat = ?").bind(chat).run(),
  due: async (min) => (await db.prepare("SELECT * FROM subs WHERE morning_utc = ?1 OR med_utc = ?1 LIMIT 60").bind(min).all()).results ?? [],
});

function makeTg(token) {
  return async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const err = new Error(`telegram ${method} ${res.status}`); err.blocked = res.status === 403 || res.status === 400; throw err; }
    return res.json();
  };
}
const cached = (url, ttl = 6 * 3600e3) => { let at = 0, val = null; return async () => { if (!val || Date.now() - at > ttl) { const r = await fetch(url); if (r.ok) { val = (await r.json()).quotes; at = Date.now(); } } return val; }; };

function bot(env) {
  const site = (env.SITE || SITE_DEFAULT).replace(/\/$/, "");
  return createBot({ store: d1Store(env.DB), tg: makeTg(env.BOT_TOKEN), site, getQuotes: cached(site + "/day-quotes.json"), getBuddha: cached(site + "/buddha.json") });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/webhook" && req.method === "POST") {
      if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("no", { status: 401 });
      const update = await req.json();
      ctx.waitUntil(bot(env).handleUpdate(update).catch(() => {}));
      return new Response("ok");
    }
    if (url.pathname === "/setup" && url.searchParams.get("key") === env.WEBHOOK_SECRET && env.WEBHOOK_SECRET) {
      const tg = makeTg(env.BOT_TOKEN), site = (env.SITE || SITE_DEFAULT).replace(/\/$/, "");
      await tg("setWebhook", { url: url.origin + "/webhook", secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message"] });
      await tg("setMyCommands", { commands: [["utro", "Карта дня по утрам"], ["med", "Напоминание о медитации"], ["karta", "Карта дня сейчас"], ["sovet", "Совет Будды"], ["matrix", "Матрица судьбы"], ["pair", "Совместимость"], ["tz", "Часовой пояс"], ["status", "Мои напоминания"], ["stop", "Отключить всё"]].map(([command, description]) => ({ command, description })) });
      await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Открыть Arcana", web_app: { url: site + "/" } } });
      return new Response("Готово: бот подключён.");
    }
    return new Response("Arcana Zen bot работает.");
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(bot(env).tick()); },
};
