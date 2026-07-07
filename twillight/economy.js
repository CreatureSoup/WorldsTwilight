'use strict';

// ЭКОНОМИКА ГОРОДА (Батч 8, реликты слота city — домешан в Game.prototype ПОСЛЕ game). Работает и в режиме истории (экономика ≠ бой).
// СИНТЕЗ (synth_iron/organic/crystal) — пассив-доход в банк города на смену ЦИКЛА (свой детект n≠_econLastCycle, не onCycleStart — тот гейтит story).
// КОНВЕРТЕР (converter) — на смену цикла плавит ДВА типа ресурса в ТРЕТИЙ по переключаемому рецепту (индексация редкости).
// ЭЛЕКТРОСТАНЦИЯ (power_plant) — жжёт органику из банка, продлевая жизнь города ПОСЛЕ истечения таймера гибернации, ДО урона по контурам
// (city.powerReserve = секунды форы; city._updateState держит контуры пока резерв>0). Виджеты — render_economy.js.
Object.assign(Game.prototype, {
  _econReset() {                                   // старт забега: сброс состояния экономики
    this._econLastCycle = this.cycle ? this.cycle.n : 1;
    this.converterMode = 0;                        // 0=выкл, 1..N=рецепт CONVERTER_RECIPES
    this.powerPlantOn = true;                      // электростанция включена по умолчанию (виджет выключает для экономии органики)
    this.crystalSplitOn = true;                    // расщепитель кристалла (узел amb_split) включён по умолчанию (виджет выключает)
    this._econFx = 0; this._powerBurning = false;
    if (this.city) this.city.powerReserve = 0;
  },

  _updateEconomy(dt) {
    if (this.mode !== 'playing' || !this.upgrades) return;
    const n = this.cycle ? this.cycle.n : 1;
    if (this._econLastCycle == null) this._econLastCycle = n;
    if (n !== this._econLastCycle) { for (let k = this._econLastCycle; k < n; k++) this._econCycleTick(); this._econLastCycle = n; }   // догоняем пропущенные циклы
    this._crystalSplitTick(dt);                    // ДО электростанции: расщепление восстанавливает таймер (преемптит горение органики)
    this._powerPlantTick(dt);
    if (this._econFx > 0) this._econFx = Math.max(0, this._econFx - dt);
  },

  // РАСЩЕПЛЕНИЕ КРИСТАЛЛА (узел amb_split): когда таймер гибернации истёк вне базы, ДО урона по контурам — если в банке города
  // есть кристалл и расщепитель включён, ОДИН кристалл удаляется, возвращая часть таймера (растёт от городского трека splitreturn).
  // Срабатывает лишь в момент истечения (`timer<=0.05`) → один кристалл на «продление», а не каждый кадр (таймер снова >0).
  _splitOn() { return (typeof metaHas === 'function' && metaHas('amb_split')) && this.crystalSplitOn; },
  _crystalSplitReturn() { return SPLIT_RETURN_BASE + ((this.upgrades && this.upgrades.levels && this.upgrades.levels.splitreturn) || 0) * SPLIT_RETURN_STEP; },
  _crystalSplitTick(dt) {
    const c = this.city; if (!c || c.dead) return;
    if (!this._splitOn() || this.atBase() || c.timer > 0.05) return;   // работает ТОЛЬКО когда таймер истёк вне базы
    if ((this.upgrades.bank.crystal || 0) <= 0) return;                // нет кристалла в банке — нечего расщеплять
    this.upgrades.bank.crystal -= 1;
    const ret = this._crystalSplitReturn();
    c.timer = Math.min(c.timerMax, c.timer + ret); c.dying = false;    // таймер снова жив → фаза не «гибель»
    const bx = (PRINTER.x + PRINTER.w / 2) * TILE, by = (PRINTER.y + 0.4) * TILE;
    if (this.fx) { this.fx.burst(bx, by, ['crystal']); this.fx.text(bx, by - TILE, STR.hud.econ.splitPop(Math.round(ret)), (typeof RESOURCE_DEFS !== 'undefined' && RESOURCE_DEFS.crystal && RESOURCE_DEFS.crystal.color) || '#c264e0'); }
    if (this.logEvent && !this.debug) this.logEvent(STR.log.crystalSplit(Math.round(ret)));
  },
  _crystalSplitToggle() { if (typeof metaHas === 'function' && metaHas('amb_split')) this.crystalSplitOn = !this.crystalSplitOn; },

  // СМЕНА ЦИКЛА: синтез-доход + конвертер (разовая переплавка за цикл).
  _econCycleTick() {
    const bank = this.upgrades.bank; let gained = false;
    for (const [id, type] of [['synth_iron', 'iron'], ['synth_organic', 'organic'], ['synth_crystal', 'crystal']]) {
      if (!this.artifactHas(id)) continue;
      const inc = Math.round(this._artScaled(id));
      if (inc > 0) { bank[type] = (bank[type] || 0) + inc; gained = true; }
    }
    if (this.artifactHas('converter') && this.converterMode > 0) {
      const r = CONVERTER_RECIPES[this.converterMode - 1];
      if (r && this._converterCanRun(r)) {
        for (const k in r.cost) bank[k] = Math.max(0, (bank[k] || 0) - r.cost[k]);
        const out = Math.max(1, Math.round(r.amt * this._artScaled('converter')));
        bank[r.out] = (bank[r.out] || 0) + out; gained = true;
      }
    }
    if (gained) { this._econFx = 0.7; if (this.fx && this.city) this.fx.burst((PRINTER.x + PRINTER.w / 2) * TILE, (PRINTER.y + 0.4) * TILE, []); }
  },

  _converterCanRun(r) { const bank = this.upgrades.bank; for (const k in r.cost) if ((bank[k] || 0) < r.cost[k]) return false; return true; },
  _converterRecipe() { return (this.converterMode > 0) ? CONVERTER_RECIPES[this.converterMode - 1] : null; },
  _converterCycle() {   // переключить рецепт (виджет/клавиша): выкл → рецепт1 → … → рецептN → выкл
    if (!this.artifactHas('converter')) return;
    this.converterMode = (this.converterMode + 1) % (CONVERTER_RECIPES.length + 1);
  },

  // ЭЛЕКТРОСТАНЦИЯ: пока основной таймер истёк вне базы и станция включена — жжёт органику из банка (1 шт → secPer секунд),
  // держа city.powerReserve>0. Резерв ТРАТИТ здесь (dt), city лишь читает его (>0 → контуры целы). Зовётся ДО city.update в цикле.
  _powerPlantTick(dt) {
    const c = this.city; if (!c) return;
    const on = this.artifactHas('power_plant') && this.powerPlantOn;
    c._powerOn = on;
    if (!on || this.atBase() || c.timer > 0.05) { this._powerBurning = false; return; }   // работает только после истечения таймера вне базы
    const secPer = this._artScaled('power_plant');
    if (c.powerReserve > 0) c.powerReserve = Math.max(0, c.powerReserve - dt);
    if (c.powerReserve <= 0 && (this.upgrades.bank.organic || 0) > 0) {
      this.upgrades.bank.organic -= 1; c.powerReserve = secPer;
      if (!this._powerBurning && this.logEvent && !this.debug) this.logEvent(STR.log.powerBurn);   // лог РАЗОВО на старте горения (не спамить каждую единицу)
      this._powerBurning = true;
    } else if (c.powerReserve <= 0) { this._powerBurning = false; }
  },
  _powerPlantToggle() { if (this.artifactHas('power_plant')) this.powerPlantOn = !this.powerPlantOn; },
  _powerPlantRate() { return this._artScaled('power_plant'); },   // сек форы за 1 органику (виджет)

  // Клик по HUD-чипам экономики (роутинг из game.js): конвертер → смена рецепта, электростанция → вкл/выкл.
  _econClick(x, y) {
    const inRect = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    if (inRect(this._converterRect)) { this._converterCycle(); return true; }
    if (inRect(this._powerPlantRect)) { this._powerPlantToggle(); return true; }
    if (inRect(this._splitRect)) { this._crystalSplitToggle(); return true; }
    return false;
  },
});
