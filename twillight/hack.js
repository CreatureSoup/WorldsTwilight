'use strict';

// ВЗЛОМ ГОРОДА — единая механика хакинга (домешано в Game.prototype ПОСЛЕ game.js, как scanners/impulse).
// Модуль взлома (`MODULE_DEFS.mod_hack`, доп-слот, `s.hack`, unlock `kart_defuse`; взлом ГОРОДОВ гейтит узел
// `kart_wake` — см. updateHack) — ДОП-действие (цифра 2):
// удержанием у СЕРДЦА спящего города (центр каверны, радиус HACK_RADIUS — короче скана) копит канал HACK_TIME
// → пробуждение (`cavern.awoken`). Канал ЗАМОРАЖИВАЕТ юнит (`unit.frozenHack`, как импульс-заряд); отпустил/ушёл —
// прогресс спадает (HACK_DECAY). Визуально ОТЛИЧАЕТСЯ от скана (render_hack.js: лиловый рваный тетер + кольцо-прогресс).
// Логика без Canvas; рендер — render_hack.js. ЭТАП 2.2 — дружественная фракция, 2.3 — таймер победы (kart_hackcity).

Object.assign(Game.prototype, {
  _hackInit() { this.activeHack = null; },   // {city, t} активного канала в этом кадре (для рендера); null = не взламываем

  updateHack(dt) {
    this.activeHack = null;
    const u = this.unit; if (!u) return;
    // нужен МОДУЛЬ ВЗЛОМА (s.hack, открыт узлом kart_defuse) + хотя бы один режим:
    //   kart_wake — взлом СПЯЩИХ городов (пробуждение, дружественная фракция),
    //   kart_jam  — КОНТР-ВЗЛОМ ДИКИХ городов (зеркало файрволла: канал → сегменты пролома → ПОДАВЛЕНИЕ гнезда).
    const canWake = typeof metaHas === 'function' && metaHas('kart_wake');
    const canBreach = typeof metaHas === 'function' && metaHas('kart_jam');        // САБОТАЖ диких гнёзд (замедление волн)
    const canNeutralize = typeof metaHas === 'function' && metaHas('kart_breach');  // АПГРЕЙД: полное ПОДАВЛЕНИЕ
    const w = this.world;
    if (!u.stats || !u.stats.hack || this.printMode || (!canWake && !canBreach) || !w) { u.frozenHack = false; this._breachDecay(dt); return; }
    // ближайшая цель в радиусе у СЕРДЦА (на ПОЛУ каверны/гнезда, где юнит стоит): СПЯЩИЙ (wake) ИЛИ ДИКИЙ (breach).
    let target = null, mode = null, best = 1e9, thx = 0, thy = 0;
    if (canWake && w.caverns) for (const c of w.caverns) {
      if (c.awoken) continue;
      const hx = (c.cx + 0.5) * TILE, hy = (c.floorY + 0.5) * TILE;
      const d = Math.hypot(wrapDeltaPx(u.px, hx), u.py - hy) / TILE;
      if (d <= HACK_RADIUS && d < best) { best = d; target = c; mode = 'wake'; thx = hx; thy = hy; }
    }
    if (canBreach && w.wilds) for (const wd of w.wilds) {
      if (wd.disabled || (wd.saboted && !canNeutralize)) continue;   // подавленные / уже саботированные (без апгрейда — нечего ловить)
      const h = this.wildHeart(wd);
      const d = Math.hypot(wrapDeltaPx(u.px, h.hx), u.py - h.hy) / TILE;
      if (d <= HACK_RADIUS && d < best) { best = d; target = wd; mode = 'breach'; thx = h.hx; thy = h.hy; }
    }
    const keys = this.actionKeys('hack');   // цифра назначена менеджером действий (actionbar.js)
    const held = !!(this.input && this.input.keys && keys.some((k) => this.input.keys.has(k)));
    if (target && held) {
      u.frozenHack = true;
      if (mode === 'wake') {
        target.hackT = Math.min(1, (target.hackT || 0) + dt / HACK_TIME);
        this.activeHack = { city: target, t: target.hackT, hx: thx, hy: thy };
        if (target.hackT >= 1) this._wakeCity(target);
      } else {
        const cap = canNeutralize ? WILD_NEUTRALIZE_SEG : WILD_BREACH_SEG;   // апгрейд тянет канал ДАЛЬШЕ (нейтрализация дольше саботажа)
        target.breach = Math.min(cap, (target.breach || 0) + dt / WILD_BREACH_TIME);
        if (target.breach >= WILD_BREACH_SEG && !target.saboted) this._sabotageWild(target);   // порог САБОТАЖА (замедление) — общий для обоих тиров
        this.activeHack = { wild: target, t: target.breach / cap, seg: cap, hx: thx, hy: thy, breach: true, neutralize: canNeutralize };
        if (canNeutralize && target.breach >= WILD_NEUTRALIZE_SEG) this._disableWild(target);   // АПГРЕЙД: дальше саботажа → ПОДАВЛЕНИЕ (директива)
      }
    } else {
      u.frozenHack = false;
      if (w.caverns) for (const c of w.caverns) if (!c.awoken && c.hackT) c.hackT = Math.max(0, c.hackT - dt * HACK_DECAY);   // спад частичного пробуждения
      this._breachDecay(dt);
    }
  },

  // Спад незавершённого пролома диких гнёзд, когда канал отпущен (накопительно, но не «вечно»).
  _breachDecay(dt) {
    const w = this.world; if (!w || !w.wilds) return;
    for (const wd of w.wilds) if (!wd.disabled && !wd.saboted && wd.breach) wd.breach = Math.max(0, wd.breach - dt * WILD_BREACH_DECAY);   // саботированное залочено
  },

  _wakeCity(c) {
    c.awoken = true; c.hackT = 1;
    if (this.unit) this.unit.frozenHack = false;
    (this.awakenedCaverns || (this.awakenedCaverns = [])).push(c);
    if (this.logEvent) this.logEvent(STR.log.cityHacked((c.name || '').toUpperCase()));
    if (this.spawnFriendlyCity) this.spawnFriendlyCity(c);   // ЭТАП 2.2: автономная дружественная фракция (минимум — копают/собирают)
    // ЭТАП 2.3: узел kart_hackcity → БОЛЬШОЙ таймер перехвата реактора → кат-сцена → ПОБЕДА (первый разбуженный город)
    if (!this._winTimer && typeof metaHas === 'function' && metaHas('kart_hackcity')) {
      this._winTimer = { city: c, t: 0 };
      if (this.logEvent) this.logEvent(STR.log.reactorTimerStart);
    }
  },

  // Большой таймер после пробуждения (тикает в 'playing'). По концу — кат-сцена передачи реактора (mode 'hackwin').
  updateWinTimer(dt) {
    const wt = this._winTimer; if (!wt) return;
    wt.t += dt;
    if (wt.t >= HACKCITY_WIN_TIME) {
      this._winTimer = null;
      this._winCut = { city: wt.city, t: 0 };
      this.activeHack = null;   // снять возможный остаточный тетер взлома (рендер кат-сцены чист)
      if (this.unit) this.unit.frozenHack = false;
      if (this.camera && this.unit) { try { this.camera.follow(this.unit, 1); this.camera.snap(); } catch (e) {} }
      this.mode = 'hackwin';
      if (this.logEvent) this.logEvent(STR.log.reactorIntercepted);
    }
  },

  // Кат-сцена победы окончена (таймер вышел или Пробел) → конец сессии ПОБЕДОЙ: директива «Спящий кластер» выполнена.
  _finishHackWin() {
    this.directivesDone = (this.directivesDone || 0) + 1;
    this.overReason = 'hack_win';
    this._winCut = null;
    this.mode = 'gameover';
  },
});
