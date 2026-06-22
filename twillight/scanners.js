'use strict';

// РАДАР-СКАНЕР + ЭХО-СКАНЕР — варианты слота СКАНЕР (взаимоисключающие со стандартным, как альт-буры).
// Домешано в Game.prototype ПОСЛЕ game.js (как impulse/borers). Логика без Canvas; рендер — render_scanners.js.
//
// ОБА сканера активируются ПРОБЕЛОМ (или X, если бур занял Пробел — импульсный/винтовой) и работают на КУЛДАУНЕ:
// РАДАР (`stats.radar`): по активации делает ОДИН оборот развёртки (RADAR_SWEEP_PERIOD) — залежь/враг, чей пеленг
//   попал в свежепройденный клин, вспыхивает БЛИПОМ; затем кулдаун (RADAR_CD_BASE). Туман НЕ снимает (видит
//   «сквозь породу»). HUD-чип переключателя типа ресурса; узел `mast_rad_spec` (полный спектр) снимает фильтр.
// ЭХО (`stats.echoScan`): по активации волна на ECHO_R тайлов РАЗОМ метит все залежи; кулдаун (ECHO_CD_BASE);
//   узел `mast_ech_len` удваивает радиус. Кулдаун обоих визуализирует виджет (render_scanners), правый-верх.
// Перф: сбор залежей кэшируется (статичны до выкопки), без filter/shadowBlur.

const RADAR_TYPES = ['iron', 'organic', 'crystal'];
const _norm2pi = (x) => { x %= Math.PI * 2; return x < 0 ? x + Math.PI * 2 : x; };

