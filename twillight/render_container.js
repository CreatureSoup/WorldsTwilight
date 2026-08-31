'use strict';

// Рендер КОНТЕЙНЕРОВ-ХРАНИЛИЩ (containers.js): погребённый крейт (виден после откопа) + анимация ВЗЛОМА (кольцо-
// прогресс сейф-крекинга + дребезг-биты + процент) + замок-дужка «нужен узел взлома». В мире ПОД туманом (в
// прокопанном ходе — раскрыто → видно). ⚠️ перф: без ctx.filter/shadowBlur, 'lighter' только на FX взлома.
function drawContainers(ctx, game, camera) {
  const w = game.world; if (!w || !w.containers || !w.containers.length) return;
  for (const c of w.containers) {
    if (!c.dug || c.opened || !w.isSeen(c.tx, c.ty)) continue;
    const cx = Math.round(camera.screenX((c.tx + 0.5) * TILE)), cy = Math.round((c.ty + 0.5) * TILE - camera.y);
    _drawCrate(ctx, cx, cy, c, game);
  }
}

function _drawCrate(ctx, cx, cy, c, game) {
  const s = TILE * 0.33, acc = (RESOURCE_DEFS[c.type] && RESOURCE_DEFS[c.type].color) || '#c8a24a';
  const breaching = game.activeContainer === c, locked = game.lockedContainer === c, t = performance.now() / 1000;
  ctx.save(); ctx.textAlign = 'center';
  // корпус-крейт + рама + полоса-крышка
  ctx.fillStyle = '#241f18'; ctx.fillRect(cx - s, cy - s * 0.82, s * 2, s * 1.64);
  ctx.strokeStyle = '#5a5240'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - s + 0.5, cy - s * 0.82 + 0.5, s * 2 - 1, s * 1.64 - 1);
  ctx.strokeStyle = '#6a6250'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - s, cy - s * 0.22); ctx.lineTo(cx + s, cy - s * 0.22); ctx.stroke();
  // замок-ядро: тон ресурса (при взломе дрожит ярче); locked → красный
  ctx.fillStyle = locked ? PAL.enemyEye : acc; ctx.globalAlpha = breaching ? 0.7 + 0.3 * Math.sin(t * 22) : 0.9;
  ctx.fillRect(cx - 3, cy - 2, 6, 6); ctx.globalAlpha = 1;
  if (locked) { ctx.strokeStyle = PAL.enemyEye; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(cx, cy - 3, 4, Math.PI, 0); ctx.stroke(); }   // дужка замка (нет узла)
  if (breaching) {   // КОЛЬЦО-ПРОГРЕСС взлома (сейф-крекинг, янтарь) + дребезг-биты + процент
    const p = c.breach, R = s * 1.7;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(224,176,72,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#e0b048'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
    for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1, rr = R * (0.45 + 0.4 * ((Math.sin(t * 9 + i) + 1) / 2)); ctx.fillStyle = 'rgba(232,200,120,0.75)'; ctx.fillRect(cx + Math.cos(a) * rr - 1, cy + Math.sin(a) * rr - 1, 2, 2); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#f0e0b0'; ctx.font = `bold 8px ${FONT_MONO}`; ctx.textBaseline = 'bottom'; ctx.fillText((p * 100 | 0) + '%', cx, cy - s - 3);
  }
  ctx.restore();
}
