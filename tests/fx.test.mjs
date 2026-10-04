// Логика лепестков без браузера: подставные canvas/window, ручные таймеры и кадры, детерминированный random.
let ok = true; const check = (c, m) => { console.log(c ? "ok  " : "FAIL", m); if (!c) ok = false; };

async function scene(tag, { wind = false } = {}) {
  let seed = 12345; Math.random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  let now = 0, rafQueue = [], timers = [], frameDraws = [], cur = [];
  let tf = [1, 0, 0, 1, 0, 0];
  const ctx = new Proxy({}, { get: (_, k) => k === "drawImage" ? () => cur.push({ x: tf[4] / 2, y: tf[5] / 2 }) : k === "setTransform" ? (...a) => { tf = a; } : k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}, set: () => true });
  const mk = () => ({ width: 0, height: 0, style: {}, getContext: () => ctx });
  const L = {};
  globalThis.window = { innerWidth: 1000, innerHeight: 700, devicePixelRatio: 2, addEventListener: (t, f) => (L[t] = f), removeEventListener() {} };
  globalThis.document = { hidden: false, body: { dataset: { world: "lotus" } }, createElement: mk, addEventListener() {} };
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.performance = { now: () => now };
  globalThis.requestAnimationFrame = (f) => { rafQueue.push(f); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.setTimeout = (f, ms) => { timers.push({ f, at: now + ms }); return 1; };
  globalThis.clearTimeout = () => {};
  const { initPetals } = await import(`../engine/fx.mjs?${tag}`);
  const ctl = initPetals(mk());
  const api = {
    frames: [],
    run(ms, onFrame) {
      for (let t = 0; t < ms; t += 16) {
        now += 16;
        for (let i = 0; i < timers.length; i++) if (timers[i] && timers[i].at <= now) { const f = timers[i].f; timers[i] = null; f(); }
        const q = rafQueue; rafQueue = []; cur = [];
        q.forEach((f) => f(now));
        if (q.length) { api.frames.push({ t: now, pts: cur }); onFrame?.(now); }
      }
    },
    move: (x, y) => { now += 16; L.pointermove({ clientX: x, clientY: y }); },
    ctl,
    get loopAlive() { return rafQueue.length > 0; },
  };
  return api;
}

// --- 1) расписание: первая стайка из нескольких лепестков, потом одиночные; лимит 28
{
  const s = await scene("a");
  s.run(1000);
  check(s.frames.length === 0, "первую секунду после загрузки лепестков нет");
  s.run(60000);
  const counts = s.frames.map((f) => f.pts.length);
  check(Math.max(...counts) >= 5, `бывают стайки из нескольких лепестков (пик ${Math.max(...counts)})`);
  check(Math.max(...counts) <= 28, "фоновых лепестков одновременно не больше 28");
  check(counts.some((c) => c === 1), "бывают и одиночные лепестки");
}

// --- 2) путь по диагонали и не по прямой
{
  const s = await scene("b");
  s.run(8000);
  // следим за первым лепестком: берём точки, ближайшие к предыдущей
  const track = []; let last = null;
  for (const f of s.frames) {
    if (!f.pts.length) continue;
    if (!last) last = f.pts[0];
    const p = f.pts.reduce((a, b) => (Math.hypot(b.x - last.x, b.y - last.y) < Math.hypot(a.x - last.x, a.y - last.y) ? b : a));
    track.push(p); last = p;
  }
  const dx = track.at(-1).x - track[0].x, dy = track.at(-1).y - track[0].y;
  check(Math.abs(dx) > 40 && dy > 80, `лепесток смещается и вбок и вниз (dx=${dx.toFixed(0)}, dy=${dy.toFixed(0)})`);
  // нелинейность: отклонение от прямой, соединяющей начало и конец
  const dev = Math.max(...track.map((p) => Math.abs((dy * (p.x - track[0].x) - dx * (p.y - track[0].y)) / Math.hypot(dx, dy))));
  check(dev > 4, `путь изгибается, а не прямая (макс. отклонение ${dev.toFixed(1)} px)`);
}

// --- 3) ветер: одинаковые сцены с курсором и без — траектории различаются; без движения курсора ветра нет
async function endPositions(tag, wind) {
  const s = await scene(tag);
  s.run(2600);                                   // идёт первая стайка
  const snapshotBefore = s.frames.at(-1).pts.map((p) => ({ ...p }));
  if (wind) {                                    // быстро проводим курсором через стайку
    const target = snapshotBefore[0];
    for (let i = 0; i < 12; i++) { s.move(target.x - 120 + i * 20, target.y); s.run(16); }
  }
  s.run(1500);
  return s.frames.at(-1).pts.map((p) => ({ ...p }));
}
{
  const calm = await endPositions("c1", false), windy = await endPositions("c2", true);
  const n = Math.min(calm.length, windy.length);
  let diff = 0; for (let i = 0; i < n; i++) diff = Math.max(diff, Math.hypot(calm[i].x - windy[i].x, calm[i].y - windy[i].y));
  check(diff > 25, `курсор отдувает лепестки: расхождение траекторий до ${diff.toFixed(0)} px`);
  check(diff < 600, "ветер мягкий: лепестки не вылетают за экран");
}

// --- 4) цикл останавливается, когда лепестков нет; в паузе между стайками кадры не считаются
{
  const s = await scene("d");
  s.run(60000);
  const quiet = s.frames.filter((f) => f.pts.length === 0).length;
  check(true, "пустых кадров, нарисованных впустую: " + quiet);
  check(quiet <= 2, "когда лепестков нет, цикл остановлен (≤ 2 пустых кадра подряд после последнего лепестка)");
}

// --- 5) шлейф у курсора (страница «Все расклады»): 2–4 лепестка за выброс, гаснут за ≤ 2 с, лимит 40, при неподвижном курсоре — нет
{
  const s = await scene("e");
  s.ctl.setTrail(true);
  s.run(200);
  s.move(200, 200); s.move(260, 220); s.run(16);
  const first = s.frames.at(-1).pts.length;
  check(first >= 2 && first <= 4, `выброс шлейфа: ${first} лепестка (2–4)`);
  for (let i = 0; i < 80; i++) { s.move(100 + i * 11, 300 + (i % 5) * 20); s.run(16); }
  check(Math.max(...s.frames.map((f) => f.pts.length)) <= 40, "лепестков одновременно не больше 40");
  s.run(2400);                                   // шлейф успел погаснуть (≤ 2 с)
  s.move(900, 500); s.run(16);                   // последнее реальное движение
  s.run(2400);
  const ambient = s.frames.at(-1)?.pts.length ?? 0;
  let maxStill = 0;
  for (let i = 0; i < 20; i++) { s.move(900, 500); s.run(16); maxStill = Math.max(maxStill, s.frames.at(-1)?.pts.length ?? 0); }
  check(maxStill <= ambient, `курсор замер — новых лепестков нет (было ${ambient}, стало ≤ ${maxStill})`);
  const off = await scene("f"); off.run(100); off.move(10, 10); off.move(300, 300); off.run(100);
  check(off.frames.length === 0, "вне «Все расклады» шлейф не создаётся");
}
process.exit(ok ? 0 : 1);
