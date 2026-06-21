'use strict';

// Рендер «видений» (логика — visions.js). Призрачные ХОЛОДНЫЕ силуэты, БЕЗ светлых пятен и тонов.
// ПЕРФ: НЕТ ctx.filter (blur в Canvas2D — десятки мс) и НЕТ офскрин-буфера (render→drawImage давал
// GPU-столл ~30мс на сложной форме). Силуэт рисуется ПРЯМО (форма ~0.004мс даже при ~12 перерисовках:
// ореол/2-tap/срезы/датамош), сканлайны — кэш-паттерн (1 fillRect). Анимация: дыхание/покачивание/
// «дёрг» + живые конечности. Щупальца тянутся к юниту и пропадают недотянувшись.

function _vrng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _vrr(r, a, b) { return a + (b - a) * r(); }
function _vh(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3) | 0; n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return n >>> 0; }
const _vcold = (a) => `rgba(92,99,108,${a})`;            // нейтрально-холодный призрак
const _vvoid = (a) => `rgba(7,5,10,${a})`;               // тьма (затемнение, НЕ свет)
// БЕЗ `ctx.filter` (blur в Canvas2D дорог — десятки мс) и БЕЗ офскрин-буфера (render-в-canvas →
// drawImage даёт GPU-столл ~30мс на сложной форме). Силуэт рисуется ПРЯМО на canvas (форма ~0.004мс),
// мягкость — overscale-ореол + лёгкий 2-tap + edge-fade; глитч — повторная отрисовка формы со сдвигом.
// кэш-паттерн сканлайнов (3px тьмы + 3px прозрачных) — заливается ОДНИМ fillRect вместо ~сотни
let _vScanPat = null;
function _vScanPattern(ctx) {
  if (_vScanPat) return _vScanPat;
  const cn = document.createElement('canvas'); cn.width = 2; cn.height = 6;
  const x = cn.getContext('2d'); x.fillStyle = _vvoid(1); x.fillRect(0, 0, 2, 3);
  _vScanPat = ctx.createPattern(cn, 'repeat'); return _vScanPat;
}

function drawVisions(ctx, visions, W, H, t, ux, uy) {
  if (!visions || !visions.list.length) return;
  for (const v of visions.list) {
    if (v.alpha <= 0.004) continue;
    const fl = 0.55 + 0.45 * Math.abs(Math.sin(t * 6 + v.seed)) * Math.abs(Math.sin(t * 1.7 + v.seed * 0.31));
    _drawVision(ctx, v, v.alpha * fl, t, ux, uy);
  }
}

