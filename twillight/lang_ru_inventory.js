'use strict';

// СЛОВАРЬ RU — экран СБОРКИ ЮНИТА (рендер-хром, render_inventory.js). Сливается с основным
// словарём через i18nRegister/i18nDeepMerge — неймспейс `inventory` дополняет существующий.
// Имена КАТЕГОРИЙ/модулей (бур/двигатель/…) — это DATA из inventory.js/constants, мигрируются
// отдельной волной; здесь только рендер-метки/заголовки/форматтеры карточек.

i18nRegister('ru', {
  inventory: {
    header: {
      kicker: '// СБОРКА ЮНИТА · АКТИВНА',
      title: 'ЧЕРТЁЖ',
      controls: 'ВЫБЕРИ МОДУЛЬ В ГАЛЕРЕЕ — ОН ВСТАНЕТ В СЛОТ · ENTER · В ШАХТУ',
    },
    blueprint: { label: '// ЮНИТ · СКИТАЛЕЦ' },
    callout: { empty: 'МОДУЛЬ НЕ УСТАНОВЛЕН' },
    stats: {
      label: '// СВОДКА',
      hp: 'ХП',
      speed: 'СКОРОСТЬ',
      drill: 'БУР',
      scanner: 'СКАНЕР',
      cargo: 'ГРУЗ',
      speedVal: (spd) => `${spd} т/с`,
      scanVal: (r) => `${r} т`,
    },
    list: { label: '// МОДУЛИ' },
    card: {
      force: (mult) => `СИЛА ×${mult}`,
      speed: (spd) => `${spd} Т/С`,
      radius: (r) => `РАДИУС ${r}`,
      cargo: (cap) => `ГРУЗ ${cap}`,
      installed: '✓ УСТАНОВЛЕН',
    },
    start: {
      go: 'В ШАХТУ ▶',
      missing: (list) => 'УСТАНОВИ: ' + list,
      cat: { drill: 'бур', engine: 'двигатель', scanner: 'сканер', cargo: 'трюм' },
    },
  },
});
