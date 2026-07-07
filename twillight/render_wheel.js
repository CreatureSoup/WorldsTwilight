'use strict';

// Рендер юнита-МОНОКОЛЕСА (hull kind:'wheel', UNIT_DEFS.gun «Канонир»). ВНЕШНЕЕ кольцо-ЗУБЬЯ = встроенный
// бур: ВРАЩАЕТСЯ (unit._wheelSpin — качение по ходу + раскрутка при бурении, спицы делают вращение видимым).
// ВНУТРЕННЯЯ втулка-реактор неподвижна; модули крепятся на втулку (ang°+rad, БЕЗ доворота к бурению — колесо
// всенаправленно). НОГ НЕТ. Турель на верху втулки — ПОВОРОТНАЯ (unit._turretAim из cannon.js), рисуется в
// экранных координатах (мировой aim не зависит от flip корпуса). Процедурно; хуки ассетов — задел (borer-стиль).
// ⚠️ перф (spec_render): без ctx.filter/shadowBlur; 'lighter' только на вспышке ствола.

// Качение колеса: смещение юнита по X → поворот на (Δpx / радиус). Бурение — доп. постоянная раскрутка.
// Зовётся из game.loop для kind:'wheel' (вместо updateRingAim). Ленивая инициализация полей на юните.
function updateWheelSpin(dt, unit) {
  if (unit._wheelSpin === undefined) { unit._wheelSpin = 0; unit._wheelPrevPx = unit.px; unit._wheelPrevPy = unit.py; }
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull]; if (!def) return;
  const R = (TILE - 8) / 2, scale = (typeof unitDrawScale === 'function') ? unitDrawScale(unit) : UNIT_DRAW_SCALE;
  const radiusPx = Math.max(6, (def.toothR || WHEEL_TOOTH_R) * R * scale);
  let dpx = (typeof wrapDeltaPx === 'function') ? wrapDeltaPx(unit.px, unit._wheelPrevPx) : (unit.px - unit._wheelPrevPx);
  let dpy = unit.py - (unit._wheelPrevPy != null ? unit._wheelPrevPy : unit.py);
  unit._wheelPrevPx = unit.px; unit._wheelPrevPy = unit.py;
  if (Math.abs(dpx) > TILE) dpx = 0; if (Math.abs(dpy) > TILE) dpy = 0;   // телепорт (респавн/склейка) — не катим колесо рывком
  // катится на ЛЮБОМ движении (гориз. И вертик.): величина = пройденный путь, знак = доминирующая ось (право/низ = +).
  const dist = Math.hypot(dpx, dpy), dir = (Math.abs(dpx) >= Math.abs(dpy)) ? Math.sign(dpx) : Math.sign(dpy);
  unit._wheelSpin += (dist / radiusPx) * WHEEL_SPIN_MOVE * dir;           // качение при ходьбе (замедлено множителем)
  if (unit.drilling) unit._wheelSpin += WHEEL_SPIN_DRILL * dt * (unit.faceX || 1);   // при бурении — заметно быстрее
  unit._wheelSpin %= (Math.PI * 2);
  if (unit._turretAim === undefined) unit._turretAim = (unit.faceX === -1 ? Math.PI : 0);   // ствол по взгляду (aim=0 = кадр редактора)
  if (unit._turretFlash > 0) unit._turretFlash = Math.max(0, unit._turretFlash - dt);
}

// Вертикальный сдвиг ОТРИСОВКИ колеса: НИЗ (кромка зубьев) садится на линию пола тайла + утапливается на WHEEL_GROUND_SINK
// (колесо «стоит» на грунте, не парит по центру тайла). Только визуал — физика юнита остаётся на unit.py (как лаг-корпус ног).
// ⚠️ ТОЛЬКО в игре (game.drawScene передаёт как opts.dy); на сборке колесо центрируется в панели (dy не передаётся).
function wheelGroundDy(unit) {
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull];
  if (!def || def.kind !== 'wheel') return 0;
  const R = (TILE - 8) / 2, scale = (typeof unitDrawScale === 'function') ? unitDrawScale(unit) : UNIT_DRAW_SCALE;
  const toothBottom = (def.toothR || WHEEL_TOOTH_R) * 1.07 * R * scale;   // нижняя кромка зубьев (экранные px от центра)
  return TILE * 0.5 - toothBottom + TILE * WHEEL_GROUND_SINK;            // низ колеса на полу + утоплен
}

