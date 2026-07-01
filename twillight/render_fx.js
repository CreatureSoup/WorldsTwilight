'use strict';

// Отрисовка визуальных частиц (Fx): фигурка ресурса по силуэту, тающая по жизни.
function drawFx(ctx, fx, camera) {
  if (!fx) return;
  for (const p of fx.parts) {
    const a = Math.max(0, 1 - p.life / p.ttl);
    const cx = camera.screenX(p.px), cy = p.py - camera.y;
    if (p.kind === 'spark') {   // удар-искра: короткий аддитивный стрик вдоль скорости, гаснет
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      const d = Math.hypot(p.vx, p.vy) || 1, len = TILE * 0.2 * (0.4 + a);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - (p.vx / d) * len, cy - (p.vy / d) * len); ctx.stroke();
      ctx.restore();
      continue;
    }
    if (p.kind === 'heal') {   // зелёный «+» лечения: тёмный контур + яркая заливка, чуть растёт по мере таяния
      const s = TILE * 0.065 * (0.8 + (1 - a) * 0.45);
      ctx.lineCap = 'round';
      const plus = () => { ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke(); };
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = PAL.toxicDim; ctx.lineWidth = 2.2; plus();
      ctx.globalAlpha = a; ctx.strokeStyle = PAL.toxicBright; ctx.lineWidth = 1.3; plus();
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = a;
    paintResource(ctx, p.type, cx, cy, TILE * 0.16 * (0.55 + a * 0.45), (Math.round(p.px) * 13 + Math.round(p.py) * 7) | 0);
    ctx.globalAlpha = 1;
  }
}
