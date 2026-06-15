'use strict';

// Манифест АССЕТОВ МОДУЛЕЙ — спрайт на КОНКРЕТНЫЙ вариант модуля (а не на деталь категории).
// Ключ `'<hull>:mod:<moduleId>'` (или плоский `'mod:<moduleId>'`), значение — как в PART_SPRITE_SRC:
//   { url, scale, offX, offY, rot }. Грузится <script>-ом ПОСЛЕ render_parts, ДО game (через
//   `new Image()` → работает и на file://, в отличие от fetch JSON).
//
// ⚠️ Этот файл ГЕНЕРИРУЕТ редактор рига (tools/rig_editor.html → секция «Модули» → экспорт).
// Руками не правят: добавил модуль в `MODULE_DEFS` → редактор сам покажет карточку → грузишь PNG →
// экспорт перезаписывает этот файл. В репозитории — рабочая заглушка (пустой реестр).
//
// Резолв в игре: `render_parts.partSpriteId` подменяет спрайт детали на `mod:<id>`, если он тут есть;
// галерея сборки (`inventory._drawCard`) — так же, иначе откат на спрайт детали категории / иконку.
const MODULE_SPRITE_SRC = {
  // пример (закомментирован):
  // 'core:mod:cargo_repair': { url: 'assets/parts/cargo_repair.png', scale: 0.1, offX: 0, offY: 0, rot: 0 },
};
for (const k in MODULE_SPRITE_SRC) {
  const c = MODULE_SPRITE_SRC[k], im = new Image();
  im.onload = () => setPartSprite(k, im, c.scale, c.offX, c.offY, c.rot);
  im.src = c.url;
}
