'use strict';

// НАВИГАЦИЯ ДО ГОРОДА — обвязка на Game.prototype (домешана ПОСЛЕ game). A*-ДВИЖОК (`navFindPath` + массивы) — в
// `nav.js` (грузится ДО game, аллоцирует массивы при загрузке — ⚠️ НЕ переносить). Здесь: цель/время-возврата/
// активность (узел `amb_nav`: «пора домой», когда возврат по реальному пути не успеть к таймеру гибернации),
// троттл-пересчёт пути (`_updateNavPath`), рендер линии (`_drawNavPath`, поверх тумана) и HUD-тумблер ПУТЬ
// (`navClick`; клавиша N — в game.loop). Виджет-тумблер — `hud.drawNavToggle`.

// НАВИГАЦИЯ ДО ГОРОДА (узел ГОРОД·amb_nav). Цель — центр принтера/города. Активна («пора домой»), когда время
// возврата по РЕАЛЬНОМУ пути дотягивает до остатка таймера гибернации. Скорость/таймер — живые (апгрейды).
Game.prototype._navTarget = function () { return { x: (PRINTER.x + PRINTER.w / 2) * TILE, y: (PRINTER.y + PRINTER.h / 2) * TILE }; };
Game.prototype._navStraightDist = function () {
  const t = this._navTarget();
  return Math.hypot(wrapDeltaPx(t.x, this.unit.px) / TILE, (t.y - this.unit.py) / TILE);
};
// Время возврата: по ДЛИНЕ реального пути (если посчитан) — чтобы успеть ИМЕННО открытым маршрутом; иначе по прямой.
Game.prototype._navReturnTime = function () {
  const spd = Math.max(0.5, this.unit.effectiveSpeed());
  const tiles = (this.navPath && this.navPath.length > 1) ? this.navPath.length : this._navStraightDist();
  return tiles / spd * NAV_RETURN_FACTOR;
};
Game.prototype._navActive = function () {
  if (this.mode !== 'playing' || !this.unit || this.atBase()) return false;
  if (typeof metaHas !== 'function' || !metaHas('amb_nav')) return false;
  return this._navReturnTime() >= this.city.timer;
};
// Считаем путь ВСЕГДА, пока юнит вне базы (троттлинг), чтобы триггер мерил реальную длину ОТКРЫТОГО маршрута,
// а не прямую (обход может быть в разы длиннее прямой — иначе активация опоздает). Путь показывается лишь когда
// `_navActive` (время возврата по нему >= таймера); ранние расчёты невидимы (только CPU, дёшево).
Game.prototype._updateNavPath = function (dt) {
  if (this.debug || !this.navView || this.mode !== 'playing' || !this.unit || typeof navFindPath !== 'function'
      || this.atBase() || typeof metaHas !== 'function' || !metaHas('amb_nav')) { this.navPath = null; return; }
  const ut = this.unit.tileY * MAP_W + wrapX(this.unit.tileX);
  this._navPathT -= dt;
  if (this.navPath && this._navPathFrom === ut && this._navPathT > 0) return;   // ещё актуально
  this._navPathT = NAV_PATH_DT; this._navPathFrom = ut;
  const t = this._navTarget();
  const p = navFindPath(this.world, this.unit.tileX, this.unit.tileY, Math.floor(t.x / TILE), Math.floor(t.y / TILE));
  if (p) this.navPath = p;   // null (нет пути / превышен бюджет) — оставляем прежний путь, чтобы линия не мигала
};
Game.prototype._drawNavPath = function (ctx) {
  if (!this.navView || !this._navActive()) return;
  const cam = this.camera, tm = performance.now() / 1000, HI = '#8fc0ff';
  // экранная полилиния [x0,y0,x1,y1,…]: X разворачиваем по кольцу накопленным wrapDeltaPx — без скачков через шов
  const pts = [], path = this.navPath, py = (ty) => (ty + NAV_PATH_DY) * TILE - cam.y;   // линия ниже центра тайла («пол» хода)
  if (path && path.length > 1) {
    let prevPx = path[0][0] * TILE + TILE / 2, sx = cam.screenX(prevPx);
    pts.push(sx, py(path[0][1]));
    for (let i = 1; i < path.length; i++) {
      const px = path[i][0] * TILE + TILE / 2;
      sx += wrapDeltaPx(px, prevPx); prevPx = px;
      pts.push(sx, py(path[i][1]));
    }
  } else {                                          // фолбэк (A* не нашёл/не успел): прямая к базе (то же смещение по Y)
    const t = this._navTarget();
    pts.push(cam.screenX(this.unit.px), py(this.unit.tileY), cam.screenX(t.x), py(Math.floor(t.y / TILE)));
  }
  const n = pts.length;
  const trace = () => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < n; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = PAL.cobalt; ctx.globalAlpha = 0.06; ctx.lineWidth = 4.5; trace();                  // мягкое гало (приглушено)
  ctx.globalAlpha = 0.10; ctx.lineWidth = 1; trace();                                                  // тонкая непрерывная подложка (связность)
  ctx.strokeStyle = HI; ctx.globalAlpha = 0.34; ctx.lineWidth = 1.3;                                   // бегущий «поток» к базе (притушен)
  ctx.setLineDash([2, 6]); ctx.lineDashOffset = -tm * 14; trace(); ctx.setLineDash([]);
  // маркер НАЗНАЧЕНИЯ (база) — расходящееся кольцо-маяк + ядро
  const ex = pts[n - 2], ey = pts[n - 1], pl = (tm * 0.9) % 1;
  ctx.strokeStyle = HI; ctx.globalAlpha = 0.3 * (1 - pl); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(ex, ey, 2.5 + pl * 5, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 0.55; ctx.fillStyle = HI; ctx.beginPath(); ctx.arc(ex, ey, 2.1, 0, TAU); ctx.fill();
  // точка-ИСТОК у юнита
  ctx.globalAlpha = 0.4; ctx.fillStyle = PAL.cobalt; ctx.beginPath(); ctx.arc(pts[0], pts[1], 1.6, 0, TAU); ctx.fill();
  ctx.restore();
};
// Клик в забеге: тумблер «ПУТЬ» (показ навигации) в HUD (если узел amb_nav открыт).
Game.prototype.navClick = function (x, y) {
  if (typeof metaHas !== 'function' || !metaHas('amb_nav') || typeof navHudRect !== 'function') return false;
  const r = navHudRect(this.designW);
  if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.navView = !this.navView; return true; }
  return false;
};

