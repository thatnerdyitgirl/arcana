// Arcana — веб-интерфейс (без бэкенда). Сценарий: ситуация и контекст → расклад → свои карты → интерпретация.
import { init, reading, SPREADS, DECKS, detectContext, recommendSpreads } from "../engine/core.mjs";
import { drawCards, dealFan } from "../engine/draw.mjs";
import { buildCardIndex, parseCards } from "../engine/parser.mjs";
import { buildHandoffPrompt } from "../engine/handoff.mjs";
import { initPetals, createReadSound } from "../engine/fx.mjs";
import { initScene } from "../engine/scene.mjs";
import { renderMatrixPage, matrixNoteForReading } from "./matrix_ui.mjs";
import { readLog, addEntry, clearLog, stats, fmtMinutes, fmtClock, phraseOfDay, practiceById } from "../engine/practices.mjs";
import { lunarSnapshot, dayShifted, dayOnDate, dayBytes, lunarDay, isWarningDay, warningText, moonLitPath, fmtTime, fmtWhen, fmtLeft, waxLabel, ASTANA } from "../engine/lunar.mjs";

const playReadSound = createReadSound(typeof ARCANA_SOUND !== "undefined" ? ARCANA_SOUND : "../assets/read.mp3");
const APP_DATA = typeof ARCANA_DATA !== "undefined" ? ARCANA_DATA : await (await fetch("./data.json")).json();
init(APP_DATA);
const ART = typeof ARCANA_ART !== "undefined" ? ARCANA_ART : {};     // лёгкие SVG-иллюстрации RWS (id → svg)
const deckCards = (d) => Object.fromEntries(Object.entries(APP_DATA.cards).filter(([id]) => id.startsWith(d + "_")));
const INDEXES = { MANARA: buildCardIndex(deckCards("MANARA"), "MANARA"), RWS: buildCardIndex(deckCards("RWS"), "RWS") };
// колода доступна, если в базе есть все 22 Старших аркана (вытяжка идёт из них)
const deckReady = (d) => Array.from({ length: 22 }, (_, i) => `${d}_MAJOR_${String(i).padStart(2, "0")}`).every((id) => APP_DATA.cards[id]);
const REV_MODE_RU = { blocked: "блокировка", excess: "избыток", distorted: "искажение", internal: "внутреннее проявление", delayed: "задержка", hard_to_express: "трудность выражения" };

const THEME_TABS = ["Отношения", "Работа и бизнес", "Решения и перемены", "Саморазвитие", "Психология", "Творчество"];
const EXAMPLE = {
  story: "Мы не знакомы, просто давно наблюдаю за этим человеком и хочу понять, что меня так цепляет.",
  theme: "Отношения", spreadId: "rel.attraction", cardsText: "8 Воды Луна Всадница Огня",
};
const MODE_LABEL = { plus: "в плюсе", shadow: "в тени", both: "обе стороны" };
const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
const COURT_SHORT = { KNAVE: "Слуга", PAGE: "Паж", KNIGHT: "Всадница", QUEEN: "Королева", KING: "Король" };
const COURT_SHORT_RWS = { PAGE: "Паж", KNIGHT: "Рыцарь", QUEEN: "Королева", KING: "Король" };
const SUIT_GLYPH = { WANDS: "FIRE", CUPS: "WATER", SWORDS: "AIR", PENTACLES: "EARTH" };

const state = { story: "", theme: null, spreadId: null, cardsText: "", view: "both", result: null, error: "", themeTab: THEME_TABS[0],
  deck: "MANARA", mode: "manual", drawn: [], revealed: 0, drawSpread: null, reversals: false, scope: "all", fan: null, quick: false, newSlot: -1 };
let revealTimer = 0;
const resetDraw = () => { clearTimeout(revealTimer); state.drawn = []; state.revealed = 0; state.drawSpread = null; state.fan = null; state.quick = false; state.newSlot = -1; };
// колода для вытяжки: все 78 карт или только 22 Старших
const drawPool = () => state.scope === "major" ? null : Object.keys(APP_DATA.cards).filter((id) => id.startsWith(state.deck + "_")).sort();
const FAN_SIZE = 22;

const $app = document.getElementById("app");

// ---------- визуальные миры и тема ----------
const WORLD_BY_THEME = { "Отношения": "relations", "Работа и бизнес": "work", "Решения и перемены": "decision", "Саморазвитие": "self", "Психология": "psyche", "Творчество": "creative" };
// Пока тема не выбрана — лотосы на рисовой бумаге
function setWorld(spread, theme) {
  const w = spread ? WORLD_BY_THEME[spread.theme] : WORLD_BY_THEME[theme];
  const next = w ?? "lotus";
  if (document.body.dataset.world !== next) { document.body.dataset.world = next; scene.show(next); }
}
// Фон: готовые слои миров + плавное наложение (см. engine/scene.mjs)
const scene = initScene(document.getElementById("scene-stage"), document.getElementById("scene-src"), (() => {
  const probe = document.getElementById("scene-probe");
  const c = document.getElementById("scene-src").cloneNode(true); c.removeAttribute("id");
  probe.appendChild(c);
  return probe;
})());
const themeBtn = document.getElementById("theme-switch");
function applyTheme(t) {
  if (t === "dark") document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
  themeBtn.textContent = t === "dark" ? "Бумага" : "Ночная тушь";
  themeBtn.setAttribute("aria-pressed", String(t === "dark"));
  scene.refresh();
}
let savedTheme = "light";
try { savedTheme = localStorage.getItem("arcana-theme") || "light"; } catch {}
applyTheme(savedTheme);
scene.show(document.body.dataset.world || "lotus");
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("arcana-theme", next); } catch {}
  // при выходе из «Ночной туши» расклад 18+ больше недоступен
  if (!adultMode() && SPREADS.find((x) => x.id === state.spreadId)?.adult) { state.spreadId = null; resetDraw(); }
  if (typeof route === "function" && /^#?(ask|spreads)?$/.test(location.hash)) route();
});
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Расклады 18+ видны только при включённой «Ночной туши» (тёмной теме)
const adultMode = () => document.documentElement.dataset.theme === "dark";
const shown = () => SPREADS.filter((s) => !s.adult || adultMode());
const spreadById = (id) => shown().find((s) => s.id === id);
const currentSpread = () => spreadById(state.spreadId)
  ?? (state.theme ? (recommendSpreads(state.story, 36, { adult: adultMode() }).find((r) => r.spread.theme === state.theme)?.spread ?? shown().find((s) => s.theme === state.theme)) : null)
  ?? recommendSpreads(state.story, 3, { adult: adultMode() })[0]?.spread ?? spreadById("decision.blind");

// Примеры для поля «Твоя ситуация» — под выбранную тему
const STORY_EXAMPLES = {
  "": ["Например: мы не знакомы, просто давно наблюдаю за этим человеком и хочу понять, что меня так цепляет.",
       "Например: последние месяцы я будто стою на месте и не понимаю, куда двигаться дальше."],
  "Отношения": ["Например: мы не знакомы, просто давно наблюдаю за этим человеком и хочу понять, что меня так цепляет.",
               "Например: мы расстались полгода назад, но я всё ещё мысленно с ним разговариваю.",
               "Например: мы с подругой поссорились из-за мелочи, и теперь между нами холод."],
  "Работа и бизнес": ["Например: мы с партнёром запускаем проект, но я не уверена, что мы одинаково видим цель.",
                      "Например: мне предложили новую роль, и я не понимаю, хочу ли я её на самом деле.",
                      "Например: доход есть, но денег постоянно не хватает, и это тревожит."],
  "Решения и перемены": ["Например: выбираю между тем, чтобы остаться в своём городе, и переездом ради учёбы.",
                         "Например: хочу уйти с работы, но страшно — и непонятно, страх это или интуиция.",
                         "Например: один этап жизни закончился, а новый ещё не начался."],
  "Саморазвитие": ["Например: я выгорела и не понимаю, откуда брать силы на привычные дела.",
                   "Например: снова и снова откладываю важное дело, хотя очень хочу его сделать.",
                   "Например: мне трудно отказывать людям, и я устаю от этого."],
  "Психология": ["Например: я раз за разом попадаю в похожий сценарий с людьми и не понимаю, что со мной происходит.",
                 "Например: меня очень раздражают люди, которые громко заявляют о себе, — хочу понять почему.",
                 "Например: часть меня хочет перемен, а другая цепляется за привычное."],
  "Творчество": ["Например: я чувствую творческий кризис и застой в проекте, хочу понять, где заблокирована моя энергия и как вернуть вдохновение.",
                 "Например: боюсь показать свои рисунки — кажется, что их осудят.",
                 "Например: закончила большой проект и не понимаю, что делать дальше."],
};
let exampleTick = 0, exampleTimer = null;
function storyExample() {
  const list = STORY_EXAMPLES[state.theme ?? ""] ?? STORY_EXAMPLES[""];
  return list[exampleTick % list.length];
}

// ---------- глифы ----------

function glyph(suit) {
  const up = suit === "FIRE" || suit === "AIR";
  const tri = up ? "M24 6 L42 38 L6 38 Z" : "M6 10 L42 10 L24 42 Z";
  const bar = suit === "AIR" ? '<line x1="12" y1="27" x2="36" y2="27"/>' : suit === "EARTH" ? '<line x1="12" y1="21" x2="36" y2="21"/>' : "";
  return `<svg class="glyph" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.1" aria-hidden="true"><path d="${tri}"/>${bar}</svg>`;
}

