'use strict';

// Артефакты (домешан в Game.prototype, ПОСЛЕ game). Большие погребённые объекты (world.genArtifacts):
// откопал тайл рядом с юнитом → `world.setAir` ставит `a.dug`; `_checkArtifacts` (в playing-цикле) ловит
// откопанный неразрешённый артефакт ВОЗЛЕ юнита и открывает модалку (mode 'artifact', мир заморожен как
// пауза). Выбор: 0 ТЕХНОЛОГИЯ (особое свойство — эффекты позже) · 1 ДАННЫЕ городу (кодекс) · 2 ПЕРЕРАБОТКА
// (ресурсы лутом). После выбора объект ПОТРЕБЛЁН (тайлы в воздух), мир размораживается. Рендер — render_artifact.
Object.assign(Game.prototype, {
  // ── СЛОТЫ артефактов (3 типа: city/unit/drone, по ARTIFACT_SLOT_CAP). ЗАЛОЧЕНО при установке: слот занят → только Данные/Переработка. ──
  artifactHas(id) { const sl = this.artifactSlots; return !!sl && (sl.city.includes(id) || sl.unit.includes(id) || sl.drone.includes(id)); },
  // ── ГОРОДСКИЕ АПГРЕЙДЫ артефактов (Батч 6): уровень из upgrades + скалированное значение эффекта (единый источник ARTIFACT_UP). ──
  _artLvl(id) { return (this.upgrades && this.upgrades.levels && this.upgrades.levels['art_' + id]) || 0; },
  _artScaled(id) { const u = (typeof ARTIFACT_UP !== 'undefined') && ARTIFACT_UP[id]; if (!u) return 0; return u.base + Math.min(this._artLvl(id), u.cap) * u.step; },
  _installedArtifactIds() { const sl = this.artifactSlots; return sl ? [].concat(sl.city || [], sl.unit || [], sl.drone || []) : []; },
  // ЁМКОСТЬ слота: база + узлы меты kart_slot_<city|unit|drone> (+1 каждый). Единый источник — везде читать ЭТО, не ARTIFACT_SLOT_CAP напрямую.
  _artifactSlotCap(slot) { return (ARTIFACT_SLOT_CAP[slot] || 0) + ((typeof metaHas === 'function' && metaHas('kart_slot_' + slot)) ? 1 : 0); },
  _artifactSlotUsed(slot) { const sl = this.artifactSlots; return (sl && sl[slot]) ? sl[slot].length : 0; },
  artifactSlotFree(slot) { return this._artifactSlotUsed(slot) < this._artifactSlotCap(slot); },
  // Проброс эффектов установленных артефактов в unit.stats/город. Зовётся ПОСЛЕ каждого setStats (onChange) и на установку —
  // иначе пересборка статов апгрейдом стёрла бы флаги. Боевые/щитовые эффекты гейтятся прямо через artifactHas(id).
  _applyArtifacts() {
    const s = this.unit && this.unit.stats;
    if (s) {
      s.jets = this.artifactHas('jets');                                            // активная способность → кнопка в ACTION_DEFS (флаг-стат)
      s.lootMagnet = this.artifactHas('loot_magnet') ? ARTIFACT_MAGNET_R : 0;         // лут-магнит → радиус подхвата (loot.update)
      s.combatDrill = this.artifactHas('combat_drill');                              // бой-бур → контактный урон (artifact._combatDrillTick)
      // БАТЧ 1 — защита/бур (эффекты в unit.hurt() / drill-блоке; поля юнита наполняются регеном/КД сами). Значения скалируются город-апгрейдом (_artScaled).
      s.armorMult = this.artifactHas('armor') ? this._artScaled('armor') : 0;          // бронепластины: −% урона
      s.overshieldMax = this.artifactHas('overshield') ? this._artScaled('overshield') : 0;   // энергощит: ёмкость буфера
      s.absorbMax = this.artifactHas('absorb') ? Math.round(this._artScaled('absorb')) : 0;   // поглощение: число зарядов (1→3)
      s.absorbCd = ABSORB_CD;
      s.thorns = this.artifactHas('thorns');                                          // шипы: контактному врагу урон назад
      s.thornsDmg = this.artifactHas('thorns') ? this._artScaled('thorns') : 0;        // урон ответки (unit.hurt читает s.thornsDmg)
      s.echoDrill = this.artifactHas('echo_drill');                                   // эхо-бур: шанс пробить соседний тайл
      s.echoDrillChance = this.artifactHas('echo_drill') ? this._artScaled('echo_drill') : 0;   // шанс эха (unit.js читает s.echoDrillChance)
      s.overdriveBonus = this.artifactHas('drill_overdrive') ? this._artScaled('drill_overdrive') : 0;   // форсаж: прибавка силы на пике нагрева (unit/borers)
      s.harpoonRange = this.artifactHas('harpoon') ? this._artScaled('harpoon') : 0;   // гарпун: длина (updateHarpoon)
      s.dataDetectR = this.artifactHas('data_detector') ? this._artScaled('data_detector') : 0;   // детектор данных: радиус (updateDataDetector)
      // БАТЧ 2 — активные доп-действия (логика — artifacts_active.js; флаг = кнопка в ACTION_DEFS)
      s.stunPulse = this.artifactHas('stun_pulse');                                   // ЭМИ-импульс: стан врагам в радиусе
      s.blastCharge = this.artifactHas('blast_charge');                               // подрыв-заряд: взрыв у юнита (своих не бьёт)
      s.nanoRepair = this.artifactHas('nano_repair');                                 // нано-ремонт: хил во времени
      // БАТЧ 3 — сложные активки/пассивы (логика — artifacts_active.js + хуки в unit/borers)
      s.drillOverdrive = this.artifactHas('drill_overdrive');                         // форсаж бура: нагрев→множитель, перегрев→лок (ПАССИВ, без кнопки)
      s.dash = this.artifactHas('drive_dash');                                        // рывок: доп-действие — авто-проходка по воздуху по взгляду
      s.harpoon = this.artifactHas('harpoon');                                        // гарпун: доп-действие — притяг к стене по взгляду (длина — город-апгрейд harpoonRange)
      s.xray = this.artifactHas('xray');                                              // рентген: доп-действие — полное снятие тумана с затуханием к радиусу сканера
      s.droneHack = this.artifactHas('drone_hacker');                                 // дрон-хакер: доп-действие (деплой); прочие дроны — пассивные компаньоны (без кнопки)
    }
    if (this._syncDrone) this._syncDrone();                                           // БАТЧ 5 — компаньон-дрон по дрон-слоту (collector/courier/battery/scout/hacker)
    if (this.upgrades && this.upgrades.syncArtifactTracks) this.upgrades.syncArtifactTracks(this._installedArtifactIds());   // БАТЧ 6 — динамические треки апгрейда установленных артефактов
    if (this.city) {                                                                // щит города — буфер на city (city.js перехватывает урон)
      const sh = this.artifactHas('city_shield'), shieldHp = sh ? this._artScaled('city_shield') : 0;
      if (sh && this.city.shieldMax <= 0) this.city.shield = shieldHp;                // ПЕРВАЯ установка → купол сразу полон (без стартового штрафа на реген)
      this.city.shieldMax = shieldHp;
      if (!sh) this.city.shield = 0;
    }
  },
  // БОЙ-БУР: пока установлен, врагам в контакте с юнитом капает урон (юнит обретает «рукопашную» буром).
  _combatDrillTick(dt) {
    if (!this.artifactHas('combat_drill') || !this.unit || !this.enemies) return;
    const u = this.unit;
    for (const e of this.enemies) {
      if (e.dying || e.dead || e.friendly) continue;
      if (Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE <= COMBAT_DRILL_R) {
        e.damage(this._artScaled('combat_drill') * dt);
        if (this.dust && Math.random() < 0.3) { const a = Math.random() * TAU; this.dust._grit(e.px, e.py, Math.cos(a) * TILE, Math.sin(a) * TILE - TILE * 0.4, true); }   // искры контакта
      }
    }
  },
  // ВСЕ тайлы артефакта откопаны (в воздухе)? — активация только когда объект ПОЛНОСТЬЮ освобождён от породы.
  artifactExcavated(a) {
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) if (this.world.tileAt(wrapX(a.tx + dx), a.ty + dy).type !== AIR) return false;
    return true;
  },
  _checkArtifacts() {
    if (this.mode !== 'playing' || this.pendingArtifact || !this.world || !this.unit) return;
    for (const a of this.world.artifacts) {
      if (a.resolved || !this.artifactExcavated(a)) continue;   // ждём ПОЛНОЙ откопки (не первый тайл)
      const acx = (a.tx + a.w / 2) * TILE, acy = (a.ty + a.h / 2) * TILE;
      if (Math.hypot(wrapDeltaPx(this.unit.px, acx), this.unit.py - acy) / TILE <= ARTIFACT_TRIGGER_R) { this.openArtifact(a); break; }
    }
  },
  // ── ВЫБОР ТЕХНО в модалке (a._offer). Всегда есть родная a.tech; узел kart_dual добавляет 2-ю АЛЬТЕРНАТИВНУЮ техно из пула. ──
  _rollOfferTech(exclude) {   // случайная техно из пула, НЕ в exclude и НЕ уже установленная; ПРИОРИТЕТ — техно в СВОБОДНЫЙ слот
    const pool = ARTIFACT_POOL.filter((d) => exclude.indexOf(d.id) < 0 && !this.artifactHas(d.id) && !(this.storyMode && d.combat));   // в истории боевые (атака/защита-от-врагов) вне пула — некого бить/защищать
    if (!pool.length) return null;
    const free = pool.filter((d) => this.artifactSlotFree(d.slot));   // не предлагать техно в занятый слот (была бы залоченной, впустую); полностью-залоченные — только если свободных нет
    const src = free.length ? free : pool;
    return src[Math.floor(Math.random() * src.length)];
  },
  _buildArtifactOffer(a) {
    let primary = a.tech;
    if (this.storyMode && primary && primary.combat) { const sub = this._rollOfferTech([]); if (sub) primary = sub; }   // родная техно боевая, а мы в истории → подменяем не-боевой (реликт откопан, но анализатор перепрофилируем)
    a._offer = [primary];
    if (typeof metaHas === 'function' && metaHas('kart_dual')) { const alt = this._rollOfferTech([primary.id]); if (alt) a._offer.push(alt); }
  },
  // ПОВТОРНЫЙ АНАЛИЗ (узел kart_reroll): заменить предложенные техно другими, не выходя из модалки. Цена — КРИСТАЛЛЫ трюма. Лимит на забег: 1 (+1 за kart_reroll2).
  artifactRerollMax() { return (typeof metaHas === 'function' && metaHas('kart_reroll')) ? (1 + (metaHas('kart_reroll2') ? 1 : 0)) : 0; },
  artifactRerollsLeft() { return Math.max(0, this.artifactRerollMax() - (this.artifactRerolls || 0)); },
  artifactCanReroll() { return this.artifactRerollsLeft() > 0 && this.inventory && (this.inventory.cargo.crystal || 0) >= ARTIFACT_REROLL_COST; },
  _artifactReroll() {
    const a = this.pendingArtifact; if (!a || !a._offer || !this.artifactCanReroll()) return false;
    this.inventory.cargo.crystal -= ARTIFACT_REROLL_COST;   // списываем НЕСОМЫЙ кристалл (в поле, у анализатора)
    this.artifactRerolls = (this.artifactRerolls || 0) + 1;
    const fresh = [], ex = a._offer.map((t) => t.id);       // новые техно ОТЛИЧАЮТСЯ от текущего набора и друг от друга
    for (let i = 0; i < a._offer.length; i++) { const t = this._rollOfferTech(ex); if (!t) break; fresh.push(t); ex.push(t.id); }
    if (fresh.length) a._offer = fresh;
    if (this.artifactSel > a._offer.length + 1) this.artifactSel = 0;
    if (this.logEvent) this.logEvent(STR.log.artifactReroll);
    return true;
  },
  openArtifact(a) {
    this.pendingArtifact = a; this.artifactSel = 0; this._artChoose = null; this.mode = 'artifact';
    this._buildArtifactOffer(a);
    if (this.logEvent) this.logEvent(STR.log.artifactDug);
    // ГЛОССАРИЙ + лог про ТИП реликта — РАЗОВО на тип: codexDiscover персистит found-set в save.codex и сам гейтит «первую встречу»
    // (повторная находка того же типа → codexDiscover вернёт null, дубля не будет). Карта id→запись — поле `gloss` в ARTIFACT_POOL.
    const def = a && a.tech, eid = def && def.gloss;
    if (eid && typeof codexDiscover === 'function') {
      const e = codexDiscover(eid);
      if (e && this.logEvent) this.logEvent(STR.log.detected((e.name || def.name).toUpperCase()));
    }
  },
  _artifactConsume(a) {   // потребить объект — все его тайлы в воздух (noTrigger: не сыпать породу сверху)
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) this.world.setAir(wrapX(a.tx + dx), a.ty + dy, true);
    if (this.world.radSources) this.world.radSources = this.world.radSources.filter((s) => s.artifact !== a);   // извлечён артефакт → гаснет привязанный очаг радиации
  },
  // Клик/Enter по карте: запускает АНИМАЦИЮ выбора (остальные карты сворачиваются в центр, выбранная разгорается),
  // по концу (_artChoose.t≥dur, тик в game loop) → _artifactResolve применяет эффект. idx<N — техно; idx==N — данные; idx==N+1 — переработка.
  artifactChoose(idx) {
    const a = this.pendingArtifact; if (!a || this._artChoose) return;   // уже анимируется — игнор
    const offer = a._offer || [a.tech], n = offer.length;
    if (idx < n && !this.artifactSlotFree(offer[idx].slot)) return;      // слот занят (DK-модель) → выбор недоступен, без анимации
    this._artChoose = { idx, t: 0, dur: ARTIFACT_CHOOSE_ANIM };          // старт анимации; применение — по её концу
  },
  // Применение выбранной карты (после анимации). Раскладка: [техно×N] · ДАННЫЕ · ПЕРЕРАБОТКА.
  _artifactResolve(idx) {
    const a = this.pendingArtifact; if (!a) return;
    const offer = a._offer || [a.tech], n = offer.length;
    if (idx < n) {                                     // УСТАНОВИТЬ ТЕХНОЛОГИЮ в слот (если свободен — иначе залочено, no-op)
      const def = offer[idx];
      if (!this.artifactSlotFree(def.slot)) { this.pendingArtifact = null; this.mode = 'playing'; return; }
      this.artifactSlots[def.slot].push(def.id);
      this._applyArtifacts();
      if (def.gloss && typeof codexDiscover === 'function') codexDiscover(def.gloss);   // альтернативную техно тоже занести в кодекс при установке
      if (this.logEvent) this.logEvent(STR.log.techExtracted(def.name));
    } else if (idx === n) {                            // ОТДАТЬ ГОРОДУ — ДАННЫЕ
      this.dataCount = (this.dataCount || 0) + 1;
      { const r = this._dataGain(ARTIFACT_DATA); if (r && typeof codexPopupShow === 'function') codexPopupShow(r, this._codexAnchor()); }   // множитель kart_data учитывается
      if (this.logEvent) this.logEvent(STR.log.artifactDataGiven);
    } else {                                           // ПЕРЕРАБОТАТЬ — РЕСУРСЫ (дроп лутом из центра)
      const keys = Object.keys(RESOURCE_DEFS), cx = a.tx + a.w / 2, cy = a.ty + a.h / 2;
      if (this.loot) for (let i = 0; i < ARTIFACT_SCRAP; i++) this.loot.spawn(wrapX(Math.round(cx + (Math.random() * 2 - 1))), Math.max(0, Math.round(cy + (Math.random() * 2 - 1))), keys[Math.floor(Math.random() * keys.length)]);
      if (this.logEvent) this.logEvent(STR.log.artifactRecycled);
    }
    a.resolved = true; this._artifactConsume(a);
    this.pendingArtifact = null; this._artChoose = null; this.mode = 'playing';
  },
  // ЛКМ по модалке: сперва кнопка ПОВТОРНЫЙ АНАЛИЗ (rect кладёт рендер), затем карты выбора (game._artifactRects).
  artifactClick(x, y) {
    if (this._artChoose) return;   // идёт анимация выбора — клики заблокированы
    const rr = this._artifactRerollRect;
    if (rr && x >= rr.x && x <= rr.x + rr.w && y >= rr.y && y <= rr.y + rr.h) { this._artifactReroll(); return; }
    const r = this._artifactRects; if (!r) return;
    for (let i = 0; i < r.length; i++) if (x >= r[i].x && x <= r[i].x + r[i].w && y >= r[i].y && y <= r[i].y + r[i].h) { this.artifactChoose(i); return; }
  },
});
