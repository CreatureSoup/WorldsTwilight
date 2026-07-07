'use strict';

// ДРОНЫ-КОМПАНЬОНЫ — реликты ДРОН-слота (домешан в Game.prototype, ПОСЛЕ game). ПО ОДНОМУ на установленный дрон-реликт
// (дрон-слот базово 1; узел меты kart_slot_drone даёт +1 → до двух дронов сразу). Каждый компаньон — запись в game.drones[]
// (поле srcId = id реликта-источника); _syncDrone реконсилирует список со слотом; updateDrones ведёт каждого по его типу.
// Типы: collector (пылесос дропа→трюм), courier (трюм→город), battery (питание→ТАЙМЕР города, НЕ структуры),
// scout (разведка тумана/гнёзд), hacker (деплой по кнопке → канал взлома гнезда → саботаж → смерть → кулдаун).
// Дрон летает НАД рельефом (как курьер-структура), поверх тумана. Рендер — render_drones.js.
Object.assign(Game.prototype, {
  _droneOfKind(kind) { return (this.drones || []).find((d) => d.kind === kind) || null; },   // первый компаньон типа (для доп-действия хакера / actionbar)

  // Синхронизация компаньонов со слотом (зовётся из _applyArtifacts): на каждый установленный дрон-реликт — свой компаньон; снятый реликт → убрать.
  _syncDrone() {
    if (!this.drones) this.drones = [];
    const ids = (this.artifactSlots && this.artifactSlots.drone) || [];
    this.drones = this.drones.filter((d) => ids.indexOf(d.srcId) >= 0);   // реликт снят → компаньон уходит
    for (const id of ids) {
      const kind = DRONE_KIND[id]; if (!kind || this.drones.some((d) => d.srcId === id)) continue;
      const u = this.unit;
      this.drones.push({ srcId: id, kind, px: u ? u.px + (Math.random() * 2 - 1) * TILE : 0, py: u ? (u.py - TILE) : 0, state: 'idle', carry: null, carryMap: null, t: 0, cd: 0, target: null, bob: Math.random() * 6.28, fx: 0 });
    }
  },

  updateDrones(dt) {
    const u = this.unit; if (!this.drones || !this.drones.length || !u || this.mode !== 'playing') return;
    for (const d of this.drones) {
      d.bob += dt; if (d.cd > 0) d.cd = Math.max(0, d.cd - dt); if (d.fx > 0) d.fx = Math.max(0, d.fx - dt);
      const fn = this['_drone_' + d.kind]; if (fn) fn.call(this, dt, d, u);
    }
  },

  // Лететь к (tx,ty) — вернуть true на месте (тор по X). Над рельефом (без коллизий породы).
  _droneFly(d, tx, ty, speed, dt) {
    const dx = wrapDeltaPx(tx, d.px), dy = ty - d.py, dist = Math.hypot(dx, dy), step = speed * TILE * dt;
    if (dist <= step || dist < TILE * 0.35) { d.px = wrapPx(tx); d.py = ty; return true; }
    d.px = wrapPx(d.px + dx / dist * step); d.py += dy / dist * step; return false;
  },
  // Орбита-следование за юнитом (точка чуть выше-сбоку, «дышит»).
  _droneOrbit(d, u, dt) {
    const ox = Math.cos(d.bob * 0.9) * TILE * 1.4, oy = -TILE * 1.3 + Math.sin(d.bob * 1.3) * TILE * 0.4;
    this._droneFly(d, u.px + ox, u.py + oy, DRONE_SPEED, dt);
  },
  _baseTarget() { return { x: wrapPx((PRINTER.x + PRINTER.w / 2) * TILE), y: (PRINTER.y + 0.5) * TILE }; },

  // СБОРЩИК: пылесосит ближайший дроп → несёт к юниту → в трюм (полон → роняет у юнита). Простаивает — орбита.
  _drone_collector(dt, d, u) {
    const loot = this.loot;
    if (d.state === 'idle') {
      let best = null, bd = this._artScaled('drone_collector') * TILE;   // радиус сбора скалируется город-апгрейдом
      if (loot && this.inventory.cargoFree() > 0) for (const dr of loot.drops) {
        if (dr.picked || dr._claimed) continue;
        const dd = Math.hypot(wrapDeltaPx(dr.px, d.px), dr.py - d.py); if (dd < bd) { bd = dd; best = dr; }
      }
      if (best) { d.target = best; best._claimed = true; d.state = 'seek'; }
      else this._droneOrbit(d, u, dt);
    } else if (d.state === 'seek') {
      const dr = d.target;
      if (!dr || dr.picked || !loot || !loot.drops.includes(dr)) { d.target = null; d.state = 'idle'; return; }
      if (this._droneFly(d, dr.px, dr.py, DRONE_SPEED, dt)) {
        const i = loot.drops.indexOf(dr); if (i >= 0) loot.drops.splice(i, 1);
        d.carry = dr.type; d.target = null; d.state = 'carry';
      }
    } else if (d.state === 'carry') {
      if (this._droneFly(d, u.px, u.py, DRONE_SPEED, dt)) {
        if (d.carry) { if (!this.inventory.addCargo(d.carry) && loot) loot.spawn(u.tileX, u.tileY, d.carry); else if (this.fx) this.fx.burst(d.px, d.py, [d.carry]); }
        d.carry = null; d.fx = 0.3; d.state = 'idle';
      }
    }
  },

  // КУРЬЕР: набрался груз вне базы → забрать пачку из трюма → отвезти в город (банк/счётчик) → вернуться.
  _drone_courier(dt, d, u) {
    const inv = this.inventory;
    if (d.state === 'idle') {
      this._droneOrbit(d, u, dt);
      if (!this.atBase() && inv.cargoUsed() >= DRONE_COURIER_MIN) {
        const m = {}; let n = 0;
        const batch = Math.round(this._artScaled('drone_courier'));   // груз за рейс скалируется город-апгрейдом
        while (n < batch && inv.cargoUsed() > 0) { const t = inv.deliverOneCargo(); if (!t) break; m[t] = (m[t] || 0) + 1; n++; }
        if (n > 0) { d.carryMap = m; d.state = 'deliver'; }
      }
    } else if (d.state === 'deliver') {
      const b = this._baseTarget();
      if (this._droneFly(d, b.x, b.y, DRONE_SPEED, dt)) {
        for (const t in d.carryMap) for (let i = 0; i < d.carryMap[t]; i++) { this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++; this.upgrades.addBank(t, 1); }
        if (this.fx) this.fx.burst(d.px, d.py, Object.keys(d.carryMap)); d.carryMap = null; d.fx = 0.3; d.state = 'return';
      }
    } else if (d.state === 'return') { if (this._droneFly(d, u.px, u.py, DRONE_SPEED, dt)) d.state = 'idle'; }
  },

  // БАТАРЕЯ: вне базы по таймеру летит в город и подзаряжает ТАЙМЕР ГИБЕРНАЦИИ (только город, НЕ структуры) → возврат.
  _drone_battery(dt, d, u) {
    const city = this.city; if (!city) { this._droneOrbit(d, u, dt); return; }
    if (d.state === 'idle') {
      this._droneOrbit(d, u, dt); d.t += dt;
      if (d.t >= DRONE_BATTERY_INTERVAL && !this.atBase() && city.timer < city.timerMax) { d.t = 0; d.state = 'deliver'; }
    } else if (d.state === 'deliver') {
      const b = this._baseTarget();
      if (this._droneFly(d, b.x, b.y, DRONE_SPEED, dt)) { city.timer = Math.min(city.timerMax, city.timer + this._artScaled('drone_battery')); if (this.fx) this.fx.burst(d.px, d.py, []); d.fx = 0.4; d.state = 'return'; }   // заряд за рейс скалируется город-апгрейдом
    } else if (d.state === 'return') { if (this._droneFly(d, u.px, u.py, DRONE_SPEED, dt)) d.state = 'idle'; }
  },

  // СКАУТ: летит к ближайшему НЕразведанному гнезду, снимая туман по пути; дошёл — метит разведанным. Целей нет — патруль-орбита вокруг юнита (тоже снимает туман).
  _scoutFindTarget(u) {
    let best = null, bd = DRONE_SCOUT_RANGE;
    for (const w of (this.world.wilds || [])) {
      if (w._scouted) continue;
      let dx = w.cx - u.tileX; if (dx > MAP_W / 2) dx -= MAP_W; else if (dx < -MAP_W / 2) dx += MAP_W;
      const dy = w.floorY - u.tileY, dd = Math.hypot(dx, dy);
      if (dd < bd) { bd = dd; best = w; }
    }
    return best;
  },
  _drone_scout(dt, d, u) {
    if (!d.target || d.target._scouted) d.target = this._scoutFindTarget(u);
    let tx, ty;
    if (d.target) { tx = wrapPx((d.target.cx + 0.5) * TILE); ty = (d.target.floorY + 0.5) * TILE; }
    else { tx = u.px + Math.cos(d.bob * 0.5) * TILE * DRONE_SCOUT_PATROL_R; ty = u.py + Math.sin(d.bob * 0.5) * TILE * DRONE_SCOUT_PATROL_R * 0.6; }
    const arrived = this._droneFly(d, tx, ty, DRONE_SCOUT_SPEED, dt);
    this.world.reveal(Math.round(wrapX(d.px / TILE - 0.5)), Math.round(d.py / TILE - 0.5), Math.round(this._artScaled('drone_scout')));   // снимает туман по маршруту (радиус скалируется город-апгрейдом)
    if (arrived && d.target) { d.target._scouted = true; d.fx = 0.5; if (this.logEvent && !this.debug) this.logEvent(STR.log.droneScout); d.target = null; }
  },

  // ХАКЕР: компаньон-деплой. idle — орбита, готов. Кнопка → летит к ближайшему гнезду → канал взлома → саботаж → смерть → кулдаун → новый.
  _droneDeployHack() {   // зов из доп-действия (actionbar инжектит хоткей)
    const d = this._droneOfKind('hacker'); if (!d || d.state !== 'idle' || d.cd > 0) return false;
    const nw = this.nearestWild ? this.nearestWild(this.unit.px, this.unit.py, DRONE_HACK_RANGE) : null;
    const w = nw && nw.wild;                                  // nearestWild → {wild,dist,hx,hy}; берём сырое гнездо
    if (!w || w.disabled) return false;
    d.target = w; d.state = 'deploy'; d.t = 0;
    if (this.logEvent && !this.debug) this.logEvent(STR.log.droneHackGo);
    return true;
  },
  _drone_hacker(dt, d, u) {
    if (d.state === 'idle') {
      this._droneOrbit(d, u, dt);
      const keys = this.actionKeys('droneHack');
      if (d.cd <= 0 && keys.length && !this.printMode && !this.atBase() && this.input.pressed(...keys)) this._droneDeployHack();
    } else if (d.state === 'deploy') {
      const w = d.target;
      if (!w || w.disabled) { d.state = 'idle'; d.target = null; return; }
      const h = this.wildHeart(w);
      if (this._droneFly(d, h.hx, h.hy, DRONE_SPEED, dt)) { d.state = 'hack'; d.t = 0; }
    } else if (d.state === 'hack') {
      const w = d.target;
      if (!w || w.disabled) { d.state = 'dying'; d.t = 0; return; }
      const h = this.wildHeart(w); d.px = wrapPx(h.hx); d.py = h.hy;   // НЕ мобилен — висит у сердца
      d.t += dt;
      if (d.t >= DRONE_HACK_TIME) { if (this._sabotageWild) this._sabotageWild(w); d.fx = 0.6; d.state = 'dying'; d.t = 0; if (this.logEvent && !this.debug) this.logEvent(STR.log.droneHackDone); }
    } else if (d.state === 'dying') {
      d.t += dt; if (d.t >= 0.6) { d.state = 'idle'; d.cd = this._artScaled('drone_hacker'); d.target = null; const u2 = this.unit; d.px = u2.px; d.py = u2.py - TILE; }   // «сдох» → возрождение после кулдауна (скалируется город-апгрейдом)
    }
  },
});
