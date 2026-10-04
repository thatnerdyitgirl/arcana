// Практики Arcana: журнал на устройстве, счётчики, фраза дня. Без сервера, аккаунта и ИИ.
// Журнал — массив {t: миллисекунды, id: практика, sec: секунды} в localStorage.

export const PRACTICE_LOG_KEY = "arcana-practice-log";
const dayNum = (ms) => { const d = new Date(ms); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5); };

export function readLog(storage = globalThis.localStorage) {
  try { const a = JSON.parse(storage.getItem(PRACTICE_LOG_KEY) || "[]"); return Array.isArray(a) ? a.filter((e) => e && Number.isFinite(e.t) && Number.isFinite(e.sec)) : []; } catch { return []; }
}
export function addEntry(entry, storage = globalThis.localStorage) {
  const log = readLog(storage); log.push({ t: entry.t, id: entry.id, sec: Math.round(entry.sec) });
  try { storage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log.slice(-500))); } catch {}
  return log;
}
export function clearLog(storage = globalThis.localStorage) { try { storage.removeItem(PRACTICE_LOG_KEY); } catch {} }

// Сегодня и последние 7 дней (включая сегодня), по местным суткам устройства
export function stats(log, now = Date.now()) {
  const today = dayNum(now); let day = 0, week = 0;
  for (const e of log) { const n = dayNum(e.t); if (n === today) day += e.sec; if (n > today - 7 && n <= today) week += e.sec; }
  return { todaySec: day, weekSec: week };
}
export function fmtMinutes(sec) {
  if (!sec) return "0 мин";
  const m = Math.round(sec / 60);
  if (m < 1) return "меньше минуты";
  if (m < 60) return `${m} мин`;
  return `${Math.floor(m / 60)} ч ${m % 60 ? (m % 60) + " мин" : ""}`.trim();
}
export const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

// Фраза дня: одна на местные сутки, меняется детерминированно
export function phraseOfDay(phrases, now = Date.now()) { return phrases[((dayNum(now) % phrases.length) + phrases.length) % phrases.length]; }
export const practiceById = (data, id) => data.practices.find((p) => p.id === id);
