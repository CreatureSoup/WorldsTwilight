'use strict';

// Отрисовка визуальных частиц (Fx): фигурка ресурса по силуэту, тающая по жизни.
function drawFx(ctx, fx, camera) {
  if (!fx) return;
  for (const p of fx.parts) {
    const a = Math.max(0, 1 - p.life / p.ttl);
    const cx = camera.screenX(p.px), cy = p.py - camera.y;
    if (p.kind === 'spark') {   // удар-искра: КОМЕТА — тусклый цветной хвост + яркое ядро + раскалённая голова, вдоль скорости
      const d = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / d, uy = p.vy / d, spd = d / TILE;
      const len = TILE * (0.12 + Math.min(0.46, spd * 0.055)) * (0.35 + a * 0.85);   // хвост тянется НАЗАД от головы; длиннее у быстрых
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = p.color; ctx.lineWidth = 2.4;      // тусклый широкий хвост (цвет источника)
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - ux * len, cy - uy * len); ctx.stroke();
      ctx.globalAlpha = a; ctx.strokeStyle = p.hot ? '#fff' : p.color; ctx.lineWidth = 1.1;   // яркое ядро (короче, к голове)
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - ux * len * 0.5, cy - uy * len * 0.5); ctx.stroke();
      ctx.globalAlpha = Math.min(1, a * 1.25); ctx.fillStyle = p.hot ? '#fff' : p.color;        // раскалённая голова-точка
      ctx.beginPath(); ctx.arc(cx, cy, 1.25 * (0.5 + a), 0, TAU); ctx.fill();
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
    if (p.kind === 'text') {   // всплывающая надпись (расщепление кристалла): тёмный контур + цветная заливка, поднимается и тает
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold 11px ${FONT_MONO}`;
      ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.72)'; ctx.strokeText(p.str, cx, cy);
      ctx.fillStyle = p.color; ctx.fillText(p.str, cx, cy);
      ctx.restore(); ctx.globalAlpha = 1;
      continue;
    }
    ctx.globalAlpha = a;
    paintResource(ctx, p.type, cx, cy, TILE * 0.16 * (0.55 + a * 0.45), (Math.round(p.px) * 13 + Math.round(p.py) * 7) | 0);
    ctx.globalAlpha = 1;
  }
}
