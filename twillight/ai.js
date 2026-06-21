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
      // База: ПРОБОЙ засчитывается, только когда копатель РЕАЛЬНО влез в пещеру (`inCave`), а не упёрся в
      // неразрушимый фундамент под ней (тогда магистраль обрывалась «под фундаментом» и рейдеры/взломщики
      // не доходили до города). Так копатель обходит фундамент и пробивает ход В пещеру — магистраль связна.
      // Страховка от патологии: за DIGGER_TOCITY_LIMIT кадров не влез → засчитать по старому (near), не копать вечно.
      e.cityT = (e.cityT || 0) + 1;
      const reached = e._toBase ? (this.world.inCave(e.tileX, e.tileY) || (e.cityT > DIGGER_TOCITY_LIMIT && this.near(e, e.target.x, e.target.y, RAID_REACH_R))) : this.near(e, e.target.x, e.target.y, RAID_REACH_R);
      if (reached) {
        if (e._toBase) { this.logEvent('МАГИСТРАЛЬ К БАЗЕ ПРОБИТА'); if (this.hints) this.hints.show('ПРОРЫВ К БАЗЕ'); e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; e._returning = true; }   // ПРОРЫВ — на РЕАЛЬНОМ влезании в пещеру (виден игроку)
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
    if (e.carry) {                                              // несёт заряд → ДОМОЙ
      if (this.near(e, e.homeX, e.homeY, e.homeR)) { const n = this.nestAt(e.homeX, e.homeY); if (n) n.charge++; e.dead = true; return; }
      e.draining = false; e.drainT = 0;
      if (e.state2 !== IDLE) return;
      const p = this.airPath(e.tileX, e.tileY, e.homeX, e.homeY, e.homeR);
      e.target = p && p.length > 1 ? { x: p[1].x, y: p[1].y } : { x: e.homeX, y: e.homeY };
      return;
    }
    // к базе: цель — ВЛЕЗТЬ В ПЕЩЕРУ (а не упереться под фундамент в радиусе RAID_REACH_R). Внутри — высасывает.
    if (this._inBaseCave(e)) {
      e.draining = true; e.drainT += dt; e.commit = null;
      if (e.drainT >= RAID_DRAIN_TIME) {
        if (!this.debug) { this.city.drain(RAID_DRAIN); this.logEvent('РЕЙДЕР ВЫСОСАЛ ЭНЕРГИЮ'); } // сначала таймер гибернации, переполнение — в HP кольца
        e.carry = 'charge'; e.draining = false; e.drainT = 0;
      }
      return;
    }
    e.draining = false; e.drainT = 0;
    if (e.state2 !== IDLE) return;
    e.target = this._baseStep(e);                               // ход В ПЕЩЕРУ (узкий reach), фолбэк — к магистрали
  },
  // Враг в пещере базы? (город = стартовая каверна; туда должны дойти рейдеры/взломщики, а не под фундамент)
  _inBaseCave(e) { return this.world.inCave(e.tileX, e.tileY); },
  // Следующий шаг к базе: путь СТРОГО В ПЕЩЕРУ (reach 1 → BFS обходит фундамент в пролом), фолбэк — к
  // магистрали под базой (reach RAID_REACH_R), чтобы не упираться в породу, если пещера ещё не пробита.
  _baseStep(e) {
    const b = this.cities[0];
    const p = this.airPath(e.tileX, e.tileY, b.cx, b.cy, 1) || this.airPath(e.tileX, e.tileY, b.cx, b.cy, RAID_REACH_R);
    return p && p.length > 1 ? { x: p[1].x, y: p[1].y } : { x: b.cx, y: b.cy };
  },
  // Охотник: летает за юнитом по тоннелям; при сближении телеграф→ТАРАН (px-рывок), удар по hp юнита (разово),
  // отскок+кулдаун, повтор. ФАЗА 4: если юнит недосягаем (заслонён/стена), а рядом активная структура с LOS —
  // таранит ЕЁ (турель-бустер); любой таран при касании структуры пробивает её (`HUNTER_STRUCT_DMG`). Стену-породу
  // НЕ бьёт (упор в породу = `cBlocked` → отскок; стену грызёт копатель). Локомоция charge/recover — в Enemy.update.
  hunterBrain(e, dt) {
    const u = this.unit;
    if (!e.cstate) e.cstate = 'approach';
    if (e.cstate === 'approach') {
      if (e.state2 !== IDLE) return;
      const uDist = u ? Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE : Infinity;
      if (u && uDist <= HUNTER_CHARGE_R && this._hunterLOS(e, u)) { e._tStruct = null; this._hunterWind(e); return; }  // приоритет — юнит
      const s = this._hunterStructTarget(e);
      if (s) { e._tStruct = s; this._hunterWind(e); return; }                                                         // юнит недосягаем → таран структуры рядом
      e._tStruct = null;
      const path = u ? this.airPath(e.tileX, e.tileY, u.tileX, u.tileY, 1) : null;
      e.target = (path && path.length > 1) ? { x: path[1].x, y: path[1].y } : (u ? { x: u.tileX, y: u.tileY } : null);
    } else if (e.cstate === 'wind') {
      e.cT += dt;
      if (e.cT < HUNTER_WIND) return;
      const tgt = (e._tStruct && !e._tStruct.dying) ? e._tStruct : u;   // нацел в момент броска (юнит — с упреждением)
      if (!tgt) { e.cstate = 'approach'; e.cT = 0; return; }
      const dpx = wrapDeltaPx(tgt.px, e.px), dpy = tgt.py - e.py, d = Math.hypot(dpx, dpy) || 1, k = HUNTER_CHARGE_SPEED * TILE / d;
      e.cvx = dpx * k; e.cvy = dpy * k; e.cstate = 'charge'; e.cT = 0; e.cHit = false; e.cBlocked = false;
    } else if (e.cstate === 'charge') {
      e.cT += dt;
      if (!e.cHit && this.structures) for (const s of this.structures.list) {   // таран пробивает активную структуру при касании
        if (s.dying || s.def.solid || s.state !== 'active') continue;
        if (Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= HUNTER_HIT_R) {
          e.cHit = true; if (!this.debug) { s.damage(HUNTER_STRUCT_DMG); this.logEvent('ОХОТНИК ПРОБИЛ СТРУКТУРУ'); }
          this._hunterRecoverVel(e); return;
        }
      }
      if (u) { const dpx = wrapDeltaPx(u.px, e.px), dpy = u.py - e.py, d = Math.hypot(dpx, dpy);
        if (!e.cHit && d / TILE <= HUNTER_HIT_R) { e.cHit = true; if (!this.debug) { u.hp = Math.max(0, u.hp - (HUNTER_DMG_MIN + Math.random() * (HUNTER_DMG_MAX - HUNTER_DMG_MIN))); this.logEvent('ОХОТНИК ТАРАНИЛ ЮНИТ'); } this._hunterRecover(e, dpx, dpy, d); return; }
      }
      if (e.cBlocked || e.cT >= HUNTER_CHARGE_MAX) this._hunterRecoverVel(e);
    } else if (e.cstate === 'recover') {
      e.cT += dt; e.cvx *= 0.88; e.cvy *= 0.88;
      if (e.cT >= HUNTER_RECOVER) { e.cstate = 'approach'; e.cT = 0; e.cvx = 0; e.cvy = 0; e.commit = null; e.target = null; e._tStruct = null; }
    }
  },
  _hunterWind(e) { e.cstate = 'wind'; e.cT = 0; e.commit = null; e.target = null; },
  _hunterRecover(e, dpx, dpy, d) { const k = d > 1e-3 ? HUNTER_SPEED * TILE / d : 0; e.cvx = -dpx * k; e.cvy = -dpy * k; e.cstate = 'recover'; e.cT = 0; },  // отскок ОТ юнита
  _hunterRecoverVel(e) { const d = Math.hypot(e.cvx, e.cvy) || 1, k = HUNTER_SPEED * TILE / d; e.cvx = -e.cvx * k; e.cvy = -e.cvy * k; e.cstate = 'recover'; e.cT = 0; },  // отскок назад по вектору разгона (таран структуры/промах)
  // Ближайшая активная структура в радиусе тарана с прямой видимостью (стены-породу не цель — её не пробить тараном).
  _hunterStructTarget(e) {
    if (!this.structures) return null;
    let best = null, bd = HUNTER_CHARGE_R + 0.5;
    for (const s of this.structures.list) {
      if (s.dying || s.def.solid || s.state !== 'active') continue;
      const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (d < bd && this._hunterLOS(e, s)) { bd = d; best = s; }
    }
    return best;
  },
  _hunterLOS(e, u) {                                              // линия к юниту в основном по воздуху (рывок не упрётся сразу в породу)
    const dpx = wrapDeltaPx(u.px, e.px), dpy = u.py - e.py, steps = Math.max(2, Math.ceil(Math.hypot(dpx, dpy) / TILE));
    let solid = 0;
    for (let i = 1; i < steps; i++) { const t = i / steps;
      if (isSolid(this.world.tileAt(wrapX(Math.round((e.px + dpx * t - TILE / 2) / TILE)), Math.round((e.py + dpy * t - TILE / 2) / TILE)))) solid++;
    }
    return solid <= 1;
  },
  // Взломщик: летит к базе по тоннелям, ВЛЕЗАЕТ В ПЕЩЕРУ и ВЗЛАМЫВАЕТ (`e.hacking` → game копит файрволл).
  hackerBrain(e) {
    e.hacking = false;
    if (this._inBaseCave(e)) { e.draining = true; e.hacking = true; e.commit = null; return; }  // в пещере базы — взламывает
    e.draining = false;
    if (e.state2 !== IDLE) return;
    e.target = this._baseStep(e);
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
    if (u && this.shots && distU <= SNIPER_RANGE && distU >= SNIPER_MINDIST && this._hunterLOS(e, u) && e.aimT <= 0) {  // огонь по юниту
      this.shots.fire(e.px, e.py, u.px, u.py); e.aimT = SNIPER_COOLDOWN; e.firing = 0.13;
    } else if (this.shots && e.aimT <= 0) {   // ФАЗА 4: по юниту не вышло — бьём по структуре игрока в радиусе
      const s = this._sniperStructTarget(e);
      if (s) { this.shots.fire(e.px, e.py, s.px, s.py); e.aimT = SNIPER_COOLDOWN; e.firing = 0.13; e.aimAng = Math.atan2(s.py - e.py, wrapDeltaPx(s.px, e.px)); }
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
  // Ближайшая активная структура в радиусе снайпера с прямой видимостью (фаза 4: цель, когда нет юнита/LOS).
  _sniperStructTarget(e) {
    if (!this.structures) return null;
    let best = null, bd = SNIPER_RANGE + 0.5;
    for (const s of this.structures.list) {
      if (s.dying || s.def.solid || s.state !== 'active') continue;
      const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (d < bd && this._hunterLOS(e, s)) { bd = d; best = s; }
    }
    return best;
  },
  updateEnemies(dt) {
    // ВЫСТРЕЛЫ тикают ВСЕГДА (до раннего выхода): останки роботов (hazards.js) стреляют и в режиме истории, где врагов нет.
    if (this.shots) this.shots.update(dt, this.world, this.unit, (dmg) => { if (!this.debug && this.unit) this.unit.hp = Math.max(0, this.unit.hp - dmg); }, this.debug ? null : (this.structures && this.structures.list));
    if (this.storyMode) return;   // режим истории: дикий город не действует — ни спавна волн, ни мозгов
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
    this.enemies = this.enemies.filter((e) => !e.dead);
  },
});
