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
  ctx.fillStyle = '#2a2620'; ctx.beginPath(); ctx.arc(x, y, s * 0.42, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(122,110,92,0.7)'; ctx.lineWidth = Math.max(1, s * 0.05); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = al * (0.25 + 0.55 * glow); ctx.fillStyle = glow > 0.01 ? '#ff3a22' : '#5a5046';
  ctx.beginPath(); ctx.arc(x, y, s * (0.15 + 0.06 * glow), 0, 6.283); ctx.fill();
  if (glow > 0.01) { ctx.globalAlpha = al * 0.13 * glow; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 6.283); ctx.fill(); }
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
    ctx.fillStyle = '#2e2922'; ctx.beginPath(); ctx.arc(sx, sy, s * 0.42, 0, 6.283); ctx.fill();
    ctx.strokeStyle = 'rgba(122,110,92,0.7)'; ctx.lineWidth = Math.max(1, s * 0.06); ctx.stroke();
    let blink = 0.18;
    if (m.state === 'blink') { const f = m.t / MINE_BLINK_T; blink = (Math.sin(m.t * (12 + 34 * f)) > 0) ? 1 : 0.08; }
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = al * (0.4 + 0.6 * blink); ctx.fillStyle = '#ff3a22';
    ctx.beginPath(); ctx.arc(sx, sy, s * 0.15, 0, 6.283); ctx.fill();
    if (blink > 0.5) { ctx.globalAlpha = al * 0.16; ctx.beginPath(); ctx.arc(sx, sy, s * 0.7, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }
}

// ДЕБАГ-маркеры (режим B): артефакты (бирюза·A) / роботы (янтарь·R) / мины (красный·M) поверх всего.
function drawHazardDebug(ctx, game, camera) {
  const w = game.world; if (!w) return;
  ctx.save(); ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mark = (tx, ty, col, ch) => {
    const sx = camera.screenX((tx + 0.5) * TILE), sy = (ty + 0.5) * TILE - camera.y;
    ctx.globalAlpha = 0.9; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#0a0a0e'; ctx.fillText(ch, sx, sy + 0.5);
  };
  for (const a of (w.artifacts || [])) mark(a.tx + (a.w > 1 ? 0.5 : 0), a.ty + (a.h > 1 ? 0.5 : 0), '#4fd0c4', 'A');
  for (const r of (w.robots || [])) mark(r.tx, r.ty, '#f0a23a', 'R');
  for (const m of (w.mines || [])) mark(m.tx, m.ty, '#ff5038', 'M');
  ctx.globalAlpha = 1; ctx.restore();
}
