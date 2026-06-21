'use strict';

// Прототип щупалец-ног (клавиша T). Теперь DATA-DRIVEN из UNIT_DEFS через общий IK-движок
// `legik.js`: число/длины сегментов и СПРАЙТ на каждый сегмент (`legId:segId`) берутся из
// блупринта — если спрайт загружен, рисуется он, иначе процедурная капсула. Боевую модель
// FK-ног/лазания НЕ трогает (FK-ноги скрыты `opts.hideLegs`, щупальца рисуются поверх).
// `bodyOff` (опора на ноги) — общий для тела и оснований ног.

let _legRig = null, _legUnit = null;
function tentacleBodyOffset() { return _legRig ? { x: (_legRig._anchorX || 0) + _legRig.bodyOff.x, y: (_legRig._anchorY || 0) + _legRig.bodyOff.y } : { x: 0, y: 0 }; }
// Куда тянутся ноги — к РЕАЛЬНОЙ опоре (включая ПОТОЛОК; supportDirOf «вверх» не умеет).
function _tentSupportAngle(unit, world) {
  const s = (dx, dy) => isSolid(world.tileAt(unit.tileX + dx, unit.tileY + dy));
  if (s(0, 1)) return 0;            // пол снизу → ноги вниз
  if (s(0, -1)) return Math.PI;     // ПОТОЛОК сверху → ноги вверх
  if (s(1, 0)) return -Math.PI / 2; // стена справа
  if (s(-1, 0)) return Math.PI / 2; // стена слева
  return 0;
}
function updateTentacles(dt, unit, world) {
  if (!_legRig || _legUnit !== unit) { const us = typeof unitDrawScale === 'function' ? unitDrawScale(unit) : (typeof UNIT_DRAW_SCALE !== 'undefined' ? UNIT_DRAW_SCALE : 1); _legRig = makeLegRig(legConfigsFromUnit(unit, us), us); _legUnit = unit; }
  _legRig.supportAngle = world ? _tentSupportAngle(unit, world) : 0;
  _legRig.crouchT = unit.crouchT || 0;   // присед перед прыжком → корпус ВНИЗ (squash-пружина в legik)
  // ЯКОРЬ ВДОЛЬ «К ОПОРЕ» (пол → вниз, стена → к стене, потолок → вверх): ставим корпус так, чтобы
  // ОТМАСШТАБИРОВАННЫЕ ноги доставали ЛЮБУЮ поверхность. `def.footAnchor` (центр→поверхность в тайлах
  // из тайл-сетки редактора) задаёт дистанцию; Δ компенсирует ФИКС. stand-лифт legik (он в тайлах, не
  // скейлится → мелкий юнит «парил» — и на полу, и на стене/потолке). Дефолт (нет footAnchor) =
  // `0.5+LEGIK_STAND` → Δ=0: старое поведение, scout/некалиброванные НЕ затронуты.
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull];
  const fa = (def && typeof def.footAnchor === 'number') ? def.footAnchor : (0.5 + LEGIK_STAND);
  const sa = _legRig.supportAngle || 0, D = TILE * (0.5 + LEGIK_STAND - fa);   // −up = (cos(π/2+sa), sin(π/2+sa))
  _legRig._anchorX = Math.cos(Math.PI / 2 + sa) * D; _legRig._anchorY = Math.sin(Math.PI / 2 + sa) * D;
  updateLegRig(_legRig, dt, unit.px + _legRig._anchorX, unit.py + _legRig._anchorY, world, null);
}
// Спрайты ассетов ВКЛЮЧЕНЫ в игре (отладочный процедурный режим снят). Где спрайт сегмента/детали
// не загружен — авто-фолбэк на капсулу/процедуру. (`rigbridge` тоже снимает proc при пуше из редактора.)
function drawTentacles(ctx, camera) { if (_legRig) drawLegRig(ctx, _legRig, camera); }
