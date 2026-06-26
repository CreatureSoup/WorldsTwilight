'use strict';

// СЕТЬ ПАМЯТИ — данные + граф + состояние мета-прогресса. Структура 1:1 с дизайном
// `meta/project/src/tech_web.jsx` (радиальная PCB-сеть: ядро → 5 секторов, hub+2mid+3out,
// кольцевые кросс-связи, вершина-cap), НО темы/узлы — по списку игрока (где <6 — дострой темат.).
// Рендер/ввод — meta_dom.js. Валюта — МЕГА-ТОКЕНЫ (save.meta), открытия — save.metaUnlocks.

// META_NAME / META_ABBR объявлены в constants.js (не дублируем — иначе двойной const → SyntaxError).
const MW = 2400, MH = 2000;                                    // базовый холст сети (растёт под узлы во все стороны)
let MX = MW / 2, MY = MH / 2;                                  // центр (ЯДРО); сдвигается при авто-росте холста влево/вверх
const _polar = (r, deg) => [MX + r * Math.cos(deg * Math.PI / 180), MY + r * Math.sin(deg * Math.PI / 180)];

// сектора (порядок = по пятиугольнику от верха; cap зависит от сектора 0). accent — цвет дизайна.
const META_SECTORS = [
  { id: 'mast',  label: STR.meta.sector.mast.label,  accent: '#3a7ec8', sys: STR.meta.sector.mast.sys },
  { id: 'print', label: STR.meta.sector.print.label,  accent: '#ff3a22', sys: STR.meta.sector.print.sys },
  { id: 'amb',   label: STR.meta.sector.amb.label,       accent: '#d4a042', sys: STR.meta.sector.amb.sys },
  { id: 'kart',  label: STR.meta.sector.kart.label,         accent: '#8a7ed4', sys: STR.meta.sector.kart.sys },
  { id: 'vault', label: STR.meta.sector.vault.label, accent: '#f08a2a', sys: STR.meta.sector.vault.sys },
];
// узел: [имя, кратко, icon-ключ, описание].  hub + m0,m1 (mid) + o0,o1,o2 (out).
const META_CONTENT = {
  mast: { hub: ['Мастерская', 'каркас ветви', 'wrench', 'Открывает ветвь живучести. Базовый верстак ИИ — обслуживание и защита корпуса.'],
    m0: ['Ремонт-дрон', 'починка вне базы', 'stab', 'Юнит медленно восстанавливает HP вдали от базы.'],
    m1: ['Экран помех I', '−помехи ур.1', 'resonance', 'Слабее помехи интерфейса от радиации.'],
    o0: ['Нанорой', 'починка ×2', 'fast', 'Скорость автопочинки заметно выше.'],
    o1: ['Экран помех II', '−помехи ур.2', 'resonance', 'Ещё тише помехи интерфейса.'],
    o2: ['Экран помех III', '−помехи ур.3', 'resonance', 'Помехи почти подавлены даже у очагов радиации.'] },
  // print (ПЕЧАТЬ ТЕЛ, красная), amb (ГОРОД), kart (МИР), vault (ПЕЧАТЬ СТРУКТУР) — КАСТОМНЫЕ формы (см. `_metaBuildGraph`), здесь не описываются.
  // (Старая «рыбная» заглушка красной ветки удалена — ветвь собрана кастомно ниже, узлы пока без функционала, флаг `wip`.)
};
const META_TC = { hub: 16, mid: 20, out: 32 };   // ×2 от прежних (8/10/16). Модули — дороже (премия ×1.5 пост-проходом); корпуса/жизнь красной — заданы явно по ценности.
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
  nodes.push({ id: 'core', kind: 'core', x: MX, y: MY, name: STR.meta.node.core.name, sub: STR.meta.node.core.sub, icon: 'core', cost: 8, accent: '#f2c878',
    desc: STR.meta.node.core.desc });
  // ── ВСЕ ПЯТЬ секторов — КАСТОМНЫЕ формы (см. ниже): ЮНИТ(0) · ПЕЧАТЬ ТЕЛ(1, красная) · ГОРОД(2) · МИР(3) · ПЕЧАТЬ СТРУКТУР(4).
  //    Прежний стандартный ромб (hub→2mid→3out) больше не используется — `META_CONTENT` оставлен только для справки.

  // ── СИНЯЯ ветка ЮНИТ (sector 0): доп-слот → 3 линии. Буры и сенсоры — ПАРАЛЛЕЛЬНО от
  // своих под-хабов (буровой/сенсорный цех), а не цепочкой. Эффекты модулей — отдельно («начинка»).
  const U = META_SECTORS[0];
  const un = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 0, accent: U.accent, sys: U.sys, slabel: U.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  un('mast_hub', 'hub', 360, -90, STR.meta.node.mast_hub.name, STR.meta.node.mast_hub.sub, 'wrench', STR.meta.node.mast_hub.desc);
  un('mast_drill', 'mid', 560, -122, STR.meta.node.mast_drill.name, STR.meta.node.mast_drill.sub, 'drill', STR.meta.node.mast_drill.desc);
  un('mast_cargo', 'mid', 560, -90, STR.meta.node.mast_cargo.name, STR.meta.node.mast_cargo.sub, 'archive', STR.meta.node.mast_cargo.desc);
  un('mast_hull', 'mid', 750, -90, STR.meta.node.mast_hull.name, STR.meta.node.mast_hull.sub, 'body', STR.meta.node.mast_hull.desc);
  un('mast_rep', 'out', 935, -90, STR.meta.node.mast_rep.name, STR.meta.node.mast_rep.sub, 'wrench', STR.meta.node.mast_rep.desc);
  un('mast_sens', 'mid', 560, -58, STR.meta.node.mast_sens.name, STR.meta.node.mast_sens.sub, 'map', STR.meta.node.mast_sens.desc);
  // Буровой веер: 3 бура по углу от цеха (−122°), ровно разнесены; винтовой — КРАЙНИЙ ЛЕВЫЙ (у него ДВЕ ветви,
  // им нужна ширина): резервы фанятся вверх-влево (−138..−142°), инфо (nav/scan) — вниз-влево В ЗАЗОР между
  // веером и ПЕЧАТЬю (−151..−153°, место даёт авто-рост холста влево). Импульсный — центр (−123°), кинетический —
  // право (−108.5°). Координаты — из констрейнт-солвера (minDist≥197, клиренс провод↔узел≥153, 0 пересечений).
  un('mast_ds', 'out', 880, -137.5, STR.meta.node.mast_ds.name, STR.meta.node.mast_ds.sub, 'stab', STR.meta.node.mast_ds.desc);
  un('mast_ds_b1', 'out', 1085, -138.5, STR.meta.node.mast_ds_b1.name, STR.meta.node.mast_ds_b1.sub, 'queue', STR.meta.node.mast_ds_b1.desc);
  un('mast_ds_b2', 'out', 1280, -141.5, STR.meta.node.mast_ds_b2.name, STR.meta.node.mast_ds_b2.sub, 'queue', STR.meta.node.mast_ds_b2.desc);
  un('mast_ds_nav', 'out', 1115, -151.5, STR.meta.node.mast_ds_nav.name, STR.meta.node.mast_ds_nav.sub, 'map', STR.meta.node.mast_ds_nav.desc);
  un('mast_ds_scan', 'out', 1325, -153, STR.meta.node.mast_ds_scan.name, STR.meta.node.mast_ds_scan.sub, 'detector', STR.meta.node.mast_ds_scan.desc);
  un('mast_di', 'out', 905, -123, STR.meta.node.mast_di.name, STR.meta.node.mast_di.sub, 'bomb', STR.meta.node.mast_di.desc);
  un('mast_di_len', 'out', 1090, -127.5, STR.meta.node.mast_di_len.name, STR.meta.node.mast_di_len.sub(IMPULSE_LEN_NODE), 'detector', STR.meta.node.mast_di_len.desc(IMPULSE_LEN_NODE));
  un('mast_dk', 'out', 880, -108.5, STR.meta.node.mast_dk.name, STR.meta.node.mast_dk.sub, 'blades', STR.meta.node.mast_dk.desc);
  un('mast_dk_max', 'out', 1085, -114.5, STR.meta.node.mast_dk_max.name, STR.meta.node.mast_dk_max.sub, 'bomb', STR.meta.node.mast_dk_max.desc);
  // Сенсорный веер: обнаружение угроз · экран помех · РАДАР (→полный спектр) · ЭХО-СКАНЕР (→дальность).
  // mast_sr (Детектор загрязнения) переехал в ветвь МИР (к Дешифратору). Координаты — констрейнт-солвер (minDist≥173).
  un('mast_sa', 'out', 900, -76, STR.meta.node.mast_sa.name, STR.meta.node.mast_sa.sub, 'quiet', STR.meta.node.mast_sa.desc);
  un('mast_rad', 'out', 905, -65, STR.meta.node.mast_rad.name, STR.meta.node.mast_rad.sub, 'detector', STR.meta.node.mast_rad.desc);
  un('mast_rad_spec', 'out', 1095, -69, STR.meta.node.mast_rad_spec.name, STR.meta.node.mast_rad_spec.sub, 'resonance', STR.meta.node.mast_rad_spec.desc);
  un('mast_ech', 'out', 905, -51, STR.meta.node.mast_ech.name, STR.meta.node.mast_ech.sub, 'bomb', STR.meta.node.mast_ech.desc);
  un('mast_ech_len', 'out', 1095, -47, STR.meta.node.mast_ech_len.name, STR.meta.node.mast_ech_len.sub, 'detector', STR.meta.node.mast_ech_len.desc);
  // mast_sh (Экран помех) ПЕРЕЕХАЛ в ветвь МИР (к Детектору загрязнения) — определён там через kn(). id сохранён.
  edges.push(['core', 'mast_hub', 'wire']);
  edges.push(['mast_hub', 'mast_drill', 'wire'], ['mast_hub', 'mast_cargo', 'wire'], ['mast_hub', 'mast_sens', 'wire']);
  edges.push(['mast_cargo', 'mast_hull', 'wire']);   // линия: доп-слот → улучшение трюма → ремонтный цех → ремонтный трюм
  edges.push(['mast_hull', 'mast_rep', 'wire']);   // ремонт: сперва ЦЕХ (прочность), затем ТРЮМ (модуль)
  edges.push(['mast_drill', 'mast_di', 'wire'], ['mast_drill', 'mast_dk', 'wire'], ['mast_drill', 'mast_ds', 'wire']);
  edges.push(['mast_di', 'mast_di_len', 'wire']);   // импульсный бур → удлинение волны (узел длины луча)
  edges.push(['mast_dk', 'mast_dk_max', 'wire']);   // кинетический бур → тяжёлый боёк (потолок разгона ×3 + ур.3)
  edges.push(['mast_ds', 'mast_ds_b1', 'wire'], ['mast_ds_b1', 'mast_ds_b2', 'wire']);   // винтовой бур → +1 → +1 автономный бур (макс 4)
  edges.push(['mast_ds', 'mast_ds_nav', 'wire'], ['mast_ds_nav', 'mast_ds_scan', 'wire']);   // 2-я ветка винтового: навигация по щитам → сканеры на щитах
  edges.push(['mast_sens', 'mast_sa', 'wire'], ['mast_sens', 'mast_rad', 'wire'], ['mast_sens', 'mast_ech', 'wire']);   // mast_sh переехал в МИР (к Детектору)
  edges.push(['mast_rad', 'mast_rad_spec', 'wire'], ['mast_ech', 'mast_ech_len', 'wire']);   // радар→полный спектр; эхо→дальность волны


  // ── ЖЁЛТАЯ ветка ГОРОД (sector 2, A≈54° вниз-вправо): кастомная форма. Хаб-СЧЁТЧИК → 4 линии:
  // батареи→чарджер→firewall · ремонтный док · НАВИГАЦИЯ→предикт · контуры→регенерация→РЕКОНСТРУКЦИЯ.
  // ⚠️ Высокая сторона ветки (контуры ≈71-76°, нав ≈59°, док 41°) СДВИНУТА вниз от прежних 90/85/80·68/64·47°,
  // чтобы расширить конус соседней ветви МИР. `amb_nav` поднят на бóльший радиус (r672) — иначе развилка от хаба
  // висела на короткой «ноге» провода и не читалась как ветвление. Координаты — констрейнт-солвер (см. ветку МИР).
  const C = META_SECTORS[2];
  const cn = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 2, accent: C.accent, sys: C.sys, slabel: C.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  cn('amb_hub',    'hub', 360, 54, STR.meta.node.amb_hub.name, STR.meta.node.amb_hub.sub, 'coin', STR.meta.node.amb_hub.desc);
  cn('amb_batt',   'mid', 540, 28, STR.meta.node.amb_batt.name, STR.meta.node.amb_batt.sub, 'sun', STR.meta.node.amb_batt.desc);
  cn('amb_charge', 'out', 880, 26, STR.meta.node.amb_charge.name, STR.meta.node.amb_charge.sub, 'fast', STR.meta.node.amb_charge.desc);
  cn('amb_fw',     'out', 1140, 22, STR.meta.node.amb_fw.name, STR.meta.node.amb_fw.sub, 'decode', STR.meta.node.amb_fw.desc);
  cn('amb_dock',   'mid', 660, 41, STR.meta.node.amb_dock.name, STR.meta.node.amb_dock.sub, 'stab', STR.meta.node.amb_dock.desc);
  cn('amb_beacon', 'mid', 672, 58.7, STR.meta.node.amb_beacon.name, STR.meta.node.amb_beacon.sub, 'map', STR.meta.node.amb_beacon.desc);   // МАЯЧОК ГОРОДА: стрелка-указатель (тумблер ГОРОД); от него — путь и предикт
  cn('amb_nav',    'out', 895, 64, STR.meta.node.amb_nav.name, STR.meta.node.amb_nav.sub, 'map', STR.meta.node.amb_nav.desc);
  cn('amb_predict','out', 895, 52, STR.meta.node.amb_predict.name, STR.meta.node.amb_predict.sub, 'detector', STR.meta.node.amb_predict.desc);
  cn('amb_cont',   'mid', 535, 71, STR.meta.node.amb_cont.name, STR.meta.node.amb_cont.sub, 'body', STR.meta.node.amb_cont.desc);
  cn('amb_regen',  'out', 715, 76.1, STR.meta.node.amb_regen.name, STR.meta.node.amb_regen.sub, 'resonance', STR.meta.node.amb_regen.desc);
  cn('amb_recon',  'out', 902, 78.5, STR.meta.node.amb_recon.name, STR.meta.node.amb_recon.sub, 'ascend', STR.meta.node.amb_recon.desc);   // опущен ниже
  edges.push(['core', 'amb_hub', 'wire']);
  edges.push(['amb_hub', 'amb_batt', 'wire'], ['amb_hub', 'amb_dock', 'wire'], ['amb_hub', 'amb_beacon', 'wire'], ['amb_hub', 'amb_cont', 'wire']);
  edges.push(['amb_batt', 'amb_charge', 'wire'], ['amb_charge', 'amb_fw', 'wire']);
  edges.push(['amb_beacon', 'amb_nav', 'wire'], ['amb_beacon', 'amb_predict', 'wire']);   // маячок → {путь, предикт}
  edges.push(['amb_cont', 'amb_regen', 'wire'], ['amb_regen', 'amb_recon', 'wire']);

  // ── ФИОЛЕТОВАЯ ветка МИР (sector 3, A≈126° вниз-влево): кастомная форма, пока ТОЛЬКО СТРУКТУРА (узлы-заглушки,
  // эффекты не подключены). Хаб-ДЕШИФРАТОР → 2 линии: ДАННЫЕ (объём→останки→руины) с ответвлением ГОРОДА
  // (пробуждение→ВЗЛОМ нейтрального — нужны данные о городе) · ВЗЛОМ (юниты→стелс→дикие города). `kart_hackcity` —
  // ВЕНЕЦ: самый дальний по графу (d4) И самый внешний по радиусу. ⚠️ Узлы держим В ХОЛСТЕ (MH=2000): крутые «вниз»
  // углы (~100°) на большом радиусе уезжают за нижнюю кромку → SVG обрезает провод. Эффекты — через `metaHas(id)`.
  const K = META_SECTORS[3];
  const kn = (id, kind, r, deg, name, sub, icon, desc) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 3, accent: K.accent, sys: K.sys, slabel: K.label, x: p[0], y: p[1], name, sub, icon, desc, cost: META_TC[kind] }); };
  kn('kart_hub',     'hub', 360, 128, STR.meta.node.kart_hub.name, STR.meta.node.kart_hub.sub, 'decode', STR.meta.node.kart_hub.desc);
  // 4 линии от Дешифратора: ДЕТЕКТОР (короткий ≈95° + Экран помех, ушёл в зазор между ветками) · ДАННЫЕ (останки→руины,
  // прям. от хаба, ≈113-114° — опущены НИЖЕ радиуса хаба, чтобы развилка читалась явной «ногой», не сливаясь с линком
  // к Объёму) · ГОРОДА-ОТВЕТВЛЕНИЕ (Объём данных→пробуждение, глубже ≈131-133°) · ВЗЛОМ (обезвреж.→юниты→дикие, ≈139-152°).
  // ГОРОДА (wake) СХОДИТСЯ с ВЗЛОМОМ (jam) на `kart_hackcity` — КОНВЕРГЕНЦИЯ (allDeps). МОДУЛЬ ВЗЛОМА открывает ПЕРВЫЙ
  // узел ВЗЛОМА — `kart_defuse`. Координаты — констрейнт-солвер (minDist≥188 — просторно; 0 пересечений; солвер штрафует
  // КОРОТКУЮ «ногу» развилки хаб→ребёнок, чтобы провод явно ветвился; ради простора высокая сторона жёлтой ветки сдвинута).
  // ДЕТЕКТОР (короткая линия): детектор загрязнения → ЭКРАН ПОМЕХ (переехал из ЮНИТ; id mast_sh сохранён)
  kn('mast_sr',      'out', 580, 95, STR.meta.node.mast_sr.name, STR.meta.node.mast_sr.sub, 'detector', STR.meta.node.mast_sr.desc);
  kn('mast_sh',      'out', 790, 95, STR.meta.node.mast_sh.name, STR.meta.node.mast_sh.sub, 'resonance', STR.meta.node.mast_sh.desc);
  // линия ДАННЫЕ (прямо от Дешифратора): данные из останков → данные из руин
  kn('kart_wreck',   'mid', 585, 113.6, STR.meta.node.kart_wreck.name, STR.meta.node.kart_wreck.sub, 'salvage', STR.meta.node.kart_wreck.desc);
  kn('kart_ruins',   'out', 800, 113.5, STR.meta.node.kart_ruins.name, STR.meta.node.kart_ruins.sub, 'relic', STR.meta.node.kart_ruins.desc);
  // ответвление ГОРОДА (Объём данных → пробуждение → взлом города); сходится с ВЗЛОМОМ на hackcity
  kn('kart_data',    'mid', 735, 132.7, STR.meta.node.kart_data.name, STR.meta.node.kart_data.sub, 'archive', STR.meta.node.kart_data.desc);
  kn('kart_wake',    'out', 950, 131.7, STR.meta.node.kart_wake.name, STR.meta.node.kart_wake.sub, 'rune', STR.meta.node.kart_wake.desc);
  // линия ВЗЛОМ (от Дешифратора): обезвреживание (ОТКРЫВАЕТ модуль взлома) → взлом юнитов (+стелс) → взлом диких
  kn('kart_defuse',  'mid', 580, 143.2, STR.meta.node.kart_defuse.name, STR.meta.node.kart_defuse.sub, 'decode', STR.meta.node.kart_defuse.desc);
  kn('kart_stun',    'out', 815, 145.5, STR.meta.node.kart_stun.name, STR.meta.node.kart_stun.sub, 'resonance', STR.meta.node.kart_stun.desc);
  kn('kart_stealth', 'out', 1075, 151.6, STR.meta.node.kart_stealth.name, STR.meta.node.kart_stealth.sub, 'obsidian', STR.meta.node.kart_stealth.desc);
  kn('kart_jam',     'out', 1035, 141.5, STR.meta.node.kart_jam.name, STR.meta.node.kart_jam.sub, 'quiet', STR.meta.node.kart_jam.desc);
  // АПГРЕЙД саботажа: вместо замедления — полное ПОДАВЛЕНИЕ дикого гнезда (директива «устрани угрозу»). Реализован — hack.js.
  kn('kart_breach',  'out', 1280, 148, STR.meta.node.kart_breach.name, STR.meta.node.kart_breach.sub, 'bomb', STR.meta.node.kart_breach.desc);
  // ВЕНЕЦ: КОНВЕРГЕНЦИЯ — требует «Пробуждение города» И «Взлом диких городов» (allDeps)
  kn('kart_hackcity','out', 1205, 137.2, STR.meta.node.kart_hackcity.name, STR.meta.node.kart_hackcity.sub, 'contact', STR.meta.node.kart_hackcity.desc);
  nodes.find((x) => x.id === 'kart_hackcity').allDeps = ['kart_wake', 'kart_jam'];   // КОНВЕРГЕНЦИЯ: доступен только при ОБОИХ родителях (metaAvail)
  ['kart_stun', 'kart_stealth'].forEach((id) => { const nn = nodes.find((x) => x.id === id); if (nn) nn.wip = true; });   // НЕТ ФУНКЦИОНАЛА → баннер «В РАЗРАБОТКЕ»; kart_jam РЕАЛИЗОВАН (контр-взлом диких, hack.js) → снят с wip
  edges.push(['core', 'kart_hub', 'wire']);
  edges.push(['kart_hub', 'mast_sr', 'wire'], ['mast_sr', 'mast_sh', 'wire']);   // ДЕТЕКТОР → Экран помех
  edges.push(['kart_hub', 'kart_wreck', 'wire'], ['kart_wreck', 'kart_ruins', 'wire']);   // ДАННЫЕ (прямо от хаба)
  edges.push(['kart_hub', 'kart_data', 'wire'], ['kart_data', 'kart_wake', 'wire'], ['kart_wake', 'kart_hackcity', 'wire']);   // ГОРОДА-ответвление
  edges.push(['kart_hub', 'kart_defuse', 'wire'], ['kart_defuse', 'kart_stun', 'wire'], ['kart_stun', 'kart_stealth', 'wire'], ['kart_stun', 'kart_jam', 'wire']);   // ВЗЛОМ
  edges.push(['kart_jam', 'kart_breach', 'wire']);   // саботаж → апгрейд нейтрализации
  edges.push(['kart_jam', 'kart_hackcity', 'wire']);   // 2-й родитель hackcity (конвергенция)

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
  vn('vault_hub',     'hub', 360, 190, STR.meta.node.vault_hub.name, STR.meta.node.vault_hub.sub, 'printer', STR.meta.node.vault_hub.desc);
  vn('vault_mg',      'mid', 590, 162, STR.meta.node.vault_mg.name, STR.meta.node.vault_mg.sub, 'blades', STR.meta.node.vault_mg.desc);
  vn('vault_mw',      'out', 860, 166, STR.meta.node.vault_mw.name, STR.meta.node.vault_mw.sub, 'detector', STR.meta.node.vault_mw.desc);
  vn('vault_rail',    'out', 1110, 170, STR.meta.node.vault_rail.name, STR.meta.node.vault_rail.sub, 'bomb', STR.meta.node.vault_rail.desc);
  vn('vault_emp',     'mid', 680, 176, STR.meta.node.vault_emp.name, STR.meta.node.vault_emp.sub, 'resonance', STR.meta.node.vault_emp.desc);
  vn('vault_jam',     'out', 940, 181, STR.meta.node.vault_jam.name, STR.meta.node.vault_jam.sub, 'quiet', STR.meta.node.vault_jam.desc);
  vn('vault_repulse', 'out', 1100, 186, STR.meta.node.vault_repulse.name, STR.meta.node.vault_repulse.sub, 'stab', STR.meta.node.vault_repulse.desc);
  vn('vault_batt',    'mid', 720, 198, STR.meta.node.vault_batt.name, STR.meta.node.vault_batt.sub, 'sun', STR.meta.node.vault_batt.desc);
  vn('vault_repair',  'out', 960, 194, STR.meta.node.vault_repair.name, STR.meta.node.vault_repair.sub, 'wrench', STR.meta.node.vault_repair.desc);
  vn('vault_speed',   'mid', 640, 218, STR.meta.node.vault_speed.name, STR.meta.node.vault_speed.sub, 'fast', STR.meta.node.vault_speed.desc);
  vn('vault_cost',    'out', 920, 207, STR.meta.node.vault_cost.name, STR.meta.node.vault_cost.sub, 'coin', STR.meta.node.vault_cost.desc);   // чуть ниже
  vn('vault_courier', 'out', 1140, 199, STR.meta.node.vault_courier.name, STR.meta.node.vault_courier.sub, 'map', STR.meta.node.vault_courier.desc);   // чуть выше
  // ОСАДНАЯ БАШНЯ (реализована, structures.js): венец турельного лейна после рейлгана — осада дикого гнезда.
  vn('vault_siege',   'out', 1300, 172, STR.meta.node.vault_siege.name, STR.meta.node.vault_siege.sub, 'bomb', STR.meta.node.vault_siege.desc);
  nodes.find((x) => x.id === 'vault_courier').wip = true;   // структура ещё не построена → баннер «В РАЗРАБОТКЕ»
  edges.push(['core', 'vault_hub', 'wire']);
  edges.push(['vault_hub', 'vault_mg', 'wire'], ['vault_mg', 'vault_mw', 'wire'], ['vault_mw', 'vault_rail', 'wire'], ['vault_rail', 'vault_siege', 'wire']);
  edges.push(['vault_hub', 'vault_emp', 'wire'], ['vault_emp', 'vault_jam', 'wire'], ['vault_jam', 'vault_repulse', 'wire']);
  edges.push(['vault_hub', 'vault_batt', 'wire'], ['vault_batt', 'vault_repair', 'wire']);
  edges.push(['vault_hub', 'vault_speed', 'wire'], ['vault_speed', 'vault_cost', 'wire'], ['vault_cost', 'vault_courier', 'wire']);   // ЭКОНОМИКА — отдельная ветка от хаба (+ курьер-дрон)

  // ── КРАСНАЯ ветка ПЕЧАТЬ ТЕЛ (sector 1, A≈−18°): кастомная форма, ДВА СМЫСЛА. Узлы пока БЕЗ функционала
  //    (`wip` → баннер «В РАЗРАБОТКЕ»; ОПИСАНИЯ — задумка). От хаба «Контракт снабжения»:
  //    • ГОРОД/КОНТРАКТЫ (верх ≈+0..+8°): Рационализация · Энергошлейф→Энергорелеи.
  //    • ИИ/РАЗВИТИЕ (низ ≈−12..−42°): Контекст-расширение→{Усвоение данных, Хроника, Анализ породы} · Оптимизация привода→Толчковые опоры.
  //    • ТЕЛО (центр-глубоко): «Резервное тело» = КОНВЕРГЕНЦИЯ (allDeps Энергорелеи[город] + Контекст-расширение[ИИ]) → корпуса.
  //    Цены ПО ЦЕННОСТИ (тело 64 > корпуса 56 > … > статы 18). Координаты — констрейнт-солвер (minDist≥187 — просторно,
  //    глубже по радиусу; 0 пересечений). ⚠️ Батарейная линия ГОРОДА чуть поднята (amb_batt 24→28 / charge 20→26 / fw 16→22) — освобождает верх красного конуса.
  const PR = META_SECTORS[1];
  const pn = (id, kind, r, deg, name, sub, icon, desc, cost) => { const p = _polar(r, deg); nodes.push({ id, kind, sector: 1, accent: PR.accent, sys: PR.sys, slabel: PR.label, x: p[0], y: p[1], name, sub, icon, desc, cost }); };
  pn('print_hub',   'hub', 360, -18,    STR.meta.node.print_hub.name, STR.meta.node.print_hub.sub, 'archive', STR.meta.node.print_hub.desc, 16);
  // ГОРОД/КОНТРАКТЫ (верх, к ГОРОДУ): рационализация · энергошлейф → энергорелеи
  pn('print_disc',  'mid', 540, 9,      STR.meta.node.print_disc.name, STR.meta.node.print_disc.sub, 'coin', STR.meta.node.print_disc.desc, 30);
  pn('print_disc2', 'out', 720, 13,     STR.meta.node.print_disc2.name, STR.meta.node.print_disc2.sub, 'coin', STR.meta.node.print_disc2.desc, 24);   // рационализация −10%
  pn('print_disc3', 'out', 920, 13,     STR.meta.node.print_disc3.name, STR.meta.node.print_disc3.sub, 'coin', STR.meta.node.print_disc3.desc, 30);   // рационализация −15%
  pn('print_cable', 'mid', 525, -10,    STR.meta.node.print_cable.name, STR.meta.node.print_cable.sub, 'sun', STR.meta.node.print_cable.desc, 40);
  pn('print_cable2','out', 695, -10,    STR.meta.node.print_cable2.name, STR.meta.node.print_cable2.sub, 'sun', STR.meta.node.print_cable2.desc, 28);   // улучшение шлейфа: cap трека → 5
  pn('print_batt',  'out', 790, 1,      STR.meta.node.print_batt.name, STR.meta.node.print_batt.sub, 'contact', STR.meta.node.print_batt.desc, 44);
  // ИИ/РАЗВИТИЕ (низ): контекст-расширение → {усвоение данных, хроника, анализ породы} · оптимизация привода → опоры
  pn('print_mtmod', 'mid', 820, -19,    STR.meta.node.print_mtmod.name, STR.meta.node.print_mtmod.sub, 'rune', STR.meta.node.print_mtmod.desc, 36);
  pn('print_mtdata','out', 982, -23,    STR.meta.node.print_mtdata.name, STR.meta.node.print_mtdata.sub, 'decode', STR.meta.node.print_mtdata.desc, 28);
  pn('print_mtcyc', 'out', 1015, -10.9, STR.meta.node.print_mtcyc.name, STR.meta.node.print_mtcyc.sub, 'queue', STR.meta.node.print_mtcyc.desc, 28);   // сдвинут правее — отлип от линка print_mtmod→print_life
  pn('print_ore',   'out', 840, -31,    STR.meta.node.print_ore.name, STR.meta.node.print_ore.sub, 'detector', STR.meta.node.print_ore.desc, 26);
  pn('print_speed', 'mid', 510, -39,    STR.meta.node.print_speed.name, STR.meta.node.print_speed.sub, 'fast', STR.meta.node.print_speed.desc, 18);   // поднят выше (ветка движения)
  pn('print_jump',  'out', 680, -42,    STR.meta.node.print_jump.name, STR.meta.node.print_jump.sub, 'stab', STR.meta.node.print_jump.desc, 18);   // выше минимально — упирается в линк mast_sens→mast_ech (клиренс ~149)
  // ТЕЛО (центр-глубоко): резервное тело = КОНВЕРГЕНЦИЯ город+ИИ → корпуса
  pn('print_life',  'out', 963, 0.4,    STR.meta.node.print_life.name, STR.meta.node.print_life.sub, 'ascend', STR.meta.node.print_life.desc, 64);
  pn('print_slots', 'out', 1130, 5.2,   STR.meta.node.print_slots.name, STR.meta.node.print_slots.sub, 'resonance', STR.meta.node.print_slots.desc, 56);
  pn('print_gun',   'out', 1130, -4.3,  STR.meta.node.print_gun.name, STR.meta.node.print_gun.sub, 'blades', STR.meta.node.print_gun.desc, 56);
  // ОСАДНЫЙ МОДУЛЬ (реализован, siege.js): после канонира — пробойный луч-копьё по дикому гнезду (директива «устрани угрозу»).
  pn('print_siege', 'out', 1330, -6.5,  STR.meta.node.print_siege.name, STR.meta.node.print_siege.sub, 'bomb', STR.meta.node.print_siege.desc, 40);
  ['print_slots', 'print_gun'].forEach((id) => { const nn = nodes.find((x) => x.id === id); if (nn) nn.wip = true; });   // КОРПУСА — нет в редакторе, делаем отдельно → баннер «В РАЗРАБОТКЕ»; остальные красные узлы реализованы
  nodes.find((x) => x.id === 'print_life').allDeps = ['print_batt', 'print_mtmod'];   // КОНВЕРГЕНЦИЯ: тело требует ГОРОД(Энергорелеи) И ИИ(Контекст-расширение)
  edges.push(['core', 'print_hub', 'wire']);
  edges.push(['print_hub', 'print_disc', 'wire'], ['print_disc', 'print_disc2', 'wire'], ['print_disc2', 'print_disc3', 'wire']);   // ГОРОД: рационализация 5→10→15%
  edges.push(['print_hub', 'print_cable', 'wire'], ['print_cable', 'print_batt', 'wire'], ['print_cable', 'print_cable2', 'wire']);   // ГОРОД: энерго (+улучшение шлейфа)
  edges.push(['print_hub', 'print_mtmod', 'wire'], ['print_mtmod', 'print_mtdata', 'wire'], ['print_mtmod', 'print_mtcyc', 'wire'], ['print_mtmod', 'print_ore', 'wire']);   // ИИ: когниция
  edges.push(['print_hub', 'print_speed', 'wire'], ['print_speed', 'print_jump', 'wire']);   // ИИ: движение
  edges.push(['print_batt', 'print_life', 'wire'], ['print_mtmod', 'print_life', 'wire']);   // КОНВЕРГЕНЦИЯ город+ИИ → тело
  edges.push(['print_life', 'print_slots', 'wire'], ['print_life', 'print_gun', 'wire']);   // корпуса из тела
  edges.push(['print_gun', 'print_siege', 'wire']);   // осадный модуль — после канонира

  // «Модули дороже»: узел, открывающий МОДУЛЬ сборки, +50% к цене (премия по ценности анлока; корпуса/жизнь красной — заданы явно).
  for (const n of nodes) if (typeof metaUnlocksModule === 'function' && metaUnlocksModule(n.id)) n.cost = Math.round(n.cost * 1.5);

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
// РАЗМЕР ХОЛСТА авто-растёт под узлы во ВСЕ стороны (+паддинг META_PAD): bbox узлов (с их радиусом);
// если узел заходит за лево/верх ближе META_PAD — СДВИГАЕМ ВСЕ узлы И центр (MX/MY) внутрь, а холст
// растягиваем под право/низ. Раньше центр был фикс и холст рос только вправо/вниз → синий веер упирался
// в верхнюю кромку (y=0); теперь верх/лево тоже даёт место. SVG/мир не клипают (дёшево: пара проходов).
const META_PAD = 140;
let _minX = Infinity, _minY = Infinity, _maxX = -Infinity, _maxY = -Infinity;
for (const _n of META_NODES) { const _r = META_RADIUS[_n.kind] || 30; _minX = Math.min(_minX, _n.x - _r); _minY = Math.min(_minY, _n.y - _r); _maxX = Math.max(_maxX, _n.x + _r); _maxY = Math.max(_maxY, _n.y + _r); }
const _ox = Math.max(0, META_PAD - _minX), _oy = Math.max(0, META_PAD - _minY);   // сдвиг внутрь от лево/верх
if (_ox || _oy) { for (const _n of META_NODES) { _n.x += _ox; _n.y += _oy; } MX += _ox; MY += _oy; }   // узлы + центр едут вместе → rOf/круги-направляющие консистентны
const META_CW = Math.ceil(Math.max(MW, _maxX + _ox + META_PAD));
const META_CH = Math.ceil(Math.max(MH, _maxY + _oy + META_PAD));
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
  if (n.allDeps) return n.allDeps.every((id) => metaUnlocked(save, id));   // КОНВЕРГЕНЦИЯ: нужны ВСЕ родители (а не любой сосед)
  return META_NEI[n.id].some((id) => metaUnlocked(save, id));
}
// 'owned' | 'avail' | 'visible' (1 шаг за фронтом) | 'hidden'
function metaState(save, n, dist) {
  if (metaUnlocked(save, n.id)) return 'owned';
  if (metaAvail(save, n)) return 'avail';
  const d = (dist || _metaDist(save))[n.id];
  if (n.kind === 'cap' || n.allDeps) return d <= 2 ? 'visible' : 'hidden';   // конвергенция видна и при ОДНОМ владомом родителе (показать «ТРЕБУЕТ оба»)
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
