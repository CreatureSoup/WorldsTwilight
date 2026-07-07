'use strict';

// Рендер юнита из РИГА. Юнит всегда собирается в НЕЙТРАЛЬНОЙ горизонтальной позе
// (масса + ноги — единый авторский силуэт), а при лазании по стене ЖЁСТКО
// поворачивается на ±90° целиком — так масса и ноги не «расходятся» (нет бага со
// сдвигом ног в корпус), а ноги ложатся к СУЩЕСТВУЮЩЕЙ стенке, бур — по ходу.
function drawTachikoma(ctx, world, unit, camera, opts) {
  opts = opts || {};
  if (typeof partsHull === 'function') partsHull(unit.hull);   // спрайты по типу корпуса

  const cx = Math.round(camera.screenX(unit.px) + (opts.dx || 0)), cy = Math.round(unit.py - camera.y + (opts.dy || 0));  // dx/dy — сдвиг (опора на щупальца, прототип)
  const t = performance.now() / 1000;

  // Опора + ориентация для лазания.
  const sup = (world && opts.scale) ? supportDirOf(world, unit) : 'down';
  const climbing = sup !== 'down';
  let face = unit.faceX === -1 ? -1 : 1, theta = 0;
  if (climbing) {
    const wallRight = sup === 'right';
    const up = unit.dy <= 0;                                  // ход вверх (или стоит) → бур вверх
    face = (wallRight ? 1 : -1) * (up ? 1 : -1);              // нейтральный взгляд для поворота
    theta = -face * Math.PI / 2;                             // целиком повернуть ±90° (ноги → стена)
  }

  // Рендерим риг в НЕЙТРАЛЬНОЙ горизонтали (dy=0) — поворот делаем внешним transform.
  const ru = { hull: unit.hull, dx: face, dy: 0, faceX: face, state: unit.state, crouchT: unit.crouchT, noAnim: unit.noAnim, noBob: !!opts.hideLegs, drilling: unit.drilling, stats: unit.stats };
  const rig = resolveUnitRig(cx, cy, ru, t, 'down');

  // Сильный даунскейл (≈16×): качественный сэмплинг гасит мерцание.
  const smOn = ctx.imageSmoothingEnabled, smQ = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  const scaled = opts.scale && opts.scale !== 1;
  if (scaled) {
    ctx.save();
    if (!climbing) {
      // на полу: стопы → пол тайла (якорь из СТАТИЧНОГО рига — без покадровой дрожи)
      const stat = resolveUnitRig(cx, cy, { hull: unit.hull, dx: face, dy: 0, faceX: face, state: IDLE, crouchT: 0, noAnim: true, stats: unit.stats }, t, 'down');
      let footY = cy;
      for (const leg of stat.legs) for (const sg of leg.segs) footY = Math.max(footY, sg.jy, sg.ly);
      const shift = Math.round((cy + TILE * 0.5 - TILE * 0.28) - footY);
      ctx.translate(0, shift);
      ctx.translate(cx, footY); ctx.scale(opts.scale, opts.scale); ctx.translate(-cx, -footY);
    } else {
      // на стене: придвигаем корпус К стене (ноги касаются её) + жёсткий поворот
      const off = Math.round((sup === 'right' ? 1 : -1) * TILE * 0.16);
      ctx.translate(off, 0);
      ctx.translate(cx, cy); ctx.rotate(theta); ctx.scale(opts.scale, opts.scale); ctx.translate(-cx, -cy);
    }
  }

  // 1) кабели — задний слой
  for (const c of rig.cables) drawCable(ctx, c.ax, c.ay, c.bx, c.by, c.type, t);
  // 2) детали и ноги — единый порядок по z
  const items = [];
  for (const leg of rig.legs) items.push({ z: leg.z, leg });
  for (const p of rig.parts) items.push({ z: p.z, part: p });
  items.sort((a, b) => a.z - b.z);
  const crouch = unit.crouchT > 0;
  for (const it of items) {
    if (it.leg) { if (!opts.hideLegs) drawLeg(ctx, it.leg, rig.R); continue; }   // hideLegs — прототип щупалец (tentacles.js)
    const p = it.part;
    if (p.kind === 'drill' && unit.stats && unit.stats.screw) continue;   // ВИНТОВОЙ бур: вид — ЩИТ (drawCarriedBorer/drawMountedBorer), не деталь-бур
    ctx.save();
    if (crouch) { ctx.translate(rig.legHub.x, rig.legHub.y); ctx.scale(1, 0.7); ctx.translate(-rig.legHub.x, -rig.legHub.y); }
    const sid = (typeof partSpriteId === 'function') ? partSpriteId(unit, p.id) : p.id;   // спрайт варианта модуля, если задан
    drawPart(ctx, p.kind, p.x, p.y, p.scale, p.angle, p.flip, t, sid === p.id ? p : Object.assign({}, p, { id: sid }));
    ctx.restore();
  }
  if (scaled) ctx.restore();
  ctx.imageSmoothingEnabled = smOn; ctx.imageSmoothingQuality = smQ;
}

