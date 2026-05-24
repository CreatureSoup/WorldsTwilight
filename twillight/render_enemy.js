'use strict';

// Отрисовка врагов: тёмные дроны. Копатель/собиратель — округлые с буром и «глазом»
// (красный/зелёный); разведчик — угловатый агрессивный силуэт с клинком, вспыхивает в атаке.
function drawEnemies(ctx, enemies, camera) {
  if (!enemies) return;
  for (const e of enemies) {
    const cx = Math.round(camera.screenX(e.px)), cy = Math.round(e.py - camera.y);
    const r = (TILE - 12) / 2;
    if (e.type === 'raider') { drawRaider(ctx, e, cx, cy, r); continue; }
    const body = e.type === 'collector' ? '#2f3a30' : '#3a2730';
    const edge = e.type === 'collector' ? '#5a7a3a' : '#7a2030';
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
    // бур по направлению движения
    const bx = cx + e.dx * (r + 1), by = cy + e.dy * (r + 1);
    ctx.fillStyle = '#9098a0';
    ctx.beginPath();
    ctx.moveTo(bx + e.dx * r * 0.55, by + e.dy * r * 0.55);
    ctx.lineTo(bx + e.dy * r * 0.4, by + e.dx * r * 0.4);
    ctx.lineTo(bx - e.dy * r * 0.4, by - e.dx * r * 0.4);
    ctx.closePath(); ctx.fill();
    // глаз (ярче при бурении): красный — копатель, зелёный — собиратель
    ctx.fillStyle = e.type === 'collector' ? (e.drilling ? '#9aff6a' : '#6abf3a') : (e.drilling ? '#ff6a4a' : '#d0402f');
    ctx.beginPath(); ctx.arc(cx + e.dx * r * 0.35, cy + e.dy * r * 0.35, r * 0.3, 0, 6.283); ctx.fill();
    // несомый ресурс
    if (e.carry) { paintResource(ctx, e.carry, cx, cy - r - 5, TILE * 0.13, (cx * 7 + cy * 3) | 0); }
  }
}

function drawRaider(ctx, e, cx, cy, r) {
  // тело-ромб — резкий быстрый силуэт
  ctx.fillStyle = '#46161c';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.85, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.85, cy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c83828'; ctx.lineWidth = 2; ctx.stroke();
  // глаз по направлению движения
  ctx.fillStyle = '#ff5038';
  ctx.beginPath(); ctx.arc(cx + e.dx * r * 0.25, cy + e.dy * r * 0.25, r * 0.32, 0, 6.283); ctx.fill();
  // унесённый заряд энергии («ходячая батарейка»)
  if (e.carry) {
    ctx.save();
    ctx.shadowColor = '#6fe0ff'; ctx.shadowBlur = 9;
    ctx.fillStyle = '#bff4ff';
    ctx.beginPath(); ctx.arc(cx, cy - r - 5, r * 0.42, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}
