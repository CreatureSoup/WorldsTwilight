'use strict';

// КОНТЕЙНЕРЫ-ХРАНИЛИЩА (домешан в Game.prototype, ПОСЛЕ game). Погребённые тайники древних (`world.containers`,
// маркер `t.container`; откоп `setAir`→`.dug`). ВЗЛОМ: юнит рядом (`CONTAINER_RADIUS`) + узел меты `kart_hackbox` →
// таймер `c.breach` (`CONTAINER_BREACH_TIME`, копится пока юнит в радиусе — ушёл, прогресс сохранён) → `_openContainer`
// роняет НЕБОЛЬШОЙ ревард (случайный тип × 2..4) РЯДОМ, как из породы (`loot.spawn`). Без узла — рядом, но не вскрыть
// (`lockedContainer` → рендер-подсказка «нужен взлом»). Автоскан-модель как у серверов (`datascan.updateServers`).
// Рендер — `render_container.js`.
Object.assign(Game.prototype, {
  updateContainers(dt) {
    this.activeContainer = null; this.lockedContainer = null;
    const w = this.world, u = this.unit;
    if (!w || !u || !w.containers || !w.containers.length) return;
    const has = typeof metaHas === 'function' && metaHas('kart_hackbox');
    let active = null, best = Infinity;
    for (const c of w.containers) {
      if (!c.dug || c.opened || !w.isSeen(c.tx, c.ty)) continue;   // только выкопанный, невскрытый, в раскрытом (не сквозь туман)
      const dx = wrapDeltaPx(u.px, (c.tx + 0.5) * TILE), dy = u.py - (c.ty + 0.5) * TILE, d = Math.hypot(dx, dy);
      if (d <= CONTAINER_RADIUS * TILE && d < best) { best = d; active = c; }
    }
    if (!active) return;
    if (!has) { this.lockedContainer = active; return; }   // рядом, но нет узла kart_hackbox → заблокировано
    active.breach = Math.min(1, active.breach + dt / CONTAINER_BREACH_TIME);   // ВЗЛОМ идёт
    if (active.breach >= 1) this._openContainer(active);
    else this.activeContainer = active;
  },

  // Вскрыт — ресурсы падают РЯДОМ, как из породы (гравитация/подбор — loot.js). Небольшой ревард (не заваливать).
  _openContainer(c) {
    c.opened = true;
    for (let i = 0; i < c.amount; i++)
      this.loot.spawn(wrapX(c.tx + Math.round((Math.random() - 0.5) * 2.2)), Math.max(0, c.ty + Math.round((Math.random() - 0.5) * 1.4)), c.type);
    if (this.fx) this.fx.burst((c.tx + 0.5) * TILE, (c.ty + 0.5) * TILE, [c.type]);
    if (this.logEvent && !this.debug) this.logEvent(STR.log.containerOpened(c.amount, STR.resource.name[c.type]));
  },
});
