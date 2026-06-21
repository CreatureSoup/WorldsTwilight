'use strict';

// Fx — лёгкие визуальные частицы, не влияющие на логику. Сейчас одно событие:
// «сдача груза» — единицы ресурса вылетают из юнита вверх и тают.
const FX_GRAV = TILE * 3;   // px/сек² — лёгкое притяжение (вылет дугой)

class Fx {
  constructor() { this.parts = []; }
  // types — массив типов сданных ресурсов (по фигурке на единицу)
  burst(px, py, types) {
    for (let i = 0; i < types.length; i++) {
      this.parts.push({
        px: px + (Math.random() - 0.5) * TILE * 0.4, py,
        vx: (Math.random() - 0.5) * TILE * 0.9,
        vy: -(TILE * 2.6 + Math.random() * TILE * 1.6),
        type: types[i], life: 0, ttl: 0.55 + Math.random() * 0.25,
      });
    }
  }
  // Лечение юнита: зелёный «+», всплывающий и тающий (вызывать на ТИКАХ восстановления HP).
  heal(px, py) {
    this.parts.push({
      kind: 'heal', px: px + (Math.random() - 0.5) * TILE * 0.5, py: py + (Math.random() - 0.5) * TILE * 0.25,
      vx: (Math.random() - 0.5) * TILE * 0.25, vy: -(TILE * 1.1 + Math.random() * TILE * 0.4),
      grav: FX_GRAV * 0.2, life: 0, ttl: 0.6,                 // лёгкая гравитация → мягкий подъём, не дуга
    });
  }
  update(dt) {
    for (const p of this.parts) { p.life += dt; p.px += p.vx * dt; p.py += p.vy * dt; p.vy += (p.grav != null ? p.grav : FX_GRAV) * dt; }
    this.parts = this.parts.filter((p) => p.life < p.ttl);
  }
  clear() { this.parts.length = 0; }
}
