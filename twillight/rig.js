'use strict';

// Сборка юнита: блупринт (UNIT_DEFS) + аниматор (ANIM) → размещённые детали в
// ЭКРАННЫХ координатах. Чистая геометрия (без Canvas/камеры): на входе центр (cx,cy)
// в экранных px. Возвращает детали (по z), кабели (концы привязаны к узлам) и узел
// ног. Деталь без выполненного `need` пропускается — отсоединённый модуль исчезает.

// Опора, к которой «стоит» юнит: пол снизу → 'down'; иначе существующая боковая
// стенка ('left'/'right'); в 1-широкой шахте — сторона по взгляду. Общий помощник
// для рендера юнита и прожектора.
function supportDirOf(world, unit) {
  if (!world) return 'down';
  if (isSolid(world.tileAt(unit.tileX, unit.tileY + 1))) return 'down';
  const left = isSolid(world.tileAt(unit.tileX - 1, unit.tileY));
  const right = isSolid(world.tileAt(unit.tileX + 1, unit.tileY));
  if (right && !left) return 'right';
  if (left && !right) return 'left';
  if (left && right) return (unit.faceX < 0 ? 'left' : 'right');
  return 'down';
}

function unitHasPart(unit, need) {
  if (!need) return true;
  const s = unit.stats || {};
  if (need === 'dig')     return !!s.canDig;        // есть бур
  if (need === 'engine')  return !!s.canMove;       // есть двигатель
  if (need === 'scanner') return (s.scanR || 0) > 0;
  if (need === 'cargo')   return (s.capacity || 0) > 0;
  if (need === 'aux')     return s.auxOn !== undefined ? !!s.auxOn : ((s.noiseResist || 0) > 0 || (s.printer || 0) > 0);   // доп-слот: деталь видна при ЛЮБОМ занятом aux-модуле (auxOn из getStats; фолбэк — старая пара флагов)
  if (need === 'aux2')    return !!s.aux2On;        // ВТОРОЙ доп-слот «Спрута» (слот aux2, флаг из getStats)
  if (need === 'turret')  return !!s.turret;        // авто-турель канонира (слот turret)
  return true;
}

function resolveUnitRig(cx, cy, unit, t, supportDir) {
  const def = UNIT_DEFS[unit.hull] || UNIT_DEFS.scout;
  const R = (TILE - 8) / 2;
  supportDir = supportDir || 'down';   // куда смотрят НОГИ (к опоре): down|left|right
  // Вся МАССА раскладывается вдоль оси взгляда: трюм (f<0) сзади → бур (f>0) впереди.
  // Лево/право — горизонталь с ЗЕРКАЛОМ; вверх/вниз — вертикальный стек. Боксы остаются
  // «апрайт» (флип L/R по `faceX`), а бур и сенсор смотрят ПО ХОДУ (dang).
  const bfx = (unit.faceX === -1 ? -1 : 1);     // последний гориз. взгляд (зеркало боксов)
  // взгляд (кардинальный). Фолбэк на горизонталь — ТОЛЬКО когда взгляда нет вовсе
  // (обе нулевые); иначе при «вверх» (dx=0) `||` дал бы диагональ.
  let dfx = unit.dx, dfy = unit.dy;
  if (dfx === 0 && dfy === 0) dfx = bfx;
  // Лево = ЗЕРКАЛО (flip), вверх/вниз = ПОВОРОТ ±90°. Базис позиции массы выводим из
  // (flip, fwdAngle) — тогда при зеркале «низ» (s) ОСТАЁТСЯ внизу (а не уезжает вверх).
  const horiz = dfy === 0;
  const flip = horiz && dfx < 0;
  const fwdAngle = horiz ? 0 : (dfy < 0 ? -Math.PI / 2 : Math.PI / 2);
  const sx = flip ? -1 : 1, ca = Math.cos(fwdAngle), sa = Math.sin(fwdAngle);
  const bob = ANIM.bob(t, unit, def);
  const moving = unit.state === MOVING;

  const node = {};
  node.legHub = { x: cx + def.legHub.f * R * bfx, y: cy + def.legHub.dropY * R };  // пивот приседа

  const parts = [], legs = [];
  // Базис НОГ независим от массы: ноги смотрят к ОПОРЕ (`supportDir`), а не по ходу.
  // LD — экранное направление «низа» ноги (к опоре); LF — продольная ось (перед/зад),
  // вдоль хода. На полу: LD=вниз, LF=горизонталь (faceX). На стене: LD=к стене (лево/
  // право), LF=вертикаль (ход). Так ноги всегда тянутся к СУЩЕСТВУЮЩЕЙ стенке (а не
  // «перебирают по воздуху»), и при опоре снизу не задираются вверх при бурении вверх.
  let LDx, LDy, legRot, LFx, LFy, legFlipBase;
  if (supportDir === 'right')     { LDx = 1;  LDy = 0; legRot = -Math.PI / 2; LFx = 0; LFy = (dfy || -1); legFlipBase = false; }
  else if (supportDir === 'left') { LDx = -1; LDy = 0; legRot =  Math.PI / 2; LFx = 0; LFy = (dfy || -1); legFlipBase = false; }
  else                            { LDx = 0;  LDy = 1; legRot = 0;            LFx = bfx; LFy = 0; legFlipBase = bfx < 0; }
  const legBasis = { LDx, LDy, LFx, LFy, legRot, legFlipBase };
  for (const p of def.parts) {
    if (!unitHasPart(unit, p.need)) continue;
    if (p.kind === 'leg') {                  // ноги — сегментный FK; база к опоре (см. legBasis)
      legs.push(resolveLeg(p, cx, cy, R, legBasis, t, unit, moving));
      continue;
    }
    // масса (вкл. ДВИГАТЕЛЬ) — базис (sx·ca, sx·sa) вдоль f, (−sa, ca) вдоль s («низ» остаётся низом)
    let f = p.f, s = p.s || 0;
    if (p.kind === 'drill' || p.kind === 'weapon') f += ANIM.drillWob(t, unit) / R;
    const x = cx + f * R * sx * ca + s * R * (-sa);
    const y = cy + f * R * sx * sa + s * R * ca + bob;
    node[p.id] = { x, y };
    parts.push({ kind: p.kind, id: p.id, x, y, scale: R, angle: fwdAngle, flip, proc: p.proc !== false, overlay: !!p.overlay, z: p.z });
  }
  parts.sort((a, b) => a.z - b.z);

  const cables = [];
  for (const c of def.cables) {
    const a = node[c.a], b = node[c.b];
    if (a && b) cables.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, type: c.type });
  }

  return { legHub: node.legHub, parts, legs, cables, def, R, bfx, dfx, dfy, cx, cy };
}

