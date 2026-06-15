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
  { id: 'print', label: 'ЗАКРЫТО',     accent: '#ff3a22', sys: 'ПРИНТЕР ТЕЛ' },
  { id: 'amb',   label: 'ГОРОД',       accent: '#d4a042', sys: 'ЭНЕРГИЯ · КОНТУРЫ · ОБОРОНА' },
  { id: 'kart',  label: 'МИР',         accent: '#8a7ed4', sys: 'ДАННЫЕ · ГОРОДА · ВЗЛОМ' },
  { id: 'vault', label: 'ПЕЧАТНЫЙ ЦЕХ', accent: '#f08a2a', sys: 'СТЕНЫ · ТУРЕЛИ · КОНТРОЛЬ' },
];
// узел: [имя, кратко, icon-ключ, описание].  hub + m0,m1 (mid) + o0,o1,o2 (out).
const META_CONTENT = {
  mast: { hub: ['Мастерская', 'каркас ветви', 'wrench', 'Открывает ветвь живучести. Базовый верстак ИИ — обслуживание и защита корпуса.'],
    m0: ['Ремонт-дрон', 'починка вне базы', 'stab', 'Юнит медленно восстанавливает HP вдали от базы.'],
    m1: ['Экран помех I', '−помехи ур.1', 'resonance', 'Слабее помехи интерфейса от радиации.'],
    o0: ['Нанорой', 'починка ×2', 'fast', 'Скорость автопочинки заметно выше.'],
    o1: ['Экран помех II', '−помехи ур.2', 'resonance', 'Ещё тише помехи интерфейса.'],
    o2: ['Экран помех III', '−помехи ур.3', 'resonance', 'Помехи почти подавлены даже у очагов радиации.'] },
  print: { hub: ['ЗАКРЫТО', 'в разработке', 'body', 'Ветвь ПЕЧАТИ ТЕЛ (резервные корпуса юнита, очередь сборки) — пока ЗАКРЫТА, в разработке. Печать оборонных структур переехала в оранжевую ветвь ПЕЧАТНОГО ЦЕХА.'],
    m0: ['Доп. тело', '+1 слот печати', 'body', 'Принтер держит на один резервный корпус больше за забег.'],
    m1: ['Быстрая сборка', '−30% времени', 'fast', 'Сборка нового тела на 30% быстрее.'],
    o0: ['Дешёвые тела', '−25% к цене', 'coin', 'Каждое печатное тело стоит меньше ресурса.'],
    o1: ['Утиль тел', '50% модулей назад', 'salvage', 'С павшего юнита половина модулей возвращается на базу.'],
    o2: ['Очередь', 'печать в фоне', 'queue', 'Тело собирается в фоне, пока активный юнит в шахте.'] },
  // amb (ГОРОД), kart (МИР) и vault (ПЕЧАТЬ СТРУКТУР) — КАСТОМНЫЕ формы (см. `_metaBuildGraph`), здесь не описываются.
};
const META_TC = { hub: 8, mid: 10, out: 16 };   // цены ×2
const META_RADIUS = { core: 62, hub: 42, mid: 33, out: 29, cap: 50 };
// Правила раскладки сети (детали — spec_meta.md «Правила размещения»). Валидатор `_metaValidateLayout`
// проверяет их при сборке графа и ВОРЧИТ в консоль на нарушение — чтобы новые/правленые узлы не ломали
// читаемость (наложения, выход за холст, «втягивание» дочернего узла к ядру). minDist — мин. расстояние
// центров (подписи висят ПОД узлом); margin — отступ узла от кромки холста.
const META_LAYOUT = { minDist: 160, margin: 30 };

