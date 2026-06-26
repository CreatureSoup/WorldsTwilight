'use strict';

// Отрисовка интро: принтер печатает юнит (заливка снизу вверх со сканлайном),
// затем из принтера в юнит влетает реактор города — вспышка установки.
function drawIntro(ctx, intro, world, unit, camera, W, H) {
  const cx = Math.round(camera.screenX(unit.px)), cy = Math.round(unit.py - camera.y);
  const R = (TILE - 8) / 2, t = intro.t;
  const printT = Math.min(1, t / INTRO_PRINT);
  const reactT = Math.min(1, Math.max(0, (t - INTRO_PRINT) / INTRO_REACTOR));
  const settleT = Math.min(1, Math.max(0, (t - INTRO_PRINT - INTRO_REACTOR) / INTRO_SETTLE));

  const pcx = camera.screenX((PRINTER.x + PRINTER.w / 2) * TILE), pcyTop = PRINTER.y * TILE - camera.y;
  // (плейсхолдер-прямоугольник принтера убран — базу рисует ассет города `drawPlayerCity`)

  // печать юнита: заливка снизу вверх + сканлайн на кромке. Кольцо рисуем как в игре
  // (ноги-щупальца ПОД + модули/реактор), иначе FK-риг (scout). Реактор ВЫКЛ до установки
  // (`unit.reactorOn` ставится по фазе в game.intro-апдейте → drawRingUnit рисует `reactor:off`).
  const ring = typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[unit.hull] && UNIT_DEFS[unit.hull].kind === 'ring';
  const revealH = ring ? TILE * 2.6 : R * 2 + 16, halfW = ring ? TILE * 2 : R + 10;
  const bottom = cy + (ring ? TILE * 1.4 : R + 8), top = bottom - printT * revealH;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - halfW, top, halfW * 2, bottom - top); ctx.clip();
  if (ring) {
    if (typeof drawTentacles === 'function') drawTentacles(ctx, camera);   // ноги (живые из intro-апдейта)
    drawRingUnit(ctx, world, unit, camera, { scale: unitDrawScale(unit) });
  } else {
    drawTachikoma(ctx, world, unit, camera, { scale: unitDrawScale(unit) });
  }
  ctx.restore();
  if (printT > 0 && printT < 1) {
    ctx.fillStyle = 'rgba(120,220,255,0.22)'; ctx.fillRect(cx - halfW + 2, top, halfW * 2 - 4, 3);
    ctx.strokeStyle = 'rgba(160,235,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - halfW + 2, top); ctx.lineTo(cx + halfW - 2, top); ctx.stroke();
  }

  // реактор: летит из принтера в центр юнита (пока не «вставлен» — reactT<1)
  if (t >= INTRO_PRINT && reactT < 1) {
    const ox = pcx + (cx - pcx) * reactT, oy = pcyTop + (cy - pcyTop) * reactT;
    const rr = R * 0.5;
    ctx.fillStyle = 'rgba(58,209,122,0.25)';
    ctx.beginPath(); ctx.arc(ox, oy, rr * 1.9, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3ad17a';
    ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#0d1117'; ctx.font = `bold ${Math.max(8, Math.round(rr * 1.3))}px ${FONT_MONO}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Р', ox, oy + 1);
    ctx.textBaseline = 'alphabetic';
  }
  // вспышка-кольцо в момент установки
  if (reactT >= 1 && settleT < 1) {
    ctx.strokeStyle = `rgba(120,255,170,${1 - settleT})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R + settleT * R * 2.2, 0, 6.283); ctx.stroke();
  }

  // этап + подсказка
  const label = t < INTRO_PRINT ? STR.intro.phase.print
    : t < INTRO_PRINT + INTRO_REACTOR ? STR.intro.phase.reactor : STR.intro.phase.sync;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`; ctx.fillText(STR.intro.tag, W / 2, 30);
  ctx.fillStyle = PAL.chalk; ctx.font = `700 22px ${FONT_DISPLAY}`; ctx.fillText(label, W / 2, 54);
  ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.intro.skip, W / 2, H - 20);
  ctx.textAlign = 'left';
}
