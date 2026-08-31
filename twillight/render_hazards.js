'use strict';

// Рендер погребённых опасных объектов (hazards.js): останки роботов (сломанный юнит со щупальцами-ногами) +
// старые мины. Погребённые видны ПОД туманом ТАМ, ГДЕ РАСКРЫТО (как артефакты). Активные FX (красные сенсоры /
// мигание / разогрев) — поверх. Перф: fillRect/arc/линии + 'lighter', без filter/shadowBlur/офскринов.

function _hazAlpha(world, tx, ty) {   // 0..1 видимость по туману (видно где раскрыто)
  if (!world.isSeen || !world.isSeen(tx, ty)) return 0;
  const rt = world.revealT ? world.revealT[ty * MAP_W + wrapX(tx)] / 255 : 1;
  return Math.max(0.3, rt);
}

// Силуэт сломанного робота-юнита: поджатые ноги-щупальца + корпус-кольцо + сенсор-ядро (красное при пробуждении).
function _robotBody(ctx, x, y, s, glow, al) {
  ctx.save();
  ctx.globalAlpha = al;
  ctx.strokeStyle = 'rgba(74,66,54,0.95)'; ctx.lineWidth = Math.max(1, s * 0.08); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = 0.7 + i * 0.95, lx = x + Math.cos(a) * s * 0.55, ly = y + s * 0.18 + Math.sin(a) * s * 0.2;
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.08); ctx.lineTo(lx, ly); ctx.lineTo(lx + Math.cos(a) * s * 0.3, ly + s * 0.36); ctx.stroke();
  }
  ctx.fillStyle = '#2a2620'; ctx.beginPath(); ctx.arc(x, y, s * 0.42, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(122,110,92,0.7)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = al * (0.25 + 0.55 * glow); ctx.fillStyle = glow > 0.01 ? '#ff3a22' : '#5a5046';
  ctx.beginPath(); ctx.arc(x, y, s * (0.15 + 0.06 * glow), 0, TAU); ctx.fill();
  if (glow > 0.01) { ctx.globalAlpha = al * 0.13 * glow; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function drawRobots(ctx, game, camera) {
  const w = game.world; if (!w || !w.robots) return;
  const t = performance.now() / 1000;
  for (const r of w.robots) {
    const al = (r.state === 'buried') ? _hazAlpha(w, r.tx, r.ty) : 1;
    if (al <= 0) continue;
    const sx = camera.screenX((r.tx + 0.5) * TILE), sy = (r.ty + 0.5) * TILE - camera.y;
    let glow = 0, sink = 0, sc = 1;
    if (r.state === 'wake') { const p = Math.min(1, r.t / ROBOT_WAKE_T); glow = (0.12 + 0.88 * p) * (0.6 + 0.4 * Math.abs(Math.sin(t * 11))); }   // сенсоры РАЗГОРАЮТСЯ к выстрелу + дрожь
    else if (r.state === 'fire') glow = 1;
    else if (r.state === 'settle') { const p = Math.min(1, r.t / ROBOT_SETTLE_T); glow = 1 - p; sink = p * TILE * 0.2; sc = 1 - p * 0.18; }   // ОСЕДАНИЕ: питание гаснет, корпус оплывает вниз
    _robotBody(ctx, sx, sy + sink, TILE * 0.72 * sc, glow, al);
    if (r.state === 'dead') {   // погасший крестик-сенсор
      ctx.save(); ctx.globalAlpha = al * 0.5; ctx.strokeStyle = '#46403698'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx - TILE * 0.12, sy - TILE * 0.12); ctx.lineTo(sx + TILE * 0.12, sy + TILE * 0.12);
      ctx.moveTo(sx + TILE * 0.12, sy - TILE * 0.12); ctx.lineTo(sx - TILE * 0.12, sy + TILE * 0.12); ctx.stroke(); ctx.restore();
    }
  }
}

// Старая мина: округлый корпус + шипы-усики + красный огонёк (учащает мигание к взрыву).
function drawMines(ctx, game, camera) {
  const w = game.world; if (!w || !w.mines) return;
  for (const m of w.mines) {
    if (m.state === 'done') continue;
    const al = (m.state === 'buried') ? _hazAlpha(w, m.tx, m.ty) : 1;
    if (al <= 0) continue;
    const sx = camera.screenX((m.tx + 0.5) * TILE), sy = (m.ty + 0.5) * TILE - camera.y, s = TILE * 0.62;
    ctx.save(); ctx.globalAlpha = al;
    ctx.strokeStyle = 'rgba(92,82,68,0.95)'; ctx.lineWidth = Math.max(1, s * 0.09);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * s * 0.4, sy + Math.sin(a) * s * 0.4); ctx.lineTo(sx + Math.cos(a) * s * 0.74, sy + Math.sin(a) * s * 0.74); ctx.stroke(); }
    ctx.fillStyle = '#2e2922'; ctx.beginPath(); ctx.arc(sx, sy, s * 0.42, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(122,110,92,0.7)'; ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
    let blink = 0.18;
    if (m.state === 'blink') { const f = m.t / MINE_BLINK_T; blink = (Math.sin(m.t * (12 + 34 * f)) > 0) ? 1 : 0.08; }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * (0.4 + 0.6 * blink); ctx.fillStyle = '#ff3a22';
    ctx.beginPath(); ctx.arc(sx, sy, s * 0.15, 0, TAU); ctx.fill();
    if (blink > 0.5) { ctx.globalAlpha = al * 0.16; ctx.beginPath(); ctx.arc(sx, sy, s * 0.7, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
}

// ДЕБАГ-маркеры (режим B): артефакты (бирюза·A) / роботы (янтарь·R) / мины (красный·M) поверх всего.
function drawHazardDebug(ctx, game, camera) {
  const w = game.world; if (!w) return;
  ctx.save(); ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mark = (tx, ty, col, ch) => {
    const sx = camera.screenX((tx + 0.5) * TILE), sy = (ty + 0.5) * TILE - camera.y;
    ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0a0e'; ctx.fillText(ch, sx, sy + 0.5);
  };
  for (const a of (w.artifacts || [])) mark(a.tx + (a.w > 1 ? 0.5 : 0), a.ty + (a.h > 1 ? 0.5 : 0), '#4fd0c4', 'A');
  for (const r of (w.robots || [])) mark(r.tx, r.ty, '#f0a23a', 'R');
  for (const m of (w.mines || [])) mark(m.tx, m.ty, '#ff5038', 'M');
  ctx.globalAlpha = 1; ctx.restore();
}

// FX дебаффов от останков роботов НА ЮНИТЕ (мир): паутина-нити (замедление) + комок-прыгун на буре (дебафф бурения).
function drawUnitDebuffFx(ctx, game, camera) {
  const u = game.unit; if (!u) return;
  const cx = camera.screenX(u.px), cy = u.py - camera.y, r = TILE * 0.5, t = performance.now() / 1000;
  if (u.webT > 0) {   // ПАУТИНА: нити + дуги вокруг юнита
    ctx.save(); ctx.strokeStyle = 'rgba(212,202,228,0.5)'; ctx.lineWidth = 1;
    const n = 9;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4); ctx.lineTo(cx + Math.cos(a) * r * (1.35 + 0.1 * Math.sin(t * 4 + i)), cy + Math.sin(a) * r * (1.35 + 0.1 * Math.cos(t * 3 + i))); ctx.stroke(); }
    ctx.globalAlpha = 0.32; for (let k = 1; k <= 2; k++) { ctx.beginPath(); ctx.arc(cx, cy, r * (0.6 + k * 0.36), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  if (u.latchTiles > 0) {   // ПРЫГУН: тёмный комок с красным глазом на буре (по направлению бурения)
    const dx = u.dx || u.faceX || 1, dy = u.dy || 0, bx = cx + dx * r * 0.8, by = cy + dy * r * 0.8;
    ctx.save(); ctx.fillStyle = '#2a2230'; ctx.beginPath(); ctx.arc(bx, by, r * 0.4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#7a3a2f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#5a2a22'; ctx.lineWidth = 1.4;   // лапки-захваты
    for (const sgn of [-0.7, 0, 0.7]) { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - dx * r * 0.5 + Math.cos(sgn) * r * 0.3, by - dy * r * 0.5 + Math.sin(sgn) * r * 0.3); ctx.stroke(); }
    ctx.fillStyle = '#ff5a3a'; ctx.beginPath(); ctx.arc(bx, by, r * 0.13 * (0.8 + 0.4 * Math.sin(t * 12)), 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// МИГАЮЩАЯ ПЛАШКА дебаффов (HUD, screen-space): по строке на активный дебафф с текстом эффекта. БЕЗ таймера сброса (по требованию).
function drawDebuffBadge(ctx, game, w, h) {
  const u = game.unit; if (!u) return;
  const rows = [];
  if (u.webT > 0) rows.push({ txt: STR.hud.debuff.web, c: '#c8a0e0' });
  if (u.latchTiles > 0) rows.push({ txt: STR.hud.debuff.latch, c: '#e0a040' });
  if ((game.scanJamT || 0) > 0) rows.push({ txt: STR.hud.debuff.jam, c: '#5ad0c0' });
  if (!rows.length) return;
  const blink = 0.5 + 0.5 * Math.sin(performance.now() / 130);
  ctx.save(); ctx.font = `bold 12px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = 94;
  for (const r of rows) {
    const tw = ctx.measureText(r.txt).width, bw = tw + 24, bx = Math.round(w / 2 - bw / 2);
    ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(18,12,16,0.85)'; ctx.fillRect(bx, y - 9, bw, 18);
    ctx.globalAlpha = 0.4 + 0.6 * blink; ctx.strokeStyle = r.c; ctx.lineWidth = 1.4; ctx.strokeRect(bx + 0.5, y - 8.5, bw - 1, 17);
    ctx.globalAlpha = 0.6 + 0.4 * blink; ctx.fillStyle = r.c; ctx.fillText(r.txt, Math.round(w / 2), y);
    y += 23;
  }
  ctx.globalAlpha = 1; ctx.restore();
}
