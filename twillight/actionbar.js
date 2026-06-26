'use strict';

// ПАНЕЛЬ АКТИВНЫХ ДЕЙСТВИЙ (домешано в Game.prototype ПОСЛЕ game). Дублирует хоткеи активных модулей юнита
// кнопками внизу-центру экрана: игрок видит, ЧТО нажимать (хоткей подписан сверху) и может кликнуть мышью.
// Клик/удержание ИНЖЕКТИТ соответствующий хоткей в `input` (edge + held) → вся существующая логика
// (impulse/borers/scanners/hack) читает input БЕЗ изменений. Рендер — render_actionbar.js (drawActionBar).
// `active(g)` — текущее «работает» (заряд/развёртка/канал) для подсветки; `cd(g)` — кулдаун для полоски.
// Печать НЕ здесь — у неё свой режим/панель (drawPrintHud). Действия определяются по `unit.stats` (s.*).

// `fill(g)` 0..1 — ЗАПОЛНЕНИЕ иконки (вместо виджета кулдауна): для кулдаунных (радар/эхо) = готовность
// (1 = перезаряжено), для зарядных (импульс/взлом) = прогресс заряда/канала, для винта = 1 пока щиты в ходу.
const ACTION_DEFS = [
  // порядок слева-направо: бур (Пробел) → сканер (1) → доп (2)
  { stat: 'impulse',  code: 'Space',  icon: 'impulse', col: '#f08a2a', active: (g) => !!(g.imp && (g.imp.charge > 0 || g.imp.wave)), fill: (g) => g.imp ? g.imp.charge : 0 },
  { stat: 'screw',    code: 'Space',  icon: 'screw',   col: '#9ad0a0', active: (g) => !!(g.borers && g.borers.length),               fill: (g) => (g.borers && g.borers.length) ? 1 : 0 },
  { stat: 'radar',    code: 'Digit1', icon: 'radar',   col: '#7fb0e0', active: (g) => !!(g.radarSweep && g.radarSweep.sweeping),      fill: (g) => g.radarSweep ? Math.max(0, 1 - g.radarSweep.cd / (g.radarSweep.cdMax || RADAR_CD_BASE)) : 1 },
  { stat: 'echoScan', code: 'Digit1', icon: 'echo',    col: '#b58cf0', active: (g) => !!(g.echo && g.echo.wave),                     fill: (g) => g.echo ? Math.max(0, 1 - g.echo.cd / (g.echo.cdMax || ECHO_CD_BASE)) : 1 },
  { stat: 'hack',     code: 'Digit2', icon: 'hack',    col: '#c06ee6', active: (g) => !!g.activeHack,                                 fill: (g) => g.activeHack ? g.activeHack.t : 0 },
  { stat: 'siege',    code: 'Digit3', icon: 'siege',   col: '#ff5a3a', active: (g) => !!(g.siege && (g.siege.charge > 0 || g.siege.beam)), fill: (g) => g.siege ? g.siege.charge : 0 },
];

Object.assign(Game.prototype, {
  // Активные действия текущей сборки (по статам установленных модулей). Пусто → панель не рисуется.
  _actionList() {
    const u = this.unit; if (!u || !u.stats) return [];
    const out = [];
    for (const d of ACTION_DEFS) if (u.stats[d.stat]) out.push(d);
    return out;
  },
  // Клик по кнопке (в playing, вне печати) → НАЧАТЬ удержание: инжект хоткея в input (как нажатие). true = попали.
  actionBarClick(x, y) {
    const rects = this._actionRects; if (!rects || !rects.length) return false;
    for (const r of rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      this.input.keys.add(r.code); this.input.justPressed.add(r.code);
      this._actionHeld = r.code; return true;
    }
    return false;
  },
  // Отпускание мыши → снять удержание (как отпускание клавиши).
  actionBarRelease() { if (this._actionHeld) { this.input.keys.delete(this._actionHeld); this._actionHeld = null; } },
});
