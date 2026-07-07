'use strict';

// Мост редактор→игра. Редактор (`tools/rig_editor.html`, тот же origin) кнопкой «→ В ИГРУ»
// кладёт настроенного юнита в localStorage (`twilight-rig:<hull>`): блупринт + ОБРАБОТАННЫЕ
// спрайты (data:URI). Здесь — применяем на старте: оверрайд `UNIT_DEFS[hull]` + спрайты в
// `PART_SPRITES`. Если пришли спрайты — снимаем временный процедурный дебаг (показываем ассеты).
// Грузится ПОСЛЕ tentacles (тот ставит partsProcedural(true)) и ДО game.
(function () {
  let anySprites = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('twilight-rig:') !== 0) continue;
      const data = JSON.parse(localStorage.getItem(k) || 'null');
      if (!data || !data.def || !data.hull) continue;
      if (typeof UNIT_DEFS !== 'undefined') UNIT_DEFS[data.hull] = data.def;   // блупринт (расстановка ang/rad/ног/сегментов)
      const sprites = data.sprites || {};
      for (const key of Object.keys(sprites)) {
        // ⚠️ borer:* (составной бур-щит) и wheel:* (моно-колесо «Канонир») — ГЛОБАЛЬНЫЕ ключи (render_borer/render_wheel читают ПЛОСКО из PART_SPRITES) → НЕ префиксовать корпусом; остальное — по типу корпуса.
        const glob = key.indexOf('borer:') === 0 || key.indexOf('wheel:') === 0;
        const s = sprites[key], img = new Image(), nsKey = glob ? key : data.hull + ':' + key;
        img.onload = ((kk) => () => { if (typeof setPartSprite === 'function') setPartSprite(kk, img, s.scale, s.offX, s.offY, s.rot); })(nsKey);
        img.src = s.src;
        anySprites = true;
      }
    }
  } catch (e) { console.warn('rigbridge:', e); }
  if (anySprites && typeof partsProcedural === 'function') { partsProcedural(false); if (typeof legikProcedural === 'function') legikProcedural(false); }
})();
