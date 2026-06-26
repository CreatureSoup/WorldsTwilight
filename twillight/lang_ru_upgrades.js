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
    current: (val) => 'СЕЙЧАС: ' + val,     // val = tr.fmt(...) (DATA из upgrades.js)
    maxSuffix: ' · MAX',
    cellLocked: 'ЗАКРЫТО',
    cellMemNet: 'СЕТЬ ПАМЯТИ',
    level: (k) => 'УР ' + k,
  },
});