function _drawVision(ctx, v, a, t, ux, uy) {
  if (v.type === 'tendrils') { if (ux != null) _vTendrils(ctx, v, a, t, ux, uy); return; }   // самостоятельный призрак — только щупальца
  if (v.type === 'glyphs') { _vGlyphs(ctx, v, a, t); return; }                                // лента ацтек-узоров, бегут L→R

  // анимация: дыхание (масштаб от низа) + покачивание + редкий «дёрг» сигнала
  const ph = (v.seed % 1000) * 0.01;
  const breath = 1 + Math.sin(t * 0.9 + ph) * 0.02;
  const sway = Math.sin(t * 0.45 + ph) * v.w * 0.015, bob = Math.sin(t * 0.7 + ph) * v.h * 0.012;
  const judder = (Math.sin(t * 17 + ph) > 0.93) ? Math.sin(t * 130) * 6 : 0;

  ctx.save();
  ctx.translate(v.x + sway + judder, v.y + bob);
  ctx.translate(v.w * 0.5, v.h); ctx.scale(breath, breath); ctx.translate(-v.w * 0.5, -v.h);

  // форма рисуется ПРЯМО на canvas (свежий rng → силуэт идентичен при каждой перерисовке)
  const shape = () => _visionShape(ctx, v.type, _vrng(v.seed), v.w, v.h, t);

  // ── мягкость БЕЗ filter/офскрина: overscale-ореол + лёгкий 2-tap + форма ──
  ctx.save(); ctx.translate(v.w * 0.5, v.h * 0.5); ctx.scale(1.1, 1.1); ctx.translate(-v.w * 0.5, -v.h * 0.5); ctx.fillStyle = _vcold(a * 0.4); shape(); ctx.restore();
  ctx.fillStyle = _vcold(a * 0.6);
  ctx.save(); ctx.translate(1.3, 0); shape(); ctx.restore();
  ctx.save(); ctx.translate(-1.3, 0); shape(); ctx.restore();
  ctx.fillStyle = _vcold(a); shape();

  // ── мерцающие глитч-срезы: форма со сдвигом, клип по полосе ──
  for (let i = 0; i < 2; i++) {
    if (Math.sin(t * (3.3 + i) + v.seed) < 0.25) continue;
    const by = (Math.abs(Math.sin(t * 0.8 + i * 2.1 + v.seed)) * v.h) | 0;
    const sh = 6 + (Math.sin(t * 5 + i) + 1) * 9, dx = Math.sin(t * 11 + i * 3 + v.seed) * 9;
    ctx.save(); ctx.beginPath(); ctx.rect(0, by, v.w, sh); ctx.clip(); ctx.translate(dx, 0); ctx.fillStyle = _vcold(a * 0.5); shape(); ctx.restore();
  }

  // ── тёмные глитч-КВАДРАТЫ: «выпадение сигнала» (void) + датамош (форма со сдвигом в квадрате) ──
  const frame = (t * 6) | 0;
  for (let i = 0; i < 6; i++) {
    const sd = i * 131 + v.seed;
    if (Math.sin(t * (5 + i * 0.6) + sd) < 0.5) continue;
    const qx = (_vh(sd + frame) % 1000) / 1000 * v.w, qy = (_vh(sd * 3 + frame) % 1000) / 1000 * v.h;
    const qw = 10 + (_vh(sd + 7) % 5) * 9, qh = 7 + (_vh(sd + 13) % 4) * 7;
    if (_vh(sd + frame * 2) % 3 === 0) { ctx.fillStyle = _vvoid(Math.min(0.5, a * 4.5)); ctx.fillRect(qx, qy, qw, qh); }
    else { ctx.save(); ctx.beginPath(); ctx.rect(qx, qy, qw, qh); ctx.clip(); ctx.translate((_vh(sd + 9) % 11) - 5, 0); ctx.fillStyle = _vcold(a * 0.5); shape(); ctx.restore(); }
  }

  // ── тёмные сканлайны-помехи: ПАТТЕРН (1 заливка вместо ~сотни fillRect) ──
  ctx.save();
  ctx.fillStyle = _vScanPattern(ctx); ctx.globalAlpha = Math.min(0.4, a * 2.2);
  ctx.translate(0, (t * 36) % 6 - 6); ctx.fillRect(0, 0, v.w, v.h + 6);
  ctx.restore();

  // ── МЯГКИЙ край: плавный многоступенчатый фейд в тьму (нет резкой кромки) ──
  const vg = ctx.createRadialGradient(v.w * 0.5, v.h * 0.45, 0, v.w * 0.5, v.h * 0.5, Math.max(v.w, v.h) * 0.72);
  vg.addColorStop(0, _vvoid(0)); vg.addColorStop(0.45, _vvoid(0));
  vg.addColorStop(0.7, _vvoid(a * 1.6)); vg.addColorStop(0.86, _vvoid(a * 3.4)); vg.addColorStop(1, _vvoid(a * 6));
  ctx.fillStyle = vg; ctx.fillRect(-16, -16, v.w + 32, v.h + 32);
  ctx.restore();
}

