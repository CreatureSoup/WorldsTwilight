'use strict';

// РЕНДЕР ТУРЕЛЕЙ ГОРОДА (Батч 8, cityturret.js). Визуал как печатная турель (станина+купол+ствол по aimAng+сенсор+вспышка),
// но АМБЕР-купол (жёлтая ветка) + трассеры выстрелов. Под туманом (часть базы). ⚠️ перф: без ctx.filter/shadowBlur.
function drawCityTurrets(ctx, game, camera) {
  const list = game.cityTurrets; if (!list || !list.length) return;
  const tr = game._cityTurretTracers;
  if (tr && tr.length) {
    ctx.save(); ctx.lineCap = 'round';
    for (const t of tr) {
      const a = 1 - t.life / STRUCT_TRACER_TTL; if (a <= 0) continue;
      ctx.globalAlpha = a * 0.85; ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(camera.screenX(t.x1), t.y1 - camera.y); ctx.lineTo(camera.screenX(t.x2), t.y2 - camera.y); ctx.stroke();
    }
    ctx.restore();
  }
  for (const t of list) _drawCityTurret(ctx, t, camera);
}

function _drawCityTurret(ctx, t, camera) {
  const cx = Math.round(camera.screenX(t.px)), cy = Math.round(t.py - camera.y), r = TILE / 2 - 3;
  const oy = cy + r * 0.2, a = t.aimAng;
  ctx.save();
  ctx.fillStyle = '#4a4036'; ctx.fillRect(cx - r, oy, r * 2, r * 0.8);                                    // станина
  ctx.fillStyle = '#d4a042'; ctx.beginPath(); ctx.arc(cx, oy, r * 0.85, Math.PI, 0); ctx.fill();          // купол (амбер — жёлтая ветка)
  ctx.strokeStyle = '#7a6a44'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, oy, r * 0.85, Math.PI, 0); ctx.stroke();
  const blen = r * 1.5, bx = cx + Math.cos(a) * blen, by = oy + Math.sin(a) * blen;                       // ствол по aimAng (медленно вращается через верх)
  ctx.strokeStyle = '#9098a0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, oy); ctx.lineTo(bx, by); ctx.stroke();
  if (t.flash > 0) { ctx.fillStyle = '#ffe0a0'; ctx.beginPath(); ctx.arc(bx, by, 3.2, 0, TAU); ctx.fill(); }   // вспышка дула
  ctx.fillStyle = PAL.enemyEye; ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, 2, 0, TAU); ctx.fill();         // сенсор
  ctx.restore();
}
