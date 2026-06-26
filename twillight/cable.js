'use strict';

// ЭНЕРГОШЛЕЙФ (print_cable / print_batt) — ФИЗИЧЕСКИЙ трейлинг-кабель. Домешан в Game.prototype (ПОСЛЕ game).
// Прокладывается за юнитом по ПУСТЫМ тайлам (путь = тайлы, по которым юнит реально прошёл), крепится шестами в
// породу на изгибах (рендер), СМАТЫВАЕТСЯ в юнит при возврате (юнит шагнул на предыдущую точку → сегмент снят).
// Длина ОГРАНИЧЕНА (трек «ДЛИНА ШЛЕЙФА», `cableLen()`): кончилась — конец замирает на последнем шесте, юнит
// отстёгнут (НЕ запитан), пока не вернётся к концу. Пока юнит ДЕРЖИТ конец — город запитан (city.update powered).
// print_batt — отдельное ЛОКАЛЬНОЕ питание от живой батареи (радиус `CABLE_BATT_R`), не трейлинг-кабель.
// Логика без Canvas; рендер — render_cable.drawCable. Путь ≤ длины (десятки точек) — в кадре только pop/push.

// тор по X в тайлах: дельта в [-MAP_W/2, MAP_W/2]
function _cableTileDX(dx) { dx = ((dx % MAP_W) + MAP_W) % MAP_W; if (dx > MAP_W / 2) dx -= MAP_W; return dx; }

Game.prototype._cableRootTile = function () {
  return { x: SPAWN_X, y: CAVE_FLOOR_Y };   // розетка у базы = тайл спавна юнита (старт «пристёгнут», путь пуст)
};

Game.prototype._cableInit = function () { this.cable = null; };   // ленивая инициализация при первом апдейте с купленным print_cable

Game.prototype._cableSameTile = function (a, b) { return _cableTileDX(a.x - b.x) === 0 && a.y === b.y; };

Game.prototype._cableUpdate = function () {
  if (!(typeof metaHas === 'function' && metaHas('print_cable')) || !this.unit) { this.cable = null; return; }
  const u = this.unit, ut = { x: u.tileX, y: u.tileY };
  const root = this._cableRootTile();
  if (!this.cable) this.cable = { path: [{ x: root.x, y: root.y }], len: 0, _last: null, powered: false, exhausted: false, batt: null };
  const c = this.cable, path = c.path;
  const L = (this.upgrades && this.upgrades.cableLen) ? this.upgrades.cableLen() : CABLE_LEN_BASE;
  const seg = (a, b) => Math.hypot(_cableTileDX(a.x - b.x), a.y - b.y);

  // путь обновляем ТОЛЬКО при смене тайла юнита (тайл-степ локомоции)
  if (!c._last || c._last.x !== ut.x || c._last.y !== ut.y) {
    c._last = { x: ut.x, y: ut.y };
    // юнит на тайле, который УЖЕ в пути? → СМОТАТЬ всё после него (надёжно при диагоналях/возвратах/петлях,
    // а не только при шаге на предыдущую точку — иначе оставались лишние сегменты)
    let idx = -1;
    for (let i = path.length - 1; i >= 0; i--) if (this._cableSameTile(path[i], ut)) { idx = i; break; }
    if (idx >= 0) { if (idx < path.length - 1) path.length = idx + 1; }
    else if (c.len + seg(ut, path[path.length - 1]) <= L + 1e-6) path.push({ x: ut.x, y: ut.y });   // новый тайл → ВЫТРАВИТЬ, если хватает длины
    let s = 0; for (let i = 1; i < path.length; i++) s += seg(path[i], path[i - 1]); c.len = s;       // длина пути (короткий — пересчёт целиком)
  }

  const end = path[path.length - 1];
  const onEnd = this._cableSameTile(end, ut);   // юнит держит живой конец кабеля?
  c.exhausted = !onEnd;

  // print_batt: локальное питание от ближайшей живой батареи (отдельно от трейлинг-кабеля)
  c.batt = null;
  if (typeof metaHas === 'function' && metaHas('print_batt') && this.structures) {
    let bd = CABLE_BATT_R * TILE, b = null;
    for (const s of this.structures.list)
      if (s.type === 'battery' && s.state === 'active' && !s.dying && !s.dead) {
        const d = Math.hypot(wrapDeltaPx(u.px, s.px), u.py - s.py);
        if (d <= bd) { bd = d; b = s; }
      }
    if (b) c.batt = { px: b.px, py: b.py };
  }

  c.powered = onEnd || !!c.batt;   // запитан: держит конец трейлинг-кабеля ИЛИ в зоне батареи
};