function plate(c) {
  const [, group, rank] = c.id.split("_");
  const isMajor = group === "MAJOR";
  const rws = c.deck === "RWS";
  const deckName = rws ? "Райдер–Уэйт" : "Таро Манара";
  if (rws && ART[c.id]) {
    const num = isMajor ? ROMAN[Number(rank)] : (COURT_SHORT_RWS[rank] ?? String(Number(rank)));
    return `<div class="plate plate-art${c.reversed ? " is-reversed" : ""}"><span class="numeral">${esc(num)}</span><div class="art">${ART[c.id]}</div><div><div class="card-name">${esc(c.name)}</div><div class="deck">${deckName}</div></div></div>`;
  }
  const top = isMajor ? `<span class="deck">Старший аркан</span>` : `<span class="numeral">${esc((rws ? COURT_SHORT_RWS : COURT_SHORT)[rank] ?? String(Number(rank)))}</span>`;
  const middle = isMajor ? `<span class="numeral big">${ROMAN[Number(rank)]}</span>` : glyph(SUIT_GLYPH[group] ?? group);
  return `<div class="plate${c.reversed ? " is-reversed" : ""}">${top}${middle}<div><div class="card-name">${esc(c.name)}</div><div class="deck">${deckName}</div></div></div>`;
}

// карточка по id (для превью вытянутых карт)
const miniCard = (id) => ({ id, deck: id.split("_")[0], name: APP_DATA.cards[id]?.identity?.name_ru ?? id });

// ---------- лунный гид (Астана) ----------
// Астрономия — astronomy-engine; значения суток — knowledge/lunar/lunar-days.json (традиционная система, не научный прогноз).

const LUNAR = APP_DATA.lunar;
state.lunar = { open: new URLSearchParams(location.search).get("lunar") === "open", ack: false, postponed: false, ackKey: null, done: [] };      // ?lunar=open — панель открыта сразу (для проверки)
const lunarNow = () => { const q = new URLSearchParams(location.search).get("moon"); const d = q ? new Date(q) : null; return d && !isNaN(d) ? d : new Date(); };   // ?moon=ISO — просмотр другой даты
const READINGS_MARK = { favorable: "благоприятно", neutral: "нейтрально", postpone: "лучше отложить" };

const memoSnaps = {};
function lunarSnap(offset = 0) {
  const now = lunarNow(), m = memoSnaps[offset];
  if (m && Math.abs(now - m.at) < 20000) return m.snap;
  let snap = null;
  try { snap = typeof Astronomy !== "undefined" && LUNAR ? lunarSnapshot(typeof offset === "string" ? dayOnDate(offset) : dayShifted(now, offset), Astronomy, ASTANA) : null; } catch (err) { console.warn("Лунный гид недоступен:", err); }
  memoSnaps[offset] = { at: now, snap };
  return snap;
}
const DAY_TABS = [[-1, "Вчера"], [0, "Сегодня"], [1, "Завтра"]];
const COLOR_HEX = { красный: "#b8453f", алый: "#d2574a", коралловый: "#e08a76", белый: "#f4f1ea", кремовый: "#efe5cf", зелёный: "#6f9a6a", мятный: "#a9d3bf", оливковый: "#8b8f4f", бежевый: "#d8c3a0", "мягкий зелёный": "#a7c4a0", жемчужный: "#e7e1d6", "нежно-золотой": "#e2c98c", золотой: "#cfa94a", "тёплый розовый": "#e3a9a0", янтарный: "#d19a3a", "пудрово-розовый": "#e8cbc6", "светло-голубой": "#b7d2e6", бордовый: "#7a2a35", "глубокий вишнёвый": "#6a1f3a", жёлтый: "#e3c24f", "тёплый золотой": "#d6a850", терракотовый: "#c0694a", голубой: "#9cc3df", графитовый: "#4e5256", "глубокий зелёный": "#365f4a", синий: "#3f5f9a", "электрический голубой": "#5ab2e0", серебряный: "#c3c7cc", "морской зелёный": "#4f9a8f", лавандовый: "#b7a6d6", перламутровый: "#e9e3ee", "светло-жёлтый": "#efe3a0" };
const BYTE_ICON = {
  beauty: `<path d="M6 4.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 11a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM7.5 8.2 19 15M7.5 15.8 19 9"/>`,
  color: `<path d="M12 3.5c3.2 3.6 5.5 6.2 5.5 9.2a5.5 5.5 0 0 1-11 0c0-3 2.3-5.6 5.5-9.2Z"/>`,
  mind: `<path d="M12 12c0-2 3-2 3 0s-4 3.5-6 1.5-1-6.5 3.5-6.5 7 4 5.5 8.5-6 5-9 3"/>`,
  business: `<path d="M4 8.5h16v10H4zM9 8.5v-2h6v2M4 13h16"/>`,
};
function moonSvg(sn) {
  const lit = moonLitPath(sn.phase.angle, 0, 0, 9);
  return `<svg class="moon" viewBox="-11 -11 22 22" aria-hidden="true"><circle class="m-dark" r="9"/>${lit ? `<path class="m-lit" d="${lit}"/>` : ""}<circle class="m-ring" r="9"/></svg>`;
}
const LUNAR_DECO = `<svg class="lunar-deco" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 96 C60 90 110 102 170 96 S290 88 400 96" /><path d="M0 108 C70 102 130 114 200 108 S330 100 400 108" /><path class="willow" d="M392 0 C376 14 358 22 330 26 M366 14 C364 34 360 48 352 62 M348 20 C344 38 338 52 328 64 M334 24 C328 40 318 52 306 60"/></svg>`;

