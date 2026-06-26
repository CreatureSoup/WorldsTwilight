'use strict';

// СЛОВАРЬ RU — DATA-метки из constants.js: имена врагов/ресурсов/структур/модулей/корпусов,
// технологии артефактов, директивы сессии, подсказки глубины, метка клавиши. Строки — вербатим.
// ⚠️ Грузится ДО constants.js (его DATA-таблицы ENEMY_RU/MODULE_DEFS/… читают STR на момент
// загрузки). Сам файл НЕ ссылается на константы — только чистые строки (см. spec_i18n.md, реордер).

i18nRegister('ru', {
  enemy: {
    name: { digger: 'КОПАТЕЛЬ', collector: 'СОБИРАТЕЛЬ', raider: 'РЕЙДЕР', hunter: 'ОХОТНИК', hacker: 'ВЗЛОМЩИК', sniper: 'СНАЙПЕР' },
    fallback: 'ЮНИТ',   // скан без типа (datascan/predict)
  },
  resource: {
    name: { iron: 'Железо', organic: 'Органика', crystal: 'Кристалл' },
  },
  structure: {
    name: {
      wall: 'Стена', spike: 'Шипы', turret_mg: 'Турель-пулемёт', turret_rail: 'Турель-рейлган',
      turret_mw: 'Турель-СВЧ', emp: 'ЭМИ-ловушка', repulsor: 'Отталкиватель', jammer: 'Глушилка',
      repair_drone: 'Ремонт-дрон', battery: 'Батарея', siege_tower: 'Осадная башня',
    },
  },
  module: {
    name: {
      drill: 'Бур', drill_impulse: 'Импульсный бур', drill_kinetic: 'Кинетический бур', drill_screw: 'Винтовой бур',
      engine: 'Двигатель', scanner: 'Сканер', scanner_radar: 'Радар-сканер', scanner_echo: 'Эхо-сканер',
      cargo: 'Трюм', cargo_repair: 'Ремонтный трюм', shield: 'Экран помех', print: 'Модуль печати', mod_hack: 'Модуль взлома',
      mod_siege: 'Осадный модуль',
    },
  },
  hull: {
    name: { scout: 'Каркас «Скиталец»', core: 'Ядро «Тор»' },
  },
  tech: {
    grav_dampen: { name: 'ГРАВИ-ДЕМПФЕР', desc: 'Мягкое падение: меньше урона от срывов и валунов.' },
    echo_drill:  { name: 'ЭХО-БУР',        desc: 'Бур изредка пробивает соседний тайл «эхом».' },
    ablative:    { name: 'АБЛЯТИВ-БРОНЯ',   desc: 'Первый удар за вылазку поглощается бронёй.' },
    data_leech:  { name: 'ДАТА-ПИЯВКА',     desc: 'Скан серверов и врагов идёт заметно быстрее.' },
    core_surge:  { name: 'РЕАКТОР-СУРЖ',    desc: 'Реактор юнита мощнее питает структуры и город.' },
  },
  goal: {
    origin:  { short: 'ЗЕРНО ИСТИНЫ',   text: 'НАЙДИ ЗЕРНО ИСТИНЫ — КТО ТЫ' },
    cluster: { short: 'СПЯЩИЙ КЛАСТЕР', text: 'ПРОБУДИ СПЯЩИЙ КЛАСТЕР ИИ' },
    threat:  { short: 'УГРОЗА ГОРОДУ',  text: 'УСТРАНИ УГРОЗУ ГОРОДУ' },
  },
  hint: {
    depth: { up: 'ВВЕРХ', traces: 'СЛЕДЫ ЛЮДЕЙ', ruins: 'РУИНЫ', surface: 'ПОВЕРХНОСТЬ' },
  },
  input: {
    space: 'ПРОБЕЛ',
  },
});
