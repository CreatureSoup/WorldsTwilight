'use strict';

// ДИКИЙ ГОРОД КАК ЦЕЛЬ — общий стержень директивы «устрани угрозу» (домешано в Game.prototype ПОСЛЕ game.js).
// Дикие гнёзда (`world.wilds`, источники волн) ИЗНАЧАЛЬНО имеют hp/maxHp (WILD_HP), но урон по ним нигде
// не наносился. Три инструмента ведут hp→0 (или взлом — отдельным метром): осадный модуль юнита (siege.js),
// осадная башня (structures.js, b:'siege'), контр-взлом (hack.js). Любой добивает гнездо до `disabled`.
// При disabled: спавн из гнезда прекращается (ai.onCycleStart фильтрует !disabled), маркер гаснет.
// Когда ВСЕ дикие гнёзда disabled → ПОБЕДА (overReason 'threat_win', как hack-win). Рендер маркера/HP — render_world.js.

Object.assign(Game.prototype, {
  // Сердце гнезда — на ПОЛУ каверны (как у спящих городов в hack.js): досягаемо юнитом, осадой и взломом.
  wildHeart(w) { return { hx: (w.cx + 0.5) * TILE, hy: (w.floorY + 0.5) * TILE }; },

  // Ближайшее ЖИВОЕ дикое гнездо в радиусе (тайлы) от точки px,py — для осадных орудий/контр-взлома.
  nearestWild(px, py, rTiles) {
    const ws = this.world && this.world.wilds; if (!ws) return null;
    let best = null, bd = rTiles;
    for (const w of ws) {
      if (w.disabled) continue;
      const h = this.wildHeart(w);
      const d = Math.hypot(wrapDeltaPx(px, h.hx), py - h.hy) / TILE;
      if (d <= bd) { bd = d; best = { wild: w, dist: d, hx: h.hx, hy: h.hy }; }
    }
    return best;
  },

  // Урон по hp гнезда (осадные орудия). hitT — вспышка для рендера. hp≤0 → подавление.
  damageWild(w, dmg) {
    if (!w || w.disabled) return;
    w.hp = Math.max(0, (w.hp || 0) - dmg);
    w.hitT = WILD_HIT_FLASH;
    if (w.hp <= 0) this._disableWild(w);
  },

  // Гнездо ПОДАВЛЕНО (hp=0 или взлом-нейтрализация): волны из него больше не идут, маркер гаснет.
  _disableWild(w) {
    if (!w || w.disabled) return;
    w.disabled = true; w.hp = 0;
    if (this.logEvent) this.logEvent(STR.log.wildDown);
    this._checkThreatCleared();
  },

  // Гнездо САБОТИРОВАНО (полный взлом БЕЗ узла нейтрализации): живо, но волны из него замедлены (см. _waveSlowFactor).
  _sabotageWild(w) {
    if (!w || w.disabled || w.saboted) return;
    w.saboted = true;   // взлом залочен (не спадает); breach остаётся как есть (база ≥порога / нейтрализация копит ДАЛЬШЕ)
    if (this.logEvent) this.logEvent(STR.log.wildSaboted);
  },

  // Замедление макро-цикла от взлома гнёзд: каждое гнездо ∝ своему прогрессу взлома (полный/саботаж = максимум).
  // Подавленные (disabled) не считаются — их уже нет. 1 = без замедления; перемножаем по гнёздам.
  _waveSlowFactor() {
    const ws = this.world && this.world.wilds; if (!ws) return 1;
    let f = 1;
    for (const w of ws) {
      if (w.disabled || !w.breach) continue;
      const r = Math.min(1, w.breach / WILD_BREACH_SEG);
      f *= 1 - r * (1 - WILD_SABOTAGE_SLOW);
    }
    return f;
  },

  // Все ли дикие гнёзда подавлены → ПОБЕДА (зеркало _finishHackWin, но без кат-сцены реактора).
  _checkThreatCleared() {
    if (this._threatCleared) return;
    const ws = this.world && this.world.wilds; if (!ws || !ws.length) return;
    if (ws.some((w) => !w.disabled)) return;            // ещё есть живые — рано
    this._threatCleared = true;
    this.directivesDone = (this.directivesDone || 0) + 1;
    this.overReason = 'threat_win';
    if (this.logEvent) this.logEvent(STR.log.threatCleared);
    this.mode = 'gameover';
  },

  // Тик гнёзд в playing: спад вспышки попадания (логика без Canvas).
  updateWilds(dt) {
    const ws = this.world && this.world.wilds; if (!ws) return;
    for (const w of ws) if (w.hitT > 0) w.hitT = Math.max(0, w.hitT - dt);
  },
});
