'use strict';

// СКВЕРНОСЕЙ + МАЯКИ СКВЕРНЫ (домешано в Game.prototype, ПОСЛЕ game). Скверносей (`blight_sower`,
// ENEMY_FLYERS его НЕ содержит → наземный краулер) ползёт/роет к юниту и периодически роняет
// СТАЦИОНАРНЫЙ МАЯК — отдельную сущность `game.blightBeacons[]` со своим HP. Маяк, пока жив, поднимает
// ФОН ПОМЕХ (радиацию) в радиусе до 50% (`BLIGHT_BEACON_CAP`): добавляет временный rad-источник в
// `world.radSources` (его читают и глитч-оверлей, и детектор загрязнения через `world.radAt`). Юнит
// добивает маяк бурением вплотную (`BLIGHT_KILL_R`, `BLIGHT_DRILL_DPS`) → источник снят, помехи спадают.
// Маяки НЕЗАВИСИМЫ от сеятеля: гибель скверносея их не убирает (только добивание самого маяка). Логика
// без Canvas; рендер — `render_enemy` (`drawBlightSower` / `drawBlightBeacons`).
Object.assign(Game.prototype, {
  blightSowerBrain(e, dt) {
    const u = this.unit;
    if (!this.blightBeacons) this.blightBeacons = [];
    e.sowT = (e.sowT == null) ? BLIGHT_SOW_FIRST : e.sowT - dt;   // первый маяк позже (BLIGHT_SOW_FIRST), затем по интервалу
    if (e.sowT <= 0) { if (this.blightBeacons.length < BLIGHT_BEACON_GLOBAL_CAP) this._deployBeacon(e); e.sowT = BLIGHT_SOW_INTERVAL; }
    if (e.state2 !== IDLE) return;
    e.target = u ? { x: u.tileX, y: u.tileY } : null;   // ползёт/роет к юниту, роняя маяки по пути (угроза рабочему месту)
  },
  // Поставить маяк на тайле сеятеля: соблюсти разнос (не лепить рядом с существующим) и глобальный кап.
  _deployBeacon(e) {
    if (this.blightBeacons.length >= BLIGHT_BEACON_GLOBAL_CAP) return;
    for (const b of this.blightBeacons) if (Math.hypot(wrapDeltaPx(b.px, e.px), b.py - e.py) / TILE < BLIGHT_BEACON_SPACING) return;
    const x = e.tileX, y = e.tileY;
    const src = { x, y, r: BLIGHT_BEACON_R, cap: BLIGHT_BEACON_CAP };   // временный очаг помех (кап 50%)
    this.world.radSources.push(src);
    this.blightBeacons.push({ x, y, px: x * TILE + TILE / 2, py: y * TILE + TILE / 2, hp: BLIGHT_BEACON_HP, maxHp: BLIGHT_BEACON_HP, src, hit: 0, t: 0, dead: false });
    if (!this.debug) this.logEvent(STR.log.blightBeacon);
  },
  updateBlight(dt) {
    if (!this.blightBeacons || !this.blightBeacons.length) return;
    const u = this.unit;
    for (const b of this.blightBeacons) {
      b.t += dt; if (b.hit > 0) b.hit = Math.max(0, b.hit - dt);
      if (u && !this.debug) {   // юнит вплотную бурит маяк → добивает
        const d = Math.hypot(wrapDeltaPx(u.px, b.px), u.py - b.py) / TILE;
        if (d <= BLIGHT_KILL_R) { b.hp -= BLIGHT_DRILL_DPS * dt; b.hit = 0.2; if (b.hp <= 0) b.dead = true; }
      }
    }
    if (this.blightBeacons.some((b) => b.dead)) {
      for (const b of this.blightBeacons) if (b.dead) { const i = this.world.radSources.indexOf(b.src); if (i >= 0) this.world.radSources.splice(i, 1); }   // снять очаг помех
      this.blightBeacons = this.blightBeacons.filter((b) => !b.dead);
      if (!this.debug) this.logEvent(STR.log.blightBeaconDown);
    }
  },
});
