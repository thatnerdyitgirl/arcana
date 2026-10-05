// Матрица судьбы Arcana: расчёт целиком на устройстве, без ИИ и сервера.
// Методика: «Диагностика предназначений. Матрица судьбы» по линии Наталии Ладини (классическая схема 22 энергий,
// диагональный и прямой квадраты). Формулы сверены по двум опубликованным разборам с числовыми примерами (см. docs/MATRIX-METHODOLOGY.md).
// Сведение чисел: всё, что больше 22, складывается по цифрам до 1–22 (23 → 5, 30 → 3). Альтернативная школа вычитает 22, здесь она не используется.

export const MATRIX_METHOD_NAME = "Методика Arcana: Матрица судьбы по системе Наталии Ладини";

export const red = (n) => { let x = Math.abs(Math.trunc(n)); while (x > 22) x = String(x).split("").reduce((s, c) => s + Number(c), 0); return x === 0 ? 22 : x; };

// Разбор «ДД.ММ.ГГГГ» (также «ДД/ММ/ГГГГ», «ДД-ММ-ГГГГ», «ДДММГГГГ»); проверка реальной даты
export function parseBirth(input, now = new Date()) {
  const s = String(input ?? "").trim();
  const m = s.match(/^(\d{1,2})[.\-/\s]?(\d{1,2})[.\-/\s]?(\d{4})$/);
  if (!m) return { error: "Введи дату в формате ДД.ММ.ГГГГ" };
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (mo < 1 || mo > 12 || dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { error: "Такой даты не существует" };
  if (y < 1900) return { error: "Год должен быть не раньше 1900" };
  if (dt > now) return { error: "Дата рождения не может быть в будущем" };
  return { d, m: mo, y };
}
export const fmtBirth = ({ d, m, y }) => `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;

// Ключи позиций (латиница вместо кириллических букв схемы):
// A,B,V,G,D,E,Zh,Z,I — основные девять; остальные — «тройки» вдоль линий
export const POINT_KEYS = ["A", "B", "V", "G", "D", "E", "Zh", "Z", "I", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "F", "Kh", "Ts", "Ch", "Sh", "Shch", "Y", "Eh", "Yu"];

export function calcMatrix({ d, m, y }) {
  const A = red(d), B = red(m), V = red(String(y).split("").reduce((s, c) => s + Number(c), 0));
  const G = red(A + B + V), D = red(A + B + V + G);
  const E = red(A + B), Zh = red(B + V), Z = red(V + G), I = red(G + A);
  // тройки вдоль линий: внутренняя точка = внешняя + центр, средняя = внешняя + внутренняя
  const K = red(A + D), L = red(A + K);          // детско-родительская карма: A, L, K
  const M = red(B + D), N = red(B + M);          // духовно-творческая: B, N, M
  const O = red(V + D), P = red(V + O);          // материальная (прошлых воплощений): V, P, O
  const R = red(G + D), S = red(G + R);          // кармический хвост: G, S, R
  const T = red(R + O), U = red(R + T);          // любовная: R, U, T
  const F = red(O + T);                          // денежная: O, F, T
  const Kh = red(E + D), Ts = red(E + Kh);       // род отца, дух: E, Ts, Kh
  const Ch = red(Zh + D), Sh = red(Zh + Ch);     // род матери, дух: Zh, Sh, Ch
  const Shch = red(Z + D), Y = red(Z + Shch);    // род отца, материя: Z, Y, Shch
  const Eh = red(I + D), Yu = red(I + Eh);       // род матери, материя: I, Yu, Eh
  const pts = { A, B, V, G, D, E, Zh, Z, I, K, L, M, N, O, P, R, S, T, U, F, Kh, Ts, Ch, Sh, Shch, Y, Eh, Yu };
  // предназначения
  const sky = red(B + G), earth = red(A + V), personal = red(sky + earth);
  const male = red(E + Z), female = red(Zh + I), social = red(male + female);
  const general = red(personal + social), planetary = red(social + general);
  const kinPower = red(E + Zh + Z + I), innerPower = red(kinPower + D);
  return { birth: { d, m, y }, pts, purposes: { sky, earth, personal, male, female, social, general, planetary }, kinPower, innerPower };
}

// Круг лет: A = 0, E = 10, B = 20, Zh = 30, V = 40, Z = 50, G = 60, I = 70, снова A = 80.
// Каждый десятилетний отрезок делится серединами: 5 лет, затем 2,5 и 7,5, затем 1,25 / 3,75 / 6,25 / 8,75. Всего 64 точки с шагом 1,25 года.
export const AGE_STEP = 1.25;
export function ageCircle(pts) {
  const anchors = [pts.A, pts.E, pts.B, pts.Zh, pts.V, pts.Z, pts.G, pts.I, pts.A];
  const out = [];
  for (let s = 0; s < 8; s++) {
    const P = anchors[s], Q = anchors[s + 1], mid = red(P + Q);
    const m1 = red(P + mid), m2 = red(mid + Q);
    const seg = [P, red(P + m1), m1, red(m1 + mid), mid, red(mid + m2), m2, red(m2 + Q)];
    out.push(...seg);
  }
  return out;                                   // 64 значений: индекс i — точка на возрасте i * 1,25 года
}
export const ageOf = (birth, now = new Date()) => {
  const b = new Date(Date.UTC(birth.y, birth.m - 1, birth.d)), n = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return (n - b.getTime()) / (365.2425 * 864e5);
};
// Текущий период: точка, в чей интервал [i·1,25; (i+1)·1,25) попадает точный возраст; зеркальная точка — через 40 лет по кругу; итог — их сумма
export function currentPeriod(mx, now = new Date()) {
  const circle = ageCircle(mx.pts), age = ageOf(mx.birth, now), a80 = ((age % 80) + 80) % 80;
  const i = Math.floor(a80 / AGE_STEP) % 64, j = (i + 32) % 64;
  const first = circle[i], second = circle[j];
  const from = i * AGE_STEP, to = from + AGE_STEP;
  return { age, circle, index: i, mirrorIndex: j, from, to, first, second, result: red(first + second), next: circle[(i + 1) % 64] };
}

// Сопоставление двух матриц (синтез Arcana): одноимённые точки складываются; единый метод для «пары» не закреплён в первоисточнике
export function pairMatrix(a, b) {
  const keys = ["A", "B", "V", "G", "D", "E", "Zh", "Z", "I"], pair = {};
  for (const k of keys) pair[k] = red(a.pts[k] + b.pts[k]);
  const shared = [];                              // энергии, которые встречаются в основных точках обоих
  const mainA = new Map(), mainB = new Map();
  keys.forEach((k) => { mainA.set(a.pts[k], [...(mainA.get(a.pts[k]) ?? []), k]); mainB.set(b.pts[k], [...(mainB.get(b.pts[k]) ?? []), k]); });
  for (const [e, ka] of mainA) if (mainB.has(e)) shared.push({ energy: e, a: ka, b: mainB.get(e) });
  return { pair, shared };
}

// какие энергии вообще встречаются в матрице (для связи с раскладами Таро)
export const matrixEnergies = (mx) => new Set([...Object.values(mx.pts), ...Object.values(mx.purposes), mx.kinPower, mx.innerPower]);

// «Мои энергии» для справочника: основные девять точек и три главных предназначения (без вспомогательных троек)
export const coreEnergies = (mx) => new Set([...["A", "B", "V", "G", "D", "E", "Zh", "Z", "I"].map((k) => mx.pts[k]), mx.purposes.personal, mx.purposes.social, mx.purposes.general]);
