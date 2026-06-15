'use strict';

// Блупринты юнитов: шаблон-слоты по корпусу. Деталь привязана к слоту в
// facing-локальных координатах (f — вперёд по взгляду, s — вбок, в долях R).
// `z` — порядок отрисовки (painter, боковой вид). `need` — условие присутствия
// детали (читается из unit.stats): нет модуля → деталь не рисуется = отсоединение
// сразу видно в мире. `cables` — кибер-мускулы между слотами (тянутся за анимацией).
//
// Типология расширяема: новый юнит = новый блупринт (другие слоты, кол-во ног,
// доп-модули). Кол-во ног задаёт `legs`.
// Блупринт «Скитальца» — экспортирован из tools/rig_editor.html (assets/scout/
// scout-rig.json). Спрайты деталей грузятся в render_parts.js (PART_SPRITE_SRC,
// по id детали/сегмента). `proc:false` без спрайта → деталь не рисуется (sensor).
const UNIT_DEFS = {
  // Ядро «Тор»: НОВЫЙ ТИП (kind:'ring'). Центр — кольцо-реактор. Модули крепятся СНАРУЖИ кольца,
  // заданы УГЛОМ `ang`(°, позиция по окружности) + `rad`(вынос от центра, в R). Ориентация модуля =
  // НАРУЖУ (по `ang`). При бурении вниз/вбок ВЕСЬ кластер модулей поворачивается вокруг центра
  // (`ang+aim`), сохраняя расстановку → бур смотрит в сторону копания. НОГИ (kind:'leg', ik) НЕ
  // вращаются (фиксированы, своя локомоция) и рисуются ПОД модулями. Рендер — render_ring.js.
  core: {
    kind: 'ring',
    ringR: 1.05,                      // радиус кольца-реактора (в R)
    bob: { amp: 0.11, spd: 2.2 },     // нужен ANIM.bob/resolveUnitRig (ноги-FK в редакторе); в игре щупальца с noBob
    parts: [
      // ноги-щупальца (ik) — фиксированы, рисуются ПОД кольцом/модулями (через tentacles/legik)
      { id: 'legL', kind: 'leg', ik: true, f: -0.62, s: 0.5, z: 1, mirror: true, segments: [
        { id: 'thigh', ang: -89, swing: 0.7,  len: 1.29, w: 0.30, z: 0 },
        { id: 'shin',  ang: 35,  swing: -0.6, len: 0.82, w: 0.24, z: 2 },
        { id: 'foot',  ang: 54,  swing: 0.3,  len: 0.54, w: 0.20, z: 1 },
      ] },
      { id: 'legR', kind: 'leg', ik: true, f: 0.62, s: 0.5, z: 1, mirror: false, segments: [
        { id: 'thigh', ang: -91, swing: 0.7,  len: 1.45, w: 0.30, z: 0 },
        { id: 'shin',  ang: 48,  swing: -0.6, len: 0.85, w: 0.24, z: 2 },
        { id: 'foot',  ang: 40,  swing: 0.3,  len: 0.57, w: 0.20, z: 1 },
      ] },
      { id: 'legL2', kind: 'leg', ik: true, f: -0.26, s: 0.52, z: 1, mirror: true, segments: [
        { id: 'thigh', ang: -89, swing: 0.7,  len: 1.29, w: 0.30, z: 0 },
        { id: 'shin',  ang: 35,  swing: -0.6, len: 0.82, w: 0.24, z: 2 },
        { id: 'foot',  ang: 54,  swing: 0.3,  len: 0.54, w: 0.20, z: 1 },
      ] },
      { id: 'legR2', kind: 'leg', ik: true, f: 0.26, s: 0.52, z: 1, mirror: false, segments: [
        { id: 'thigh', ang: -91, swing: 0.7,  len: 1.45, w: 0.30, z: 0 },
        { id: 'shin',  ang: 48,  swing: -0.6, len: 0.85, w: 0.24, z: 2 },
        { id: 'foot',  ang: 40,  swing: 0.3,  len: 0.57, w: 0.20, z: 1 },
      ] },
      // кольцо-реактор (ЦЕНТР, не вращается). Без спрайта — процедурный тор; со спрайтом — он.
      { id: 'reactor', kind: 'reactor', ang: 0, rad: 0, z: 5, proc: true },
      // модули НА КОЛЬЦЕ: ang(° вокруг центра), rad(вынос от центра, в R). ang=0 — «перёд» (к буру).
      { id: 'drill',  kind: 'drill',  ang: 0,    rad: 1.7, z: 20, need: 'dig',     proc: true },
      { id: 'sensor', kind: 'sensor', ang: -62,  rad: 1.5, z: 20, need: 'scanner', proc: true },
      { id: 'engine', kind: 'engine', ang: 62,   rad: 1.5, z: 20, need: 'engine',  proc: true },
      { id: 'hold',   kind: 'hold',   ang: 180,  rad: 1.6, z: 20, need: 'cargo',   proc: true },
      { id: 'aux',    kind: 'aux',    ang: 118,  rad: 1.5, z: 20, need: 'aux',     proc: true },   // доп-слот (опц.): экран помех / реликты
    ],
    legHub: { f: 0, s: 0, dropY: 0.6 },
    cables: [],
  },
  scout: {
    bob: { amp: 0.11, spd: 2.2 },
    parts: [
      { id: 'legL', kind: 'leg', ik: true, f: -0.71, s: 0.48, z: 28, mirror: true, segments: [
        { id: 'thigh', ang: -89, swing: 0.7,  len: 1.29, w: 0.30, z: 0 },
        { id: 'shin',  ang: 35,  swing: -0.6, len: 0.82, w: 0.24, z: 2 },
        { id: 'foot',  ang: 54,  swing: 0.3,  len: 0.54, w: 0.20, z: 1 },
      ] },
      { id: 'legR', kind: 'leg', ik: true, f: 0.52, s: 0.45, z: 30, mirror: false, segments: [
        { id: 'thigh', ang: -91, swing: 0.7,  len: 1.45, w: 0.30, z: 330 },
        { id: 'shin',  ang: 48,  swing: -0.6, len: 0.85, w: 0.24, z: 2 },
        { id: 'foot',  ang: 40,  swing: 0.3,  len: 0.57, w: 0.20, z: 1 },
      ] },
      { id: 'legL2', kind: 'leg', ik: true, f: -0.3, s: 0.5, z: 27, mirror: true, segments: [
        { id: 'thigh', ang: -89, swing: 0.7,  len: 1.29, w: 0.30, z: 0 },
        { id: 'shin',  ang: 35,  swing: -0.6, len: 0.82, w: 0.24, z: 2 },
        { id: 'foot',  ang: 54,  swing: 0.3,  len: 0.54, w: 0.20, z: 1 },
      ] },
      { id: 'legR2', kind: 'leg', ik: true, f: 0.12, s: 0.5, z: 31, mirror: false, segments: [
        { id: 'thigh', ang: -91, swing: 0.7,  len: 1.45, w: 0.30, z: 330 },
        { id: 'shin',  ang: 48,  swing: -0.6, len: 0.85, w: 0.24, z: 2 },
        { id: 'foot',  ang: 40,  swing: 0.3,  len: 0.57, w: 0.20, z: 1 },
      ] },
      { id: 'hold',    kind: 'hold',    f: -1.91, s: -0.75, z: 20, need: 'cargo' },
      { id: 'reactor', kind: 'reactor', f: -0.05, s: -0.72, z: 29, need: null },
      { id: 'sensor',  kind: 'sensor',  f: -0.06, s: -1.30, z: 34, need: 'scanner', proc: false },
      { id: 'drill',   kind: 'drill',   f:  1.85, s: -0.65, z: 20, need: 'dig' },
      { id: 'engine',  kind: 'engine',  f: -0.05, s:  0.39, z: 41, proc: true },
      { id: 'aux',     kind: 'aux',     f: -1.0,  s: -1.3,  z: 22, need: 'aux', proc: true },   // доп-слот (опц.): экран помех / реликты
    ],
    legHub: { f: 0, s: 0, dropY: 0.6 },
    cables: [
      { a: 'reactor', b: 'drill', type: 'hydraulic' },
      { a: 'reactor', b: 'hold',  type: 'data' },
    ],
  },
};
