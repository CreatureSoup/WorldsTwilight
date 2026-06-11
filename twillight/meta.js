'use strict';

// СЕТЬ ПАМЯТИ — данные + граф + состояние мета-прогресса. Структура 1:1 с дизайном
// `meta/project/src/tech_web.jsx` (радиальная PCB-сеть: ядро → 5 секторов, hub+2mid+3out,
// кольцевые кросс-связи, вершина-cap), НО темы/узлы — по списку игрока (где <6 — дострой темат.).
// Рендер/ввод — meta_dom.js. Валюта — МЕГА-ТОКЕНЫ (save.meta), открытия — save.metaUnlocks.

// META_NAME / META_ABBR объявлены в constants.js (не дублируем — иначе двойной const → SyntaxError).
const MW = 2400, MH = 2000, MX = MW / 2, MY = MH / 2;          // холст сети
const _polar = (r, deg) => [MX + r * Math.cos(deg * Math.PI / 180), MY + r * Math.sin(deg * Math.PI / 180)];

// сектора (порядок = по пятиугольнику от верха; cap зависит от сектора 0). accent — цвет дизайна.
const META_SECTORS = [
  { id: 'mast',  label: 'МАСТЕРСКАЯ',  accent: '#3a7ec8', sys: 'ЖИВУЧЕСТЬ И ЗАЩИТА' },
  { id: 'print', label: 'ПРИНТЕР-ЦЕХ', accent: '#f08a2a', sys: 'ПРИНТЕР ТЕЛ' },
  { id: 'amb',   label: 'ПОСОЛЬСТВО',  accent: '#d4a042', sys: 'ДИПЛОМАТИЯ ГОРОДОВ' },
  { id: 'kart',  label: 'КАРТОГРАФ',   accent: '#8a7ed4', sys: 'ОБЗОР · СКАНЕР · НАВИГАЦИЯ' },
  { id: 'vault', label: 'ХРАНИЛИЩЕ',   accent: '#ff3a22', sys: 'ВЗЛОМ · ДАННЫЕ · ДОБЫЧА' },
];
// узел: [имя, кратко, icon-ключ, описание].  hub + m0,m1 (mid) + o0,o1,o2 (out).
const META_CONTENT = {
  mast: { hub: ['Мастерская', 'каркас ветви', 'wrench', 'Открывает ветвь живучести. Базовый верстак ИИ — обслуживание и защита корпуса.'],
    m0: ['Ремонт-дрон', 'починка вне базы', 'stab', 'Юнит медленно восстанавливает HP вдали от базы.'],
    m1: ['Экран помех I', '−помехи ур.1', 'resonance', 'Слабее помехи интерфейса от радиации.'],
    o0: ['Нанорой', 'починка ×2', 'fast', 'Скорость автопочинки заметно выше.'],
    o1: ['Экран помех II', '−помехи ур.2', 'resonance', 'Ещё тише помехи интерфейса.'],
    o2: ['Экран помех III', '−помехи ур.3', 'resonance', 'Помехи почти подавлены даже у очагов радиации.'] },
  print: { hub: ['Принтер-цех', 'каркас ветви', 'printer', 'Открывает ветвь печати. Юнит может возводить сооружения и управлять очередью тел.'],
    m0: ['Доп. тело', '+1 слот печати', 'body', 'Принтер держит на один резервный корпус больше за забег.'],
    m1: ['Быстрая сборка', '−30% времени', 'fast', 'Сборка нового тела на 30% быстрее.'],
    o0: ['Дешёвые тела', '−25% к цене', 'coin', 'Каждое печатное тело стоит меньше ресурса.'],
    o1: ['Утиль тел', '50% модулей назад', 'salvage', 'С павшего юнита половина модулей возвращается на базу.'],
    o2: ['Очередь', 'печать в фоне', 'queue', 'Тело собирается в фоне, пока активный юнит в шахте.'] },
  amb: { hub: ['Посольство', 'каркас ветви', 'contact', 'Открывает диалоги и задания городов. Без него чужие города молчат.'],
    m0: ['Телеметрия города', 'счётчик ресурсов', 'detector', 'Счётчик ресурсов города в интерфейсе.'],
    m1: ['Протокол пробуждения', 'будить кластеры', 'rune', 'Позволяет корректно будить спящие города-кластеры.'],
    o0: ['Аварийный маршрут', 'путь к базе', 'map', 'Подсветка кратчайшего пути к базе при критическом таймере города.'],
    o1: ['Дипканал', 'задания + награды', 'gift', 'Дружественные города выдают задания и награды.'],
    o2: ['Двойной альянс', '2 города зараз', 'ally2', 'Можно держать активные задания двух городов одновременно.'] },
  kart: { hub: ['Картограф', 'каркас ветви', 'map', 'Открывает ветвь обзора. Вскрывает верхний слой карты на старте забега.'],
    m0: ['Линза прожектора', 'шире конус', 'sun', 'Конус прожектора шире — видно больше вокруг бура.'],
    m1: ['Гейгер-компас', 'к радиации', 'resonance', 'Стрелка указывает на ближайший очаг радиации.'],
    o0: ['Дальний свет', 'дальше луч', 'sun', 'Прожектор бьёт заметно дальше вглубь.'],
    o1: ['Дальний радар', 'видит диких', 'detector', 'Обнаруживает юнитов диких городов на карте.'],
    o2: ['Метки опасности', 'подсветка угроз', 'quiet', 'Сканер подсвечивает нестабильную породу и валуны.'] },
  vault: { hub: ['Хранилище', 'каркас ветви', 'relic', 'Открывает ветвь взлома. Старые хранилища и данные становятся доступны.'],
    m0: ['Взлом хранилищ', 'вскрыть тайники', 'salvage', 'Вскрывает старые хранилища ресурсов в породе.'],
    m1: ['Дешифратор', 'быстрее данные', 'decode', 'Быстрее извлечение данных из серверов.'],
    o0: ['Взлом хранилищ II', 'больше добычи', 'vein', 'Больше ресурса из вскрытых хранилищ.'],
    o1: ['Архив данных', 'лог находок', 'archive', 'Постоянный лог извлечённых данных между забегами.'],
    o2: ['Резонанс данных', 'пассив-бонусы', 'resonance', 'Извлечённые данные дают пассивные бонусы в забеге.'] },
};
const META_TC = { hub: 8, mid: 10, out: 16 };   // цены ×2
const META_RADIUS = { core: 62, hub: 42, mid: 33, out: 29, cap: 50 };

