// Карта дня и картинки для сторис: один рисовальщик (canvas) для превью в приложении и для PNG 1080×1920.
// Три стиля: A «Тушь», B «Рассвет», C «Ночь». Все иллюстрации нарисованы кодом, внешних картинок нет.
// Имена с префиксом dc: все модули собираются в один скоуп.

const DC_STYLES = [
  { id: "A", label: "Тушь" },
  { id: "B", label: "Рассвет" },
  { id: "C", label: "Ночь" },
];
const DC_INK = {
  A: { bg: "#f3ede0", text: "#2f3b36" },
  B: { bg: "#ecc9d6", text: "#4a2f45" },
  C: { bg: "#0b1220", text: "#f2ead8" },
};
const dcFont = (px, kind = "display") => `${px}px ${kind === "ui" ? '"Golos Text", system-ui, sans-serif' : '"Forum", Georgia, serif'}`;

/** Цитата дня: детерминированно по локальной дате; shift сдвигает выбор («другая цитата»). */
function dcQuoteOfDay(quotes, date = new Date(), shift = 0) {
  const n = quotes.length;
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return quotes[(((day * 7 + shift) % n) + n) % n];
}

/** Стиль «Авто»: светлая тема → «Тушь», тёмная → «Ночь». */
const dcAutoStyle = (dark) => (dark ? "C" : "A");

function dcSpaced(ctx, text, cx, y, sp) {
  const chars = [...text];
  const w = chars.reduce((a, c) => a + ctx.measureText(c).width + sp, -sp);
  let x = cx - w / 2;
  ctx.textAlign = "left";
  for (const c of chars) { ctx.fillText(c, x, y); x += ctx.measureText(c).width + sp; }
}