// Внешнее кольцо-зубья (встроенный бур). Рисуется в ЛОКАЛЬНЫХ (design) координатах внутри общего scale-трансформа.
// Ассет `wheel:tooth` (ГЛОБАЛЬНЫЙ ключ, редактор) вращается с колесом; нет ассета → процедурная фреза.
function drawToothRing(ctx, radius, spin, drilling) {
  const sp = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES['wheel:tooth'];
  if (sp && sp.img) {
    ctx.save(); ctx.rotate(spin); if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180);
    ctx.drawImage(sp.img, -sp.px, -sp.py, sp.w, sp.h); ctx.restore(); return;
  }
  ctx.save();
  ctx.rotate(spin);
  // тёмная шина + светлое ребро
  ctx.lineCap = 'butt';
  ctx.strokeStyle = PAL.carbon; ctx.lineWidth = radius * 0.42;
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.82, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = PAL.ash; ctx.lineWidth = radius * 0.14;
  ctx.beginPath(); ctx.arc(0, 0, radius * 0.9, 0, 6.283); ctx.stroke();
  // зубья наружу (единый path, одна заливка — дёшево)
  const N = 16, rIn = radius * 0.86, rOut = radius * 1.07, hw = 0.052;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a = i / N * 6.283, a0 = a - hw, a1 = a + hw, a0b = a - hw * 0.45, a1b = a + hw * 0.45;
    ctx.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
    ctx.lineTo(Math.cos(a0b) * rOut, Math.sin(a0b) * rOut);
    ctx.lineTo(Math.cos(a1b) * rOut, Math.sin(a1b) * rOut);
    ctx.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    ctx.closePath();
  }
  ctx.fillStyle = drilling ? PAL.amber : PAL.bone; ctx.fill();
  // спицы к втулке — делают вращение ВИДИМЫМ
  ctx.strokeStyle = PAL.carbon; ctx.lineWidth = Math.max(1, radius * 0.05); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ctx.moveTo(Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5); ctx.lineTo(Math.cos(a) * radius * 0.78, Math.sin(a) * radius * 0.78); }
  ctx.stroke();
  ctx.restore();
}

// КОРПУС-КОЛЬЦО — основной каркас гондолы (отцентрован; внутри — реактор+модули, снаружи — зубья). Обычно СТАТИЧЕН;
// `spin` (рад) КОНТР-вращает ТОЛЬКО этот АССЕТ в IDLE (реактор/модули не трогает) — зубья катятся в одну сторону,
// внутреннее кольцо в другую. Ассет `wheel:body` (ГЛОБАЛЬНЫЙ ключ, редактор) → нет ассета → процедурный обод-каркас.
function drawWheelBody(ctx, bodyR, spin) {
  const sp = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES['wheel:body'];
  if (sp && sp.img) { ctx.save(); if (spin) ctx.rotate(spin); if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180); ctx.drawImage(sp.img, -sp.px, -sp.py, sp.w, sp.h); ctx.restore(); return; }
  ctx.save();
  if (spin) ctx.rotate(spin);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = PAL.carbon; ctx.lineWidth = bodyR * 0.32;
  ctx.beginPath(); ctx.arc(0, 0, bodyR, 0, 6.283); ctx.stroke();            // тёмный обод-каркас
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = bodyR * 0.1;
  ctx.beginPath(); ctx.arc(0, 0, bodyR * 1.06, 0, 6.283); ctx.stroke();     // ребро снаружи
  ctx.strokeStyle = PAL.pewter; ctx.lineWidth = bodyR * 0.07;
  ctx.beginPath(); ctx.arc(0, 0, bodyR * 0.92, 0, 6.283); ctx.stroke();     // ребро внутри
  ctx.fillStyle = PAL.ash;                                                  // болты-крепёж по кольцу
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; ctx.beginPath(); ctx.arc(Math.cos(a) * bodyR, Math.sin(a) * bodyR, Math.max(1, bodyR * 0.055), 0, 6.283); ctx.fill(); }
  ctx.restore();
}

