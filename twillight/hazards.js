'use strict';

// ПОГРЕБЁННЫЕ ОПАСНЫЕ ОБЪЕКТЫ — останки роботов + старые мины (домешано в Game.prototype ПОСЛЕ game.js).
// Маркеры t.robot / t.mine ставит world.generate; world.setAir на их тайле ставит .dug при откопке. Тут — цикл:
//   РОБОТ: dug → (узел `kart_defuse` → сразу обезврежен/dead) ИЛИ wake (сенсоры красные) → fire (ROBOT_SHOTS
//          выстрелов веером через game.shots) → dead. Мёртвого можно СКАНИРОВАТЬ на данные при узле `kart_wreck`.
//   МИНА: dug → (`kart_defuse` → обезврежена) ИЛИ blink (мигает красным) → взрыв (урон в радиусе + воронка/обрушение).
// Логика без Canvas; рендер — render_hazards.js. Выстрелы роботов реюзят game.shots (тикают всегда, см. ai.updateEnemies).

Object.assign(Game.prototype, {
  updateHazards(dt) {
    const w = this.world; if (!w) return;
    const defuse = (typeof metaHas === 'function' && metaHas('kart_defuse'));
    const canScan = (typeof metaHas === 'function' && metaHas('kart_wreck'));

    for (const r of w.robots) {
      if (r.state === 'buried') {
        if (!r.dug) continue;
        if (defuse) { r.state = 'dead'; r.defused = true; if (!this.debug) this.logEvent(STR.log.remnantsDefused); }
        else { r.state = 'wake'; r.t = 0; if (!this.debug) this.logEvent(STR.log.protocolWoke); }
        continue;
      }
      if (r.state === 'wake') {
        r.t += dt;
        if (r.t >= ROBOT_WAKE_T) { r.state = 'fire'; r.fired = 0; r.fireT = 0; }
      } else if (r.state === 'fire') {
        r.fireT -= dt;
        if (r.fireT <= 0 && r.fired < ROBOT_SHOTS) {
          const px = (r.tx + 0.5) * TILE, py = (r.ty + 0.5) * TILE, ang = r.seed + r.fired * (Math.PI * 2 / ROBOT_SHOTS);
          this.shots.fire(px, py, px + Math.cos(ang) * TILE * 6, py + Math.sin(ang) * TILE * 6);
          if (this.dust) this.dust._grit(px, py, Math.cos(ang) * TILE * 2.4, Math.sin(ang) * TILE * 2.4, Math.random() < 0.4);
          r.fired++; r.fireT = ROBOT_SHOT_GAP;
        }
        if (r.fired >= ROBOT_SHOTS) {   // отстрелялся → ОСЕДАЕТ (питание гаснет, корпус оплывает) → dead
          r.state = 'settle'; r.t = 0;
          const px = (r.tx + 0.5) * TILE, py = (r.ty + 0.5) * TILE;
          if (this.dust) for (let i = 0; i < 7; i++) { const a = Math.PI * (0.2 + Math.random() * 0.6), sp = TILE * (0.4 + Math.random() * 1.1); this.dust._grit(px, py, Math.cos(a) * sp, Math.sin(a) * sp * 0.3, Math.random() < 0.6); }
          if (!this.debug) this.logEvent(STR.log.protocolDrained);
        }
      } else if (r.state === 'settle') {
        r.t += dt; if (r.t >= ROBOT_SETTLE_T) { r.state = 'dead'; r.t = 0; }
      } else if (r.state === 'dead' && !r.scanned && canScan && this._hazardScan(r, dt)) {
        r.scanned = true; this.dataCount = (this.dataCount || 0) + 1;
        this._dataGain(typeof CODEX_DATA_PER_SCAN !== 'undefined' ? CODEX_DATA_PER_SCAN : 1);   // множитель kart_data учитывается
        if (!this.debug) this.logEvent(STR.log.remnantsData);
      }
    }

    for (const m of w.mines) {
      if (m.state === 'buried') {
        if (!m.dug) continue;
        if (defuse) { m.state = 'done'; m.defused = true; if (!this.debug) this.logEvent(STR.log.mineDefused); }
        else { m.state = 'blink'; m.t = 0; }
        continue;
      }
      if (m.state === 'blink') { m.t += dt; if (m.t >= MINE_BLINK_T) { m.state = 'done'; this._mineBlast(m); } }
    }
  },

  // Накопление времени скана у мёртвого робота (в радиусе SCAN_RADIUS и в раскрытом тумане); true по завершении.
  _hazardScan(r, dt) {
    const u = this.unit; if (!u) return false;
    const px = (r.tx + 0.5) * TILE, py = (r.ty + 0.5) * TILE;
    if (Math.hypot(wrapDeltaPx(px, u.px), py - u.py) / TILE > SCAN_RADIUS || !this.world.isSeen(r.tx, r.ty)) return false;
    r.scan = (r.scan || 0) + dt / this._scanT(SCAN_TIME);   // kart_hub ускоряет
    return r.scan >= 1;
  },

  _mineBlast(m) {
    const cx = m.tx, cy = m.ty, px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
    if (!this.debug && this.unit) {
      const d = Math.hypot(wrapDeltaPx(this.unit.px, px), this.unit.py - py) / TILE;
      if (d <= MINE_BLAST_R) this.unit.hp = Math.max(0, this.unit.hp - Math.round(MINE_DMG * (1 - d / MINE_BLAST_R)));
    }
    for (const e of this.enemies) {
      if (e.dead || e.dying || typeof e.damage !== 'function') continue;
      const d = Math.hypot(wrapDeltaPx(e.px, px), e.py - py) / TILE;
      if (d <= MINE_BLAST_R) e.damage(Math.round(MINE_DMG * (1 - d / MINE_BLAST_R)));
    }
    // воронка + обрушение нестабильной породы (setAir без noTrigger → falling.js осыпает нестабильную сверху)
    const R = Math.ceil(MINE_CRATER_R), R2 = MINE_CRATER_R * MINE_CRATER_R;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R2) this.world.setAir(cx + dx, cy + dy);
    if (this.dust) for (let i = 0; i < 16; i++) { const a = Math.random() * 6.283, sp = TILE * (1 + Math.random() * 2.6); this.dust._grit(px, py, Math.cos(a) * sp, Math.sin(a) * sp - TILE * 0.6, Math.random() < 0.5); }
    if (!this.debug) this.logEvent(STR.log.mineBlast);
  },
});
