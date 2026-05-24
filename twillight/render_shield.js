'use strict';

// Виджет защиты от скверны: налетающие частицы → сфера-щит → ядро. Частицы,
// что гасит щит, тускнеют на кольце; пробившие — вспыхивают в ядре (урон).
function drawRadWidget(ctx, w, x, y) {
  const pw = 250, ph = 64;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x, y, pw, ph);
  const cx = x + 36, cy = y + ph / 2;

  for (const p of w.parts) {
    const px = cx + Math.cos(p.ang) * p.r, py = cy + Math.sin(p.ang) * p.r;
    const a = p.fade > 0 ? Math.max(0, 1 - p.fade / RW_FADE) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.pen ? '#e08cff' : '#9a8fb0';
    ctx.beginPath(); ctx.arc(px, py, p.fade > 0 ? 2.6 : 1.7, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // сфера-щит: плотнее и ярче при высокой стойкости (наглядно «крепче кожух»)
  const sa = Math.min(1, 0.25 + w.resist * 0.45);
  ctx.strokeStyle = `rgba(70,198,255,${0.28 * sa})`; ctx.lineWidth = 3 + 4 * sa;
  ctx.beginPath(); ctx.arc(cx, cy, RW_SHIELD, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = `rgba(120,216,255,${0.5 + 0.4 * sa})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, RW_SHIELD, 0, 6.283); ctx.stroke();

  // ядро (вспыхивает тёплым при пробитии)
  const f = w.flash;
  ctx.fillStyle = f > 0 ? `rgb(255,${130 - Math.round(f * 90)},${110 - Math.round(f * 80)})` : '#5fd0ff';
  ctx.beginPath(); ctx.arc(cx, cy, RW_CORE + f * 2, 0, 6.283); ctx.fill();

  // подписи (без числа стойкости — наглядность даёт сам щит)
  const dmg = Math.max(0, w.rad - w.resist);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#9fb3c8'; ctx.fillText('КОЖУХ', x + 78, y + 18);
  ctx.font = '12px monospace'; ctx.fillStyle = dmg > 0 ? '#ff8a8a' : '#5fe08a';
  ctx.fillText(dmg > 0 ? `пробой −${dmg.toFixed(1)} HP/с` : 'щит держит', x + 78, y + 36);
}
