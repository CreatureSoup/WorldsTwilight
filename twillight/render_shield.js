'use strict';

// Виджет защиты от скверны: налетающие частицы → сфера-щит → ядро. Частицы,
// что гасит щит, тускнеют на кольце; пробившие — вспыхивают в ядре (урон).
const RW_PW = 172, RW_PH = 46;
function drawRadWidget(ctx, w, x, y) {
  const pw = RW_PW, ph = RW_PH;
  techPanel(ctx, x, y, pw, ph, { accent: PAL.toxic, label: '// КОЖУХ', bolts: false, hazardV: PAL.toxic });
  const cx = x + 32, cy = y + ph / 2 + 5;

  for (const p of w.parts) {
    const px = cx + Math.cos(p.ang) * p.r, py = cy + Math.sin(p.ang) * p.r;
    const a = p.fade > 0 ? Math.max(0, 1 - p.fade / RW_FADE) : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.pen ? PAL.bloodBright : PAL.ash;
    ctx.beginPath(); ctx.arc(px, py, p.fade > 0 ? 2.6 : 1.7, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // сфера-щит (скверна — toxic): плотнее/ярче при высокой стойкости
  const sa = Math.min(1, 0.25 + w.resist * 0.45);
  ctx.strokeStyle = `rgba(200,226,90,${0.22 * sa})`; ctx.lineWidth = 3 + 4 * sa;
  ctx.beginPath(); ctx.arc(cx, cy, RW_SHIELD, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = `rgba(220,240,106,${0.5 + 0.4 * sa})`; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, RW_SHIELD, 0, 6.283); ctx.stroke();

  // ядро (вспыхивает кровью при пробитии)
  const f = w.flash;
  ctx.fillStyle = f > 0 ? `rgb(224,${80 - Math.round(f * 40)},${58 - Math.round(f * 30)})` : PAL.toxic;
  ctx.beginPath(); ctx.arc(cx, cy, RW_CORE + f * 2, 0, 6.283); ctx.fill();

  // статус (без числа стойкости — наглядность даёт сам щит)
  const dmg = Math.max(0, w.rad - w.resist);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = dmg > 0 ? PAL.bloodBright : PAL.toxic;
  ctx.fillText(dmg > 0 ? `ПРОБОЙ −${dmg.toFixed(1)} HP/С` : 'ЩИТ ДЕРЖИТ', x + 58, cy);
  ctx.textBaseline = 'alphabetic';
}