Object.assign(Game.prototype, {
  _scanInit() {
    this.radarSweep = { ang: -Math.PI / 2, prev: -Math.PI / 2, sweeping: false, swept: 0, cd: 0, cdMax: RADAR_CD_BASE, blips: [], resType: 'iron', fade: 1, cache: null, cacheT: 0, cacheKey: -1, _spec: false, _type: '' };
    this.echo = { cd: 0, cdMax: ECHO_CD_BASE, wave: null, marks: [] };
    this._ridN = 0;
  },
  // Сканер — ДОПОЛНИТЕЛЬНОЕ действие: клавиши БЕРЁМ ИЗ раскладки модуля (`moduleActionKeys` → цифра 1), а не
  // хардкодим. Главное действие (Пробел) занято буром/взаимодействием → конфликта нет при любой сборке.
  _scanWantFire() {
    const keys = moduleActionKeys('scanner', this.unit && this.unit.modules && this.unit.modules.scanner);
    return this.input.pressed(...keys) && !this.printMode;
  },

  // Залежи (по фильтру типа) в радиусе R тайлов вокруг юнита. tileX — «развёрнутый» (cx+dx), экран через screenX.
  _radarCollect(R, typeFilter) {
    const u = this.unit, w = this.world, out = [], cx = u.tileX, cy = u.tileY, R2 = R * R;
    for (let dy = -R; dy <= R; dy++) {
      const ty = cy + dy; if (ty < 0 || ty >= MAP_H) continue;
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > R2) continue;
        const t = w.tiles[ty * MAP_W + wrapX(cx + dx)];
        if (!t || !t.resource || (typeFilter && t.resource !== typeFilter)) continue;
        out.push({ tileX: cx + dx, tileY: ty, res: t.resource });
      }
    }
    return out;
  },

  updateScanners(dt) {
    const u = this.unit; if (!u || !u.stats) return;
    const rs = this.radarSweep, ec = this.echo;
    const fire = this._scanWantFire();

    // ── РАДАР: по активации ОДИН оборот развёртки, затем кулдаун ──
    if (u.stats.radar) {
      if (rs.cd > 0) rs.cd -= dt;
      if (fire && !rs.sweeping && rs.cd <= 0) { rs.sweeping = true; rs.swept = 0; rs.ang = -Math.PI / 2; rs.prev = -Math.PI / 2; }
      rs.fade = RADAR_SWEEP_PERIOD + RADAR_CD_BASE;   // блипы держатся ~до следующей возможной развёртки
      if (rs.sweeping) {
        const spectrum = !!u.stats.radarSpectrum;
        const dA = (Math.PI * 2 / RADAR_SWEEP_PERIOD) * dt;
        rs.prev = rs.ang; rs.ang += dA; rs.swept += dA;
        const key = u.tileX * 100000 + u.tileY;   // кэш залежей: статичны до выкопки
        rs.cacheT -= dt;
        if (!rs.cache || rs.cacheT <= 0 || rs.cacheKey !== key || rs._spec !== spectrum || rs._type !== rs.resType) {
          rs.cache = this._radarCollect(RADAR_R, spectrum ? null : rs.resType);
          rs.cacheT = 0.3; rs.cacheKey = key; rs._spec = spectrum; rs._type = rs.resType;
        }
        const span = _norm2pi(rs.ang - rs.prev), inWedge = (a) => _norm2pi(a - rs.prev) <= span;
        for (const r of rs.cache) {
          const wx = (r.tileX + 0.5) * TILE, wy = (r.tileY + 0.5) * TILE;
          if (inWedge(Math.atan2(wy - u.py, wrapDeltaPx(wx, u.px)))) this._radarBlip(rs, 'r' + r.tileX + '_' + r.tileY, wx, wy, RESOURCE_DEFS[r.res].color, false);
        }
        const RR = RADAR_R * TILE;
        for (const e of this.enemies) {
          if (e.dead || e.dying || e.friendly) continue;   // дружественных радар не метит как врагов
          const bx = wrapDeltaPx(e.px, u.px), by = e.py - u.py;
          if (bx * bx + by * by > RR * RR) continue;
          if (inWedge(Math.atan2(by, bx))) this._radarBlip(rs, 'e' + (e._rid || (e._rid = ++this._ridN)), e.px, e.py, '#ff5038', true);
        }
        if (rs.swept >= Math.PI * 2) { rs.sweeping = false; rs.cdMax = Math.max(RADAR_CD_MIN, RADAR_CD_BASE + (u.stats.radarCdD || 0)); rs.cd = rs.cdMax; }
      }
      for (let i = rs.blips.length - 1; i >= 0; i--) { if ((rs.blips[i].age += dt) >= rs.fade) rs.blips.splice(i, 1); }
    } else if (rs.blips.length) { rs.blips.length = 0; }

    // ── ЭХО: волна по активации ──
    if (ec.cd > 0) ec.cd -= dt;
    if (u.stats.echoScan) {
      if (fire && ec.cd <= 0 && !ec.wave) {
        const R = (u.stats.echoLong ? ECHO_R * 2 : ECHO_R) * TILE;
        ec.wave = { t: 0, r: 0, maxR: R, ox: u.px, oy: u.py };
        ec.cdMax = Math.max(ECHO_CD_MIN, ECHO_CD_BASE + (u.stats.echoCdD || 0)); ec.cd = ec.cdMax;
      }
      if (ec.wave) {
        ec.wave.t += dt;
        const f = Math.min(1, ec.wave.t / ECHO_WAVE_T);
        ec.wave.r = f * ec.wave.maxR;
        for (const r of this._radarCollect(Math.ceil(ec.wave.r / TILE), null)) {
          const wx = (r.tileX + 0.5) * TILE, wy = (r.tileY + 0.5) * TILE;
          if (Math.hypot(wrapDeltaPx(wx, ec.wave.ox), wy - ec.wave.oy) <= ec.wave.r)
            this._echoMark(ec, r.tileX, r.tileY, wx, wy, RESOURCE_DEFS[r.res].color);
        }
        if (f >= 1) ec.wave = null;
      }
      for (let i = ec.marks.length - 1; i >= 0; i--) { if ((ec.marks[i].age += dt) >= ECHO_MARK_FADE) ec.marks.splice(i, 1); }
    } else { ec.wave = null; if (ec.marks.length) ec.marks.length = 0; }
  },

  _radarBlip(rs, key, wx, wy, color, enemy) {
    const b = rs.blips.find((x) => x.key === key);
    if (b) { b.age = 0; b.wx = wx; b.wy = wy; }
    else rs.blips.push({ key, wx, wy, color, enemy, age: 0 });
  },
  _echoMark(ec, tileX, tileY, wx, wy, color) {
    const key = tileX + '_' + tileY;
    if (!ec.marks.some((m) => m.key === key)) ec.marks.push({ key, wx, wy, color, age: 0 });
  },
  // HUD-переключатель типа ресурса радара (клавиша C / клик по чипу). Полный спектр — фильтра нет.
  radarCycleType() {
    if (!this.unit || !this.unit.stats || !this.unit.stats.radar || this.unit.stats.radarSpectrum) return;
    const i = RADAR_TYPES.indexOf(this.radarSweep.resType);
    this.radarSweep.resType = RADAR_TYPES[(i + 1) % RADAR_TYPES.length];
    this.radarSweep.cache = null;
  },
});
