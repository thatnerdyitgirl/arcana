// Раздел «Матрица»: интерфейс. Всё считается локально; дата рождения хранится только на этом устройстве (localStorage).
import { parseBirth, fmtBirth, calcMatrix, matrixEnergies, coreEnergies, MATRIX_METHOD_NAME } from "../engine/matrix.mjs";
import { makeMatrixText, FIELD_LABEL } from "../engine/matrix_text.mjs";

const MX_KEY = "arcana-matrix-me";
const MX_ICON = {
  mirror: `<ellipse cx="12" cy="10" rx="6" ry="7.5"/><path d="M12 17.5V22M8.5 22h7"/>`,
  flame: `<path d="M12 3c3.5 4 5 6.5 5 9.5A5 5 0 0 1 12 17.5a5 5 0 0 1-5-5C7 9.5 8.5 7 12 3Z"/><path d="M12 21v-3.5"/>`,
  sprout: `<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6ZM12 15c0-3-2.5-5-6-5 0 3.5 2.5 5 6 5Z"/>`,
  heart: `<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>`,
  coin: `<circle cx="12" cy="12" r="8"/><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.7 2.5 1.7-1 1.4-2.5 1.7-2.5.7-2.5 1.7S10.5 15.5 12 15.5s2.5-.5 2.5-1.5"/>`,
  branch: `<path d="M12 21V8M12 14c-3 0-5-2-5-5M12 11c3 0 5-2 5-5M12 8c-1.5-1-2-2.5-2-4"/>`,
  moon: `<path d="M19 14.5A8 8 0 0 1 9.5 5 8 8 0 1 0 19 14.5Z"/>`,
  compass: `<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5Z"/>`,
};
const ico = (k) => `<svg class="mx-ico" viewBox="0 0 24 24" aria-hidden="true">${MX_ICON[k] ?? ""}</svg>`;
const ZONE_THEME = { self: "Саморазвитие", talents: "Саморазвитие", purpose: "Решения и перемены", relations: "Отношения", money: "Работа и бизнес", family: "Психология", shadows: "Психология", karma: "Психология", realization: "Решения и перемены", period: "Саморазвитие" };
const TOPIC_THEME = { relations: "Отношения", money: "Работа и бизнес", realization: "Решения и перемены", self: "Саморазвитие", talents: "Саморазвитие", period: "Саморазвитие" };
const TABS = [["me", "Моя Матрица"], ["now", "Что сейчас"], ["other", "Новый человек"], ["together", "Мы вместе"], ["guide", "Справочник"], ["ask", "Спросить Матрицу"]];

const MX_IND = "arcana-mx-ind";
const loadInd = () => { try { return JSON.parse(localStorage.getItem(MX_IND) || "{}") || {}; } catch { return {}; } };
const saveInd = () => { try { localStorage.setItem(MX_IND, JSON.stringify(S.ind)); } catch {} };
const loadBirth = () => { try { const v = JSON.parse(localStorage.getItem(MX_KEY) || "null"); return v && parseBirth(fmtBirth(v)).d ? v : null; } catch { return null; } };
const S = { gscope: null, ind: loadInd(), birth: loadBirth(), sel: null, zone: null, topic: null, other: { raw: "", name: "", err: "", res: null }, tog: { a: "", b: "", err: "", res: null }, q: "", guide: null, ask: null };
let T = null, KB = null, ctx = null;

// ---------- диаграмма ----------
const C = [210, 210];
const OUT = { A: [26, 210], B: [210, 26], V: [394, 210], G: [210, 394], E: [52, 52], Zh: [368, 52], Z: [368, 368], I: [52, 368] };
const CHAIN = { A: ["A", "L", "K"], B: ["B", "N", "M"], V: ["V", "P", "O"], G: ["G", "S", "R"], E: ["E", "Ts", "Kh"], Zh: ["Zh", "Sh", "Ch"], Z: ["Z", "Y", "Shch"], I: ["I", "Yu", "Eh"] };
const AGE_LABEL = { A: "0", E: "10", B: "20", Zh: "30", V: "40", Z: "50", G: "60", I: "70" };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function coords() {
  const P = { D: C };
  for (const [o, [k0, k1, k2]] of Object.entries(CHAIN)) { P[k0] = OUT[o]; P[k1] = lerp(C, OUT[o], 0.6); P[k2] = lerp(C, OUT[o], 0.34); }
  P.T = lerp(P.R, P.O, 0.5); P.U = lerp(P.R, P.T, 0.5); P.F = lerp(P.O, P.T, 0.5);
  return P;
}
function diagramSvg(mx, sel, hi = []) {
  const P = coords(), main = new Set(["A", "B", "V", "G", "E", "Zh", "Z", "I"]);
  const poly = (ks) => ks.map((k) => OUT[k].join(",")).join(" ");
  const lines = `<polygon class="mxd-sq" points="${poly(["A", "B", "V", "G"])}"/><polygon class="mxd-sq" points="${poly(["E", "Zh", "Z", "I"])}"/>
    <path class="mxd-ax" d="M${OUT.A} L${OUT.V} M${OUT.B} L${OUT.G} M${OUT.E} L${OUT.Z} M${OUT.Zh} L${OUT.I}"/>
    <path class="mxd-ln" d="M${P.R} L${P.T} L${P.O}"/>`;
  const ages = Object.entries(AGE_LABEL).map(([k, a]) => { const [x, y] = OUT[k], v = [x - C[0], y - C[1]], len = Math.hypot(...v), px = x + (v[0] / len) * 22, py = y + (v[1] / len) * 22; return `<text class="mxd-age" x="${px.toFixed(1)}" y="${(py + 3).toFixed(1)}" text-anchor="middle">${a}</text>`; }).join("");
  const dots = Object.entries(P).map(([k, [x, y]]) => {
    const n = T.value(mx, k), big = main.has(k), r = k === "D" ? 22 : big ? 17 : 11, cls = `mxd-pt${k === "D" ? " is-center" : ""}${big ? " is-main" : ""}${sel === k ? " is-sel" : ""}${hi.includes(k) ? " is-hi" : ""}`;
    return `<g class="${cls}" data-mx-point="${k}" tabindex="0" role="button" aria-label="${KB.positions[k]?.title ?? k}: ${T.en(n).name}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/><text x="${x.toFixed(1)}" y="${(y + (k === "D" ? 5 : big ? 4 : 3)).toFixed(1)}" text-anchor="middle" style="font-size:${k === "D" ? 14 : big ? 12 : 9.5}px">${n}</text></g>`;
  }).join("");
  return `<svg class="mxd" viewBox="0 0 420 420" role="group" aria-label="Схема матрицы">${lines}${ages}${dots}</svg>`;
}

