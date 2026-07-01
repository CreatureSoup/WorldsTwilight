'use strict';

// СЛОВАРЬ RU — DATA-треки апгрейдов (UPG_TRACKS) и гаджеты (UPG_GADGETS) из upgrades.js.
// Доп-часть словаря 'ru' (сливается с lang_ru.js / lang_ru_upgrades.js через i18nDeepMerge, см. i18n.js).
// Доступ из upgrades.js — ПРЯМОЙ: STR.upgrades.tracks.<id>.{label,sub,fmt} / STR.upgrades.gadgets.<id>.{label,sub}.
// ⚠️ fmt с RU-вкраплениями (' с', ' т/с', ' тайл', enum-массивы) — ЗДЕСЬ; чистые ASCII-fmt
//   (×, %, ' HP', '') ОСТАЮТСЯ в upgrades.js. enum-массивы (proj/contours/cityrepair) — поля рядом с fmt.
// ⚠️ lang_ru_upgdata грузится ДО upgrades.js (STR доступен на момент построения UPG_TRACKS).

i18nRegister('ru', {
  upgrades: {
    cityNameDefault: 'База',
    tracks: {
      drill:      { label: 'СИЛА БУРА', sub: 'Скорость прохода породы' },
      impforce:   { label: 'СИЛА УДАРА', sub: 'Пик силы импульс-волны (пробой+урон)',
                    fmt: (v) => 'пик ' + v.toFixed(1) },
      kinpower:   { label: 'КИНЕТИКА', sub: 'Общая сила разгон-бура',
                    fmt: (v) => '×' + v.toFixed(2) + ' старт' },
      kinburst:   { label: 'РАЗГОН ПРОБОЯ', sub: 'Шанс взрывного пробоя кинетики',
                    fmt: (v) => Math.round(v * 100) + '%' },
      screwspeed: { label: 'СКОРОСТЬ ПРОХОДКИ', sub: 'Темп автономных буров-щитов',
                    fmt: (v) => v.toFixed(2) + ' /с' },
      radarcd:    { label: 'ОХЛАЖДЕНИЕ РАДАРА', sub: 'Кулдаун между развёртками',
                    fmt: (v) => Math.max(RADAR_CD_MIN, v).toFixed(1) + ' с' },
      echocd:     { label: 'ВСПЫШКА ЭХО', sub: 'Кулдаун эхо-волны',
                    fmt: (v) => Math.max(ECHO_CD_MIN, v).toFixed(1) + ' с' },
      engine:     { label: 'ПРИВОД', sub: 'Скорость хода',
                    fmt: (v) => v.toFixed(1) + ' т/с' },
      scanner:    { label: 'СЕНСОР', sub: 'Радиус обзора (тайлы)',
                    fmt: (v) => Math.round(v) + ' тайл' },
      cargo:      { label: 'ЁМКОСТЬ', sub: 'Слотов под ресурс' },
      repair:     { label: 'РЕМОНТ', sub: 'Реген HP вне базы за ур.',
                    fmt: (v) => v.toFixed(0) + ' HP/10с' },
      hull:       { label: 'ПРОЧНОСТЬ', sub: 'Максимум HP корпуса' },
      proj:       { label: 'ПРОЖЕКТОР', sub: 'Ширина и яркость луча',
                    levels: ['узкий', 'шире', 'широкий', 'макс. охват'],
                    fmt: (v) => STR.upgrades.tracks.proj.levels[Math.round(v)] || ('ур ' + v) },
      noise:      { label: 'ЭКРАН ПОМЕХ', sub: 'Гасит помехи интерфейса' },
      printreach: { label: 'РАДИУС ПЕЧАТИ', sub: 'Дальность установки (тайлы)',
                    fmt: (v) => Math.round(v) + ' тайл' },
      battery:    { label: 'ЁМКОСТЬ БАТАРЕЙ', sub: 'Время до гибернации',
                    fmt: (v) => Math.round(v) + ' с' },
      charge:     { label: 'СУПЕР-ЧАРДЖЕР', sub: 'Скорость зарядки на базе',
                    fmt: (v) => Math.round(v) + ' с/с' },
      contours:   { label: 'КОНТУРЫ', sub: 'Запас контуров по очереди',
                    rings: ['ВНЕШ.', 'ВНУТР.', 'ЯДРО'],
                    fmt: (v) => v < 1 ? '—' : (STR.upgrades.tracks.contours.rings[(Math.round(v) - 1) % 3] + ' +' + CITY_CONTOUR_HP) },
      cityrepair: { label: 'АВТО-ПОЧИНКА', sub: 'Контуры чинятся сами',
                    levels: ['—', 'ядро', 'ядро + внутр.', 'все контуры'],
                    fmt: (v) => STR.upgrades.tracks.cityrepair.levels[Math.round(v)] || ('ур ' + v) },
      dock:       { label: 'РЕМОНТНЫЙ ДОК', sub: 'Починка юнита на базе',
                    fmt: (v) => Math.round(v) + ' HP/с' },
      cable:      { label: 'ДЛИНА ШЛЕЙФА', sub: 'Дальность энергошлейфа',
                    fmt: (v) => Math.round(v) + ' тайл' },
    },
    gadgets: {
      magnet: { label: 'АВТО-СБОРЩИК', sub: 'Радиус подбора ресурса +1' },
      repair: { label: 'РЕМОНТ-ДРОН', sub: 'Восстанавливает HP вне базы' },
      ping:   { label: 'ОРБИТ-ПИНГ', sub: 'Вскрывает участок карты вокруг (разово)' },
    },
  },
});
