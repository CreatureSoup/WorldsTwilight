'use strict';

// СЛОВАРЬ RU — прочий рендер мира (render_world.js и др.). Сливается с основным словарём
// через i18nDeepMerge (см. i18n.js, spec_i18n.md). Строки — вербатим из оригинала.

i18nRegister('ru', {
  world: {
    wildCity: 'ДИКИЙ ГОРОД',
    wildDisabled: 'ПОДАВЛЕНО',
    wildSaboted: 'САБОТАЖ',
  },
});
