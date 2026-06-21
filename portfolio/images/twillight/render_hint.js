'use strict';

// Рендер крупной сюжетной подсказки (логика — hints.js). Очень крупный короткий текст
// (~⅓ высоты), полупрозрачный, по центру; авто-ужатие по ширине. Не трогает HUD.
function drawBigHint(ctx, hints, W, H) {
  if (!hints || !hints.cur) return;
  const a = hints.alpha(); if (a <= 0.01) return;
  const txt = (hints.cur.text || '').toUpperCase();
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = Math.round(H * 0.22);
  ctx.font = `800 ${fs}px ${FONT_DISPLAY}`;
  while (ctx.measureText(txt).width > W * 0.9 && fs > 24) { fs -= 4; ctx.font = `800 ${fs}px ${FONT_DISPLAY}`; }
  const y = H * 0.4;
  // лёгкая тёмная подложка-тень для читаемости поверх любой сцены, без «свечения»
  ctx.globalAlpha = a * 0.28; ctx.fillStyle = PAL.void; ctx.fillText(txt, W / 2 + 2, y + 2);
  ctx.globalAlpha = a * 0.42; ctx.fillStyle = PAL.chalk; ctx.fillText(txt, W / 2, y);
  ctx.restore();
}
