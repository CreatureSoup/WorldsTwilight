'use strict';

// Рендер юнита-кольца (hull с `kind:'ring'`, см. UNIT_DEFS.core). Центр — ТОР-РЕАКТОР. Модули
// крепятся СНАРУЖИ по окружности (ang°+rad), ориентированы НАРУЖУ. Кластер модулей ВРАЩАЕТСЯ к
// направлению бурения (`_ringAim`), сохраняя расстановку → бур смотрит в сторону копания. НОГИ
// (щупальца) НЕ вращаются и рисуются ОТДЕЛЬНО в game.drawScene — ПОД кольцом/модулями.
// Детали — процедуры из render_parts.drawPart (канонический кадр forward=+X → радиально наружу).

// Ориентация кластера хранится НА ЮНИТЕ: `unit._ringAim` (угол ПЛАВНОГО доворота, только ВЕРТИКАЛЬ
// ±90°: вверх/вниз) + `unit._ringFlip` (МГНОВЕННОЕ зеркало для «строго налево» — как у 2D-спрайта).
// Их читают и рендер модулей (drawRingUnit), и прожектор (unitLightAnchor).
//
// Налево НЕ вращаем на 180° (тогда верхние модули уходят вниз, их прячут ноги) — а ЗЕРКАЛИМ вид.
// Поэтому горизонт = aim 0 + flip по `faceX`; вертикаль = доворот ±90° (бур к копаемому тайлу).
// Вертикаль берётся из `unit.dy` (а НЕ из `drilling`) → направление СОХРАНЯЕТСЯ после бурения
// вверх/вниз (не сбрасывается в idle-горизонталь).
function _ringTarget(unit) {
  const aim = unit.dy < 0 ? -Math.PI / 2 : unit.dy > 0 ? Math.PI / 2 : 0;   // вверх/вниз/горизонт
  return { aim, flip: unit.faceX === -1 };
}
function updateRingAim(dt, unit) {
  const tgt = _ringTarget(unit);   // `unit._ringAim` инициализируется в конструкторе Unit (старт = 0, горизонт)
  let d = ((tgt.aim - unit._ringAim + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
  unit._ringAim += d * Math.min(1, dt * 9);   // плавный доворот к вертикали (горизонт ↔ вверх/вниз)
  unit._ringFlip = tgt.flip;                  // зеркало — МГНОВЕННО (флип взгляда, не анимируется)
}

// Центр-кольцо: спрайт реактора (если загружен и спрайты активны) ИЛИ процедурный тор. НЕ вращается.
// ДВА ассета: ВКЛ (`reactor`) по умолчанию и ВЫКЛ (`reactor:off`) — `on=false` рисует выключенный.
function drawRingCore(ctx, cx, cy, r, t, def, on) {
  const center = def.parts.find((p) => p.kind === 'reactor'); if (!center) { drawReactorRing(ctx, cx, cy, r, t, on); return; }
  const offKey = center.id + ':off';
  // выкл: отдельный ассет `reactor:off`, если есть; иначе вкл-ассет/процедура ПРИГЛУШЕННО.
  if (on === false && typeof spriteFor === 'function' && spriteFor(offKey)) {
    const so = spriteFor(offKey); if (so && so.img) { drawPart(ctx, 'reactor', cx, cy, r, 0, false, t, { id: offKey, proc: center.proc }); return; }
  }
  const sp = typeof spriteFor === 'function' && spriteFor(center.id);
  if (sp && sp.img) {
    if (on === false) ctx.save(), (ctx.globalAlpha *= 0.4);   // нет выкл-ассета → гасим вкл-спрайт
    drawPart(ctx, 'reactor', cx, cy, r, 0, false, t, { id: center.id, proc: center.proc });
    if (on === false) ctx.restore();
    return;
  }
  drawReactorRing(ctx, cx, cy, r, t, on);
}
function drawReactorRing(ctx, cx, cy, r, t, on) {
  const pulse = on === false ? 0 : (typeof ANIM !== 'undefined') ? ANIM.reactorPulse(t) : 0.5;
  const band = r * 0.5;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = band; ctx.strokeStyle = PAL.carbon;                 // тёмный корпус тора
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
  ctx.lineWidth = band * 0.66; ctx.strokeStyle = PAL.bronze;          // ребро
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
  // болты по кольцу
  ctx.fillStyle = PAL.ash;
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.max(1, r * 0.07), 0, 6.283); ctx.fill(); }
  // ядро в дыре тора (свечение); выкл — почти потухшее
  const ir = r - band * 0.5, lit = on === false ? 0.12 : 1;
  const gr = ctx.createRadialGradient(cx, cy, 1, cx, cy, ir);
  gr.addColorStop(0, `rgba(150,255,190,${(0.6 + 0.35 * pulse) * lit})`);
  gr.addColorStop(0.55, `rgba(58,209,122,${(0.3 + 0.25 * pulse) * lit})`);
  gr.addColorStop(1, 'rgba(20,60,40,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, ir, 0, 6.283); ctx.fill();
  ctx.restore();
}

// dx/dy — сдвиг (опора на щупальца), scale — масштаб юнита (UNIT_DRAW_SCALE).
function drawRingUnit(ctx, world, unit, camera, opts) {
  opts = opts || {};
  const def = (typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[unit.hull]) || null;
  if (!def || def.kind !== 'ring') return;
  if (typeof partsHull === 'function') partsHull(unit.hull);   // спрайты по типу корпуса
  const t = performance.now() / 1000;
  // БЕЗ Math.round: округление квантовало idle-«дыхание» по пикселям (а в инвентаре ещё ×внешний scale)
  // → реактор/модули дёргались ступеньками. imageSmoothing='high' сглаживает суб-пиксель.
  const cx = camera.screenX(unit.px) + (opts.dx || 0), cy = unit.py - camera.y + (opts.dy || 0);
  const scale = opts.scale || 1;
  const R = (TILE - 8) / 2;   // R в ДИЗАЙН-px (как в редакторе); масштаб юнита — общий transform ниже

  const smOn = ctx.imageSmoothingEnabled, smQ = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

  // Масштаб юнита — ОДИН transform на всё кольцо (позиции И размеры спрайтов ужимаются вместе, как
  // ctx.scale(zoom) в редакторе). Иначе спрайты (drawPart рисует sp.w в px, игнорируя S) выходили
  // в 1/UNIT_DRAW_SCALE раз крупнее относительно кольца, чем в редакторе.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Строго налево → ЗЕРКАЛО всего кластера (а не вращение на 180°): верхние модули остаются сверху.
  if (unit._ringFlip) ctx.scale(-1, 1);

  // реактор-кольцо + модули — ЕДИНЫЙ порядок по z (ноги рисуются ОТДЕЛЬНО, ПОД — в game.drawScene).
  const aim = unit._ringAim || 0;
  const items = def.parts.filter((p) => p.kind !== 'leg' && (p.kind === 'reactor' || unitHasPart(unit, p.need)));
  items.sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const p of items) {
    if (p.kind === 'reactor') { drawRingCore(ctx, 0, 0, def.ringR * R, t, def, unit.reactorOn !== false); continue; }   // центр, не вращается
    if (p.kind === 'drill' && unit.stats && unit.stats.screw) continue;   // ВИНТОВОЙ бур: его вид — ЩИТ (drawCarriedBorer в игре / drawMountedBorer на сборке), а НЕ деталь-бур; иначе дублировался бы дженерик-бур
    const a = (p.ang || 0) * Math.PI / 180 + aim;
    let dist = (p.rad || 0) * R;
    if (p.kind === 'drill') dist += ANIM.drillWob(t, unit);   // «долбёжка»: бур ходит вдоль оси крепления к породе
    const px = Math.cos(a) * dist, py = Math.sin(a) * dist;
    const sid = (typeof partSpriteId === 'function') ? partSpriteId(unit, p.id) : p.id;   // спрайт КОНКРЕТНОГО варианта модуля, если задан
    drawPart(ctx, p.kind, px, py, R * 1.25, a, false, t, sid === p.id ? p : Object.assign({}, p, { id: sid }));   // angle=наружу → деталь смотрит от центра
  }

  ctx.restore();
  ctx.imageSmoothingEnabled = smOn; ctx.imageSmoothingQuality = smQ;
}

// ЭКРАННАЯ позиция модуля кольца (kind: 'scanner'/'drill'/…) — той же раскладкой, что drawRingUnit
// (translate cx,cy → scale → flip → модуль на cos/sin(ang+aim)·rad·R). Для лучей сканера и т.п.
// Не-кольцо или нет модуля → центр юнита. `bo` — сдвиг корпуса на щупальцах (как opts.dx/dy).
function ringModuleScreenPos(unit, camera, kind, bo) {
  bo = bo || { x: 0, y: 0 };
  const cx = camera.screenX(unit.px) + bo.x, cy = unit.py - camera.y + bo.y;
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull];
  if (!def || def.kind !== 'ring') return { x: cx, y: cy };
  const p = def.parts.find((pp) => pp.kind === kind); if (!p) return { x: cx, y: cy };
  const scale = (typeof unitDrawScale === 'function') ? unitDrawScale(unit) : 0.62, R = (TILE - 8) / 2;
  const a = (p.ang || 0) * Math.PI / 180 + (unit._ringAim || 0), flip = unit._ringFlip ? -1 : 1;
  return { x: cx + flip * Math.cos(a) * (p.rad || 0) * R * scale, y: cy + Math.sin(a) * (p.rad || 0) * R * scale };
}
