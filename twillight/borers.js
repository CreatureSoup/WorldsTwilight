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

  updateBorers(dt) {
    if (!this.borers) this.borers = [];
    // узел «Сканеры на щитах»: каждый запущенный щит снимает туман вокруг себя (как сканер юнита)
    const scan = typeof metaHas === 'function' && metaHas('mast_ds_scan');
    const sr = scan ? Math.max(1, Math.round((this.unit && this.unit.stats && this.unit.stats.scanR) || SCANNER_R)) : 0;
    for (const b of this.borers) { this._borerStep(b, dt); if (scan && this.world) this.world.reveal(b.tileX, b.tileY, sr); }

    if (!this.screwActive() || !this.unit) return;
    // ГЛАВНОЕ действие (Пробел): забрать ближайший щит в радиусе, иначе запустить новый (только в поле, не в печати)
    if (this.mode === 'playing' && !this.atBase() && !this.printMode && this.input.pressed(KEY_PRIMARY)) {
      const u = this.unit;
      let near = null, nd = Infinity;
      for (const b of this.borers) { const d = Math.hypot(wrapDeltaPx(b.px, u.px), b.py - u.py); if (d < nd) { nd = d; near = b; } }
      if (near && nd <= SCREW_RECALL_R * TILE) {
        this.borers.splice(this.borers.indexOf(near), 1);   // «забрали» обратно на юнит
        if (this.logEvent) this.logEvent(STR.log.borerReturned);
      } else if (this.borers.length < this.borerMax()) {
        const dir = (u.dx !== 0 || u.dy !== 0) ? [u.dx, u.dy] : [u.faceX, 0];   // строго по ходу взгляда
        this.borers.push({ tileX: u.tileX, tileY: u.tileY, px: u.px, py: u.py, dx: dir[0], dy: dir[1], spin: 0 });
      }
    }
  },

  _borerStep(b, dt) {
    const w = this.world;
    b.drilling = false;
    b.spin += dt * 9;                                          // визуальное вращение головки (анимация работы — быстрее в render при drilling)
    const tcx = b.tileX * TILE + TILE / 2, tcy = b.tileY * TILE + TILE / 2;   // плавное скольжение к центру тайла
    b.px += wrapDeltaPx(tcx, b.px) * Math.min(1, dt * SCREW_GLIDE);
    b.py += (tcy - b.py) * Math.min(1, dt * SCREW_GLIDE);
    const nx = wrapX(b.tileX + b.dx), ny = b.tileY + b.dy;
    const t = (ny < 0 || ny >= MAP_H) ? null : w.tileAt(nx, ny);   // тайл по ходу проходки
    // 1) АНКЕР: впереди ПОРОДА → бурим её (в ЛЮБУЮ сторону, в т.ч. ВВЕРХ — держимся за породу, гравитация не
    //    мешает и не дёргает). Это даёт ход вверх и убирает «прыжок вверх↔падение вниз».
    if (t && t.type === ROCK) {
      b.drilling = true; b.moveT = 0;
      const rate = SCREW_DIG_BASE + ((this.unit && this.unit.stats && this.unit.stats.screwSpeed) || 0);
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