// САМОСТОЯТЕЛЬНЫЙ призрак-щупальца: 3 КРУПНЫЕ тёмные ленты тянутся от тёмного края к юниту и
// ПРОПАДАЮТ НЕДОТЯНУВШИСЬ (вылет <1 дистанции + reach пульсирует 0→max→0 + тающий кончик).
function _vTendrils(ctx, v, a, t, ux, uy) {
  const ox = v.x + v.w * 0.5, oy = v.y + v.h * 0.5;
  const dx = ux - ox, dy = uy - oy, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist, px = -ny, py = nx;
  ctx.save();
  const N = 3, seg = 10;
  for (let k = 0; k < N; k++) {
    const reach = Math.sin(t * 0.5 + k * 2.1 + v.seed * 0.7);
    if (reach < 0.05) continue;                          // фаза втягивания — щупальца нет
    const len = dist * (0.62 + 0.1 * Math.sin(v.seed + k)) * reach;    // <1 → не дотягивается
    const lat = (k - (N - 1) / 2) * 0.16 * dist;         // широкий веер
    const baseW = 12 + 3 * Math.sin(v.seed + k * 2);     // ТОЛСТЫЕ у основания
    const pts = [];
    for (let s = 0; s <= seg; s++) { const f = s / seg, wob = Math.sin(t * 2.0 + f * 5 + k * 3 + v.seed) * 22 * f, al = len * f; pts.push([ox + nx * al + px * (lat * f + wob), oy + ny * al + py * (lat * f + wob), (1 - f) * baseW]); }
    // мягкость без ctx.filter: широкая бледная подложка + основная лента
    const ribbon = (wm, am) => {
      ctx.fillStyle = _vcold(a * 0.8 * am); ctx.beginPath();
      for (let s = 0; s < pts.length; s++) { const hw = pts[s][2] * wm + 0.5; if (s === 0) ctx.moveTo(pts[s][0] + px * hw, pts[s][1] + py * hw); else ctx.lineTo(pts[s][0] + px * hw, pts[s][1] + py * hw); }
      for (let s = pts.length - 1; s >= 0; s--) { const hw = pts[s][2] * wm + 0.5; ctx.lineTo(pts[s][0] - px * hw, pts[s][1] - py * hw); }
      ctx.closePath(); ctx.fill();
    };
    ribbon(1.8, 0.35); ribbon(1.0, 1.0);
  }
  ctx.restore();
}

function _visionShape(ctx, type, r, w, h, t) {
  if (type === 'monster') _visionMonster(ctx, r, w, h, t);
  else if (type === 'idol') _visionIdol(ctx, r, w, h, t);
  else _visionLandscape(ctx, r, w, h, t);
}

// один «ключ»-меандр (ацтекско-греческий узор), обводкой, в боксе s×s
function _grecaUnit(ctx, x, y, s) {
  const u = s / 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 4 * u); ctx.lineTo(x, y); ctx.lineTo(x + 4 * u, y); ctx.lineTo(x + 4 * u, y + 4 * u);
  ctx.lineTo(x + u, y + 4 * u); ctx.lineTo(x + u, y + u); ctx.lineTo(x + 3 * u, y + u); ctx.lineTo(x + 3 * u, y + 3 * u); ctx.lineTo(x + 2 * u, y + 3 * u);
  ctx.stroke();
}
// ацтекско-киберпанк УЗОРЫ — лента меандров, бежит слева→направо (ряды с паралаксом).
// Рисуется ПРЯМО (обводки дёшевы, ~0.1мс) — без офскрина/filter.
function _vGlyphs(ctx, v, a, t) {
  ctx.save();
  ctx.beginPath(); ctx.rect(v.x, v.y, v.w, v.h); ctx.clip();
  ctx.strokeStyle = _vcold(a * 0.9); ctx.lineCap = 'square';
  const rows = 3, rh = v.h / rows;
  for (let r = 0; r < rows; r++) {
    const s = rh * 0.66, ry = v.y + r * rh + (rh - s) / 2; ctx.lineWidth = Math.max(1.5, s * 0.07);
    const period = s * 1.5, off = (t * (16 + r * 9)) % period;     // ряды бегут с разной скоростью
    for (let x = v.x - period; x < v.x + v.w + period; x += period) _grecaUnit(ctx, x + off, ry, s);
  }
  const gh = ctx.createLinearGradient(v.x, 0, v.x + v.w, 0);
  gh.addColorStop(0, _vvoid(a * 5)); gh.addColorStop(0.18, _vvoid(0)); gh.addColorStop(0.82, _vvoid(0)); gh.addColorStop(1, _vvoid(a * 5));
  ctx.fillStyle = gh; ctx.fillRect(v.x, v.y, v.w, v.h);
  const gv = ctx.createLinearGradient(0, v.y, 0, v.y + v.h);
  gv.addColorStop(0, _vvoid(a * 4)); gv.addColorStop(0.32, _vvoid(0)); gv.addColorStop(0.68, _vvoid(0)); gv.addColorStop(1, _vvoid(a * 4));
  ctx.fillStyle = gv; ctx.fillRect(v.x, v.y, v.w, v.h);
  ctx.restore();
}

