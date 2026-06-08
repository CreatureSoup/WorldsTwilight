'use strict';

// Нестабильная порода → падающие валуны. Логика отдельно от рендера (render_falling.js).
// Триггер — `world.unstableTriggers` (setAir кладёт туда клетку СВЕРХУ выкопанной, если она
// нестабильная). Клетка «дрожит» UNSTABLE_FALL_DELAY сек (телеграф), затем срывается валуном:
// setAir на ней (цепочка вверх), а сам валун летит вниз с гравитацией, бьёт юнита (раз за валун)
// и при ударе о первую твёрдую породу РАЗБИВАЕТСЯ на мелкие камни (debris) и ПРОПАДАЕТ (не оставляет породу).
class FallingRocks {
  constructor() {
    this.blocks = [];                 // активные валуны {tx, py, vy, hit}
    this.pending = new Map();         // клетки в фазе «дрожит»: key = y*MAP_W+x → {x, y, t}
    this.debris = [];                 // осколки после удара {x, y, vx, vy, size, life, max, rot, vr}
  }
  clear() { this.blocks.length = 0; this.pending.clear(); this.debris.length = 0; }

  // Валун ударился — разлёт мелких камней из его центра (визуально; коллизий нет, быстро тают).
  _shatter(tx, topY) {
    const cx = (tx + 0.5) * TILE, cy = topY + TILE * 0.5;
    const n = 7 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      this.debris.push({
        x: cx + (Math.random() - 0.5) * TILE * 0.55, y: cy + (Math.random() - 0.5) * TILE * 0.4,
        vx: Math.cos(a) * (40 + Math.random() * 130), vy: -30 - Math.random() * 150,   // разлёт врозь + подскок вверх
        size: 2 + Math.random() * 4, life: 0.3 + Math.random() * 0.4, max: 0.7,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  _unsupported(world, x, y) { return !isSolid(world.tileAt(x, y + 1)); }

  update(dt, world, unit) {
    if (!world) return;

    // 1) новые потерявшие опору нестабильные клетки → в фазу «дрожит»
    while (world.unstableTriggers.length) {
      const c = world.unstableTriggers.pop();
      const t = world.tileAt(c.x, c.y);
      if (t.type !== ROCK || !(t.unstable || t.boulder)) continue;
      if (!this._unsupported(world, c.x, c.y)) continue;
      const key = c.y * MAP_W + c.x;
      if (this.pending.has(key)) continue;
      this.pending.set(key, { x: c.x, y: c.y, t: 0 });
      t.shaking = true;               // телеграф: рендер трещин дрожит
    }

    // 2) тик «дрожащих»: по истечении задержки — срыв (если опоры всё ещё нет)
    for (const [key, p] of this.pending) {
      const t = world.tileAt(p.x, p.y);
      if (t.type !== ROCK || !(t.unstable || t.boulder) || !this._unsupported(world, p.x, p.y)) {
        t.shaking = false; this.pending.delete(key); continue;   // опору вернули / уже выкопали — отмена
      }
      p.t += dt;
      if (p.t < UNSTABLE_FALL_DELAY) continue;
      const boulder = t.boulder, hardness = t.hardness, resource = t.resource;   // запомнить ДО setAir (он чистит тайл)
      t.shaking = false;
      world.setAir(p.x, p.y);          // освобождаем клетку (это же поднимет триггер на клетку выше — цепочка)
      this.blocks.push({ tx: p.x, py: p.y * TILE, vy: 0, hit: false, boulder, hardness, resource });
      this.pending.delete(key);
    }

    // 3) полёт валунов
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      b.vy = Math.min(b.vy + UNSTABLE_GRAVITY * dt, UNSTABLE_MAX_FALL);
      // первая твёрдая порода снизу → валун ляжет в клетку над ней
      let rs = Math.floor(b.py / TILE) + 1;
      while (rs < MAP_H && !isSolid(world.tileAt(b.tx, rs))) rs++;
      const restY = (rs - 1) * TILE;
      b.py = Math.min(b.py + b.vy * dt, restY);

      // урон юниту (один раз за валун): та же колонка + вертикальное перекрытие
      if (!b.hit && unit) {
        const dxp = wrapDeltaPx(unit.px, (b.tx + 0.5) * TILE);
        if (Math.abs(dxp) < TILE * 0.55 && b.py < unit.py + TILE * 0.4 && b.py + TILE > unit.py - TILE * 0.4) {
          const dmin = b.boulder ? BOULDER_DAMAGE_MIN : UNSTABLE_DAMAGE_MIN, dmax = b.boulder ? BOULDER_DAMAGE_MAX : UNSTABLE_DAMAGE_MAX;
          unit.hp -= dmin + Math.floor(Math.random() * (dmax - dmin + 1));   // случайный урон в диапазоне (валун бьёт сильнее)
          b.hit = true;
          if (b.boulder && unit.shove) {   // ВАЛУН отталкивает юнита на соседний свободный тайл
            const ux = unit.tileX, uy = unit.tileY, fx = unit.faceX || 1;
            for (const [cx, cy] of [[ux - fx, uy], [ux + fx, uy], [ux, uy - 1]]) { if (!isSolid(world.tileAt(cx, cy))) { unit.shove(cx, cy); break; } }
          }
        }
      }

      if (b.py >= restY - 0.5) {
        if (b.boulder) world.settleRock(b.tx, rs - 1, b.hardness, b.resource, true);   // ВАЛУН занимает (блокирует) клетку
        else this._shatter(b.tx, restY);                                               // нестабильная → осколки и пропадает
        this.blocks.splice(i, 1);
      }
    }

    // 4) осколки: лёгкая гравитация + затухание
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy += UNSTABLE_GRAVITY * 0.6 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt; d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
  }
}