function _metaBuildGraph() {
  const nodes = [], edges = [];
  // СТАРТОВЫЙ велком-узел: ПОКУПАЕТСЯ (доступен сразу, без зависимостей); эффект —
  // открывает раздел АПГРЕЙДОВ ГОРОДА в забеге (гейт `metaNeed:'core'` в upgrades.js).
  nodes.push({ id: 'core', kind: 'core', x: MX, y: MY, name: 'ЯДРО ИИ', sub: 'анлок апгрейдов города', icon: 'core', cost: 4, accent: '#f2c878',
    desc: 'Пробуждение ядра. Открывает доступ к системам города в забеге (раздел ГОРОД в апгрейдах базы). Корень сети памяти — от него расходятся пять ветвей.' });
  // ── СТАНДАРТНЫЙ сектор (только print=ЗАКРЫТО) — прежний ромб hub→2mid→3out ──
  // (ЮНИТ=0, ГОРОД=2, МИР=3, ПЕЧАТЬ=4 строятся кастомно ниже; стандартным остался лишь i=1.)
  META_SECTORS.forEach((s, i) => {
    if (i === 0 || i === 2 || i === 3 || i === 4) return;   // 0 ЮНИТ, 2 ГОРОД, 3 МИР, 4 ПЕЧАТЬ — КАСТОМНЫЕ формы (ниже)
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
  un('mast_drill', 'mid', 560, -122, 'Буровой цех', 'линия буров', 'drill', 'Открывает альтернативные буры и прокачку силы бура. От цеха — четыре бура ПАРАЛЛЕЛЬНО (ставишь любой в слот бура).');
  un('mast_cargo', 'mid', 560, -90, 'Улучшение трюма', 'кап ёмкости', 'archive', 'Поднимает кап трека ЁМКОСТЬ до ур.4 в апгрейдах базы — больше слотов под ресурс. После него — ремонтная линия (цех → трюм).');
  un('mast_hull', 'mid', 750, -90, 'Ремонтный цех', 'прочность корпуса', 'body', 'Поднимает кап ПРОЧНОСТИ корпуса до ур.4 в апгрейдах базы.');
  un('mast_rep', 'out', 935, -90, 'Ремонтный трюм', 'починка HP вне базы', 'wrench', 'Открывает вариант ТРЮМА: чинит HP вне базы ценой части ёмкости. Ставишь в слот трюма на сборке; трек РЕМОНТНЫЙ ТРЮМ в апгрейдах базы докручивает починку и ёмкость.');
  un('mast_sens', 'mid', 560, -58, 'Сенсорный цех', 'линия сенсоров', 'map', 'Открывает инфо-сенсоры (параллельно от цеха) и УЛУЧШЕНИЯ ПРОЖЕКТОРА в апгрейдах базы.');
  un('mast_di', 'out', 900, -136, 'Импульсный бур', 'заряд удержанием', 'bomb', 'Заряжается удержанием, выносит несколько тайлов залпом.');
  un('mast_dk', 'out', 900, -125, 'Кинетический бур', 'копит толчок', 'blades', 'Бурение копит «взрывной» толчок, выбивающий соседние тайлы.');
  un('mast_ds', 'out', 900, -114, 'Бур-винт', 'укреплённый ход', 'stab', 'Безопасная укреплённая проходка — за тобой не остаётся тоннелей врагам. С кулдауном.');
  un('mast_du', 'out', 900, -103, 'Нестабильный бур', 'перегрев/риск', 'obsidian', 'Мощнейший, но копит перегрев — урон при перегреве.');
  un('mast_sa', 'out', 900, -72, 'Обнаружение угроз', 'разметка опасностей', 'quiet', 'Метит врагов на всём экране и нестабильную породу (трещины/камни) в радиусе сенсора.');
  un('mast_sr', 'out', 900, -58, 'Детектор загрязнения', 'свойство сканера', 'detector', 'Апгрейд сенсора: твой сканер начинает засекать СТОРОНУ источника загрязнения, пока ты в зоне фона. Отдельный модуль не нужен — просто работает. Показания живые/неточные, точнее вблизи.');
  un('mast_sh', 'out', 900, -44, 'Экран помех', 'модуль в доп-слот', 'resonance', 'Модуль для доп-слота: гасит помехи интерфейса от радиации (база). Ставишь в доп-слот на сборке; трек ЭКРАН ПОМЕХ в апгрейдах базы докручивает.');
  edges.push(['core', 'mast_hub', 'wire']);
  edges.push(['mast_hub', 'mast_drill', 'wire'], ['mast_hub', 'mast_cargo', 'wire'], ['mast_hub', 'mast_sens', 'wire']);
  edges.push(['mast_cargo', 'mast_hull', 'wire']);   // линия: доп-слот → улучшение трюма → ремонтный цех → ремонтный трюм
  edges.push(['mast_hull', 'mast_rep', 'wire']);   // ремонт: сперва ЦЕХ (прочность), затем ТРЮМ (модуль)
  edges.push(['mast_drill', 'mast_di', 'wire'], ['mast_drill', 'mast_dk', 'wire'], ['mast_drill', 'mast_ds', 'wire'], ['mast_drill', 'mast_du', 'wire']);
  edges.push(['mast_sens', 'mast_sa', 'wire'], ['mast_sens', 'mast_sr', 'wire'], ['mast_sens', 'mast_sh', 'wire']);

  // Узел соседнего сектора, упиравшийся в широкий веер синей ветки — разведён НАРУЖУ (за её край),
  // чтобы его дорожка не пересекала синие. `Дешёвые тела` (print=ЗАКРЫТО) — вправо-вверх от сенсорного.
  const _repos = (id, deg, r) => { const n = nodes.find((x) => x.id === id); if (n) { const p = _polar(r, deg); n.x = p[0]; n.y = p[1]; } };
  _repos('print_o0', -28, 975);    // Дешёвые тела (красная, ЗАКРЫТО) — дальше от mast_sh (синий сенсорный край −44)

  // ── ЖЁЛТАЯ ветка ГОРОД (sector 2, A≈54° вниз-вправо): кастомная форма. Хаб-СЧЁТЧИК → 4 линии:
  // батареи→чарджер→firewall · ремонтный док · НАВИГАЦИЯ→предикт · контуры→регенерация→РЕКОНСТРУКЦИЯ.
  // Линия контуров — нижняя (≈90°): прижата к низу холста (y>1900 уезжает за край MH), поэтому 3-й узел
  // ведём НЕ круто вниз, а сметаем УГОЛ ВВЕРХ-наружу (90°→80°), как линию батарей (24°→16°) — см. правила.
  const C = META_SECTORS[2];
  const cn = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 2, accent: C.accent, sys: C.sys, slabel: C.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  cn('amb_hub',    'hub', 360, 54, 'Счётчик ресурсов', 'банк в HUD', 'coin', 'Показывает банк ресурсов города (сданное железо/органику/кристалл) прямо в HUD во время вылазки. Вход в ветвь ГОРОДА.');
  cn('amb_batt',   'mid', 540, 24, 'Энергоёмкость', 'запас таймера', 'sun', 'Открывает трек ЁМКОСТЬ БАТАРЕЙ в апгрейдах базы: больше времени до гибернации, пока ты в шахте.');
  cn('amb_charge', 'out', 880, 20, 'Супер-чарджер', 'быстрее зарядка', 'fast', 'Реактор юнита заряжает батареи города мощнее: таймер дозаряжается на базе ЗАМЕТНО быстрее. Трек СУПЕР-ЧАРДЖЕР (3 ур.).');
  cn('amb_fw',     'out', 1140, 16, 'Firewall', 'защита от взлома', 'decode', 'Защита систем города от взлома диких. (в разработке)');
  cn('amb_dock',   'mid', 680, 47, 'Ремонтный док', 'чинит юнит на базе', 'stab', 'Открывает трек РЕМОНТНЫЙ ДОК: на базе юнит восстанавливает HP корпуса со временем (4 ур.).');
  cn('amb_nav',    'mid', 600, 68, 'Навигация до города', 'путь к базе', 'map', 'Когда времени до базы на текущей скорости впритык к таймеру гибернации — зажигает светящийся путь к городу. Учитывает апгрейды скорости и таймера.');
  cn('amb_predict','out', 900, 64, 'Предикт волн', 'прогноз атак', 'detector', 'Прогноз типа и времени следующей волны диких в HUD. (в разработке)');
  cn('amb_cont',   'mid', 540, 90, 'Контуры', 'запас контуров', 'body', 'Открывает трек КОНТУРЫ в апгрейдах базы: усиливает контуры энергосбережения города по очереди — внешний → внутренний → ядро.');
  cn('amb_regen',  'out', 720, 85, 'Регенерация контуров', 'самовосстановление', 'resonance', 'Контуры энергосбережения города медленно восстанавливают заряд САМИ. Трек АВТО-ПОЧИНКА: уровни расширяют охват ядро → +внутр. → +внешний. (утерянное кольцо НЕ возвращает)');
  cn('amb_recon',  'out', 900, 80, 'Реконструкция', 'возврат утерянных', 'ascend', 'Усиливает авто-починку: ВОЗВРАЩАЕТ утерянные (обнулённые) контуры — воскрешает кольцо и регенит его HP тем же темпом, в охвате авто-почини. Заменяет обычную регенерацию.');
  edges.push(['core', 'amb_hub', 'wire']);
  edges.push(['amb_hub', 'amb_batt', 'wire'], ['amb_hub', 'amb_dock', 'wire'], ['amb_hub', 'amb_nav', 'wire'], ['amb_hub', 'amb_cont', 'wire']);
  edges.push(['amb_batt', 'amb_charge', 'wire'], ['amb_charge', 'amb_fw', 'wire']);
  edges.push(['amb_nav', 'amb_predict', 'wire']);
  edges.push(['amb_cont', 'amb_regen', 'wire'], ['amb_regen', 'amb_recon', 'wire']);

  // ── ФИОЛЕТОВАЯ ветка МИР (sector 3, A≈126° вниз-влево): кастомная форма, пока ТОЛЬКО СТРУКТУРА (узлы-заглушки,
  // эффекты не подключены). Хаб-ДЕШИФРАТОР → 2 линии: ДАННЫЕ (объём→останки→руины) с ответвлением ГОРОДА
  // (пробуждение→ВЗЛОМ нейтрального — нужны данные о городе) · ВЗЛОМ (юниты→стелс→дикие города). `kart_hackcity` —
  // ВЕНЕЦ: самый дальний по графу (d4) И самый внешний по радиусу. ⚠️ Узлы держим В ХОЛСТЕ (MH=2000): крутые «вниз»
  // углы (~100°) на большом радиусе уезжают за нижнюю кромку → SVG обрезает провод. Эффекты — через `metaHas(id)`.
  const K = META_SECTORS[3];
  const kn = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 3, accent: K.accent, sys: K.sys, slabel: K.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  kn('kart_hub',     'hub', 360, 132, 'Дешифратор', 'скан/взлом быстрее', 'decode', 'Каркас ветви МИР: ускоряет извлечение данных и взлом систем. От него — линии ДАННЫХ и ВЗЛОМА. (в разработке)');
  kn('kart_data',    'mid', 540, 118, 'Объём данных', 'больше за скан', 'archive', 'Каждый скан даёт больше данных для кодекса. Развилка: останки/руины + города. (в разработке)');
  kn('kart_wreck',   'out', 770, 114, 'Данные из останков', 'части роботов', 'salvage', 'Извлечение данных из останков роботов в породе. (части роботов пока не добавлены в игру)');
  kn('kart_ruins',   'out', 960, 112, 'Данные из руин', 'пещеры-сцены', 'relic', 'Извлечение данных из руин — пещер-сцен с ассетами. (в разработке)');
  kn('kart_wake',    'out', 790, 130, 'Пробуждение города', 'нейтральный город', 'rune', 'По данным о городе будит нейтральный город для извлечения данных. (в разработке)');
  kn('kart_hackcity','out', 1040, 130, 'Взлом нейтрального города', 'переговоры', 'contact', 'Взлом нейтрального города через прогресс-бар «переговоров». ВЕНЕЦ ветви МИР — самый внешний узел. (в разработке)');
  kn('kart_stun',    'mid', 540, 144, 'Взлом юнитов', 'стан в радиусе', 'resonance', 'По активации тормозит все вражеские юниты в радиусе от юнита на время. Кулдаун и радиус — в улучшениях. (в разработке)');
  kn('kart_stealth', 'out', 770, 148, 'Стелс-модуль', 'невидимость', 'obsidian', 'Взлом всех вражеских юнитов на экране — они «не видят» юнит. Кулдаун — в улучшениях. (в разработке)');
  kn('kart_jam',     'out', 1000, 151, 'Взлом диких городов', 'замедляет волны', 'quiet', 'Замедляет фазы волн врагов диких городов. (в разработке)');
  edges.push(['core', 'kart_hub', 'wire']);
  edges.push(['kart_hub', 'kart_data', 'wire'], ['kart_hub', 'kart_stun', 'wire']);
  edges.push(['kart_data', 'kart_wreck', 'wire'], ['kart_wreck', 'kart_ruins', 'wire']);
  edges.push(['kart_data', 'kart_wake', 'wire'], ['kart_wake', 'kart_hackcity', 'wire']);
  edges.push(['kart_stun', 'kart_stealth', 'wire'], ['kart_stealth', 'kart_jam', 'wire']);

  // ── ОРАНЖЕВАЯ ветка ПЕЧАТЬ СТРУКТУР (sector 4, верх-лево, центр ~191°): кастомная форма. Хаб-ПЕЧАТАЮЩИЙ
  // ТРЮМ открывает МОДУЛЬ ПЕЧАТИ + стартовый пассив (стена/шипы) → 4 ЛЕЙНА: ТУРЕЛИ (пулемёт→СВЧ→рейлган) ·
  // КОНТРОЛЬ (ЭМИ→глушилка→отталкиватель) · СНАБЖЕНИЕ (батарея→ремонт) · ЭКОНОМИКА (ускорение→удешевление,
  // ОТДЕЛЬНАЯ ветка от хаба). ОДИН УЗЕЛ — ОДИН ОБЪЕКТ: каждый узел лейна открывает РОВНО ОДНУ структуру (гейт
  // `STRUCT_UNLOCK` в constants → `printTypes` в print.js); экономика модифицирует `PRINT_SPEED_FACTOR`/
  // `PRINT_COST_FACTOR` и НЕ даёт чертежей. ⚠️ РАСКЛАДКА: окно ~160°–217° зажато между МИР (снизу-слева,
  // ~112–151°) и буровым веером ЮНИТ (сверху-слева, до 224°=−136°). Лейны держим РАЗДЕЛЁННЫМИ по углу (НЕ
  // сводим к 180° — иначе глубокие концы соседних лейнов слипаются); проверено валидатором против ВСЕГО графа.
  const V = META_SECTORS[4];
  const vn = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 4, accent: V.accent, sys: V.sys, slabel: V.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  vn('vault_hub',     'hub', 360, 190, 'Печатающий трюм', 'печать + пассив', 'printer', 'Открывает МОДУЛЬ ПЕЧАТИ (доп-слот) и стартовый пассив — СТЕНУ и ШИПЫ, так что принтер строит сразу после анлока. Вход в ветвь СТРУКТУР.');
  vn('vault_mg',      'mid', 590, 162, 'Турель-пулемёт', 'частый огонь', 'blades', 'Открывает чертёж активной турели-пулемёта: частый слабый огонь по врагам в радиусе. База линии ТУРЕЛЕЙ.');
  vn('vault_mw',      'out', 860, 166, 'Турель-СВЧ', 'конусный урон', 'detector', 'Открывает чертёж СВЧ-эмиттера: конусный непрерывный урон по всем врагам в секторе.');
  vn('vault_rail',    'out', 1110, 170, 'Турель-рейлган', 'дальний залп', 'bomb', 'Открывает чертёж рельсовой турели: редкий мощный дальний выстрел. Венец линии ТУРЕЛЕЙ, дорогая.');
  vn('vault_emp',     'mid', 680, 176, 'ЭМИ-ловушка', 'стан в радиусе', 'resonance', 'Открывает чертёж ЭМИ-ловушки: оглушает всех врагов в радиусе по кулдауну. База линии КОНТРОЛЯ.');
  vn('vault_jam',     'out', 940, 181, 'Глушилка', 'замедление', 'quiet', 'Открывает чертёж глушилки: непрерывно замедляет врагов в радиусе вокруг себя.');
  vn('vault_repulse', 'out', 1100, 186, 'Отталкиватель', 'толчок врагов', 'stab', 'Открывает чертёж отталкивателя: импульсом отбрасывает врагов от линии обороны по кулдауну. Венец линии КОНТРОЛЯ.');
  vn('vault_batt',    'mid', 720, 198, 'Батарея', 'релей энергии', 'sun', 'Открывает чертёж батареи: буфер-релей энергии, питает активные структуры вдали от юнита. База линии СНАБЖЕНИЯ.');
  vn('vault_repair',  'out', 960, 194, 'Ремонт-дрон', 'чинит структуры', 'wrench', 'Открывает чертёж ремонт-дрона: лечит соседние структуры в радиусе. Венец линии СНАБЖЕНИЯ.');
  vn('vault_speed',   'mid', 640, 218, 'Параллельная печать', '−30% времени', 'fast', 'Печать всех структур на 30% быстрее — короче окно уязвимости при возведении под атакой. Отдельная ветка ЭКОНОМИКИ.');
  vn('vault_cost',    'out', 920, 210, 'Утилизатор-конвейер', '−25% к цене', 'coin', 'Ресурсная цена всех структур на 25% ниже — окупается на масштабе сети из десятка построек. Венец ЭКОНОМИКИ.');
  edges.push(['core', 'vault_hub', 'wire']);
  edges.push(['vault_hub', 'vault_mg', 'wire'], ['vault_mg', 'vault_mw', 'wire'], ['vault_mw', 'vault_rail', 'wire']);
  edges.push(['vault_hub', 'vault_emp', 'wire'], ['vault_emp', 'vault_jam', 'wire'], ['vault_jam', 'vault_repulse', 'wire']);
  edges.push(['vault_hub', 'vault_batt', 'wire'], ['vault_batt', 'vault_repair', 'wire']);
  edges.push(['vault_hub', 'vault_speed', 'wire'], ['vault_speed', 'vault_cost', 'wire']);   // ЭКОНОМИКА — отдельная ветка от хаба

  // Кольцо ХАБОВ убрано: из ЯДРА и так запитывается каждый хаб (core→hub wire) → поперечные связи между
  // ветками бессмысленны (только путали раскладку). Кольцо внешних — только среди СТАНДАРТНЫХ секторов (гард).
  for (let i = 1; i < META_SECTORS.length - 1; i++) {
    const a = META_SECTORS[i].id + '_o2', b = META_SECTORS[i + 1].id + '_o0';
    if (nodes.some((n) => n.id === a) && nodes.some((n) => n.id === b)) edges.push([a, b, 'ring']);
  }

  // Капстоун ПРОТОКОЛ ВОСХОЖДЕНИЯ (перенос модуля между забегами) временно УБРАН из юнита —
  // вернём в ветку ЯДРО/ПРОБУЖДЕНИЕ при её проработке (там он по смыслу: правила забега/смерти).
  return { nodes, edges };
}
// Валидатор раскладки: ловит три класса нарушений правил (spec_meta.md «Правила размещения») и
// ВОРЧИТ в консоль — чтобы правка координат сразу было видно, что узел встал плохо. Чистый, без сайд-
// эффектов на граф. Возвращает список нарушений (для тестов через eval).
function _metaValidateLayout(nodes, edges) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n])), bad = [];
  let minD = Infinity, minPair = '';
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < minD) { minD = d; minPair = a.id + '~' + b.id; }
    if (d < META_LAYOUT.minDist) bad.push(`НАЛОЖЕНИЕ ${a.id}~${b.id}: ${d | 0}px < ${META_LAYOUT.minDist}`);
  }
  for (const n of nodes) {           // в холсте (с учётом радиуса узла; подпись висит ниже — кромка снизу мягче)
    const rad = META_RADIUS[n.kind] || 30, m = META_LAYOUT.margin;
    if (n.x - rad < m || n.y - rad < m)   // только МИН-сторона (лево/верх): по МАКС холст авто-растёт (META_CW/CH), клипа нет
      bad.push(`ЗА КРОМКОЙ ${n.id}: (${n.x | 0},${n.y | 0}) — уходит за лево/верх (там холст не растёт)`);
  }
  const rOf = (n) => Math.hypot(n.x - MX, n.y - MY);   // дочерний по wire идёт НАРУЖУ (радиус ≥ родителя)
  for (const [a, b, k] of edges) {
    if (k !== 'wire') continue; const pa = byId[a], pb = byId[b];
    if (pa && pb && pa.kind !== 'core' && rOf(pb) < rOf(pa) - 1) bad.push(`ВТЯГИВАНИЕ ${a}→${b}: r ${rOf(pa) | 0}→${rOf(pb) | 0}`);
  }
  if (bad.length) console.warn('[META раскладка] нарушений:', bad.length, '\n' + bad.join('\n') + `\n(мин. расстояние: ${minD | 0}px ${minPair})`);
  return bad;
}

const _MG = _metaBuildGraph();
const META_NODES = _MG.nodes, META_EDGES = _MG.edges;
// РАЗМЕР ХОЛСТА авто-подгоняется под узлы (+паддинг): добавляешь узел за прежние MW/MH — холст растёт сам,
// SVG/мир не клипают (дёшево: один проход по узлам). Центр (_polar) остаётся MX/MY → рост идёт вправо/вниз.
const META_PAD = 140;
let _metaCW = MW, _metaCH = MH;
for (const _n of META_NODES) { const _r = (META_RADIUS[_n.kind] || 30) + META_PAD; if (_n.x + _r > _metaCW) _metaCW = _n.x + _r; if (_n.y + _r > _metaCH) _metaCH = _n.y + _r; }
const META_CW = Math.ceil(_metaCW), META_CH = Math.ceil(_metaCH);
_metaValidateLayout(META_NODES, META_EDGES);
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
// Узел открывает НОВУЮ структуру для печати? (id есть среди значений STRUCT_UNLOCK) — для тега «+СТРУКТУРА».
function metaUnlocksStruct(id) { return typeof STRUCT_UNLOCK !== 'undefined' && Object.values(STRUCT_UNLOCK).includes(id); }
