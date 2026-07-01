'use strict';

// Structures — печатаемые игроком сооружения (логика без Canvas; рендер — render_structure.js).
// Энергомодель повторяет город: РЕАКТОР В ЮНИТЕ. Пассивные (стена/шипы) энергии не требуют. Активные
// (турель/батарея) тратят энергию по работе и подзаряжаются юнитом в радиусе. БАТАРЕЯ — буфер-релей:
// сама заряжается от юнита и переливает заряд активным структурам в своём радиусе (держит кластер живым).
// Каждая структура занимает один тайл, печатается из ресурсов трюма (стоимость — STRUCT_DEFS[type].cost).
// Стена на достройке делает тайл породой (settleRock) → блок флаерам, копатель прогрызает обычным копом.
class Structure {
  constructor(type, tileX, tileY, face) {
    const def = STRUCT_DEFS[type];
    this.type = type; this.def = def;
    this.tileX = wrapX(tileX); this.tileY = tileY;
    this.px = this.tileX * TILE + TILE / 2; this.py = tileY * TILE + TILE / 2;
    this.face = face || 'floor';          // floor|ceil|wallL|wallR — поверхность крепления (поворот R, фаза 2)
    this.maxHp = def.hp; this.hp = def.hp;
    this.active = def.kind === 'active';
    this.energyMax = def.energyMax || 0; this.energy = this.energyMax;   // печатается заряженной
    this.state = 'building'; this.buildT = 0; this.buildTime = def.build;
    this.fireCd = 0; this.flash = 0;      // турель: кулдаун выстрела + вспышка дула (рендер)
    this.aimAng = this.face === 'ceil' ? Math.PI / 2 : -Math.PI / 2;     // ствол: по умолчанию от поверхности
    this.dying = false; this.deathT = 0; this._fx = false;
    this.pulse = 0;        // импульс ЭМИ/отталкивателя (анимация расходящегося кольца)
    this.active2 = false;  // непрерывный эффект СЕЙЧАС работает (СВЧ-конус / глушилка / ремонт) — для рендера
  }
  // Боевые враги бьют структуру (фаза 4); стена урон не принимает (её «HP» = dig-стойкость тайла).
  damage(n) { if (this.dying || this.def.solid) return; this.hp -= n; if (this.hp <= 0) { this.hp = 0; this.dying = true; this.deathT = STRUCT_DEATH_TIME; } }
  built() { return this.state === 'active'; }
}

class Structures {
  constructor() { this.list = []; this.tracers = []; }   // tracers — короткоживущие линии выстрелов турелей
  clear() { this.list.length = 0; this.tracers.length = 0; }
  count() { return this.list.length; }
  canAdd() { return this.list.length < STRUCT_CAP; }
  occupied(tx, ty) { tx = wrapX(tx); return this.list.some((s) => s.tileX === tx && s.tileY === ty && !s.dying); }
  add(type, tx, ty, face) { if (!this.canAdd() || !STRUCT_DEFS[type]) return null; const s = new Structure(type, tx, ty, face); this.list.push(s); return s; }

  update(dt, game) {
    const world = game.world, unit = game.unit, enemies = game.enemies || [];
    for (const t of this.tracers) t.life += dt;
    this.tracers = this.tracers.filter((t) => t.life < STRUCT_TRACER_TTL);

    for (const s of this.list) {
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
      if (s.pulse > 0) { s.pulse += dt; if (s.pulse > 0.45) s.pulse = 0; }   // анимация импульса-кольца
      if (s.dying) { if (!s._fx) { this._deathFx(s, game); s._fx = true; } s.deathT -= dt; continue; }

      if (s.state === 'building') {
        s.buildT += dt;
        if (s.buildT >= s.buildTime) { s.state = 'active'; if (s.def.solid && world) world.settleRock(s.tileX, s.tileY, s.def.hard, null, false); }
        continue;
      }
      // стена: жива, пока тайл твёрдый (копатель/юнит прогрызли породу → стены больше нет)
      if (s.def.solid) { if (world && world.tileAt(s.tileX, s.tileY).type === AIR) { s.dying = true; s.deathT = STRUCT_DEATH_TIME; } continue; }

      // подзарядка активных структур юнитом-реактором (в радиусе)
      if (s.active && unit && s.energy < s.energyMax) {
        const d = Math.hypot(wrapDeltaPx(s.px, unit.px), unit.py - s.py) / TILE;
        if (d <= STRUCT_RECHARGE_R) s.energy = Math.min(s.energyMax, s.energy + STRUCT_RECHARGE_RATE * dt);
      }

      switch (s.def.b) {
        case 'spike': this._spikeTick(s, dt, enemies); break;
        case 'turret': this._turretTick(s, dt, world, enemies); break;
        case 'railgun': this._railTick(s, dt, world, enemies); break;
        case 'microwave': this._mwTick(s, dt, enemies); break;
        case 'emp': this._empTick(s, dt, enemies); break;
        case 'repulsor': this._repulseTick(s, dt, enemies); break;
        case 'jammer': this._jamTick(s, dt, enemies); break;
        case 'repair': this._repairTick(s, dt); break;
        case 'battery': this._batteryTick(s, dt); break;
        case 'siege': this._siegeTick(s, dt, game); break;
        case 'courier': this._courierTick(s, dt, game); break;
      }
    }
    this.list = this.list.filter((s) => !(s.dying && s.deathT <= 0));
  }

