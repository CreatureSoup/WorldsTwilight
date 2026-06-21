'use strict';

// «ОБНАРУЖЕНИЕ УГРОЗ» (эффект узла меты `mast_sa`) — голо-оверлей, маркирует прямо НА объектах:
//   • ВРАЖЕСКИЕ ЮНИТЫ — на всём экране (рамка-прицел поверх дрона);
//   • НЕСТАБИЛЬНОСТИ породы — трещины (`tile.unstable`) и камни-валуны (`tile.boulder`) —
//     ТОЛЬКО в радиусе СЕНСОРА (`unit.stats.scanR`); скоба-маркер поверх тайла, дрожащий
//     (`tile.shaking`, вот-вот сорвётся) — срочным цветом.
// Состояние/клик/клавиша — в game.js. Перф: прямой Canvas2D без filter/офскринов (spec_render).
// Кромочных стрелок-указателей здесь НЕТ намеренно (метим только то, что реально на виду/в радиусе).

// Прямоугольник HUD-тумблера (левый столбец, под «ГРУЗ») — общий для отрисовки и хит-теста клика.
function alertHudRect() { return { x: 10, y: 118, w: 188, h: 24 }; }

// Голо-дребезг: детерминирован по сиду/времени (без Math.random в кадре-цикле).
function _alertFlicker(t, seed) {
  const base = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * 13 + seed * 1.7));
  return Math.sin(t * 41 + seed * 3.1) > -0.9 ? base : base * 0.35;   // редкие «провалы» сигнала
}

