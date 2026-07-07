'use strict';

// РЕНДЕР ЭКОНОМИКИ ГОРОДА (Батч 8, логика — economy.js): HUD-чипы КОНВЕРТЕРА (переключение рецепта) и ЭЛЕКТРОСТАНЦИИ (вкл/выкл + рейт).
// Стек в верх-лево ПОД виджетом города. Появляются только при установленном реликте. Клик — game._converterCycle / _powerPlantToggle.
// Хит-rect'ы → game._converterRect / _powerPlantRect (click-роутинг в game.js). ⚠️ перф: без ctx.filter/shadowBlur.
const _ECON_X = 14, _ECON_W = 188, _ECON_H = 34, _ECON_GAP = 6, _ECON_Y0 = 118;   // стандартная ширина (= HUD_VW)

function drawEconomyWidgets(ctx, game, W, H) {
  if (game.mode !== 'playing' || game.debug) return;
  const rects = {}, hl = (typeof HudLayout !== 'undefined');   // чипы стекаются в зоне tl (под фикс-панелями) — hud_layout.js
  let y = _ECON_Y0;   // фолбэк-стек, если HudLayout недоступен
  if (game.artifactHas && game.artifactHas('converter')) { const s = hl ? HudLayout.slotDock('tl', _ECON_W, _ECON_H, 'econ_conv', PAL.gold) : { x: _ECON_X, y: y }; _drawConverterChip(ctx, game, s.x, s.y); rects.conv = { x: s.x, y: s.y, w: _ECON_W, h: _ECON_H }; y = s.y + _ECON_H + _ECON_GAP; }
  if (game.artifactHas && game.artifactHas('power_plant')) { const s = hl ? HudLayout.slotDock('tl', _ECON_W, _ECON_H, 'econ_pow', PAL.amber) : { x: _ECON_X, y: y }; _drawPowerChip(ctx, game, s.x, s.y); rects.pow = { x: s.x, y: s.y, w: _ECON_W, h: _ECON_H }; y = s.y + _ECON_H + _ECON_GAP; }
  if (typeof metaHas === 'function' && metaHas('amb_split')) { const s = hl ? HudLayout.slotDock('tl', _ECON_W, _ECON_H, 'econ_split', PAL.gold) : { x: _ECON_X, y: y }; _drawSplitChip(ctx, game, s.x, s.y); rects.split = { x: s.x, y: s.y, w: _ECON_W, h: _ECON_H }; }
  game._converterRect = rects.conv || null;
  game._powerPlantRect = rects.pow || null;
  game._splitRect = rects.split || null;
}

function _econPlate(ctx, x, y, accent, dim) {
  ctx.save();
  ctx.globalAlpha = dim ? 0.7 : 1;
  ctx.fillStyle = 'rgba(10,12,14,0.82)'; ctx.fillRect(x, y, _ECON_W, _ECON_H);
  ctx.strokeStyle = accent; ctx.globalAlpha *= 0.55; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, _ECON_W - 1, _ECON_H - 1);
  ctx.globalAlpha = dim ? 0.7 : 1;
  ctx.fillStyle = accent; ctx.fillRect(x, y, 3, _ECON_H);   // акцент-полоска слева
  ctx.restore();
}
function _resDot(ctx, cx, cy, type, r) {
  const d = (typeof RESOURCE_DEFS !== 'undefined') && RESOURCE_DEFS[type];
  ctx.fillStyle = d ? d.color : '#888'; ctx.beginPath(); ctx.arc(cx, cy, r || 3.4, 0, 6.283); ctx.fill();
}