  // Шипы — пассивный урон/с врагу, стоящему на тайле (без энергии).
  _spikeTick(s, dt, enemies) {
    for (const e of enemies) { if (e.dying || e.dead || e.friendly) continue; if (e.tileX === s.tileX && e.tileY === s.tileY) e.damage(s.def.dps * dt); }
  }

  // Турель — хитскан по ближайшему живому врагу в радиусе с прямой видимостью (тратит энергию, рисует трассер).
  _turretTick(s, dt, world, enemies) {
    s.fireCd -= dt;
    let best = null, bd = s.def.range + 0.5;
    for (const e of enemies) {
      if (e.dying || e.dead || e.friendly) continue;
      const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (d < bd && this._los(world, s, e)) { bd = d; best = e; }
    }
    if (!best) return;
    s.aimAng = Math.atan2(best.py - s.py, wrapDeltaPx(best.px, s.px));   // дельта s→цель (wrapDeltaPx(a,b)=a−b)
    if (s.fireCd <= 0 && s.energy >= s.def.eShot) {
      s.fireCd = s.def.fireCd; s.energy -= s.def.eShot; s.flash = 0.06;
      best.damage(s.def.dmg);
      this.tracers.push({ x1: s.px, y1: s.py, x2: best.px, y2: best.py, life: 0 });
    }
  }

  // Рейлган — медленный мощный ПРОБОЙ: луч от турели на всю дальность, бьёт ВСЕХ врагов вдоль линии.
  _railTick(s, dt, world, enemies) {
    s.fireCd -= dt;
    let best = null, bd = s.def.range + 0.5;
    for (const e of enemies) { if (e.dying || e.dead || e.friendly) continue; const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE; if (d < bd && this._los(world, s, e)) { bd = d; best = e; } }
    if (!best) return;
    s.aimAng = Math.atan2(best.py - s.py, wrapDeltaPx(best.px, s.px));
    if (s.fireCd <= 0 && s.energy >= s.def.eShot) {
      s.fireCd = s.def.fireCd; s.energy -= s.def.eShot; s.flash = 0.12;
      const ex = s.px + Math.cos(s.aimAng) * s.def.range * TILE, ey = s.py + Math.sin(s.aimAng) * s.def.range * TILE;
      for (const e of enemies) { if (e.dying || e.dead || e.friendly) continue; if (this._segDist(s.px, s.py, ex, ey, e.px, e.py) < TILE * 0.6) e.damage(s.def.dmg); }
      this.tracers.push({ x1: s.px, y1: s.py, x2: ex, y2: ey, life: 0, beam: true });
    }
  }

