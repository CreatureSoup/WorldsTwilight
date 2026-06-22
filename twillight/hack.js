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
    // нужен МОДУЛЬ ВЗЛОМА (s.hack, открыт узлом kart_defuse) + узел ПРОБУЖДЕНИЕ ГОРОДА (kart_wake) — он разрешает
    // взлом нейтральных городов (без него у модуля целей нет; обезвреживание останков — отдельно, пассивно).
    const canWake = typeof metaHas === 'function' && metaHas('kart_wake');
    if (!u.stats || !u.stats.hack || this.printMode || !canWake) { u.frozenHack = false; return; }
    const w = this.world; if (!w || !w.caverns) { u.frozenHack = false; return; }
    // ближайший СПЯЩИЙ город в радиусе взлома у СЕРДЦА. Сердце — на ПОЛУ каверны (`floorY`), где юнит стоит:
    // центр (cy) висит в воздухе на ry тайлов выше пола → недосягаем. hx/hy кладём в activeHack — рендер берёт их.
    let target = null, best = 1e9, thx = 0, thy = 0;
    for (const c of w.caverns) {
      if (c.awoken) continue;
      const hx = (c.cx + 0.5) * TILE, hy = (c.floorY + 0.5) * TILE;
      const d = Math.hypot(wrapDeltaPx(u.px, hx), u.py - hy) / TILE;
      if (d <= HACK_RADIUS && d < best) { best = d; target = c; thx = hx; thy = hy; }
    }
    const keys = moduleActionKeys('aux', u.modules && u.modules.aux);
    const held = !!(this.input && this.input.keys && keys.some((k) => this.input.keys.has(k)));
    if (target && held) {
      u.frozenHack = true;
      target.hackT = Math.min(1, (target.hackT || 0) + dt / HACK_TIME);
      this.activeHack = { city: target, t: target.hackT, hx: thx, hy: thy };
      if (target.hackT >= 1) this._wakeCity(target);
    } else {
      u.frozenHack = false;
      for (const c of w.caverns) if (!c.awoken && c.hackT) c.hackT = Math.max(0, c.hackT - dt * HACK_DECAY);   // спад частичного взлома
    }
  },

  _wakeCity(c) {
    c.awoken = true; c.hackT = 1;
    if (this.unit) this.unit.frozenHack = false;
    (this.awakenedCaverns || (this.awakenedCaverns = [])).push(c);
    if (this.logEvent) this.logEvent('ГОРОД ВЗЛОМАН · ' + (c.name || '').toUpperCase());
    if (this.spawnFriendlyCity) this.spawnFriendlyCity(c);   // ЭТАП 2.2: автономная дружественная фракция (минимум — копают/собирают)
    // ЭТАП 2.3: узел kart_hackcity → БОЛЬШОЙ таймер перехвата реактора → кат-сцена → ПОБЕДА (первый разбуженный город)
    if (!this._winTimer && typeof metaHas === 'function' && metaHas('kart_hackcity')) {
      this._winTimer = { city: c, t: 0 };
      if (this.logEvent) this.logEvent('ПЕРЕХВАТ РЕАКТОРА · ТАЙМЕР ЗАПУЩЕН');
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
      if (this.logEvent) this.logEvent('РЕАКТОР ПЕРЕХВАЧЕН · ПЕРЕДАЧА ЯДРА');
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
