'use strict';

// AI диких гнёзд (вынесено из game.js): спавн волн по циклам + поведение врагов
// (копатель/собиратель/разведчик) + BFS-путь по воздуху. Это оркестрация над состоянием
// Game (world/enemies/cities/cycle/city), поэтому методы домешиваются в Game.prototype —
// тела не менялись, `this` = инстанс Game. Грузится ПОСЛЕ game.js (Game уже определён),
// до создания инстанса (`new Game()` на событии load).
Object.assign(Game.prototype, {
  // Волны: с началом каждого цикла гнёзда досылают врагов из случайного гнезда.
  onCycleStart(n) {
    const nests = this.world.wilds; if (!nests.length) return;
    const nest = () => nests[Math.floor(Math.random() * nests.length)];
    const homeR = (w) => Math.max(w.rx, w.ry) + 1;  // «дом» = вся каверна гнезда, иначе центр недостижим
    // копатель-разведчик: 1/цикл до числа цивилизованных городов, пока есть ненайденные
    const diggers = this.enemies.filter((e) => e.type === 'digger').length;
    // первый копатель — со 2-го цикла (спокойный пролог + сдвигает время до базы к целевому окну)
    if (n >= 2 && this.cities.some((c) => !c.found) && diggers < this.cities.length) {
      const w = nest(); const e = new Enemy(w.cx, w.cy, 'digger', w.cx, w.cy, homeR(w));
      this._diggerN = (this._diggerN || 0) + 1;
      e.sweepSign = (this._diggerN % 2) ? 1 : -1;   // чередуем сторону свипа → копатели делят тор, разброс времени до базы падает
      this.enemies.push(e);
    }
    // собиратели: с цикла 2, 1/цикл до потолка
    if (n >= 2 && this.enemies.filter((e) => e.type === 'collector').length < COLLECTOR_CAP) {
      const w = nest(); this.enemies.push(new Enemy(w.cx, w.cy, 'collector', w.cx, w.cy, homeR(w)));
    }
    // разведчики (бой): с цикла 3, из гнезда, СВЯЗАННОГО тоннелем-магистралью с базой
    // (копатель её прорывает, найдя базу); рейдер не копает — без хода не выйдет
    if (n >= 3 && this.cities[0].found && this.enemies.filter((e) => e.type === 'raider').length < RAIDER_CAP) {
      const home = this.cities[0];
      const linked = nests.filter((w) => this.airPath(w.cx, w.cy, home.cx, home.cy, RAID_REACH_R));
      if (linked.length) { const w = linked[Math.floor(Math.random() * linked.length)]; this.enemies.push(new Enemy(w.cx, w.cy, 'raider', w.cx, w.cy, homeR(w))); }
    }
    // охотники (бой): с цикла 4, из гнезда, СВЯЗАННОГО воздухом с ЮНИТОМ (гонится за ним по тоннелям)
    if (n >= 4 && this.unit && this.enemies.filter((e) => e.type === 'hunter').length < HUNTER_CAP) {
      const linked = nests.filter((w) => this.airPath(w.cx, w.cy, this.unit.tileX, this.unit.tileY, 2));
      if (linked.length) { const w = linked[Math.floor(Math.random() * linked.length)]; this.enemies.push(new Enemy(w.cx, w.cy, 'hunter', w.cx, w.cy, homeR(w))); }
    }
    // взломщики: с цикла 5, из гнезда, СВЯЗАННОГО воздухом с базой (магистраль прорыта); чем больше — тем быстрее взлом
    if (n >= 5 && this.cities[0].found && this.enemies.filter((e) => e.type === 'hacker').length < FIREWALL_HACKER_CAP) {
      const home = this.cities[0];
      const linked = nests.filter((w) => this.airPath(w.cx, w.cy, home.cx, home.cy, RAID_REACH_R));
      if (linked.length) { const w = linked[Math.floor(Math.random() * linked.length)]; this.enemies.push(new Enemy(w.cx, w.cy, 'hacker', w.cx, w.cy, homeR(w))); }
    }
    // снайперы: с цикла 6 (на цикл ПОЗЖЕ взломщиков), ТОЛЬКО если есть взломщик (охраняет его), из связанного гнезда
    if (n >= 6 && this.enemies.some((e) => e.type === 'hacker') && this.enemies.filter((e) => e.type === 'sniper').length < SNIPER_CAP) {
      const home = this.cities[0];
      const linked = nests.filter((w) => this.airPath(w.cx, w.cy, home.cx, home.cy, RAID_REACH_R));
      if (linked.length) { const w = linked[Math.floor(Math.random() * linked.length)]; this.enemies.push(new Enemy(w.cx, w.cy, 'sniper', w.cx, w.cy, homeR(w))); }
    }
  },
  near(e, cx, cy, r) { const d = Math.abs(((e.tileX - cx) % MAP_W + MAP_W) % MAP_W); return Math.min(d, MAP_W - d) <= r && Math.abs(e.tileY - cy) <= r; },
  nestAt(x, y) { return this.world.wilds.find((w) => w.cx === x && w.cy === y); },   // гнездо по координатам дома врага
  nearestResource(cx, cy, r) {
    let best = null, bestD = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const y = cy + dy; if (y < 0 || y >= MAP_H) continue;
      const t = this.world.tileAt(cx + dx, y);
      if (t.type === ROCK && t.resource) { const d = Math.abs(dx) + Math.abs(dy); if (d < bestD) { bestD = d; best = { x: wrapX(cx + dx), y }; } }
    }
    return best;
  },
  diggerBrain(e) {
    if (e.state === 'seek') {
      for (const c of this.cities) if (!c.found && this.near(e, c.cx, c.cy, c.dr)) {
        c.found = true;
        // докапываемся ВПЛОТНУЮ в пещеру любого города (база И чужие): пробой видим игроку,
        // к базе остаётся магистраль для рейдеров. Только база даёт телеграф-предупреждение.
        e.state = 'tocity'; e.target = { x: c.cx, y: c.cy }; e._toBase = (c === this.cities[0]);
        if (e._toBase) this.logEvent('КОПАТЕЛЬ ЗАСЁК БАЗУ');   // только засёк (издалека, сквозь породу) — без громкой подсказки
        break;
      }
      // разведка завершена (все города найдены) → домой, иначе копатель блуждал бы вечно
      if (e.state === 'seek' && this.cities.every((c) => c.found)) { e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; e._returning = true; }
    } else if (e.state === 'tocity') {
      if (this.near(e, e.target.x, e.target.y, RAID_REACH_R)) {   // дорылся вплотную
        if (e._toBase) { this.logEvent('МАГИСТРАЛЬ К БАЗЕ ПРОБИТА'); if (this.hints) this.hints.show('ПРОРЫВ К БАЗЕ'); e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; e._returning = true; }   // ПРОРЫВ — на РЕАЛЬНОМ пробитии (виден игроку)
        else { e.state = 'seek'; e.target = null; }   // чужой город — лишь путевая точка: пробил и ПРОДОЛЖАЕТ искать (в т.ч. базу)
      }
    } else if (e.state === 'return') {   // ВОЗВРАТ ПЕШКОМ: gotoDir(airFirst) ведёт по своему тоннелю в гнездо (см. enemy._returning)
      e.returnT = (e.returnT == null) ? DIGGER_RETURN_STEPS : e.returnT - 1;
      if (this.near(e, e.homeX, e.homeY, e.homeR) || e.returnT <= 0) e.dead = true;   // дошёл → исчез в гнезде; лимит — лишь страховка от патологии
    }
  },
  collectorBrain(e) {
    if (e.state === 'seek') {
      const r = this.nearestResource(e.tileX, e.tileY, DETECT_RES);
      if (r) { e.state = 'goresource'; e.target = { x: r.x, y: r.y }; }
    } else if (e.state === 'goresource') {
      const t = this.world.tileAt(e.target.x, e.target.y);
      if (!t.resource) { e.state = 'seek'; e.target = null; }                       // ресурс пропал
      else if (this.near(e, e.target.x, e.target.y, 1)) {                           // рядом → собрать 1
        e.carry = t.resource; this.world.setAir(e.target.x, e.target.y);
        e.state = 'return'; e.target = { x: e.homeX, y: e.homeY };
      }
    } else if (e.state === 'return' && this.near(e, e.homeX, e.homeY, e.homeR)) {                // донёс ресурс в гнездо
      const n = this.nestAt(e.homeX, e.homeY); if (n) n.loot++;
      e.dead = true;
    }
  },
  // BFS-путь по проходимому ВОЗДУХУ (тайлы с опорой — где враг может стоять/лезть) от
  // (sx,sy) до зоны радиуса r вокруг (gx,gy). Для рейдера, который не копает: ведёт по
  // готовым тоннелям копателей в обход тупиков (жадный поиск застревает в лабиринте).
  airPath(sx, sy, gx, gy, r) {
    const W = this.world;
    const start = sy * MAP_W + wrapX(sx);
    const prev = new Map([[start, -1]]);
    const q = [[wrapX(sx), sy]]; let head = 0, goal = -1;
    while (head < q.length) {
      const [x, y] = q[head++];
      if (W.torDist(x, gx) <= r && Math.abs(y - gy) <= r) { goal = y * MAP_W + x; break; }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = wrapX(x + dx), ny = y + dy;
        if (ny < 0 || ny >= MAP_H) continue;
        const k = ny * MAP_W + nx;
        if (prev.has(k) || W.tileAt(nx, ny).type !== AIR) continue;  // путь по воздуху (тоннели/пустоты)
        prev.set(k, y * MAP_W + x); q.push([nx, ny]);
      }
    }
    if (goal < 0) return null;
    const path = [];
    for (let k = goal; k !== -1; k = prev.get(k)) path.push({ x: k % MAP_W, y: Math.floor(k / MAP_W) });
    return path.reverse();
  },
  // Разведчик: бежит к разведанной базе по тоннелям копателей (BFS, не копает), высасывает
  // энергию контура и уносит заряд домой. В дебаге без урона (наблюдение).
  raiderBrain(e, dt) {
    const toHome = !!e.carry;
    const gx = toHome ? e.homeX : this.cities[0].cx, gy = toHome ? e.homeY : this.cities[0].cy;
    const gr = toHome ? e.homeR : RAID_REACH_R;
    if (this.near(e, gx, gy, gr)) {                              // у цели
      if (!toHome) {
        // у города: стоит и «заполняется» — кража не мгновенная (видно подход + накопление)
        e.draining = true; e.drainT += dt; e.commit = null;
        if (e.drainT >= RAID_DRAIN_TIME) {
          if (!this.debug) { this.city.drain(RAID_DRAIN); this.logEvent('РЕЙДЕР ВЫСОСАЛ ЭНЕРГИЮ'); } // сначала таймер гибернации, переполнение — в HP кольца (см. city.drain)
          e.carry = 'charge'; e.draining = false; e.drainT = 0;
        }
      } else { const n = this.nestAt(e.homeX, e.homeY); if (n) n.charge++; e.dead = true; } // донёс заряд домой
      return;
    }
    e.draining = false; e.drainT = 0;                           // ушёл с цели — сброс накопления
    if (e.state2 !== IDLE) return;                               // путь нужен только при выборе следующего хода
    const path = this.airPath(e.tileX, e.tileY, gx, gy, gr);
    e.target = path && path.length > 1 ? { x: path[1].x, y: path[1].y } : { x: gx, y: gy };
  },
  // Охотник: летает за юнитом по тоннелям; при сближении телеграф→ТАРАН (px-рывок к зафиксированной позиции),
  // удар по hp юнита (разово), отскок+кулдаун, повтор. Боевая локомоция (charge/recover) — в Enemy.update по cvx/cvy.
  hunterBrain(e, dt) {
    const u = this.unit; if (!u) return;
    const dpx = wrapDeltaPx(u.px, e.px), dpy = u.py - e.py, d = Math.hypot(dpx, dpy), distT = d / TILE;
    if (!e.cstate) e.cstate = 'approach';
    if (e.cstate === 'approach') {
      if (e.state2 !== IDLE) return;
      if (distT <= HUNTER_CHARGE_R && this._hunterLOS(e, u)) { e.cstate = 'wind'; e.cT = 0; e.commit = null; e.target = null; } // близко + линия чиста → разгон
      else { const path = this.airPath(e.tileX, e.tileY, u.tileX, u.tileY, 1); e.target = (path && path.length > 1) ? { x: path[1].x, y: path[1].y } : { x: u.tileX, y: u.tileY }; }
    } else if (e.cstate === 'wind') {
      e.cT += dt;
      if (e.cT >= HUNTER_WIND) { const k = d > 1e-3 ? HUNTER_CHARGE_SPEED * TILE / d : 0; e.cvx = dpx * k; e.cvy = dpy * k; e.cstate = 'charge'; e.cT = 0; e.cHit = false; e.cBlocked = false; }
    } else if (e.cstate === 'charge') {
      e.cT += dt;
      if (!e.cHit && distT <= HUNTER_HIT_R) { e.cHit = true; if (!this.debug) { u.hp = Math.max(0, u.hp - (HUNTER_DMG_MIN + Math.random() * (HUNTER_DMG_MAX - HUNTER_DMG_MIN))); this.logEvent('ОХОТНИК ТАРАНИЛ ЮНИТ'); } this._hunterRecover(e, dpx, dpy, d); }
      else if (e.cBlocked || e.cT >= HUNTER_CHARGE_MAX) this._hunterRecover(e, dpx, dpy, d);
    } else if (e.cstate === 'recover') {
      e.cT += dt; e.cvx *= 0.88; e.cvy *= 0.88;
      if (e.cT >= HUNTER_RECOVER) { e.cstate = 'approach'; e.cT = 0; e.cvx = 0; e.cvy = 0; e.commit = null; e.target = null; }
    }
  },
  _hunterRecover(e, dpx, dpy, d) { const k = d > 1e-3 ? HUNTER_SPEED * TILE / d : 0; e.cvx = -dpx * k; e.cvy = -dpy * k; e.cstate = 'recover'; e.cT = 0; },  // отскок ОТ юнита
  _hunterLOS(e, u) {                                              // линия к юниту в основном по воздуху (рывок не упрётся сразу в породу)
    const dpx = wrapDeltaPx(u.px, e.px), dpy = u.py - e.py, steps = Math.max(2, Math.ceil(Math.hypot(dpx, dpy) / TILE));
    let solid = 0;
    for (let i = 1; i < steps; i++) { const t = i / steps;
      if (isSolid(this.world.tileAt(wrapX(Math.round((e.px + dpx * t - TILE / 2) / TILE)), Math.round((e.py + dpy * t - TILE / 2) / TILE)))) solid++;
    }
    return solid <= 1;
  },
  // Взломщик: летит к базе по тоннелям, встаёт вплотную и ВЗЛАМЫВАЕТ (`e.hacking` → game копит файрволл).
  hackerBrain(e) {
    const home = this.cities[0];
    e.hacking = false;
    if (this.near(e, home.cx, home.cy, RAID_REACH_R)) { e.draining = true; e.hacking = true; e.commit = null; return; }  // стоит у базы и взламывает
    e.draining = false;
    if (e.state2 !== IDLE) return;
    const path = this.airPath(e.tileX, e.tileY, home.cx, home.cy, RAID_REACH_R);
    e.target = path && path.length > 1 ? { x: path[1].x, y: path[1].y } : { x: home.cx, y: home.cy };
  },
  // Снайпер: охраняет ближайшего ВЗЛОМЩИКА (держится рядом), КАЙТИТ от юнита (отступает, если близко), бьёт издали
  // проджектайлами по юниту (кулдаун + LOS). Выстрелы — `this.shots`. Нет взломщика → стережёт базу.
  sniperBrain(e, dt) {
    const u = this.unit;
    const hacker = this.enemies.find((x) => x.type === 'hacker' && !x.dead);
    const gx = hacker ? hacker.tileX : this.cities[0].cx, gy = hacker ? hacker.tileY : this.cities[0].cy;
    e.aimT = (e.aimT || 0) - dt; e.firing = Math.max(0, (e.firing || 0) - dt);
    let distU = Infinity, dpx = 0, dpy = 0;
    if (u) { dpx = wrapDeltaPx(u.px, e.px); dpy = u.py - e.py; distU = Math.hypot(dpx, dpy) / TILE; e.aimAng = Math.atan2(dpy, dpx); }
    if (u && this.shots && distU <= SNIPER_RANGE && distU >= SNIPER_MINDIST && this._hunterLOS(e, u) && e.aimT <= 0) {  // огонь
      this.shots.fire(e.px, e.py, u.px, u.py); e.aimT = SNIPER_COOLDOWN; e.firing = 0.13;
    }
    if (e.state2 !== IDLE) return;
    if (u && distU < SNIPER_MINDIST) {                            // близко юнит → отступаем ОТ него
      const sx = dpx === 0 ? ((e.seed & 1) ? 1 : -1) : Math.sign(dpx);
      e.target = { x: wrapX(e.tileX - sx * 4), y: Math.max(0, Math.min(MAP_H - 1, e.tileY - Math.sign(dpy || 1) * 2)) };
    } else if (this.near(e, gx, gy, SNIPER_GUARD_R)) {
      e.target = { x: gx, y: gy };                               // у взломщика — держимся рядом
    } else {
      const path = this.airPath(e.tileX, e.tileY, gx, gy, 2);
      e.target = path && path.length > 1 ? { x: path[1].x, y: path[1].y } : { x: gx, y: gy };
    }
  },
  updateEnemies(dt) {
    if (this.cycle.n !== this.lastCycleN) { this.onCycleStart(this.cycle.n); this.lastCycleN = this.cycle.n; }
    for (const e of this.enemies) {
      if (e.dying) {   // уничтожен: разовый выброс обломков, доигрываем анимацию, затем чистка (мозг/движение выкл)
        if (!e._fx) { e._fx = true; if (this.dust) for (let i = 0; i < 6; i++) { const a = Math.random() * 6.283, sp = TILE * (0.6 + Math.random() * 1.5); this.dust._grit(e.px, e.py, Math.cos(a) * sp, Math.sin(a) * sp - TILE * 0.5, Math.random() < 0.3); } }
        e.deathT -= dt; if (e.deathT <= 0) e.dead = true;
        continue;
      }
      if (e.stunT > 0) { e.stunT -= dt; continue; }   // ЭМИ-стан: заморожен (мозг/движение выкл)
      if (e.type === 'digger') this.diggerBrain(e);
      else if (e.type === 'collector') this.collectorBrain(e);
      else if (e.type === 'hunter') this.hunterBrain(e, dt);
      else if (e.type === 'hacker') this.hackerBrain(e);
      else if (e.type === 'sniper') this.sniperBrain(e, dt);
      else this.raiderBrain(e, dt);
      e.update(dt, this.world);
      if (e.dug) { this.loot.spawn(e.dug.x, e.dug.y, e.dug.type); e.dug = null; } // прокопанная жила падает лутом, не пропадает
    }
    if (this.shots) this.shots.update(dt, this.world, this.unit, (dmg) => { if (!this.debug && this.unit) this.unit.hp = Math.max(0, this.unit.hp - dmg); });
    this.enemies = this.enemies.filter((e) => !e.dead);
  },
});
