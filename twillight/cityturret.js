'use strict';

// ТУРЕЛИ ГОРОДА (Батч 8, узлы жёлтой ветки amb_turret/2/3 — домешан в Game.prototype ПОСЛЕ game). Авто-оборона базы:
// скорострельные, но СЛАБЫЕ (не сносят юнитов врага мгновенно). Кол-во и раскладка по числу купленных узлов; урон растёт
// городским треком «УРОН ТУРЕЛЕЙ» (metaNeed amb_turret). Медленный поворот ствола ЧЕРЕЗ ВЕРХ (общий aimOverTop, structures.js).
// Рендер — render_cityturret.js. НЕ печатные структуры (постоянная оборона города, не тратит энергию юнита).
Object.assign(Game.prototype, {
  _cityTurretCount() {
    if (!(typeof metaHas === 'function' && metaHas('amb_turret'))) return 0;
    return 1 + (metaHas('amb_turret2') ? 1 : 0) + (metaHas('amb_turret3') ? 1 : 0);
  },
  _cityTurretDmg() { return CITY_TURRET_DMG + ((this.upgrades && this.upgrades.levels && this.upgrades.levels.turretdmg) || 0) * CITY_TURRET_DMG_STEP; },

  // Раскладка по кол-ву: 1 — по центру; 2 — симметрично лево/право; 3 — лево/право + центр.
  _cityTurretsInit() {
    this._cityTurretTracers = [];
    const n = this._cityTurretCount();
    const cx = PRINTER.x + PRINTER.w / 2, cy = CAVE_FLOOR_Y - 0.5;   // на полу базовой каверны, стволами вверх
    const L = cx - CITY_TURRET_SPREAD, R = cx + CITY_TURRET_SPREAD;
    const xs = n <= 0 ? [] : n === 1 ? [cx] : n === 2 ? [L, R] : [L, R, cx];
    this.cityTurrets = xs.map((tx) => ({ px: tx * TILE, py: cy * TILE, aimAng: -Math.PI / 2, fireCd: 0, flash: 0 }));
  },

  _updateCityTurrets(dt) {
    const tr = this._cityTurretTracers;
    if (tr) for (let i = tr.length - 1; i >= 0; i--) { tr[i].life += dt; if (tr[i].life > STRUCT_TRACER_TTL) tr.splice(i, 1); }
    const list = this.cityTurrets;
    if (!list || !list.length || this.mode !== 'playing' || !this.enemies) return;
    const dmg = this._cityTurretDmg();
    for (const t of list) {
      if (t.fireCd > 0) t.fireCd -= dt; if (t.flash > 0) t.flash = Math.max(0, t.flash - dt);
      let best = null, bd = CITY_TURRET_RANGE + 0.5;
      for (const e of this.enemies) { if (e.dying || e.dead || e.friendly) continue; const d = Math.hypot(wrapDeltaPx(t.px, e.px), t.py - e.py) / TILE; if (d < bd && this.world.hasLineOfSight(t.px, t.py, e.px, e.py)) { bd = d; best = e; } }   // не сквозь породу
      if (!best) { t.aimAng = aimOverTop(t.aimAng, -Math.PI / 2, TURRET_TURN_RATE * dt * 0.6); continue; }   // покой — медленно возвращаемся стволом вверх
      const tgt = Math.atan2(best.py - t.py, wrapDeltaPx(best.px, t.px));
      t.aimAng = aimOverTop(t.aimAng, tgt, TURRET_TURN_RATE * dt);   // медленный поворот через верх
      if (turretAimed(t.aimAng, tgt) && t.fireCd <= 0) {
        t.fireCd = CITY_TURRET_FIRECD; t.flash = 0.06; best.damage(dmg);
        if (tr) tr.push({ x1: t.px, y1: t.py, x2: best.px, y2: best.py, life: 0 });
      }
    }
  },
});
