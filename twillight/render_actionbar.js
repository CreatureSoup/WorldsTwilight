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
  let y = H - 30 - bh;                                          // внизу-центру, над строкой подсказок управления
  let x = Math.round((W - total) / 2);                          // по умолчанию — центр экрана
  // Обход занятых виджетов в СВОЕЙ горизонтальной полосе (печать слева, лог справа): влезает в СВОБОДНЫЙ интервал [L,R] —
  // центрируемся там (низ); НЕ влезает — ПОДНИМАЕМ панель НАД полосой (свой ряд), а не уезжаем за край/поверх лога.
  if (typeof HudLayout !== 'undefined') {
    const b0 = y, b1 = y + bh, cx = W / 2; let L = 0, R = W, bandTop = H;
    for (const r of HudLayout.rects()) {
      if (r.zone === 'action-bar' || r.y + r.h <= b0 || r.y >= b1) continue;   // не пересекает полосу — пропуск
      // классификация по ЦЕНТРУ виджета (не по краю): виджет, ПЕРЕСЕКАЮЩИЙ середину (длинная запись лога), считаем правым.
      if (r.x + r.w / 2 < cx) L = Math.max(L, r.x + r.w + gap); else R = Math.min(R, r.x - gap);
      bandTop = Math.min(bandTop, r.y);                          // верх занятых виджетов полосы (для подъёма)
    }
    if (total <= R - L) x = Math.round((L + R) / 2 - total / 2);   // ВЛЕЗАЕТ в зазор → центр зазора (низ)
    else { y = Math.round(bandTop - bh - gap); x = Math.round((W - total) / 2); }   // НЕ влезает → свой ряд НАД полосой, центр экрана
    x = Math.max(gap, Math.min(x, W - total - gap));              // всегда в пределах экрана (не за край)
    HudLayout.mark(x, y, total, bh, 'action-bar');               // в валидатор (после позиционирования)
  }
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
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.35, s * 0.14, 0, TAU); ctx.fill();
  } else if (type === 'echo') {         // концентрические кольца
    for (let i = 0; i < 3; i++) { ctx.globalAlpha = 1 - i * 0.28; ctx.beginPath(); ctx.arc(cx, cy, s * (0.32 + i * 0.32), 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (type === 'hack') {         // скобки + ядро-вторжение
    ctx.beginPath(); ctx.moveTo(cx - s * 0.35, cy - s * 0.6); ctx.lineTo(cx - s * 0.62, cy - s * 0.6); ctx.lineTo(cx - s * 0.62, cy + s * 0.6); ctx.lineTo(cx - s * 0.35, cy + s * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.35, cy - s * 0.6); ctx.lineTo(cx + s * 0.62, cy - s * 0.6); ctx.lineTo(cx + s * 0.62, cy + s * 0.6); ctx.lineTo(cx + s * 0.35, cy + s * 0.6); ctx.stroke();
    ctx.fillRect(cx - s * 0.2, cy - s * 0.2, s * 0.4, s * 0.4);
  } else if (type === 'siege') {        // сфокусированный разряд: сходящийся клин + копьё-наконечник
    ctx.beginPath(); ctx.moveTo(cx - s * 0.75, cy - s * 0.55); ctx.lineTo(cx - s * 0.2, cy); ctx.lineTo(cx - s * 0.75, cy + s * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.78, cy); ctx.lineTo(cx + s * 0.02, cy - s * 0.52); ctx.lineTo(cx + s * 0.02, cy + s * 0.52); ctx.closePath(); ctx.fill();
  } else if (type === 'stealth') {      // глаз с перечёркиванием — невидимость
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.72, s * 0.42, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.72, cy + s * 0.6); ctx.lineTo(cx + s * 0.72, cy - s * 0.6); ctx.stroke();
  } else if (type === 'jam') {          // глушение: расходящиеся скобки-волны (помеха) + ядро
    for (let i = 1; i <= 2; i++) {
      const r = s * (0.32 + i * 0.32);
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI - 0.85, Math.PI + 0.85); ctx.stroke();   // слева
      ctx.beginPath(); ctx.arc(cx, cy, r, -0.85, 0.85); ctx.stroke();                       // справа
    }
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.17, 0, TAU); ctx.fill();
  } else if (type === 'jets') {         // прыжковые движки: сопло + двойной язык выхлопа вниз
    ctx.beginPath(); ctx.moveTo(cx - s * 0.5, cy - s * 0.6); ctx.lineTo(cx + s * 0.5, cy - s * 0.6); ctx.lineTo(cx + s * 0.32, cy + s * 0.1); ctx.lineTo(cx - s * 0.32, cy + s * 0.1); ctx.closePath(); ctx.stroke();   // корпус-сопло
    for (const k of [-0.22, 0.22]) { ctx.beginPath(); ctx.moveTo(cx + k * s - s * 0.12, cy + s * 0.12); ctx.lineTo(cx + k * s, cy + s * 0.7); ctx.lineTo(cx + k * s + s * 0.12, cy + s * 0.12); ctx.closePath(); ctx.fill(); }   // языки выхлопа
  } else if (type === 'stun') {         // ЭМИ-импульс: ядро + лучи-разряды наружу (статический выброс)
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = s * 0.34, r1 = s * (i % 2 ? 0.95 : 0.7); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); }
  } else if (type === 'blast') {        // подрыв-заряд: звезда-вспышка (рваные лучи из центра)
    ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = s * (i % 2 ? 0.95 : 0.42); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
  } else if (type === 'nano') {         // нано-ремонт: медицинский крест в кольце
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.85, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.5); ctx.lineTo(cx, cy + s * 0.5); ctx.moveTo(cx - s * 0.5, cy); ctx.lineTo(cx + s * 0.5, cy); ctx.stroke();
  } else if (type === 'dash') {         // рывок: двойной шеврон вправо + след-черта (импульс движения)
    for (let i = 0; i < 2; i++) { const xx = cx - s * 0.15 + i * s * 0.5; ctx.beginPath(); ctx.moveTo(xx - s * 0.3, cy - s * 0.55); ctx.lineTo(xx + s * 0.25, cy); ctx.lineTo(xx - s * 0.3, cy + s * 0.55); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - s * 0.85, cy); ctx.lineTo(cx - s * 0.45, cy); ctx.stroke();
  } else if (type === 'harpoon') {      // гарпун: древко-трос слева + зубчатый наконечник-крюк справа
    ctx.beginPath(); ctx.moveTo(cx - s * 0.85, cy); ctx.lineTo(cx + s * 0.35, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.85, cy); ctx.lineTo(cx + s * 0.3, cy - s * 0.5); ctx.lineTo(cx + s * 0.45, cy); ctx.lineTo(cx + s * 0.3, cy + s * 0.5); ctx.closePath(); ctx.fill();   // наконечник
    ctx.beginPath(); ctx.arc(cx - s * 0.7, cy, s * 0.22, 0, TAU); ctx.stroke();   // петля троса
  } else if (type === 'xray') {         // рентген: глаз-зрачок + расходящиеся лучи-вскрытие
    ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.7, s * 0.42, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.2, 0, TAU); ctx.fill();
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.75, cy + Math.sin(a) * s * 0.6); ctx.lineTo(cx + Math.cos(a) * s * 1.0, cy + Math.sin(a) * s * 0.85); ctx.stroke(); }
  } else if (type === 'anchor') {       // якорь кабеля: шток с кольцом сверху + лапы-крюки снизу
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.55, s * 0.28, 0, TAU); ctx.stroke();                     // кольцо
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.3); ctx.lineTo(cx, cy + s * 0.7); ctx.stroke();          // шток
    ctx.beginPath(); ctx.moveTo(cx - s * 0.55, cy + s * 0.15); ctx.lineTo(cx + s * 0.55, cy + s * 0.15); ctx.stroke();   // перекладина
    ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy + s * 0.35); ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.75, cx, cy + s * 0.7); ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.75, cx + s * 0.6, cy + s * 0.35); ctx.stroke();   // лапы
  } else if (type === 'dronehack') {    // дрон-хакер: капсула-дрон + ротор + луч-взлом вниз
    ctx.beginPath(); ctx.ellipse(cx, cy - s * 0.2, s * 0.5, s * 0.32, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.6, cy - s * 0.55); ctx.lineTo(cx + s * 0.6, cy - s * 0.55); ctx.stroke();   // ротор
    ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.12); ctx.lineTo(cx, cy + s * 0.85); ctx.stroke(); ctx.setLineDash([]);   // луч-взлом
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.85, s * 0.18, 0, TAU); ctx.stroke();
  }
}
