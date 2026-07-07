'use strict';

// ВЗЛОМ ЮНИТОВ (домешан в Game.prototype ПОСЛЕ game). НЕ отдельный модуль — способность МОДУЛЯ ВЗЛОМА (mod_hack),
// включается узлом `kart_stun` (s.jam ставит inventory.getStats при m.hack && metaHas('kart_stun')). Все взломы — от одного модуля взлома.
// ДОП-действие (цифра от менеджера действий, actionbar.js): РАЗОВЫЙ импульс-ГЛУШЕНИЕ — все боевые враги в радиусе
// JAM_PULSE_R получают `slowT` (как от глушилки-структуры → скорость ×JAM_SLOW) на JAM_PULSE_DUR сек, потом кулдаун.
// Переиспользует механику замедления врага (enemy.slowT / JAM_SLOW), но как ИМПУЛЬС юнита, а не стационарная аура.
// Состояние — `this.jam = {cd, pulse}` (pulse — фаза кольца-визуала). Рендер — render_jam.js.

Object.assign(Game.prototype, {
  jamActive() { return !!(this.unit && this.unit.stats && this.unit.stats.jam); },

  updateJam(dt) {
    const u = this.unit;
    const j = this.jam || (this.jam = { cd: 0, pulse: 0 });
    if (j.pulse > 0) j.pulse = Math.max(0, j.pulse - dt / JAM_FX_TTL);   // спад визуала кольца
    if (j.cd > 0) j.cd = Math.max(0, j.cd - dt);
    if (!u || !this.jamActive()) return;

    const ctx = this.mode === 'playing' && !this.atBase() && !this.printMode;
    const keys = this.actionKeys('jam');                 // клавиша назначена менеджером действий
    if (ctx && j.cd <= 0 && keys.length && this.input.pressed(...keys)) {
      this._jamPulse();
      j.cd = JAM_PULSE_CD; j.pulse = 1;
      if (this.logEvent) this.logEvent(STR.log.jamPulse);
    }
  },

  // Импульс: всем боевым врагам в радиусе ставим slowT (глушение). Тор по X через wrapDeltaPx.
  _jamPulse() {
    const u = this.unit; if (!u || !this.enemies) return;
    for (const e of this.enemies) {
      if (e.dead || e.dying || e.friendly) continue;
      const d = Math.hypot(wrapDeltaPx(e.px, u.px), e.py - u.py) / TILE;
      if (d <= JAM_PULSE_R) e.slowT = Math.max(e.slowT || 0, JAM_PULSE_DUR);
    }
  },
});
