'use strict';

// ИНДИКАТОР ВОЛНЫ под «ЦИКЛ N» (там, где был текст «СЛЕД. ЧЕРЕЗ Xс»).
//  • ПО УМОЛЧАНИЮ (без узла `amb_predict`): только ПРОГРЕСС-БАР до следующего цикла (нейтральный цвет, без чисел/типа).
//  • С УЗЛОМ ПРЕДИКТА: бар + глиф/имя надвигающегося типа врага + ТАЙМЕР ОБРАТНОГО ОТСЧЁТА (мм:сс) + тег «НОВАЯ» при
//    эскалации; цвет — угрозы (кровь/янтарь), разгорается к красному и пульсирует на подлёте.
// Заголовок волны — `game._waveHeadline(cycle.n+1)` (тип детерминирован по `WAVE_CYCLE`). Гейт: playing, не дебаг/история.
// Лог о новой угрозе пишет ai.js (updateEnemies) при смене цикла. ⚠️ перф: без ctx.filter/shadowBlur.

function drawWavePredict(ctx, game, x, y) {
  if (game.mode !== 'playing' || game.debug || game.storyMode || !game.cycle) return;
  const node = typeof metaHas === 'function' && metaHas('amb_predict');
  const frac = Math.max(0, Math.min(1, game.cycle.frac()));   // 0..1, заполняется к волне
  const f = node ? game._waveHeadline(game.cycle.n + 1) : null;
  const combat = !!(f && f.type !== 'digger' && f.type !== 'collector');
  const imminent = frac > 0.82;
  const base = !node ? '#7a705e' : (combat ? '#a8281c' : '#f08a2a');   // без узла — бронза; с узлом — цвет угрозы
  const hot  = !node ? '#b8a896' : (combat ? '#ff3a22' : '#ffb45a');
  const col = imminent ? hot : base;
  const t = performance.now() / 1000;

  const bw = node ? 80 : 120, bh = 6, by = y + 2;             // ПРОГРЕСС-БАР до следующего цикла
  ctx.fillStyle = 'rgba(20,16,14,0.85)'; ctx.fillRect(x, by, bw, bh);
  ctx.strokeStyle = 'rgba(122,112,94,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, by + 0.5, bw - 1, bh - 1);
  const fw = Math.round((bw - 2) * frac);
  ctx.save(); ctx.globalAlpha = imminent ? 0.72 + 0.28 * Math.sin(t * 8) : 0.82; ctx.fillStyle = col;
  ctx.fillRect(x + 1, by + 1, fw, bh - 2); ctx.restore();
  if (fw > 1) { ctx.fillStyle = hot; ctx.fillRect(x + fw, by, 1.5, bh); }   // яркий фронт
  if (!node || !f) return;   // БЕЗ узла предикта — только прогресс-бар (ни типа, ни отсчёта)

  const gs = 16, gx = x + bw + 8, gy = by - 5;               // глиф надвигающегося типа в рамке (волна «приходит» сюда)
  ctx.fillStyle = 'rgba(20,16,14,0.9)'; ctx.fillRect(gx, gy, gs, gs);
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gs - 1, gs - 1);
  ctx.save(); if (imminent) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 8);
  _waveGlyph(ctx, f.type, gx + gs / 2, gy + gs / 2, 5, col); ctx.restore();

  // имя + ТАЙМЕР ОБРАТНОГО ОТСЧЁТА (мм:сс) + тег НОВАЯ
  const tl = Math.max(0, game.cycle.timeLeft());
  const mmss = Math.floor(tl / 60) + ':' + String(Math.floor(tl % 60)).padStart(2, '0');
  const nm = ENEMY_RU[f.type] || '';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `8px ${FONT_MONO}`;
  let tx = x;
  ctx.fillStyle = combat ? PAL.bone : PAL.pewter; ctx.fillText(nm, tx, y + 14); tx += ctx.measureText(nm).width + 8;
  ctx.fillStyle = col; ctx.fillText(mmss, tx, y + 14); tx += ctx.measureText(mmss).width + 8;
  if (f.isNew) { ctx.fillStyle = '#ff3a22'; ctx.fillText(STR.hud.predict.fresh, tx, y + 14); }
  ctx.textBaseline = 'alphabetic';
}

// Простые процедурные глифы типов врагов (в акценте col, полу-размер s, центр cx,cy).
function _waveGlyph(ctx, type, cx, cy, s, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (type === 'digger') {              // бур-клин вниз
    ctx.beginPath(); ctx.moveTo(cx, cy + s); ctx.lineTo(cx - s * 0.7, cy - s * 0.6); ctx.lineTo(cx + s * 0.7, cy - s * 0.6); ctx.closePath(); ctx.fill();
  } else if (type === 'collector') {     // шестиугольник-контейнер
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3, px = cx + Math.cos(a) * s, py = cy + Math.sin(a) * s; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke();
  } else if (type === 'raider') {        // дротик вправо
    ctx.beginPath(); ctx.moveTo(cx + s, cy); ctx.lineTo(cx - s * 0.5, cy - s * 0.75); ctx.lineTo(cx - s * 0.15, cy); ctx.lineTo(cx - s * 0.5, cy + s * 0.75); ctx.closePath(); ctx.fill();
  } else if (type === 'hunter') {        // двойной шеврон-дротик
    ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy - s * 0.7); ctx.lineTo(cx + s * 0.2, cy); ctx.lineTo(cx - s * 0.7, cy + s * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s * 0.05, cy - s * 0.7); ctx.lineTo(cx + s * 0.85, cy); ctx.lineTo(cx - s * 0.05, cy + s * 0.7); ctx.stroke();
  } else if (type === 'hacker') {        // скобки + ядро-вторжение
    ctx.beginPath(); ctx.moveTo(cx - s * 0.4, cy - s); ctx.lineTo(cx - s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.lineTo(cx - s * 0.4, cy + s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + s * 0.4, cy - s); ctx.lineTo(cx + s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.lineTo(cx + s * 0.4, cy + s); ctx.stroke();
    ctx.fillRect(cx - s * 0.28, cy - s * 0.28, s * 0.56, s * 0.56);
  } else if (type === 'sniper') {        // прицел
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.68, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s); ctx.stroke();
  }
}