  // ОСАДНАЯ БАШНЯ — цель НЕ враги, а ДИКОЕ ГНЕЗДО: ближайшее живое в радиусе → резонанс-импульс по hp (площадь, не луч).
  // Запитана юнитом-реактором (как турель). active2 — резонатор работает (рендер), pulse — расходящееся ударное кольцо.
  _siegeTick(s, dt, game) {
    s.fireCd -= dt;
    const ws = game.world && game.world.wilds;
    s.active2 = false; s.siegeTarget = null;
    if (!ws) return;
    let best = null, bd = s.def.range + 0.5, bh = null;
    for (const w of ws) {
      if (w.disabled) continue;
      const h = game.wildHeart(w);
      const d = Math.hypot(wrapDeltaPx(s.px, h.hx), s.py - h.hy) / TILE;
      if (d < bd) { bd = d; best = w; bh = h; }
    }
    if (!best) return;
    s.active2 = true; s.siegeTarget = { x: bh.hx, y: bh.hy };
    s.aimAng = Math.atan2(bh.hy - s.py, wrapDeltaPx(bh.hx, s.px));   // дельта s→цель
    if (s.fireCd <= 0 && s.energy >= s.def.eShot) {
      s.fireCd = s.def.fireCd; s.energy -= s.def.eShot; s.flash = 0.1; s.pulse = 0.001;   // ударная волна-резонанс
      game.damageWild(best, s.def.dmg);
    }
  }

  // КУРЬЕР-ТЕРМИНАЛ — ЛОГИСТИКА (не боевая, энергии не требует). Юнит ВНЕ базы рядом ссыпает груз в склад по единице;
  // контейнер полон (def.store) → game отлепляет ДРОН (courier.js). active2 — идёт ссыпка (рендер: индикатор приёма).
  _courierTick(s, dt, game) {
    if (s.store == null) { s.store = { iron: 0, organic: 0, crystal: 0 }; s.stored = 0; s.depCd = 0; }
    s.active2 = false;
    const u = game.unit, inv = game.inventory;
    if (u && inv && !game.atBase() && inv.cargoUsed() > 0 && s.stored < s.def.store) {
      const d = Math.hypot(wrapDeltaPx(s.px, u.px), s.py - u.py) / TILE;
      if (d <= COURIER_DEPOSIT_R) {
        s.active2 = true; s.depCd -= dt;
        if (s.depCd <= 0) {
          const t = inv.deliverOneCargo();
          if (t) { s.store[t]++; s.stored++; s.depCd = COURIER_DEPOSIT_INT; if (game.fx) game.fx.burst(s.px, s.py - TILE * 0.3, [t]); }
        }
      }
    }
    if (s.stored >= s.def.store && game._launchCourier) game._launchCourier(s);   // контейнер полон → дрон в путь
  }

  // СВЧ — непрерывный КОНУС урона/с по всем врагам в секторе перед турелью (тратит энергию, пока бьёт).
  _mwTick(s, dt, enemies) {
    s.active2 = false;
    if (s.energy <= 0) return;
    let best = null, bd = s.def.range + 0.5;
    for (const e of enemies) { if (e.dying || e.dead || e.friendly) continue; const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE; if (d < bd) { bd = d; best = e; } }
    if (!best) return;
    s.aimAng = Math.atan2(best.py - s.py, wrapDeltaPx(best.px, s.px)); s.active2 = true;
    s.energy = Math.max(0, s.energy - s.def.eRate * dt);
    for (const e of enemies) {
      if (e.dying || e.dead || e.friendly) continue;
      const dx = wrapDeltaPx(e.px, s.px), dy = e.py - s.py;
      if (Math.hypot(dx, dy) / TILE > s.def.range) continue;
      const da = Math.abs(((Math.atan2(dy, dx) - s.aimAng + Math.PI) % (2 * Math.PI)) - Math.PI);
      if (da <= s.def.cone) e.damage(s.def.dps * dt);
    }
  }

  // ЭМИ-ловушка — по кулдауну импульс: СТАН всем врагам в радиусе (тратит энергию).
  _empTick(s, dt, enemies) {
    s.fireCd -= dt;
    if (s.fireCd > 0 || s.energy < s.def.eShot) return;
    const inR = this._inRadius(s, enemies);
    if (!inR.length) return;
    s.energy -= s.def.eShot; s.fireCd = s.def.cooldown; s.pulse = 0.001;
    for (const e of inR) e.stunT = Math.max(e.stunT || 0, s.def.stun);
  }