function dcWrap(ctx, text, maxW) {
  const lines = []; let line = "";
  for (const w of text.split(/\s+/)) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function dcBackdrop(ctx, W, H, style) {
  const s = W / 360, k = (x) => x * s;
  if (style === "A") {
    ctx.fillStyle = "#f3ede0"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#2f3b36"; ctx.globalAlpha = 0.85; ctx.lineWidth = k(9); ctx.lineCap = "round";
    const a0 = (-70 * Math.PI) / 180;
    ctx.beginPath(); ctx.arc(k(180), k(150), k(74), a0, a0 + (420 / 74)); ctx.stroke();
    ctx.globalAlpha = 0.85; ctx.fillStyle = "#b9737f"; ctx.beginPath(); ctx.arc(k(256), k(86), k(7), 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    const hill = (y, c, a, amp) => { ctx.globalAlpha = a; ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, k(y));
      ctx.quadraticCurveTo(k(70), k(y - amp), k(130), k(y - amp * 0.3)); ctx.quadraticCurveTo(k(210), k(y + amp * 0.3), k(260), k(y - amp * 0.4));
      ctx.quadraticCurveTo(k(330), k(y - amp * 0.7), W, k(y - amp * 0.2)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill(); };
    const bottom = H / s; // высота в «условных» 360-пикселях
    hill(bottom - 120, "#9aa89c", 0.35, 70); hill(bottom - 80, "#7d8f82", 0.45, 50); hill(bottom - 40, "#5f7366", 0.55, 36);
    ctx.globalAlpha = 1;
  } else if (style === "B") {
    const g = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, H);
    g.addColorStop(0, "#f8dccb"); g.addColorStop(0.55, "#ecc9d6"); g.addColorStop(1, "#c7c4e8");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(k(180), k(190), k(110), 0, 7); ctx.fill();
    ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(k(180), k(190), k(74), 0, 7); ctx.fill();
    ctx.globalAlpha = 0.25; ctx.strokeStyle = "#4a2f45"; ctx.lineWidth = Math.max(1, k(1));
    const bottom = H / s;
    for (const [x1, x2, y] of [[40, 320, bottom - 170], [80, 280, bottom - 156], [130, 230, bottom - 142]]) { ctx.beginPath(); ctx.moveTo(k(x1), k(y)); ctx.lineTo(k(x2), k(y)); ctx.stroke(); }
    ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.moveTo(0, k(bottom - 80));
    ctx.quadraticCurveTo(k(90), k(bottom - 120), k(180), k(bottom - 92)); ctx.quadraticCurveTo(k(270), k(bottom - 64), W, k(bottom - 100)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    const g = ctx.createLinearGradient(0, 0, W * 0.15, H);
    g.addColorStop(0, "#0b1220"); g.addColorStop(1, "#1c2744");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    const bottom = H / s;
    for (let i = 0; i < 70; i++) { // звёзды: фиксированное расположение
      const x = (i * 97) % 360, y = ((i * 53) % Math.floor(bottom - 120)), r = i % 5 ? 0.7 : 1.3;
      ctx.globalAlpha = 0.35 + (i % 4) * 0.15; ctx.beginPath(); ctx.arc(k(x), k(y), k(r), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // месяц: круг луны минус сдвинутый круг (чётное-нечётное внутри clip)
    ctx.save(); ctx.beginPath(); ctx.arc(k(180), k(160), k(48), 0, 7); ctx.clip();
    ctx.fillStyle = "#f2ead8"; ctx.beginPath(); ctx.arc(k(180), k(160), k(48), 0, 7); ctx.moveTo(k(198 + 46), k(148)); ctx.arc(k(198), k(148), k(46), 0, 7);
    ctx.fill("evenodd"); ctx.restore();
    ctx.fillStyle = "#070b15"; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(0, k(bottom - 50));
    ctx.quadraticCurveTo(k(100), k(bottom - 80), k(190), k(bottom - 55)); ctx.quadraticCurveTo(k(280), k(bottom - 30), W, k(bottom - 65)); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function dcFrame(ctx, W, H, style, kicker) {
  const s = W / 360, c = DC_INK[style].text;
  dcBackdrop(ctx, W, H, style);
  ctx.fillStyle = c; ctx.textBaseline = "alphabetic";
  ctx.globalAlpha = 0.7; ctx.font = dcFont(11 * s, "ui"); dcSpaced(ctx, kicker.toUpperCase(), W / 2, 38 * s, 3.3 * s);
  ctx.globalAlpha = 0.6; ctx.font = dcFont(11 * s, "ui"); dcSpaced(ctx, "ARCANA ZEN", W / 2, H - 22 * s, 2.4 * s);
  ctx.globalAlpha = 1;
  return { s, c };
}

/** Карта дня: цитата по центру, источник под ней. */
function dcDrawQuote(canvas, style, quote) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
  const { s, c } = dcFrame(ctx, W, H, style, "Карта дня");
  const maxW = W - 72 * s;
  let size = 27 * s, lines;
  for (; size > 15 * s; size -= s) { ctx.font = dcFont(size); lines = dcWrap(ctx, quote.t, maxW); if (lines.length <= 7) break; }
  const lh = size * 1.3, blockH = lines.length * lh + 22 * s + 14 * s;
  let y = Math.max(H * 0.5 - blockH / 2, H * 0.38);
  ctx.fillStyle = c; ctx.font = dcFont(size); ctx.textAlign = "center";
  for (const l of lines) { y += lh; ctx.fillText(l, W / 2, y); }
  ctx.globalAlpha = 0.75; ctx.font = dcFont(12 * s, "ui"); y += 26 * s;
  dcSpaced(ctx, quote.s.toUpperCase(), W / 2, y, 1.7 * s); ctx.globalAlpha = 1;
}

/** Расклад для сторис: название, три позиции с картами. Ситуацию и разбор не выводим. */
function dcDrawSpread(canvas, style, { title, deck, rows }) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext("2d");
  const { s, c } = dcFrame(ctx, W, H, style, deck ? `${deck} · расклад` : "Расклад");
  ctx.fillStyle = c; ctx.textAlign = "center";
  const maxW = W - 64 * s, gap = 26 * s;
  const tSize = 26 * s; ctx.font = dcFont(tSize);
  const tl = dcWrap(ctx, title, maxW);
  ctx.font = dcFont(12.5 * s, "ui");
  const blocks = rows.map((r) => ({ r, pl: dcWrap(ctx, r.pos, maxW).slice(0, 2) }));
  const rowH = (b) => b.pl.length * 17 * s + 30 * s;
  const total = tl.length * tSize * 1.25 + 22 * s + blocks.reduce((a, b) => a + rowH(b) + gap, -gap);
  let y = Math.max(H * 0.5 - total / 2, H * 0.4);
  ctx.font = dcFont(tSize);
  for (const l of tl) { y += tSize * 1.25; ctx.fillText(l, W / 2, y); }
  y += 14 * s;
  for (const b of blocks) {
    ctx.globalAlpha = 0.65; ctx.font = dcFont(12.5 * s, "ui"); ctx.textAlign = "center";
    for (const l of b.pl) { y += 17 * s; ctx.fillText(l, W / 2, y); }
    ctx.globalAlpha = 1; let cs = 22 * s; ctx.font = dcFont(cs);
    while (ctx.measureText(b.r.card).width > maxW && cs > 14 * s) { cs -= s; ctx.font = dcFont(cs); }
    y += 28 * s; ctx.fillText(b.r.card, W / 2, y); y += gap;
  }
}

/** PNG 1080×1920: делится через системное меню, если оно умеет файлы, иначе скачивается. */
async function dcSave(drawFn, name) {
  try { await document.fonts?.load('27px "Forum"'); await document.fonts?.load('11px "Golos Text"'); } catch { /* шрифты подтянутся по умолчанию */ }
  const cv = document.createElement("canvas"); cv.width = 1080; cv.height = 1920; drawFn(cv);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  if (!blob) return "error";
  const file = new File([blob], name + ".png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Arcana Zen" }); return "shared"; }
    catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name + ".png";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}