// ---- календарь выбора даты (стекло, как в iOS) ----
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MON_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const pad2 = (n) => String(n).padStart(2, "0");
const shortDate = (str) => { const [y, m, d] = str.split("-").map(Number); return `${d} ${MON_SHORT[m - 1]} ${y}`; };
const todayStr = () => new Intl.DateTimeFormat("en-CA", { timeZone: ASTANA.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(lunarNow());
const calLunar = new Map();
function lunarDayOf(str) {
  if (!calLunar.has(str)) { let n = null; try { n = lunarSnapshot(dayOnDate(str), Astronomy, ASTANA).day; } catch {} calLunar.set(str, n); }
  return calLunar.get(str);
}
function calHtml() {
  if (!state.lunar.cal) return "";
  const { y, m } = state.lunar.cal, today = todayStr(), sel = typeof state.lunar.view === "string" ? state.lunar.view : null;
  const first = new Date(Date.UTC(y, m - 1, 1)), lead = (first.getUTCDay() + 6) % 7, dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(Date.UTC(y, m - 1, 1 - lead + i)), str = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    const other = dt.getUTCMonth() !== m - 1;
    if (i >= 35 && other) break;
    const ld = other ? null : lunarDayOf(str);
    cells.push(`<button type="button" class="cal-d${other ? " is-other" : ""}${str === today ? " is-today" : ""}${str === sel ? " is-sel" : ""}${ld && LUNAR.warning_days.includes(ld) ? " is-warn" : ""}" data-cal-date="${str}" aria-label="${dt.getUTCDate()} ${MON_SHORT[dt.getUTCMonth()]} ${dt.getUTCFullYear()}"><b>${dt.getUTCDate()}</b>${ld ? `<i>${ld}</i>` : ""}</button>`);
  }
  return `<div class="cal-head"><button type="button" class="cal-nav" data-cal-nav="-1" aria-label="Предыдущий месяц"><svg viewBox="0 0 12 12"><path d="M7.5 2 3.5 6l4 4"/></svg></button><span class="cal-title"><b>${MONTHS[m - 1]}</b> ${y}</span><button type="button" class="cal-nav" data-cal-nav="1" aria-label="Следующий месяц"><svg viewBox="0 0 12 12"><path d="M4.5 2 8.5 6l-4 4"/></svg></button></div>
    <div class="cal-week">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => `<span>${d}</span>`).join("")}</div>
    <div class="cal-grid">${cells.join("")}</div>
    <div class="cal-foot"><span>Малая цифра — лунные сутки</span><button type="button" class="cal-today" data-cal-today>Сегодня</button></div>`;
}
function renderCal() { const c = document.getElementById("l-cal"); if (c) c.innerHTML = calHtml(); }
function setCal(open) {
  if (open && !state.lunar.cal) { const v = typeof state.lunar.view === "string" ? state.lunar.view : todayStr(); const [y, m] = v.split("-").map(Number); state.lunar.cal = { y, m }; renderCal(); }
  else if (!open) state.lunar.cal = null;
  const w = document.getElementById("l-cal-wrap"); if (w) { w.classList.toggle("is-open", !!open); w.inert = !open; }
  document.querySelector("[data-lunar-datebtn]")?.setAttribute("aria-expanded", String(!!open));
}

function lunarBody(offset) {
  const sn = lunarSnap(offset); if (!sn) return "";
  const info = lunarDay(LUNAR, sn.day), by = dayBytes(LUNAR, sn), BL = LUNAR.bytes.labels, wax = waxLabel(sn.phase.angle);
  state.lunar.zenKey = "arcana-zen:" + sn.dayStart.getTime(); state.lunar.done = [];
  try { state.lunar.done = JSON.parse(localStorage.getItem(state.lunar.zenKey) || "[]"); } catch {}
  const zen = (id, text) => `<li class="zen-li"><button type="button" class="zen${state.lunar.done.includes(id) ? " is-done" : ""}" data-zen="${id}" role="checkbox" aria-checked="${state.lunar.done.includes(id)}"><span class="zen-box" aria-hidden="true"></span><span class="zen-text">${esc(text)}</span></button></li>`;
  const plain = (items) => items.map((x) => `<li>${esc(x)}</li>`).join("");
  const ico = (k) => `<svg class="b-ico" viewBox="0 0 24 24" aria-hidden="true">${BYTE_ICON[k]}</svg>`;
  const chips = by.colors.map((c) => `<span class="b-chip"><i style="background:${COLOR_HEX[c.toLowerCase()] ?? "transparent"}"></i>${esc(c)}</span>`).join("");
  const tip = (k, verdict, body) => `<li class="b-tip${verdict ? " is-" + verdict : ""}">${ico(k)}<div><span class="b-label">${esc(BL[k])}</span>${body}</div></li>`;
  const bytes = [
    tip("beauty", by.beauty.verdict, `<p><b>${esc(by.beauty.text)}</b></p><p class="b-sub">${esc(by.beauty.sub)}</p>`),
    tip("color", "", `<p class="b-chips">${chips}</p>`),
    tip("mind", "", `<p>${esc(by.mind)}</p>`),
    tip("business", "", `<p>${esc(by.business)}</p>`),
  ].join("");
  const nextNote = sn.nextIsNewMoon ? "новолуние, начало цикла" : `${sn.nextDay}-е сутки`;
  const custom = typeof offset === "string", dayWord = custom ? "этот день" : offset ? (offset < 0 ? "вчера" : "завтра") : "сегодня";
  const snapNote = offset ? `<p class="l-note l-view-note">${custom ? new Intl.DateTimeFormat("ru-RU", { timeZone: ASTANA.tz, day: "numeric", month: "long", year: "numeric" }).format(sn.now) : offset < 0 ? "Вчера" : "Завтра"}: данные на полдень по местному времени Астаны.</p>` : "";
  return `
      <div class="l-block l-symbol"><span class="l-label">Символ дня · ${sn.day}-е сутки</span><p class="l-name">${esc(info.symbol)}</p>${snapNote}</div>
      <div class="l-block"><span class="l-label">Характер дня</span><p>${esc(info.character)}</p></div>
      <div class="l-block"><span class="l-label">Ориентиры дня</span><ul class="bytes">${bytes}</ul></div>
      <div class="l-cols">
        <div class="l-block"><span class="l-label">Рекомендуется</span><ul class="l-list">${info.recommended.map((x, i) => zen("r" + i, x)).join("")}</ul></div>
        <div class="l-block"><span class="l-label">Лучше не делать</span><ul class="l-list is-no">${plain(info.avoid)}</ul></div>
      </div>
      <div class="l-block"><span class="l-label">Практика дня <em class="l-trad">традиционная рекомендация</em></span><ul class="l-list">${zen("p", info.spiritual_practice.text)}</ul>
        <div class="l-pr-btns">${info.spiritual_practice.practice.map((id) => `<button type="button" class="pr-mini" data-pr-start="${id}|${info.spiritual_practice.minutes}">${esc(practiceById(PR, id).name)} · ${info.spiritual_practice.minutes} мин</button>`).join("")}</div></div>
      <dl class="l-inner">
        <div><dt>В медитации</dt><dd>${esc(info.meditation)}</dd></div>
        <div><dt>Для рефлексии</dt><dd>${esc(info.reflection)}</dd></div>
        <div><dt>Внутренняя работа</dt><dd>${esc(info.recommended_inner_work)}</dd></div>
      </dl>
      <div class="l-block"><span class="l-label">Для раскладов ${dayWord}</span><p class="l-readings is-${info.readings}"><b>${READINGS_MARK[info.readings]}</b> <span>традиционная рекомендация</span></p>
        ${info.readings_note ? `<p class="l-note">${esc(info.readings_note)}</p>` : ""}</div>
      <dl class="l-data">
        <div><dt>Лунные сутки</dt><dd>начались ${esc(fmtWhen(sn.dayStart, sn.now))}</dd></div>
        <div><dt>Следующие</dt><dd>${esc(nextNote)} ${esc(fmtWhen(sn.dayEnd, sn.now))}${offset ? "" : " · через " + esc(fmtLeft(sn.msLeft))}</dd></div>
        <div><dt>Фаза</dt><dd>${wax} · ${esc(sn.phase.name.toLowerCase())}, освещено ${Math.round(sn.phase.illumination * 100)}%</dd></div>
        <div><dt>Луна в знаке</dt><dd>${esc(sn.sign.name)} · до ${esc(fmtWhen(sn.signUntil, sn.now))}</dd></div>
        <div><dt>Восход · заход</dt><dd>${esc(fmtTime(sn.moonrise))} · ${esc(fmtTime(sn.moonset))}</dd></div>
      </dl>
      <p class="l-foot l-nasa">Фазы Луны рассчитаны по астрономической библиотеке и сверены с данными NASA: новолуние 29.01.2025 и полнолуние 14.03.2025 совпали в пределах двух минут.</p>
      <p class="l-foot">Астана, местное время (Asia/Almaty). Символы и содержание суток по Rivendel и Life-Moon в короткой редакции Arcana; советы по стрижке и цвету — из традиционных лунных справочников. Это традиционная система, а не научный прогноз и не медицинская рекомендация.</p>`;
}

function lunarHtml() {
  const sn = lunarSnap(); if (!sn) return "";
  const info = lunarDay(LUNAR, sn.day), warn = isWarningDay(LUNAR, sn.day);
  const key = `${sn.dayStart.getTime()}`;
  if (state.lunar.ackKey !== key) {
    state.lunar.ackKey = key; state.lunar.ack = false; state.lunar.postponed = false;
    try { state.lunar.ack = sessionStorage.getItem("arcana-lunar-ack:" + key) === "1"; } catch {}
  }
  const open = state.lunar.open, wax = waxLabel(sn.phase.angle), view = state.lunar.view ?? 0;
  const showWarning = warn && !state.lunar.ack && !state.lunar.postponed;
  const postponed = warn && state.lunar.postponed;
  return `
  <div class="lunar" id="lunar">
    <button type="button" class="lunar-bar" data-lunar-toggle aria-expanded="${open}" aria-controls="lunar-panel">
      ${moonSvg(sn)}
      <span class="lb-text"><span class="lb-today">Сегодня</span><span class="sep">·</span><b>${sn.day} лунный день</b><span class="sep">·</span><span>${wax}</span><span class="sep">·</span><span>Луна в ${esc(sn.sign.inName)}</span></span>
      <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4.5 L6 8.5 L10 4.5"/></svg>
    </button>
    ${showWarning ? `<div class="lunar-warning" role="note">
      <p>${esc(warningText(LUNAR, sn.day))}</p>
      <div class="actions"><button type="button" class="btn ghost" data-lunar-postpone>Отложить расклад</button><button type="button" class="btn" data-lunar-go>Всё равно продолжить</button></div>
    </div>` : ""}
    ${postponed ? (() => { const sp = info.spiritual_practice, pr = practiceById(PR, sp.practice[0]); return `<div class="lunar-postponed">
      <p class="eyebrow">Практика вместо расклада</p>
      <h2>${esc(pr.name)}</h2>
      <p class="prose">${esc(pr.summary)}</p>
      <p class="aside-note">Для рефлексии: ${esc(info.reflection)}</p>
      <div class="actions"><button type="button" class="btn" data-pr-start="${pr.id}|${Math.min(sp.minutes, 10)}">Перейти к практике · ${Math.min(sp.minutes, 10)} мин</button><button type="button" class="btn ghost" data-lunar-back>Вернуться к раскладу</button></div>
    </div>`; })() : ""}
    <div class="lunar-slide${open ? " is-open" : ""}" id="lunar-slide"${open ? "" : " inert"}><div class="lunar-slide-inner">
    <div class="lunar-panel" id="lunar-panel" role="region" aria-label="Лунный гид">
      ${LUNAR_DECO}
      <div class="l-days" role="group" aria-label="День">${DAY_TABS.map(([o, t]) => `<button type="button" data-lunar-day="${o}" aria-pressed="${o === view}">${t}</button>`).join("")}<button type="button" class="l-date${typeof view === "string" ? " is-on" : ""}" data-lunar-datebtn aria-expanded="${!!state.lunar.cal}" aria-controls="l-cal"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10.5" rx="2.5"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4"/></svg><span>${typeof view === "string" ? esc(shortDate(view)) : "Дата"}</span></button></div>
      <div class="l-cal-wrap${state.lunar.cal ? " is-open" : ""}" id="l-cal-wrap"${state.lunar.cal ? "" : " inert"}><div class="l-cal-inner"><div class="l-cal" id="l-cal" role="dialog" aria-label="Выбор даты">${calHtml()}</div></div></div>
      <div class="l-content" id="lunar-content">${lunarBody(view)}</div>
    </div></div></div>
  </div>`;
}

let lunarTimer = null;
function refreshLunar() {
  const box = document.getElementById("lunar-box");
  if (!box) { clearInterval(lunarTimer); lunarTimer = null; return; }
  box.innerHTML = lunarHtml();
  const warn = LUNAR && lunarSnap() && isWarningDay(LUNAR, lunarSnap().day);
  document.querySelector(".ask-main")?.toggleAttribute("hidden", !!(warn && state.lunar.postponed));
}
function lunarSwitch(v) {
  if (v === (state.lunar.view ?? 0)) return;
  state.lunar.view = v;
  document.querySelectorAll("[data-lunar-day]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.lunarDay) === v)));
  const lab = document.querySelector(".l-date");
  if (lab) { lab.classList.toggle("is-on", typeof v === "string"); lab.querySelector("span").textContent = typeof v === "string" ? shortDate(v) : "Дата"; }
  const box = document.getElementById("lunar-content"); if (!box) return;
  const token = (state.lunar.swap = (state.lunar.swap || 0) + 1);
  box.classList.add("is-swapping");
  setTimeout(() => { if (state.lunar.swap !== token) return; box.innerHTML = lunarBody(v); requestAnimationFrame(() => box.classList.remove("is-swapping")); }, 200);
}
function onLunarClick(e) {
  if (e.target.closest("[data-lunar-toggle]")) {
    state.lunar.open = !state.lunar.open;           // раскрытие без перерисовки — чтобы работала плавная анимация
    const slide = document.getElementById("lunar-slide");
    slide?.classList.toggle("is-open", state.lunar.open); if (slide) slide.inert = !state.lunar.open;
    document.querySelector("[data-lunar-toggle]")?.setAttribute("aria-expanded", String(state.lunar.open));
    return true;
  }
  const ps = e.target.closest("[data-pr-start]");
  if (ps) { const [id, min] = ps.dataset.prStart.split("|"); state.pr.id = id; state.pr.min = Number(min); state.pr.from = "ask"; state.pr.open = id; location.hash = "practices"; return true; }
  if (e.target.closest("[data-lunar-datebtn]")) { setCal(!state.lunar.cal); return true; }
  const nav = e.target.closest("[data-cal-nav]");
  if (nav && state.lunar.cal) { let { y, m } = state.lunar.cal; m += Number(nav.dataset.calNav); if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } state.lunar.cal = { y: Math.min(2100, Math.max(1950, y)), m }; renderCal(); return true; }
  const cd = e.target.closest("[data-cal-date]");
  if (cd) { lunarSwitch(cd.dataset.calDate); setCal(false); return true; }
  if (e.target.closest("[data-cal-today]")) { lunarSwitch(0); setCal(false); return true; }
  const dayBtn = e.target.closest("[data-lunar-day]");
  if (dayBtn) { lunarSwitch(Number(dayBtn.dataset.lunarDay)); setCal(false); return true; }
  const z = e.target.closest("[data-zen]");
  if (z) {
    const id = z.dataset.zen, on = !z.classList.contains("is-done");
    z.classList.toggle("is-done", on); z.setAttribute("aria-checked", String(on));
    state.lunar.done = on ? [...new Set([...state.lunar.done, id])] : state.lunar.done.filter((x) => x !== id);
    try { localStorage.setItem(state.lunar.zenKey, JSON.stringify(state.lunar.done)); } catch {}
    return true;
  }
  if (e.target.closest("[data-lunar-postpone]")) { state.lunar.postponed = true; refreshLunar(); return true; }
  if (e.target.closest("[data-lunar-go]") || e.target.closest("[data-lunar-back]")) {
    state.lunar.ack = true; state.lunar.postponed = false;
    try { sessionStorage.setItem("arcana-lunar-ack:" + state.lunar.ackKey, "1"); } catch {}
    refreshLunar(); return true;
  }
  return false;
}

// ---------- практики ----------

const PR = APP_DATA.practices, ABOUT = APP_DATA.about;
// раздел «Матрица»: контекст для интерфейса (расчёт и тексты считаются локально)
const mxCtx = {
  esc, data: APP_DATA.matrix, app: () => $app, setWorld,
  goTarot: ({ theme, spreadId }) => { if (THEME_TABS.includes(theme)) state.theme = theme; resetDraw(); state.spreadId = spreadId && spreadById(spreadId) ? spreadId : null; state.error = ""; location.hash = "ask"; },
  toLunar: () => { state.lunar.open = true; location.hash = "ask"; },
};
// подвал на всех экранах: свеча и авторская пометка
{ const q = document.getElementById("candle-q"), by = document.getElementById("candle-by"), ind = document.getElementById("indep");
  if (q && ABOUT.candle) { q.textContent = "«" + ABOUT.candle.text + "»"; by.textContent = "— " + ABOUT.candle.by; } if (ind) ind.textContent = ABOUT.indep; }
state.pr = { id: null, open: null, min: 10, run: null, done: null, from: null, ac: null };
let prTimer = 0, prLock = null;

const SFX = typeof ARCANA_SFX !== "undefined" ? ARCANA_SFX : { start: "../assets/wind-chimes.mp3", end: "../assets/singing-bowl.mp3" };
const sfxAudio = {};
let endBuf = null, endNode = null, endAt = 0, keepAlive = null;

// Тишина, которая «держит» страницу живой: пока играет едва слышный цикл, телефон не усыпляет таймер и звук окончания разрешён
function silentWav() {
  const n = 8000, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, i % 2 ? 1 : -1, true);      // почти неслышный шум
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}
// Запасной звук, если файл не проигрался: два мягких тона
function prChimeFallback() {
  const ac = state.pr.ac; if (!ac) return;
  try {
    ac.resume?.();
    [[0, 396], [1.1, 528]].forEach(([dt, f]) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + dt;
      o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 2.7);
    });
  } catch {}
}
// Финальную чашу ставим в расписание аудиочасов заранее: она сыграет вовремя, даже если страница в фоне или таймер замедлен
async function prLoadEnd() {
  if (endBuf || !state.pr.ac) return;
  try { const r = await fetch(SFX.end); endBuf = await state.pr.ac.decodeAudioData(await r.arrayBuffer()); } catch {}
}
function prScheduleEnd(ms) {
  prCancelEnd();
  const ac = state.pr.ac; if (!ac || !endBuf) return;
  try { const src = ac.createBufferSource(), g = ac.createGain(); src.buffer = endBuf; g.gain.value = 0.9; src.connect(g); g.connect(ac.destination); endAt = ac.currentTime + ms / 1000; src.start(endAt); endNode = src; } catch {}
}
function prCancelEnd() { try { endNode?.stop(); } catch {} endNode = null; }
// Старт: перезвон ветра (wind chimes). Финал: поющая чаша.
function prSoundsPrepare(ms) {
  try {
    sfxAudio.start = new Audio(SFX.start); sfxAudio.end = new Audio(SFX.end);
    sfxAudio.start.volume = 0.8; sfxAudio.end.volume = 0.9;
    sfxAudio.end.muted = true;
    sfxAudio.end.play().then(() => { sfxAudio.end.pause(); sfxAudio.end.currentTime = 0; sfxAudio.end.muted = false; }).catch(() => { sfxAudio.end.muted = false; });
    sfxAudio.start.play().catch(() => {});
    keepAlive = new Audio(silentWav()); keepAlive.loop = true; keepAlive.volume = 0.02; keepAlive.play().catch(() => {});
    if ("mediaSession" in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: "Практика", artist: "Arcana Zen" }); navigator.mediaSession.playbackState = "playing"; }
  } catch {}
  prLoadEnd().then(() => { const r = state.pr.run; if (r && !r.paused) prScheduleEnd(r.endAt - Date.now()); });
}
function prSoundsStop() { prCancelEnd(); try { sfxAudio.start?.pause(); sfxAudio.end?.pause(); keepAlive?.pause(); if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none"; } catch {} }
// Звук окончания: если расписанная чаша уже играет (аудиочасы), второй раз не включаем
function prChime() {
  try { sfxAudio.start?.pause(); keepAlive?.pause(); } catch {}
  const ac = state.pr.ac;
  if (endNode && ac && ac.state === "running" && ac.currentTime >= endAt - 0.3) { endNode = null; return; }
  prCancelEnd();
  try { const a = sfxAudio.end; if (!a) throw 0; a.currentTime = 0; a.play().catch(prChimeFallback); } catch { prChimeFallback(); }
}
function prStart(id, min) {
  try { const C = window.AudioContext || window.webkitAudioContext; if (C && !state.pr.ac) state.pr.ac = new C(); state.pr.ac?.resume?.(); } catch {}
  prSoundsPrepare(min * 60000);
  try { navigator.wakeLock?.request("screen").then((l) => { prLock = l; }).catch(() => {}); } catch {}
  const now = Date.now();
  state.pr.run = { id, totalMs: min * 60000, endAt: now + min * 60000, paused: false, left: min * 60000 };
  state.pr.done = null;
  clearInterval(prTimer); prTimer = setInterval(prTick, 250);
  renderPractices();
}
function prPause() {
  const r = state.pr.run; if (!r) return;
  if (r.paused) { r.endAt = Date.now() + r.left; r.paused = false; prScheduleEnd(r.left); try { keepAlive?.play(); } catch {} }
  else { r.left = r.endAt - Date.now(); r.paused = true; prCancelEnd(); try { keepAlive?.pause(); } catch {} }
  renderPractices();
}
function prTick() {
  const r = state.pr.run; if (!r || r.paused) return;
  r.left = r.endAt - Date.now();
  const c = document.getElementById("pr-clock"); if (c) c.textContent = fmtClock(r.left);
  const bar = document.getElementById("pr-bar"); if (bar) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, 1 - r.left / r.totalMs))})`;
  if (r.left <= 0) prFinish(true);
}
// Вернулись на вкладку (экран разблокирован): сразу догоняем таймер, чтобы не ждать следующего тика
document.addEventListener("visibilitychange", () => { if (!document.hidden) { prTick(); if (state.pr.run) try { navigator.wakeLock?.request("screen").then((l) => { prLock = l; }).catch(() => {}); } catch {} } });
function prFinish(complete) {
  const r = state.pr.run; if (!r) return;
  clearInterval(prTimer); try { prLock?.release?.(); } catch {} prLock = null;
  const sec = complete ? r.totalMs / 1000 : (r.totalMs - Math.max(0, r.left)) / 1000;
  state.pr.run = null; if (!complete) prSoundsStop();
  if (complete || sec >= 30) { addEntry({ t: Date.now(), id: r.id, sec }); state.pr.done = { id: r.id, sec, complete }; if (complete) { prChime(); try { navigator.vibrate?.([200, 120, 200]); } catch {} } }
  if (location.hash === "#practices") renderPractices();
}
const prIcon = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2"/><path d="M8 4.5v3.8l2.4 1.4"/></svg>`;

