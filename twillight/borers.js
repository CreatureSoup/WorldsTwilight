'use strict';

// Винтовой бур-проходка (домешан в Game.prototype, ПОСЛЕ game). Юнит = станция автономных буров-щитов:
// по Пробелу запускается щит СТРОГО по ходу взгляда, медленно прокапывает прямой УКРЕПЛЁННЫЙ ход
// (`setAir(...,noTrigger)` — НЕ осыпает; тайлы метятся `t.screw` для винтовой текстуры), сам не
// останавливается; Пробел в радиусе SCREW_RECALL_R — «забрать» ближайший щит обратно. Юнит несёт
// `stats.borerMax` штук (2 + узлы `mast_ds_b1/_b2`). Скорость проходки — трек ГОРОДА «СКОРОСТЬ ПРОХОДКИ».
// Состояние — `game.borers` (массив). Рендер — `render_borer.js`.
Object.assign(Game.prototype, {
  screwActive() { return !!(this.unit && this.unit.stats && this.unit.stats.screw); },
  borerMax() { return (this.unit && this.unit.stats && this.unit.stats.borerMax) || SCREW_BORERS_BASE; },
  // Автономный заряд щита (сек работы) = база + узел меты «ВРЕМЯ РАБОТЫ» (`mast_ds_life`, ветка бура).
  borerLife() { return SCREW_CHARGE_MAX + ((typeof metaHas === 'function' && metaHas('mast_ds_life')) ? SCREW_LIFE_BONUS : 0); },

  updateBorers(dt) {
    if (!this.borers) this.borers = [];
    // узел «Сканеры на щитах»: каждый запущенный щит снимает туман вокруг себя (как сканер юнита)
    const scan = typeof metaHas === 'function' && metaHas('mast_ds_scan');
    const sr = scan ? Math.max(1, Math.round((this.unit && this.unit.stats && this.unit.stats.scanR) || SCANNER_R)) : 0;
    for (const b of this.borers) {
      this._borerStep(b, dt);
      if (b.depleted && this.unit) this._borerRecharge(b, dt);   // разряжен + юнит рядом → подзарядка (анимация)
      if (scan && this.world) this.world.reveal(b.tileX, b.tileY, sr);
    }

    if (!this.screwActive() || !this.unit) return;
    // ГЛАВНОЕ действие (Пробел): забрать ближайший щит в радиусе, иначе запустить новый. ⚠️ ТОЛЬКО стоя (`unit.state===IDLE`) и НЕ от
    // клика по кнопке действия (`_actionHeld`) — иначе Пробел ложно срабатывает В ДВИЖЕНИИ (тот же фикс, что у активации города).
    if (this.mode === 'playing' && !this.atBase() && !this.printMode && this.unit.state === IDLE && !this._actionHeld && this.input.pressed(KEY_PRIMARY)) {
      const u = this.unit;
      let near = null, nd = Infinity;
      for (const b of this.borers) { const d = Math.hypot(wrapDeltaPx(b.px, u.px), b.py - u.py); if (d < nd) { nd = d; near = b; } }
      if (near && nd <= SCREW_RECALL_R * TILE) {
        this.borers.splice(this.borers.indexOf(near), 1);   // «забрали» обратно на юнит
        if (this.logEvent) this.logEvent(STR.log.borerReturned);
      } else if (this.borers.length < this.borerMax()) {
        const dir = (u.dx !== 0 || u.dy !== 0) ? [u.dx, u.dy] : [u.faceX, 0];   // строго по ходу взгляда
        const life = this.borerLife();
        this.borers.push({ tileX: u.tileX, tileY: u.tileY, px: u.px, py: u.py, dx: dir[0], dy: dir[1], spin: 0, charge: life, maxCharge: life, depleted: false, recharging: 0 });
      }
    }
  },

  // Подзарядка РАЗРЯЖЕННОГО щита: юнит в радиусе SCREW_RECHARGE_R → заряд копится за SCREW_RECHARGE_TIME → щит оживает
  // и продолжает ход (если игрок не «забрал» Пробелом). Юнит отошёл — пауза (заряд не сбрасывается). recharging — для анимации.
  _borerRecharge(b, dt) {
    const u = this.unit;
    if (Math.hypot(wrapDeltaPx(b.px, u.px), b.py - u.py) / TILE > SCREW_RECHARGE_R) { b.recharging = 0; return; }
    b.recharging = 1;
    b.charge = Math.min(b.maxCharge, b.charge + (b.maxCharge / SCREW_RECHARGE_TIME) * dt);
    if (b.charge >= b.maxCharge) { b.depleted = false; b.recharging = 0; if (this.logEvent && !this.debug) this.logEvent(STR.log.borerRecharged); }
  },

  _borerStep(b, dt) {
    const w = this.world;
    b.drilling = false;
    const tcx = b.tileX * TILE + TILE / 2, tcy = b.tileY * TILE + TILE / 2;   // плавное скольжение к центру тайла (и в разряде ровно лежит)
    b.px += wrapDeltaPx(tcx, b.px) * Math.min(1, dt * SCREW_GLIDE);
    b.py += (tcy - b.py) * Math.min(1, dt * SCREW_GLIDE);
    if (b.depleted) return;                                   // АПКИП: заряд иссяк → щит ЛЕЖИТ (не копает/не движется), ждёт подзарядки
    if (this.unit && this.unit.stats && this.unit.stats.drillOverdrive && this.unit.drillOverheatT > 0) return;   // ФОРСАЖ перегрет → щит ОСТАНОВЛЕН (не копает/не тратит заряд), пока бур остывает
    b.spin += dt * 9;                                         // визуальное вращение головки (только пока активен; быстрее в render при drilling)
    if (b.charge == null) { b.charge = b.maxCharge = this.borerLife(); }   // страховка для щитов без поля заряда
    b.charge -= dt;                                          // тратим автономный заряд, пока щит активен
    if (b.charge <= 0) { b.charge = 0; b.depleted = true; if (this.logEvent && !this.debug) this.logEvent(STR.log.borerDepleted); return; }
    const nx = wrapX(b.tileX + b.dx), ny = b.tileY + b.dy;
    const t = (ny < 0 || ny >= MAP_H) ? null : w.tileAt(nx, ny);   // тайл по ходу проходки
    // 1) АНКЕР: впереди ПОРОДА → бурим её (в ЛЮБУЮ сторону, в т.ч. ВВЕРХ — держимся за породу, гравитация не
    //    мешает и не дёргает). Это даёт ход вверх и убирает «прыжок вверх↔падение вниз».
    if (t && t.type === ROCK) {
      b.drilling = true; b.moveT = 0;
      let rate = SCREW_DIG_BASE + ((this.unit && this.unit.stats && this.unit.stats.screwSpeed) || 0);
      if (this.unit && this.unit.stats && this.unit.stats.drillOverdrive) rate *= 1 + this.unit.drillHeat * (this.unit.stats.overdriveBonus || OVERDRIVE_MAX_BONUS);   // ФОРСАЖ (реликт): нагрев ускоряет проходку щита (пик скалируется город-апгрейдом)
      t.dig += rate * dt;
      if (t.dig >= digThreshold(t)) {
        const res = t.resource;
        w.setAir(nx, ny, true);                               // УКРЕПЛЁННЫЙ ход — без осыпания
        t.screw = true; t.screwAxis = Math.abs(b.dx) >= Math.abs(b.dy) ? 0 : 1;   // метка+ось хода (разворот текстуры)
        this.dugTiles++;
        if (res && this.loot) this.loot.spawn(nx, ny, res);
        if (this.dust && this.dust.burst) this.dust.burst(nx * TILE + TILE / 2, ny * TILE + TILE / 2);
        b.tileX = nx; b.tileY = ny;                           // продвинулся на освободившийся тайл
      }
      return;
    }
    // 2) ГРАВИТАЦИЯ: породы по ходу НЕТ и снизу пусто → падает до опоры (пещера/обрыв)
    if (b.tileY + 1 < MAP_H && w.tileAt(b.tileX, b.tileY + 1).type === AIR) {
      b.moveT = (b.moveT || 0) + dt; const step = 1 / SCREW_FALL_SPEED;
      if (b.moveT >= step) { b.moveT -= step; b.tileY += 1; }
      return;
    }
    // 3) опора есть, впереди ОТКРЫТО: идём по воздуху на дефолт-скорости — но НЕ вверх (вверх без породы не
    //    лезем — просто ЛЕЖИМ, не дёргаемся и не «взлетаем»). Край/индестракт впереди — тоже стоим.
    if (t && t.type === AIR && b.dy >= 0) {
      b.moveT = (b.moveT || 0) + dt; const step = 1 / SCREW_AIR_SPEED;
      if (b.moveT >= step) { b.moveT -= step; b.tileX = nx; b.tileY = ny; }
      return;
    }
    b.moveT = 0;                                              // лежит (упор/край/ход вверх в пустоту при опоре)
  },
});
