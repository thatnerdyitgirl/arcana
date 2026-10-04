// Эффекты Arcana: падающие лепестки сакуры (Canvas) с ветром от курсора и звук на «Прочитать расклад».
// Принципы производительности: спрайт лепестка рисуется один раз; пул частиц фиксированного размера (≤ 28);
// цикл requestAnimationFrame работает только пока на экране есть лепестки; пауза при скрытой вкладке;
// pointermove — passive; расчёт ветра только для лепестков рядом с курсором.

const MAX_PETALS = 40;                   // всего на экране, включая шлейф у курсора
const WIND_RADIUS = 190;                 // px: на каком расстоянии курсор «дует»
const WIND_STRENGTH = 0.55;              // мягко: лепестки разлетаются, а не срываются
const rnd = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- лепестки

export function initPetals(canvas) {
  if (!canvas || matchMedia("(prefers-reduced-motion: reduce)").matches) { const noop = () => {}; noop.setTrail = () => {}; return noop; }
  const ctx = canvas.getContext("2d", { alpha: true });
  let dpr = 1, w = 0, h = 0, running = false, rafId = 0, prev = 0, count = 0, schedTimer = 0, stopped = false;

  // Один спрайт лепестка (рисуется однажды, дальше только drawImage)
  const S = 30;
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = S;
  (() => {
    const c = sprite.getContext("2d");
    const g = c.createRadialGradient(S / 2, S * 0.72, 1, S / 2, S / 2, S * 0.52);
    g.addColorStop(0, "#f9cdd7"); g.addColorStop(1, "#e690a5");
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(S / 2, 2);
    c.bezierCurveTo(S - 3, S * 0.28, S - 3, S * 0.7, S / 2, S - 2);
    c.bezierCurveTo(3, S * 0.7, 3, S * 0.28, S / 2, 2);
    c.fill();
    c.strokeStyle = "rgba(255,255,255,.4)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(S / 2, 5); c.lineTo(S / 2, S - 6); c.stroke();
  })();

  // Пул частиц: числовые массивы, без создания объектов в цикле
  const N = MAX_PETALS;
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const tvx = new Float32Array(N), tvy = new Float32Array(N);          // «целевая» скорость падения (до ветра)
  const rot = new Float32Array(N), vr = new Float32Array(N), size = new Float32Array(N);
  const phase = new Float32Array(N), sway = new Float32Array(N), freq = new Float32Array(N), born = new Float32Array(N), life = new Float32Array(N);  // life > 0 — лепесток шлейфа: гаснет за life секунд
  const alive = new Uint8Array(N);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
  }

  // dir: +1 слева направо по диагонали, −1 справа налево; ph — фаза изгиба пути (у стайки меняется плавно → «друг за дружкой»)
  function spawn(px, dir, ph, now) {
    if (count >= 28) return false;          // 12 мест всегда остаются для шлейфа у курсора
    for (let n = 0; n < N; n++) {
      if (alive[n]) continue;
      alive[n] = 1; count++;
      x[n] = px + rnd(-12, 12); y[n] = rnd(-34, -14);
      tvx[n] = dir * rnd(26, 40); tvy[n] = rnd(40, 56);
      vx[n] = tvx[n]; vy[n] = tvy[n] * 0.6;
      rot[n] = rnd(0, 6.28); vr[n] = rnd(-0.9, 0.9) + dir * 0.3;
      size[n] = rnd(10, 17); phase[n] = ph; sway[n] = rnd(26, 40); freq[n] = rnd(0.7, 1.0); born[n] = now; life[n] = 0;
      return true;
    }
    return false;
  }

  // шлейф у курсора (включается на странице «Все расклады»): 2–4 лепестка, падают, покачиваются и гаснут за 1.5–2 с
  let trailOn = false, lastTx = -1e9, lastTy = -1e9, lastTrailT = 0;
  function spawnTrail(px, py, now) {
    for (let n = 0; n < N; n++) {
      if (alive[n]) continue;
      alive[n] = 1; count++;
      x[n] = px + rnd(-10, 10); y[n] = py + rnd(-8, 8);
      tvx[n] = rnd(-14, 14); tvy[n] = rnd(30, 52); vx[n] = rnd(-16, 16); vy[n] = rnd(10, 30);
      rot[n] = rnd(0, 6.28); vr[n] = rnd(-1.6, 1.6); size[n] = rnd(9, 15);
      phase[n] = rnd(0, 6.28); sway[n] = rnd(18, 30); freq[n] = rnd(1.4, 2.2); born[n] = now; life[n] = rnd(1.5, 2.0);
      return;
    }
  }
  function trailMove(e, now) {
    if (!trailOn || now - lastTrailT < 45 || count >= N) return;
    const dx = e.clientX - lastTx, dy = e.clientY - lastTy;
    if (dx * dx + dy * dy < 24 * 24) return;                 // курсор замер — новых лепестков нет
    lastTx = e.clientX; lastTy = e.clientY; lastTrailT = now;
    const k = 2 + (Math.random() < 0.5 ? 1 : 0) + (Math.random() < 0.15 ? 1 : 0);
    for (let i = 0; i < k; i++) spawnTrail(e.clientX, e.clientY, now);
    start();
  }

  // ветер от курсора
  let wx = 0, wy = 0, mx = -1e4, my = -1e4, lastMoveT = 0;
  function onMove(e) {
    const now = performance.now(), dt = Math.max(now - lastMoveT, 8) / 1000;
    if (mx > -1e3 && now - lastMoveT < 200) {
      // сглаженная скорость курсора, px/с (ограничена, чтобы лепестки не «выстреливали»)
      wx = Math.max(-1400, Math.min(1400, (e.clientX - mx) / dt)) * 0.5 + wx * 0.5;
      wy = Math.max(-1400, Math.min(1400, (e.clientY - my) / dt)) * 0.5 + wy * 0.5;
    }
    mx = e.clientX; my = e.clientY; lastMoveT = now;
    trailMove(e, now);
    if (count > 0) start();
  }

  function frame(now) {
    const dt = Math.min((now - prev) / 1000, 0.05); prev = now;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const windOn = now - lastMoveT < 350;
    wx *= Math.exp(-dt * 5); wy *= Math.exp(-dt * 5);                  // ветер быстро затихает, если курсор замер
    const R2 = WIND_RADIUS * WIND_RADIUS;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      const age = (now - born[i]) / 1000;
      if (y[i] > h + 24 || x[i] < -60 || x[i] > w + 60 || (life[i] > 0 && age >= life[i])) { alive[i] = 0; count--; continue; }
      // неравномерное падение: боковая цель — синусоида (изгибающийся путь), вертикальная — слабое «порхание»
      const lat = Math.cos(age * freq[i] + phase[i]) * sway[i];
      const tx = tvx[i] + lat, ty = tvy[i] + Math.sin(age * 1.7 + phase[i]) * 9;
      const k = Math.min(1, dt * 1.3);
      vx[i] += (tx - vx[i]) * k; vy[i] += (ty - vy[i]) * k;
      // ветер: чем ближе к курсору и чем быстрее он двигается, тем сильнее отдувает
      if (windOn) {
        const dx = x[i] - mx, dy = y[i] - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const f = 1 - Math.sqrt(d2) / WIND_RADIUS, inf = f * f * WIND_STRENGTH;
          vx[i] += wx * inf * dt * 2.2; vy[i] += wy * inf * dt * 2.2;
          vr[i] += (wx > 0 ? 1 : -1) * inf * dt * 6;
        }
      }
      x[i] += vx[i] * dt; y[i] += vy[i] * dt; rot[i] += vr[i] * dt;
      const fadeIn = Math.min(1, age / (life[i] > 0 ? 0.15 : 0.7)), fadeOut = life[i] > 0 ? Math.max(0, 1 - Math.max(0, age / life[i] - 0.2) / 0.8) : Math.min(1, Math.max(0, (h + 14 - y[i]) / 140));
      ctx.globalAlpha = 0.78 * fadeIn * fadeOut;
      const sx = 0.35 + 0.65 * Math.abs(Math.cos(age * 1.6 + phase[i] * 2));       // кувырок: лепесток «переворачивается»
      const c = Math.cos(rot[i]), sn = Math.sin(rot[i]), sz = size[i];
      ctx.setTransform(dpr * c * sx, dpr * sn * sx, -dpr * sn, dpr * c, x[i] * dpr, y[i] * dpr);
      ctx.drawImage(sprite, -sz / 2, -sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    if (count > 0) rafId = requestAnimationFrame(frame);
    else { running = false; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }   // лепестков нет — цикл останавливается
  }

  function start() { if (running || document.hidden || stopped) return; running = true; prev = performance.now(); rafId = requestAnimationFrame(frame); }

  // Расписание: то стайка из нескольких лепестков по диагонали друг за другом, то один — чуть позже
  const creative = () => document.body?.dataset?.world === "creative";
  function releaseGroup(n) {
    const dir = Math.random() < 0.5 ? 1 : -1, px = dir > 0 ? rnd(0.04, 0.45) * w : rnd(0.55, 0.96) * w, ph0 = rnd(0, 6.28);
    for (let k = 0; k < n; k++) setTimeout(() => { if (!document.hidden && !stopped) { spawn(px, dir, ph0 + k * 0.32, performance.now()); start(); } }, k * rnd(260, 420));
  }
  function schedule(afterGroup) {
    const q = creative() ? 0.55 : 1;
    const delay = (afterGroup ? rnd(3000, 6000) : rnd(6000, 11000)) * q;
    schedTimer = setTimeout(() => {
      if (!document.hidden && !stopped) {
        if (afterGroup) { spawn(rnd(0.08, 0.92) * w, Math.random() < 0.5 ? 1 : -1, rnd(0, 6.28), performance.now()); start(); }
        else releaseGroup(Math.round(rnd(5, 8) * (creative() ? 1.2 : 1)));
      }
      schedule(!afterGroup);
    }, delay);
  }

  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 150); };
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(rafId); running = false; } else if (count > 0) start(); };

  resize();
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVis);
  // первая стайка — вскоре после загрузки, чтобы эффект был замечен
  setTimeout(() => { if (!stopped) { releaseGroup(6); schedule(true); } }, 1800);
  const api = () => {
    stopped = true; clearTimeout(schedTimer); cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onMove); window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
  };
  api.setTrail = (v) => { trailOn = !!v; };
  return api;
}

// ---------------------------------------------------------------- звук
// Звук только один раз — при нажатии «Прочитать расклад». Файл assets/read.mp3 (в собранной версии встроен).

export function createReadSound(src, volume = 0.5) {
  let audio = null;
  return function play() {
    try {
      if (!audio) { audio = new Audio(src); audio.preload = "auto"; audio.volume = volume; }
      audio.currentTime = 0;
      audio.play().catch(() => {});      // если браузер не разрешил — молча пропускаем
    } catch {}
  };
}
