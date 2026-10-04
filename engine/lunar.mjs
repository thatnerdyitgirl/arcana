// Лунный гид Arcana для Астаны. Астрономия считается библиотекой astronomy-engine (MIT, vendor/astronomy.browser.min.js):
// фазы, эклиптическая долгота Луны, восходы и заходы. Здесь ничего не придумывается: только расчёт и форматирование.
// Лунные сутки считаются так: 1-е начинаются в момент новолуния, следующие — с восхода Луны, последние заканчиваются новолунием.
// Эзотерические значения суток лежат в knowledge/lunar/lunar-days.json и считаются традиционной системой, а не научным прогнозом.

export const ASTANA = { name: "Астана", lat: 51.1694, lon: 71.4491, elevation: 347, tz: "Asia/Almaty" };

const SIGNS = [
  ["Овен", "Овне"], ["Телец", "Тельце"], ["Близнецы", "Близнецах"], ["Рак", "Раке"], ["Лев", "Льве"], ["Дева", "Деве"],
  ["Весы", "Весах"], ["Скорпион", "Скорпионе"], ["Стрелец", "Стрельце"], ["Козерог", "Козероге"], ["Водолей", "Водолее"], ["Рыбы", "Рыбах"],
];

// Название фазы по углу «Луна — Солнце» (0 новолуние, 90 первая четверть, 180 полнолуние, 270 последняя четверть)
export function phaseName(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a < 6 || a >= 354) return "Новолуние";
  if (a < 84) return "Растущий серп";
  if (a < 96) return "Первая четверть";
  if (a < 174) return "Растущая Луна";
  if (a < 186) return "Полнолуние";
  if (a < 264) return "Убывающая Луна";
  if (a < 276) return "Последняя четверть";
  return "Убывающий серп";
}

// Основная подпись фазы — только «Растущая / Убывающая Луна»; астрономические названия (четверть, серп, полнолуние) — в подробностях
export const waxLabel = (angle) => (((angle % 360) + 360) % 360 < 180 ? "Растущая Луна" : "Убывающая Луна");

export const signOf = (lon) => { const i = Math.floor((((lon % 360) + 360) % 360) / 30); return { index: i, name: SIGNS[i][0], inName: SIGNS[i][1] }; };

// ---------- местное время ----------

function tzParts(date, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o = {}; for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, s: +o.second };
}
export function tzOffsetMs(date, tz) {
  const p = tzParts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}
// начало местных суток (UTC-момент) и начало следующих
export function localDayBounds(date, tz) {
  const p = tzParts(date, tz);
  const mid = Date.UTC(p.y, p.m - 1, p.d);
  let start = mid - tzOffsetMs(new Date(mid), tz);
  start = mid - tzOffsetMs(new Date(start), tz);
  const pn = tzParts(new Date(start + 36 * 3600e3), tz);
  const midNext = Date.UTC(pn.y, pn.m - 1, pn.d);
  let end = midNext - tzOffsetMs(new Date(start + 36 * 3600e3), tz);
  end = midNext - tzOffsetMs(new Date(end), tz);
  return { start: new Date(start), end: new Date(end), key: `${p.y}-${p.m}-${p.d}` };
}
// Момент для снимка соседних суток: полдень местного дня со сдвигом (−1 вчера, +1 завтра); для 0 — сам момент
export function dayShifted(date, offset, tz = ASTANA.tz) {
  if (!offset) return date;
  const b = localDayBounds(new Date(date.getTime() + offset * 864e5), tz);
  return new Date((b.start.getTime() + b.end.getTime()) / 2);
}
// Полдень выбранной даты «ГГГГ-ММ-ДД» по местному времени
export function dayOnDate(str, tz = ASTANA.tz) {
  const [y, m, d] = str.split("-").map(Number);
  const b = localDayBounds(new Date(Date.UTC(y, m - 1, d, 7)), tz);
  return new Date((b.start.getTime() + b.end.getTime()) / 2);
}
export const fmtTime = (d, tz = ASTANA.tz) => d ? new Intl.DateTimeFormat("ru-RU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d) : "—";
const dayKey = (d, tz) => { const p = tzParts(d, tz); return Date.UTC(p.y, p.m - 1, p.d) / 864e5; };
// «в 21:47», «завтра в 02:03», «5 октября в 03:10»
export function fmtWhen(d, now, tz = ASTANA.tz) {
  if (!d) return "—";
  const diff = dayKey(d, tz) - dayKey(now, tz);
  const t = fmtTime(d, tz);
  if (diff === 0) return `в ${t}`;
  if (diff === 1) return `завтра в ${t}`;
  if (diff === -1) return `вчера в ${t}`;
  return `${new Intl.DateTimeFormat("ru-RU", { timeZone: tz, day: "numeric", month: "long" }).format(d)} в ${t}`;
}
export function fmtLeft(ms) {
  const m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60), mm = m % 60;
  if (h === 0) return `${mm} мин`;
  if (h >= 24) { const d = Math.floor(h / 24); return `${d} д ${h % 24} ч`; }
  return mm ? `${h} ч ${mm} мин` : `${h} ч`;
}

// ---------- границы лунных суток ----------

