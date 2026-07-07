'use strict';

// ПРЫЖКОВЫЕ ДВИЖКИ — артефакт ЮНИТА (домешан в Game.prototype, ПОСЛЕ game). Доп-действие (цифра от менеджера,
// actionKeys('jets')): ТУМБЛЕР (жать = ВКЛ/ВЫКЛ, не удержание) → ПОЛЁТ через воздух (unit.flying → unit._flyStep).
// Топливо тратится в полёте (JETS_FUEL_MAX сек), опустело → АВТО-ВЫКЛ + ЛОК (JETS_CD) + дозаправка (JETS_REFILL вне
// полёта). Кончилось топливо в воздухе → flying off → юнит ПАДАЕТ (риск/драма). game.jets={fuel,cd,on}. Эффект-флаг — unit.stats.jets
// (artifact._applyArtifacts). Рендер — render_jets.js. Кнопку/цифру в панель добавляет actionbar по флагу stats.jets.

Object.assign(Game.prototype, {
  jetsActive() { return !!(this.unit && this.unit.stats && this.unit.stats.jets); },

  updateJets(dt) {
    const u = this.unit, j = this.jets || (this.jets = { fuel: JETS_FUEL_MAX, cd: 0, on: false });
    j.max = this.jetsActive() ? this._artScaled('jets') : JETS_FUEL_MAX;   // ёмкость топлива скалируется город-апгрейдом (виджет берёт j.max)
    if (!this.jetsActive()) { j.on = false; if (u) u.flying = false; j.fuel = j.max; j.cd = 0; return; }
    if (j.cd > 0) j.cd = Math.max(0, j.cd - dt);
    const keys = this.actionKeys('jets');
    const pressed = keys.some((k) => this.input && this.input.pressed && this.input.pressed(k));   // РЁБРО нажатия (ВКЛ/ВЫКЛ), не удержание
    // полёт несовместим с любыми «замораживающими» режимами (печать/заряды/взлом) — там юнит залочен
    const blocked = u.frozenPrint || u.frozenImpulse || u.frozenHack || u.frozenSiege;
    if (blocked) j.on = false;                                            // залочен режимом — принудительно выкл
    else if (pressed && j.cd <= 0) j.on = j.on ? false : (j.fuel > 0);    // ТУМБЛЕР: жать = вкл/выкл (ВКЛ только при топливе)
    if (j.on) {
      u.flying = true;
      j.fuel = Math.max(0, j.fuel - dt);
      if (j.fuel <= 0) { j.on = false; u.flying = false; j.cd = JETS_CD; }   // топливо иссякло → АВТО-ВЫКЛ + лок + юнит падает
    } else {
      u.flying = false;
      if (j.fuel < j.max) j.fuel = Math.min(j.max, j.fuel + JETS_REFILL * dt);   // дозаправка вне полёта
    }
  },
});