// Экранная позиция «прожектора» — узел РЕАКТОРА, проведённый через ТОТ ЖЕ трансформ,
// что и `drawTachikoma` (масштаб/якорь стоп/поворот при лазании + idle-bob). Поэтому
// конус света двигается синхронно с дышащим юнитом. Возвращает вершину `ax,ay` (чуть
// впереди по ходу) и направление луча `fx,fy`.
function unitLightAnchor(world, unit, camera) {
  // конус сидит на корпусе → следует за тем же лаг-офсетом тела, что и спрайт (drawTachikoma opts.dx),
  // иначе при ходьбе на щупальцах прожектор «уезжает» вперёд от отстающего корпуса.
  const bo = (typeof tentacleBodyOffset === 'function' && typeof game !== 'undefined' && game && game.debugTentacles) ? tentacleBodyOffset() : null;
  const cx = Math.round(camera.screenX(unit.px) + (bo ? bo.x : 0)), cy = Math.round(unit.py - camera.y + (bo ? bo.y : 0));
  const t = performance.now() / 1000;
  // ЮНИТ-КОЛЬЦО: конус от бура (на кольце), направление = угол кластера (куда бурим). FK-риг тут не
  // применим (модули заданы ang/rad, не f/s) — отдельная ветка.
  const rdef = typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[unit.hull];
  if (rdef && rdef.kind === 'ring') {
    const aim = unit._ringAim || 0, flip = unit._ringFlip ? -1 : 1, R = (TILE - 8) / 2 * unitDrawScale(unit);
    const drill = rdef.parts.find((p) => p.kind === 'drill'), dist = (drill ? drill.rad : rdef.ringR + 0.6) * R;
    const dAng = (drill ? (drill.ang || 0) * Math.PI / 180 : 0) + aim;   // реальное направление бура (его угол крепления + доворот)
    const fx = flip * Math.cos(dAng), fy = Math.sin(dAng);              // flip — зеркало X (строго налево)
    return { ax: cx + fx * dist, ay: cy + fy * dist, fx, fy };
  }
  if (rdef && rdef.kind === 'wheel') {
    // МОНО-КОЛЕСО: ног нет (bo не применим) — конус от центра колеса по направлению хода/бурения (бур всенаправленный).
    const wx = Math.round(camera.screenX(unit.px)), wy = Math.round(unit.py - camera.y + (typeof wheelGroundDy === 'function' ? wheelGroundDy(unit) : 0));
    const flip = unit.faceX === -1 ? -1 : 1;
    let fx = flip, fy = 0;
    if (unit.dy < 0) { fx = 0; fy = -1; } else if (unit.dy > 0) { fx = 0; fy = 1; }
    const R = (TILE - 8) / 2 * unitDrawScale(unit), dist = (rdef.toothR || WHEEL_TOOTH_R) * R;
    return { ax: wx + fx * dist, ay: wy + fy * dist, fx, fy };
  }
  const sup = supportDirOf(world, unit), climbing = sup !== 'down';
  let face = unit.faceX === -1 ? -1 : 1, theta = 0;
  if (climbing) { const wr = sup === 'right', up = unit.dy <= 0; face = (wr ? 1 : -1) * (up ? 1 : -1); theta = -face * Math.PI / 2; }
  const ru = { hull: unit.hull, dx: face, dy: 0, faceX: face, state: unit.state, crouchT: unit.crouchT, noAnim: unit.noAnim, noBob: !!bo, drilling: unit.drilling, stats: unit.stats };
  const rig = resolveUnitRig(cx, cy, ru, t, 'down');
  const node = rig.parts.find((p) => p.kind === 'reactor') || rig.parts.find((p) => p.kind === 'drill') || { x: cx, y: cy };
  let nx = node.x, ny = node.y;
  const k = unitDrawScale(unit);
  if (!climbing) {
    const stat = resolveUnitRig(cx, cy, { hull: unit.hull, dx: face, dy: 0, faceX: face, state: IDLE, crouchT: 0, noAnim: true, stats: unit.stats }, t, 'down');
    let footY = cy; for (const leg of stat.legs) for (const sg of leg.segs) footY = Math.max(footY, sg.jy, sg.ly);
    const shift = Math.round((cy + TILE * 0.5 - TILE * 0.28) - footY);
    nx = cx + (nx - cx) * k; ny = footY + (ny - footY) * k + shift;
  } else {
    const off = Math.round((sup === 'right' ? 1 : -1) * TILE * 0.16);
    const x = (nx - cx) * k, y = (ny - cy) * k, c = Math.cos(theta), s = Math.sin(theta);
    nx = cx + (x * c - y * s) + off; ny = cy + (x * s + y * c);
  }
  const fx = climbing ? 0 : face, fy = climbing ? (unit.dy <= 0 ? -1 : 1) : 0;
  return { ax: nx + fx * TILE * 0.18, ay: ny + fy * TILE * 0.18, fx, fy };
}
