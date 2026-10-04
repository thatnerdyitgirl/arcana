// Вытяжка карт. Единственный источник случайности — crypto.getRandomValues (Web Crypto).
// Вытяжка слепа к смыслу: тема, вопрос и контекст сюда НЕ передаются и на вероятность не влияют.
// Алгоритм: полный набор карт колоды → равномерное перемешивание Фишера–Йетса → первые N карт.
// Равномерность без modulo bias обеспечивает rejection sampling (randomBelow).

const cryptoApi = () => {
  const c = globalThis.crypto;
  if (!c || typeof c.getRandomValues !== "function") throw new Error("Web Crypto недоступен: честная вытяжка невозможна");
  return c;
};

// Равномерное целое в [0, n) без смещения: отбрасываем значения из «хвоста», не кратного n
export function randomBelow(n, getRandomValues = (a) => cryptoApi().getRandomValues(a)) {
  if (!Number.isInteger(n) || n < 1 || n > 0x100000000) throw new RangeError("n вне диапазона");
  if (n === 1) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;       // наибольшее кратное n, не выше 2^32
  for (;;) {
    getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

// Фишер–Йетс (Дарстенфельд): каждая из n! перестановок равновероятна, если randomBelow равномерен
export function shuffle(items, rnd = randomBelow) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const majorsOf = (deck) => Array.from({ length: 22 }, (_, i) => `${deck}_MAJOR_${String(i).padStart(2, "0")}`);

// Сдача колоды: равномерно перемешанная колода (pool — любой набор id; по умолчанию 22 Старших), первые count карт.
// reversals: true — ориентация каждой карты определяется независимой честной монетой (только колода с перевёрнутыми значениями, RWS)
export function dealFan({ deck, count = 3, reversals = false, pool = null, rnd = randomBelow } = {}) {
  if (deck !== "MANARA" && deck !== "RWS") throw new Error(`неизвестная колода: ${deck}`);
  const ids = pool ?? majorsOf(deck);
  if (!Number.isInteger(count) || count < 1 || count > ids.length) throw new RangeError(`count должен быть от 1 до ${ids.length}`);
  return shuffle(ids, rnd).slice(0, count).map((id) => ({ id, reversed: reversals && deck === "RWS" ? rnd(2) === 1 : false }));
}

// count карт без повторов (по умолчанию из 22 Старших арканов выбранной колоды; pool — полный набор, например все 78)
export const drawCards = (opts = {}) => dealFan(opts);
