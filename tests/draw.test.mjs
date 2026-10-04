// Тест вытяжки: равномерность по картам и позициям, отсутствие повторов, отсутствие modulo bias.
import { randomBelow, shuffle, drawCards, dealFan, majorsOf } from "../engine/draw.mjs";
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };
const N = Number(process.env.DRAW_N ?? 600000);
// критические значения χ² при p = 0.001: df=21 → 46.80, df=1 → 10.83, df=2 → 13.82
const chi = (obs, exp) => obs.reduce((s, o) => s + (o - exp) ** 2 / exp, 0);

for (const deck of ["MANARA", "RWS"]) {
  const ids = majorsOf(deck), idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  const byPos = [0, 1, 2].map(() => new Array(22).fill(0)), total = new Array(22).fill(0);
  let dupes = 0, badCount = 0;
  for (let t = 0; t < N; t++) {
    const r = drawCards({ deck, count: 3 });
    if (r.length !== 3) badCount++;
    if (new Set(r.map((x) => x.id)).size !== 3) dupes++;
    r.forEach((x, p) => { byPos[p][idx[x.id]]++; total[idx[x.id]]++; });
  }
  check(dupes === 0 && badCount === 0, `[${deck}] ${N} вытяжек по 3 карты: повторов нет, ровно 3 карты`);
  // каждая позиция: все 22 карты равновероятны
  byPos.forEach((c, p) => { const x = chi(c, N / 22); check(x < 46.8, `[${deck}] позиция ${p + 1}: χ²=${x.toFixed(1)} < 46.8 (22 карты равновероятны)`); });
  // общая частота карт во всех позициях: ожидание N*3/22
  const x = chi(total, (N * 3) / 22); check(x < 46.8, `[${deck}] карта в раскладе: χ²=${x.toFixed(1)} < 46.8`);
  const spread = (Math.max(...total) - Math.min(...total)) / ((N * 3) / 22);
  check(spread < 0.03, `[${deck}] разброс частот карт ${(spread * 100).toFixed(2)}% < 3%`);
}

// Пары позиций не коррелируют: (карта в позиции 1) × (карта в позиции 2) без повторов — 22×21 равновероятных пар
{
  const pairs = new Map(); const M = Math.max(N, 600000);
  for (let t = 0; t < M; t++) { const r = drawCards({ deck: "RWS", count: 2 }); const k = r[0].id + r[1].id; pairs.set(k, (pairs.get(k) ?? 0) + 1); }
  const obs = [...pairs.values()], exp = M / (22 * 21);
  check(pairs.size === 22 * 21, `упорядоченные пары: все ${22 * 21} встречаются`);
  const df = 22 * 21 - 1; const x = chi(obs, exp);
  check(x < df + 4.5 * Math.sqrt(2 * df), `упорядоченные пары: χ²=${x.toFixed(0)} при df=${df} (равновероятны)`);
}

// Ориентация: честная монета, независимая от карты
{
  let rev = 0, n = 0; const perCard = new Array(22).fill(0), cnt = new Array(22).fill(0); const M = 400000;
  for (let t = 0; t < M; t++) for (const x of drawCards({ deck: "RWS", count: 3, reversals: true })) { n++; if (x.reversed) { rev++; perCard[Number(x.id.slice(-2))]++; } cnt[Number(x.id.slice(-2))]++; }
  const z = (rev - n / 2) / Math.sqrt(n / 4);
  check(Math.abs(z) < 3.3, `перевёрнутость: ${(rev / n * 100).toFixed(2)}% (z=${z.toFixed(2)}, |z|<3.3)`);
  const worst = Math.max(...cnt.map((c, i) => Math.abs((perCard[i] - c / 2) / Math.sqrt(c / 4))));
  check(worst < 4.2, `перевёрнутость не зависит от карты: макс |z|=${worst.toFixed(2)} < 4.2`);
  const man = drawCards({ deck: "MANARA", count: 3, reversals: true });
  check(man.every((x) => x.reversed === false), "Манара: перевёрнутых не бывает");
}