const cache = new Map();
function lunation(A, date, place) {
  const obs = new A.Observer(place.lat, place.lon, place.elevation);
  let t = new Date(date.getTime() - 31 * 864e5), last = null;
  for (let i = 0; i < 4; i++) {
    const nm = A.SearchMoonPhase(0, t, 40);
    if (!nm || nm.date > date) break;
    last = nm.date; t = new Date(nm.date.getTime() + 864e5);
  }
  if (!last) throw new Error("не найдено новолуние");
  const key = `${place.name}|${last.getTime()}`;
  if (cache.has(key)) return cache.get(key);
  const next = A.SearchMoonPhase(0, new Date(last.getTime() + 864e5), 40).date;
  const rises = []; let s = last;
  for (let i = 0; i < 40; i++) {
    const r = A.SearchRiseSet("Moon", obs, +1, s, 3);
    if (!r || r.date >= next) break;
    rises.push(r.date); s = new Date(r.date.getTime() + 60e3);
  }
  const out = { start: last, end: next, boundaries: [last, ...rises, next] };
  cache.set(key, out);
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  return out;
}

// Восход и заход Луны в местные сутки (может не быть одного из них)
function moonRiseSet(A, date, place) {
  const obs = new A.Observer(place.lat, place.lon, place.elevation);
  const { start, end } = localDayBounds(date, place.tz);
  const one = (dir) => { const r = A.SearchRiseSet("Moon", obs, dir, start, 1.2); return r && r.date >= start && r.date < end ? r.date : null; };
  return { rise: one(+1), set: one(-1) };
}

// Когда Луна сменит знак
function nextSignChange(A, date) {
  const s0 = signOf(A.EclipticGeoMoon(date).lon).index;
  let lo = date.getTime(), hi = lo;
  for (let i = 0; i < 200; i++) { hi = lo + 30 * 60e3; if (signOf(A.EclipticGeoMoon(new Date(hi)).lon).index !== s0) break; lo = hi; }
  for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (signOf(A.EclipticGeoMoon(new Date(mid)).lon).index === s0) lo = mid; else hi = mid; }
  return new Date(Math.round(hi / 60e3) * 60e3);
}

export function lunarSnapshot(date = new Date(), A = globalThis.Astronomy, place = ASTANA) {
  if (!A) throw new Error("Astronomy не загружена");
  const L = lunation(A, date, place);
  const b = L.boundaries;
  let i = 0; while (i < b.length - 2 && date >= b[i + 1]) i++;
  const day = i + 1, last = i + 1 === b.length - 1;
  const angle = A.MoonPhase(date);
  const sign = signOf(A.EclipticGeoMoon(date).lon);
  const rs = moonRiseSet(A, date, place);
  return {
    now: date, place, day, totalDays: b.length - 1,
    dayStart: b[i], dayEnd: b[i + 1], nextDay: last ? 1 : day + 1, nextIsNewMoon: last, msLeft: b[i + 1] - date,
    newMoon: L.start, nextNewMoon: L.end,
    phase: { angle, name: phaseName(angle), illumination: A.Illumination("Moon", date).phase_fraction, waxing: angle < 180 },
    sign, signUntil: nextSignChange(A, date), moonrise: rs.rise, moonset: rs.set,
  };
}

// Контур освещённой части Луны для SVG (круг радиуса r с центром cx, cy)
export function moonLitPath(angle, cx = 0, cy = 0, r = 10) {
  const th = (((angle % 360) + 360) % 360) * Math.PI / 180, c = Math.cos(th), rx = Math.abs(c) * r;
  if (angle % 360 < 2 || angle % 360 > 358) return "";
  const waxing = th < Math.PI, crescent = waxing ? c > 0 : c > 0;
  const top = `${cx} ${cy - r}`, bot = `${cx} ${cy + r}`;
  const outer = waxing ? `M${top} A${r} ${r} 0 0 1 ${bot}` : `M${top} A${r} ${r} 0 0 0 ${bot}`;
  // терминатор от низа к верху
  const sweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  return `${outer} A${rx.toFixed(2)} ${r} 0 0 ${sweep} ${top} Z`;
}

// ---------- гид: данные суток и предупреждение ----------

export const lunarDay = (data, n) => data.days.find((d) => d.n === n) ?? data.days[Math.min(n, data.days.length) - 1];
export const isWarningDay = (data, n) => data.warning_days.includes(n);
export const warningText = (data, n) => data.warning_text.replace("{n}", String(n));

// ---------- байт-советы дня: бьюти и стрижка, цвет, ментальный фон, бизнес ----------

export function dayBytes(data, sn) {
  const B = data.bytes, sg = B.signs[sn.sign.name], n = sn.day;
  const avoidKey = n === 1 ? "new_moon" : String(n);
  const dayRule = B.hair_avoid_days[avoidKey];
  const beauty = dayRule
    ? { verdict: "avoid", text: dayRule, sub: "Лучше отложить стрижку и сделать уходовую маску." }
    : { verdict: sg.hair_verdict, text: sg.hair, sub: sg.hair_verdict === "good" || sg.hair_verdict === "neutral" ? B.hair_phase[sn.phase.waxing ? "waxing" : "waning"] : sg.care };
  return { beauty, colors: sg.colors, mind: sg.mind, business: B.business[String(n)] };
}