function _drawConverterChip(ctx, game, x, y) {
  const on = game.converterMode > 0, r = on ? game._converterRecipe() : null;
  const can = r ? game._converterCanRun(r) : true;
  const accent = PAL.gold;
  _econPlate(ctx, x, y, accent, !on);
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter;
  ctx.fillText(STR.hud.econ.convTitle, x + 9, y + 9);
  if (!on) {
    ctx.font = `bold 11px ${FONT_MONO}`; ctx.fillStyle = PAL.ash; ctx.fillText(STR.hud.econ.convOff, x + 9, y + 23);
  } else {
    // входы (цветные точки со «−N») → выход («+M»)
    const keys = Object.keys(r.cost); let dx = x + 11, ay = y + 23;
    ctx.font = `9px ${FONT_MONO}`;
    for (const k of keys) {
      _resDot(ctx, dx, ay, k, 3.2); ctx.fillStyle = can ? PAL.bone : (PAL.rust || '#c0402f');
      ctx.textAlign = 'left'; ctx.fillText('−' + r.cost[k], dx + 6, ay); dx += 30;
    }
    ctx.fillStyle = PAL.pewter; ctx.fillText('→', dx - 2, ay); dx += 12;
    const out = Math.max(1, Math.round(r.amt * game._artScaled('converter')));
    _resDot(ctx, dx, ay, r.out, 4); ctx.fillStyle = can ? '#bfe0a0' : (PAL.rust || '#c0402f');
    ctx.font = `bold 10px ${FONT_MONO}`; ctx.fillText('+' + out, dx + 7, ay);
    if (!can) { ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.rust || '#c0402f'; ctx.textAlign = 'right'; ctx.fillText(STR.hud.econ.convNeed, x + _ECON_W - 6, y + 9); }
  }
  ctx.restore();
}

function _drawSplitChip(ctx, game, x, y) {
  const on = game.crystalSplitOn, c = game.city, accent = PAL.gold;
  const have = game.upgrades && (game.upgrades.bank.crystal || 0) > 0;
  const active = on && c && c.dying && c.timer <= 0.05;   // сейчас продлевает таймер
  _econPlate(ctx, x, y, accent, !on);
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter;
  ctx.fillText(STR.hud.econ.splitTitle, x + 9, y + 9);
  hudToggleSwitch(ctx, x + _ECON_W - 12 - 30, y + 2, on);   // переключатель ВКЛ/ВЫКЛ — тот же элемент, что у «Обнаружения угроз» (hud.js)
  // статус: рейт возврата за кристалл + метка «нет кристалла»
  ctx.font = `10px ${FONT_MONO}`; ctx.textAlign = 'left';
  ctx.fillStyle = active ? accent : (on ? PAL.bone : PAL.ash);
  ctx.fillText(STR.hud.econ.splitRate(Math.round(game._crystalSplitReturn())), x + 9, y + 23);
  if (on && !have) { ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.rust || '#c0402f'; ctx.textAlign = 'right'; ctx.fillText(STR.hud.econ.splitNoFuel, x + _ECON_W - 8, y + 23); }
  ctx.restore();
}

function _drawPowerChip(ctx, game, x, y) {
  const on = game.powerPlantOn, c = game.city, accent = PAL.amber;
  const burning = c && c.powerReserve > 0;
  _econPlate(ctx, x, y, accent, !on);
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter;
  ctx.fillText(STR.hud.econ.powTitle, x + 9, y + 9);
  // тумблер справа
  ctx.font = `bold 9px ${FONT_MONO}`; ctx.textAlign = 'right';
  ctx.fillStyle = on ? PAL.toxic : PAL.ash; ctx.fillText(on ? STR.hud.toggle.on : STR.hud.toggle.off, x + _ECON_W - 8, y + 9);
  // статус: горит / рейт / нет топлива
  ctx.font = `10px ${FONT_MONO}`; ctx.textAlign = 'left';
  if (on && burning) { ctx.fillStyle = accent; ctx.fillText(STR.hud.econ.powBurn(Math.ceil(c.powerReserve)), x + 9, y + 23); }
  else if (on) { ctx.fillStyle = PAL.bone; ctx.fillText(STR.hud.econ.powRate(Math.round(game._powerPlantRate())), x + 9, y + 23); }
  else { ctx.fillStyle = PAL.ash; ctx.fillText(STR.hud.econ.powRate(Math.round(game._powerPlantRate())), x + 9, y + 23); }
  ctx.restore();
}