// ---------- форма даты ----------
const dateForm = (id, { label = "Дата рождения", value = "", btn = "Рассчитать", extra = "" } = {}) => `
  <div class="mx-form">
    <label for="mx-d-${id}">${label}</label>
    <div class="mx-row"><input id="mx-d-${id}" data-mx-date="${id}" type="text" inputmode="numeric" autocomplete="off" placeholder="ДД.ММ.ГГГГ" maxlength="10" value="${ctx.esc(value)}">
    <button type="button" class="btn" data-mx-calc="${id}">${btn}</button></div>${extra}</div>`;
const fmtMask = (v) => { const d = v.replace(/\D/g, "").slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}.${d.slice(2)}` : d; };

const needBirth = () => `<div class="mx-card mx-empty"><h2>Узнай свою Матрицу</h2><p class="prose">Введи дату рождения — Arcana рассчитает твою Матрицу по выбранной методике.</p>
  ${dateForm("me", { extra: `<p class="mx-err" id="mx-err-me">${ctx.esc(S.meErr ?? "")}</p><p class="hint">Дата хранится только на этом устройстве и никуда не отправляется.</p>` })}</div>`;

// ---------- сборка блоков ----------
const mxEsc = (s) => ctx.esc(s);
function energyLine(b) { return `<p class="mx-en"><b>${b.n} · ${mxEsc(b.name)}</b><i>${mxEsc(b.short)}</i></p>`; }
function blockHtml(b) {
  const meta = b.shadow || b.shadowQ ? `<div class="mx-meta">${b.shadow ? `<p class="mx-shadow"><b>В тени</b> ${mxEsc(b.shadow)}</p>` : ""}${b.shadowQ ? `<p class="mx-q"><b>Вопрос для себя</b> ${mxEsc(b.shadowQ)}</p>` : ""}</div>` : "";
  const k = b.karma ? `<div class="mx-karma"><div class="mx-kb"><span class="mx-kl">Как это может проявляться в жизни</span><p>${mxEsc(b.karma.trigger)}</p></div><div class="mx-kb"><span class="mx-kl">Практика вывода в плюс</span><ol>${b.karma.practice.map((x) => `<li>${mxEsc(x)}</li>`).join("")}</ol></div></div>` : "";
  return `<div class="mx-block"><div class="mx-body"><div class="mx-head"><span class="l-label">${mxEsc(b.lead)}</span>${energyLine(b)}</div>
    ${b.echo ? `<p class="mx-echo">Эта энергия уже звучала выше, поэтому здесь её тема раскрывается с другой стороны.</p>` : ""}
    <p class="mx-text">${mxEsc(b.text)}</p>${meta}</div>${k}</div>`;
}
const interplayHtml = (list) => list?.length ? `<div class="mx-inter"><span class="l-label">Как энергии могут сочетаться</span><div class="mx-stack">${list.map((x) => `<p class="mx-text">${mxEsc(x)}</p>`).join("")}</div></div>` : "";
const insightsHtml = (list) => list?.length ? `<div class="mx-inter"><span class="l-label">Как энергии могут сочетаться</span><div class="mx-stack">${list.map((i) => `<div class="mx-insight is-${i.kind}"><b>${mxEsc(i.title)}</b><p>${mxEsc(i.text)}</p></div>`).join("")}</div></div>` : "";
// индикатор проживания энергии: три утверждения → процент ресурса, ответы только на устройстве
function indHtml(ind) {
  const ans = S.ind[ind.n] ?? [], done = ans.filter(Boolean).length === ind.signs.length, r = done ? T.indicatorResult(ind.n, ans) : null;
  return `<div class="mx-ind" data-ind="${ind.n}"><div class="mx-head"><span class="l-label">Индикатор проживания энергии · ${mxEsc(ind.name)}</span>
    <p class="mx-small">Отметь, насколько это про тебя сейчас. Ответы остаются только на этом устройстве, к ним можно вернуться позже.</p></div>
    ${ind.signs.map((t, i) => `<div class="mx-sign"><p class="mx-text">${mxEsc(t)}</p><div class="mx-seg" role="group" aria-label="${mxEsc(t)}">${[["yes", "Да"], ["some", "Иногда"], ["no", "Пока нет"]].map(([v, l]) => `<button type="button" data-mx-ans="${ind.n}|${i}|${v}" aria-pressed="${ans[i] === v}">${l}</button>`).join("")}</div></div>`).join("")}
    ${r ? `<div class="mx-ind-res"><div class="mx-bar" aria-hidden="true"><i style="width:${r.pct}%"></i></div><p class="mx-text"><b>${r.pct}% в ресурсе.</b> ${mxEsc(r.msg)}</p></div>` : ""}</div>`;
}
const tarotLink = (theme, ctaId = "default", spreadId = "") => `<div class="mx-tarot"><p>Хочешь посмотреть, как эта тема проявляется именно сейчас?</p><button type="button" class="btn soft" data-mx-tarot="${mxEsc(theme)}" data-mx-spread="${mxEsc(spreadId)}">${mxEsc(T.cta(ctaId))}</button></div>`;
const caveat = `<p class="mx-caveat">Формулировки описывают возможные проявления в рамках системы. Это повод проверить, узнаёшь ли ты их в своей жизни, а не факт о тебе.</p>`;

function richHtml(r) {
  const col = (t, hint, list) => `<div class="mx-rich-col"><div class="mx-lbl"><b>${t}</b><span class="mx-small">${hint}</span></div><ul>${list.map((x) => `<li>${mxEsc(x)}</li>`).join("")}</ul></div>`;
  return `<div class="mx-rich"><div class="mx-head"><span class="l-label">${mxEsc(r.title)}</span>${energyLine(r)}</div>
    <p class="mx-text">${mxEsc(r.portrait)}</p>
    ${r.echo ? `<p class="mx-echo">Эта энергия уже разобрана выше: здесь она стоит в другой позиции, и её тема может звучать по-другому.</p>` : `
    <div class="mx-rich-grid">${col("Бытовые маркеры", "как узнать, что энергия «сливается»", r.markers)}${col("Сигналы тела и эмоций", "ориентиры для самонаблюдения, не диагноз", r.body)}</div>
    <p class="mx-micro"><b>Микро-практика на день</b> ${mxEsc(r.micro)}</p>`}</div>`;
}
const flowHtml = (list) => `<div class="mx-flows">${list.map((f) => `<div class="mx-flow"><div class="mx-head"><span class="l-label">${mxEsc(f.title)}</span>${energyLine(f)}</div>
  <div class="mx-flow-row"><div><div class="mx-lbl"><b>Что заземляет и блокирует канал</b></div><p>${mxEsc(f.block)}</p></div><i aria-hidden="true">→</i><div><div class="mx-lbl"><b>Что служит триггером раскрытия потока</b></div><p>${mxEsc(f.open)}</p></div></div></div>`).join("")}</div>`;

function periodHtml(res) {
  const m = res.main, f1 = (x) => (Math.round(x * 10) / 10).toString().replace(".", ","), from = f1(res.p.from), to = f1(res.p.to);
  return `<div class="mx-card mx-period">
    <span class="l-label">Текущий период</span>
    <p class="mx-big"><b>${m.n}</b> ${mxEsc(m.name)}</p><p class="mx-short">${mxEsc(m.short)}</p>
    <p class="mx-text">В этой системе энергия возраста берётся из точки на «круге лет»: сейчас ${f1(res.age)} года, и ближайшая к этому возрасту точка относится к интервалу примерно ${from}–${to} года жизни. Энергия приходит плавно, поэтому на ощущения могут влиять и соседние точки.</p>
    <dl class="mx-dl"><div><dt>Ключевая тема</dt><dd>${mxEsc(m.theme)}</dd></div><div><dt>Потенциал</dt><dd>${mxEsc(m.potential)}</dd></div><div><dt>Теневая сторона</dt><dd>${mxEsc(m.shadow)}</dd></div><div><dt>Что полезно замечать</dt><dd>${mxEsc(m.notice)}</dd></div><div><dt>На что обратить внимание</dt><dd>${mxEsc(m.attention)}</dd></div></dl>
    <div class="mx-triad"><div><span>Что происходит</span><b>${m.n} · ${mxEsc(m.name)}</b></div><div><span>Почему</span><b>${res.why.n} · ${mxEsc(res.why.name)}</b></div><div><span>Итог</span><b>${res.result.n} · ${mxEsc(res.result.name)}</b></div></div>
    <p class="mx-small">Дальше по кругу лет приближается энергия ${res.next.n} · ${mxEsc(res.next.name)}.</p>
  </div>
  <div class="mx-dirs">${res.directions.map((d) => `<div class="mx-dir">${ico(d.icon)}<div><span class="l-label">${mxEsc(d.title)}</span><p class="mx-en"><b>${d.n} · ${mxEsc(d.name)}</b></p><p class="mx-text">${mxEsc(d.text)}</p></div></div>`).join("")}</div>
  ${interplayHtml(res.interplay)}`;
}


// ---------- «Скопировать для ИИ»: готовый запрос с данными обзора (без даты рождения) ----------
const AI_INTRO = `Ты помогаешь с рефлексией и не предсказываешь будущее. Ниже фрагмент «Матрицы судьбы» (методика Arcana: по системе Наталии Ладини). Это символический язык самопознания, а не диагноз и не предсказание.