function _metaBuildGraph() {
  const nodes = [], edges = [];
  // СТАРТОВЫЙ велком-узел: ПОКУПАЕТСЯ (доступен сразу, без зависимостей); эффект —
  // открывает раздел АПГРЕЙДОВ ГОРОДА в забеге (гейт `metaNeed:'core'` в upgrades.js).
  nodes.push({ id: 'core', kind: 'core', x: MX, y: MY, name: 'ЯДРО ИИ', sub: 'анлок апгрейдов города', icon: 'core', cost: 4, accent: '#f2c878',
    desc: 'Пробуждение ядра. Открывает доступ к системам города в забеге (раздел ГОРОД в апгрейдах базы). Корень сети памяти — от него расходятся пять ветвей.' });
  // ── СТАНДАРТНЫЕ сектора (город/ядро/мир/структуры) — прежний ромб hub→2mid→3out ──
  // (синяя ЮНИТ = i 0 строится кастомно ниже; остальные ветки переделаем по очереди.)
  META_SECTORS.forEach((s, i) => {
    if (i === 0) return;
    const A = -90 + i * 72, c = META_CONTENT[s.id];
    const P = { hub: _polar(360, A), m0: _polar(640, A - 16), m1: _polar(640, A + 16), o0: _polar(940, A - 28), o1: _polar(940, A), o2: _polar(940, A + 28) };
    const kindOf = (k) => k === 'hub' ? 'hub' : (k[0] === 'm' ? 'mid' : 'out');
    for (const k of ['hub', 'm0', 'm1', 'o0', 'o1', 'o2']) {
      const d = c[k], kind = kindOf(k);
      nodes.push({ id: s.id + '_' + k, kind, sector: i, accent: s.accent, sys: s.sys, slabel: s.label, x: P[k][0], y: P[k][1], name: d[0], sub: d[1], icon: d[2], desc: d[3], cost: META_TC[kind] });
    }
    edges.push(['core', s.id + '_hub', 'wire']);
    edges.push([s.id + '_hub', s.id + '_m0', 'wire'], [s.id + '_hub', s.id + '_m1', 'wire']);
    edges.push([s.id + '_m0', s.id + '_o0', 'wire'], [s.id + '_m0', s.id + '_o1', 'wire']);
    edges.push([s.id + '_m1', s.id + '_o1', 'wire'], [s.id + '_m1', s.id + '_o2', 'wire']);
  });

  // ── СИНЯЯ ветка ЮНИТ (sector 0): доп-слот → 3 линии. Буры и сенсоры — ПАРАЛЛЕЛЬНО от
  // своих под-хабов (буровой/сенсорный цех), а не цепочкой. Эффекты модулей — отдельно («начинка»).
  const U = META_SECTORS[0];
  const un = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 0, accent: U.accent, sys: U.sys, slabel: U.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  un('mast_hub', 'hub', 360, -90, 'Доп-слот', 'порт под артефакты', 'slot', 'Универсальный вспомогательный слот юнита: маунтит найденные артефакты-реликты (в т.ч. профильные трюмы). Открывает артефакт-экономику.');
  un('mast_drill', 'mid', 560, -116, 'Буровой цех', 'линия буров', 'drill', 'Открывает альтернативные буры и прокачку силы бура. От цеха — четыре бура ПАРАЛЛЕЛЬНО (ставишь любой в слот бура).');
  un('mast_rep', 'mid', 600, -90, 'Ремонтный трюм', 'починка HP', 'wrench', 'Вариант трюма: чинит HP вне базы ценой части ёмкости. Поднимает кап ПРОЧНОСТИ до ур.4.');
  un('mast_sens', 'mid', 560, -66, 'Сенсорный цех', 'линия сенсоров', 'map', 'Открывает инфо-сенсоры (параллельно от цеха) и УЛУЧШЕНИЯ ПРОЖЕКТОРА в апгрейдах базы.');
  un('mast_di', 'out', 900, -130, 'Импульсный бур', 'заряд удержанием', 'bomb', 'Заряжается удержанием, выносит несколько тайлов залпом.');
  un('mast_dk', 'out', 900, -119, 'Кинетический бур', 'копит толчок', 'blades', 'Бурение копит «взрывной» толчок, выбивающий соседние тайлы.');
  un('mast_ds', 'out', 900, -108, 'Бур-винт', 'укреплённый ход', 'stab', 'Безопасная укреплённая проходка — за тобой не остаётся тоннелей врагам. С кулдауном.');
  un('mast_du', 'out', 900, -97, 'Нестабильный бур', 'перегрев/риск', 'obsidian', 'Мощнейший, но копит перегрев — урон при перегреве.');
  un('mast_sa', 'out', 900, -80, 'Обнаружение угроз', 'разметка опасностей', 'quiet', 'Метит врагов на всём экране и нестабильную породу (трещины/камни) в радиусе сенсора.');
  un('mast_sr', 'out', 900, -66, 'Детектор загрязнения', 'свойство сканера', 'detector', 'Апгрейд сенсора: твой сканер начинает засекать СТОРОНУ источника загрязнения, пока ты в зоне фона. Отдельный модуль не нужен — просто работает. Показания живые/неточные, точнее вблизи.');
  un('mast_sh', 'out', 900, -52, 'Экран помех', 'гасит помехи', 'resonance', 'Отдельный модуль защиты от помех интерфейса. Открывает ветку улучшения экрана в апгрейдах базы.');
  edges.push(['core', 'mast_hub', 'wire']);
  edges.push(['mast_hub', 'mast_drill', 'wire'], ['mast_hub', 'mast_rep', 'wire'], ['mast_hub', 'mast_sens', 'wire']);
  edges.push(['mast_drill', 'mast_di', 'wire'], ['mast_drill', 'mast_dk', 'wire'], ['mast_drill', 'mast_ds', 'wire'], ['mast_drill', 'mast_du', 'wire']);
  edges.push(['mast_sens', 'mast_sa', 'wire'], ['mast_sens', 'mast_sr', 'wire'], ['mast_sens', 'mast_sh', 'wire']);

  // кольцо хабов (все 5); кольцо внешних — только среди стандартных секторов (у юнита своя форма)
  for (let i = 0; i < META_SECTORS.length; i++) edges.push([META_SECTORS[i].id + '_hub', META_SECTORS[(i + 1) % META_SECTORS.length].id + '_hub', 'ring']);
  for (let i = 1; i < META_SECTORS.length - 1; i++) edges.push([META_SECTORS[i].id + '_o2', META_SECTORS[i + 1].id + '_o0', 'ring']);

  // Капстоун ПРОТОКОЛ ВОСХОЖДЕНИЯ (перенос модуля между забегами) временно УБРАН из юнита —
  // вернём в ветку ЯДРО/ПРОБУЖДЕНИЕ при её проработке (там он по смыслу: правила забега/смерти).
  return { nodes, edges };
}
const _MG = _metaBuildGraph();
const META_NODES = _MG.nodes, META_EDGES = _MG.edges;
const META_BY_ID = Object.fromEntries(META_NODES.map((n) => [n.id, n]));
const META_NEI = {}; META_NODES.forEach((n) => META_NEI[n.id] = []);
META_EDGES.forEach(([a, b]) => { META_NEI[a].push(b); META_NEI[b].push(a); });
const META_TOTAL = META_NODES.length;   // ядро теперь тоже ПОКУПАЕТСЯ (велком-узел)

