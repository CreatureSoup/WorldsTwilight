'use strict';

// ПРЫЖКОВЫЕ ДВИЖКИ — FX полёта (game.jets; логика — jets.js). Два языка выхлопа из-под юнита, пока движки on;
// мигают при НИЗКОМ топливе (предупреждение). Поверх мира у позиции юнита. ⚠️ перф (spec_render.md): без
// ctx.filter/shadowBlur; 'lighter' на пламени, градиент — ок.
function drawJets(ctx, game, camera) {
  const j = game.jets, u = game.unit; if (!j || !j.on || !u) return;
  const cx = Math.round(camera.screenX(u.px)), cy = Math.round(u.py - camera.y);
  const t = performance.now() / 1000, low = j.fuel / JETS_FUEL_MAX < 0.25;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // ⚠️ перф: БЕЗ createLinearGradient (аллокация/кадр) — имитируем затухание 3 вложенными языками с убывающей alpha.
  const cols = ['rgba(255,236,150,', 'rgba(255,182,84,', 'rgba(255,120,40,'];
  for (const sx of [-0.32, 0.32]) {
    const bx = cx + sx * TILE, by = cy + TILE * 0.4;
    const len = TILE * (0.55 + 0.32 * (0.5 + 0.5 * Math.sin(t * 30 + sx * 12)));
    const flick = low ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 42))) : 1;   // мигание при низком топливе — предупреждение
    for (let k = 0; k < 3; k++) {
      const f = 1 - k / 3, w = TILE * 0.13 * f, l = len * (1 - k * 0.16);
      ctx.fillStyle = cols[k] + (0.5 * flick * f).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.lineTo(bx + w, by); ctx.lineTo(bx, by + l); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
}
