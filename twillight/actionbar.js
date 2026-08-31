'use strict';

// ПАНЕЛЬ АКТИВНЫХ ДЕЙСТВИЙ (домешано в Game.prototype ПОСЛЕ game). Дублирует хоткеи активных модулей юнита
// кнопками внизу-центру экрана: игрок видит, ЧТО нажимать (хоткей подписан сверху) и может кликнуть мышью.
// Клик/удержание ИНЖЕКТИТ соответствующий хоткей в `input` (edge + held) → вся существующая логика
// (impulse/borers/scanners/hack) читает input БЕЗ изменений. Рендер — render_actionbar.js (drawActionBar).
// `active(g)` — текущее «работает» (заряд/развёртка/канал) для подсветки; `cd(g)` — кулдаун для полоски.
// Печать НЕ здесь — у неё свой режим/панель (drawPrintHud). Действия определяются по `unit.stats` (s.*).

// `fill(g)` 0..1 — ЗАПОЛНЕНИЕ иконки (вместо виджета кулдауна): для кулдаунных (радар/эхо/стелс) = готовность
// (1 = перезаряжено), для зарядных (импульс/взлом/осада) = прогресс заряда/канала, для винта = 1 пока щиты в ходу.
// `key`: 'primary' = Пробел (слот БУРА); 'digit' = ДОП-действие — цифра НЕ хардкодится, её назначает МЕНЕДЖЕР
// (`_actionList`) по ПОРЯДКУ активных доп-действий. Источник не важен: модуль ИЛИ артефакт (стат-флаг на unit.stats);
// новое действие — просто запись здесь + флаг в stats, цифра и кнопка добавятся сами, без коллизий и пробелов.
const ACTION_DEFS = [
  // порядок = приоритет назначения цифр (сканер раньше aux-модулей раньше артефактов). Пробел-действия цифру не берут.
  { stat: 'impulse',  key: 'primary', icon: 'impulse', col: '#f08a2a', active: (g) => !!(g.imp && (g.imp.charge > 0 || g.imp.wave)), fill: (g) => g.imp ? g.imp.charge : 0 },
  { stat: 'screw',    key: 'primary', icon: 'screw',   col: PAL.screwGreen, active: (g) => !!(g.borers && g.borers.length),               fill: (g) => (g.borers && g.borers.length) ? 1 : 0 },
  { stat: 'radar',    key: 'digit',   icon: 'radar',   col: '#7fb0e0', active: (g) => !!(g.radarSweep && g.radarSweep.sweeping),      fill: (g) => g.radarSweep ? Math.max(0, 1 - g.radarSweep.cd / (g.radarSweep.cdMax || RADAR_CD_BASE)) : 1 },
  { stat: 'echoScan', key: 'digit',   icon: 'echo',    col: '#b58cf0', active: (g) => !!(g.echo && g.echo.wave),                     fill: (g) => g.echo ? Math.max(0, 1 - g.echo.cd / (g.echo.cdMax || ECHO_CD_BASE)) : 1 },
  { stat: 'hack',     key: 'digit',   icon: 'hack',    col: '#c06ee6', active: (g) => !!g.activeHack,                                 fill: (g) => g.activeHack ? g.activeHack.t : 0 },
  { stat: 'siege',    key: 'digit',   icon: 'siege',   col: '#ff5a3a', active: (g) => !!(g.siege && (g.siege.charge > 0 || g.siege.beam)), fill: (g) => g.siege ? g.siege.charge : 0 },
  { stat: 'stealth',  key: 'digit',   icon: 'stealth', col: '#8a7ed4', active: (g) => !!(g.stealth && g.stealth.t > 0),              fill: (g) => g.stealth ? Math.max(0, 1 - g.stealth.cd / STEALTH_CD) : 1 },
  { stat: 'jam',      key: 'digit',   icon: 'jam',     col: PAL.screwGreen, active: (g) => !!(g.jam && g.jam.pulse > 0),                  fill: (g) => g.jam ? Math.max(0, 1 - g.jam.cd / JAM_PULSE_CD) : 1 },
  { stat: 'jets',       key: 'digit', icon: 'jets',  col: '#f0c84a', active: (g) => !!(g.jets && g.jets.on),                       fill: (g) => g.jets ? g.jets.fuel / (g.jets.max || JETS_FUEL_MAX) : 1 },   // артефакт: заливка иконки = запас топлива (скалируемая ёмкость)
  { stat: 'stunPulse',  key: 'digit', icon: 'stun',  col: PAL.screwGreen, active: (g) => !!(g.stunPulse && g.stunPulse.pulse > 0),       fill: (g) => g.stunPulse ? Math.max(0, 1 - g.stunPulse.cd / STUN_PULSE_CD) : 1 },   // артефакт ЭМИ-импульс
  { stat: 'blastCharge', key: 'digit', icon: 'blast', col: '#ff9a4a', active: (g) => false,                                         fill: (g) => g.blastCharge ? Math.max(0, 1 - g.blastCharge.cd / BLAST_CHARGE_CD) : 1 },   // артефакт подрыв-заряд
  { stat: 'nanoRepair', key: 'digit', icon: 'nano',  col: '#5fd29a', active: (g) => !!(g.nanoRepair && g.nanoRepair.healT > 0),    fill: (g) => g.nanoRepair ? (g.nanoRepair.healT > 0 ? g.nanoRepair.healT / NANO_REPAIR_TIME : Math.max(0, 1 - g.nanoRepair.cd / NANO_REPAIR_CD)) : 1 },   // артефакт нано-ремонт
  { stat: 'dash',       key: 'digit', icon: 'dash',  col: '#7fd0e0', active: (g) => !!(g.unit && g.unit.dashing),                  fill: (g) => g.dash ? Math.max(0, 1 - g.dash.cd / DASH_CD) : 1 },   // артефакт рывок
  { stat: 'harpoon',    key: 'digit', icon: 'harpoon', col: '#e0b070', active: (g) => !!((g.harpoon && g.harpoon.t > 0) || (g.unit && g.unit.dashing)), fill: (g) => g.harpoon ? Math.max(0, 1 - g.harpoon.cd / HARPOON_CD) : 1 },   // артефакт гарпун
  { stat: 'xray',       key: 'digit', icon: 'xray',  col: '#8fd0c0', active: (g) => !!(g.xray && g.xray.t > 0),                    fill: (g) => g.xray ? Math.max(0, 1 - g.xray.cd / XRAY_CD) : 1 },   // артефакт рентген
  { stat: 'droneHack',  key: 'digit', icon: 'dronehack', col: '#c06ee6', active: (g) => { const d = g._droneOfKind && g._droneOfKind('hacker'); return !!(d && d.state !== 'idle'); }, fill: (g) => { const d = g._droneOfKind && g._droneOfKind('hacker'); return d ? Math.max(0, 1 - d.cd / (g._artScaled('drone_hacker') || DRONE_HACK_CD)) : 1; } },   // дрон-хакер: деплой
  { stat: 'cableAnchor', metaNeed: 'print_batt', key: 'digit', icon: 'anchor', col: '#7fd0e0', active: (g) => !!(g._cableNearBattery && g._cableNearBattery()), fill: (g) => (g._cableNearBattery && g._cableNearBattery()) ? 1 : 0 },   // Энергорелеи: якорь шлейфа на батарею (актив в радиусе)
];

