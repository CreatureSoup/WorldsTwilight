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
// галерея сборки (`render_inventory._invDrawCard`) — так же, иначе откат на спрайт детали категории / иконку.
//
// СОСТАВНОЙ БУР-ЩИТ — ГЛОБАЛЬНЫЕ ключи (не hull-namespaced): `'borer:mount'` (крепление, сзади) +
// `'borer:shield'` (бур-щит, спереди). Их читает render_borer.js (`_shieldBody`) напрямую из PART_SPRITES;
// нет ассета → процедурный фолбэк. Секция редактора — «Бур-щит (составной)».
//
// КАНОНИР «Моно-колесо» — ГЛОБАЛЬНЫЕ ключи: `'wheel:body'` (корпус-кольцо, НЕДВИЖНО+отцентровано) +
// `'wheel:tooth'` (внешние зубья, ВРАЩАЮТСЯ). Читает render_wheel.js напрямую (фолбэк — процедурно). РЕАКТОР-ядро
// и ТУРЕЛЬ — обычные детали блупринта (`'gun:reactor'`/`'gun:turret'`, per-part). Секция редактора — «Канонир: колесо (составное)».
const MODULE_SPRITE_SRC = {
  // пример (закомментирован):
  // 'core:mod:cargo_repair': { url: 'assets/parts/cargo_repair.png', scale: 0.1, offX: 0, offY: 0, rot: 0 },
  // 'borer:mount':  { url: 'assets/parts/borer_mount.png',  scale: 0.1, offX: 0, offY: 0, rot: 0 },
  // 'borer:shield': { url: 'assets/parts/borer_shield.png', scale: 0.1, offX: 0, offY: 0, rot: 0 },
  // 'wheel:body':   { url: 'assets/parts/wheel_body.png',   scale: 0.1, offX: 0, offY: 0, rot: 0 },
  // 'wheel:tooth':  { url: 'assets/parts/wheel_tooth.png',  scale: 0.1, offX: 0, offY: 0, rot: 0 },
};
for (const k in MODULE_SPRITE_SRC) {
  const c = MODULE_SPRITE_SRC[k], im = new Image();
  im.onload = () => setPartSprite(k, im, c.scale, c.offX, c.offY, c.rot);
  im.src = c.url;
}
