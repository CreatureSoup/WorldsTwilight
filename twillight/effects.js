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
  // Удар-фидбэк (референс — искры от обстрела брони): ПУЧОК быстрых искр-комет от точки попадания, подчинённых ЛИНИИ ОГНЯ.
  // dir (опц., unit-вектор «источник→жертва» = направление огня) делит разлёт на ДВА рикошета: ~55% ВДОЛЬ огня (тугой джет
  // вперёд) + остальные — ВВЕРХ, наклон по горизонт. стороне огня, дугой вниз (гравитация возвращает). Без dir — круговой.
  // Цвет по источнику; `hot` → раскалённое бело-ядро в render. Стрик тянется НАЗАД по скорости → шлейф от точки удара.
  hit(px, py, color, n, dir) {
    n = n || 6;
    const fa = dir ? Math.atan2(dir.y, dir.x) : null;                            // угол линии огня
    const hs = dir ? (dir.x >= 0 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);     // сторона огня → наклон рикошета вверх
    for (let i = 0; i < n; i++) {
      let a, sp, grav, ttl;
      const roll = Math.random();
      if (fa != null && roll < 0.55) {                                           // РИКОШЕТ ПО ОГНЮ: тугой быстрый джет вперёд
        a = fa + (Math.random() - 0.5) * 0.6;
        sp = TILE * (3.4 + Math.random() * 3.2); grav = FX_GRAV * 0.5; ttl = 0.11 + Math.random() * 0.11;
      } else if (fa != null) {                                                   // РИКОШЕТ ВВЕРХ: подброс с наклоном, дугой вниз
        a = -Math.PI / 2 + hs * (0.25 + Math.random() * 0.55);
        sp = TILE * (3.0 + Math.random() * 3.4); grav = FX_GRAV * 1.7; ttl = 0.16 + Math.random() * 0.16;
      } else {                                                                   // без направления — быстрый круговой разлёт
        a = Math.random() * TAU;
        sp = TILE * (2.6 + Math.random() * 2.6); grav = FX_GRAV * 0.9; ttl = 0.12 + Math.random() * 0.13;
      }
      this.parts.push({
        kind: 'spark', px, py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color: color || '#ffd070', grav, life: 0, ttl, hot: Math.random() < 0.55,
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
  // Всплывающая НАДПИСЬ (разовое событие: расщепление кристалла и т.п.): поднимается и тает. Не сюжетная подсказка — короткий поп.
  text(px, py, str, color) {
    this.parts.push({ kind: 'text', px, py, str, color: color || '#fff', vx: 0, vy: -(TILE * 0.9), grav: 0, life: 0, ttl: 1.6 });
  }
  update(dt) {
    for (const p of this.parts) { p.life += dt; p.px += p.vx * dt; p.py += p.vy * dt; p.vy += (p.grav != null ? p.grav : FX_GRAV) * dt; }
    this.parts = this.parts.filter((p) => p.life < p.ttl);
  }
  clear() { this.parts.length = 0; }
}
