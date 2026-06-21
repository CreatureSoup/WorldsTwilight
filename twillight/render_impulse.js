'use strict';

// Рендер спец-буров: ИМПУЛЬСНЫЙ (волна-луч + дуга заряда) и КИНЕТИЧЕСКИЙ (глоу контакта + пипы разгона).
// Мировые координаты (рисуется в drawScene поверх мира/света, под HUD). ⚠️ перф: без ctx.filter/shadowBlur.

// УЗКО-НАПРАВЛЕННОЕ ИСКАЖЕНИЕ ВОЗДУХА: цепочка мягких линз-сгустков вдоль взгляда — «дрожащая лупа»,
// которая гнёт видимость по линии удара. Без яркой линии фронта; сильнее у юнита (пик силы), тает к концу.
function drawImpulseWave(ctx, game, camera) {
  const wv = game.imp && game.imp.wave; if (!wv) return;
  const ox = camera.screenX(wv.fx * TILE + TILE / 2), oy = wv.fy * TILE + TILE / 2 - camera.y;
  const dx = wv.dx, dy = wv.dy, px = -dy, py = dx;                 // направление + перпендикуляр
  const prog = Math.min(1, wv.t / IMPULSE_WAVE_DUR);
  const fade = wv.t <= IMPULSE_WAVE_DUR ? 1 : Math.max(0, 1 - (wv.t - IMPULSE_WAVE_DUR) / Math.max(0.001, IMPULSE_WAVE_TTL - IMPULSE_WAVE_DUR));
  const maxR = (wv.reach || wv.len) * TILE, frontD = Math.max(TILE * 0.5, prog * maxR);   // рисуем ДО реальной дальности эффекта
  const intensity = (0.4 + 0.28 * wv.ch) * fade, ph = wv.t * 30;   // ph — фаза дрожания (приглушено, чтобы не светило)
  const halfW = TILE * (0.55 + 0.1 * wv.ch);                       // УЗКАЯ полоса, а не конус
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 1) слабый хейз-тело канала (объём «потревоженного» воздуха), низкая альфа
  const step = TILE * 0.5;
  for (let d = step * 0.4; d <= frontD; d += step) {
    const near = 1 - d / maxR; if (near <= 0) break;
    const wob = Math.sin(d * 0.5 + ph) * TILE * 0.14;             // боковая дрожь канала
    const cx = ox + dx * d + px * wob, cy = oy + dy * d + py * wob;
    const lr = halfW * (0.8 + 0.4 * near);
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, lr);
    g.addColorStop(0, `rgba(206,224,242,${intensity * (0.04 + 0.06 * near)})`);
    g.addColorStop(1, 'rgba(206,224,242,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, lr, 0, 6.283); ctx.fill();
  }
  // 2) ДРОЖАЩИЕ ПОПЕРЕЧНЫЕ ГРЕБНИ — рябь искажения воздуха вдоль линии удара (без яркого фронта)
  for (let d = step * 0.4; d <= frontD; d += step) {
    const near = 1 - d / maxR; if (near <= 0) break;
    const sway = Math.sin(d * 0.5 + ph) * TILE * 0.14;
    const a = intensity * (0.16 + 0.4 * near) * (0.82 + 0.18 * Math.sin(d + ph * 1.3));   // сильнее у юнита + мерцание
    if (a <= 0.03) continue;
    ctx.globalAlpha = Math.min(0.42, a); ctx.strokeStyle = '#cfe0f2'; ctx.lineWidth = 1 + 0.9 * near;
    const hw = halfW * (0.6 + 0.45 * near), steps = 6;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const f = i / steps * 2 - 1, bend = Math.sin(f * 2.6 + ph * 1.4 + d * 0.4) * TILE * 0.1;
      const xx = ox + dx * d + px * (f * hw + sway) + dx * bend, yy = oy + dy * d + py * (f * hw + sway) + dy * bend;
      i === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawImpulseCharge(ctx, game, camera) {
  const imp = game.imp; if (!imp || !imp.held || imp.charge <= 0) return;
  const u = game.unit; if (!u) return;
  const cx = camera.screenX(u.px), cy = u.py - camera.y, ch = imp.charge, R = TILE * 0.9;
  ctx.save();
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,140,60,0.22)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = ch >= 1 ? '#fff2d8' : '#ff9a3a';            // дуга-заряд растёт по кругу
  ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * ch); ctx.stroke();
  const dx = imp.dir[0], dy = imp.dir[1], ax = cx + dx * R * 1.3, ay = cy + dy * R * 1.3;   // стрелка-прицел
  ctx.globalAlpha = 0.5 + 0.5 * ch; ctx.fillStyle = ch >= 1 ? '#fff2d8' : '#ffb060';
  ctx.beginPath();
  ctx.moveTo(ax + dx * 7, ay + dy * 7);
  ctx.lineTo(ax - dy * 5 - dx * 3, ay + dx * 5 - dy * 3);
  ctx.lineTo(ax + dy * 5 - dx * 3, ay - dx * 5 - dy * 3);
  ctx.closePath(); ctx.fill();
  if (ch >= 1) { ctx.globalAlpha = 0.6; ctx.strokeStyle = '#fff2d8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 6.283); ctx.stroke(); }
  ctx.restore();
}

// Полоска РАЗГОНА над юнитом (0..1 по времени бурения). Точки на тайле НЕТ (по просьбе).
function drawKineticHeat(ctx, game, camera) {
  const u = game.unit; if (!u || !u.stats || !u.stats.kinetic) return;
  const f = u.kinRamp || 0; if (f <= 0.01) return;
  const col = f > 0.66 ? '#fff0d0' : f > 0.33 ? '#ffc060' : '#e0903a'; // тёплый → бело-горячий
  const ux = camera.screenX(u.px), uy = u.py - camera.y - TILE * 0.95, W = TILE * 0.7, H = 3.5;
  ctx.save();
  ctx.globalAlpha = 0.22; ctx.fillStyle = '#7a6a4a'; ctx.fillRect(ux - W / 2, uy, W, H);
  ctx.globalAlpha = 0.95; ctx.fillStyle = col; ctx.fillRect(ux - W / 2, uy, W * f, H);
  ctx.restore();
}
