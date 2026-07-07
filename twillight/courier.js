'use strict';

// КУРЬЕР-ДРОН — летящий контейнер-курьер (домешан в Game.prototype, ПОСЛЕ game; парный к терминалу b:'courier' в
// structures.js). Терминал накопил контейнер → _launchCourier отлепляет дрон с грузом-снимком; updateCouriers ведёт
// его ВОЗДУШНЫМ путём (airPath, над тоннелями, НЕ сквозь породу) к базе. Долетел → груз сдаётся в город (банк, как ручная
// сдача) → дрон ВОЗВРАЩАЕТСЯ ПОРОЖНИМ на свой терминал и стыкуется, освобождая станцию (естественный «кулдаун» = рейс
// туда-обратно; у терминала ОДИН дрон). Сбит по пути → станция строит новый через COURIER_REBUILD_TIME. У дрона HP —
// боевой враг в радиусе бьёт (гружёный сбит → ресурс ПОТЕРЯН). Логика без Canvas; рендер — render_courier.js.

Object.assign(Game.prototype, {
  // Терминал s заполнил контейнер → отправляем дрон со снимком склада; склад терминала обнуляем, станцию помечаем занятой.
  _launchCourier(s) {
    if (!this.couriers) this.couriers = [];
    const bx = wrapPx((PRINTER.x + PRINTER.w / 2) * TILE), by = (PRINTER.y + 0.5) * TILE;   // цель — центр принтера (точка сдачи у базы)
    this.couriers.push({ px: s.px, py: s.py - TILE * 0.4, store: { ...s.store }, total: s.stored, hp: COURIER_DRONE_HP, maxHp: COURIER_DRONE_HP,
      tx: bx, ty: by, homeX: s.px, homeY: s.py - TILE * 0.4, term: s, state: 'fly', deathT: COURIER_DRONE_TTL, hitT: 0, bob: 0, path: null, pathI: 1, pathT: 0 });
    s.store = { iron: 0, organic: 0, crystal: 0 }; s.stored = 0; s.droneOut = true;   // станция занята, пока дрон в рейсе (туда-обратно)
    if (this.logEvent) this.logEvent(STR.log.courierLaunch);
  },

  updateCouriers(dt) {
    const cs = this.couriers; if (!cs || !cs.length) return;
    const enemies = this.enemies || [];
    for (const c of cs) {
      if (c.state !== 'fly' && c.state !== 'return') { c.deathT -= dt; continue; }   // arrived/docked/down → доигрываем анимацию
      c.bob += dt; if (c.hitT > 0) c.hitT -= dt;
      const step = COURIER_DRONE_SPEED * TILE * dt;
      const home = c.state === 'return';                                              // 'return' → цель ТЕРМИНАЛ, 'fly' → база
      const gxT = home ? c.homeX : c.tx, gyT = home ? c.homeY : c.ty;
      // ПРИБЫТИЕ к цели (не к вейпоинту): база → сдача+разворот; терминал → стыковка
      if (Math.hypot(wrapDeltaPx(gxT, c.px), gyT - c.py) <= Math.max(step, TILE * 0.6)) { home ? this._courierDock(c) : this._courierArrive(c); continue; }
      // ВОЗДУШНЫЙ ПУТЬ к текущей цели (airPath по тоннелям/пустотам, НЕ сквозь породу). Троттл: путь есть → часто; НЕТ → редко (ждём).
      c.pathT -= dt;
      if (c.pathT <= 0 && typeof this.airPath === 'function') {
        const p = this.airPath(Math.round(c.px / TILE - 0.5), Math.round(c.py / TILE - 0.5), Math.round(gxT / TILE - 0.5), Math.round(gyT / TILE - 0.5), 1);
        if (p && p.length > 1) { c.path = p; c.pathI = 1; c.pathT = COURIER_REPATH; }
        else { c.path = null; c.pathT = COURIER_WAIT_REPATH; }   // ПУТИ НЕТ → не летим сквозь породу: ждём на месте
      }
      if (c.path) {   // маршрут есть → к текущему вейпоинту (кончились узлы у цели → прямой финальный подлёт)
        let gx = gxT, gy = gyT;
        if (c.pathI < c.path.length) { const wp = c.path[c.pathI]; gx = wrapPx((wp.x + 0.5) * TILE); gy = (wp.y + 0.5) * TILE; }
        const dx = wrapDeltaPx(gx, c.px), dy = gy - c.py, dist = Math.hypot(dx, dy) || 1;
        c.px = wrapPx(c.px + dx / dist * step); c.py += dy / dist * step;
        if (c.pathI < c.path.length && dist < TILE * 0.5) c.pathI++;   // достиг вейпоинта → следующий
      }   // c.path === null → путь заблокирован: ВИСИМ на месте, пока перепроверка не найдёт открытый путь
      for (const e of enemies) {   // перехват: боевой враг рядом бьёт дрон (обратный путь тоже опасен)
        if (e.dying || e.dead || e.friendly) continue;
        if (Math.hypot(wrapDeltaPx(c.px, e.px), c.py - e.py) / TILE <= COURIER_INTERCEPT_R) { c.hp -= COURIER_INTERCEPT_DPS * dt; c.hitT = 0.12; }
      }
      if (c.hp <= 0) this._courierDown(c);
    }
    this.couriers = cs.filter((c) => !(c.state !== 'fly' && c.state !== 'return' && c.deathT <= 0));
  },

  // Дрон долетел до базы — груз сдаётся в город (счётчик + банк), затем ПОРОЖНИМ разворачивается на свой терминал.
  _courierArrive(c) {
    for (const t in c.store) for (let i = 0; i < c.store[t]; i++) { this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++; this.upgrades.addBank(t, 1); }
    if (this.fx) this.fx.burst(c.px, c.py, Object.keys(c.store).filter((k) => c.store[k] > 0));
    if (this.logEvent) this.logEvent(STR.log.courierArrived);
    if (c.term && this.structures && this.structures.list.indexOf(c.term) >= 0 && !c.term.dying) {   // терминал жив → возвращаемся к нему
      c.state = 'return'; c.store = { iron: 0, organic: 0, crystal: 0 }; c.total = 0; c.path = null; c.pathI = 1; c.pathT = 0;
    } else {   // терминала нет (уничтожен) → гаснем у базы, освобождаем на всякий
      c.state = 'arrived'; c.deathT = COURIER_DRONE_TTL; if (c.term) c.term.droneOut = false;
    }
  },

  // Дрон вернулся на терминал — стыковка: станция свободна, готова грузить следующий контейнер.
  _courierDock(c) {
    c.state = 'docked'; c.deathT = COURIER_DRONE_TTL;
    if (c.term) c.term.droneOut = false;
    if (this.fx) this.fx.burst(c.px, c.py, []);
  },

  // Дрон сбит на пути. Гружёный (fly) → груз ПОТЕРЯН; порожний (return) → потерян только дрон. Терминал строит новый (задержка).
  _courierDown(c) {
    c.state = 'down'; c.deathT = COURIER_DRONE_TTL;
    if (c.term) { c.term.droneOut = false; c.term.launchCd = COURIER_REBUILD_TIME; }
    if (this.fx) this.fx.burst(c.px, c.py, Object.keys(c.store).filter((k) => c.store[k] > 0));
    if (c.total > 0 && this.logEvent) this.logEvent(STR.log.courierLost);   // сообщаем о потере ТОЛЬКО когда был груз
  },
});
