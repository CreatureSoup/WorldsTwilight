'use strict';

// АКТИВНЫЕ РЕЛИКТЫ — простые (домешан в Game.prototype, ПОСЛЕ game). Доп-действия (цифра от менеджера действий по
// флагу-стату, actionKeys): ЭМИ-ИМПУЛЬС (стан врагам в радиусе) · ПОДРЫВ-ЗАРЯД (взрыв у юнита, СВОИХ не бьёт) ·
// НАНО-РЕМОНТ (хил ВО ВРЕМЕНИ). Флаги — unit.stats.stunPulse/blastCharge/nanoRepair (artifact._applyArtifacts).
// Кнопки/цифры — ACTION_DEFS. Кулдаун/состояние — game.stunPulse/blastCharge/nanoRepair. Зовётся в playing-цикле.
Object.assign(Game.prototype, {
  updateArtifactsActive(dt) {
    const u = this.unit; if (!u || !u.stats) return;
    const ctx = this.mode === 'playing' && !this.printMode && !this.atBase();
    const fired = (stat) => { const ks = this.actionKeys(stat); return ctx && ks.length && this.input.pressed(...ks); };

    // ЭМИ-ИМПУЛЬС — стан врагам в радиусе
    const sp = this.stunPulse || (this.stunPulse = { cd: 0, pulse: 0 });
    if (sp.pulse > 0) sp.pulse = Math.max(0, sp.pulse - dt * 4);
    if (sp.cd > 0) sp.cd = Math.max(0, sp.cd - dt);
    if (u.stats.stunPulse && sp.cd <= 0 && fired('stunPulse')) {
      const sr = this._artScaled('stun_pulse');   // радиус скалируется город-апгрейдом
      if (this.enemies) for (const e of this.enemies) { if (e.dead || e.dying || e.friendly) continue; if (Math.hypot(wrapDeltaPx(e.px, u.px), e.py - u.py) / TILE <= sr) e.stunT = Math.max(e.stunT || 0, STUN_PULSE_DUR); }
      sp.cd = STUN_PULSE_CD; sp.pulse = 1;
      if (this.fx) this.fx.hit(u.px, u.py, PAL.screwGreen, 10);
      if (this.logEvent) this.logEvent(STR.log.artStun);
    }

    // ПОДРЫВ-ЗАРЯД — взрыв у юнита (урон врагам + воронка), своих НЕ бьёт
    const bc = this.blastCharge || (this.blastCharge = { cd: 0 });
    if (bc.cd > 0) bc.cd = Math.max(0, bc.cd - dt);
    if (u.stats.blastCharge && bc.cd <= 0 && fired('blastCharge')) {
      this._artifactBlast(u.tileX, u.tileY);
      bc.cd = BLAST_CHARGE_CD;
      if (this.logEvent) this.logEvent(STR.log.artBlast);
    }

    // НАНО-РЕМОНТ — хил во времени
    const nr = this.nanoRepair || (this.nanoRepair = { healT: 0, cd: 0 });
    if (nr.cd > 0) nr.cd = Math.max(0, nr.cd - dt);
    if (nr.healT > 0) {
      nr.healT = Math.max(0, nr.healT - dt);
      u.hp = Math.min(u.stats.maxHp, u.hp + (this._artScaled('nano_repair') / NANO_REPAIR_TIME) * dt);   // объём хила скалируется город-апгрейдом
      if (this.fx && Math.random() < 0.4) this.fx.heal(u.px, u.py - TILE * 0.3);
      if (nr.healT <= 0) nr.cd = NANO_REPAIR_CD;
    } else if (u.stats.nanoRepair && nr.cd <= 0 && fired('nanoRepair')) {
      nr.healT = NANO_REPAIR_TIME;
      if (this.logEvent) this.logEvent(STR.log.artNano);
    }
  },

  // РЫВОК (реликт drive_dash): доп-действие — разовый рывок по взгляду через воздух. Запуск ДО unit.update (кадр уважит dashing).
  // Кулдаун game.dash.cd. Юнит ведёт _dashStep (unit.js). Породу не пробивает; зацеп/гравитация — обычным апдейтом на выходе.
  updateDash(dt) {
    const u = this.unit, s = u && u.stats; if (!s) return;
    const d = this.dash || (this.dash = { cd: 0 });
    if (!s.dash) { d.cd = 0; u.dashing = false; return; }
    if (d.cd > 0) d.cd = Math.max(0, d.cd - dt);
    if (u.dashing) return;                                   // уже в рывке — ждём завершения
    const blocked = u.frozenPrint || u.frozenImpulse || u.frozenHack || u.frozenSiege || u.flying;
    const keys = this.actionKeys('dash');
    if (d.cd <= 0 && !blocked && this.mode === 'playing' && !this.printMode && !this.atBase() && keys.length && this.input.pressed(...keys)) {
      const dir = u.faceX >= 0 ? 1 : -1, nx = wrapX(u.tileX + dir);
      if (u.tileY >= 0 && u.tileY < MAP_H && this.world.tileAt(nx, u.tileY).type === AIR) {   // есть куда рвануть (иначе холостое нажатие — кулдаун не тратим)
        u.dashing = true; u.dashDir = dir; u.dashRemain = Math.round(this._artScaled('drive_dash')); u.dashSpeed = DASH_SPEED; u.state = 0; u.progress = 0;   // дистанция скалируется город-апгрейдом
        d.cd = DASH_CD;
        if (this.logEvent && !this.debug) this.logEvent(STR.log.artDash);
      }
    }
  },

  // ГАРПУН (реликт harpoon): доп-действие — выстрел по взгляду, цепляется за ПЕРВУЮ стену в радиусе и притягивает юнита к ней
  // (через dash-машинерию _dashStep, скорость HARPOON_SPEED). Нет стены / стена вплотную → ХОЛОСТОЙ (трата кулдауна). Запуск ДО unit.update.
  updateHarpoon(dt) {
    const u = this.unit, s = u && u.stats; if (!s) return;
    const h = this.harpoon || (this.harpoon = { cd: 0, t: 0 });
    if (!s.harpoon) { h.cd = 0; h.t = 0; return; }
    if (h.cd > 0) h.cd = Math.max(0, h.cd - dt);
    if (h.t > 0) h.t = Math.max(0, h.t - dt);                 // таймер FX троса
    if (u.dashing) return;                                    // притяг в процессе
    const blocked = u.frozenPrint || u.frozenImpulse || u.frozenHack || u.frozenSiege || u.flying;
    const keys = this.actionKeys('harpoon');
    if (h.cd <= 0 && !blocked && this.mode === 'playing' && !this.printMode && !this.atBase() && keys.length && this.input.pressed(...keys)) {
      const dir = u.faceX >= 0 ? 1 : -1, range = s.harpoonRange || HARPOON_RANGE;
      let hitOff = -1;
      for (let d = 1; d <= range; d++) { const t = this.world.tileAt(wrapX(u.tileX + dir * d), u.tileY); if (!t) break; if (t.type === ROCK) { hitOff = d; break; } }
      h.cd = HARPOON_CD; h.t = HARPOON_FX_TIME; h.dir = dir;
      h.ay = u.py;                                            // якорь по Y — линия юнита
      if (hitOff >= 2) {                                      // стена с воздухом перед ней → ПРИТЯГ к последнему воздуху
        u.dashing = true; u.dashDir = dir; u.dashRemain = hitOff - 1; u.dashSpeed = HARPOON_SPEED; u.state = 0; u.progress = 0;
        h.dry = false; h.ax = (u.tileX + dir * hitOff) * TILE + TILE / 2;   // якорь = тайл стены
        if (this.logEvent && !this.debug) this.logEvent(STR.log.artHarpoon);
      } else {                                                // нет якоря в радиусе / стена вплотную → ХОЛОСТОЙ
        h.dry = true; h.ax = (u.tileX + dir * (hitOff >= 1 ? hitOff : range)) * TILE + TILE / 2;
        if (this.logEvent && !this.debug) this.logEvent(STR.log.artHarpoonDry);
      }
    }
  },

  // ДЕТЕКТОР ДАННЫХ (реликт ГОРОДА, ПАССИВ): пеленг+дистанция к БЛИЖАЙШЕМУ серверу с неизвлечёнными данными в радиусе.
  // Точный компас (в отличие от «живого» детектора загрязнения). Состояние — game.dataCompass; виджет — render_radar.drawDataCompass.
  updateDataDetector(dt) {
    if (!this.artifactHas || !this.artifactHas('data_detector') || !this.unit || !this.world) { this.dataCompass = null; return; }
    const u = this.unit, dc = this.dataCompass || (this.dataCompass = { dir: -Math.PI / 2, has: false, dist: 0, sig: 0, t: 0 });
    dc.t += dt;
    const range = (u.stats && u.stats.dataDetectR) || DATA_DETECT_R;
    let best = null, bestD = range + 1;
    for (const s of this.world.servers) {
      if (s.done) continue;                                  // данные уже извлечены — не цель
      let dx = s.tx - u.tileX; if (dx > MAP_W / 2) dx -= MAP_W; else if (dx < -MAP_W / 2) dx += MAP_W;
      const dy = s.ty - u.tileY, d = Math.hypot(dx, dy);
      if (d <= range && d < bestD) { bestD = d; best = { ang: Math.atan2(dy, dx), d }; }
    }
    dc.has = !!best;
    if (best) {
      let d2 = best.ang - dc.dir; d2 = Math.atan2(Math.sin(d2), Math.cos(d2));
      dc.dir += d2 * Math.min(1, dt * 8);                    // быстрый ТОЧНЫЙ доворот (детектор, не «ветер»)
      dc.dist = best.d; dc.sig += ((1 - best.d / range) - dc.sig) * Math.min(1, dt * 4);
    } else { dc.sig += (0 - dc.sig) * Math.min(1, dt * 3); dc.dist = 0; }
  },

  // ФОРСАЖ БУРА (реликт, ПАССИВ): нагрев от бурения (юнит ИЛИ винтовые щиты) → множитель силы (в drill-блоке/borers).
  // Перегрев (heat→1) → лок-кулдаун OVERDRIVE_CD: бур не копает, heat сливается. Зовётся ПОСЛЕ unit.update/updateBorers.
  updateDrillOverdrive(dt) {
    const u = this.unit, s = u && u.stats; if (!s) return;
    if (!s.drillOverdrive) { u.drillHeat = 0; u.drillOverheatT = 0; return; }
    if (u.drillOverheatT > 0) {                                               // ПЕРЕГРЕВ: лок, остываем
      u.drillOverheatT = Math.max(0, u.drillOverheatT - dt);
      u.drillHeat = Math.max(0, u.drillHeat - dt / OVERDRIVE_CD);
      u._overdriveIdle = 0;
      if (u.drillOverheatT <= 0 && this.logEvent && !this.debug) this.logEvent(STR.log.overdriveReady);
    } else {
      const working = u.drilling || (this.borers && this.borers.some((b) => b.drilling));   // бур юнита ИЛИ любой винтовой щит грызёт
      if (working) { u.drillHeat = Math.min(1, u.drillHeat + OVERDRIVE_HEAT_RISE * dt); u._overdriveIdle = 0; }
      else {
        u._overdriveIdle = (u._overdriveIdle || 0) + dt;   // микро-паузы проходки (копка↔продвижение) НЕ остужают — остываем только после grace простоя
        if (u._overdriveIdle > OVERDRIVE_COOL_GRACE) u.drillHeat = Math.max(0, u.drillHeat - OVERDRIVE_HEAT_COOL * dt);
      }
      if (u.drillHeat >= 1) { u.drillOverheatT = OVERDRIVE_CD; if (this.logEvent && !this.debug) this.logEvent(STR.log.overdriveOverheat); }   // перегрев → лок
    }
  },

  // РЕНТГЕН (реликт xray): доп-действие — ПОЛНОЕ снятие тумана (вскрытие в большом радиусе) → за XRAY_TIME радиус
  // стягивается обратно к радиусу сканера. ВРЕМЕННО (world.seen не трогаем — render_light.drawFog читает unit.xrayR). Кулдаун XRAY_CD.
  updateXray(dt) {
    const u = this.unit, s = u && u.stats; if (!s) return;
    const x = this.xray || (this.xray = { t: 0, cd: 0 });
    if (!s.xray) { x.t = 0; x.cd = 0; u.xrayR = 0; return; }
    if (x.cd > 0) x.cd = Math.max(0, x.cd - dt);
    if (x.t > 0) {                                            // активно: стягиваем радиус вскрытия полный→сканер за x.dur (скалируется город-апгрейдом)
      x.t = Math.max(0, x.t - dt);
      const baseR = Math.max(1, Math.round(s.scanR || SCANNER_R));
      u.xrayR = baseR + (XRAY_MAX_R - baseR) * (x.t / (x.dur || XRAY_TIME));
      if (x.t <= 0) { u.xrayR = 0; if (this.logEvent && !this.debug) this.logEvent(STR.log.artXrayEnd); }
    } else {
      u.xrayR = 0;
      const keys = this.actionKeys('xray');
      if (x.cd <= 0 && this.mode === 'playing' && !this.printMode && keys.length && this.input.pressed(...keys)) {
        x.dur = this._artScaled('xray'); x.t = x.dur; x.cd = XRAY_CD;   // время затухания скалируется; кулдаун стартует с активацией
        if (this.logEvent && !this.debug) this.logEvent(STR.log.artXray);
      }
    }
  },

  // Взрыв заряда: урон ВРАГАМ в радиусе (спад к краю) + воронка/обрушение породы (как мина), но ЮНИТА НЕ бьёт (свой заряд).
  _artifactBlast(cx, cy) {
    const px = (cx + 0.5) * TILE, py = (cy + 0.5) * TILE;
    const dmg = this._artScaled('blast_charge');   // урон скалируется город-апгрейдом (радиус фикс.)
    if (this.enemies) for (const e of this.enemies) {
      if (e.dead || e.dying || e.friendly || typeof e.damage !== 'function') continue;
      const d = Math.hypot(wrapDeltaPx(e.px, px), e.py - py) / TILE;
      if (d <= BLAST_CHARGE_R) e.damage(Math.round(dmg * (1 - d / BLAST_CHARGE_R)));
    }
    const R = Math.ceil(BLAST_CHARGE_R), R2 = BLAST_CHARGE_R * BLAST_CHARGE_R;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= R2) this.world.setAir(cx + dx, cy + dy);
    if (this.dust) for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, sp = TILE * (1 + Math.random() * 2.6); this.dust._grit(px, py, Math.cos(a) * sp, Math.sin(a) * sp - TILE * 0.6, Math.random() < 0.5); }
    if (this.fx) this.fx.hit(px, py, '#ff9a4a', 14);
  },
});