function practicesHtml() {
  const pr = state.pr, log = readLog(), st = stats(log);
  if (pr.run) {
    const p = practiceById(PR, pr.run.id);
    return `<section class="pr-run" aria-live="polite">
      <p class="eyebrow">${esc(p.name)}</p>
      <div class="pr-clock" id="pr-clock">${fmtClock(pr.run.left)}</div>
      <div class="pr-track" aria-hidden="true"><i id="pr-bar" style="transform:scaleX(${Math.max(0, 1 - pr.run.left / pr.run.totalMs)})"></i></div>
      <p class="pr-cue">${esc(p.steps[0])}</p>
      <div class="actions"><button type="button" class="btn ghost" data-pr-pause>${pr.run.paused ? "Продолжить" : "Пауза"}</button><button type="button" class="btn ghost" data-pr-stop>Завершить</button></div>
    </section>`;
  }
  if (pr.done) {
    const p = practiceById(PR, pr.done.id);
    return `<section class="pr-done">
      <p class="eyebrow">${esc(p.name)}</p>
      <h1>${pr.done.complete ? "Практика завершена" : "Практика остановлена"} · ${esc(fmtMinutes(pr.done.sec))}</h1>
      <p class="prose">Можно ещё немного посидеть в тишине. Спешить некуда.</p>
      <div class="actions"><button type="button" class="btn" data-pr-again>${pr.from === "ask" ? "К практикам" : "Ещё одна практика"}</button>${pr.from === "ask" ? `<button type="button" class="btn ghost" data-pr-back>Вернуться к раскладу</button>` : ""}</div>
    </section>`;
  }
  const ph = phraseOfDay(PR.phrases), sn = LUNAR ? lunarSnap() : null, info = sn ? lunarDay(LUNAR, sn.day) : null;
  const card = (p) => {
    const open = pr.open === p.id;
    return `<article class="pr-card${open ? " is-open" : ""}"><button type="button" class="pr-head" data-pr-open="${p.id}" aria-expanded="${open}"><span class="pr-name">${esc(p.name)}</span><span class="pr-sum">${esc(p.summary)}</span></button>
      ${open ? `<div class="pr-body">${p.mantra ? `<p class="pr-mantra"><b>${esc(p.mantra.text)}</b><span>${esc(p.mantra.gloss)}</span></p>` : ""}<ol class="pr-steps">${p.steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p class="pr-trad">${esc(p.tradition)}</p><div class="actions"><button type="button" class="btn" data-pr-go="${p.id}">Начать · ${pr.min} мин</button></div></div>` : ""}</article>`;
  };
  const recent = log.slice(-5).reverse().map((e) => { const p = practiceById(PR, e.id); return `<li><span>${esc(new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(e.t))}</span><span>${esc(p ? p.name : e.id)}</span><span>${esc(fmtMinutes(e.sec))}</span></li>`; }).join("");
  return `<section class="pr-page">
    <p class="eyebrow">Практики</p>
    <h1>Несколько минут тишины</h1>
    <p class="prose">Короткие созерцательные практики на каждый день. Без аккаунта, без ИИ, история хранится только на этом устройстве.</p>
    <div class="pr-essay">${ABOUT.practices_intro.p.map((t) => `<p class="prose">${esc(t)}</p>`).join("")}<blockquote class="quote">${esc(ABOUT.practices_intro.quote)}</blockquote></div>
    <div class="pr-phrase"><span class="pr-ph-label">Фраза дня</span><p class="pr-ph-text">${esc(ph.text)}</p><p class="pr-ph-gloss">${esc(ph.gloss)}</p><p class="pr-ph-src">${esc(PR.themes[ph.theme])} · ${esc(ph.source)}</p></div>
    <div class="pr-stats"><div><span>Сегодня</span><b>${esc(fmtMinutes(st.todaySec))}</b></div><div><span>За неделю</span><b>${esc(fmtMinutes(st.weekSec))}</b></div></div>
    <div class="pr-mins" role="group" aria-label="Длительность">${PR.durations.map((m) => `<button type="button" data-pr-min="${m}" aria-pressed="${m === pr.min}">${m} мин</button>`).join("")}</div>
    ${info ? `<div class="pr-lunar"><span class="l-label">Практика лунного дня · ${sn.day}-е сутки, ${esc(info.symbol)} <em class="l-trad">традиционная рекомендация</em></span><p>${esc(info.spiritual_practice.text)}</p><div class="l-pr-btns">${info.spiritual_practice.practice.map((id) => `<button type="button" class="pr-mini" data-pr-pick="${id}|${info.spiritual_practice.minutes}">${esc(practiceById(PR, id).name)} · ${info.spiritual_practice.minutes} мин</button>`).join("")}</div></div>` : ""}
    <div class="pr-list">${PR.practices.map(card).join("")}</div>
    ${recent ? `<div class="pr-hist"><span class="l-label">Последние практики</span><ul>${recent}</ul><button type="button" class="pr-clear" data-pr-clear>Очистить историю</button></div>` : ""}
    <p class="l-foot">Практики короткие светские формы известных созерцательных техник. Они не лечение и не терапия; если тебе тяжело, обратись к специалисту.</p>
  </section>`;
}
function onPracticesClick(e) {
  const pr = state.pr, t = (sel) => e.target.closest(sel);
  let el;
  if ((el = t("[data-pr-min]"))) { pr.min = Number(el.dataset.prMin); renderPractices(); return; }
  if ((el = t("[data-pr-open]"))) { pr.open = pr.open === el.dataset.prOpen ? null : el.dataset.prOpen; renderPractices(); return; }
  if ((el = t("[data-pr-pick]"))) { const [id, m] = el.dataset.prPick.split("|"); pr.open = id; pr.min = Number(m); renderPractices(); document.querySelector(".pr-card.is-open")?.scrollIntoView({ block: "center", behavior: "smooth" }); return; }
  if ((el = t("[data-pr-go]"))) { prStart(el.dataset.prGo, pr.min); return; }
  if (t("[data-pr-pause]")) { prPause(); return; }
  if (t("[data-pr-stop]")) { prFinish(false); if (!state.pr.done) renderPractices(); return; }
  if (t("[data-pr-again]")) { pr.done = null; pr.from = null; renderPractices(); return; }
  if (t("[data-pr-back]")) { pr.done = null; pr.from = null; location.hash = "ask"; return; }
  if (t("[data-pr-clear]")) { if (confirm("Удалить историю практик на этом устройстве?")) { clearLog(); renderPractices(); } }
}
function renderPractices() {
  $app.removeEventListener("click", onPracticesClick);
  setWorld(null, null);
  $app.innerHTML = practicesHtml();
  $app.addEventListener("click", onPracticesClick);
}

// ---------- о проекте ----------

function renderAbout() {
  const A = ABOUT, sec = (id) => A.sections.find((x) => x.id === id);
  // «[1]» в тексте становится ссылкой-сноской на научные источники
  const rich = (t) => esc(t).replace(/\[(\d)\]/g, '<sup><a href="#refs" class="about-ref" data-ref-link>$1</a></sup>');
  const head = (x) => `<header class="about-h"><h2>${esc(x.h)}</h2>${x.sub ? `<span>${esc(x.sub)}</span>` : ""}</header>`;
  const paras = (x) => (x.p || []).map((t) => `<p class="prose">${rich(t)}</p>`).join("");
  const pillars = (x) => x.pillars ? `<ol class="about-pillars">${x.pillars.map((p) => `<li><h3>${esc(p.h)}</h3><p>${rich(p.t)}</p></li>`).join("")}</ol>` : "";
  const block = (id, extra = "") => { const x = sec(id); return `<div class="about-sec" id="about-${id}">${head(x)}${x.quote ? `<blockquote class="quote">${esc(x.quote)}</blockquote>` : ""}${paras(x)}${pillars(x)}${x.after ? `<p class="prose">${rich(x.after)}</p>` : ""}${extra}</div>`; };
  const R = A.science_refs;
  setWorld(null, null);
  $app.innerHTML = `<section class="about">
    <header class="about-top"><p class="eyebrow">О проекте</p><h1>${esc(A.title)}</h1><p class="about-lead">${esc(A.lead)}</p></header>
    ${block("what")}${block("science")}${block("decks")}
    ${block("read", `<ol class="about-flow">${A.flow.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><p class="prose">${esc(A.flow_note)}</p>`)}
    ${block("moon")}${block("privacy")}
    <div class="about-sec">${head(sec("sources"))}
      <div class="about-src">${A.sources.map((g) => `<div><h3>${esc(g.deck)}</h3><ul>${g.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
      <div class="about-refs" id="refs"><h3>${esc(R.h)}</h3><p class="about-refs-sub">${esc(R.sub)}</p><ol>${R.items.map((r) => `<li value="${r.n}">${esc(r.t)}</li>`).join("")}</ol><p class="about-refs-note">${esc(R.note)}</p></div>
      <p class="prose about-method">${esc(A.method)}</p></div>
    <div class="about-sec" id="about-author"><header class="about-h"><h2>${esc(A.author.h)}</h2></header>
      ${A.author.p.map((parts) => `<p class="prose">${parts.map((x) => x.a ? `<a class="ext" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${esc(x.a)}</a>` : esc(x.t)).join("")}</p>`).join("")}</div>
    <div class="about-sec" id="about-sessions"><header class="about-h"><h2>${esc(A.sessions.h)}</h2></header>
      <p class="prose">${esc(A.sessions.p)}</p>
      <ul class="about-links">${A.sessions.links.map((l) => `<li>${esc(l.label)} <a class="ext" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.a)}</a>${l.note ? ` <span>(${esc(l.note)})</span>` : ""}</li>`).join("")}</ul></div>
    <p class="l-foot">${esc(A.footer)}</p>
  </section>`;
  $app.querySelectorAll("[data-ref-link]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById("refs")?.scrollIntoView({ behavior: "smooth", block: "center" }); }));
}

// ---------- экран: вопрос ----------

function spreadsHtml() {
  const recs = recommendSpreads(state.story, 36, { adult: adultMode() });
  const sel = currentSpread();
  setWorld(state.theme || state.spreadId || state.story.trim() ? sel : null, state.theme);
  const because = Object.fromEntries(recs.map((r) => [r.spread.id, r.because]));
  // Тема выбрана — все 6 раскладов темы (подходящие к ситуации — первыми); не выбрана — 3 рекомендации
  let list = state.theme
    ? shown().filter((s) => s.theme === state.theme).sort((a, b) => (because[b.id]?.length ? 1 : 0) - (because[a.id]?.length ? 1 : 0))
    : recs.slice(0, 3).map((r) => r.spread);
  if (!list.length) list = [sel];
  if (!list.some((s) => s.id === sel.id)) list = [sel, ...list.slice(0, 2)];
  return `
    <div class="tabs" role="group" aria-label="Темы">
      ${THEME_TABS.map((th) => `<button type="button" data-theme-pick="${esc(th)}" aria-pressed="${th === state.theme}">${esc(th)}</button>`).join("")}
    </div>
    ${!state.theme && !recs.length ? `<p class="hint">Выбери тему или опиши ситуацию — Arcana предложит подходящие расклады.</p>` : ""}
    <div class="choice" role="group" aria-label="Расклады">
      ${list.map((s) => `<button type="button" class="option" data-spread="${s.id}" aria-pressed="${s.id === sel.id}">
        <span class="t">${esc(s.name)}${s.adult ? ' <small class="badge-adult">18+</small>' : ""}</span>
        <span class="why">${because[s.id]?.length ? "Подходит: " + esc(because[s.id].join(", ")) : esc(s.when)}</span></button>`).join("")}
    </div>
    <ol class="spread-positions">${sel.positions.map((p, i) => `<li><span>${i + 1}</span>${esc(p.name)}</li>`).join("")}</ol>
    <p class="hint"><a href="#spreads" class="link">Все расклады — ${shown().length}</a></p>`;
}

function slotsHtml() {
  const sel = currentSpread();
  if (state.mode === "draw") {
    const shown = state.drawn.slice(0, state.revealed);
    return `<ul class="slots draw-slots" aria-live="polite">${sel.positions.slice(0, 3).map((p, i) => {
      const d = shown[i], pos = esc(p.name);
      if (!d) return `<li class="slot is-empty"><span class="n">${i + 1}</span>${pos}<strong>—</strong></li>`;
      const mc = miniCard(d.id);
      return `<li class="slot is-drawn${i === state.newSlot ? " is-new" : ""}"><span class="n">${i + 1}</span>${pos}<strong>${esc(mc.name)}${d.reversed ? " · перевёрнута" : ""}</strong>${ART[d.id] ? `<span class="thumb${d.reversed ? " is-reversed" : ""}">${ART[d.id]}</span>` : ""}</li>`;
    }).join("")}</ul>`;
  }
  const parsed = state.cardsText.trim() ? parseCards(state.cardsText, INDEXES[state.deck]) : [];
  const items = parsed.slice(0, 3);
  const extra = parsed.length > 3 ? `<p class="form-error">Распознано ${parsed.length} карт — в этом раскладе их три.</p>` : "";
  return `<ul class="slots" aria-live="polite">${[0, 1, 2].map((i) => {
    const r = items[i], pos = esc(sel.positions[i].name);
    if (!r) return `<li class="slot is-empty"><span class="n">${i + 1}</span>${pos}<strong>—</strong></li>`;
    if (r.options) return `<li class="slot"><span class="n">${i + 1}</span>${pos}<strong>«${esc(r.raw)}» — какая карта?</strong>
      <span class="ask">${r.options.map((o) => `<button type="button" data-resolve="${esc(r.raw)}" data-name="${esc(o.name)}">${esc(o.name)}</button>`).join("")}</span></li>`;
    if (r.error) return `<li class="slot is-error"><span class="n">${i + 1}</span>${pos}<strong>«${esc(r.raw)}»: ${esc(r.error)}</strong></li>`;
    return `<li class="slot"><span class="n">${i + 1}</span>${pos}<strong>${esc(r.name)}${r.reversed ? " · перев." : ""}</strong>${r.note ? `<span>${esc(r.note)}</span>` : ""}</li>`;
  }).join("")}</ul>${extra}`;
}

const deckSwitchHtml = () => `
    <div class="toggle" role="group" aria-label="Колода">
      ${["MANARA", "RWS"].map((d) => `<button type="button" data-deck="${d}" aria-pressed="${state.deck === d}"${deckReady(d) || d === "MANARA" ? "" : " disabled title=\"Колода в разработке\""}>${d === "MANARA" ? "Манара" : "Райдер–Уэйт"}</button>`).join("")}
    </div>`;

function cardsBoxHtml() {
  const drawn = state.drawn.length > 0;
  return `
    <div class="toggle" role="group" aria-label="Способ ввода карт">
      <button type="button" data-mode="manual" aria-pressed="${state.mode === "manual"}">Ввести карты</button>
      <button type="button" data-mode="draw" aria-pressed="${state.mode === "draw"}">Вытянуть карты самому</button>
    </div>
    ${state.mode === "manual" ? `
      <label for="cards">Карты, которые ты вытянула</label>
      <input id="cards" type="text" autocomplete="off" spellcheck="false" value="${esc(state.cardsText)}" placeholder="${state.deck === "RWS" ? "Отшельник Двойка Кубков Башня перев." : "Король Воздуха Луна 2 Воды перев."}">
      <p class="hint">Можно через запятую, через «/» или просто подряд. Перевёрнутую карту отметь словом «перев.»</p>` : `
      <p class="hint">Помедитируй и сосредоточься на вопросе. Колода перемешивается честно и случайно: выпадение карты не зависит ни от твоей темы, ни от вопроса, они влияют только на то, как карта потом читается. Расклад вытягивается один раз.</p>
      <div class="toggle toggle-sm" role="group" aria-label="Какие карты в колоде">
        <button type="button" data-scope="all" aria-pressed="${state.scope === "all"}"${drawn ? " disabled" : ""}>Все 78 карт</button>
        <button type="button" data-scope="major" aria-pressed="${state.scope === "major"}"${drawn ? " disabled" : ""}>Только Старшие арканы</button>
      </div>
      ${state.deck === "RWS" ? `<label class="check"><input type="checkbox" id="rev"${state.reversals ? " checked" : ""}${drawn ? " disabled" : ""}> Допускать перевёрнутые карты</label>` : `<p class="hint hint-sm">В Манаре карты всегда прямые: у этой колоды нет традиции перевёрнутых значений.</p>`}`}
    <div id="slots-box">${slotsHtml()}</div>
    ${state.mode === "draw" ? `<div id="fan-box">${fanHtml()}</div>` : ""}`;
}

// ---- веер рубашек: карты «выглядывают» из линии; игрок сам выбирает по наитию (расклад колоды уже случайно перемешан) ----
function fanHtml() {
  if (state.quick) return "";
  const n = currentSpread().positions.length;
  if (!state.fan && !state.drawn.length) {
    const pool = drawPool();
    state.fan = { cards: dealFan({ deck: state.deck, count: FAN_SIZE, reversals: state.deck === "RWS" && state.reversals, pool }), picked: [] };
  }
  const f = state.fan; if (!f) return "";
  const done = f.picked.length >= n;
  return `<div class="fan-wrap${done ? " is-done" : ""}" data-fan-deck="${state.deck}">
    <p class="fan-note" id="fan-note" aria-live="polite">${done ? "Карты выбраны. Можно читать расклад." : f.picked.length ? `Выбрано ${f.picked.length} из ${n}. Тянись к следующей.` : "Потяни ту карту, к которой тянет. Не думай, просто почувствуй."}</p>
    <div class="fan" role="group" aria-label="Колода рубашками вверх">${f.cards.map((_, j) => `<button type="button" class="fan-card${f.picked.includes(j) ? " is-gone" : ""}" data-fan="${j}" aria-label="Карта ${j + 1} из ${f.cards.length}"${f.picked.includes(j) || done ? " tabindex=\"-1\"" : ""}></button>`).join("")}</div>
    <div class="fan-line" aria-hidden="true"></div>
  </div>`;
}
function pickFan(btn) {
  const f = state.fan, spread = currentSpread(), n = spread.positions.length, j = Number(btn.dataset.fan);
  if (!f || f.picked.includes(j) || f.picked.length >= n) return;
  state.spreadId = spread.id; state.drawSpread = spread.id; state.error = "";
  f.picked.push(j);
  state.drawn = f.picked.map((i) => f.cards[i]); state.revealed = state.drawn.length; state.newSlot = f.picked.length - 1;
  btn.classList.add("is-gone"); btn.tabIndex = -1;
  const slots = document.getElementById("slots-box"); if (slots) slots.innerHTML = slotsHtml();
  const wrap = document.querySelector(".fan-wrap"), note = document.getElementById("fan-note"), done = f.picked.length >= n;
  wrap?.classList.toggle("is-done", done);
  if (note) note.textContent = done ? "Карты выбраны. Можно читать расклад." : `Выбрано ${f.picked.length} из ${n}. Тянись к следующей.`;
  document.getElementById("rev")?.setAttribute("disabled", "");
  document.querySelectorAll("[data-scope]").forEach((b) => b.setAttribute("disabled", ""));
  setTimeout(() => { state.newSlot = -1; }, 800);
}


function renderAsk() {
  $app.innerHTML = `
  <section class="column" aria-labelledby="ask-title">
    <div id="lunar-box">${lunarHtml()}</div>
    <div class="ask-main"${LUNAR && lunarSnap() && isWarningDay(LUNAR, lunarSnap().day) && state.lunar.postponed ? " hidden" : ""}>
    <div class="intro">
      <p class="eyebrow">${state.deck === "RWS" ? "Таро Райдера–Уэйта" : "Таро Манара"} · три карты</p>
      <h1 id="ask-title">Расскажи, о чём ты хочешь спросить</h1>
      <p class="lede">Карты тянешь ты. Arcana читает их через твою ситуацию: по позициям, в связке друг с другом, без предсказаний.</p>
    </div>

    <div class="field situation">
      <label for="story">Твоя ситуация</label>
      <textarea id="story" class="story" rows="4" placeholder="${esc(storyExample())}">${esc(state.story)}</textarea>
    </div>

    <div class="field">
      <span class="label">Расклад</span>
      <div id="spreads-box">${spreadsHtml()}</div>
    </div>

    <div class="field">
      <span class="label">Колода</span>
      <div id="deck-box">${deckSwitchHtml()}</div>
    </div>

    <div class="field" id="cards-box">${cardsBoxHtml()}</div>

    ${state.error ? `<p class="form-error" role="alert">${esc(state.error)}</p>` : ""}
    <div class="actions">
      <button type="button" class="btn" id="go">Прочитать расклад</button>
      <button type="button" class="link" id="example">Подставить пример</button>
    </div>
    </div>
  </section>`;

  const story = document.getElementById("story");
  let t;
  story.addEventListener("input", () => {
    state.story = story.value;
    clearTimeout(t);
    t = setTimeout(() => {
      // пользователь мог уже уйти на другой экран — тогда обновлять нечего
      const box = document.getElementById("spreads-box"), slots = document.getElementById("slots-box");
      if (!box || !slots) return;
      box.innerHTML = spreadsHtml(); slots.innerHTML = slotsHtml();
    }, 250);
  });
  bindCards();
  $app.removeEventListener("click", onAskClick);
  $app.addEventListener("click", onAskClick);
  document.getElementById("go").addEventListener("click", submit);
  clearInterval(lunarTimer); lunarTimer = setInterval(refreshLunar, 60000);      // сутки и время до перехода обновляются раз в минуту
  clearInterval(exampleTimer);
  exampleTimer = setInterval(() => {
    const el = document.getElementById("story");
    if (!el) return clearInterval(exampleTimer);
    if (!el.value && document.activeElement !== el) { exampleTick++; el.placeholder = storyExample(); }
  }, 7000);
  document.getElementById("example").addEventListener("click", () => { Object.assign(state, EXAMPLE, { error: "" }); renderAsk(); });
}

function bindCards() {
  const cards = document.getElementById("cards");
  cards?.addEventListener("input", () => { state.cardsText = cards.value; document.getElementById("slots-box").innerHTML = slotsHtml(); });
  cards?.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  document.getElementById("rev")?.addEventListener("change", (e) => { state.reversals = e.target.checked; state.fan = null; const fb = document.getElementById("fan-box"); if (fb) fb.innerHTML = fanHtml(); });
}
const refreshCards = () => { const box = document.getElementById("cards-box"); if (box) { box.innerHTML = cardsBoxHtml(); bindCards(); } };

function onAskClick(e) {
  if (onLunarClick(e)) return;
  const dk = e.target.closest("[data-deck]");
  if (dk && !dk.disabled) {
    if (state.deck !== dk.dataset.deck) { state.deck = dk.dataset.deck; state.cardsText = ""; resetDraw(); }
    document.getElementById("deck-box").innerHTML = deckSwitchHtml(); refreshCards();
    document.querySelector("#ask-title")?.previousElementSibling && (document.querySelector(".intro .eyebrow").textContent = `${state.deck === "RWS" ? "Таро Райдера–Уэйта" : "Таро Манара"} · три карты`);
    return;
  }
  const fc = e.target.closest("[data-fan]");
  if (fc) { pickFan(fc); return; }
  const sc = e.target.closest("[data-scope]");
  if (sc && !sc.disabled) { if (state.scope !== sc.dataset.scope) { state.scope = sc.dataset.scope; resetDraw(); } refreshCards(); return; }
  const md = e.target.closest("[data-mode]");
  if (md) { if (state.mode !== md.dataset.mode) { state.mode = md.dataset.mode; resetDraw(); } refreshCards(); return; }
  const th = e.target.closest("[data-theme-pick]");
  if (th) {
    state.theme = state.theme === th.dataset.themePick ? null : th.dataset.themePick;
    state.spreadId = null; exampleTick = 0; resetDraw();
    document.getElementById("spreads-box").innerHTML = spreadsHtml();
    refreshCards();
    document.getElementById("story").placeholder = storyExample();
    return;
  }
  const sp = e.target.closest("[data-spread]");
  if (sp) { if (state.spreadId !== sp.dataset.spread) resetDraw(); state.spreadId = sp.dataset.spread; document.getElementById("spreads-box").innerHTML = spreadsHtml(); refreshCards(); return; }
  const res = e.target.closest("[data-resolve]");
  if (res) {
    // Уточнение пользователя: заменяем неоднозначный фрагмент на выбранное название
    const raw = res.dataset.resolve, name = res.dataset.name;
    const re = new RegExp(`(^|[\\s,;/])${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[\\s,;/])`, "i");
    state.cardsText = state.cardsText.replace(re, (m, pre) => `${pre}${name}`);
    document.getElementById("cards").value = state.cardsText;
    document.getElementById("slots-box").innerHTML = slotsHtml();
  }
}

function submit() {
  const spread = currentSpread();
  const drawMode = state.mode === "draw";
  const parsed = drawMode ? state.drawn.map((d) => ({ id: d.id, reversed: d.reversed })) : parseCards(state.cardsText, INDEXES[state.deck]);
  const ask = parsed.find((p) => p.options), bad = parsed.find((p) => p.error);
  if (!state.story.trim()) return fail("Расскажи о ситуации хотя бы одним предложением — с ним толкование будет точнее.");
  if (drawMode && !state.drawn.length) return fail("Сначала вытяни карты.");
  if (drawMode && state.revealed < state.drawn.length) return fail("Карты ещё выходят — подожди секунду.");
  if (drawMode && state.drawSpread !== spread.id) return fail("Расклад изменился после вытяжки — вытяни карты заново.");
  if (ask) return fail(`Уточни карту «${ask.raw}» — выбери вариант под полем.`);
  if (bad) return fail(`«${bad.raw}»: ${bad.error}`);
  if (parsed.length !== 3) return fail(`Нужно три карты, сейчас распознано ${parsed.length}.`);
  if (new Set(parsed.map((p) => p.id)).size < 3) return fail("Одна и та же карта указана дважды — проверь список.");
  state.error = "";
  playReadSound();                     // единственный звук в приложении — на «Прочитать расклад»
  state.spreadId = spread.id;
  state.result = reading({ spreadId: spread.id, question: state.story.trim(), cards: parsed.map((p) => ({ id: p.id, reversed: p.reversed })) });
  state.view = "both";
  location.hash = "reading";
}
function fail(msg) { state.error = msg; renderAsk(); document.querySelector(".form-error[role=alert]")?.scrollIntoView({ block: "center" }); }

// ---------- экран: все расклады ----------

function renderSpreads() {
  setWorld(null, state.themeTab);
  $app.innerHTML = `
  <section aria-labelledby="sp-title" style="display:grid;gap:var(--space-4)">
    <div class="intro">
      <p class="eyebrow">${shown().length} раскладов · три карты</p>
      <h1 id="sp-title">Расклады</h1>
      <p class="lede">Позиции в каждом раскладе разные, поэтому одна и та же карта в них звучит по-разному.</p>
    </div>
    <div class="tabs" role="group" aria-label="Темы">
      ${THEME_TABS.map((th) => `<button type="button" data-tab="${esc(th)}" aria-pressed="${th === state.themeTab}">${esc(th)}</button>`).join("")}
    </div>
    <div class="spread-list">
      ${(() => {
        const card = (s) => `<article class="spread-item">
        <h3>${esc(s.name)}${s.adult ? ' <small class="badge-adult">18+</small>' : ""}</h3>
        <p>${esc(s.when)}</p>
        <ol>${s.positions.map((p) => `<li>${esc(p.name)}</li>`).join("")}</ol>
        <button type="button" class="btn ghost" data-pick="${s.id}">Выбрать</button>
      </article>`;
        const all = shown().filter((s) => s.theme === state.themeTab);
        const adult = all.filter((s) => s.adult);
        return all.filter((s) => !s.adult).map(card).join("") + (adult.length ? `<p class="eyebrow adult-head">Ночная тушь · 18+</p>${adult.map(card).join("")}` : "");
      })()}
    </div>
  </section>`;
  $app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { state.themeTab = b.dataset.tab; renderSpreads(); }));
  $app.querySelectorAll("[data-pick]").forEach((b) => b.addEventListener("click", () => { state.spreadId = b.dataset.pick; state.theme = spreadById(b.dataset.pick).theme; location.hash = "ask"; }));
}

// ---------- экран: расклад ----------

function renderReading() {
  const r = state.result;
  if (!r) { location.hash = "ask"; return; }
  setWorld(r.spread);
  const s = r.synthesis, sc = r.screen;
  const q = r.quint.find((x) => x.key === "banzhaf");
  const others = r.quint.filter((x) => x.key !== "banzhaf");
  const courts = r.cards.filter((c) => c.court).length;
  const weak = courts >= 2 || q?.caveat;
  $app.innerHTML = `
  <article class="column" aria-labelledby="r-title">
    <header class="reading-head">
      <p class="eyebrow" id="r-title">${esc(r.spread.name)} · ${esc(DECKS[r.deck].label)}</p>
      <p class="question">${esc(r.question)}</p>
      <p class="meta">${r.context.length ? `<span>Arcana слышит:</span>${r.context.slice(0, 4).map((t) => `<span class="tag-rect">${esc(t.label)}</span>`).join("")}` : "<span>Контекст не распознан — расклад читается по позициям.</span>"}</p>
    </header>

    <div class="exhibits">
      ${r.cards.map((c, i) => `<div class="exhibit"><div class="pos">${esc(r.positions[i].name)}</div>${plate(c)}${c.reversed ? '<span class="tag">перевёрнута</span>' : ""}</div>`).join("")}
    </div>

    <section class="section overview" aria-labelledby="ov-title">
      <p class="eyebrow" id="ov-title">Общая картина</p>
      <p class="chain-line">${esc(s.comparison.chain)}</p>
      ${s.safetyNote ? `<p class="safety-note" role="note">${esc(s.safetyNote)}</p>` : ""}
      <p class="conclusion"><span class="label">Главный инсайт расклада</span>${esc(sc.insight)}</p>
      ${sc.projection ? `<p class="aside-note projection"><b>Как читать карты в этой теме.</b> ${esc(sc.projection)}</p>` : ""}
      <div class="quint-block">
      <p class="eyebrow">Квинтэссенция · главный урок ситуации</p>
      ${q?.cardId ? `<div class="quint"><span class="numeral">${ROMAN[q.result === 22 ? 0 : q.result]}</span>
        <div><h3>${esc(q.card)}</h3><p class="aside-note">По методу Банцхафа: ${esc(q.calculation)}. Придворные считаются за 0, Шут — за 22.</p></div></div>
        ${sc.lesson?.weak ? `<p class="weak">${esc(sc.lesson.weak)}</p>` : ""}
        <div class="lesson">${(sc.lesson?.paragraphs ?? []).map((t) => `<p class="prose">${esc(t)}</p>`).join("")}</div>`
        : `<p class="prose">Не рассчитывается: ${esc(q?.note)}</p>`}
      <details><summary>Другие способы расчёта</summary>
        ${others.map((o) => `<p>${esc(o.method)}: ${o.cardId ? `${esc(o.calculation)} → ${esc(o.card)}` : esc(o.note)}</p>`).join("")}
        <p>Единого правильного метода нет: школы считают по-разному.</p></details>
      </div>
      <div class="flow"><p class="eyebrow">Как карты складываются в одну историю</p>
        <p class="prose">${esc(sc.flow)}</p>
        ${sc.synergy ? `<p class="prose">${esc(sc.synergy)}</p>` : ""}</div>
      ${sc.lensQuestion ? `<p class="aside-note lens-q">${esc(sc.lensQuestion)}</p>` : ""}
      <div class="pair">
        <div><p class="eyebrow">Вопрос для размышления</p><blockquote>${esc(sc.question)}</blockquote>
          ${sc.cardQuestion ? `<p class="aside-note">И вопрос от карты: ${esc(sc.cardQuestion)}</p>` : ""}</div>
        <div><p class="eyebrow">Твой практический шаг</p><blockquote>${esc(sc.action)}</blockquote></div>
      </div>
    </section>

    <section class="section details-head">
      <p class="eyebrow">Подробнее по каждой карте</p>
    </section>

    ${sc.cards.map((d, i) => `<section class="position-reading card-detail">
      <h3><small>${i + 1} · ${esc(d.pos)}</small>${esc(d.name)} <span class="state">(${d.state})</span></h3>
      ${d.strength || d.shadow ? `<div class="quick">${d.strength ? `<p><b>В силе</b> ${esc(d.strength)}</p>` : ""}${d.shadow ? `<p><b>В тени</b> ${esc(d.shadow)}</p>` : ""}</div>` : ""}
      <div class="layer scene-text"><span class="label">Что на карте</span><p>${esc(d.visual)}</p></div>
      <div class="layer"><span class="label">Психологический разбор</span><p class="prose">${esc(d.analysis || "Для этой позиции у карты пока нет текста.")}</p></div>
      ${d.doNow ? `<div class="layer"><span class="label">Что сделать сейчас</span><p class="prose">${esc(d.doNow)}</p></div>` : ""}
      ${d.reversedNote ? `<p class="aside-note">${esc(d.reversedNote)}</p>` : ""}
      <details><summary>Традиционное значение</summary><p>${esc(d.traditional)}</p><p>${r.deck === "RWS" ? "Свободный пересказ традиции Райдера–Уэйта–Смит (Уэйт, 1910, и общая практика); формулировки книг не цитируются." : "Русский базовый текст по колоде Манара."}</p></details>
    </section>`).join("")}

    <section class="section handoff">
      <p class="eyebrow">Углубить в чате</p>
      <p class="aside-note">Соберём весь расклад в один текст. Вставь его в ChatGPT, Claude или Gemini, чтобы продолжить разговор с того же места.</p>
      <div class="actions"><button type="button" class="btn ghost" id="mk-prompt">Собрать текст для чата</button></div>
      <div id="handoff-box" hidden>
        <label for="handoff-text" class="eyebrow">Текст для чата</label>
        <textarea id="handoff-text" readonly></textarea>
        <div class="actions">
          <button type="button" class="btn" id="copy">Скопировать</button>
          <a class="link" href="https://chatgpt.com/" target="_blank" rel="noopener">ChatGPT</a>
          <a class="link" href="https://claude.ai/new" target="_blank" rel="noopener">Claude</a>
          <a class="link" href="https://gemini.google.com/app" target="_blank" rel="noopener">Gemini</a>
          <span class="status" id="copy-status" aria-live="polite"></span>
        </div>
      </div>
    </section>

    ${matrixNoteForReading(mxCtx, r.cards)}
    <p class="footnote">Карты — один из взглядов на ситуацию, а не прогноз и не основание для решения. «Что на карте» — описание изображения; «В этой позиции» и «В твоём вопросе» — синтез Arcana на основе источников по колоде ${r.deck === "RWS" ? "Райдера–Уэйта–Смит" : "Манара"}.</p>
    <div class="actions"><button type="button" class="btn ghost" id="again">Новый расклад</button></div>
  </article>`;

  document.getElementById("mk-prompt").addEventListener("click", () => {
    document.getElementById("handoff-text").value = buildHandoffPrompt(r);
    document.getElementById("handoff-box").hidden = false;
  });
  document.getElementById("copy").addEventListener("click", () => {
    const ta = document.getElementById("handoff-text"), st = document.getElementById("copy-status");
    const manual = () => { ta.focus(); ta.select(); st.textContent = "Текст выделен — скопируй его вручную"; };
    if (!navigator.clipboard) return manual();
    navigator.clipboard.writeText(ta.value).then(() => { st.textContent = "Скопировано"; }).catch(manual);
  });
  document.getElementById("again").addEventListener("click", () => { state.cardsText = ""; state.result = null; location.hash = "ask"; });
}

// ---------- маршрутизация ----------

let askDebounce = 0;
function route() {
  const [view, mxSub, mxArg] = (location.hash.replace("#", "") || "ask").split("/");
  if ($app._mx) { $app.removeEventListener("click", $app._mx.click); $app.removeEventListener("input", $app._mx.input); $app.removeEventListener("keydown", $app._mx.key); $app._mx = null; }
  document.querySelectorAll(".nav a").forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === "#" + view ? "page" : "false"));
  $app.removeEventListener("click", onAskClick); $app.removeEventListener("click", onPracticesClick);
  if (view === "matrix") renderMatrixPage(mxCtx, mxSub || "me", mxArg || "");
  else if (view === "practices") renderPractices();
  else if (view === "about") renderAbout();
  else if (view === "spreads") renderSpreads();
  else if (view === "reading") renderReading();
  else renderAsk();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();
const petals = initPetals(document.getElementById("petal-canvas"));
// шлейф у курсора — на странице «Все расклады»; на остальных экранах курсор только мягко отдувает падающие лепестки
const syncTrail = () => petals.setTrail(location.hash === "#spreads");
window.addEventListener("hashchange", syncTrail);
syncTrail();

