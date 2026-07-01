'use strict';

// ЭНЕРГОШЛЕЙФ (print_cable / print_batt) — ФИЗИЧЕСКИЙ трейлинг-кабель. Домешан в Game.prototype (ПОСЛЕ game).
// НАПРАВЛЕНИЕ: юнит-РЕАКТОР ПИТАЕТ ГОРОД (и батареи-релеи) через шлейф — НЕ наоборот. Прокладывается за юнитом по
// ПУСТЫМ тайлам (путь = тайлы, по которым юнит прошёл), крепится шестами в породу (рендер), СМАТЫВАЕТСЯ при возврате.
// Длина ОГРАНИЧЕНА (трек «ДЛИНА ШЛЕЙФА», `cableLen()`): кончилась → детач. Пока юнит ДЕРЖИТ живой конец — город запитан.
// **ЯКОРЯ-БАТАРЕИ (print_batt «Энергорелеи»):** доп-действие «подключение к батарее» (в радиусе `CABLE_ANCHOR_R`) ЗАЯКОРИВАЕТ
// шлейф на батарею → цепь продлевается (бюджет длины ОТСЧИТЫВАЕТСЯ ОТ ПОСЛЕДНЕГО ЯКОРЯ, reach растёт). За якорь кабель
// НЕ сматывается (заякорен) — нужно ОТКРЕПИТЬ той же кнопкой в радиусе. Цепочка из скольки угодно батарей. Смерть
// батареи рвёт цепь на этом якоре. Логика без Canvas; рендер — render_cable.drawEnergyCable.

// тор по X в тайлах: дельта в [-MAP_W/2, MAP_W/2]
function _cableTileDX(dx) { dx = ((dx % MAP_W) + MAP_W) % MAP_W; if (dx > MAP_W / 2) dx -= MAP_W; return dx; }

Game.prototype._cableRootTile = function () {
  return { x: SPAWN_X, y: CAVE_FLOOR_Y };   // розетка у базы = тайл спавна юнита (старт «пристёгнут», путь пуст)
};

Game.prototype._cableInit = function () { this.cable = null; };   // ленивая инициализация при первом апдейте с купленным print_cable

Game.prototype._cableSameTile = function (a, b) { return _cableTileDX(a.x - b.x) === 0 && a.y === b.y; };

// СОСТОЯНИЯ кабеля (`c.state`): 'live' тянется за юнитом · 'dormant' (только с «Энергорелеи») оторван, СЕРЫЙ, висит,
// реконнектится возвратом юнита · 'collapsing' (без реле) оторван → ОБРУШИВАЕТСЯ (падает+растворяется) · 'lost' пропал,
// новый трос — только у БАЗЫ (корень). «Уход в серое» — анимация `grayT` (свип от оторванного конца к корню). Падение — `fallT`.
Game.prototype._cableUpdate = function (dt) {
  dt = dt || 1 / 60;
  if (!(typeof metaHas === 'function' && metaHas('print_cable')) || !this.unit) { this.cable = null; return; }
  const u = this.unit, ut = { x: u.tileX, y: u.tileY };
  const root = this._cableRootTile();
  const relay = typeof metaHas === 'function' && metaHas('print_batt');   // «Энергорелеи»: оторванный кабель НЕ рушится — висит и реконнектится
  if (!this.cable) this.cable = { path: [{ x: root.x, y: root.y }], len: 0, _last: null, powered: false, exhausted: false, anchors: [], state: 'live', grayT: 0, fallT: 0 };
  const c = this.cable; if (!c.anchors) c.anchors = [];

  // ── ОБРУШЕНИЕ (без реле): анимация падения → кабель ПРОПАЛ ('lost') ──
  if (c.state === 'collapsing') {
    c.fallT = Math.min(1, c.fallT + dt / CABLE_FALL_TIME);
    c.grayT = Math.min(1, c.grayT + dt / CABLE_GRAY_TIME);
    c.exhausted = true; c.powered = false;
    if (c.fallT >= 1) c.state = 'lost';
    return;
  }
  // ── ПРОПАЛ: троса нет; новый — только когда юнит ВЕРНУЛСЯ к базе (корню) ──
  if (c.state === 'lost') {
    c.exhausted = true; c.powered = false;
    if (this._cableSameTile(root, ut)) this.cable = { path: [{ x: root.x, y: root.y }], len: 0, _last: { x: ut.x, y: ut.y }, powered: true, exhausted: false, anchors: [], state: 'live', grayT: 0, fallT: 0 };
    return;
  }

  const path = c.path;
  const L = (this.upgrades && this.upgrades.cableLen) ? this.upgrades.cableLen() : CABLE_LEN_BASE;
  const seg = (a, b) => Math.hypot(_cableTileDX(a.x - b.x), a.y - b.y);

  // СМЕРТЬ ЯКОРНОЙ БАТАРЕИ → рвём цепь на этом якоре (кабель до него остаётся, дальше отрывается → детач ниже)
  for (let k = 0; k < c.anchors.length; k++) {
    const a = c.anchors[k];
    if (!a.batt || a.batt.dead || a.batt.dying || a.batt.state !== 'active') { if (a.idx < path.length) path.length = a.idx + 1; c.anchors.length = k; break; }
  }
  const lastIdx = () => (c.anchors.length ? c.anchors[c.anchors.length - 1].idx : 0);   // «корень» трейлинг-сегмента (последний якорь или база)

  // путь обновляем ТОЛЬКО при смене тайла юнита. Длина — ТОТАЛЬНАЯ (`cableLen()` = дефолт + апгрейды; ЯКОРЬ длину НЕ меняет).
  // Якорь — только «стоп сматывания»: за него кабель НЕ сматывается (заякорен), пока не открепишь.
  if (!c._last || c._last.x !== ut.x || c._last.y !== ut.y) {
    c._last = { x: ut.x, y: ut.y };
    const li = lastIdx();
    let idx = -1;
    for (let i = path.length - 1; i >= 0; i--) if (this._cableSameTile(path[i], ut)) { idx = i; break; }   // юнит на тайле пути → смотать
    if (idx >= 0) { idx = Math.max(idx, li); if (idx < path.length - 1) path.length = idx + 1; }   // НЕ короче последнего якоря (заякорен)
    else if (c.len + seg(ut, path[path.length - 1]) <= L + 1e-6) path.push({ x: ut.x, y: ut.y });   // вытравить, если хватает ОБЩЕЙ длины
    let s = 0; for (let i = 1; i < path.length; i++) s += seg(path[i], path[i - 1]); c.len = s;
  }

  const end = path[path.length - 1];
  const onEnd = this._cableSameTile(end, ut);   // юнит держит живой конец кабеля?

  if (c.state === 'dormant') {
    if (onEnd) { c.state = 'live'; c.grayT = 0; }   // РЕКОННЕКТ: юнит вернулся на конец → ожил
    else c.grayT = Math.min(1, c.grayT + dt / CABLE_GRAY_TIME);   // висит, доуходит в серое
  } else if (!onEnd) {   // 'live' и юнит сорвался с конца → ДЕТАЧ
    if (relay) { c.state = 'dormant'; c.grayT = 0; }     // с реле — повисает серым, реконнектится
    else { c.state = 'collapsing'; c.grayT = 0; c.fallT = 0; }   // без реле — РУШИТСЯ и пропадёт
  }
  c.exhausted = c.state !== 'live';
  c.powered = c.state === 'live' && onEnd;   // ЗАПИТАН: юнит держит ЖИВОЙ конец → реактор питает город через цепь (батареи-релеи её лишь продлевают)
};

