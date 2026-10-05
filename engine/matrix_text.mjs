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
    if (!echo && got?.field !== "shadow") out.shadow = e.shadow;       // тень показываем один раз на энергию
    return out;
  }
  const interplayLine = (a, b) => {
    const ea = en(a), eb = en(b), key = [ea.mode, eb.mode].sort().join("+"), first = key.split("+")[0];
    const [x, y] = ea.mode === first ? [ea, eb] : [eb, ea];                  // {a} — энергия с первым в ключе стилем
    return (cfg.interplay[key] ?? "").replaceAll("{a}", x.name).replaceAll("{b}", y.name);
  };
  const interplayFor = (ns) => { const out = [], seen = new Set(); for (let i = 0; i < ns.length - 1; i++) { const a = ns[i], b = ns[i + 1]; if (a === b) continue; const k = [a, b].sort().join("-"); if (seen.has(k)) continue; seen.add(k); const l = interplayLine(a, b); if (l) out.push(l); } return out.slice(0, 3); };

  // Зона «Моей Матрицы»
  function zone(mx, id) {
    const z = cfg.zones.find((x) => x.id === id), s = session();
    const blocks = z.points.map((p) => { const b = block(s, mx, { p, lead: z.lead[p] ?? positions[p].title, f: positions[p].fields[0] }); b.pos = positions[p]; return b; });
    return { zone: z, blocks, interplay: interplayFor(blocks.map((b) => b.n)), note: z.note };
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
    return { topic: t, blocks, interplay: interplayFor(ns), check: { lead: t.check, question: q, action: rec } };
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

  // Матрица другого человека: «что можно увидеть»
  function other(mx) {
    const s = session(), spec = [
      ["Характер и основные энергии", [["A", "strength"]]],
      ["Сильные стороны", [["D", "potential"], ["B", "talents"]]],
      ["Возможные сложности", [["A", "shadow"], ["T", "difficulties"]]],
      ["Отношения", [["R", "relations"], ["U", "strength"]]],
      ["Реализация", [["sky", "potential"], ["earth", "work"]]],
      ["Деньги", [["O", "money"]]],
      ["Таланты", [["M", "talents"]]],
    ];
    const sections = spec.map(([title, items]) => ({ title, items: items.map(([p, f]) => { const n = value(mx, p), got = pick(s, n, [f]); s.seenEnergy.add(n); return { key: p, pos: positions[p].title, n, name: en(n).name, text: got?.text ?? "", echo: false }; }) }));
    return { sections };
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
    const modeA = en(a.pts.A).mode, modeB = en(b.pts.A).mode;
    sec.push({ id: "diff", items: [
      { lead: `Стили: ${nm(a.pts.A)} и ${nm(b.pts.A)}`, text: a.pts.A === b.pts.A ? `Основная энергия характера у вас совпадает (${nm(a.pts.A)}): много общего, и стоит замечать, где вы усиливаете и тень друг друга.` : interplayLine(a.pts.A, b.pts.A) },
      { lead: `Зоны комфорта: ${nm(a.pts.D)} и ${nm(b.pts.D)}`, text: a.pts.D === b.pts.D ? `Зона комфорта одна и та же: вам может быть легко понять потребности друг друга.` : interplayLine(a.pts.D, b.pts.D) },
    ] });
    sec.push({ id: "tension", items: [
      { lead: `Сложности в отношениях: ${nm(a.pts.T)}`, text: get(a.pts.T, "difficulties") },
      { lead: `и ${nm(b.pts.T)}`, text: get(b.pts.T, "difficulties") },
    ] });
    sec.push({ id: "bring", items: [
      { lead: `Один приносит: ${nm(a.pts.M)}`, text: get(a.pts.M, "talents") },
      { lead: `Другой приносит: ${nm(b.pts.M)}`, text: get(b.pts.M, "talents") },
    ] });
    sec.push({ id: "learn", items: [{ lead: `Общий «хвост»: ${nm(pair.G)}`, text: `Эта тема может быть общим вопросом для размышления. Точка роста: ${lc(get(pair.G, "growth"))}` }] });
    const keepN = pair.B, e = en(keepN);
    sec.push({ id: "keep", items: [
      { lead: `Хранитель пары: ${nm(keepN)}`, text: `Может помочь: ${lc(e.recommendations[0])}` },
      { lead: "Вопрос для разговора вдвоём", text: e.questions[0] },
    ] });
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
  return { en, value, zone, ask, period, other, together, search, interplayLine };
}
