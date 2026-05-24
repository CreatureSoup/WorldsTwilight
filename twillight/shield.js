'use strict';

// RadWidget — состояние виджета защиты от скверны. Метафора радиации: ядро,
// сфера-щит вокруг и налетающие извне частицы. Интенсивность фона → частота частиц.
// Стойкость кожуха = доля, которую гасит щит; остальные пробивают в ядро (= урон).
const RW_OUTER = 17, RW_SHIELD = 11, RW_CORE = 4; // радиусы виджета (px)
const RW_SPAWN_PER_RAD = 6;   // частиц/сек на единицу фона
const RW_SPEED = 32;          // px/сек — скорость влёта частицы
const RW_FADE = 0.22;         // сек — гашение частицы у щита

class RadWidget {
  constructor() { this.parts = []; this.acc = 0; this.flash = 0; this.rad = 0; this.resist = 0; }
  reset() { this.parts.length = 0; this.acc = 0; this.flash = 0; }

  update(dt, rad, resist) {
    this.rad = rad; this.resist = resist;
    this.flash = Math.max(0, this.flash - dt * 3);
    const penFrac = rad > 0 ? Math.max(0, (rad - resist) / rad) : 0; // доля «пробоя»
    this.acc += rad * RW_SPAWN_PER_RAD * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.parts.push({ ang: Math.random() * Math.PI * 2, r: RW_OUTER + 4, pen: Math.random() < penFrac, fade: 0 });
    }
    for (const p of this.parts) {
      if (p.fade > 0) { p.fade += dt; continue; }
      p.r -= RW_SPEED * dt;
      if (!p.pen && p.r <= RW_SHIELD) { p.r = RW_SHIELD; p.fade = 1e-4; }      // погашена щитом
      else if (p.pen && p.r <= RW_CORE) { p.dead = true; this.flash = 1; }     // пробила в ядро
    }
    this.parts = this.parts.filter((p) => !p.dead && p.fade < RW_FADE);
  }
}
