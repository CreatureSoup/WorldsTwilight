'use strict';

// СЛОВАРЬ RU — скан/действия/спец-буры (render_scanners.js и родня). Дополняет основной lang_ru.js:
// под-неймспейс `hud.scan.*` СЛИВАЕТСЯ (i18nDeepMerge) с уже объявленными там extracting/extracted.
// ⚠️ render_actionbar/borer/cable/impulse — чистый FX, UI-текста нет; неймспейсы action/borer тут не нужны.

i18nRegister('ru', {
  hud: {
    scan: {
      radarChip: (resName) => 'РАДАР · ' + resName,   // resName — имя ресурса из RESOURCE_DEFS (DATA, чужой файл)
      radarLabel: 'РАДАР',
      echoLabel: 'ЭХО',
      scanning: 'СКАН…',
      cdSeconds: (n) => n + 'с',
      ready: (keyHint) => 'ГОТОВ ' + keyHint,
    },
  },
});