// МАЯЧОК ГОРОДА (узел amb_beacon): янтарная СТРЕЛКА к базе вокруг юнита + дистанция (как стрелки винтового бура,
// drawBorerArrows). Всегда (не только «пора домой»), пока тумблер ГОРОД включён и юнит вне базы.
Game.prototype._drawCityBeacon = function (ctx) {
  if (!this.beaconView || this.mode !== 'playing' || !this.unit || this.atBase()) return;
  if (typeof metaHas !== 'function' || !metaHas('amb_beacon')) return;
  const cam = this.camera, u = this.unit, t = this._navTarget();
  const dx = wrapDeltaPx(t.x, u.px), dy = t.y - u.py, d = Math.hypot(dx, dy);
  if (d < TILE * 1.5) return;                       // у базы — указатель ни к чему
  const ucx = cam.screenX(u.px), ucy = u.py - cam.y, R = TILE * 2.1;
  const a = Math.atan2(dy, dx), ax = ucx + Math.cos(a) * R, ay = ucy + Math.sin(a) * R;
  ctx.save();
  ctx.globalAlpha = Math.min(0.85, 0.5 + d / (TILE * 60));   // дальше база → ярче
  ctx.fillStyle = PAL.amber;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-6, -6); ctx.lineTo(-2.5, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.6; ctx.fillStyle = PAL.amberBright || PAL.amber;
  ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(d / TILE), ucx + Math.cos(a) * (R + 13), ucy + Math.sin(a) * (R + 13));
  ctx.restore();
};
// Клик в забеге: тумблер «ГОРОД» (показ маячка) в HUD (если узел amb_beacon открыт).
Game.prototype.beaconClick = function (x, y) {
  if (typeof metaHas !== 'function' || !metaHas('amb_beacon') || typeof beaconHudRect !== 'function') return false;
  const r = beaconHudRect(this.designW);
  if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.beaconView = !this.beaconView; return true; }
  return false;
};
