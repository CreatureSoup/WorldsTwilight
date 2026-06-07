'use strict';

// Старые серверы (источники данных) и сканер. Маркер в породе (виден через туман), «хлам» после
// откопки, лучи сканера от модуля сканера к хламу + Oblivion-трассировка, пока качаются данные.
// Прогресс-кольцо извлечения и лог-событие — в hud.js / game.js. Чисто рендер (логика — game).

// Маркеры серверов в породе + «хлам» после откопки. Рисуется ПОСЛЕ drawWorld (туман сверху
// приглушит невидимые), до тумана/юнита.
function drawServers(ctx, world, camera, debug) {
  if (!world || !world.servers) return;
  const t = performance.now() / 1000;
  for (const s of world.servers) {
    if (!debug && !world.isSeen(s.tx, s.ty)) continue;   // в дебаг-обзоре — без тумана (как маркеры городов/гнёзд)
    const sx = camera.screenX((s.tx + 0.5) * TILE), sy = (s.ty + 0.5) * TILE - camera.y;
    if (s.dug) _drawJunk(ctx, sx, sy, t, s.done);
    else _drawServerMarker(ctx, sx, sy, t);
    if (debug) _drawServerDebug(ctx, sx, sy, s);   // явная метка в дебаге (чтобы не путать с рудой)
  }
}

// Дебаг-обвод сервера: cobalt-кольцо + метка статуса (не путать с железной жилой в породе).
function _drawServerDebug(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = PAL.cobalt; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 13, 0, 6.283); ctx.stroke();
  ctx.fillStyle = PAL.cobaltBright || PAL.cobalt;
  ctx.font = '700 8px ' + (typeof FONT_MONO !== 'undefined' ? FONT_MONO : 'monospace');
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText(s.done ? 'DATA·OK' : s.dug ? 'DATA·' + Math.round(s.data * 100) : 'СЕРВЕР', x, y - 15);
  ctx.restore();
}

// Тех-вкрапление в породе: корпус-блок с рёбрами + мигающий LED (cobalt) — намёк «здесь данные».
function _drawServerMarker(ctx, x, y, t) {
  ctx.save();
  ctx.fillStyle = PAL.carbon; ctx.fillRect(x - 7, y - 6, 14, 12);
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(x - 7.5, y - 6.5, 15, 13);
  ctx.strokeStyle = PAL.ash; ctx.lineWidth = 1;
  for (let i = -4; i <= 4; i += 4) { ctx.beginPath(); ctx.moveTo(x + i, y - 6); ctx.lineTo(x + i, y + 6); ctx.stroke(); }
  ctx.globalAlpha = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 4)); ctx.fillStyle = PAL.cobalt;
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  ctx.restore();
}

// Кучка тех-хлама после откопки: обломки + плата + мигающий LED (пока данные не сняты). done → тусклее.
function _drawJunk(ctx, x, y, t, done) {
  ctx.save();
  if (done) ctx.globalAlpha = 0.78;
  ctx.fillStyle = PAL.carbon;
  ctx.beginPath(); ctx.moveTo(x - 10, y + 6); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 3, y - 2); ctx.lineTo(x + 10, y + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = PAL.bronze; ctx.fillRect(x - 3, y - 6, 7, 5);                 // обломок платы
  ctx.fillStyle = PAL.ash; ctx.fillRect(x - 8, y + 2, 3, 3); ctx.fillRect(x + 4, y + 1, 3, 4);
  if (!done) { ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 5)); ctx.fillStyle = PAL.cobalt; ctx.fillRect(x, y - 5, 2, 2); }
  ctx.restore();
}

// Лучи сканера + трассировка (Oblivion): от модуля сканера к хламу, пока game.activeScan активен.
// Рисуется ПОСЛЕ юнита (поверх). game — для unit/activeScan/debugTentacles.
function drawScanFx(ctx, game, camera) {
  const s = game.activeScan; if (!s || !game.unit) return;
  const t = performance.now() / 1000;
  const tx = camera.screenX((s.tx + 0.5) * TILE), ty = (s.ty + 0.5) * TILE - camera.y;
  const bo = (typeof tentacleBodyOffset === 'function' && game.debugTentacles) ? tentacleBodyOffset() : { x: 0, y: 0 };
  // Апекс конуса/лучей — РОВНО модуль сканера. В блупринте кольца его kind — 'sensor'
  // (а 'scanner' — лишь флаг-стат need), поэтому ищем 'sensor', иначе src падал в центр юнита.
  const src = (typeof ringModuleScreenPos === 'function')
    ? ringModuleScreenPos(game.unit, camera, 'sensor', bo)
    : { x: camera.screenX(game.unit.px) + bo.x, y: game.unit.py - camera.y + bo.y };

  const r = 14;                                  // полугабарит цели
  // Геометрия конуса: апекс — у излучателя (src), раствор подобран так, чтобы накрыть объект (±r).
  const dx = tx - src.x, dy = ty - src.y, dist = Math.hypot(dx, dy) || 1;
  const baseAng = Math.atan2(dy, dx);
  const half = Math.min(0.6, Math.atan2(r, dist) * 1.25);   // полураствор; clamp на случай близкого src
  const reach = dist + r, aMin = baseAng - half, aMax = baseAng + half;
  // Контакт ходит ОТ КРАЯ ДО КРАЯ по углу конуса (sin → разворот у краёв, как механический скан).
  const ray = (ang, dim, w) => { ctx.strokeStyle = dim; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(src.x + Math.cos(ang) * reach, src.y + Math.sin(ang) * reach); ctx.stroke(); };

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 1) ПОЛУПРОЗРАЧНЫЙ объёмный КОНУС света от излучателя к объекту (мягкий, гаснет к краю)
  ctx.beginPath();
  ctx.moveTo(src.x, src.y);
  ctx.lineTo(src.x + Math.cos(aMin) * reach, src.y + Math.sin(aMin) * reach);
  ctx.arc(src.x, src.y, reach, aMin, aMax);
  ctx.closePath();
  const cone = ctx.createRadialGradient(src.x, src.y, 2, src.x, src.y, reach);
  cone.addColorStop(0, 'rgba(95,165,238,0.16)'); cone.addColorStop(0.65, 'rgba(80,150,228,0.13)'); cone.addColorStop(1, 'rgba(70,140,220,0)');
  ctx.fillStyle = cone; ctx.fill();

  // 2) тусклые объёмные лучи-стрики ВНУТРИ конуса (статичные — «пыльный свет» в луче)
  for (let k = -1; k <= 1.001; k += 0.5) ray(baseAng + k * half * 0.9, 'rgba(120,180,240,0.09)', 1);

  // 3) ЯРКИЕ ТРАССИРУЮЩИЕ лучи ходят от края до края (главный + второй в противофазе)
  const ang = baseAng + Math.sin(t * 2.0) * half;
  ray(ang, 'rgba(120,185,255,0.30)', 4);
  ray(ang, `rgba(175,218,255,${0.6 + 0.25 * (0.5 + 0.5 * Math.sin(t * 11))})`, 1.6);
  ray(baseAng + Math.sin(t * 2.0 + 2.1) * half * 0.85, 'rgba(150,200,255,0.20)', 1.2);

  // 4) пятно контакта главного луча — бежит по объекту от края до края
  const ex = src.x + Math.cos(ang) * dist, ey = src.y + Math.sin(ang) * dist;
  const sp = ctx.createRadialGradient(ex, ey, 0.5, ex, ey, 7);
  sp.addColorStop(0, 'rgba(212,236,255,0.95)'); sp.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 6.283); ctx.fill();
  ctx.restore();
}
