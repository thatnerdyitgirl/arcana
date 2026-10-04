// Линзы категорий и сквозной рассказ: Отношения / Работа и бизнес / Саморазвитие.
import { reading, SPREADS } from "../engine/arcana.mjs";
import { relPast, bizGloss, selfFigures, selfLine } from "../engine/lenses.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const ids = (...a) => a.map((id) => ({ id: `MANARA_${id}` }));
const sp = (theme) => SPREADS.find((s) => s.theme === theme).id;

// А. Отношения: глаголы действия → ментальный процесс, только при векторе «прошлое»
check(relPast("Партнёры следят друг за другом").includes("шпионском симулировании отношений, где просмотр профиля заменяет реальный контакт"), "отношения: пример про слежку заменён целиком");
check(relPast("Цепляться за прошлое").startsWith("Мысленно цепляться"), "отношения: инфинитив → «мысленно …»");
check(!/мысленно мысленно/i.test(relPast(relPast("Цепляться за прошлое"))), "отношения: замена идемпотентна");
check(relPast("Ресурсом может стать честность") === "Ресурсом может стать честность", "отношения: «может стать» не трогаем");
const past = reading({ spreadId: "rel.unfinished", question: "Мы расстались полгода назад, я до сих пор проверяю его профиль", cards: ids("FIRE_04", "AIR_06", "MAJOR_15") });
const now = reading({ spreadId: "rel.unfinished", question: "Хочу понять, что между нами", cards: ids("FIRE_04", "AIR_06", "MAJOR_15") });
check(past.readings.some((x) => /мысленно/i.test(x.text)), "отношения/прошлое: в трактовках есть ментальные глаголы");
check(!now.readings.some((x) => /мысленно/i.test(x.text)), "отношения/настоящее: глаголы не меняются");
check(past.lens === "rel" && /живой контакт/.test(past.synthesis.lensQuestion), "отношения: вопрос линзы «живой контакт vs образ»");

// Б. Бизнес: страсть / давление / подглядывание → деловые процессы
check(bizGloss("Влечение двух людей").text.includes("творческий драйв, амбиции, лидерский импульс, желание масштабироваться"), "бизнес: влечение → драйв и амбиции");
check(bizGloss("Принуждение и подчинение").text.includes("давление руководства, жёсткие рамки найма, синдром самозванца, страх назвать цену"), "бизнес: подчинение → давление и самозванец");
check(bizGloss("Он подглядывает за ней").text.includes("скрытый анализ конкурентов, страх публичной критики, откладывание действий"), "бизнес: подглядывание → конкуренты и откладывание");
const biz = reading({ spreadId: sp("Работа и бизнес"), question: "Не решаюсь назвать цену на услуги, начальник давит", cards: ids("WATER_06", "FIRE_05", "MAJOR_05") });
check(biz.lens === null && !/в деле это/.test(JSON.stringify(biz.screen.cards.map((c) => c.analysis))), "бизнес Манары: механическая замена «эротика → деловой термин» отключена, смысл идёт из тематического слоя");

// В. Саморазвитие: фигуры — субличности
check(/Внутренний Критик/.test(selfLine({ active: true, passive: false })), "саморазвитие: активная фигура = Внутренний Критик");
check(/Тень/.test(selfLine({ active: false, passive: true })) && /Внутренний Ребёнок/.test(selfLine({ active: false, passive: true })), "саморазвитие: уязвимая фигура = Тень и Внутренний Ребёнок");
check(/спорят/.test(selfLine({ active: true, passive: true })), "саморазвитие: отношения фигур = как обходишься с желаниями");
const self = reading({ spreadId: sp("Саморазвитие"), question: "Хочу понять свой внутренний диалог", cards: ids("FIRE_03", "EARTH_04", "MAJOR_09") });
check(self.lens === null, "саморазвитие Манары: без механической линзы «фигуры = субличности», смысл идёт из тематического слоя");

// Другие категории не меняются
const dec = reading({ spreadId: "decision.ab", question: "Стоит ли принимать оффер?", cards: ids("FIRE_04", "AIR_06", "MAJOR_15") });
check(!dec.lens && !dec.synthesis.flow.includes("undefined"), "решения: линза не навязывается");

// Сквозной рассказ
for (const r of [past, now, biz, self, dec]) {
  const f = r.synthesis.flow;
  check(/^В основе, в позиции «/.test(f) && /проявля|проецирует|переходит|повторяется|противоречит|выходит наружу|опора|выход/i.test(f) && /позици[июя] «/.test(f), `рассказ [${r.spread.theme}]: связка А → динамика → Б`);
  check(!/[()]/.test(f) && !/Поскольку/.test(f), `рассказ [${r.spread.theme}]: без скобок и служебных оборотов`);
  check(r.cards.every((c) => f.includes(c.name)), `рассказ [${r.spread.theme}]: упомянуты все три карты`);
}


// Единый абзац «психологический баланс»
check(past.views.every((v) => !v.blended || (!/Сила этой карты/.test(v.blended) && !/ловушка:/.test(v.blended))), "баланс: нет деления «Сила / Ловушка»");

// Квинтэссенция выше деталей, рассказ в «Общей картине»
import fs from "node:fs";
const app = fs.readFileSync(new URL("../app/app.mjs", import.meta.url), "utf8");
const iIns = app.indexOf("Главный инсайт расклада"), iQ = app.indexOf("Квинтэссенция · главный урок"), iDet = app.indexOf("Подробнее по каждой карте");
check(iIns > 0 && iIns < iQ && iQ < iDet, "экран: квинтэссенция сразу под инсайтом, до деталей по картам");
check(app.indexOf("Квинтэссенция · главный урок", iQ + 10) === -1, "экран: квинтэссенция показана один раз");
process.exit(ok ? 0 : 1);
