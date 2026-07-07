'use strict';

// ПРЫЖКОВЫЕ ДВИЖКИ — FX полёта (game.jets; логика — jets.js). ОДИН язык выхлопа по ЦЕНТРУ юнита, направлен
// ПРОТИВОПОЛОЖНО движению (летит вверх → выхлоп вниз, вправо → влево и т.д.; парит → вниз, держит высоту).
// Мигает при НИЗКОМ топливе. Поверх мира. ⚠️ перф (spec_render.md): без ctx.filter/shadowBlur; 'lighter' на пламени.
function drawJets(ctx, game, camera) {
  const j = game.jets, u = game.unit; if (!j || !j.on || !u) return;
  const cx = Math.round(camera.screenX(u.px)), cy = Math.round(u.py - camera.y);
  const t = performance.now() / 1000, low = j.fuel / JETS_FUEL_MAX < 0.25;
  let fdx = -(u.dx || 0), fdy = -(u.dy || 0);       // выхлоп = ПРОТИВ направления движения
  if (fdx === 0 && fdy === 0) fdy = 1;              // парение (нет движения) → выхлоп вниз
  const ang = Math.atan2(fdy, fdx) - Math.PI / 2;  // локальный язык рисуем «вниз» (+Y) → поворот к направлению выхлопа
  const len = TILE * (0.7 + 0.42 * (0.5 + 0.5 * Math.sin(t * 30)));
  const flick = low ? (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 42))) : 1;   // мигание при низком топливе — предупреждение
  const cols = ['rgba(255,236,150,', 'rgba(255,182,84,', 'rgba(255,120,40,'], R0 = TILE * 0.28;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
  // ⚠️ перф: БЕЗ createLinearGradient — затухание имитируем 3 вложенными языками с убывающей alpha/шириной.
  for (let k = 0; k < 3; k++) {
    const f = 1 - k / 3, w = TILE * 0.17 * f, l = len * (1 - k * 0.16);
    ctx.fillStyle = cols[k] + (0.55 * flick * f).toFixed(2) + ')';
    ctx.beginPath(); ctx.moveTo(-w, R0); ctx.lineTo(w, R0); ctx.lineTo(0, R0 + l); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
