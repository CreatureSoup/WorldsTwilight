'use strict';

// Рендер ПАНЕЛИ АКТИВНЫХ ДЕЙСТВИЙ (внизу-центру): по кнопке на активный модуль (см. actionbar.js `_actionList`).
// Кнопка — квадрат в дизайн-системе (тёмная плита + уголки `_panelCorners` + 1px рамка), простая ИКОНКА в акценте,
// мелкий ХОТКЕЙ сверху. Состояния: норма (бронза/кость) · ховер/нажатие/АКТИВНО (акцент + подсветка) · кулдаун
// (тускло + полоска снизу). Hit-rect'ы кладём в `game._actionRects` → mousedown в game роутит клик (actionBarClick).
// ⚠️ перф: без ctx.filter/shadowBlur. Гейт: только playing, не печать/дебаг.

function drawActionBar(ctx, game, W, H) {
  if (game.mode !== 'playing' || game.debug || game.printMode) { game._actionRects = []; return; }
  const list = game._actionList(); game._actionRects = [];
  if (!list.length) return;

  const bw = 44, bh = 44, gap = 10;
  const total = list.length * bw + (list.length - 1) * gap;
  let x = Math.round((W - total) / 2); const y = H - 30 - bh;   // внизу-центру, над строкой подсказок управления
  const mx = game.menuMouse ? game.menuMouse.x : -1, my = game.menuMouse ? game.menuMouse.y : -1;
  const t = performance.now() / 1000;

  for (const d of list) {
    const col = d.col;
    const hover = mx >= x && mx <= x + bw && my >= y && my <= y + bh;
    const held = game._actionHeld === d.code;
    const active = !!(d.active && d.active(game));
    const frac = Math.max(0, Math.min(1, d.fill ? d.fill(game) : 0));   // ЗАПОЛНЕНИЕ иконки: заряд/готовность (0..1)
    const lit = active || held || hover;
    game._actionRects.push({ x, y, w: bw, h: bh, code: d.code });

    ctx.fillStyle = 'rgba(13,12,16,0.84)'; ctx.fillRect(x, y, bw, bh);   // плита

    if (frac > 0.001) {                                                  // ЗАЛИВКА ВСЕЙ ИКОНКИ снизу-вверх (заряд/перезарядка)
      const fh = Math.round((bh - 2) * frac), fy = y + (bh - 1) - fh;
      ctx.save(); ctx.globalAlpha = active ? 0.38 + 0.1 * Math.sin(t * 6) : 0.3; ctx.fillStyle = col;
      ctx.fillRect(x + 1, fy, bw - 2, fh);
      ctx.globalAlpha = 0.85; ctx.fillRect(x + 1, fy, bw - 2, 1.5);      // яркая кромка уровня заливки
      ctx.restore();
    }
    if (held && !active) { ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = col; ctx.fillRect(x, y, bw, bh); ctx.restore(); }   // подсветка нажатия

    ctx.strokeStyle = lit ? col : 'rgba(122,112,94,0.45)'; ctx.lineWidth = 1;   // рамка
    ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    if (typeof _panelCorners === 'function') _panelCorners(ctx, x, y, bw, bh, lit ? col : PAL.bronze, 7);

    _actionIcon(ctx, d.icon, x + bw / 2, y + bh / 2 + 1, 11, lit ? col : PAL.bone);   // иконка поверх заливки

    ctx.font = `7px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';   // ХОТКЕЙ сверху, мелко
    ctx.fillStyle = lit ? col : PAL.pewter;
    ctx.fillText(keyLabel(d.code), x + bw / 2, y - 4);

    x += bw + gap;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Простые процедурные глифы действий (в акцентном цвете col, полу-размер s, центр cx,cy).
function _actionIcon(ctx, type, cx, cy, s, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (type === 'impulse') {            // волна (дуги) + стрелка вправо
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(cx - s * 0.25, cy, s * (0.5 + i * 0.4), -0.9, 0.9); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx + s * 0.7, cy); ctx.lineTo(cx + s * 0.1, cy - s * 0.55); ctx.lineTo(cx + s * 0.1, cy + s * 0.55); ctx.closePath(); ctx.fill();
  } else if (type === 'screw') {        // стопка шевронов вниз — проходка
    for (let i = 0; i < 3; i++) { const yy = cy - s * 0.55 + i * s * 0.5; ctx.beginPath(); ctx.moveTo(cx - s * 0.55, yy); ctx.lineTo(cx, yy + s * 0.42); ctx.lineTo(cx + s * 0.55, yy); ctx.stroke(); }
  } else if (type === 'radar') {        // сектор-развёртка + луч + ядро
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.35, s * 0.95, -Math.PI * 0.95, -Math.PI * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.35); ctx.lineTo(cx + Math.cos(-Math.PI * 0.32) * s * 0.95, cy + s * 0.35 + Math.sin(-Math.PI * 0.32) * s * 0.95); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.35, s * 0.14, 0, 6.283); ctx.fill();
  } else if (type === 'echo') {         // концентрические кольца
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 1 - i * 0.28; ctx.beginPath(); ctx.arc(cx, cy, s * (0.32 + i * 0.32), 0, 6.283); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (type === 'hack') {         // скобки + ядро-вторжение
    ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.62, cy - s * 0.6); ctx.lineTo(cx - s * 0.62, cy + s * 0.6); ctx.lineTo(cx - s * 0.35, cy + s * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.62, cy - s * 0.6); ctx.lineTo(cx + s * 0.62, cy + s * 0.6); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke();
    ctx.fillRect(cx - s * 0.2, cy - s * 0.2, s * 0.4, s * 0.4);
  }
}
