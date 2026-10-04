// Фон-сцена Arcana. Каждый «мир» один раз рисуется в готовый растровый слой (SVG-фильтры дорогие),
// дальше переключение миров — это только плавное наложение двух готовых слоёв (opacity на GPU),
// без перерисовки пейзажа на каждом кадре. Остальное в комментариях по месту.

const MASK_DESKTOP = (ctx, W, H) => {              // центр с текстом приглушён, пейзаж живёт по краям
  ctx.save();
  ctx.translate(W * 0.5, H * 0.44); ctx.scale(W * 0.36, H * 0.58);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, "rgba(0,0,0,.14)"); g.addColorStop(0.55, "rgba(0,0,0,.24)"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120);
  ctx.restore();
};
const MASK_BAND = (ctx, W, H, top) => {            // телефон: пейзаж полосой внизу экрана
  const g = ctx.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.3, "rgba(0,0,0,.55)"); g.addColorStop(0.6, "#000"); g.addColorStop(1, "#000");
  ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
};

const SELECTORS = /^(\.st-|\.fill-|\.stroke-|\.reflection|\.water-lines|\.ripple|\.strand-g|\.fall|\.paths|\.brush|\.rain-line|\.blossoms)/;
const WORLDS = ["lotus", "relations", "work", "decision", "self", "psyche", "creative"];
const MAX_LAYERS = 8;

export function initScene(stage, src, probe) {
  if (!stage || !src || !probe) return { show() {}, refresh() {} };
  const cache = new Map();                 // ключ → { canvas, promise }
  let current = null, shown = null, token = 0, prerenderTimer = 0, resizeTimer = 0;

  const theme = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const mobile = () => window.matchMedia("(max-width: 640px)").matches;
  const dims = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const k = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1440 / vw, 2));
    return { W: Math.round(vw * k), H: Math.round(vh * k), band: mobile() };
  };
  const keyOf = (world) => { const d = dims(); return `${world}|${theme()}|${d.W}x${d.H}|${d.band ? "m" : "d"}`; };

  // CSS-правила, которые красят внутренности SVG (классы fill-*, stroke-* …) — выбираем один раз
  let ruleTemplates = null;
  function collectRules() {
    if (ruleTemplates) return ruleTemplates;
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules) if (r.type === 1 && SELECTORS.test(r.selectorText.trim())) out.push(r.cssText);
    }
    return (ruleTemplates = out);
  }

  // Снимок мира: палитра и прозрачность слоёв, посчитанные браузером по тем же CSS-правилам
  function snapshot(world) {
    probe.dataset.world = world;
    const cs = getComputedStyle(probe);
    const resolve = (txt) => txt.replace(/var\((--[\w-]+)\)/g, (_, n) => cs.getPropertyValue(n).trim() || "transparent");
    const probeSvg = probe.firstElementChild;
    const opacities = [...probeSvg.querySelectorAll(".L")].map((el) => getComputedStyle(el).opacity);
    return { paper: cs.getPropertyValue("--paper").trim() || "#f6f1e6", css: collectRules().map(resolve).join("\n"), opacities };
  }

  function buildSvg(snap, w, h, band) {
    const svg = src.cloneNode(true);
    ["class", "style", "id", "aria-hidden"].forEach((a) => svg.removeAttribute(a));
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", w); svg.setAttribute("height", h);
    svg.setAttribute("preserveAspectRatio", band ? "xMidYMax meet" : "xMidYMid slice");
    [...svg.querySelectorAll(".L")].forEach((el, i) => el.setAttribute("opacity", snap.opacities[i] ?? "0"));
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = snap.css;
    svg.insertBefore(style, svg.firstChild);
    return new XMLSerializer().serializeToString(svg);
  }

  async function render(world) {
    const { W, H, band } = dims();
    const snap = snapshot(world);
    const bandH = Math.round(H * 0.46);
    const w = W, h = band ? bandH : H;
    const img = new Image();
    const loaded = new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("scene image failed")); });
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buildSvg(snap, w, h, band));
    await loaded;                                    // onload надёжнее decode() в Safari
    // 1) пейзаж + маска; 2) на непрозрачной бумаге мира
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const o = off.getContext("2d");
    o.drawImage(img, 0, band ? H - bandH : 0, w, h);
    o.globalCompositeOperation = "destination-in";
    if (band) MASK_BAND(o, W, H, H - bandH); else MASK_DESKTOP(o, W, H);
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    canvas.className = "scene-layer";
    const c = canvas.getContext("2d");
    c.fillStyle = snap.paper; c.fillRect(0, 0, W, H);
    c.drawImage(off, 0, 0);
    return canvas;
  }

  function getLayer(world) {
    const key = keyOf(world);
    let e = cache.get(key);
    if (!e) {
      e = { key, canvas: null, promise: null };
      e.promise = render(world).then((canvas) => { e.canvas = canvas; stage.appendChild(canvas); trim(); return canvas; });
      cache.set(key, e);
    }
    return e.promise;
  }

  function trim() {                          // держим в памяти не больше MAX_LAYERS слоёв
    if (cache.size <= MAX_LAYERS) return;
    for (const [k, e] of cache) {
      if (cache.size <= MAX_LAYERS) break;
      if (e.canvas && e.canvas !== shown) { e.canvas.remove(); cache.delete(k); }
    }
  }

  function crossfade(next) {
    if (next === shown) return;
    const prev = shown; shown = next;
    next.style.visibility = "visible";
    void next.offsetWidth;                   // зафиксировать начальное состояние перед переходом
    next.style.opacity = "1";
    if (prev) {
      prev.style.opacity = "0";
      setTimeout(() => { if (prev !== shown) prev.style.visibility = "hidden"; }, 1000);
    }
  }

  async function show(world) {
    current = world;
    const my = ++token;
    let layer;
    try { layer = await getLayer(world); }
    catch (err) { cache.delete(keyOf(world)); console.warn("Фон не отрисован:", err); return; }   // без фона приложение продолжает работать на однотонной бумаге
    if (my !== token || current !== world) return;      // пока рисовали, пользователь перешёл дальше
    crossfade(layer);
    schedulePrerender();
  }

  // Остальные миры дорисовываем в свободное время, чтобы дальше переключения были мгновенными
  function schedulePrerender() {
    clearTimeout(prerenderTimer);
    const queue = WORLDS.filter((w) => !cache.has(keyOf(w)));
    if (!queue.length) return;
    const step = () => {
      const next = WORLDS.find((w) => !cache.has(keyOf(w)));
      if (!next || document.hidden) return;
      const run = () => getLayer(next).then(() => { prerenderTimer = setTimeout(step, 250); }, () => { cache.delete(keyOf(next)); });
      (window.requestIdleCallback ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 0));
    };
    prerenderTimer = setTimeout(step, 900);
  }

  function reset() {                         // тема или размер окна изменились — готовые слои больше не подходят
    clearTimeout(prerenderTimer);
    for (const e of cache.values()) e.canvas?.remove();
    cache.clear(); shown = null;
    if (current) show(current);
  }
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(reset, 300); }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) schedulePrerender(); });

  return { show, refresh: reset };
}
