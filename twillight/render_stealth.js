'use strict';

// FX СТЕЛС-МОДУЛЯ (stealth.js). Пока юнит невидим (`game.stealth.t>0`) — поверх него лиловая «маскировка»:
// мягкий ореол + дрожащие сканлайны (расфокус силуэта). В последние 1.5с — мигает (предупреждение об окончании).
// ⚠️ перф (spec_render): без ctx.filter/shadowBlur; 'lighter' аккуратно. Рисуется в drawScene поверх юнита, под HUD.

function drawStealthFx(ctx, game, camera) {
  const s = game.stealth; if (!s || s.t <= 0) return;
  const u = game.unit; if (!u) return;
  const cx = camera.screenX(u.px), cy = u.py - camera.y, t = performance.now() / 1000, R = TILE * 1.05;
  const ending = s.t < 1.5 ? (0.35 + 0.65 * Math.abs(Math.sin(t * 9))) : 1;   // мигание перед спадом
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  // мягкий ореол-маскировка
  ctx.globalAlpha = 0.10 * ending; ctx.fillStyle = '#8a7ed4';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  // дрожащие горизонтальные сканлайны (расфокус силуэта)
  ctx.strokeStyle = '#b8aef0'; ctx.lineWidth = 1;
  for (let i = -3; i <= 3; i++) {
    const yy = cy + i * (TILE * 0.28) + Math.sin(t * 6 + i) * 1.5;
    ctx.globalAlpha = 0.18 * ending * (1 - Math.abs(i) / 4);
    ctx.beginPath(); ctx.moveTo(cx - R * 0.8, yy); ctx.lineTo(cx + R * 0.8, yy); ctx.stroke();
  }
  ctx.restore();
}