// HUD-тумблер: LED + подпись + переключатель-капсула + счётчик враждебных юнитов.
function drawAlertToggle(ctx, on, threats, t) {
  const r = alertHudRect();
  techPanel(ctx, r.x, r.y, r.w, r.h, { accent: on ? PAL.toxic : PAL.bronze, bolts: false });
  const midY = r.y + r.h / 2;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  if (on) pulseDot(ctx, r.x + 13, midY, 3.2, PAL.toxic);
  else { ctx.fillStyle = PAL.ash; ctx.beginPath(); ctx.arc(r.x + 13, midY, 3, 0, 6.283); ctx.fill(); }
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = on ? PAL.chalk : PAL.pewter;
  ctx.fillText('ОБНАРУЖЕНИЕ УГРОЗ', r.x + 22, midY + 0.5);
  const sw = 30, sh = 14, sx = r.x + r.w - 12 - sw, sy = midY - sh / 2;
  ctx.fillStyle = on ? 'rgba(200,226,90,0.16)' : PAL.earth; ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = on ? PAL.toxic : PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle';
  if (on) {                                   // надпись слева, бегунок справа
    ctx.fillStyle = PAL.toxic; ctx.textAlign = 'left'; ctx.fillText('ВКЛ', sx + 5, sy + sh / 2 + 0.5);
    ctx.fillStyle = PAL.toxic; ctx.fillRect(sx + sw - 9, sy + 2, 7, sh - 4);
  } else {                                    // бегунок слева, надпись справа
    ctx.fillStyle = PAL.ash; ctx.fillRect(sx + 2, sy + 2, 7, sh - 4);
    ctx.fillStyle = PAL.ash; ctx.textAlign = 'right'; ctx.fillText('ВЫКЛ', sx + sw - 4, sy + sh / 2 + 0.5);
  }
  if (on && threats > 0) {                     // счётчик враждебных юнитов
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = `bold 9px ${FONT_MONO}`; ctx.fillStyle = PAL.bloodBright;
    ctx.fillText(`${threats}`, sx - 8, midY + 0.5);
    pulseSquare(ctx, sx - 8 - ctx.measureText(`${threats}`).width - 6, midY, 5, PAL.bloodBright);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Рамка-прицел: 4 уголка (лёгкое колебание поворота) + крест по центру + пульс-кольцо «захвата».
function _alertReticle(ctx, x, y, R, acc, t, seed) {
  const rot = Math.sin(t * 1.5 + seed) * 0.09;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = acc; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
  const c = R * 0.5;
  for (const [gx, gy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(gx * R, gy * R - gy * c); ctx.lineTo(gx * R, gy * R); ctx.lineTo(gx * R - gx * c, gy * R);
    ctx.stroke();
  }
  ctx.restore();
  const ph = (t * 0.8 + seed) % 1, a0 = ctx.globalAlpha;   // кольцо захвата расходится и гаснет
  ctx.save();
  ctx.globalAlpha = a0 * (1 - ph) * 0.55;
  ctx.strokeStyle = acc; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, R * (0.5 + ph * 0.7), 0, 6.283); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = acc; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
}

// Маркер вражеского юнита — рамка-прицел ПОВЕРХ дрона (цвет по типу), без бирок/дистанций.
function _drawUnitMark(ctx, x, y, acc, e, t) {
  const seed = e.seed || 0, a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * _alertFlicker(t, seed);
  _alertReticle(ctx, x, y, ALERT.reticleR, acc, t, seed);
  ctx.globalAlpha = a0;
}

// Маркер нестабильного тайла — скоба-уголки ПОВЕРХ породы + глиф (камень=ромб / трещина=зигзаг) +
// лёгкая подсветка. `hot` (дрожит) — срочный цвет и пульс.
function _drawTileMark(ctx, cx, cy, boulder, hot, t, seed) {
  const acc = hot ? ALERT.hazardHot : ALERT.hazard;
  const fl = hot ? (0.55 + 0.45 * Math.abs(Math.sin(t * 9))) : _alertFlicker(t, seed);
  const a0 = ctx.globalAlpha, h = TILE * 0.5 - 2, c = TILE * 0.22;
  ctx.globalAlpha = a0 * fl * 0.10; ctx.fillStyle = acc; ctx.fillRect(cx - h, cy - h, h * 2, h * 2);   // подсветка тайла
  ctx.globalAlpha = a0 * fl;
  ctx.strokeStyle = acc; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (const [gx, gy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {     // уголки-скоба по тайлу
    ctx.beginPath();
    ctx.moveTo(cx + gx * h, cy + gy * h - gy * c); ctx.lineTo(cx + gx * h, cy + gy * h); ctx.lineTo(cx + gx * h - gx * c, cy + gy * h);
    ctx.stroke();
  }
  if (boulder) {                                                      // камень — ромб
    const r = TILE * 0.16;
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.stroke();
  } else {                                                            // трещина — зигзаг
    const s = TILE * 0.18;
    ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s * 0.3, cy - s * 0.2); ctx.lineTo(cx - s * 0.3, cy + s * 0.2); ctx.lineTo(cx + s, cy + s); ctx.stroke();
  }
  ctx.globalAlpha = a0;
}

// Главная: оверлей по врагам (весь экран) + по нестабильностям породы (радиус сенсора).
// Гейт (mode/metaHas/alertView) — на стороне game.
function drawAlertOverlay(ctx, game, camera, W, H, t) {
  const unit = game.unit; if (!unit) return;
  ctx.save();
  // 1) ВРАГИ — на всём экране (только видимые), прицел поверх дрона
  for (const e of (game.enemies || [])) {
    if (e.dead) continue;
    const sx = camera.screenX(e.px), sy = e.py - camera.y;
    if (sx < -TILE || sx > W + TILE || sy < -TILE || sy > H + TILE) continue;
    _drawUnitMark(ctx, sx, sy, ALERT.unit, e, t);
  }
  // 2) НЕСТАБИЛЬНОСТИ породы — ТОЛЬКО в радиусе сенсора (трещины/камни), скоба поверх тайла
  const world = game.world;
  if (world) {
    const R = (unit.stats && unit.stats.scanR) || SCANNER_R, ri = Math.ceil(R), r2 = R * R;
    const ux = unit.tileX, uy = unit.tileY;
    for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const ty = uy + dy; if (ty < 0 || ty >= MAP_H) continue;
      const tile = world.tileAt(ux + dx, ty);
      if (!tile || tile.type !== ROCK || !(tile.unstable || tile.boulder)) continue;
      const cx = camera.screenX((ux + dx + 0.5) * TILE), cy = (ty + 0.5) * TILE - camera.y;
      _drawTileMark(ctx, cx, cy, tile.boulder, tile.shaking, t, (ux + dx) * 7 + ty * 13);
    }
  }
  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
