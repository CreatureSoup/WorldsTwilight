'use strict';

// Cycle — внутренний таймер-фаза мира (макро-эскалация). Идёт реальным временем только
// в режиме playing. С новым циклом мир становится опаснее: дикие города шлют волны
// (копатели → собиратели → разведчики, накоплением — будущие фазы, см. design_cycles.md).
// Отдельный таймер: не связан с гибернацией города и со скверной.
// ⚠️ CYCLE_TIME — в constants.js, секция «ТЮНИНГ ПОДСИСТЕМ» (главная крутилка баланса мира; audit_2026-08).

class Cycle {
  constructor() { this.n = 1; this.t = 0; }
  reset() { this.n = 1; this.t = 0; }
  update(dt) {
    this.t += dt;
    if (this.t >= CYCLE_TIME) { this.t -= CYCLE_TIME; this.n++; }
  }
  timeLeft() { return CYCLE_TIME - this.t; }
  frac() { return this.t / CYCLE_TIME; }
}
