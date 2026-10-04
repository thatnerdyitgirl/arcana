// Практики, фраза дня, журнал, интеграция с лунными сутками, «О проекте».
import fs from "node:fs";
import { readLog, addEntry, clearLog, stats, fmtMinutes, fmtClock, phraseOfDay, practiceById } from "../engine/practices.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const rd = (f) => JSON.parse(fs.readFileSync(new URL("../knowledge/" + f, import.meta.url), "utf8"));
const PR = rd("practices/practices.json"), LU = rd("lunar/lunar-days.json"), AB = rd("about/about.json");
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

// библиотека практик
const need = ["breath_watch", "mindfulness", "vipassana", "metta", "breath_count", "body_scan", "walking", "contemplation", "silence", "so_ham"];
check(need.every((id) => practiceById(PR, id)) && PR.practices.length === 10, "10 практик из задания");
check(PR.practices.every((p) => p.name && p.summary && p.tradition && p.steps.length >= 3 && p.steps.every((s) => s.length < 190)), "у каждой практики: название, суть, 3+ шага, оговорка о традиции");
const sh = practiceById(PR, "so_ham");
check(sh.mantra.text === "SO HAM" && /Я есть/.test(sh.mantra.gloss) && /санскрит/i.test(sh.tradition) && /не является буддийской/i.test(sh.tradition) && !/буддийская мантра\b(?!\.)/i.test(sh.summary), "So Ham: санскритская формула йоги и индийской традиции, не буддийская мантра");
check(JSON.stringify(PR.durations) === "[5,10,20,30]", "длительности 5 / 10 / 20 / 30");
check(!/лечит|излечи|исцел|иммунитет|диагноз|гарантир|избавит от/i.test(JSON.stringify(PR)), "практики без медицинских обещаний");

// фразы
const themes = Object.keys(PR.themes);
check(["presence", "acceptance", "attention", "nonattachment", "silence", "observation", "compassion", "path"].every((t) => PR.phrases.some((p) => p.theme === t)), "фразы покрывают 8 тем: присутствие … путь");
check(PR.phrases.every((p) => p.text && p.source && themes.includes(p.theme)) && !PR.phrases.some((p) => /притягива|изобили|вселенная/i.test(p.text)), "у каждой фразы источник/традиция; нет wellness-аффирмаций");
check(PR.phrases.every((p) => !/^\s*«?[А-ЯA-Z][^.]+»?\s*—\s*[А-ЯA-Z][а-я]+ [А-Я][а-я]+/.test(p.source)), "авторство людям не приписано");
const d1 = Date.UTC(2026, 9, 3, 12), d2 = d1 + 864e5;
check(phraseOfDay(PR.phrases, d1).id === phraseOfDay(PR.phrases, d1 + 3600e3 * 0.5).id && phraseOfDay(PR.phrases, d1).id !== phraseOfDay(PR.phrases, d2).id, "фраза дня стабильна в течение суток и меняется на следующий день");

// лунные сутки
const keys = ["spiritual_practice", "meditation", "reflection", "recommended_inner_work", "avoid"];
check(LU.days.length === 30 && LU.days.every((d) => keys.every((k) => d[k] && (k !== "avoid" || d.avoid.length))), "у каждых из 30 суток: practice, meditation, reflection, inner work, avoid");
check(LU.days.every((d) => { const sp = d.spiritual_practice; return sp.practice.length >= 1 && sp.practice.length <= 2 && sp.practice.every((id) => practiceById(PR, id)) && sp.minutes >= 5 && sp.minutes <= 30; }), "1–2 практики из библиотеки, длительность 5–30 мин");
check(/Традиционная рекомендация/.test(LU.practice_note) && /не утверждает/.test(LU.practice_note), "примечание «Традиционная рекомендация», без утверждений о «лучшей» практике");
check(!LU.days.some((d) => /работает лучше|эффективнее|лечит|исцел|иммунитет/i.test([d.meditation, d.reflection, d.recommended_inner_work, d.spiritual_practice.text].join(" "))), "сутки без утверждений о превосходстве практики и без медицины");
const d22 = LU.days[21];
check(d22.symbol === "Ганеша" && /чтен|обучен/.test(d22.spiritual_practice.text) && /внимание перескакивает/.test(d22.meditation) && /уже знаю/.test(d22.reflection), "22-е сутки (Ганеша): чтение, наблюдение внимания, рефлексия из примера");
check([9, 19, 29].every((n) => LU.days[n - 1].spiritual_practice.practice.includes("silence")) && [9, 19, 29].every((n) => LU.warning_days.includes(n)), "9/19/29: предупреждение сохранено, практика тишины");

