'use strict';

// ОСАДНЫЙ МОДУЛЬ (домешан в Game.prototype ПОСЛЕ game). Доп-слот `mod_siege` (s.siege, act:3, unlock print_siege).
// ДОП-действие (цифра 3): удержанием КОПИТ заряд (юнит заморожен, как импульс/взлом) → отпустил/максимум → пробойный
// сфокусированный ЛУЧ-копьё по взгляду. Бьёт по hp ближайшего ДИКОГО ГНЕЗДА на линии (большой урон → ПОДАВЛЕНИЕ,
// см. wildcity.js) + по врагам на линии (средний). Без снарядов/боезапаса. Состояние — `this.siege`. Рендер — render_siege.js.
// Контраст импульсу (волна) и кинетике (разгон): здесь — тугой мгновенный РАЗРЯД на короткой дистанции у гнезда.

// Попал ли таргет (tx,ty в мировых px) в луч из юнита по (ux,uy) длиной lenPx, в пределах боковой полосы perpTol.
// Тор по X — через wrapDeltaPx (цель может быть «за швом» мира).
function _siegeBeamHit(u, ux, uy, lenPx, tx, ty, perpTol) {
  const rx = wrapDeltaPx(tx, u.px), ry = ty - u.py;
  const proj = rx * ux + ry * uy;                       // вдоль луча
  if (proj < -TILE * 0.5 || proj > lenPx) return false; // позади юнита или дальше дальности
  return Math.abs(rx * uy - ry * ux) <= perpTol;        // боковое отклонение от оси
}

Object.assign(Game.prototype, {
  siegeActive() { return !!(this.unit && this.unit.stats && this.unit.stats.siege); },

  updateSiege(dt) {
    const u = this.unit;
    const s = this.siege || (this.siege = { charge: 0, cd: 0, dir: [1, 0], held: false, beam: null });
    if (s.beam) { s.beam.t += dt; if (s.beam.t >= SIEGE_BEAM_TTL) s.beam = null; }   // визуал луча гаснет
    if (s.cd > 0) s.cd -= dt;
    if (!u || !this.siegeActive()) { if (u) u.frozenSiege = false; s.charge = 0; s.held = false; return; }

    const ctx = this.mode === 'playing' && !this.atBase() && !this.printMode;   // не на базе/не в печати
    const canCharge = ctx && s.cd <= 0 && u.state === IDLE;
    const keys = moduleActionKeys('aux', u.modules && u.modules.aux);           // цифра 3 (act:3)
    const held = !!(this.input && this.input.keys && keys.some((k) => this.input.keys.has(k)));

    if (canCharge && held) {
      u.frozenSiege = true;                                                      // стоим, пока копим (взгляд фиксирован)
      s.dir = (u.dx !== 0 || u.dy !== 0) ? [u.dx, u.dy] : [u.faceX, 0];          // КУДА СМОТРИТ юнит
      s.held = true;
      s.charge = Math.min(1, s.charge + dt / SIEGE_CHARGE_T);
      if (s.charge >= 1) this._siegeFire();                                      // авто-разряд на максимуме
    } else {
      if (s.held && s.charge >= SIEGE_MIN_FIRE && ctx) this._siegeFire();        // отпустил с достаточным зарядом
      else { s.charge = 0; s.held = false; u.frozenSiege = false; }
    }
  },

  _siegeFire() {
    const u = this.unit, s = this.siege, power = s.charge;
    const dl = Math.hypot(s.dir[0], s.dir[1]) || 1, ux = s.dir[0] / dl, uy = s.dir[1] / dl;
    const lenPx = SIEGE_RANGE * TILE;
    // дикое гнездо на линии луча → большой урон по hp (добивание → ПОДАВЛЕНИЕ)
    const ws = this.world && this.world.wilds;
    if (ws) for (const w of ws) {
      if (w.disabled) continue;
      const h = this.wildHeart(w);
      if (_siegeBeamHit(u, ux, uy, lenPx + TILE, h.hx, h.hy, TILE * 1.2)) this.damageWild(w, Math.round(SIEGE_DMG_CITY * power));
    }
    // враги на линии → средний урон
    if (this.enemies) for (const e of this.enemies) {
      if (e.dead || e.dying || e.friendly) continue;
      if (_siegeBeamHit(u, ux, uy, lenPx, e.px, e.py, TILE * 0.7)) e.damage(SIEGE_DMG_ENEMY * power);
    }
    s.beam = { x: u.px, y: u.py, ux, uy, len: SIEGE_RANGE, power, t: 0 };         // визуал
    s.charge = 0; s.held = false; s.cd = SIEGE_CD; u.frozenSiege = false;
  },
});
