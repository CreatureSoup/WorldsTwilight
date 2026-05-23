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
  const prx = pcx - PRINTER.w * TILE / 2, pry = pcyTop;

  // принтер активен во время печати
  if (printT < 1) {
    ctx.fillStyle = `rgba(90,208,255,${0.10 + 0.10 * (0.5 + 0.5 * Math.sin(performance.now() / 90))})`;
    ctx.fillRect(prx, pry, PRINTER.w * TILE, PRINTER.h * TILE);
  }

  // печать юнита: заливка снизу вверх + сканлайн на кромке
  const revealH = R * 2 + 16, bottom = cy + R + 8, top = bottom - printT * revealH;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - R - 10, top, (R + 10) * 2, bottom - top); ctx.clip();
  drawTachikoma(ctx, world, unit, camera);
  ctx.restore();
  if (printT > 0 && printT < 1) {
    ctx.fillStyle = 'rgba(120,220,255,0.22)'; ctx.fillRect(cx - R - 8, top, (R + 8) * 2, 3);
    ctx.strokeStyle = 'rgba(160,235,255,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - R - 8, top); ctx.lineTo(cx + R + 8, top); ctx.stroke();
  }

  // реактор: летит из принтера в центр юнита
  if (t >= INTRO_PRINT && settleT < 1) {
    const ox = pcx + (cx - pcx) * reactT, oy = pcyTop + (cy - pcyTop) * reactT;
    const rr = R * 0.5 * (reactT < 1 ? 1 : 1 - settleT);
    ctx.fillStyle = 'rgba(58,209,122,0.25)';
    ctx.beginPath(); ctx.arc(ox, oy, rr * 1.9, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#3ad17a';
    ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#0d1117'; ctx.font = `bold ${Math.max(8, Math.round(rr * 1.3))}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Р', ox, oy + 1);
    ctx.textBaseline = 'alphabetic';
  }
  // вспышка-кольцо в момент установки
  if (reactT >= 1 && settleT < 1) {
    ctx.strokeStyle = `rgba(120,255,170,${1 - settleT})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R + settleT * R * 2.2, 0, 6.283); ctx.stroke();
  }

  // этап + подсказка
  const label = t < INTRO_PRINT ? 'Печать корпуса…'
    : t < INTRO_PRINT + INTRO_REACTOR ? 'Установка реактора…' : 'Синхронизация связи…';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#cfe7ff'; ctx.font = 'bold 18px monospace'; ctx.fillText(label, W / 2, 42);
  ctx.fillStyle = 'rgba(159,179,200,0.8)'; ctx.font = '13px monospace';
  ctx.fillText('Пробел — пропустить', W / 2, H - 24);
  ctx.textAlign = 'left';
}
