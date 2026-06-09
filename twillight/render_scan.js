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
// апекс конуса/лучей — РОВНО модуль сканера. В блупринте кольца его kind — 'sensor'
// (а 'scanner' — лишь флаг-стат need), поэтому ищем 'sensor', иначе src падал в центр юнита.
function _scanSrc(game, camera) {
  const bo = (typeof tentacleBodyOffset === 'function' && game.debugTentacles) ? tentacleBodyOffset() : { x: 0, y: 0 };
  return (typeof ringModuleScreenPos === 'function')
    ? ringModuleScreenPos(game.unit, camera, 'sensor', bo)
    : { x: camera.screenX(game.unit.px) + bo.x, y: game.unit.py - camera.y + bo.y };
}

// Конус + трассирующие лучи + пятно контакта ОТ модуля сканера (src) к цели (tx,ty), r — полугабарит.
// Общий для скана серверов и пещер-сцен (привязка к ассету). Рисуется ПОСЛЕ юнита.
function drawScanBeam(ctx, src, tx, ty, t, r) {
  r = r || 14;
  const dx = tx - src.x, dy = ty - src.y, dist = Math.hypot(dx, dy) || 1, baseAng = Math.atan2(dy, dx);
  const half = Math.min(0.7, Math.atan2(r, dist) * 1.25), reach = dist + r, aMin = baseAng - half, aMax = baseAng + half;
  const ray = (ang, dim, w) => { ctx.strokeStyle = dim; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(src.x + Math.cos(ang) * reach, src.y + Math.sin(ang) * reach); ctx.stroke(); };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.moveTo(src.x, src.y); ctx.lineTo(src.x + Math.cos(aMin) * reach, src.y + Math.sin(aMin) * reach); ctx.arc(src.x, src.y, reach, aMin, aMax); ctx.closePath();
  const cone = ctx.createRadialGradient(src.x, src.y, 2, src.x, src.y, reach);
  cone.addColorStop(0, 'rgba(95,165,238,0.16)'); cone.addColorStop(0.65, 'rgba(80,150,228,0.13)'); cone.addColorStop(1, 'rgba(70,140,220,0)');
  ctx.fillStyle = cone; ctx.fill();
  for (let k = -1; k <= 1.001; k += 0.5) ray(baseAng + k * half * 0.9, 'rgba(120,180,240,0.09)', 1);
  const ang = baseAng + Math.sin(t * 2.0) * half;
  ray(ang, 'rgba(120,185,255,0.30)', 4);
  ray(ang, `rgba(175,218,255,${0.6 + 0.25 * (0.5 + 0.5 * Math.sin(t * 11))})`, 1.6);
  ray(baseAng + Math.sin(t * 2.0 + 2.1) * half * 0.85, 'rgba(150,200,255,0.20)', 1.2);
  const ex = src.x + Math.cos(ang) * dist, ey = src.y + Math.sin(ang) * dist;
  const sp = ctx.createRadialGradient(ex, ey, 0.5, ex, ey, 7);
  sp.addColorStop(0, 'rgba(212,236,255,0.95)'); sp.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(ex, ey, 7, 0, 6.283); ctx.fill();
  ctx.restore();
}

// Лучи сканера к серверу-хламу, пока game.activeScan активен. Рисуется ПОСЛЕ юнита (поверх).
function drawScanFx(ctx, game, camera) {
  const s = game.activeScan; if (!s || !game.unit) return;
  const t = performance.now() / 1000;
  const tx = camera.screenX((s.tx + 0.5) * TILE), ty = (s.ty + 0.5) * TILE - camera.y;
  const src = _scanSrc(game, camera);
  // подсветка объекта (хлам «горит» под лучом)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pul = 0.5 + 0.5 * Math.sin(t * 4.5);
  const og = ctx.createRadialGradient(tx, ty, 1, tx, ty, 15);
  og.addColorStop(0, `rgba(95,170,240,${0.30 + 0.18 * pul})`); og.addColorStop(1, 'rgba(95,170,240,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(tx, ty, 15, 0, 6.283); ctx.fill();
  ctx.fillStyle = `rgba(120,190,250,${0.22 + 0.12 * pul})`;
  ctx.beginPath(); ctx.moveTo(tx - 10, ty + 6); ctx.lineTo(tx - 4, ty - 4); ctx.lineTo(tx + 3, ty - 2); ctx.lineTo(tx + 10, ty + 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  drawScanBeam(ctx, src, tx, ty, t, 14);
}

// Лучи сканера к сканируемому ВРАГУ (game.scanEnemy), пока он в радиусе. Подсветка цели + общий конус.
function drawEnemyScanFx(ctx, game, camera) {
  const e = game.scanEnemy; if (!e || !game.unit) return;
  const t = performance.now() / 1000;
  const tx = camera.screenX((e.tileX + 0.5) * TILE), ty = (e.tileY + 0.5) * TILE - camera.y;
  const src = _scanSrc(game, camera);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const pul = 0.5 + 0.5 * Math.sin(t * 4.5);
  const og = ctx.createRadialGradient(tx, ty, 1, tx, ty, 14);
  og.addColorStop(0, `rgba(95,170,240,${0.26 + 0.16 * pul})`); og.addColorStop(1, 'rgba(95,170,240,0)');
  ctx.fillStyle = og; ctx.beginPath(); ctx.arc(tx, ty, 14, 0, 6.283); ctx.fill();
  ctx.restore();
  drawScanBeam(ctx, src, tx, ty, t, 12);
}

// Луч сканера к ОБЪЕКТУ пещеры-сцены, пока идёт объёмный скан (`b.scanning`). Привязка к ассету:
// целимся в верх-центр объекта, полугабарит ∝ размеру пещеры. Рисуется ПОСЛЕ юнита.
function drawBackdropScan(ctx, game, camera) {
  const w = game.world; if (!w || !w.backdrops || !game.unit) return;
  let b = null; for (const x of w.backdrops) if (x.scanning) { b = x; break; }
  if (!b) return;
  const t = performance.now() / 1000, src = _scanSrc(game, camera);
  // целимся в РЕАЛЬНЫЙ центр ассета (стэшится render_backdrop._bdDrawRobot); фолбэк — центр полости
  const tx = (b._astX != null) ? b._astX : camera.screenX((b.cx + 0.5) * TILE);
  const ty = (b._astY != null) ? b._astY : ((b.cy + 0.5) * TILE - camera.y);
  const r = (b._astR != null) ? b._astR : Math.min(52, b.rx * TILE * 0.5);
  drawScanBeam(ctx, src, tx, ty, t, r);
}