// журнал
const st = mem();
check(readLog(st).length === 0, "журнал пуст по умолчанию");
const now = new Date(2026, 9, 3, 15, 0).getTime();
addEntry({ t: now, id: "silence", sec: 600 }, st); addEntry({ t: now - 2 * 864e5, id: "metta", sec: 1500 }, st); addEntry({ t: now - 9 * 864e5, id: "walking", sec: 1200 }, st);
const s = stats(readLog(st), now);
check(s.todaySec === 600 && s.weekSec === 2100, "Сегодня 10 мин, за неделю 35 мин (записи старше недели не считаются)");
check(fmtMinutes(2100) === "35 мин" && fmtMinutes(0) === "0 мин" && fmtClock(600000) === "10:00" && fmtClock(61500) === "01:02", "форматирование минут и таймера");
st.setItem("arcana-practice-log", "мусор"); check(readLog(st).length === 0, "повреждённый журнал не ломает приложение");
addEntry({ t: now, id: "x", sec: 60 }, st); clearLog(st); check(readLog(st).length === 0, "очистка истории");

// «О проекте»
const txt = JSON.stringify(AB);
check(["О проекте", "Психология и наука", "Два языка подсознания", "Как читать результат", "Лунный цикл и дзен-практики", "Приватность", "Источники и методология"].every((h) => AB.sections.some((x) => x.h === h)), "разделы памятки");
check(AB.flow.join(">") === "вопрос>контекст>позиция>карта>визуальный сюжет>сочетание карт>дополнительные паттерны>итоговый синтез", "цепочка чтения результата");
check(/не медицинский и не научно диагностический/.test(txt) && /Юнг/.test(txt) && !/Юнг доказал|доказал[аи]? эффективност/i.test(txt), "Юнг как рамка, без утверждения о доказанной эффективности");
check(!/доказали|безошибочно выбирает|истинн(ую|ым|ые) чувств/i.test(txt.replace(/«безошибочен»/g, "")), "нет завышенных утверждений о презентименте и «безошибочном» выборе карты");
check(/остаётся спорной/.test(txt) && /не опирается на это как на доказательство/.test(txt) && /предмет(ом)? научных споров/.test(txt), "презентимент подан как спорная область");
check(AB.science_refs.items.length === 2 && /Radin, D\. I\. \(1997\)/.test(txt) && /Mossbridge, J\., Tressoldi, P\., & Utts, J\. \(2012\)/.test(txt) && /Journal of Scientific Exploration/.test(txt) && /Frontiers in Psychology/.test(txt), "научные ссылки Radin 1997 и Mossbridge 2012");
check(/\[1\]/.test(txt), "в тексте есть сноска [1]");
check(["Райдер–Уэйт", "Манара", "Лунный календарь"].every((g) => AB.sources.some((x) => x.deck === g)) && /Rivendel/.test(txt) && /Life-Moon/.test(txt) && /astronomy-engine/.test(txt) && /Банцхаф/.test(txt) && /Лаво/.test(txt), "источники: RWS, Манара, лунный календарь");
check(/не являются копией/.test(AB.method) && /сверка с текстами книг ещё не завершена/.test(txt), "тексты — собственная редакция; честная пометка про книги");
check(/без серверов, аккаунтов/.test(txt) && /только на твоём устройстве/.test(txt) && /Google Fonts/.test(txt), "приватность: без сервера и аккаунтов, честно про шрифты");
check(AB.lead.includes("все ответы внутри тебя") && AB.sections[0].sub === "Пространство сонастройки" && /только одно мгновение/.test(AB.sections[0].quote) && /локус контроля/.test(JSON.stringify(AB.sections[0].p)), "новый вводный текст «О проекте»");
check(/центр тяжести/.test(AB.practices_intro.p.join(" ")) && /буддийская осознанность/.test(AB.practices_intro.p[0]) && /только одно мгновение/.test(AB.practices_intro.quote), "блок о практиках (буддизм, стоицизм, даосизм) и цитата");
check(/Аружан/.test(JSON.stringify(AB.author)) && AB.author.p.flat().some((x) => x.href === "https://www.behance.net/aruzhantukeyeva") && AB.author.p.flat().some((x) => x.href === "https://www.linkedin.com/in/aruzhan-tukeyeva"), "об авторке: имя, Behance и LinkedIn");
check(AB.sessions.links.some((l) => l.href === "https://t.me/hotandiconic") && AB.sessions.links.some((l) => l.href === "https://www.instagram.com/helloarukai/") && /бесплатный/.test(AB.sessions.p), "личные сессии: Telegram и Instagram, сайт бесплатный");
check(/приписывается/.test(AB.candle.by) && !/Будда сказал/.test(JSON.stringify(AB)) && !/Будд/.test(AB.practices_intro.quote), "цитата про свечу помечена как приписываемая; цитата про мгновение не приписана никому");
check(/независимый авторский проект/.test(AB.indep) && /Астана/.test(AB.indep), "подвал: независимый проект, Казахстан, Астана");
process.exit(ok ? 0 : 1);