// колоссальный ИДОЛ-тотем: стопка ступеней + маска-«корона» с вырезанными нишами глаз/рта
function _visionIdol(ctx, r, w, h, t) {
  const cx = w * 0.5, sway = Math.sin(t * 0.3) * w * 0.005;
  let y = h, tw = w * _vrr(r, 0.52, 0.64);
  for (let i = 0; i < 5; i++) { const th = h * 0.13; ctx.fillRect(cx - tw / 2 + sway, y - th, tw, th); y -= th; tw *= _vrr(r, 0.9, 0.98); }
  const hw = w * _vrr(r, 0.5, 0.62), hy = Math.max(0, y - (h - y) - h * 0.02), hh = y - hy;
  ctx.fillRect(cx - hw / 2 + sway, hy, hw, hh);                                  // маска-голова
  ctx.fillRect(cx - hw / 2 - w * 0.06 + sway, hy + hh * 0.1, w * 0.06, hh * 0.42);  // ступени-корона по бокам
  ctx.fillRect(cx + hw / 2 + sway, hy + hh * 0.1, w * 0.06, hh * 0.42);
  ctx.save(); ctx.globalCompositeOperation = 'destination-out';                  // ниши глаз/рта = тьма
  const ey = hy + hh * 0.4, es = hw * 0.17;
  ctx.fillRect(cx - hw * 0.27 + sway, ey, es, es * 0.7);
  ctx.fillRect(cx + hw * 0.1 + sway, ey, es, es * 0.7);
  ctx.fillRect(cx - hw * 0.2 + sway, ey + hh * 0.3, hw * 0.4, es * 0.5);
  ctx.restore();
}

function _vlimb(ctx, x, y, wid, len, ang) {
  const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len, px = Math.cos(ang), py = -Math.sin(ang);
  ctx.beginPath();
  ctx.moveTo(x - px * wid * 0.5, y - py * wid * 0.5); ctx.lineTo(x + px * wid * 0.5, y + py * wid * 0.5);
  ctx.lineTo(ex + px * wid * 0.22, ey + py * wid * 0.22); ctx.lineTo(ex - px * wid * 0.22, ey - py * wid * 0.22);
  ctx.closePath(); ctx.fill();
}
function _vseg(ctx, x1, y1, x2, y2, w1, w2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, px = -dy / L, py = dx / L;
  ctx.beginPath();
  ctx.moveTo(x1 + px * w1 * 0.5, y1 + py * w1 * 0.5); ctx.lineTo(x1 - px * w1 * 0.5, y1 - py * w1 * 0.5);
  ctx.lineTo(x2 - px * w2 * 0.5, y2 - py * w2 * 0.5); ctx.lineTo(x2 + px * w2 * 0.5, y2 + py * w2 * 0.5);
  ctx.closePath(); ctx.fill();
}
function _vstride(ctx, hipX, hipY, footX, g, wid, kneeOut) {
  const kx = (hipX + footX) / 2 + kneeOut, ky = (hipY + g) * 0.52;
  _vseg(ctx, hipX, hipY, kx, ky, wid, wid * 0.85); _vseg(ctx, kx, ky, footX, g, wid * 0.85, wid * 0.45);
}