// Турель на верху втулки. mx,my — ЭКРАННАЯ точка крепления; r — один design-R в экранных px; aim — МИРОВОЙ угол ствола.
// ⚠️ при взгляде ВЛЕВО турель ЗЕРКАЛИТСЯ (ctx.scale(-1,1), как корпус/колесо), а НЕ переворачивается на 180° (иначе купол вверх ногами).
// В зеркальном кадре ствол по мировому aim → локальный угол a = π−aim.
function drawWheelTurret(ctx, mx, my, r, aim, unit) {
  const flash = unit._turretFlash || 0;
  const flip = unit.faceX === -1;
  const a = flip ? (Math.PI - aim) : aim;
  const sp = (typeof spriteFor === 'function') && spriteFor('turret');           // деталь-турель блупринта (gun:turret), авторится в списке деталей
  ctx.save();
  ctx.translate(mx, my);
  if (flip) ctx.scale(-1, 1);                                                    // ЗЕРКАЛО (как корпус), не поворот
  if (sp && sp.img) {                                                            // авторский спрайт турели (ствол+купол по +X), редактор
    ctx.rotate(a); if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180);
    const k = r / ((TILE - 8) / 2);   // = масштаб юнита (rr/R): спрайт УЖИМАЕТСЯ с колесом (в игре drawScale<1 — иначе турель огромная; в редакторе/сборке scale=1 → k=1, без изменений)
    ctx.drawImage(sp.img, -sp.px * k, -sp.py * k, sp.w * k, sp.h * k);
    if (flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,175,90,' + Math.min(1, flash * 12) + ')'; ctx.beginPath(); ctx.arc((sp.w - sp.px) * k, 0, r * 0.42, 0, 6.283); ctx.fill(); }
    ctx.restore(); return;
  }
  ctx.rotate(a);
  ctx.fillStyle = PAL.carbon; ctx.fillRect(0, -r * 0.19, r * 1.7, r * 0.38);      // ствол-кожух
  ctx.fillStyle = '#6a5248'; ctx.fillRect(0, -r * 0.1, r * 1.7, r * 0.2);         // жерло
  if (flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,175,90,' + Math.min(1, flash * 12) + ')';
    ctx.beginPath(); ctx.arc(r * 1.75, 0, r * 0.42, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.rotate(-a);
  ctx.fillStyle = PAL.ash; ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, 6.283); ctx.fill();   // купол
  ctx.strokeStyle = PAL.carbon; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
  ctx.fillStyle = '#e0603a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, 6.283); ctx.fill();  // акцент-глаз канонира
  ctx.restore();
}

