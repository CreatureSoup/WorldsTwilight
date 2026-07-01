'use strict';

// КУРЬЕР-ДРОН — летящий контейнер-курьер (домешан в Game.prototype, ПОСЛЕ game; парный к терминалу b:'courier' в
// structures.js). Терминал накопил контейнер → _launchCourier отлепляет дрон с грузом-снимком; updateCouriers ведёт
// его ПРЯМОЙ линией к базе (над тоннелями, поверх тумана). У дрона HP — боевой враг в радиусе бьёт (на пути могут
// сбить → ресурс ПОТЕРЯН). Долетел → груз сдаётся в город (deliveredTotal/банк, как ручная сдача на принтере).
// Логика без Canvas; рендер — render_courier.js. game.couriers — список активных дронов (создаётся лениво).

Object.assign(Game.prototype, {
  // Терминал s заполнил контейнер → отправляем дрон со снимком склада, склад терминала обнуляем.
  _launchCourier(s) {
    if (!this.couriers) this.couriers = [];
    const bx = wrapPx((PRINTER.x + PRINTER.w / 2) * TILE), by = (PRINTER.y + 0.5) * TILE;   // цель — центр принтера (точка сдачи у базы)
    this.couriers.push({ px: s.px, py: s.py - TILE * 0.4, store: { ...s.store }, total: s.stored, hp: COURIER_DRONE_HP, maxHp: COURIER_DRONE_HP, tx: bx, ty: by, state: 'fly', deathT: COURIER_DRONE_TTL, hitT: 0, bob: 0 });
    s.store = { iron: 0, organic: 0, crystal: 0 }; s.stored = 0;
    if (this.logEvent) this.logEvent(STR.log.courierLaunch);
  },

  updateCouriers(dt) {
    const cs = this.couriers; if (!cs || !cs.length) return;
    const enemies = this.enemies || [];
    for (const c of cs) {
      if (c.state !== 'fly') { c.deathT -= dt; continue; }
      c.bob += dt; if (c.hitT > 0) c.hitT -= dt;
      const dx = wrapDeltaPx(c.tx, c.px), dy = c.ty - c.py, dist = Math.hypot(dx, dy);   // прямая к базе (тор по X)
      const step = COURIER_DRONE_SPEED * TILE * dt;
      if (dist <= step || dist < TILE * 0.6) { this._courierArrive(c); continue; }
      c.px = wrapPx(c.px + dx / dist * step); c.py += dy / dist * step;
      for (const e of enemies) {   // перехват: боевой враг рядом бьёт дрон
        if (e.dying || e.dead || e.friendly) continue;
        if (Math.hypot(wrapDeltaPx(c.px, e.px), c.py - e.py) / TILE <= COURIER_INTERCEPT_R) { c.hp -= COURIER_INTERCEPT_DPS * dt; c.hitT = 0.12; }
      }
      if (c.hp <= 0) this._courierDown(c);
    }
    this.couriers = cs.filter((c) => !(c.state !== 'fly' && c.deathT <= 0));
  },

  // Дрон долетел до базы — каждая единица контейнера сдаётся в город (счётчик + банк апгрейдов, как ручная сдача).
  _courierArrive(c) {
    c.state = 'arrived'; c.deathT = COURIER_DRONE_TTL;
    for (const t in c.store) for (let i = 0; i < c.store[t]; i++) { this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++; this.upgrades.addBank(t, 1); }
    if (this.fx) this.fx.burst(c.px, c.py, Object.keys(c.store).filter((k) => c.store[k] > 0));
    if (this.logEvent) this.logEvent(STR.log.courierArrived);
  },

  // Дрон сбит на пути — груз ПОТЕРЯН (цена незащищённого маршрута: чисти врагов вдоль трассы «терминал↔база»).
  _courierDown(c) {
    c.state = 'down'; c.deathT = COURIER_DRONE_TTL;
    if (this.fx) this.fx.burst(c.px, c.py, Object.keys(c.store).filter((k) => c.store[k] > 0));
    if (this.logEvent) this.logEvent(STR.log.courierLost);
  },
});
