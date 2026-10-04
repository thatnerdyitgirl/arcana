// Распознавание карт Манары из свободной строки:
//   «Король Воздуха, Луна, 2 Воды перев.» · «Король Воздуха / Луна / 2 Воды» · «Король Воздуха Луна 2 Воды»
// Алгоритм: токены → самое длинное совпадение с известными названиями и алиасами → при неоднозначности
// возвращается вопрос с вариантами, а не догадка.

const P_NORM = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/[«»"'.!?:]/g, " ").replace(/\s+/g, " ").trim();
const P_REV_WORD = /^(перевернут\p{L}*|перев|\(п\)|↓|rev|reversed)$/u;
const P_SEPARATORS = /[,;/|\\\n—–]+|\s-\s/g;
const P_STOP = new Set(["и", "а", "потом", "затем", "карта", "карты", "выпала", "выпали", "вытянула", "мне", "у", "меня", "это", "в", "на"]);

const P_RANKS = [
  [/^(туз\p{L}*|единиц\p{L}*|ace|1)$/u, "01"], [/^(двойк\p{L}*|два|две|2)$/u, "02"], [/^(тройк\p{L}*|три|3)$/u, "03"],
  [/^(четверк\p{L}*|четыре|4)$/u, "04"], [/^(пятерк\p{L}*|пять|5)$/u, "05"], [/^(шестерк\p{L}*|шесть|6)$/u, "06"],
  [/^(семерк\p{L}*|семь|7)$/u, "07"], [/^(восьмерк\p{L}*|восемь|8)$/u, "08"], [/^(девятк\p{L}*|девять|9)$/u, "09"],
  [/^(десятк\p{L}*|десять|10)$/u, "10"],
  [/^(слуг\p{L}*|паж\p{L}*|валет\p{L}*|принцесс\p{L}*|knave|page)$/u, "KNAVE"],
  [/^(рыцар\p{L}*|всадни\p{L}*|принц|принца|knight)$/u, "KNIGHT"],
  [/^(королев\p{L}*|дама|даму|queen)$/u, "QUEEN"],
  [/^(корол[ья]\p{L}*|корол|king)$/u, "KING"],
];
// [регэксп, ключ Манары, русская масть RWS (для подсказки в Манаре), ключ RWS, это стихия (в RWS не принимается)]
const P_SUITS = [
  [/^(огн\p{L}*|огон\p{L}*|fire)$/u, "FIRE", null, null, true], [/^(вод\p{L}*|water)$/u, "WATER", null, null, true],
  [/^(воздух\p{L}*|air)$/u, "AIR", null, null, true], [/^(земл\p{L}*|earth)$/u, "EARTH", null, null, true],
  [/^(жезл\p{L}*|посох\p{L}*|скипетр\p{L}*|wands?)$/u, "FIRE", "Жезлы", "WANDS"], [/^(кубк\p{L}*|кубок|чаш\p{L}*|cups?)$/u, "WATER", "Кубки", "CUPS"],
  [/^(меч\p{L}*|swords?)$/u, "AIR", "Мечи", "SWORDS"], [/^(пентакл\p{L}*|монет\p{L}*|денари\p{L}*|диск\p{L}*|pentacles?)$/u, "EARTH", "Пентакли", "PENTACLES"],
];
const P_SUIT_ORDER_RWS = ["WANDS", "CUPS", "SWORDS", "PENTACLES"];
const P_SUIT_RU = { FIRE: "Огня", WATER: "Воды", AIR: "Воздуха", EARTH: "Земли" };
const P_SUIT_ORDER = ["FIRE", "WATER", "AIR", "EARTH"];

const P_EXTRA_MAJOR = {
  MANARA_MAJOR_00: ["дурак", "шут", "the fool"],
  MANARA_MAJOR_01: ["маг", "фокусник", "the magician"],
  MANARA_MAJOR_02: ["верховная жрица", "жрица", "папесса"],
  MANARA_MAJOR_05: ["иерофант", "жрец", "папа", "верховный жрец"],
  MANARA_MAJOR_08: ["справедливость", "правосудие", "justice"],
  MANARA_MAJOR_10: ["зеркало", "колесо фортуны"],
  MANARA_MAJOR_11: ["сила", "strength"],
  MANARA_MAJOR_12: ["наказание", "повешенный", "висельник"],
  MANARA_MAJOR_17: ["звезда", "звезды"],
  MANARA_MAJOR_20: ["суд", "страшный суд"],
};
const P_EXTRA_MAJOR_RWS = {
  RWS_MAJOR_00: ["дурак", "шут", "the fool"], RWS_MAJOR_01: ["маг", "фокусник", "волшебник", "the magician"],
  RWS_MAJOR_02: ["верховная жрица", "жрица", "папесса"], RWS_MAJOR_05: ["иерофант", "папа", "верховный жрец", "жрец"],
  RWS_MAJOR_08: ["сила", "strength"], RWS_MAJOR_10: ["колесо фортуны", "колесо", "фортуна"], RWS_MAJOR_11: ["справедливость", "правосудие", "justice"],
  RWS_MAJOR_12: ["повешенный", "висельник"], RWS_MAJOR_17: ["звезда", "звезды"], RWS_MAJOR_20: ["суд", "страшный суд"], RWS_MAJOR_21: ["мир", "вселенная"],
};
const P_ROMAN = ["0", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx", "xxi"];

function pLevenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

export function buildCardIndex(cards, deck) {
  deck ??= Object.keys(cards)[0]?.split("_")[0] ?? "MANARA";
  cards = Object.fromEntries(Object.entries(cards).filter(([id]) => id.startsWith(deck + "_")));     // колоды не смешиваются
  const exact = new Map();
  for (const [id, card] of Object.entries(cards)) {
    const names = [card.identity?.name_ru, ...(card.identity?.aliases_ru ?? []), ...(P_EXTRA_MAJOR[id] ?? P_EXTRA_MAJOR_RWS[id] ?? [])].filter(Boolean).map(P_NORM);
    for (const a of names) if (!exact.has(a)) exact.set(a, id);
  }
  const names = Object.fromEntries(Object.entries(cards).map(([id, c]) => [id, c.identity?.name_ru ?? id]));
  return { exact, names, aliases: [...exact.keys()], deck };
}

const rankOf = (w, deck) => { const r = P_RANKS.find(([re]) => re.test(w))?.[1] ?? null; return r === "KNAVE" && deck === "RWS" ? "PAGE" : r; };
const suitOf = (w, deck) => {
  const s = P_SUITS.find(([re]) => re.test(w));
  if (!s) return null;
  if (deck === "RWS") return s[4] ? null : { suit: s[3], rws: null };      // в RWS масти — только Жезлы/Кубки/Мечи/Пентакли
  return { suit: s[1], rws: s[2] };
};

// Точное совпадение для фрагмента из 1–4 слов
function matchExact(words, index) {
  const phrase = words.join(" ");
  if (index.exact.has(phrase)) return { id: index.exact.get(phrase) };
  if (words.length === 2) {
    const [a, b] = words;
    const D = index.deck ?? "MANARA";
    if (rankOf(a, D) && suitOf(b, D) || rankOf(b, D) && suitOf(a, D)) {
      const r = rankOf(a, D) ?? rankOf(b, D), s = suitOf(b, D) ?? suitOf(a, D);
      return { id: `${D}_${s.suit}_${r}`, note: s.rws && D === "MANARA" ? `В Манаре масть «${s.rws}» — это масть ${P_SUIT_RU[s.suit]}.` : null };
    }
    const n = a === "аркан" ? Number(b) : b === "аркан" ? Number(a) : NaN;
    if (n >= 0 && n <= 21) return { id: `${D}_MAJOR_${String(n).padStart(2, "0")}` };
  }
  if (words.length === 1 && /^[ivx]+$/.test(phrase) && P_ROMAN.includes(phrase)) return { id: `${index.deck ?? "MANARA"}_MAJOR_${String(P_ROMAN.indexOf(phrase)).padStart(2, "0")}` };
  return null;
}

// Опечатки и падежи («луну», «отшельнк») — только для 1–2 слов
function matchFuzzy(words, index) {
  const t = words.join(" ");
  if (t.length < 4 || rankOf(words[0], index.deck) || suitOf(words[0], index.deck)) return null;
  let best = null;
  for (const a of index.aliases) {
    if (a.split(" ").length !== words.length || a.length < 3) continue;
    const d = (t.startsWith(a) && t.length - a.length <= 2) || (a.startsWith(t) && a.length - t.length <= 2) ? 0.5 : pLevenshtein(t, a);
    const limit = a.length > 6 ? 2 : 1;
    if (d <= limit && (!best || d < best.d)) best = { d, id: index.exact.get(a) };
  }
  return best ? { id: best.id, note: best.d >= 1 ? `Распознано как «${index.names[best.id]}».` : null } : null;
}

export function parseCards(text, index) {
  const segments = P_NORM(text.replace(P_SEPARATORS, " | ")).split("|").map((s) => s.trim().split(" ").filter(Boolean));
  const out = [];
  for (const seg of segments) {
    let i = 0, pendingReverse = false;
    const segStart = out.length;
    while (i < seg.length) {
      const w = seg[i];
      if (P_REV_WORD.test(w)) {
        // «перев.» относится к предыдущей карте сегмента, а если её нет — к следующей
        if (out.length > segStart && (out[out.length - 1].id || out[out.length - 1].options)) out[out.length - 1].reversed = true; else pendingReverse = true;
        i++; continue;
      }
      if (P_STOP.has(w)) { i++; continue; }
      let hit = null, len = 0;
      for (let L = Math.min(4, seg.length - i); L >= 1 && !hit; L--) {
        const span = seg.slice(i, i + L);
        if (span.some((x) => P_REV_WORD.test(x))) continue;
        const m = matchExact(span, index);
        if (m) { hit = m; len = L; }
      }
      for (let L = Math.min(2, seg.length - i); L >= 1 && !hit; L--) {
        const span = seg.slice(i, i + L);
        if (span.some((x) => P_REV_WORD.test(x))) continue;
        const m = matchFuzzy(span, index);
        if (m) { hit = m; len = L; }
      }
      if (hit) {
        out.push({ raw: seg.slice(i, i + len).join(" "), id: hit.id, name: index.names[hit.id], reversed: pendingReverse, note: hit.note ?? null });
        pendingReverse = false; i += len; continue;
      }
      // Неоднозначность: ранг без масти или голая цифра — спросить
      const r = rankOf(w, index.deck);
      if (r) {
        const D = index.deck ?? "MANARA";
        const options = (D === "RWS" ? P_SUIT_ORDER_RWS : P_SUIT_ORDER).map((s) => `${D}_${s}_${r}`);
        if (/^\d+$/.test(w) && Number(w) <= 21) options.unshift(`${D}_MAJOR_${String(Number(w)).padStart(2, "0")}`);
        out.push({ raw: w, reversed: pendingReverse, question: "Какую карту ты имеешь в виду?", options: options.filter((id) => index.names[id]).map((id) => ({ id, name: index.names[id] })) });
        pendingReverse = false; i++; continue;
      }
      out.push({ raw: w, error: "Не удалось распознать карту." });
      i++;
    }
  }
  return out;
}