// dx/dy — сдвиг корпуса (у колеса всегда 0 — нет ног), scale — масштаб юнита (UNIT_DRAW_SCALE у gun ужат).
function drawWheelUnit(ctx, world, unit, camera, opts) {
  opts = opts || {};
  const def = (typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[unit.hull]) || null;
  if (!def || def.kind !== 'wheel') return;
  if (typeof partsHull === 'function') partsHull(unit.hull);
  const t = performance.now() / 1000;
  const scale = opts.scale || 1;
  const R = (TILE - 8) / 2;
  const flip = unit.faceX === -1 ? -1 : 1;
  // IDLE-покачивание: стоя на месте колесо тихонько катается вперёд-назад (в игре — при простое; в редакторе/сборке — всегда).
  // Зубья докручиваются СИНХРОННО (idleX/радиус = честное качение), на пиках синуса скорость→0 (колесо замирает).
  const idleR = Math.max(6, (def.toothR || WHEEL_TOOTH_R) * R * scale);
  const _IDLE = (typeof IDLE !== 'undefined') ? IDLE : 0;
  const idleActive = (unit.state === undefined || unit.state === _IDLE) && !unit.drilling;
  const idleX = idleActive ? Math.sin(t * WHEEL_IDLE_FREQ) * WHEEL_IDLE_AMP * scale : 0;
  const idleSpin = idleX / idleR;
  const cx = camera.screenX(unit.px) + (opts.dx || 0) + idleX, cy = unit.py - camera.y + (opts.dy || 0);

  const smOn = ctx.imageSmoothingEnabled, smQ = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  // ЕДИНАЯ z-сортировка: кольцо-зубья (`toothZ`) + корпус-кольцо (`bodyZ`) + реактор/модули (их `z`) + ТУРЕЛЬ (её `z`) →
  // перекрытие ЛЮБЫХ слоёв настраивается z в блупринте (напр. bodyZ>20 — корпус поверх модулей; turret z<10 — под реактором).
  const toothR = (def.toothR || WHEEL_TOOTH_R) * R;
  const layers = [
    { z: (def.toothZ != null ? def.toothZ : 0), tooth: true },
    { z: (def.bodyZ != null ? def.bodyZ : 6), body: true },
  ];
  for (const p of def.parts) {
    if (p.kind === 'leg' || p.kind === 'turret') continue;
    if (p.kind !== 'reactor' && !unitHasPart(unit, p.need)) continue;
    layers.push({ z: p.z || 0, part: p });
  }
  layers.sort((a, b) => (a.z || 0) - (b.z || 0));

  // Турель — в ЭКРАННЫХ координатах (aim мировой, не зеркалится flip'ом), но её `z` определяет, ПОСЛЕ какого слоя рисовать.
  const turretPart = def.parts.find((p) => p.kind === 'turret');
  const hasTurret = !!(turretPart && unitHasPart(unit, 'turret'));
  const turretZ = hasTurret ? (turretPart.z || 0) : Infinity;

  // Колесо/втулка/модули — в ЛОКАЛЬНОМ scale/flip-трансформе; турель — отдельным экранным проходом на её z.
  const drawWheelLayers = (list) => {
    if (!list.length) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    if (flip === -1) ctx.scale(-1, 1);
    for (const L of list) {
      if (L.tooth) { drawToothRing(ctx, toothR, ((unit._wheelSpin || 0) + idleSpin) * flip, unit.drilling); continue; }   // кольцо-зубья: качение (ход) + IDLE-докрут
      if (L.body)  { drawWheelBody(ctx, toothR * 0.66, -idleSpin * flip * WHEEL_IDLE_COUNTER); continue; }   // внутреннее кольцо: КОНТР-вращение к idle-докруту зубьев (только АССЕТ; вне idle idleSpin=0 → статично)
      const p = L.part;
      if (p.kind === 'reactor') { drawRingCore(ctx, 0, 0, def.ringR * R, t, def, unit.reactorOn !== false); continue; }   // втулка, не вращается
      const a = (p.ang || 0) * Math.PI / 180;                            // aim=0: модули фиксированы на втулке
      const dist = (p.rad || 0) * R;
      const px = Math.cos(a) * dist, py = Math.sin(a) * dist + (p.kind === 'engine' ? Math.sin(t * ENGINE_VIB_FREQ) * ENGINE_VIB_AMP : 0);   // двигатель ДРОЖИТ вверх-вниз (вибрация)
      const sid = (typeof partSpriteId === 'function') ? partSpriteId(unit, p.id) : p.id;
      drawPart(ctx, p.kind, px, py, R * 1.05, a, false, t, sid === p.id ? p : Object.assign({}, p, { id: sid }));
    }
    ctx.restore();
  };

  drawWheelLayers(layers.filter((L) => (L.z || 0) <= turretZ));         // слои ПОД турелью (по её z)
  if (hasTurret) {
    const rr = R * scale, ta = (turretPart.ang || -90) * Math.PI / 180;
    const mx = cx + Math.cos(ta) * (turretPart.rad || 0.5) * rr * flip, my = cy + Math.sin(ta) * (turretPart.rad || 0.5) * rr;
    drawWheelTurret(ctx, mx, my, rr, (unit._turretAim !== undefined ? unit._turretAim : (unit.faceX === -1 ? Math.PI : 0)), unit);
  }
  drawWheelLayers(layers.filter((L) => (L.z || 0) > turretZ));          // слои ПОВЕРХ турели

  ctx.imageSmoothingEnabled = smOn; ctx.imageSmoothingQuality = smQ;
}

// Трассеры авто-турели канонира (cannon.js `_unitTurretTracers`): короткие тёплые лучи выстрела юнит→враг.
function drawUnitTurretFx(ctx, game, camera) {
  const tr = game._unitTurretTracers; if (!tr || !tr.length) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const t of tr) {
    const a = Math.max(0, 1 - t.life / STRUCT_TRACER_TTL);
    ctx.globalAlpha = a * 0.9; ctx.strokeStyle = '#ffb46a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(camera.screenX(t.x1), t.y1 - camera.y); ctx.lineTo(camera.screenX(t.x2), t.y2 - camera.y); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

// ЭКРАННАЯ позиция модуля колеса (для лучей сканера и т.п.) — как в drawWheelUnit, aim=0 + flip по faceX.
function wheelModuleScreenPos(unit, camera, kind, bo) {
  bo = bo || { x: 0, y: 0 };
  const cx = camera.screenX(unit.px) + bo.x, cy = unit.py - camera.y + bo.y;
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull];
  if (!def || def.kind !== 'wheel') return { x: cx, y: cy };
  const p = def.parts.find((pp) => pp.kind === kind); if (!p) return { x: cx, y: cy };
  const scale = (typeof unitDrawScale === 'function') ? unitDrawScale(unit) : UNIT_DRAW_SCALE, R = (TILE - 8) / 2;
  const a = (p.ang || 0) * Math.PI / 180, flip = unit.faceX === -1 ? -1 : 1;
  return { x: cx + flip * Math.cos(a) * (p.rad || 0) * R * scale, y: cy + Math.sin(a) * (p.rad || 0) * R * scale };
}
