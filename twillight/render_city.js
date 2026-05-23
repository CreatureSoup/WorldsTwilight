'use strict';

// Рендер города: убывающий бар-таймер сверху по центру и рядом (слева) —
// 3 концентрических кольца обратного отсчёта с HP города в центре.
function drawCity(ctx, city, W) {
  const baseR = 30, lw = 6, ringGap = 10;
  const emblemD = baseR * 2;
  const barW = 300, barH = 16, gap = 18;
  const totalW = emblemD + gap + barW;
  const x0 = Math.round(W / 2 - totalW / 2);
  const topY = 14;
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
      ctx.strokeStyle = 'rgba(110,30,30,0.55)'; ctx.lineWidth = lw; ctx.stroke();
    } else {
      const f = ring.hp / ring.max, start = -Math.PI / 2;
      ctx.beginPath(); ctx.arc(ringCx, ringCy, r, start, start + Math.PI * 2 * f);
      ctx.strokeStyle = f > 0.5 ? '#46c6ff' : (f > 0.25 ? '#ffd24a' : '#ff5a5a');
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
  }
  ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.ceil(city.totalHp())}`, ringCx, ringCy);

  // --- бар-таймер (справа от колец) ---
  const frac = city.timer / CITY_TIMER_MAX;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(barX, barY, barW, barH);
  let col = frac > 0.5 ? '#5fe08a' : (frac > 0.25 ? '#ffd24a' : '#ff7a4a');
  if (city.dying) col = Math.floor(performance.now() / 200) % 2 ? '#ff5a5a' : '#7a2020';
  ctx.fillStyle = col; ctx.fillRect(barX, barY, barW * frac, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);
  ctx.fillStyle = '#dfeaf2'; ctx.font = 'bold 11px monospace';
  let txt;
  if (city.dying) {
    const ai = city.activeRing(), last = city.rings.length - 1;
    txt = ai === last ? 'ОТКЛЮЧЕНИЕ ВНЕШНЕГО КОНТУРА'
        : ai <= 0 ? 'ГИБЕРНАЦИЯ ЯДРА'
        : 'ОТКЛЮЧЕНИЕ ВНУТРЕННЕГО КОНТУРА';
  } else txt = `до гибернации: ${Math.ceil(city.timer)}с`;
  ctx.fillText(txt, barX + barW / 2, barY + barH / 2 + 1);

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
