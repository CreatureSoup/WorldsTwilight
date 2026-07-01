'use strict';

// Projectiles — лёгкие выстрелы врагов (снайпер). Летят по прямой, бьют юнита при попадании, гаснут о
// породу/по таймауту. Логика без Canvas (рендер — render_enemy.drawShots). Тор по X.
const SHOT_SPEED = 22;   // тайла/сек
const SHOT_DMG_MIN = 40, SHOT_DMG_MAX = 60;   // урон юниту за попадание (рандом в диапазоне)
const SHOT_TTL = 2.0;    // сек макс. полёта
const SHOT_HIT_R = 0.55; // тайлов: радиус попадания по юниту
const SHOT_STRUCT_DMG = 22;   // урон структуре игрока за попадание (фаза 4: снайпер чешет оборону по пути к юниту)
class Projectiles {
  constructor() { this.list = []; }
  clear() { this.list.length = 0; }
  // dmg — опциональный ФИКС. урон по юниту (роботные выстрелы слабее снайпера); без него — рандом SHOT_DMG_MIN..MAX (снайпер).
  fire(fromPx, fromPy, toPx, toPy, dmg) {
    const dx = wrapDeltaPx(toPx, fromPx), dy = toPy - fromPy, d = Math.hypot(dx, dy) || 1;
    this.list.push({ px: fromPx, py: fromPy, ppx: fromPx, ppy: fromPy, vx: dx / d * SHOT_SPEED * TILE, vy: dy / d * SHOT_SPEED * TILE, ttl: SHOT_TTL, dmg: (dmg == null ? null : dmg) });
  }
  // onHit(dmg) вызывается при попадании по юниту (урон применяет game; в debug — без урона). `structs` —
  // список структур игрока (фаза 4): выстрел гасится и бьёт ближайшую структуру на пути (щит для юнита). null в debug.
  update(dt, world, unit, onHit, structs) {
    for (const s of this.list) {
      s.ppx = s.px; s.ppy = s.py;
      s.px = wrapPx(s.px + s.vx * dt); s.py += s.vy * dt; s.ttl -= dt;
      if (isSolid(world.tileAt(wrapX(Math.floor(s.px / TILE)), Math.floor(s.py / TILE)))) { s.ttl = 0; continue; }   // упёрся в породу
      if (structs) {   // структура перехватывает выстрел (кроме стен-породы — те уже отсечены isSolid выше)
        let hit = false;
        for (const st of structs) { if (st.dying || st.def.solid || st.state !== 'active') continue; if (Math.hypot(wrapDeltaPx(st.px, s.px), st.py - s.py) < TILE * SHOT_HIT_R) { st.damage(SHOT_STRUCT_DMG); s.ttl = 0; hit = true; break; } }
        if (hit) continue;
      }
      if (unit) { const ddx = wrapDeltaPx(unit.px, s.px), ddy = unit.py - s.py; if (Math.hypot(ddx, ddy) < TILE * SHOT_HIT_R) { s.ttl = 0; onHit(s.dmg != null ? s.dmg : SHOT_DMG_MIN + Math.random() * (SHOT_DMG_MAX - SHOT_DMG_MIN)); } }
    }
    if (this.list.some((s) => s.ttl <= 0)) this.list = this.list.filter((s) => s.ttl > 0);
  }
}
