'use strict';

// FX ВЗЛОМА ЮНИТОВ (jam.js): на импульсе (`game.jam.pulse` спадает 1→0) — расходящееся зелёное кольцо-помеха
// от юнита до радиуса глушения (JAM_PULSE_R), плюс второе кольцо с задержкой. Рисуется в drawScene поверх мира.
// ⚠️ перф (spec_render): без ctx.filter/shadowBlur; 'lighter'.

function drawJamFx(ctx, game, camera) {
  const j = game.jam; if (!j || j.pulse <= 0) return;
  const u = game.unit; if (!u) return;
  const cx = camera.screenX(u.px), cy = u.py - camera.y, p = 1 - j.pulse, maxR = JAM_PULSE_R * TILE;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#9ad0a0';
  ctx.globalAlpha = j.pulse * 0.5; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, maxR * p, 0, 6.283); ctx.stroke();
  const p2 = Math.max(0, p - 0.25);
  ctx.globalAlpha = j.pulse * 0.3; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, maxR * p2, 0, 6.283); ctx.stroke();
  ctx.restore();
}
