'use strict';

// СТЕЛС-МОДУЛЬ (домешан в Game.prototype ПОСЛЕ game). Доп-слот `mod_stealth` (s.stealth, unlock kart_stealth).
// ДОП-действие (цифра от менеджера действий, actionbar.js): РАЗОВАЯ активация (как радар/эхо, по кулдауну, не удержание)
// → юнит НЕВИДИМ для боевых врагов на STEALTH_DUR сек: охотник/снайпер теряют цель и не наводятся (ai.js читает
// `unit.stealthT`). Юнит при этом продолжает двигаться (без заморозки). Состояние — `this.stealth = {t, cd}`. Рендер — render_stealth.js.
// ⚠️ Не путать с дикими копателями/собирателями — они и так целят базу/ресурс, не юнит; стелс спасает от ВОЗДУШНЫХ боевых.

Object.assign(Game.prototype, {
  stealthActive() { return !!(this.unit && this.unit.stats && this.unit.stats.stealth); },

  updateStealth(dt) {
    const u = this.unit;
    const s = this.stealth || (this.stealth = { t: 0, cd: 0 });
    if (!u || !this.stealthActive()) { s.t = 0; s.cd = 0; if (u) u.stealthT = 0; return; }
    if (s.t > 0) s.t = Math.max(0, s.t - dt);
    if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);

    const ctx = this.mode === 'playing' && !this.atBase() && !this.printMode;
    const keys = this.actionKeys('stealth');                 // клавиша назначена менеджером действий
    if (ctx && s.t <= 0 && s.cd <= 0 && keys.length && this.input.pressed(...keys)) {
      s.t = STEALTH_DUR; s.cd = STEALTH_CD;
      if (this.logEvent) this.logEvent(STR.log.stealthOn);
    }
    u.stealthT = s.t;   // зеркалим на юнит ПОСЛЕ активации (без лага) — ai.js (охотник/снайпер) читает для невидимости
  },
});