// КОЛОССАЛЬНЫЙ ШАГОХОД: корпус на длинных раскоряченных ногах (широкие просветы → читается даже размытым)
function _visionMonster(ctx, r, w, h, t) {
  const cx = w * 0.5, g = h;
  const hullTop = h * _vrr(r, 0.12, 0.20), hullBot = h * _vrr(r, 0.40, 0.48), hullW = w * _vrr(r, 0.40, 0.52);
  const foot = w * _vrr(r, 0.30, 0.38), legW = w * _vrr(r, 0.05, 0.075);
  const stride = Math.sin(t * 1.1) * w * 0.035, bob = Math.abs(Math.sin(t * 1.1)) * h * 0.012;
  ctx.save(); ctx.globalAlpha *= 0.5;
  _vstride(ctx, cx + hullW * 0.18, hullBot - bob, cx + foot * 0.4, g, legW, w * 0.06 - stride);
  ctx.restore();
  _vstride(ctx, cx - hullW * 0.22, hullBot - bob, cx - foot, g, legW, -w * 0.07 + stride);
  _vstride(ctx, cx + hullW * 0.22, hullBot - bob, cx + foot, g, legW, w * 0.07 - stride);
  ctx.save(); ctx.translate(0, -bob);
  ctx.beginPath();
  ctx.moveTo(cx - hullW * 0.5, hullBot);
  ctx.quadraticCurveTo(cx - hullW * 0.6, hullTop + (hullBot - hullTop) * 0.35, cx - hullW * 0.3, hullTop);
  ctx.quadraticCurveTo(cx, hullTop - h * 0.045, cx + hullW * 0.3, hullTop);
  ctx.quadraticCurveTo(cx + hullW * 0.6, hullTop + (hullBot - hullTop) * 0.35, cx + hullW * 0.5, hullBot);
  ctx.closePath(); ctx.fill();
  const hw = w * _vrr(r, 0.10, 0.15), tilt = Math.sin(t * 0.6) * w * 0.01;
  ctx.beginPath();
  ctx.moveTo(cx - hw * 0.5, hullTop); ctx.lineTo(cx - hw * 0.22 + tilt, hullTop - h * 0.08); ctx.lineTo(cx + hw * 0.22 + tilt, hullTop - h * 0.08); ctx.lineTo(cx + hw * 0.5, hullTop);
  ctx.closePath(); ctx.fill();
  if (r() < 0.6) ctx.fillRect(cx + tilt - w * 0.006, hullTop - h * 0.14, w * 0.012, h * 0.06);
  _vlimb(ctx, cx - hullW * 0.42, hullBot - h * 0.02, w * 0.05, h * 0.2, 0.25 + Math.sin(t * 0.6) * 0.15);
  ctx.restore();
}

// пейзаж: слоистый горизонт руин (даль глуше) + колоссальная конструкция + рваная земля
function _visionLandscape(ctx, r, w, h, t) {
  const baseY = h * _vrr(r, 0.80, 0.94), drift = Math.sin(t * 0.25) * w * 0.01;
  ctx.save(); ctx.globalAlpha *= 0.5;
  let x = w * 0.04;
  while (x < w) { const tw = _vrr(r, w * 0.05, w * 0.11), th = _vrr(r, h * 0.12, h * 0.40); ctx.fillRect(x + drift * 0.5, baseY - th, tw, th); x += tw + _vrr(r, w * 0.02, w * 0.06); }
  ctx.restore();
  x = 0;
  while (x < w) { const tw = _vrr(r, w * 0.04, w * 0.10), th = _vrr(r, h * 0.18, h * 0.66); ctx.fillRect(x + drift, baseY - th, tw, th); x += tw + _vrr(r, w * 0.01, w * 0.05); }
  const cx = w * _vrr(r, 0.40, 0.60) + drift;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.12, baseY); ctx.lineTo(cx - w * 0.05, h * 0.10); ctx.lineTo(cx + w * 0.05, h * 0.05); ctx.lineTo(cx + w * 0.14, baseY); ctx.closePath(); ctx.fill();
  if (r() < 0.5) { ctx.beginPath(); ctx.arc(cx, h * 0.18, w * 0.1, Math.PI, 0); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(0, baseY); let gx = 0;
  while (gx < w) { gx += _vrr(r, w * 0.03, w * 0.08); ctx.lineTo(gx, baseY + _vrr(r, -h * 0.01, h * 0.05)); }
  ctx.lineTo(w, baseY + h * 0.08); ctx.lineTo(0, baseY + h * 0.08); ctx.closePath(); ctx.fill();
}