Object.assign(Game.prototype, {
  // МЕНЕДЖЕР действий: активные действия текущей сборки (по статам), С НАЗНАЧЕННОЙ клавишей. Пусто → панель не рисуется.
  // Пробел-действия (бур) → Пробел; доп-действия (сканер/aux/артефакты) → цифры 1,2,3… ПО ПОРЯДКУ активных (без пробелов).
  _actionList() {
    const u = this.unit; if (!u || !u.stats) return [];
    const out = []; let n = 0;
    for (const d of ACTION_DEFS) {
      const has = d.metaNeed ? (typeof metaHas === 'function' && metaHas(d.metaNeed)) : u.stats[d.stat];   // источник: стат-флаг ИЛИ узел меты (напр. якорь кабеля ← print_batt)
      if (!has) continue;
      let code, keys;
      if (d.key === 'primary') { code = KEY_PRIMARY; keys = [KEY_PRIMARY]; }
      else { n++; code = 'Digit' + n; keys = KEY_ACTION(n); }   // следующая свободная цифра
      out.push({ stat: d.stat, icon: d.icon, col: d.col, active: d.active, fill: d.fill, code, keys });
    }
    return out;
  },
  // Клавиши доп-действия по его стату (для логики модуля: hack/siege/stealth/radar/echoScan) — из ТОГО ЖЕ менеджера,
  // чтобы клавиша в логике и цифра на кнопке ВСЕГДА совпадали. Возвращает [] если действие не активно.
  actionKeys(stat) { const a = this._actionList().find((x) => x.stat === stat); return a ? a.keys : []; },
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
