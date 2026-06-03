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
  scout: {
    bob: { amp: 0.11, spd: 2.2 },
    parts: [
      { id: 'legL', kind: 'leg', f: -0.71, s: 0.48, z: 28, mirror: true, segments: [
        { id: 'thigh', ang: -89, swing: 0.7,  len: 1.29, w: 0.30, z: 0 },
        { id: 'shin',  ang: 35,  swing: -0.6, len: 0.82, w: 0.24, z: 2 },
        { id: 'foot',  ang: 54,  swing: 0.3,  len: 0.54, w: 0.20, z: 1 },
      ] },
      { id: 'legR', kind: 'leg', f: 0.52, s: 0.45, z: 30, mirror: false, segments: [
        { id: 'thigh', ang: -91, swing: 0.7,  len: 1.45, w: 0.30, z: 330 },
        { id: 'shin',  ang: 48,  swing: -0.6, len: 0.85, w: 0.24, z: 2 },
        { id: 'foot',  ang: 40,  swing: 0.3,  len: 0.57, w: 0.20, z: 1 },
      ] },
      { id: 'hold',    kind: 'hold',    f: -1.91, s: -0.75, z: 20, need: 'cargo' },
      { id: 'reactor', kind: 'reactor', f: -0.05, s: -0.72, z: 29, need: null },
      { id: 'sensor',  kind: 'sensor',  f: -0.06, s: -1.30, z: 34, need: 'scanner', proc: false },
      { id: 'drill',   kind: 'drill',   f:  1.85, s: -0.65, z: 20, need: 'dig' },
      { id: 'engine',  kind: 'engine',  f: -0.05, s:  0.39, z: 41, proc: true },
    ],
    legHub: { f: 0, s: 0, dropY: 0.6 },
    cables: [
      { a: 'reactor', b: 'drill', type: 'hydraulic' },
      { a: 'reactor', b: 'hold',  type: 'data' },
    ],
  },
};