// Сегментный FK ноги: бедро→голень→стопа. Каждый сегмент крутится в суставе (acc —
// накопленный угол), стык с дочерним — по `joint` (R-offset от пивота). `pivot` —
// нормированная точка спрайта (центр вращения = крепление к родителю). Кадр НОГИ
// (hipX,hipY + зеркало `flip`) применяет рендер — здесь сегменты в ЛОКАЛИ ноги.
const DEFAULT_LEG_SEGS = [
  { id: 'thigh', ang: 0,  swing: 0.7,  len: 0.5,  w: 0.30, z: 0 },
  { id: 'shin',  ang: 40, swing: -0.6, len: 0.55, w: 0.24, z: 1 },
  { id: 'foot',  ang: 32, swing: 0.3,  len: 0.22, w: 0.20, z: 2 },
];
function resolveLeg(p, cx, cy, R, B, t, unit, moving) {
  // B — базис НОГ: LF (продольная ось перед/зад), LD (к опоре). Хип = центр + f·LF + s·LD.
  // Ногу поворачиваем на `legRot`, чтобы её локальный «низ» (+Y) лёг вдоль LD (к опоре).
  // Зеркало пары — `legFlipBase !== p.mirror`.
  const { LDx, LDy, LFx, LFy, legRot, legFlipBase } = B;
  const flip = !!legFlipBase !== !!p.mirror;
  const amp = unit.noAnim ? 0 : (moving ? 0.6 : 0.13);
  const list = (p.segments && p.segments.length) ? p.segments : DEFAULT_LEG_SEGS;
  const segs = [];
  let lx = 0, ly = 0, A = Math.PI / 2;                 // бедро от хипа (0,0), база — вниз (локально)
  list.forEach((sd, i) => {
    const acc0 = A;                                                    // угол ДО собственных ang/swing (для редактора)
    const sw = amp * Math.sin(t * (moving ? 7 : 2) + (p.f < 0 ? Math.PI : 0) + i * 0.6);
    const swApplied = sw * (sd.swing || 0);
    A = acc0 + (sd.ang || 0) * Math.PI / 180 + swApplied;              // FK: накопление угла
    const jl = sd.joint || [0, sd.len != null ? sd.len : 0.5];          // R-offset до стыка (по умолч. вниз на len)
    const rot = A - Math.PI / 2, c = Math.cos(rot), s = Math.sin(rot);
    const jx = lx + (jl[0] * c - jl[1] * s) * R, jy = ly + (jl[0] * s + jl[1] * c) * R;
    segs.push({ lx, ly, jx, jy, A, acc0, swApplied, idx: i, z: sd.z != null ? sd.z : i, w: sd.w || 0.26, spriteId: p.id + ':' + sd.id });
    lx = jx; ly = jy;
  });
  segs.sort((a, b) => a.z - b.z);
  // хип: f вдоль продольной оси LF, s — к опоре LD
  const s = p.s || 0;
  const hipX = cx + p.f * R * LFx + s * R * LDx;
  const hipY = cy + p.f * R * LFy + s * R * LDy;
  return { legId: p.id, z: p.z, hipX, hipY, flip, rot: legRot, segs };  // rot — доворот ноги к опоре
}
