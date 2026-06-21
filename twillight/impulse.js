'use strict';

// Импульсный бур (домешан в Game.prototype, ПОСЛЕ game). Заряд удержанием Пробела → ЗВУКОВАЯ ВОЛНА
// в сторону ВЗГЛЯДА юнита (не нужно жать направление при заряде). Волна распространяется за `IMPULSE_WAVE_DUR`
// (видимо, не мгновенно): сила МАКС у юнита, спадает ×IMPULSE_FALLOFF за тайл → ближние ломаются, дальний
// «трескается». Пассивно породу НЕ грызёт (unit.js: `s.impulse` гасит grind). Состояние — `this.imp`.
// Длина — узел меты `mast_di_len`; пик силы/урон — трек ГОРОДА «СИЛА УДАРА» (`u.stats.impForce`).
Object.assign(Game.prototype, {
  impulseActive() { return !!(this.unit && this.unit.stats && this.unit.stats.impulse); },

  updateImpulse(dt) {
    const u = this.unit;
    const imp = this.imp || (this.imp = { charge: 0, cd: 0, dir: [1, 0], held: false, wave: null });
    if (imp.wave) this._impWaveAdvance(dt);                 // активная волна распространяется/ломает по ходу
    if (imp.cd > 0) imp.cd -= dt;
    if (!u || !this.impulseActive()) { if (u) u.frozenImpulse = false; imp.charge = 0; imp.held = false; return; }

    // Пробел заряжает ТОЛЬКО в поле (не на базе — там Пробел=апгрейды; не в печати; не пока летит волна).
    const ctx = this.mode === 'playing' && !this.atBase() && !this.printMode;
    const canCharge = ctx && imp.cd <= 0 && u.state === IDLE && !imp.wave;

    if (canCharge && this.input.keys.has(KEY_PRIMARY)) {   // импульс-заряд — ГЛАВНОЕ действие (Пробел)
      u.frozenImpulse = true;                               // стоим, пока копим (юнит заморожен → взгляд фиксирован)
      imp.dir = (u.dx !== 0 || u.dy !== 0) ? [u.dx, u.dy] : [u.faceX, 0];   // КУДА СМОТРИТ ЮНИТ (без доп-клавиш)
      imp.held = true;
      imp.charge = Math.min(1, imp.charge + dt / IMPULSE_CHARGE_T);
      if (imp.charge >= 1) this._impFire();                 // авто-выстрел на пороге максимума
    } else {
      if (imp.held && imp.charge >= IMPULSE_MIN_FIRE && ctx) this._impFire();   // отпустил с достаточным зарядом
      else { imp.charge = 0; imp.held = false; u.frozenImpulse = false; }       // тап впустую / контекст пропал
    }
  },

  _impFire() {
    const u = this.unit, imp = this.imp;
    const peak = imp.charge * (IMPULSE_FORCE + ((u.stats && u.stats.impForce) || 0));   // пик силы у юнита
    const len = IMPULSE_LEN + ((typeof metaHas === 'function' && metaHas('mast_di_len')) ? IMPULSE_LEN_NODE : 0);
    // РЕАЛЬНАЯ дальность эффекта: до тайла, где сила ещё ≥ IMPULSE_MIN_EFFECT (трещина). Масштабируется зарядом/
    // СИЛОЙ УДАРА/узлом длины → визуал волны (render) рисуется ровно до неё, не «в пустоту» дальше.
    let reach = 1; for (let i = 1; i <= len; i++) { if (peak * Math.pow(IMPULSE_FALLOFF, i - 1) >= IMPULSE_MIN_EFFECT) reach = i; else break; }
    imp.wave = { dx: imp.dir[0], dy: imp.dir[1], fx: u.tileX, fy: u.tileY, len, reach, peak, ch: imp.charge, t: 0, next: 1 };
    imp.charge = 0; imp.held = false; imp.cd = IMPULSE_CD; u.frozenImpulse = false;
  },

  // Распространение волны: фронт идёт от юнита наружу за IMPULSE_WAVE_DUR; на каждый достигнутый тайл —
  // сила с угасанием (force_i = peak·FALLOFF^(i-1)). Хватает порога → ломаем (крошка/лут); нет → копится `dig` (трещины).
  _impWaveAdvance(dt) {
    const w = this.world, wave = this.imp.wave; wave.t += dt;
    const front = (wave.t / IMPULSE_WAVE_DUR) * wave.len;
    while (wave.next <= wave.len && wave.next <= front) {
      const i = wave.next++;
      const tx = wrapX(wave.fx + wave.dx * i), ty = wave.fy + wave.dy * i;
      if (ty < 0 || ty >= MAP_H) { wave.len = i - 1; break; }
      const force = wave.peak * Math.pow(IMPULSE_FALLOFF, i - 1);
      this._impHurt(tx, ty, IMPULSE_DMG * force / IMPULSE_FORCE);     // враги: ближе к юниту — сильнее
      const t = w.tileAt(tx, ty);
      if (t.type === BORDER || t.type === INDESTRUCT) { wave.len = i; break; }
      if (t.type === ROCK) {
        t.dig += force;
        if (t.dig >= digThreshold(t)) {                              // хватило — РАЗВАЛ тайла
          const res = t.resource;
          w.setAir(tx, ty); this.dugTiles++;
          if (res && this.loot) this.loot.spawn(tx, ty, res);
          if (this.dust && this.dust.burst) this.dust.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2);   // крошка (не исчез, а рассыпался)
        }   // иначе `dig` остаётся → render_world рисует трещины («побурили, но не разрушили»)
      }
    }
    if (wave.t >= IMPULSE_WAVE_TTL) this.imp.wave = null;
  },

  _impHurt(tx, ty, dmg) {
    if (!this.enemies) return;
    for (const e of this.enemies) {
      if (e.dead || e.dying) continue;
      const ex = wrapX(Math.floor(e.px / TILE)), ey = Math.floor(e.py / TILE);
      if (ex === tx && ey === ty) e.damage(dmg);
    }
  },
});
