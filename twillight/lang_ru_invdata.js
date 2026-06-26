'use strict';

// СЛОВАРЬ RU — DATA-метки экрана СБОРКИ (inventory.js): подписи СЛОТОВ (SLOT_META, ед.ч.) и
// заголовки ГАЛЕРЕИ по категориям (мн.ч.). Сливается с основным словарём через
// i18nRegister/i18nDeepMerge — неймспейс `inventory.category` дополняет существующий `inventory`.
// Имена ВАРИАНТОВ модулей — DATA из constants.js (MODULE_DEFS), мигрируются отдельной волной.

i18nRegister('ru', {
  inventory: {
    category: {
      drill:   { slot: 'БУР',      gallery: 'БУРЫ' },
      engine:  {                   gallery: 'ДВИГАТЕЛИ' },
      scanner: { slot: 'СКАНЕР',   gallery: 'СКАНЕРЫ' },
      cargo:   { slot: 'ТРЮМ',     gallery: 'ТРЮМЫ' },
      aux:     { slot: 'ДОП-СЛОТ', gallery: 'ДОП-СЛОТ' },
    },
  },
});