Задача: сделай подробный практический (actionable) разбор.
Структура ответа:
1. Главная идея в 3–4 предложениях.
2. Как это может проявляться в повседневной жизни (3 конкретных примера).
3. Ресурсы и тени: как отличить одно от другого в реальной жизни.
4. План на 7 дней: по одному небольшому шагу на каждый день.
5. Три вопроса для письменной рефлексии.
6. Что стоит проверить в реальной жизни и с кем это можно обсудить.

Правила: без предсказаний и гарантий; без диагнозов и медицинских советов; не утверждай мысли и намерения других людей; используй формулировки «может проявляться», «одна из гипотез»; тон бережный и честный. Если не хватает данных, задай до пяти уточняющих вопросов в конце.`;
const aiBlock = (b) => [`— ${b.lead}: энергия ${b.n} · ${b.name} (${b.short})`, b.text && `  Описание: ${b.text}`, b.shadow && `  В тени: ${b.shadow}`, b.shadowQ && `  Вопрос для себя: ${b.shadowQ}`, b.karma && `  Бытовой триггер: ${b.karma.trigger}`, b.karma && `  Практика вывода в плюс: ${b.karma.practice.join(" / ")}`].filter(Boolean).join("\n");
const aiInsights = (list) => list?.length ? "\nКак энергии могут сочетаться:\n" + list.map((i) => `— ${i.title}: ${i.text}`).join("\n") : "";
function aiPayload(kind) {
  const mx = S.birth ? calcMatrix(S.birth) : null;
  if (kind === "zone" && mx && S.zone) { const z = T.zone(mx, S.zone); return { title: `Раздел «${z.zone.title}»`, body: z.blocks.map(aiBlock).join("\n") + aiInsights(z.insights) + (z.note ? `\nПримечание: ${z.note}` : "") }; }
  if (kind === "ask" && mx && S.ask) { const r = T.ask(mx, S.ask); if (r.period) return aiPayload("period"); return { title: r.topic.title_out, body: r.blocks.map(aiBlock).join("\n") + aiInsights(r.insights) + `\nЧто проверить: ${r.check.question}` }; }
  if (kind === "period" && mx) { const r = T.period(mx, new Date()); return { title: "Что сейчас активировано (возрастной период)", body: `Текущая энергия: ${r.main.n} · ${r.main.name} (${r.main.short}). Тема: ${r.main.theme}. Потенциал: ${r.main.potential} Тень: ${r.main.shadow} Что замечать: ${r.main.notice}\nПочему: ${r.why.n} · ${r.why.name}. Итог: ${r.result.n} · ${r.result.name}.\n` + r.directions.map((d) => `— ${d.title}: ${d.n} · ${d.name}. ${d.text}`).join("\n") }; }
  if (kind === "other" && S.other.res) { const o = S.other.res.text; return { title: "Матрица другого человека (имя не указано)", body: o.sections.map((x) => x.kind === "rich" ? `${x.title}: энергия ${x.rich.n} · ${x.rich.name}. ${x.rich.portrait}${x.rich.markers.length ? "\n  Бытовые маркеры: " + x.rich.markers.join(" / ") + "\n  Сигналы тела и эмоций: " + x.rich.body.join(" / ") + "\n  Микро-практика: " + x.rich.micro : ""}` : x.kind === "flows" ? `${x.title}:\n` + x.flows.map((f) => `— энергия ${f.n} · ${f.name}. Что блокирует: ${f.block} Что раскрывает: ${f.open}`).join("\n") : `${x.title}:\n` + x.items.map((i) => `— ${i.pos}: энергия ${i.n} · ${i.name}. ${i.text}`).join("\n")).join("\n\n") }; }
  if (kind === "together" && S.tog.res) { const r = S.tog.res.r; return { title: "Совместимость двух матриц", body: r.sections.map((x) => `${x.title}:\n` + x.items.map((i) => `— ${i.lead}. ${i.text ?? ""}${i.list ? " " + i.list.join(" | ") : ""}`).join("\n")).join("\n\n") }; }
  if (kind === "guide" && S.guide) { const e = T.en(S.guide); return { title: `Энергия ${e.n} · ${e.name}`, body: `${e.short}. Архетип: ${e.archetype}.\nВ силе: ${e.strength}\nВ тени: ${e.shadow}\nТаланты: ${e.talents}\nОтношения: ${e.relations}\nДеньги: ${e.money}\nРост: ${e.growth}\nБытовой триггер: ${e.trigger}\nПрактика: ${e.practice.join(" / ")}` }; }
  return null;
}
function aiText(kind) { const d = aiPayload(kind); return d ? `${AI_INTRO}\n\nТема: ${d.title}\n\nДанные:\n${d.body}\n\nМоя ситуация (допиши свою, если хочешь): ` : ""; }
const aiButton = (kind) => `<div class="mx-ai mx-glass"><div><b>Разобрать глубже с помощью ИИ</b><p>Скопируй этот обзор вместе с готовым запросом и вставь в любой ИИ-чат: ChatGPT, Claude или Gemini. Он вернёт подробный практический разбор с планом на неделю. Дата рождения в запрос не попадает.</p></div>
  <div class="mx-ai-row"><button type="button" class="btn" data-mx-copy="${kind}">Скопировать для ИИ-анализа</button><span class="mx-status" aria-live="polite"></span></div>
  <p class="mx-small">Открыть чат: <a class="ext" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">ChatGPT</a> · <a class="ext" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Claude</a> · <a class="ext" href="https://gemini.google.com/app" target="_blank" rel="noopener noreferrer">Gemini</a></p></div>`;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok; } catch { return false; }
}