  // Отталкиватель — по кулдауну импульс: ОТБРАСЫВАЕТ врагов из радиуса наружу (сбивает заход).
  _repulseTick(s, dt, enemies) {
    s.fireCd -= dt;
    if (s.fireCd > 0 || s.energy < s.def.eShot) return;
    const inR = this._inRadius(s, enemies);
    if (!inR.length) return;
    s.energy -= s.def.eShot; s.fireCd = s.def.cooldown; s.pulse = 0.001;
    for (const e of inR) {
      const dx = wrapDeltaPx(e.px, s.px), dy = e.py - s.py, d = Math.hypot(dx, dy) || 1, push = s.def.push * TILE;
      e.px = wrapPx(e.px + dx / d * push); e.py += dy / d * push;
      e.tileX = wrapX(Math.round((e.px - TILE / 2) / TILE)); e.tileY = Math.round((e.py - TILE / 2) / TILE);
      e.state2 = IDLE; e.commit = null; e.cstate = null;   // сбить текущее движение/таран
    }
  }

  // Глушилка — аура ЗАМЕДЛЕНИЯ: всем врагам в радиусе обновляет slowT (тратит энергию, пока кто-то в зоне).
  _jamTick(s, dt, enemies) {
    s.active2 = false;
    if (s.energy <= 0) return;
    let any = false;
    for (const e of enemies) { if (e.dying || e.dead || e.friendly) continue; if (Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= s.def.radius) { e.slowT = Math.max(e.slowT || 0, 0.25); any = true; } }
    s.active2 = any;
    if (any) s.energy = Math.max(0, s.energy - s.def.eRate * dt);
  }

  // Ремонт-дрон — чинит HP активных структур (не стен) в радиусе (тратит энергию, пока чинит).
  _repairTick(s, dt) {
    s.active2 = false;
    if (s.energy <= 0) return;
    let any = false;
    for (const o of this.list) {
      if (o === s || o.dying || o.state !== 'active' || o.def.solid || !o.maxHp || o.hp >= o.maxHp) continue;
      if (Math.hypot(wrapDeltaPx(s.px, o.px), s.py - o.py) / TILE > s.def.radius) continue;
      o.hp = Math.min(o.maxHp, o.hp + s.def.healRate * dt); any = true;
    }
    s.active2 = any;
    if (any) s.energy = Math.max(0, s.energy - s.def.eRate * dt);
  }

  _inRadius(s, enemies) { return enemies.filter((e) => !e.dying && !e.dead && !e.friendly && Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= s.def.radius); }
  // Расстояние от точки до отрезка (в координатах, сдвинутых к x1 с тор-разворотом по X).
  _segDist(x1, y1, x2, y2, px, py) {
    const bx = wrapDeltaPx(x2, x1), by = y2 - y1, pxr = wrapDeltaPx(px, x1), pyr = py - y1;
    const len2 = bx * bx + by * by || 1; let t = (pxr * bx + pyr * by) / len2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(pxr - t * bx, pyr - t * by);
  }

  // Батарея — переливает заряд активным НЕ-батарейным структурам в радиусе (держит турели заряженными).
  _batteryTick(s, dt) {
    if (s.energy <= 0) return;
    for (const o of this.list) {
      if (o === s || !o.active || o.def.feed || o.dying || o.state !== 'active' || o.energy >= o.energyMax) continue;
      const d = Math.hypot(wrapDeltaPx(s.px, o.px), s.py - o.py) / TILE;
      if (d > s.def.radius) continue;
      const give = Math.min(s.def.feed * dt, s.energy, o.energyMax - o.energy);
      s.energy -= give; o.energy += give;
    }
  }

  // Прямая видимость по тайлам: дискретизируем линию, любой ТВЁРДЫЙ тайл между турелью и целью — нет выстрела.
  _los(world, s, e) {
    if (!world) return true;
    const dx = wrapDeltaPx(e.px, s.px) / TILE, dy = (e.py - s.py) / TILE;   // направление s→цель
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let i = 1; i < steps; i++) {
      const tx = Math.round(s.tileX + dx * (i / steps)), ty = Math.round(s.tileY + dy * (i / steps));
      if (isSolid(world.tileAt(tx, ty))) return false;
    }
    return true;
  }

  _deathFx(s, game) {
    if (!game.dust) return;
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, sp = TILE * (0.6 + Math.random() * 1.6); game.dust._grit(s.px, s.py, Math.cos(a) * sp, Math.sin(a) * sp - TILE * 0.6, Math.random() < 0.35); }
  }
}
