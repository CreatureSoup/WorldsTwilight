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
  // Удар-фидбэк: короткий разлёт искр-стриков от точки попадания (цвет по источнику: враг тёплый, юнит красный).
  // dir (опц., unit-вектор «от источника урона») → искры летят КОНУСОМ по нему (брызги в сторону, противоположную удару);
  // без dir — круговой разлёт. Стрик в render тянется НАЗАД по скорости → шлейф указывает на точку удара.
  hit(px, py, color, n, dir) {
    n = n || 5;
    const base = dir ? Math.atan2(dir.y, dir.x) : null;
    for (let i = 0; i < n; i++) {
      const a = base != null ? base + (Math.random() - 0.5) * 1.7 : Math.random() * 6.283;   // конус ±~49° по dir, иначе круг
      const sp = TILE * (1.4 + Math.random() * 2.4);
      this.parts.push({
        kind: 'spark', px, py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: color || '#ffd070', grav: FX_GRAV * 0.5, life: 0, ttl: 0.16 + Math.random() * 0.16,
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