// ── состояние (из save) ──
function metaUnlocked(save, id) { return !!(save.metaUnlocks && save.metaUnlocks[id]); }
function _metaDist(save) {       // BFS-дистанция от запитанного фронта → видимость
  const d = {}; META_NODES.forEach((n) => d[n.id] = Infinity);
  const owned = META_NODES.filter((n) => metaUnlocked(save, n.id)).map((n) => n.id);
  owned.forEach((id) => d[id] = 0);
  let fr = [...owned], step = 0;
  while (fr.length) { const nx = []; fr.forEach((id) => META_NEI[id].forEach((m) => { if (d[m] > step + 1) { d[m] = step + 1; nx.push(m); } })); fr = nx; step++; }
  return d;
}
function metaAvail(save, n) {
  if (metaUnlocked(save, n.id)) return false;
  if (n.kind === 'core') return true;   // велком-узел: доступен к покупке всегда (без зависимостей)
  if (n.kind === 'cap') return n.capDeps.every((id) => metaUnlocked(save, id));
  return META_NEI[n.id].some((id) => metaUnlocked(save, id));
}
// 'owned' | 'avail' | 'visible' (1 шаг за фронтом) | 'hidden'
function metaState(save, n, dist) {
  if (metaUnlocked(save, n.id)) return 'owned';
  if (metaAvail(save, n)) return 'avail';
  const d = (dist || _metaDist(save))[n.id];
  if (n.kind === 'cap') return d <= 2 ? 'visible' : 'hidden';
  return d === 2 ? 'visible' : 'hidden';
}
function metaCanBuy(save, n) { return metaAvail(save, n) && (save.meta || 0) >= n.cost; }
function metaBuy(save, n) {
  if (!metaCanBuy(save, n)) return false;
  save.meta = (save.meta || 0) - n.cost;
  (save.metaUnlocks || (save.metaUnlocks = {}))[n.id] = 1;
  if (typeof writeSave === 'function') writeSave(save);
  return true;
}
function metaReset(save) {       // сброс сети: возврат потраченного (ядро тоже покупное → тоже возвращается)
  let spent = 0; for (const n of META_NODES) if (metaUnlocked(save, n.id)) spent += n.cost;
  save.meta = (save.meta || 0) + spent; save.metaUnlocks = {};
  if (typeof writeSave === 'function') writeSave(save);
}
function metaPoweredCount(save) { let n = 0; for (const x of META_NODES) if (metaUnlocked(save, x.id)) n++; return n; }
function metaDepNames(n) {       // предки (wire-родители ближе к ядру) — для блока «ТРЕБУЕТ»
  if (n.kind === 'cap') return n.capDeps.map((id) => META_BY_ID[id].name);
  if (n.kind === 'core') return [];
  return META_EDGES.filter(([a, b, k]) => k === 'wire' && b === n.id).map(([a]) => META_BY_ID[a].name);
}

// ── для эффектов узлов в забеге ──
let _metaSaveRef = null;
function metaBindSave(save) { _metaSaveRef = save; }
function metaHas(id) { return _metaSaveRef ? metaUnlocked(_metaSaveRef, id) : false; }
// Узел открывает НОВЫЙ модуль сборки? (есть запись в MODULE_DEFS с unlock===id) — для тега «+МОДУЛЬ» в мете.
function metaUnlocksModule(id) { return typeof MODULE_DEFS !== 'undefined' && Object.keys(MODULE_DEFS).some((k) => MODULE_DEFS[k].unlock === id); }