// Нет modulo bias: берём n = ⅔·2^32, где наивный «% n» смещён очень сильно
{
  // наивный вариант (для проверки чувствительности теста) против нашего: n=2^32/3*2 → доли в нижней трети
  const n = Math.floor(0x100000000 / 3 * 2) + 1; const M = 300000;
  const lowShare = (rnd) => { let low = 0; for (let t = 0; t < M; t++) if (rnd(n) < n / 3) low++; return low / M; };
  const naive = (k) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return b[0] % k; };
  const ours = lowShare((k) => randomBelow(k)), bad = lowShare(naive);
  check(Math.abs(ours - 1 / 3) < 0.0035, `rejection sampling: доля нижней трети диапазона ${(ours * 100).toFixed(2)}% (ожидается 33.33%)`);
  check(Math.abs(bad - 1 / 3) > 0.05, `контроль чувствительности: наивный «% n» даёт ${(bad * 100).toFixed(2)}% — тест видит смещение`);
}

// randomBelow: все значения малых n равновероятны, границы корректны
for (const n of [1, 2, 3, 7, 22]) {
  const c = new Array(n).fill(0); const M = 200000;
  for (let t = 0; t < M; t++) { const v = randomBelow(n); if (v < 0 || v >= n) { check(false, `randomBelow(${n}) вне диапазона`); break; } c[v]++; }
  const x = n > 1 ? chi(c, M / n) : 0; const crit = { 2: 10.83, 3: 13.82, 7: 22.46, 22: 46.8, 1: 1 }[n];
  check(x < crit, `randomBelow(${n}): χ²=${x.toFixed(1)} < ${crit}`);
}
// Фишер–Йетс: все 6 перестановок из 3 элементов равновероятны
{
  const m = new Map(); const M = 300000;
  for (let t = 0; t < M; t++) { const k = shuffle([1, 2, 3]).join(""); m.set(k, (m.get(k) ?? 0) + 1); }
  const x = chi([...m.values()], M / 6); check(m.size === 6 && x < 20.5, `shuffle([1,2,3]): 6 перестановок, χ²=${x.toFixed(1)} < 20.5 (p=0.001, df=5)`);
}
// интерфейс вытяжки не принимает ни темы, ни вопроса
check(drawCards.length === 0 || String(drawCards).includes("deck") && !/question|theme|context/.test(String(drawCards).split("\n")[0]), "drawCards не принимает вопрос, тему или контекст");
// Пул из 78 карт: равномерность по всем картам, без повторов; перевёрнутые только в RWS
{
  const pool = ["MAJOR", "WANDS", "CUPS", "SWORDS", "PENTACLES"].flatMap((g, gi) => Array.from({ length: gi ? 14 : 22 }, (_, i) => `RWS_${g}_${String(i).padStart(2, "0")}`));
  const idx = Object.fromEntries(pool.map((id, i) => [id, i])), cnt = new Array(78).fill(0), M = Math.min(N, 300000); let dupes = 0;
  for (let t = 0; t < M; t++) { const r = dealFan({ deck: "RWS", count: 22, pool }); if (new Set(r.map((x) => x.id)).size !== 22) dupes++; r.forEach((x) => cnt[idx[x.id]]++); }
  const x = chi(cnt, (M * 22) / 78);
  check(pool.length === 78 && dupes === 0, "пул 78 карт: в веере 22 разные карты");
  check(x < 77 + 4.5 * Math.sqrt(2 * 77), `пул 78 карт: χ²=${x.toFixed(0)} при df=77 (все 78 карт равновероятны)`);
  check(dealFan({ deck: "MANARA", count: 5, reversals: true, pool }).every((c) => !c.reversed), "Манара: перевёрнутых нет даже при включённом флаге");
  let ru = 0, nn = 0; for (let t = 0; t < 50000; t++) for (const c of dealFan({ deck: "RWS", count: 22, reversals: true, pool })) { nn++; if (c.reversed) ru++; }
  check(Math.abs(ru / nn - 0.5) < 0.01, `RWS из 78: доля перевёрнутых ${(ru / nn * 100).toFixed(1)}% (≈50%)`);
  let threw = false; try { dealFan({ deck: "RWS", count: 79, pool }); } catch { threw = true; } check(threw, "нельзя взять больше карт, чем в колоде");
}
process.exit(ok ? 0 : 1);
