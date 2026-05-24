'use strict';

// Рендер города: убывающий бар-таймер сверху по центру и рядом (слева) —
// 3 концентрических кольца обратного отсчёта с HP города в центре.
function drawCity(ctx, city, W) {
  const baseR = 19, lw = 5, ringGap = 7;
  const emblemD = baseR * 2;
  const barW = 168, barH = 14, gap = 14;
  const totalW = emblemD + gap + barW;
  // центрируем в «коридоре» между панелью статуса (слева) и кнопкой «Ядро» (справа)
  const gapL = 200, gapR = W - 104;
  const x0 = Math.round((gapL + gapR) / 2 - totalW / 2);
  const topY = 8;
  const ringCx = x0 + baseR, ringCy = topY + baseR;
  const barX = x0 + emblemD + gap, barY = ringCy - barH / 2;

  // --- кольца (слева) ---
  for (let i = city.rings.length - 1; i >= 0; i--) {
    const r = baseR - (city.rings.length - 1 - i) * ringGap; // внешнее (макс. индекс) — самое большое
    const ring = city.rings[i];
    ctx.beginPath(); ctx.arc(ringCx, ringCy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = lw; ctx.stroke();
    if (ring.lost) {
      ctx.beginPath(); ctx.arc(ringCx, ringCy, r, 0, Math.PI * 2);
      ctx.strokeStyle = PAL.bloodDim; ctx.lineWidth = lw; ctx.stroke();
    } else {
      const f = ring.hp / ring.max, start = -Math.PI / 2;
      ctx.beginPath(); ctx.arc(ringCx, ringCy, r, start, start + Math.PI * 2 * f);
      ctx.strokeStyle = f > 0.5 ? PAL.amber : (f > 0.25 ? PAL.gold : PAL.bloodBright);
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
  }
  // HP-число по центру — с тёмным контуром, чтобы читалось поверх колец
  const n = `${Math.ceil(city.totalHp())}`;
  ctx.font = `bold 12px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = PAL.void; ctx.strokeText(n, ringCx, ringCy);
  ctx.fillStyle = PAL.chalk; ctx.fillText(n, ringCx, ringCy);

  // --- бар-таймер (справа от колец) ---
  const frac = city.timer / CITY_TIMER_MAX;
  ctx.fillStyle = PAL.earth; ctx.fillRect(barX, barY, barW, barH);
  let col = frac > 0.5 ? PAL.amber : (frac > 0.25 ? PAL.gold : PAL.bloodBright);
  if (city.dying) col = Math.floor(performance.now() / 200) % 2 ? PAL.bloodBright : PAL.bloodDim;
  ctx.fillStyle = col; ctx.fillRect(barX, barY, barW * frac, barH);
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  ctx.fillStyle = PAL.chalk; ctx.font = `9px ${FONT_MONO}`;
  let txt;
  if (city.dying) {
    const ai = city.activeRing(), last = city.rings.length - 1;
    txt = ai === last ? 'ОТКЛЮЧЕНИЕ ВНЕШНЕГО КОНТУРА'
        : ai <= 0 ? 'ГИБЕРНАЦИЯ ЯДРА'
        : 'ОТКЛЮЧЕНИЕ ВНУТРЕННЕГО КОНТУРА';
  } else txt = `ДО ГИБЕРНАЦИИ: ${Math.ceil(city.timer)}С`;
  ctx.fillText(txt, barX + barW / 2, barY + barH / 2 + 1);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
