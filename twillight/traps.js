'use strict';

// ЛОВУШКИ (домешано в Game.prototype, ПОСЛЕ game). Погребённые маркеры `world.traps` (тип acid/seismic/brood/cavein),
// откоп `setAir` → `trap.dug` → `updateTraps` СРАБАТЫВАЕТ по типу (разово, `trap.triggered`). Активные состояния держит
// game: `acidClouds` (DoT-облако нанороботов), `seismicWaves` (FX-волна-линза). Кладка спавнит мини-дронов (мошкара со
// стадией разлёта `scatterT`). Разлом замуровывает воздух породой. Сброс на старте забега. Рендер — `render_traps.js`.
Object.assign(Game.prototype, {
  updateTraps(dt) {
    const W = this.world; if (!W || !W.traps) return;
    if (!this.acidClouds) this.acidClouds = [];
    if (!this.seismicWaves) this.seismicWaves = [];
    const defuse = (typeof metaHas === 'function' && metaHas('kart_defuse'));
    for (const tr of W.traps) {
      if (tr.type === 'mine') {   // МИНА (тип ловушки): dug → blink (телеграф) → взрыв; kart_defuse → обезврежена
        if (tr.state === 'buried') {
          if (!tr.dug) continue;
          if (defuse) { tr.state = 'done'; tr.defused = true; if (!this.debug) this.logEvent(STR.log.mineDefused); }
          else { tr.state = 'blink'; tr.t = 0; this._trapDiscover('mine'); }
          continue;
        }
        if (tr.state === 'blink') { tr.t += dt; if (tr.t >= MINE_BLINK_T) { tr.state = 'done'; this._mineBlast({ tx: tr.tx, ty: tr.ty }); } }
        continue;
      }
      if (!tr.dug || tr.triggered) continue;   // мгновенные ловушки (срабатывание свежевыкопанных)
      tr.triggered = true;
      this._trapDiscover(tr.type);   // ИЗЪЯТИЕ ДАННЫХ + запись глоссария на ТИП (ловушка потреблена → «находка» по факту срабатывания)
      if (tr.type === 'acid') this._trigAcid(tr);
      else if (tr.type === 'seismic') this._trigSeismic(tr);
      else if (tr.type === 'cavein') this._trigCaveIn(tr);   // brood переехал в останки роботов (hazards.js → _trigBrood)
    }
    // КИСЛОТНЫЕ ОБЛАКА: рост за телеграф (окно уйти) → DoT по воздуху радиуса → рассеивание по таймеру
    for (const c of this.acidClouds) {
      c.t += dt;
      c.r = c.t < ACID_ARM ? ACID_R * (c.t / ACID_ARM) : ACID_R;
      if (c.t >= ACID_ARM && !this.debug) {
        const px = (c.cx + 0.5) * TILE, py = (c.cy + 0.5) * TILE, u = this.unit;
        if (u && Math.hypot(wrapDeltaPx(u.px, px), u.py - py) / TILE <= c.r) u.hurt(ACID_DMG * dt);
        for (const e of this.enemies) { if (e.dying || e.dead || e.friendly) continue; if (Math.hypot(wrapDeltaPx(e.px, px), e.py - py) / TILE <= c.r) e.damage(ACID_DMG * dt); }
      }
    }
    this.acidClouds = this.acidClouds.filter((c) => c.t < ACID_DUR);
    for (const w of this.seismicWaves) w.t += dt;   // сейсмо-волны — только FX-таймер
    this.seismicWaves = this.seismicWaves.filter((w) => w.t < SEISMIC_WAVE_T);
  },

  // Разовая запись ГЛОССАРИЯ + ИЗЪЯТИЕ ДАННЫХ при срабатывании ловушки данного ТИПА (ловушка потреблена → «находка» по факту встречи, скана нет).
  _trapDiscover(type) {
    const id = { acid: 'e15', seismic: 'e16', cavein: 'e17', mine: 'e18' }[type];
    if (!id || typeof codexDiscover !== 'function') return;
    const e = codexDiscover(id); if (!e) return;
    this.dataCount = (this.dataCount || 0) + 1;
    const r = this._dataGain ? this._dataGain(typeof CODEX_DATA_PER_SCAN !== 'undefined' ? CODEX_DATA_PER_SCAN : 1) : null;
    if (r && typeof codexPopupShow === 'function' && this._codexAnchor) codexPopupShow(r, this._codexAnchor());
  },

  // 1) КИСЛОТНЫЕ НАНОРОБОТЫ: облако в воздухе радиуса, импульсом НЕ контрится (просто таймер).
  _trigAcid(tr) {
    this.acidClouds.push({ cx: tr.tx, cy: tr.ty, r: 0, t: 0 });
    if (!this.debug && this.logEvent) this.logEvent(STR.log.trapAcid);
  },

  // 2) ДЫШАЩАЯ ПОРОДА (сейсмо): рок-тайлы радиуса → НЕСТАБИЛЬНЫЕ (вероятность спадает к краю); без опоры — сразу в очередь срыва.
  _trigSeismic(tr) {
    const W = this.world, R = SEISMIC_R;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx, dy); if (d > R) continue;
      const x = wrapX(tr.tx + dx), y = tr.ty + dy; if (y < CAVE_FLOOR_Y + 2 || y >= MAP_H - 1) continue;
      const t = W.tileAt(x, y);
      if (t.type !== ROCK || t.unstable || t.boulder || t.server || t.artifact || t.robot || t.trap) continue;
      if (Math.random() < SEISMIC_UNSTABLE_P * (1 - d / R)) {
        t.unstable = true;
        if (!isSolid(W.tileAt(x, y + 1)) || W.tileAt(x, y - 1).type === AIR) W.unstableTriggers.push({ x, y });
      }
    }
    this.seismicWaves.push({ cx: tr.tx, cy: tr.ty, t: 0 });
    if (this.dust) for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, sp = TILE * (1 + Math.random() * 2.4); this.dust._grit((tr.tx + 0.5) * TILE, (tr.ty + 0.5) * TILE, Math.cos(a) * sp, Math.sin(a) * sp, Math.random() < 0.5); }
    if (!this.debug && this.logEvent) this.logEvent(STR.log.trapSeismic);
  },

  // 3) РОЙ-КЛАДКА: пачка мини-дронов (мошкара) с обязательным РАЗЛЁТОМ (инициация) до перехода в охоту.
  _trigBrood(tr) {
    for (let i = 0; i < BROOD_COUNT; i++) {
      const e = new Enemy(tr.tx, tr.ty, 'swarm_midge', tr.tx, tr.ty, 2);
      e.scatterT = BROOD_SCATTER_T; e.scatterAng = (i / BROOD_COUNT) * TAU + Math.random() * 0.6; e.fromTrap = true;
      this.enemies.push(e);
    }
    if (!this.debug && this.logEvent) this.logEvent(STR.log.trapBrood);
  },

  // 4) РАЗЛОМ: свободные воздушные тайлы радиуса → ОБЫЧНАЯ порода (прокапывается назад). Юнита и каверны не засыпаем; кабель НЕ рвём.
  _trigCaveIn(tr) {
    const W = this.world, R = CAVEIN_R, u = this.unit; let filled = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (Math.hypot(dx, dy) > R) continue;
      const x = wrapX(tr.tx + dx), y = tr.ty + dy; if (y < 1 || y >= MAP_H - 1) continue;
      if (u && x === u.tileX && y === u.tileY) continue;   // не замуровываем юнита (останется в кармане → прокопается)
      const t = W.tileAt(x, y);
      if (t.type !== AIR || W.inCave(x, y) || W.inCavern(x, y)) continue;
      t.type = ROCK; t.hardness = W.hardnessForY(y); t.dig = 0; t.dens = 1; t.resource = null; t.dug = false; t.unstable = false; t.boulder = false;
      filled++;
      if (this.dust && Math.random() < 0.5) this.dust._grit((x + 0.5) * TILE, (y + 0.5) * TILE, (Math.random() - 0.5) * TILE, -TILE * (0.3 + Math.random()), Math.random() < 0.5);
    }
    if (filled && !this.debug && this.logEvent) this.logEvent(STR.log.trapCaveIn);
  },
});
