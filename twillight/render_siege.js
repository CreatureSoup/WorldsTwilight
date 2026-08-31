'use strict';

// FX ОСАДНОГО МОДУЛЯ (siege.js). Мировые координаты, рисуется в drawScene поверх юнита/света, под HUD.
// Намеренно ОТЛИЧАЕТСЯ от импульса (волна-дрожь) и кинетики (полоска разгона): здесь — СФОКУСИРОВАННЫЙ
// разряд: при заряде сходящиеся скобки-фокус стягиваются к юниту, на выстреле — тугой яркий ЛУЧ-копьё.
// ⚠️ перф: без ctx.filter/shadowBlur; 'lighter' только на самом луче.

function drawSiegeCharge(ctx, game, camera) {
  const s = game.siege; if (!s || !s.held || s.charge <= 0) return;
  const u = game.unit; if (!u) return;
  const cx = camera.screenX(u.px), cy = u.py - camera.y, ch = s.charge;
  const dl = Math.hypot(s.dir[0], s.dir[1]) || 1, ux = s.dir[0] / dl, uy = s.dir[1] / dl;
  const px = -uy, py = ux;                                  // перпендикуляр оси
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // сходящиеся скобки-фокус: стягиваются к юниту по мере заряда (фокусировка разряда)
  const R = TILE * (1.05 - 0.5 * ch);
  ctx.lineWidth = 2.2; ctx.strokeStyle = ch >= 1 ? '#ffe0c0' : '#ff7a4a';
  for (const sgn of [-1, 1]) {
    const bx = cx + px * sgn * R, by = cy + py * sgn * R;
    ctx.beginPath();
    ctx.moveTo(bx - ux * R * 0.5, by - uy * R * 0.5);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + ux * R * 0.5, by + uy * R * 0.5);
    ctx.stroke();
  }
  // растущая ось-копьё вперёд (заряжается)
  ctx.globalAlpha = 0.4 + 0.6 * ch;
  ctx.strokeStyle = ch >= 1 ? '#fff0e0' : '#ffb070'; ctx.lineWidth = 1.5 + 2.5 * ch;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + ux * TILE * (0.6 + 0.8 * ch), cy + uy * TILE * (0.6 + 0.8 * ch)); ctx.stroke();
  // ядро-фокус
  ctx.globalAlpha = 0.5 + 0.5 * ch; ctx.fillStyle = ch >= 1 ? '#fff0e0' : '#ff7a4a';
  ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.12 * (0.7 + 0.6 * ch), 0, TAU); ctx.fill();
  ctx.restore();
}

function drawSiegeBeam(ctx, game, camera) {
  const s = game.siege, b = s && s.beam; if (!b) return;
  const fade = Math.max(0, 1 - b.t / SIEGE_BEAM_TTL);
  const ox = camera.screenX(b.x), oy = b.y - camera.y;
  const lenPx = b.len * TILE * (0.5 + 0.5 * b.power);       // длина по заряду
  const ex = ox + b.ux * lenPx, ey = oy + b.uy * lenPx;
  ctx.save(); ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
  // внешнее свечение (широкое, тускло)
  ctx.globalAlpha = 0.28 * fade; ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 9 * (0.6 + 0.4 * b.power);
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
  // ядро-копьё (узкое, яркое)
  ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = '#ffd9b0'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
  // ударная вспышка на конце (попадание)
  ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = '#fff0e0';
  ctx.beginPath(); ctx.arc(ex, ey, TILE * 0.35 * (0.6 + 0.5 * b.power), 0, TAU); ctx.fill();
  ctx.restore();
}
