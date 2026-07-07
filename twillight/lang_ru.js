'use strict';

// СЛОВАРЬ RU — русские UI-строки (единственный язык сейчас). Регистрируется в i18n (`i18nRegister`), активный язык
// сразу попадает в глобал `STR` (см. i18n.js). Доступ из рендера — ПРЯМОЙ: `STR.menu.title1`; параметризованные —
// ФУНКЦИИ: `STR.menu.stats(best, runs, mt)`. По мере локализации модулей сюда добавляются неймспейсы (см. spec_i18n.md).
// ⚠️ Декоративные серийники (TWILIGHT-WORLD/SEED/SKVERNA — латиница/хекс) НЕ локализуем: это чрома, не текст.

i18nRegister('ru', {
  // ── ГЛАВНОЕ МЕНЮ / ПАУЗА (ui_menu.js) ──
  menu: {
    epochLabel: '// ЦИКЛ СУЩЕСТВОВАНИЯ ИИ',
    tagline: '// ROGUELITE · КОПАЛКА · M0 ──────',
    title1: 'СУМЕРКИ',
    title2: 'МИРА',
    subtitle: 'Ты — ИИ. Принтер ещё работает. Снаружи — скверна и древние города, которые ничего о тебе не знают.',
    directivesHdr: '// ТВОИ ДИРЕКТИВЫ ──────────',
    story1: 'РЕЖИМ',
    story2: 'ИСТОРИИ',
    stats: (best, runs, mt) => `ЛУЧШАЯ ПРОХОДКА: ${best}  ·  ЗАПУСКОВ: ${runs}  ·  БАНК: ${mt} МТ`,
    controls: 'WASD · ВЫБОР   ПРОБЕЛ/ENTER · ПОДТВЕРДИТЬ',
    pauseTag: '// СТОП-КАДР',
    pauseTitle: 'ПАУЗА',
    // Кнопки меню/паузы/финала (рисуются b.label/b.desc в ui_menu.js; геометрия/id — в game.js).
    // ⚠️ desc 'seed · random' (латиница) — декор, не локализуем.
    buttons: {
      start: 'Новый забег',
      progress: 'Прогресс',
      progressDesc: (mt) => 'сеть памяти · ' + mt + ' МТ',
      database: 'База данных',
      databaseDesc: 'кодекс · глоссарий',
      resume: 'Продолжить',
      restart: 'Начать заново',
      mainmenu: 'В главное меню',
      toMenu: 'В меню · ENTER',
    },
  },

  // ── ФИНАЛЬНЫЙ ЭКРАН (ui_menu.drawGameOver). Ключ причины: win | unit | hack | city. ──
  gameover: {
    tag:    { win: '✔ ДИРЕКТИВА · СПЯЩИЙ КЛАСТЕР · 0x0001', threatwin: '✔ ДИРЕКТИВА · УГРОЗА ГОРОДУ · 0x0003', unit: '⚠ КОРПУС УТРАЧЕН · 0xE204', hack: '⚠ ФАЙРВОЛЛ ПРОБИТ · 0xE204', city: '⚠ СВЯЗЬ ПРЕРВАНА · 0xE204' },
    title:  { win: 'ДИРЕКТИВА ВЫПОЛНЕНА', threatwin: 'УГРОЗА УСТРАНЕНА', unit: 'ЮНИТ РАЗРУШЕН', hack: 'ГОРОД ВЗЛОМАН', city: 'СВЯЗЬ ПОТЕРЯНА' },
    sub:    { win: 'Реактор спящего кластера интегрирован в юнит — миссия выполнена.', threatwin: 'Дикие гнёзда подавлены — волны иссякли. База вне опасности.', unit: 'Корпус разрушен — связь с юнитом потеряна.', hack: 'Дикие пробили файрволл — город захвачен.', city: 'Город ушёл в гибернацию — канал связи оборван.' },
    status: { win: 'СТАТУС · ПОБЕДА', threatwin: 'СТАТУС · ЗАЧИСТКА', unit: 'СТАТУС · КОРПУС', hack: 'СТАТУС · ФАЙРВОЛЛ', city: 'СТАТУС · СВЯЗЬ' },
    recalc: (metaName) => '// ПЕРЕСЧЁТ ЗАБЕГА · ' + metaName,
    total: 'ИТОГО ЗА ЗАБЕГ',
    inBank: (n, abbr) => `В БАНКЕ: ${n} ${abbr}`,
    // Метки строк пересчёта (computeMeta в game.js, рисуются r.label в drawGameOver).
    rows: {
      dug: 'ПРОХОДКА',
      resource: 'РЕСУРСЫ',
      data: 'ДАННЫЕ',
      cycle: 'ЦИКЛЫ',
      directive: 'ДИРЕКТИВЫ',
      winBonus: 'ПОБЕДА · КЛАСТЕР',
      threatBonus: 'ПОБЕДА · УГРОЗА',
      contextMult: 'КОНТЕКСТ-РАСШИРЕНИЕ',
    },
  },

  // ── HUD во время забега (hud.js). Декор-серийники (TR-014 и пр.) не локализуем. ──
  hud: {
    navToggle: 'ПУТЬ',
    beaconToggle: 'ГОРОД',
    controls: 'WASD · ХОД/ЛАЗАНЬЕ    УПОР В ПОРОДУ = БУР    ESC · ПАУЗА',
    print: { title: '// ПЕЧАТЬ', button: 'ПЕЧАТЬ', placeHint: 'ЛКМ / ПРОБЕЛ — ПЕЧАТЬ · R — ПОВОРОТ · ESC — ОТМЕНА', printingHint: 'ПЕЧАТЬ… · ESC — ОТМЕНА' },
    cargo: { title: '// ГРУЗ', hoard: 'КОПИМ РЕСУРС', deliver: 'СДАЁМ ГОРОДУ' },
    bank: { title: '// БАНК ГОРОДА' },
    unit: { title: '// ЮНИТ · НОРД', hp: 'HP / КОРПУС', depthLine: (layer, depth, spd) => `${layer} · ГЛУБ ${depth} · ${spd} т/с` },   // depthLine — горячий путь (каждый кадр), как и оригинал — одна строка/кадр
    borer: { title: '// ЩИТЫ-ПРОХОДЧИКИ', counts: (carried, deployed, depleted) => `НЕСУ ${carried} · В ХОДУ ${deployed}` + (depleted ? ` · РАЗРЯД ${depleted}` : '') },
    cycle: (n) => `ЦИКЛ ${n}`,
    directives: { title: '// ТВОИ ДИРЕКТИВЫ' },
    scan: { extracting: 'ИЗВЛЕЧЕНИЕ ДАННЫХ', extracted: 'ДАННЫЕ ИЗВЛЕЧЕНЫ' },
    log: { title: '// ЛОГ СОБЫТИЙ', entry: (cycle, text) => `Ц${cycle} · ${text}`, empty: '— нет событий —' },
    // Имена страт (world.layerName) — первый аргумент depthLine, горячий путь HUD.
    strata: { surface: 'поверхность', rubble: 'завал', ash: 'пепел', rust: 'ржавчина', humus: 'перегной', city: 'город', crust: 'корка', upper: 'верхний', middle: 'средний', deep: 'глубокий' },
    cityUpgradeHint: (key) => '⎵ ' + key + ' — УЛУЧШЕНИЯ ГОРОДА',   // подсказка у базы (⎵ — глиф клавиши)
  },
});