// Доп-действие «подключение к батарее» (нажатие) — якорить/открепить шлейф на ближайшую батарею в радиусе.
Game.prototype._cableToggleBatteryAnchor = function () {
  const c = this.cable, u = this.unit;
  if (!c || !u || !this.structures || c.state === 'lost' || !(typeof metaHas === 'function' && metaHas('print_batt'))) return false;
  let near = null, bd = CABLE_ANCHOR_R;
  for (const s of this.structures.list) {
    if (s.type !== 'battery' || s.state !== 'active' || s.dying || s.dead) continue;
    const d = Math.hypot(wrapDeltaPx(u.px, s.px), u.py - s.py) / TILE;
    if (d <= bd) { bd = d; near = s; }
  }
  if (!near) return false;
  const A = c.anchors || (c.anchors = []), last = A[A.length - 1];
  if (last && last.batt === near) { A.pop(); if (this.logEvent && !this.debug) this.logEvent(STR.log.cableUnanchor); return true; }   // ОТКРЕПИТЬ последний якорь → сматывание разблокировано
  if (c.state !== 'live' || c.exhausted) return false;   // якорить можно только с ЖИВОГО конца (цепь достаёт сюда)
  if (A.some((a) => a.batt === near)) return false;      // одна батарея — один якорь
  A.push({ idx: c.path.length - 1, batt: near });        // ЗАЯКОРИТЬ: бюджет длины начнёт отсчёт заново от этой точки
  if (this.logEvent && !this.debug) this.logEvent(STR.log.cableAnchor);
  return true;
};
// Есть ли живая батарея в радиусе якоря (для активного состояния кнопки).
Game.prototype._cableNearBattery = function () {
  const u = this.unit; if (!u || !this.structures || !(typeof metaHas === 'function' && metaHas('print_batt'))) return false;
  for (const s of this.structures.list) if (s.type === 'battery' && s.state === 'active' && !s.dying && !s.dead)
    if (Math.hypot(wrapDeltaPx(u.px, s.px), u.py - s.py) / TILE <= CABLE_ANCHOR_R) return true;
  return false;
};
// Ввод доп-действия якоря (зовётся в playing-цикле): нажал цифру у батареи → toggle.
Game.prototype._cableAnchorInput = function () {
  if (!(typeof metaHas === 'function' && metaHas('print_batt'))) return;
  const keys = this.actionKeys('cableAnchor');
  if (this.mode === 'playing' && !this.printMode && keys.length && this.input.pressed(...keys)) this._cableToggleBatteryAnchor();
};
