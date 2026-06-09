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
        if (e._toBase) { this.logEvent('КОПАТЕЛЬ ИДЁТ К БАЗЕ'); if (this.hints) this.hints.show('ПРОРЫВ К БАЗЕ'); }
        break;
      }
      // разведка завершена (все города найдены) → домой, иначе копатель блуждал бы вечно
      if (e.state === 'seek' && this.cities.every((c) => c.found)) { e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; }
    } else if (e.state === 'tocity') {
      if (this.near(e, e.target.x, e.target.y, RAID_REACH_R)) {   // дорылся вплотную
        if (e._toBase) { this.logEvent('МАГИСТРАЛЬ К БАЗЕ ПРОБИТА'); e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; }
        else { e.state = 'seek'; e.target = null; }   // чужой город — лишь путевая точка: пробил и ПРОДОЛЖАЕТ искать (в т.ч. базу)
      }
    } else if (e.state === 'return' && this.near(e, e.homeX, e.homeY, e.homeR)) e.dead = true; // вернулся в гнездо
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
          if (!this.debug) { this.city.drain(RAID_DRAIN); this.logEvent('РЕЙДЕР ВЫСОСАЛ КОНТУР'); } // перманентный срез контура (база не восстановит)
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
  updateEnemies(dt) {
    if (this.cycle.n !== this.lastCycleN) { this.onCycleStart(this.cycle.n); this.lastCycleN = this.cycle.n; }
    for (const e of this.enemies) {
      if (e.type === 'digger') this.diggerBrain(e);
      else if (e.type === 'collector') this.collectorBrain(e);
      else this.raiderBrain(e, dt);
      e.update(dt, this.world);
      if (e.dug) { this.loot.spawn(e.dug.x, e.dug.y, e.dug.type); e.dug = null; } // прокопанная жила падает лутом, не пропадает
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  },
});