// ---------- экраны ----------
function viewMe() {
  if (!S.birth) return needBirth();
  const mx = calcMatrix(S.birth), zone = S.zone ? T.zone(mx, S.zone) : null, hi = zone ? zone.zone.points.filter((k) => k.length <= 4) : [];
  const detail = S.sel ? pointDetail(mx, S.sel) : `<div class="mx-card mx-hint"><p class="prose">Нажми на любую точку схемы или на одну из зон ниже, и появится короткое объяснение.</p></div>`;
  const pur = ["sky", "earth", "personal", "social", "general", "planetary", "kinPower", "innerPower"].map((k) => `<button type="button" class="mx-chip${S.sel === k ? " is-on" : ""}" data-mx-point="${k}">${mxEsc(KB.positions[k].title.split(":")[0])} · ${T.value(mx, k)}</button>`).join("");
  return `<div class="mx-me">
    <div class="mx-person"><span>Матрица · ${fmtBirth(S.birth)}</span><button type="button" class="mx-link" data-mx-edit>Изменить дату</button><button type="button" class="mx-link" data-mx-forget>Забыть дату</button></div>
    <div class="mx-split"><div class="mx-diag">${diagramSvg(mx, S.sel, hi)}<p class="mx-small">Цифры по краям схемы — возраст в годах: энергия течёт по кругу от 0 до 80 лет.</p></div><div class="mx-side">${detail}<div class="mx-chips">${pur}</div></div></div>
    <h2 class="mx-h2">Зоны Матрицы</h2>
    <div class="mx-zones">${KB.config.zones.map((z) => `<button type="button" class="mx-zone${S.zone === z.id ? " is-on" : ""}" data-mx-zone="${z.id}">${ico(z.icon)}<span><b>${mxEsc(z.title)}</b><i>${mxEsc(z.blurb)}</i></span></button>`).join("")}</div>
    ${zone ? `<div class="mx-card mx-zoneview" id="mx-zoneview"><h3>${mxEsc(zone.zone.title)}</h3>${zone.note ? `<p class="mx-caveat">${mxEsc(zone.note)}</p>` : ""}${zone.blocks.map(blockHtml).join("")}${insightsHtml(zone.insights)}${indHtml(zone.indicator)}${caveat}${aiButton("zone")}${tarotLink(ZONE_THEME[zone.zone.id], zone.zone.id)}</div>` : ""}
  </div>`;
}
function pointDetail(mx, key) {
  if (T.richKeys.includes(key)) return `<div class="mx-card mx-point">${richHtml(T.rich(mx, key, new Set()))}<button type="button" class="mx-link" data-mx-guide="${T.value(mx, key)}">Открыть в справочнике</button></div>`;
  const pos = KB.positions[key], n = T.value(mx, key), e = T.en(n), f = pos.fields[0];
  return `<div class="mx-card mx-point"><div class="mx-head"><span class="l-label">${mxEsc(pos.title)}</span>${energyLine({ n, name: e.name, short: e.short })}</div>
    <p class="mx-text">${mxEsc(e[f])}</p><p class="mx-shadow"><b>В тени</b> ${mxEsc(e.shadow)}</p>
    <p class="mx-small">${mxEsc(pos.desc)}${pos.age ? ` Период: ${pos.age}.` : ""}</p><button type="button" class="mx-link" data-mx-guide="${n}">Открыть в справочнике</button></div>`;
}
function viewNow() {
  if (!S.birth) return needBirth();
  const mx = calcMatrix(S.birth), res = T.period(mx, new Date());
  return `<div class="mx-now"><h2 class="mx-h2">Что сейчас активировано</h2>${caveat}${periodHtml(res)}
    ${aiButton("period")}${tarotLink("Саморазвитие", "period")}
    <p class="mx-small"><button type="button" class="mx-link" data-mx-lunar>Лунный ритм на сегодня</button> — отдельная подсказка дня, она не связана с расчётом Матрицы.</p>
    <details class="mx-method"><summary>Как это считается</summary><p>Энергия возраста берётся из «круга лет»: основные точки A, Е, Б, Ж, В, З, Г, И стоят на возрасте 0, 10, 20 … 70, а между ними суммы соседних точек делят каждые десять лет на отрезки по 1,25 года. Вторая энергия — точка напротив (на 40 лет дальше по кругу), итог — их сумма. Это одна из школ расчёта.</p></details></div>`;
}
function otherHtml(res, name, birth) {
  const mx = calcMatrix(birth);
  const sec = (x) => x.kind === "rich" ? `<div class="mx-sec">${richHtml(x.rich)}</div>`
    : x.kind === "flows" ? `<div class="mx-sec"><span class="l-label">${mxEsc(x.title)}</span>${flowHtml(x.flows)}</div>`
    : `<div class="mx-sec"><span class="l-label">${mxEsc(x.title)}</span><div class="mx-stack">${x.items.map((i) => `<div class="mx-it"><p class="mx-en"><b>${i.n} · ${mxEsc(i.name)}</b><i>${mxEsc(i.pos)}</i></p><p class="mx-text">${mxEsc(i.text)}</p></div>`).join("")}</div></div>`;
  return `<div class="mx-person"><span>${name ? mxEsc(name) + " · " : ""}Матрица · ${fmtBirth(birth)}</span></div>
    <div class="mx-diag mx-diag-sm">${diagramSvg(mx, null)}</div>
    <div class="mx-card"><h3>Что можно увидеть</h3><p class="mx-caveat">Это одна из возможных интерпретаций в рамках этой системы, а не оценка человека. Эзотерический язык здесь описывает символы, а не установленные факты. Бытовые примеры и сигналы тела — ориентиры для самонаблюдения, а не диагноз.</p>
    ${res.sections.map(sec).join("")}</div>
    ${aiButton("other")}<div class="mx-actions"><button type="button" class="btn" data-mx-together>Посмотреть нас вместе</button></div>`;
}
function viewOther() {
  return `<div class="mx-other"><h2 class="mx-h2">Матрица другого человека</h2><p class="prose">Введи дату рождения и, если хочешь, имя или псевдоним. Данные не сохраняются и никуда не отправляются.</p>
    <div class="mx-form"><label for="mx-n-other">Имя или псевдоним (необязательно)</label><input id="mx-n-other" data-mx-name type="text" autocomplete="off" maxlength="30" value="${mxEsc(S.other.name)}"></div>
    ${dateForm("other", { value: S.other.raw, btn: "Посмотреть", extra: `<p class="mx-err" id="mx-err-other">${mxEsc(S.other.err)}</p>` })}
    ${S.other.res ? otherHtml(S.other.res.text, S.other.name, S.other.res.birth) : ""}</div>`;
}
const hash = (str) => { let h = 5381; for (const c of str) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return h.toString(36); };
const hwKey = () => hash(`${S.tog.a}|${S.tog.b}`);
const loadHw = () => { try { return JSON.parse(localStorage.getItem("arcana-mx-hw") || "{}") || {}; } catch { return {}; } };
const saveHw = (o) => { try { localStorage.setItem("arcana-mx-hw", JSON.stringify(o)); } catch {} };
function hwItem(i) {
  const st = (loadHw()[hwKey()] ?? {})[i.hw] ?? {};
  return `<div class="mx-hw" data-hw="${i.hw}"><div class="mx-head"><span class="l-label">${mxEsc(i.lead)}</span><p class="mx-q-big">${mxEsc(i.text)}</p></div>
    <textarea data-mx-hwnote="${i.hw}" rows="2" placeholder="Что мы решили или поняли (остаётся только на этом устройстве)">${mxEsc(st.note ?? "")}</textarea>
    <button type="button" class="mx-chip${st.done ? " is-on" : ""}" data-mx-hwdone="${i.hw}" aria-pressed="${!!st.done}">${st.done ? "Обсудили ✓" : "Отметить как обсуждённое"}</button></div>`;
}
function togetherItem(i) {
  if (i.hw) return hwItem(i);
  return `<div class="mx-it"><p class="mx-en"><b>${mxEsc(i.lead)}</b></p>${i.text ? `<p class="mx-text">${mxEsc(i.text)}</p>` : ""}${i.list ? `<ul class="mx-bul">${i.list.map((x) => `<li>${mxEsc(x)}</li>`).join("")}</ul>` : ""}</div>`;
}
function togetherHtml(r, a, b) {
  const pts = r.keys.map((k) => `<div><span>${mxEsc(KB.positions[k].title.split(":")[0])}</span><b>${T.value(a, k)} + ${T.value(b, k)} = ${r.pair[k]}</b></div>`).join("");
  const alt = KB.config.spread_suggest.map((s) => `<button type="button" class="mx-chip${s.id === r.spread ? " is-on" : ""}" data-mx-tarot="Отношения" data-mx-spread="${s.id}">${mxEsc(s.label)}</button>`).join("");
  return `<div class="mx-card"><h3>Что можно увидеть о вашей связи</h3><p class="mx-caveat">Здесь нет процента совместимости: он ничего не говорит о живых отношениях. Это набор тем, которые можно обсудить вдвоём. Метод сопоставления матриц у разных авторов отличается; Arcana складывает одноимённые точки двух матриц.</p>
    ${r.sections.map((s) => `<div class="mx-sec"><span class="l-label">${mxEsc(s.title)}</span><div class="mx-stack">${s.items.map(togetherItem).join("")}</div></div>`).join("")}</div>
    ${aiButton("together")}<details class="mx-method"><summary>Точки пары</summary><div class="mx-pairpts">${pts}</div><p class="mx-small">Каждая точка пары — сумма одноимённых точек двух матриц, сведённая к числу от 1 до 22.</p></details>
    <div class="mx-tarot"><p>Хочешь посмотреть эту связь через Таро? Arcana предложит подходящий расклад.</p><button type="button" class="btn soft" data-mx-tarot="Отношения" data-mx-spread="${r.spread}">Посмотреть эту связь через Таро</button><div class="mx-chips">${alt}</div></div>`;
}
const dateField = (id, label, value) => `<div class="mx-form"><label for="mx-d-${id}">${label}</label><div class="mx-row"><input id="mx-d-${id}" data-mx-date="${id}" type="text" inputmode="numeric" autocomplete="off" placeholder="ДД.ММ.ГГГГ" maxlength="10" value="${ctx.esc(value)}"></div></div>`;
function viewTogether() {
  const myDate = S.tog.a || (S.birth ? fmtBirth(S.birth) : "");
  return `<div class="mx-together"><h2 class="mx-h2">Мы вместе</h2><p class="prose">Введи две даты рождения. Результат — темы для разговора, а не оценка союза.</p>
    <div class="mx-pairform">${dateField("a", "Первая дата", myDate)}${dateField("b", "Вторая дата", S.tog.b)}</div>
    <div class="mx-actions"><button type="button" class="btn" data-mx-calc="pair">Показать</button></div><p class="mx-err" id="mx-err-tog">${mxEsc(S.tog.err)}</p>
    ${S.tog.res ? togetherHtml(S.tog.res.r, S.tog.res.a, S.tog.res.b) : ""}</div>`;
}
const GUIDE_FIELDS = ["strength", "shadow", "talents", "relations", "money", "work", "growth"];
function viewGuide() {
  if (S.guide) {
    const e = T.en(S.guide);
    return `<div class="mx-guide"><button type="button" class="mx-link" data-mx-back>← Все энергии</button>
      <div class="mx-card"><p class="mx-big"><b>${e.n}</b> ${mxEsc(e.name)}</p><p class="mx-short">${mxEsc(e.short)}</p><p class="mx-small">${mxEsc(e.archetype)}</p>
      ${GUIDE_FIELDS.map((f) => `<div class="mx-sec"><span class="l-label">${FIELD_LABEL[f]}</span><p class="mx-text">${mxEsc(e[f])}</p></div>`).join("")}
      <div class="mx-sec"><span class="l-label">Личный рост</span><p class="mx-text">${mxEsc(e.growth)}</p></div>
      <div class="mx-sec"><span class="l-label">Вопросы для размышления</span><ul class="l-list">${e.questions.map((q) => `<li>${mxEsc(q)}</li>`).join("")}</ul></div>
      <div class="mx-sec"><span class="l-label">Рекомендации</span><ul class="l-list">${e.recommendations.map((q) => `<li>${mxEsc(q)}</li>`).join("")}</ul></div>
      ${e.note ? `<p class="mx-small">${mxEsc(e.note)}</p>` : ""}${caveat}</div>
      ${aiButton("guide")}${tarotLink("Саморазвитие", "guide")}</div>`;
  }
  const mine = S.birth ? [...coreEnergies(calcMatrix(S.birth))].sort((a, b) => a - b) : [], scope = S.q.trim() ? "all" : (S.gscope ?? (S.birth ? "mine" : "all"));
  const list = scope === "mine" ? mine.map((n) => T.en(n)) : T.search(S.q), mset = new Set(mine);
  return `<div class="mx-guide"><div><h2 class="mx-h2">Справочник энергий</h2><p class="mx-small">Что означает каждая из 22 энергий Матрицы. Здесь можно прочитать любую, не только свои.</p></div>
    ${S.birth ? `<div class="mx-seg mx-seg-lg" role="group" aria-label="Что показывать"><button type="button" data-mx-scope="mine" aria-pressed="${scope === "mine"}">Мои энергии · ${mine.length}</button><button type="button" data-mx-scope="all" aria-pressed="${scope === "all"}">Все 22</button></div>` : ""}
    ${searchHtml()}
    <div class="mx-grid" id="mx-grid">${gridCards(list, mset)}</div></div>`;
}
const searchHtml = () => `<div class="mx-search"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5"/><path d="M13.2 13.2 17 17"/></svg><input data-mx-search type="text" role="searchbox" aria-label="Поиск по энергиям" autocomplete="off" spellcheck="false" placeholder="Найти энергию: деньги, любовь, выбор" value="${mxEsc(S.q)}"><button type="button" class="mx-search-x" data-mx-clear aria-label="Очистить поиск"${S.q ? "" : " hidden"}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6"/></svg></button></div>`;
const gridCards = (list, mset) => list.map((e) => `<button type="button" class="mx-gcard" data-mx-guide="${e.n}"><b>${e.n} · ${mxEsc(e.name)}</b><span>${mxEsc(e.short)}</span>${mset.has(e.n) ? `<em>в твоей Матрице</em>` : ""}</button>`).join("") || `<p class="hint">Ничего не нашлось. Попробуй другое слово.</p>`;
function viewAsk() {
  if (!S.birth) return needBirth();
  const mx = calcMatrix(S.birth), res = S.ask ? T.ask(mx, S.ask) : null;
  const body = !res ? "" : res.period
    ? `<div class="mx-card"><h3>${mxEsc(res.topic.title_out)}</h3>${caveat}</div>${periodHtml(res.period)}${aiButton("period")}${tarotLink(TOPIC_THEME.period, "period")}`
    : `<div class="mx-card mx-answer"><h3>${mxEsc(res.topic.title_out)}</h3>${caveat}${res.blocks.map(blockHtml).join("")}${insightsHtml(res.insights)}
        <div class="mx-check"><div class="mx-head"><span class="l-label">${mxEsc(res.check.lead)}</span></div><p class="mx-text">${mxEsc(res.check.question)}</p><p class="mx-text">Небольшой шаг: ${mxEsc(res.check.action.charAt(0).toLowerCase() + res.check.action.slice(1))}</p></div></div>${indHtml(res.indicator)}${aiButton("ask")}${tarotLink(TOPIC_THEME[res.topic.id], res.topic.id)}`;
  return `<div class="mx-ask"><h2 class="mx-h2">Что тебя сейчас интересует?</h2><p class="prose">Это не ИИ: Arcana собирает обзор из уже рассчитанных данных твоей Матрицы.</p>
    <div class="mx-zones">${KB.config.topics.map((t) => `<button type="button" class="mx-zone${S.ask === t.id ? " is-on" : ""}" data-mx-ask="${t.id}">${ico(t.icon)}<span><b>${mxEsc(t.title)}</b><i>${mxEsc(t.ask)}</i></span></button>`).join("")}</div>${body}</div>`;
}

