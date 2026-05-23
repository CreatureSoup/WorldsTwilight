'use strict';

// Отрисовка визуальных частиц (Fx): фигурка ресурса по силуэту, тающая по жизни.
function drawFx(ctx, fx, camera) {
  if (!fx) return;
  for (const p of fx.parts) {
    const a = Math.max(0, 1 - p.life / p.ttl);
    const cx = camera.screenX(p.px), cy = p.py - camera.y;
    ctx.globalAlpha = a;
    paintResource(ctx, p.type, cx, cy, TILE * 0.16 * (0.55 + a * 0.45), (Math.round(p.px) * 13 + Math.round(p.py) * 7) | 0);
    ctx.globalAlpha = 1;
  }
}
