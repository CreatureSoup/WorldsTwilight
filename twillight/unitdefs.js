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
  // Спрут «Ядро-якорник» (kind:'ring' + anchorLegs): тело/модули как у core (кластер доворачивается к бурению),
  // но ноги — 8 ПРЯМЫХ щупалец-ЯКОРЕЙ (детали kind:'anchor': ang/rad = расстановка КРЕПЛЕНИЙ, правится в
  // редакторе перетаскиванием как модули; 4 нижних + 4 верхних по кругу). Локомоция/стейт-машина — sprut.js,
  // рендер ног — render_sprut.js (звенья `sprut:link` + лапа `sprut:claw` — ГЛОБАЛЬНЫЕ плоские ключи, как wheel:*).
  // ⚠️ якоря НЕ рисуются drawRingUnit и НЕ вращаются с кластером модулей (фиксированы, как ноги core).
  sprut: {
    kind: 'ring',
    anchorLegs: true,
    ringR: 1.05,
    bob: { amp: 0.08, spd: 2.0 },     // нужен resolveUnitRig/blueprintScale (FK-веток нет, но bob читается)
    parts: [
      { id: 'reactor', kind: 'reactor', ang: 0, rad: 0, z: 5, proc: true },
      { id: 'drill',  kind: 'drill',  ang: 0,    rad: 1.7, z: 20, need: 'dig',     proc: true },
      { id: 'sensor', kind: 'sensor', ang: -62,  rad: 1.5, z: 20, need: 'scanner', proc: true },
      { id: 'engine', kind: 'engine', ang: 62,   rad: 1.5, z: 20, need: 'engine',  proc: true },
      { id: 'hold',   kind: 'hold',   ang: 180,  rad: 1.6, z: 20, need: 'cargo',   proc: true },
      { id: 'aux',    kind: 'aux',    ang: 118,  rad: 1.5, z: 20, need: 'aux',     proc: true },
      // ВТОРОЙ доп-слот — ГЛАВНОЕ свойство «Спрута» (узел print_slots): деталь id 'aux2' (kind 'aux' —
      // та же процедура/спрайты), need 'aux2' → stats.aux2On из getStats; слот aux2 → категория 'aux'.
      { id: 'aux2',   kind: 'aux',    ang: -118, rad: 1.5, z: 20, need: 'aux2',    proc: true },
      // 8 креплений якорей: экранный y вниз → ang 30..150 = НИЖНЯЯ полусфера, −30..−150 = ВЕРХНЯЯ.
      { id: 'anc1', kind: 'anchor', ang:  30,  rad: 1.12, z: 1 },
      { id: 'anc2', kind: 'anchor', ang:  75,  rad: 1.12, z: 1 },
      { id: 'anc3', kind: 'anchor', ang: 105,  rad: 1.12, z: 1 },
      { id: 'anc4', kind: 'anchor', ang: 150,  rad: 1.12, z: 1 },
      { id: 'anc5', kind: 'anchor', ang: -150, rad: 1.12, z: 1 },
      { id: 'anc6', kind: 'anchor', ang: -105, rad: 1.12, z: 1 },
      { id: 'anc7', kind: 'anchor', ang: -75,  rad: 1.12, z: 1 },
      { id: 'anc8', kind: 'anchor', ang: -30,  rad: 1.12, z: 1 },
    ],
    legHub: { f: 0, s: 0, dropY: 0.6 },
    cables: [],
  },
  // Канонир «Моно-колесо»: НОВЫЙ ТИП (kind:'wheel'). ВНЕШНЕЕ кольцо-зубья (`toothR`) — встроенный бур, ВРАЩАЕТСЯ по
  // ходу/бурению (render_wheel). ВНУТРЕННЯЯ втулка-реактор (`ringR`) неподвижна; модули крепятся на втулку (ang°+rad, в R),
  // НЕ доворачиваются к бурению (колесо всенаправленно). НОГ НЕТ. Турель (`kind:'turret'`) — на верху втулки, поворотная
  // (render_wheel по `unit._turretAim`). Рендер — render_wheel.js. drawScale ужат: колесо-диск должен влезать в ~тайл.
  gun: {
    kind: 'wheel',
    ringR: 0.78,                      // втулка-реактор (внутреннее кольцо)
    toothR: WHEEL_TOOTH_R,            // внешнее кольцо-зубья (встроенный бур)
    toothZ: 0, bodyZ: 6,             // z кольца-зубьев и корпуса-кольца — участвуют в ОБЩЕЙ z-сортировке с реактором(10)/модулями(20) → перекрытие слоёв настраивается
    drawScale: 0.55,                  // диск ужат под ~тайл (радиус 1.62R крупнее кольца)
    bob: { amp: 0.05, spd: 2.0 },     // лёгкое «дыхание» — нужно resolveUnitRig/blueprintScale (хоть ног нет)
    parts: [
      { id: 'reactor', kind: 'reactor', ang: 0, rad: 0, z: 10, proc: true },   // втулка-реактор (центр, не вращается)
      // модули на ВТУЛКЕ (внутри колеса), фикс. углы (без доворота к бурению). Верх (ang −90) отдан турели.
      { id: 'engine', kind: 'engine', ang: 45,   rad: 0.72, z: 20, need: 'engine',  proc: true },
      { id: 'aux',    kind: 'aux',    ang: -38,  rad: 0.72, z: 20, need: 'aux',     proc: true },
      { id: 'sensor', kind: 'sensor', ang: -142, rad: 0.72, z: 20, need: 'scanner', proc: true },
      { id: 'hold',   kind: 'hold',   ang: 135,  rad: 0.72, z: 20, need: 'cargo',   proc: true },
      // турель на верху втулки — render_wheel рисует мачту+ствол по `unit._turretAim` (поворотная как городская)
      { id: 'turret', kind: 'turret', ang: -90,  rad: 0.5,  z: 40, need: 'turret',  proc: true },
    ],
    legHub: { f: 0, s: 0, dropY: 0.6 },   // ног нет, но resolveUnitRig/ANIM.bob читают legHub — обязателен
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