const METHOD_BOX = `<details class="mx-method mx-method-main"><summary>О методике и расчёте</summary>
  <p><b>${MATRIX_METHOD_NAME}.</b> День, месяц и сумма цифр года образуют три основные точки; к ним добавляются «хвост» (сумма трёх) и центр (сумма четырёх). Остальные точки — суммы соседних. Числа больше 22 складываются по цифрам (23 → 5, 30 → 3). Другие школы считают иначе, например вычитают 22, но Arcana их не смешивает.</p>
  <p>Расчёт сверен по опубликованным числовым примерам. Тексты энергий — авторский синтез Arcana. Матрица — инструмент самопознания, а не предсказание, диагностика или совет по решениям.</p></details>`;

// ---------- публичный вход ----------
export function renderMatrixPage(c, sub = "me", arg = "") {
  ctx = c; KB = c.data; T = T ?? makeMatrixText(KB);
  if (!TABS.some(([k]) => k === sub)) sub = "me";
  if (sub === "guide") S.guide = arg ? Math.min(22, Math.max(1, Number(arg) || 0)) || null : S.guide;
  c.setWorld(null, "Саморазвитие");
  const views = { me: viewMe, now: viewNow, other: viewOther, together: viewTogether, guide: viewGuide, ask: viewAsk };
  const app = c.app();
  app.innerHTML = `<section class="mx">
    <header class="mx-head"><p class="eyebrow">Матрица</p><h1>Матрица судьбы</h1><p class="mx-lead">Твоя карта энергий, талантов, отношений и жизненных периодов.</p>
      <p class="mx-methodline">Методика Arcana: по системе Наталии Ладини</p></header>
    <nav class="mx-nav" aria-label="Разделы Матрицы">${TABS.map(([k, t]) => `<a href="#matrix/${k}" data-mx-tab="${k}"${k === sub ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <div id="mx-body">${views[sub]()}</div>${METHOD_BOX}
    <p class="l-foot">Матрица — один из символических языков самопознания. Здесь нет предсказаний, диагнозов и готовых решений. Дата рождения хранится только на этом устройстве.</p></section>`;
  S.sub = sub;
  bind(app, sub);
}
const rerender = () => { const b = document.getElementById("mx-body"); if (b) { const v = { me: viewMe, now: viewNow, other: viewOther, together: viewTogether, guide: viewGuide, ask: viewAsk }; b.innerHTML = v[S.sub]() ; } };

function calc(id) {
  const inp = document.querySelector(`[data-mx-date="${id}"]`); const r = parseBirth(inp?.value);
  if (id === "me") { if (r.error) { S.meErr = r.error; return rerender(); } S.meErr = ""; S.birth = { d: r.d, m: r.m, y: r.y }; try { localStorage.setItem(MX_KEY, JSON.stringify(S.birth)); } catch {} S.sel = null; S.zone = null; return rerender(); }
  if (id === "other") { S.other.raw = inp.value; S.other.name = document.querySelector("[data-mx-name]")?.value.trim() ?? ""; if (r.error) { S.other.err = r.error; S.other.res = null; return rerender(); } S.other.err = ""; const birth = { d: r.d, m: r.m, y: r.y }; S.other.res = { birth, text: T.other(calcMatrix(birth)) }; return rerender(); }
  if (id === "pair") {
    S.tog.a = document.querySelector('[data-mx-date="a"]')?.value ?? ""; S.tog.b = document.querySelector('[data-mx-date="b"]')?.value ?? "";
    const ra = parseBirth(S.tog.a), rb = parseBirth(S.tog.b), err = ra.error ? `Первая дата: ${ra.error}` : rb.error ? `Вторая дата: ${rb.error}` : "";
    if (err) { S.tog.err = err; S.tog.res = null; return rerender(); }
    S.tog.err = ""; const a = calcMatrix(ra), b = calcMatrix(rb); S.tog.res = { a, b, r: T.together(a, b) }; return rerender();
  }
}

function bind(app, sub) {
  if (app._mx) { app.removeEventListener("click", app._mx.click); app.removeEventListener("input", app._mx.input); app.removeEventListener("keydown", app._mx.key); }
  const click = (e) => {
    const t = (s) => e.target.closest(s);
    let el;
    if ((el = t("[data-mx-calc]"))) return calc(el.dataset.mxCalc);
    if ((el = t("[data-mx-copy]"))) { const kind = el.dataset.mxCopy, st = el.closest(".mx-ai")?.querySelector(".mx-status"); copyText(aiText(kind)).then((ok) => { if (st) st.textContent = ok ? "Скопировано. Теперь вставь в чат ИИ." : "Не получилось скопировать: попробуй ещё раз."; }); return; }
    if ((el = t("[data-mx-hwdone]"))) { const id = el.dataset.mxHwdone, all = loadHw(), k = hwKey(); all[k] = all[k] ?? {}; all[k][id] = { ...(all[k][id] ?? {}), done: !all[k][id]?.done }; saveHw(all); el.classList.toggle("is-on", all[k][id].done); el.setAttribute("aria-pressed", String(all[k][id].done)); el.textContent = all[k][id].done ? "Обсудили ✓" : "Отметить как обсуждённое"; return; }
    if ((el = t("[data-mx-scope]"))) { S.gscope = el.dataset.mxScope; S.q = ""; rerender(); return; }
    if (t("[data-mx-clear]")) { S.q = ""; rerender(); document.querySelector("[data-mx-search]")?.focus(); return; }
    if ((el = t("[data-mx-ans]"))) { const [n, i, v] = el.dataset.mxAns.split("|"); const a = S.ind[n] ?? []; a[Number(i)] = v; S.ind[n] = a; saveInd(); const box = document.querySelector(`[data-ind="${n}"]`); if (box) { const z = S.zone ? T.zone(calcMatrix(S.birth), S.zone).indicator : S.ask ? T.ask(calcMatrix(S.birth), S.ask).indicator : null; if (z && String(z.n) === n) box.outerHTML = indHtml(z); } return; }
    if ((el = t("[data-mx-point]"))) { S.sel = el.dataset.mxPoint; rerender(); return; }
    if ((el = t("[data-mx-zone]"))) { S.zone = S.zone === el.dataset.mxZone ? null : el.dataset.mxZone; S.sel = null; rerender(); if (S.zone) document.getElementById("mx-zoneview")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if ((el = t("[data-mx-ask]"))) { S.ask = S.ask === el.dataset.mxAsk ? null : el.dataset.mxAsk; rerender(); return; }
    if ((el = t("[data-mx-guide]"))) { S.guide = Number(el.dataset.mxGuide); if (S.sub !== "guide") { location.hash = `matrix/guide/${S.guide}`; return; } rerender(); window.scrollTo({ top: 0 }); return; }
    if (t("[data-mx-back]")) { S.guide = null; rerender(); return; }
    if (t("[data-mx-edit]")) { S.birth = null; S.zone = null; S.sel = null; rerender(); return; }
    if (t("[data-mx-forget]")) { S.birth = null; S.zone = null; S.sel = null; try { localStorage.removeItem(MX_KEY); } catch {} rerender(); return; }
    if (t("[data-mx-together]")) { S.tog.a = S.birth ? fmtBirth(S.birth) : S.tog.a; S.tog.b = S.other.raw; S.tog.res = null; location.hash = "matrix/together"; return; }
    if (t("[data-mx-lunar]")) { ctx.toLunar(); return; }
    if ((el = t("[data-mx-tarot]"))) { ctx.goTarot({ theme: el.dataset.mxTarot, spreadId: el.dataset.mxSpread || null }); return; }
  };
  const input = (e) => { const el = e.target; if (el.matches?.("[data-mx-hwnote]")) { const id = el.dataset.mxHwnote, all = loadHw(), k = hwKey(); all[k] = all[k] ?? {}; all[k][id] = { ...(all[k][id] ?? {}), note: el.value }; saveHw(all); return; } if (el.matches?.("[data-mx-date]")) { const v = fmtMask(el.value); if (v !== el.value) el.value = v; } else if (el.matches?.("[data-mx-search]")) { S.q = el.value; const g = document.getElementById("mx-grid"); const x = document.querySelector("[data-mx-clear]"); if (x) x.hidden = !S.q; if (g) { const mset = new Set(S.birth ? coreEnergies(calcMatrix(S.birth)) : []); const scope = S.q.trim() ? "all" : (S.gscope ?? (S.birth ? "mine" : "all")); const list = scope === "mine" ? [...mset].sort((a, b) => a - b).map((n) => T.en(n)) : T.search(S.q); g.innerHTML = gridCards(list, mset); document.querySelectorAll("[data-mx-scope]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mxScope === scope))); } } };
  const key = (e) => { if (e.key === "Enter" && e.target.matches?.("[data-mx-date]")) { e.preventDefault(); const id = e.target.dataset.mxDate; calc(id === "a" || id === "b" ? "pair" : id); } else if ((e.key === "Enter" || e.key === " ") && e.target.closest?.("g[data-mx-point]")) { e.preventDefault(); S.sel = e.target.closest("g[data-mx-point]").dataset.mxPoint; rerender(); } };
  app._mx = { click, input, key }; app.addEventListener("click", click); app.addEventListener("input", input); app.addEventListener("keydown", key);
}

// После расклада Таро: мягкая отсылка, если выпавшие Старшие арканы повторяются в Матрице пользователя
export function matrixNoteForReading(c, cards) {
  try {
    const b = S.birth ?? loadBirth(); if (!b) return "";
    KB = c.data; T = T ?? makeMatrixText(KB);
    const set = matrixEnergies(calcMatrix(b)), hits = [];
    for (const card of cards) { const m = /_MAJOR_(\d\d)$/.exec(card.id ?? ""); if (!m) continue; const n = Number(m[1]) || 22; if (set.has(n) && !hits.includes(n)) hits.push(n); }
    if (!hits.length) return "";
    const names = hits.map((n) => `${n} · ${T.en(n).name}`).join(", ");
    return `<p class="aside-note mx-readnote">Эта тема уже повторяется в твоей Матрице: ${c.esc(names)}. <a class="link" href="#matrix/guide/${hits[0]}">Посмотреть в Матрице</a></p>`;
  } catch { return ""; }
}
