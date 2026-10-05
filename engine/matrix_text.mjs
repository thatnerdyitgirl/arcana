// Тексты Матрицы: сборка из статической базы знаний без ИИ. Каждая функция возвращает данные для показа.
// Принципы: «в этой системе…», «может проявляться…»; ресурс и тень рядом; одна и та же энергия не повторяет один и тот же текст в одном обзоре.
import { red, currentPeriod, pairMatrix } from "./matrix.mjs";

const FIELD_ORDER = ["strength", "relations", "money", "work", "growth", "talents", "potential", "difficulties", "shadow"];
export const FIELD_LABEL = { strength: "В силе", shadow: "В тени", talents: "Таланты", potential: "Потенциал", relations: "Отношения", money: "Деньги и реализация", work: "Работа", growth: "Личный рост", difficulties: "Возможные сложности" };

export function makeMatrixText(KB) {
  const energies = KB.energies, cfg = KB.config, positions = KB.positions;
  const en = (n) => energies[n - 1];
  const value = (mx, key) => key in mx.pts ? mx.pts[key] : key in mx.purposes ? mx.purposes[key] : key === "kinPower" ? mx.kinPower : key === "innerPower" ? mx.innerPower : null;

  // «Сессия» обзора: помнит, какие поля каких энергий уже показаны, чтобы не повторять текст
  const session = () => ({ used: new Map(), shadowShown: new Set(), seenEnergy: new Set() });
  function pick(s, n, prefs) {
    const used = s.used.get(n) ?? new Set(); s.used.set(n, used);
    const order = [...prefs, ...FIELD_ORDER];
    const f = order.find((x) => !used.has(x) && en(n)[x]);
    if (!f) return null;
    used.add(f); return { field: f, text: en(n)[f] };
  }
  function block(s, mx, role) {
    const n = value(mx, role.p), e = en(n), echo = s.seenEnergy.has(n);
    const got = pick(s, n, [role.f]);
    s.seenEnergy.add(n);
    const out = { key: role.p, lead: role.lead, n, name: e.name, short: e.short, text: got?.text ?? "", field: got?.field, echo };
    if (!echo && got?.field !== "shadow") { out.shadow = e.shadow; out.shadowQ = e.shadow_q; }       // тень показываем один раз на энергию
    return out;
  }
  const interplayLine = (a, b) => {
    const ea = en(a), eb = en(b), key = [ea.mode, eb.mode].sort().join("+"), first = key.split("+")[0];
    const [x, y] = ea.mode === first ? [ea, eb] : [eb, ea];                  // {a} — энергия с первым в ключе стилем
    return (cfg.interplay[key] ?? "").replaceAll("{a}", x.name).replaceAll("{b}", y.name);
  };
  const interplayFor = (ns) => { const out = [], seen = new Set(); for (let i = 0; i < ns.length - 1; i++) { const a = ns[i], b = ns[i + 1]; if (a === b) continue; const k = [a, b].sort().join("-"); if (seen.has(k)) continue; seen.add(k); const l = interplayLine(a, b); if (l) out.push(l); } return out.slice(0, 3); };

  // Мини-инсайты о сочетании энергий: внутренний конфликт / суперсила / тон — с хвостом под конкретный раздел
  function insights(ns, ctxId) {
    const uniq = [...new Set(ns)], out = [], tail = cfg.combo_tail[ctxId];
    const pairs = [];
    for (let i = 0; i < uniq.length; i++) for (let j = i + 1; j < uniq.length; j++) pairs.push([uniq[i], uniq[j]]);
    // сначала конфликты и суперсилы, затем «тон»
    const rank = (x) => (x.kind === "tone" ? 1 : 0);
    for (const [a, b] of pairs) {
      const ea = en(a), eb = en(b), ov = cfg.combo_override[[a, b].sort((x, y) => x - y).join("-")];
      const key = [ea.vector, eb.vector].sort().join("+"), t = ov ?? cfg.combo[key]; if (!t) continue;
      const [x, y] = ea.vector <= eb.vector ? [ea, eb] : [eb, ea];
      const fill = (str) => str.replaceAll("{A}", x.name).replaceAll("{B}", y.name).replaceAll("{ua}", x.urge).replaceAll("{ub}", y.urge).replaceAll("{ca}", x.ctx[ctxId] ?? "").replaceAll("{cb}", y.ctx[ctxId] ?? "");
      out.push({ kind: t.kind, title: t.title, text: fill(t.text) + (tail ? " " + fill(tail) : ""), pair: [a, b] });
    }
    return out.sort((p, q) => rank(p) - rank(q)).slice(0, 3);
  }
  const ctxOf = (id) => cfg.ctx_of[id] ?? "self";

  // Зона «Моей Матрицы»
  function zone(mx, id) {
    const z = cfg.zones.find((x) => x.id === id), s = session();
    const blocks = z.points.map((p) => { const b = block(s, mx, { p, lead: z.lead[p] ?? positions[p].title, f: positions[p].fields[0] }); b.pos = positions[p];
      if (z.karma) { const e = en(b.n); b.karma = { trigger: e.trigger, practice: e.practice, question: e.shadow_q }; } return b; });
    return { zone: z, blocks, insights: insights(blocks.map((b) => b.n), ctxOf(id)), note: z.note, indicator: indicator(blocks[0].n) };
  }
  // Индикатор проживания энергии: три утверждения «признаков плюса»
  function indicator(n) { const e = en(n); return { n, name: e.name, signs: e.plus_signs, tip: e.recommendations[0], practice: e.practice[0] }; }
  function indicatorResult(n, answers) {
    const e = en(n), vals = answers.map((a) => (a === "yes" ? 100 : a === "some" ? 50 : 0)), pct = Math.round(vals.reduce((x, y) => x + y, 0) / (vals.length || 1));
    const msg = pct >= 70 ? `Сейчас энергия «${e.name}» проявляется в основном в ресурсе. Можно поддержать это: ${e.recommendations[0].charAt(0).toLowerCase() + e.recommendations[0].slice(1)}`
      : pct >= 40 ? `Энергия «${e.name}» сейчас на стыке: часть проявлений в ресурсе, часть в тени. Попробуйте небольшой шаг: ${e.practice[0].charAt(0).toLowerCase() + e.practice[0].slice(1)}`
      : `Энергия «${e.name}» сейчас чаще звучит через тень, и это не приговор, а сигнал. Вопрос для себя: ${e.shadow_q} Первый шаг: ${e.practice[0].charAt(0).toLowerCase() + e.practice[0].slice(1)}`;
    return { pct, msg };
  }

  // «Спросить Матрицу»
  function ask(mx, topicId, now = new Date()) {
    const t = cfg.topics.find((x) => x.id === topicId);
    if (t.period) return { topic: t, period: period(mx, now) };
    const s = session();
    const blocks = t.roles.map((r) => block(s, mx, r));
    const ns = blocks.map((b) => b.n), first = en(ns[0]), last = en(ns[ns.length - 1]);
    const q = (ns.length > 1 && last.questions[0] === first.questions[0]) ? last.questions[1] : last.questions[0];
    const rec = first.recommendations[0] === q ? first.recommendations[1] : first.recommendations[0];
    return { topic: t, blocks, insights: insights(ns, ctxOf(t.id)), check: { lead: t.check, question: q, action: rec }, indicator: indicator(ns[0]) };
  }

  // Что сейчас активировано
  function period(mx, now = new Date()) {
    const p = currentPeriod(mx, now), s = session();
    const E1 = en(p.first), E2 = en(p.second), E3 = en(p.result);
    const dirs = {
      relations: [p.first, ["relations"]], work: [p.second, ["money", "work"]], realization: [p.result, ["potential", "talents"]], inner: [p.first, ["growth", "difficulties"]],
    };
    const directions = cfg.now.map((d) => { const [n, prefs] = dirs[d.id]; const got = pick(s, n, prefs); return { id: d.id, icon: d.icon, title: d.title, n, name: en(n).name, text: got?.text ?? "" }; });
    return {
      p, age: p.age,
      main: { n: p.first, name: E1.name, short: E1.short, theme: E1.themes.join(" · "), potential: E1.potential, shadow: E1.shadow, notice: E1.recommendations[0], attention: E1.difficulties, question: E1.questions[0] },
      why: { n: p.second, name: E2.name, short: E2.short },
      result: { n: p.result, name: E3.name, short: E3.short },
      next: { n: p.next, name: en(p.next).name },
      directions, interplay: interplayFor([p.first, p.second, p.result]),
    };
  }

  // Глубокая карточка точки: портрет → бытовые маркеры → сигналы тела и эмоций → микро-практика (повторяющаяся энергия сворачивается)
  function rich(mx, key, seen) {
    const n = value(mx, key), e = en(n), pos = positions[key], echo = seen.has(n); seen.add(n);
    return { key, title: pos.title, n, name: e.name, short: e.short, portrait: e.portrait, markers: echo ? [] : e.markers, body: echo ? [] : e.body, micro: echo ? "" : e.micro, echo };
  }
  const richKeys = ["A", "B", "D", "personal"];
  // Блок «заземляет и блокирует канал → триггер раскрытия потока» для денег и отношений
  function flows(mx, keys, kind, seen) {
    const out = [];
    for (const key of keys) { const n = value(mx, key); if (out.some((x) => x.n === n)) continue; const e = en(n); out.push({ key, title: positions[key].title, n, name: e.name, short: e.short, block: e[kind + "_block"], open: e[kind + "_open"] }); }
    return out;
  }
  // Матрица другого человека: «что можно увидеть»
  function other(mx) {
    const seen = new Set(), s = session();
    const richSec = (title, key) => ({ kind: "rich", title, rich: rich(mx, key, seen) });
    const sections = [
      richSec("День рождения: характер и ресурс", "A"), richSec("Месяц рождения: что поддерживает", "B"),
      richSec("Зона комфорта: внутренняя потребность", "D"), richSec("Предназначение", "personal"),
      { kind: "flows", title: "Деньги", flows: flows(mx, ["O", "F"], "money", seen) },
      { kind: "flows", title: "Отношения", flows: flows(mx, ["R", "U"], "rel", seen) },
      { kind: "plain", title: "Таланты", items: [["M", "talents"]].map(([p, f]) => { const n = value(mx, p), got = pick(s, n, [f]); return { key: p, pos: positions[p].title, n, name: en(n).name, text: got?.text ?? "" }; }) },
    ];
    return { sections };
  }

  // «Где различия»: бытовые сцены (деньги, быт, планы) и способ договориться, собранные из зон комфорта двух энергий
  function comfortItems(na, nb) {
    const A = en(na), B = en(nb), c1 = A.comfort, c2 = B.comfort;
    if (na === nb) return [
      { lead: `Одна и та же зона комфорта: ${A.name}`, text: `Центр у вас совпадает, поэтому потребности друг друга понятны почти без слов: общая потребность — ${c1.need}. Риск не в различиях, а в общих слепых пятнах: рядом друг с другом легко не замечать то, что для обоих привычно. Вопрос для двоих: ${A.shadow_q}` },
      { lead: "Как договориться", list: ["Раз в месяц проверять, что у вас одинаково удобно, но не обязательно хорошо.", "Добавить одно новое правило, которое меняет привычный сценарий.", c1.ask] },
    ];
    const hearA = `${A.name} слышит в идеях партнёра ${A.hears}, а ${B.name} — ${B.hears}`;
    return [
      { lead: "Финансы", list: [`${A.name}: спокойнее, когда ${c1.money}.`, `${B.name}: спокойнее, когда ${c2.money}.`, `Стык: ${hearA}. Каждый защищает свою потребность, и спор идёт о смысле, а не о цифрах.`] },
      { lead: "Быт", list: [`${A.name}: комфорт — ${c1.home}.`, `${B.name}: комфорт — ${c2.home}.`, "Стык: решения, принятые «по умолчанию», могут восприниматься как вторжение в чужой комфорт."] },
      { lead: "Планирование", list: [`${A.name}: спокойнее, когда ${c1.plan}.`, `${B.name}: спокойнее, когда ${c2.plan}.`, "Стык: одну и ту же поездку или покупку можно планировать как два разных проекта."] },
      { lead: "Как договориться", list: [
        `Назвать потребность, а не претензию. Потребность энергии «${A.name}» — ${c1.need}. Потребность энергии «${B.name}» — ${c2.need}.`,
        `Разделить зоны: «${A.name}» берёт на себя ${c1.offer}; «${B.name}» — ${c2.offer}.`,
        "Выбрать одно общее правило на месяц (например, сумму, которую каждый тратит без согласования) и в конце месяца вместе посмотреть, как оно работает.",
      ] },
      { lead: "Фразы-мосты", list: [c1.ask, c2.ask] },
    ];
  }

  // Мы вместе
  function together(a, b) {
    const { pair, shared } = pairMatrix(a, b), s = session();
    const lc = (t) => t ? t[0].toLowerCase() + t.slice(1) : t, nm = (n) => en(n).name, pk = (m, k) => value(m, k);
    const get = (n, f) => pick(s, n, [f])?.text ?? "";
    const sec = [];
    const sharedLine = shared.length ? `Общие энергии в основных точках: ${shared.map((x) => nm(x.energy)).join(", ")}. В этой системе совпадение энергий читают как узнавание и общий язык.` : "";
    sec.push({ id: "pull", items: [
      { lead: `Характер: ${nm(a.pts.A)} и ${nm(b.pts.A)}`, text: `В этой системе сумма дней рождения даёт энергию «${nm(pair.A)}». ${get(pair.A, "strength")}` },
      ...(sharedLine ? [{ lead: "Общее", text: sharedLine }] : []),
    ] });
    sec.push({ id: "strength", items: [{ lead: `Центр пары: ${nm(pair.D)}`, text: `Сумма зон комфорта двух матриц связывается с тем, на чём может держаться союз. Потенциал: ${lc(get(pair.D, "potential"))}` }] });
    sec.push({ id: "diff", items: comfortItems(a.pts.D, b.pts.D) });
    sec.push({ id: "tension", items: [
      { lead: `Сложности в отношениях: ${nm(a.pts.T)}`, text: get(a.pts.T, "difficulties") },
      { lead: `и ${nm(b.pts.T)}`, text: get(b.pts.T, "difficulties") },
    ] });
    const shown = new Set(), gift = (n) => { const e = en(n), t = shown.has(n) ? e.strength : e.gift; shown.add(n); return t; };
    sec.push({ id: "bring", items: [
      { lead: `Суперсила характера у первого: ${nm(a.pts.A)}`, text: gift(a.pts.A) },
      { lead: `Суперсила характера у второго: ${nm(b.pts.A)}`, text: gift(b.pts.A) },
      { lead: `Что приходит через повторяющиеся ситуации у первого: ${nm(a.pts.G)}`, text: `Со временем это становится ресурсом. ${gift(a.pts.G)}` },
      { lead: `Что приходит через повторяющиеся ситуации у второго: ${nm(b.pts.G)}`, text: `Со временем это становится ресурсом. ${gift(b.pts.G)}` },
    ] });
    sec.push({ id: "learn", items: [{ lead: `Общий «хвост»: ${nm(pair.G)}`, text: `Эта тема может быть общим вопросом для размышления. Точка роста: ${lc(get(pair.G, "growth"))}` }] });
    const keepN = pair.B, e = en(keepN);
    sec.push({ id: "keep", items: [
      { lead: `Хранитель пары: ${nm(keepN)}`, text: `Может помочь: ${lc(e.recommendations[0])}` },
    ] });
    // домашнее задание: вопросы выбираются по двум матрицам и не повторяются
    const hw = []; const addQ = (n, who) => { const q = en(n).pair_q; if (q && !hw.some((x) => x.text === q)) hw.push({ lead: who, text: q }); };
    addQ(a.pts.D, `Из зоны комфорта первого (${nm(a.pts.D)})`); addQ(b.pts.D, `Из зоны комфорта второго (${nm(b.pts.D)})`);
    addQ(pair.D, `Из центра пары (${nm(pair.D)})`); addQ(pair.G, `Из общего «хвоста» (${nm(pair.G)})`); addQ(a.pts.A, `Из характера первого (${nm(a.pts.A)})`);
    const homework = hw.slice(0, 3).map((x, i) => ({ ...x, hw: `hw${i + 1}` }));
    sec.push({ id: "homework", items: homework });
    // «притяжение / напряжение»: подсказка по выбору расклада Таро
    const spread = (shared.length >= 2 || [6, 15, 19, 3, 17].includes(pair.D)) ? "rel.attraction" : (shared.length === 0 ? "rel.diagnostics" : "rel.between_us");
    return { pair, shared, sections: sec.map((x) => ({ ...x, ...cfg.together.find((c) => c.id === x.id) })), spread, keys: ["A", "B", "V", "G", "D", "E", "Zh", "Z", "I"] };
  }

  // Справочник: поиск по словам
  function search(q) {
    const s = String(q ?? "").trim().toLowerCase();
    if (!s) return energies;
    const stem = s.length > 4 ? s.slice(0, s.length - 1) : s;
    return energies.filter((e) => [e.name, e.short, e.archetype, ...e.themes, ...e.keywords, e.money.slice(0, 0)].join(" ").toLowerCase().includes(stem) || (/деньг|доход|финанс|зарабат/.test(s) && /деньги|доход/.test(e.money.toLowerCase())) || (/отношен|любов|партн/.test(s) && e.relations.length > 0 && /отношен|близост|партн/.test(e.relations.toLowerCase())));
  }
  const cta = (id) => cfg.cta[id] ?? cfg.cta.default;
  return { en, value, rich, richKeys, zone, ask, period, other, together, search, interplayLine, insights, indicatorResult, cta };
}
