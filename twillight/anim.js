'use strict';

// Аниматор рига: ЧИСТЫЕ функции времени (сек) → смещения узлов. Каналы независимы
// и складываются — поэтому каждый модуль анимируется сам по себе (idle-качание массы,
// пульс реактора, вибрация бура при копании). Не зависит от Canvas.
const ANIM = {
  R() { return (TILE - 8) / 2; },

  // «Дыхание» массы вверх-вниз. `unit.noAnim` (статика) — юнит стоит ровно.
  // Амплитуда меньше при движении/копании (юнит занят).
  bob(t, unit, def) {
    if (unit.noAnim) return 0;
    const amp = unit.drilling ? 0.04 : (unit.state === MOVING ? 0.05 : def.bob.amp);
    return Math.sin(t * def.bob.spd) * this.R() * amp;
  },

  // Яркость ядра реактора (0..1).
  reactorPulse(t) { return 0.5 + 0.5 * Math.sin(t * 3.0); },

  // Вибрация бура вдоль направления взгляда при копании (в px).
  drillWob(t, unit) { return (unit.noAnim || !unit.drilling) ? 0 : Math.sin(t * 30) * this.R() * 0.18; },
};
