'use strict';

// СЛОВАРЬ RU — экран УЛУЧШЕНИЙ (render_upgrades.js). Доп-часть словаря 'ru' (сливается с lang_ru.js
// через i18nDeepMerge, см. i18n.js). Доступ из рендера — ПРЯМОЙ: STR.upgrades.title / STR.upgrades.level(k).
// ⚠️ Имена/sub/fmt самих треков апгрейдов — DATA из upgrades.js (НЕ здесь). Глифы (⚠ ✓ —), латиница
// (WASD/ЛКМ/ESC/MAX) и серийники НЕ локализуем — они остаются в рендер-коде; здесь только текст-метки.

i18nRegister('ru', {
  upgrades: {
    kicker: '// НА БАЗЕ · ПРИНТЕР ОНЛАЙН',
    title: 'УЛУЧШЕНИЯ',
    controls: (city) => `ГОРОД «${city}» · WASD/КЛИК — ВЫБОР · ЗАЖМИ ПРОБЕЛ/ЛКМ — КУПИТЬ · ESC — ЗАКРЫТЬ`,
    lowRes: 'НЕ ХВАТАЕТ РЕСУРСОВ',          // глиф '⚠ ' добавляет рендер
    secUnit: '// ЮНИТ',
    secCity: (city) => '// ГОРОД · ' + city,
    secCityLocked: '// ГОРОД — ЗАКРЫТО · ОТКРОЙ ВЕТКУ «ГОРОД» В СЕТИ ПАМЯТИ',
    secArtifact: '// РЕЛИКТЫ',                // секция апгрейдов установленных артефактов (Батч 6)
    artUnit: { tiles: ' ТАЙЛ', sec: ' С' },   // единицы для fmt трека реликта
    artSub: {                                 // короткий дескриптор: ЧТО улучшает трек реликта
      armor: 'СНИЖЕНИЕ УРОНА', overshield: 'ЁМКОСТЬ ЩИТА', absorb: 'ЗАРЯДЫ ПОГЛОЩЕНИЯ', thorns: 'УРОН ОТВЕТКИ',
      echo_drill: 'ШАНС ЭХА', combat_drill: 'КОНТАКТНЫЙ УРОН/С', jets: 'ЗАПАС ТОПЛИВА', city_shield: 'ЁМКОСТЬ КУПОЛА',
      stun_pulse: 'РАДИУС СТАНА', blast_charge: 'УРОН ВЗРЫВА', nano_repair: 'ОБЪЁМ РЕМОНТА', drill_overdrive: 'ПИК ФОРСАЖА',
      drive_dash: 'ДИСТАНЦИЯ РЫВКА', harpoon: 'ДЛИНА ГАРПУНА', xray: 'ВРЕМЯ ОБЗОРА', data_detector: 'РАДИУС ДЕТЕКТА',
      drone_collector: 'РАДИУС СБОРА', drone_courier: 'ГРУЗ ЗА РЕЙС', drone_battery: 'ЗАРЯД ЗА РЕЙС', drone_scout: 'РАДИУС РАЗВЕДКИ', drone_hacker: 'КУЛДАУН ДЕПЛОЯ',
      synth_iron: 'ЖЕЛЕЗО/ЦИКЛ', synth_organic: 'ОРГАНИКА/ЦИКЛ', synth_crystal: 'КРИСТАЛЛ/ЦИКЛ', converter: 'ОБЪЁМ ВЫХОДА', power_plant: 'СЕК/ОРГАНИКА',
    },
    current: (val) => 'СЕЙЧАС: ' + val,     // val = tr.fmt(...) (DATA из upgrades.js)
    maxSuffix: ' · MAX',
    cellLocked: 'ЗАКРЫТО',
    cellMemNet: 'СЕТЬ ПАМЯТИ',
    level: (k) => 'УР ' + k,
  },
});
