'use strict';

// AI диких гнёзд (вынесено из game.js): спавн волн по циклам + мозги ВСЕХ 13 типов врагов
// (копатель/собиратель/рейдер/охотник/взломщик/снайпер/мошкара/залежень/закладка/латальщик/
// таран/мортира/скверносей) + BFS-путь по воздуху. Это оркестрация над состоянием
// Game (world/enemies/cities/cycle/city), поэтому методы домешиваются в Game.prototype —
// тела не менялись, `this` = инстанс Game. Грузится ПОСЛЕ game.js (Game уже определён),
// до создания инстанса (`new Game()` на событии load).
Object.assign(Game.prototype, {
  // Волны: с началом каждого цикла гнёзда досылают врагов из случайного гнезда.
  onCycleStart(n) {
    const nests = this.world.wilds.filter((w) => !w.disabled); if (!nests.length) return;   // подавленные гнёзда волн не шлют
    const nest = () => nests[Math.floor(Math.random() * nests.length)];
    const homeR = (w) => Math.max(w.rx, w.ry) + 1;  // «дом» = вся каверна гнезда, иначе центр недостижим
    const count = (t) => this.enemies.filter((e) => e.type === t && !e.friendly).length;   // живых ВРАЖДЕБНЫХ типа (дружественные не в счёт потолка)
    // ── ЭСКАЛАЦИЯ: потолок и размер пачки растут с номером цикла → фронт НЕ выходит на плато (типы вводятся ступенчато выше).
    const cap = (base, intro, slow) => base + Math.floor(Math.max(0, n - intro) / (slow ? WAVE_CAP_GROW_SLOW : WAVE_CAP_GROW));
    const pack = (intro, slow) => slow ? 1 : 1 + Math.floor(Math.max(0, n - intro) / WAVE_PACK_GROW);
    let total = this.enemies.filter((e) => !e.friendly && !e.dying && !e.dead).length;   // для перф-предохранителя
    // спавн до `k` юнитов типа из выбранного гнезда (pickNest→гнездо или null), не превышая ни потолок типа, ни глобальный кап
    const spawn = (type, k, capN, pickNest) => {
      let live = count(type);
      for (let i = 0; i < k && live < capN && total < ENEMY_HARD_CAP; i++) {
        const w = pickNest(); if (!w) break;
        const e = new Enemy(w.cx, w.cy, type, w.cx, w.cy, homeR(w));
        if (type === 'digger') { this._diggerN = (this._diggerN || 0) + 1; e.sweepSign = (this._diggerN % 2) ? 1 : -1; }   // чередуем сторону свипа → копатели делят тор
        this.enemies.push(e); live++; total++;
      }
    };
    const linkedBase = () => { const h = this.cities[0]; const l = nests.filter((w) => this.airPath(w.cx, w.cy, h.cx, h.cy, RAID_REACH_R)); return l.length ? l[Math.floor(Math.random() * l.length)] : null; };
    const linkedUnit = () => { if (!this.unit) return null; const l = nests.filter((w) => this.airPath(w.cx, w.cy, this.unit.tileX, this.unit.tileY, 2)); return l.length ? l[Math.floor(Math.random() * l.length)] : null; };

    // КОПАТЕЛЬ-разведчик: с цикла 2, пока есть ненайденные города. НЕ эскалирует (потолок = число городов) — это скаут/прокладчик магистрали, а не масса угрозы.
    if (n >= 2 && this.cities.some((c) => !c.found)) spawn('digger', 1, this.cities.length, nest);
    // СОБИРАТЕЛЬ: с цикла 2 — растущий потолок/пачка.
    if (n >= 2) spawn('collector', pack(2), cap(COLLECTOR_CAP, 2), nest);
    // РЕЙДЕР (бой): с цикла 3, из гнезда, СВЯЗАННОГО магистралью с базой (копатель прорыл; рейдер не копает).
    if (n >= 3 && this.cities[0].found) spawn('raider', pack(3), cap(RAIDER_CAP, 3), linkedBase);
    // ОХОТНИК (бой): с цикла 4, из связанного воздухом с ЮНИТОМ гнезда.
    if (n >= 4) spawn('hunter', pack(4), cap(HUNTER_CAP, 4), linkedUnit);
    // ВЗЛОМЩИК: с цикла 5, из связанного с базой. МЕДЛЕННЫЙ рост (slow): у файрволла нет контр-юнита (только турели) → быстрый рост = неотвратимый проигрыш.
    if (n >= 5 && this.cities[0].found) spawn('hacker', pack(5, true), cap(FIREWALL_HACKER_CAP, 5, true), linkedBase);
    // СНАЙПЕР: с цикла 6, ТОЛЬКО при живом взломщике (охраняет его). Медленный рост.
    if (n >= 6 && this.enemies.some((e) => e.type === 'hacker' && !e.friendly)) spawn('sniper', pack(6, true), cap(SNIPER_CAP, 6, true), linkedBase);
    const hasStructs = this.structures && this.structures.list.length > 0;   // осадные типы спавнятся, только если игроку ЕСТЬ что ломать (иначе непонятны)
    // МОШКАРА: с цикла 3, пачкой из связанного с юнитом гнезда; досылаем, когда рой иссяк.
    if (n >= 3 && count('swarm_midge') === 0) spawn('swarm_midge', MIDGE_PACK, MIDGE_CAP, linkedUnit);
    // ЗАЛЕЖЕНЬ: с цикла 3 — РОЖДАЕТСЯ В ГНЕЗДЕ, роет к юниту и зарывается в засаду (медленный рост: засады копятся).
    if (n >= 3) spawn('lurker', pack(3, true), cap(LURKER_CAP, 3, true), nest);
    // ЗАКЛАДКА: с цикла 4, при найденной базе — копатель-смертник к базе (роет свой путь, из любого гнезда).
    if (n >= 4 && this.cities[0].found) spawn('mine_planter', pack(4), cap(MINE_PLANTER_CAP, 4), nest);
    // СКВЕРНОСЕЙ: с цикла 5 — наземный краулер к юниту, роняет маяки-помехи (из любого гнезда).
    if (n >= 5) spawn('blight_sower', pack(5), cap(BLIGHT_SOWER_CAP, 5), nest);
    // ЛАТАЛЬЩИК: с цикла 5, при наличии раненых союзников; одиночка из связанного с юнитом гнезда.
    if (n >= 5 && this.enemies.some((e) => !e.friendly && !e.dying && e.hp < e.maxHp && e.type !== 'mender' && e.type !== 'swarm_midge')) spawn('mender', 1, MENDER_CAP, linkedUnit);
    // ТАРАН: с цикла 5, при наличии построек; растущий потолок/пачка, из связанного с базой гнезда.
    if (n >= 5 && this.cities[0].found && hasStructs) spawn('siege_ram', pack(5), cap(SIEGE_RAM_CAP, 5), linkedBase);
    // МОРТИРА: с цикла 7, при наличии построек; медленный рост (дальний и опасный).
    if (n >= 7 && this.cities[0].found && hasStructs) spawn('siege_mortar', pack(7, true), cap(SIEGE_MORTAR_CAP, 7, true), linkedBase);
  },
  near(e, cx, cy, r) { const d = Math.abs(((e.tileX - cx) % MAP_W + MAP_W) % MAP_W); return Math.min(d, MAP_W - d) <= r && Math.abs(e.tileY - cy) <= r; },
  nestAt(x, y) { return this.world.wilds.find((w) => w.cx === x && w.cy === y); },   // гнездо по координатам дома врага
  // РАЗБУЖЕННЫЙ город → автономная ДРУЖЕСТВЕННАЯ фракция (минимум): копатель + сборщик с флагом `friendly`.
  // Живут в this.enemies (тикаются и в режиме истории, см. updateEnemies), турели игрока их игнорируют
  // (structures: `e.friendly` пропускается). Дома — сам город (homeX/Y = центр каверны), склад — `cavern.loot`.
  spawnFriendlyCity(c) {
    if (c._friendlySpawned) return; c._friendlySpawned = true;
    const homeR = Math.max(c.rx, c.ry) + 1;
    for (const type of ['digger', 'collector']) {
      const e = new Enemy(c.cx, c.cy, type, c.cx, c.cy, homeR);
      e.friendly = true; e.cavern = c;
      this.enemies.push(e);
    }
  },
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
    if (e.friendly) {   // дружественный копатель: блуждание-копка ВОКРУГ своего города (случайные локальные цели), НЕ ищет города игрока
      if (!e.target || this.near(e, e.target.x, e.target.y, 1)) {
        const ang = Math.random() * TAU, rad = 3 + Math.random() * 5;
        const ty = Math.max(DIGGER_MIN_Y + 2, Math.min(MAP_H - 2, Math.round(e.homeY + Math.sin(ang) * rad)));
        e.target = { x: wrapX(Math.round(e.homeX + Math.cos(ang) * rad)), y: ty }; e.commit = null;
      }
      return;
    }
    if (e.state === 'seek') {
      for (const c of this.cities) if (!c.found && this.near(e, c.cx, c.cy, c.dr)) {
        c.found = true;
        // докапываемся ВПЛОТНУЮ в пещеру любого города (база И чужие): пробой видим игроку,
        // к базе остаётся магистраль для рейдеров. Только база даёт телеграф-предупреждение.
        e.state = 'tocity'; e.target = { x: c.cx, y: c.cy }; e._toBase = (c === this.cities[0]);
        if (e._toBase) this.logEvent(STR.log.diggerSpotBase);   // только засёк (издалека, сквозь породу) — без громкой подсказки
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
        if (e._toBase) { this.logEvent(STR.log.tunnelBreached); if (this.hints) this.hints.show(STR.log.breachHint); e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; e._returning = true; }   // ПРОРЫВ — на РЕАЛЬНОМ влезании в пещеру (виден игроку)
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
    } else if (e.state === 'return' && this.near(e, e.homeX, e.homeY, e.homeR)) {                // донёс ресурс домой
      if (e.friendly) { if (e.cavern) e.cavern.loot = (e.cavern.loot || 0) + 1; e.carry = null; e.state = 'seek'; e.target = null; e.commit = null; }   // дружественный: склад в свой город, дальше работает (не исчезает)
      else { const n = this.nestAt(e.homeX, e.homeY); if (n) n.loot++; e.dead = true; }
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
    // к базе: цель — подойти ВПЛОТНУЮ к ядру (не край каверны). Только там — высасывает.
    if (this._atBaseClose(e)) {
      e.draining = true; e.drainT += dt; e.commit = null;
      if (e.drainT >= RAID_DRAIN_TIME) {
        if (!this.debug) { this.city.drain(RAID_DRAIN); this.logEvent(STR.log.raiderDrain(ENEMY_RU[e.type])); } // сначала таймер гибернации, переполнение — в HP кольца
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
  // ВПЛОТНУЮ к ЯДРУ базы (≤ BASE_ACT_R от центра города) И в пещере — условие ДЕЙСТВИЯ (дренаж/взлом), а не «где-то в каверне»
  _atBaseClose(e) { const b = this.cities[0]; return !!b && this.near(e, b.cx, b.cy, BASE_ACT_R) && this._inBaseCave(e); },
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
    const seeU = u && u.stealthT <= 0;   // СТЕЛС: при активной невидимости юнит для охотника «исчезает» (цель теряется)
    if (e.cstate === 'approach') {
      if (e.state2 !== IDLE) return;
      const uDist = seeU ? Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE : Infinity;
      if (seeU && uDist <= HUNTER_CHARGE_R && this._hunterLOS(e, u)) { e._tStruct = null; this._hunterWind(e); return; }  // приоритет — юнит
      const s = this._hunterStructTarget(e);
      if (s) { e._tStruct = s; this._hunterWind(e); return; }                                                         // юнит недосягаем/невидим → таран структуры рядом
      e._tStruct = null;
      const path = seeU ? this.airPath(e.tileX, e.tileY, u.tileX, u.tileY, 1) : null;
      e.target = (path && path.length > 1) ? { x: path[1].x, y: path[1].y } : (seeU ? { x: u.tileX, y: u.tileY } : null);
    } else if (e.cstate === 'wind') {
      e.cT += dt;
      if (e.cT < HUNTER_WIND) return;
      const tgt = (e._tStruct && !e._tStruct.dying) ? e._tStruct : (seeU ? u : null);   // нацел в момент броска (стелс мид-замаха → срыв)
      if (!tgt) { e.cstate = 'approach'; e.cT = 0; return; }
      const dpx = wrapDeltaPx(tgt.px, e.px), dpy = tgt.py - e.py, d = Math.hypot(dpx, dpy) || 1, k = HUNTER_CHARGE_SPEED * TILE / d;
      e.cvx = dpx * k; e.cvy = dpy * k; e.cstate = 'charge'; e.cT = 0; e.cHit = false; e.cBlocked = false;
    } else if (e.cstate === 'charge') {
      e.cT += dt;
      if (!e.cHit && this.structures) for (const s of this.structures.list) {   // таран пробивает активную структуру при касании
        if (s.dying || s.def.solid || s.state !== 'active') continue;
        if (Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= HUNTER_HIT_R) {
          e.cHit = true; if (!this.debug) { s.damage(HUNTER_STRUCT_DMG); this.logEvent(STR.log.hunterStruct); }
          this._hunterRecoverVel(e); return;
        }
      }
      if (u) { const dpx = wrapDeltaPx(u.px, e.px), dpy = u.py - e.py, d = Math.hypot(dpx, dpy);
        if (!e.cHit && d / TILE <= HUNTER_HIT_R) { e.cHit = true; if (!this.debug) { u.hurt(HUNTER_DMG_MIN + Math.random() * (HUNTER_DMG_MAX - HUNTER_DMG_MIN), e); this.logEvent(STR.log.hunterRam); } this._hunterRecover(e, dpx, dpy, d); return; }
      }
      if (e.cBlocked || e.cT >= HUNTER_CHARGE_MAX) this._hunterRecoverVel(e);
    } else if (e.cstate === 'recover') {
      e.cT += dt; e.cvx *= ENEMY_RECOVER_FRICTION; e.cvy *= ENEMY_RECOVER_FRICTION;
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
  _hunterLOS(e, u) {   // ⚠️ ОСОЗНАННО отдельная от world.hasLineOfSight: ДОПУСК ≤1 solid-тайла (рывок «сквозь угол»); строгая версия — world.js
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
    if (this._atBaseClose(e)) { e.draining = true; e.hacking = true; e.commit = null; return; }  // ВПЛОТНУЮ к ядру базы — взламывает (не с края каверны)
    e.draining = false;
    if (e.state2 !== IDLE) return;
    e.target = this._baseStep(e);
  },
  // Снайпер: охраняет ближайшего ВЗЛОМЩИКА (держится рядом), КАЙТИТ от юнита (отступает, если близко), бьёт издали
  // проджектайлами по юниту (кулдаун + LOS). Выстрелы — `this.shots`. Нет взломщика → стережёт базу.
  sniperBrain(e, dt) {
    const u = this.unit;
    const seeU = u && u.stealthT <= 0;   // СТЕЛС: невидимый юнит снайпером не захватывается (огонь/отступление — мимо)
    const hacker = this.enemies.find((x) => x.type === 'hacker' && !x.dead);
    const gx = hacker ? hacker.tileX : this.cities[0].cx, gy = hacker ? hacker.tileY : this.cities[0].cy;
    e.aimT = (e.aimT || 0) - dt; e.firing = Math.max(0, (e.firing || 0) - dt);
    let distU = Infinity, dpx = 0, dpy = 0;
    if (u) { dpx = wrapDeltaPx(u.px, e.px); dpy = u.py - e.py; distU = Math.hypot(dpx, dpy) / TILE; e.aimAng = Math.atan2(dpy, dpx); }
    if (seeU && this.shots && distU <= SNIPER_RANGE && distU >= SNIPER_MINDIST && this.world.hasLineOfSight(e.px, e.py, u.px, u.py) && e.aimT <= 0) {  // огонь по юниту (СТРОГАЯ прямая видимость — не сквозь породу)
      this.shots.fire(e.px, e.py, u.px, u.py); e.aimT = SNIPER_COOLDOWN; e.firing = ENEMY_FIRE_FLASH_T;
    } else if (this.shots && e.aimT <= 0) {   // ФАЗА 4: по юниту не вышло — бьём по структуре игрока в радиусе
      const s = this._sniperStructTarget(e);
      if (s) { this.shots.fire(e.px, e.py, s.px, s.py); e.aimT = SNIPER_COOLDOWN; e.firing = ENEMY_FIRE_FLASH_T; e.aimAng = Math.atan2(s.py - e.py, wrapDeltaPx(s.px, e.px)); }
    }
    if (e.state2 !== IDLE) return;
    if (seeU && distU < SNIPER_MINDIST) {                            // близко юнит → отступаем ОТ него
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
      if (d < bd && this.world.hasLineOfSight(e.px, e.py, s.px, s.py)) { bd = d; best = s; }   // СТРОГАЯ ВИДИМОСТЬ — не стрелять сквозь породу
    }
    return best;
  },
  // МОШКАРА: рой-мелочь (летун). Дрейфует к юниту (если виден) или к базе с детерминированным джиттером
  // по seed (рассыпается, а не строится в линию); в контакте грызёт юнита малым уроном по кулдауну.
  // Сносится только AoE — поодиночке слишком много возни, что и задумано.
  midgeBrain(e, dt) {
    const u = this.unit, seeU = u && u.stealthT <= 0;
    if (e.scatterT > 0) {   // РОЙ-КЛАДКА: фаза ИНИЦИАЦИИ — разлёт от точки в стороны (игрок успевает уйти), потом обычная охота
      e.scatterT -= dt;
      if (e.state2 === IDLE) e.target = { x: wrapX(e.tileX + Math.round(Math.cos(e.scatterAng) * 2)), y: Math.max(0, Math.min(MAP_H - 1, e.tileY + Math.round(Math.sin(e.scatterAng) * 2))) };
      return;
    }
    const tgt = seeU ? { x: u.tileX, y: u.tileY } : (this.cities[0] ? { x: this.cities[0].cx, y: this.cities[0].cy } : null);
    if (e.state2 === IDLE && tgt) {
      const jx = (e.seed * 7 | 0) % 3 - 1, jy = (e.seed * 13 | 0) % 3 - 1;   // рассыпной рой
      const p = this.airPath(e.tileX, e.tileY, wrapX(tgt.x + jx), Math.max(0, Math.min(MAP_H - 1, tgt.y + jy)), 1);
      e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : tgt;
    }
    e._biteCd = Math.max(0, (e._biteCd || 0) - dt);
    if (u && e._biteCd <= 0 && Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE <= MIDGE_HIT_R) {
      if (!this.debug) u.hurt(MIDGE_DMG, e); e._biteCd = MIDGE_HIT_CD;
    }
  },
  // ближайший раненый ВРАЖДЕБНЫЙ союзник (не лекарь/мошкара — их не лечим), для латальщика
  nearestWounded(e) {
    let best = null, bd = Infinity;
    for (const o of this.enemies) {
      if (o === e || o.friendly || o.dying || o.dead || o.hp >= o.maxHp) continue;
      if (o.type === 'mender' || o.type === 'swarm_midge') continue;
      const d = Math.hypot(wrapDeltaPx(o.px, e.px), o.py - e.py);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  },
  // ЛАТАЛЬЩИК: саппорт-летун. Догоняет ближайшего раненого союзника и латает его (не себя); нет раненых — дрейф к гнезду.
  menderBrain(e, dt) {
    const w = this.nearestWounded(e); e._healTgt = w;
    if (!w) { if (e.state2 === IDLE) { const p = this.airPath(e.tileX, e.tileY, e.homeX, e.homeY, e.homeR); e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : { x: e.homeX, y: e.homeY }; } return; }
    const d = Math.hypot(wrapDeltaPx(w.px, e.px), w.py - e.py) / TILE;
    if (d <= MENDER_HEAL_R) { if (!this.debug) w.hp = Math.min(w.maxHp, w.hp + MENDER_HEAL_RATE * dt); e.target = null; }   // в радиусе — лечит, стоит
    else if (e.state2 === IDLE) { const p = this.airPath(e.tileX, e.tileY, w.tileX, w.tileY, 1); e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : { x: w.tileX, y: w.tileY }; }
  },
  // ближайшая активная боевая структура в радиусе мортиры (стены-solid пропускаем — мортира бьёт эмплейсменты, не заборы)
  _mortarStructTarget(e) {
    if (!this.structures) return null;
    let best = null, bd = MORTAR_RANGE + 0.5;
    for (const s of this.structures.list) {
      if (s.dying || s.def.solid || s.state !== 'active') continue;
      const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (d < bd && this.world.hasLineOfSight(e.px, e.py, s.px, s.py)) { bd = d; best = s; }   // не сквозь ПОРОДУ (стены-структуры не тайлы → мортира всё ещё бьёт ПОВЕРХ заборов игрока)
    }
    return best;
  },
  // МОРТИРА: дальний структуролом (летун). Навесом бьёт ближайшую оборону издали, кайтит от юнита; нет целей — стережёт базу.
  mortarBrain(e, dt) {
    const u = this.unit, seeU = u && u.stealthT <= 0;
    e.aimT = (e.aimT || 0) - dt; e.firing = Math.max(0, (e.firing || 0) - dt);
    let distU = Infinity, dpx = 0, dpy = 0;
    if (u) { dpx = wrapDeltaPx(u.px, e.px); dpy = u.py - e.py; distU = Math.hypot(dpx, dpy) / TILE; }
    const s = this._mortarStructTarget(e);
    if (s) {
      e.aimAng = Math.atan2(s.py - e.py, wrapDeltaPx(s.px, e.px));
      const ds = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (this.shots && ds <= MORTAR_RANGE && ds >= MORTAR_MINDIST && e.aimT <= 0) { this.shots.fire(e.px, e.py, s.px, s.py, MORTAR_DMG); e.aimT = MORTAR_COOLDOWN; e.firing = ENEMY_FIRE_FLASH_T; }
    }
    if (e.state2 !== IDLE) return;
    if (seeU && distU < MORTAR_MINDIST) {   // юнит близко → отступаем ОТ него
      const sx = dpx === 0 ? ((e.seed & 1) ? 1 : -1) : Math.sign(dpx);
      e.target = { x: wrapX(e.tileX - sx * 4), y: Math.max(0, Math.min(MAP_H - 1, e.tileY - Math.sign(dpy || 1) * 2)) };
    } else if (s) {
      if (this.near(e, s.tileX, s.tileY, MORTAR_RANGE - 1)) e.target = null;   // в радиусе обстрела — стоим
      else { const p = this.airPath(e.tileX, e.tileY, s.tileX, s.tileY, MORTAR_MINDIST); e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : { x: s.tileX, y: s.tileY }; }
    } else { const b = this.cities[0]; if (this.near(e, b.cx, b.cy, MORTAR_GUARD_R)) e.target = null; else { const p = this.airPath(e.tileX, e.tileY, b.cx, b.cy, MORTAR_GUARD_R); e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : { x: b.cx, y: b.cy }; } }
  },
  // ближайшая постройка в радиусе поиска тарана — СТЕНЫ ВКЛЮЧЕНЫ (таран ломает заборы телом, LOS не нужен)
  _ramStructTarget(e) {
    if (!this.structures) return null;
    let best = null, bd = RAM_SEEK_R;
    for (const s of this.structures.list) {
      if (s.dying) continue;
      const d = Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },
  // ТАРАН: наземный структуролом-мили (летун-локомоция как рейдер + разгон как охотник). Цель — постройки (вкл. стены);
  // нет построек — идёт к базе. Сближается → замах → таранный рывок → урон постройке → откат.
  ramBrain(e, dt) {
    if (!e.cstate) e.cstate = 'approach';
    if (e.cstate === 'approach') {
      if (e.state2 !== IDLE) return;
      const s = this._ramStructTarget(e);
      if (s) {
        if (Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= RAM_CHARGE_R) { e._tStruct = s; e.cstate = 'wind'; e.cT = 0; e.commit = null; e.target = null; return; }
        const p = this.airPath(e.tileX, e.tileY, s.tileX, s.tileY, 1); e.target = (p && p.length > 1) ? { x: p[1].x, y: p[1].y } : { x: s.tileX, y: s.tileY };
      } else e.target = this._baseStep(e);
    } else if (e.cstate === 'wind') {
      e.cT += dt; if (e.cT < RAM_WIND) return;
      const tgt = (e._tStruct && !e._tStruct.dying) ? e._tStruct : null;
      if (!tgt) { e.cstate = 'approach'; e.cT = 0; return; }
      const dpx = wrapDeltaPx(tgt.px, e.px), dpy = tgt.py - e.py, d = Math.hypot(dpx, dpy) || 1, k = RAM_CHARGE_SPEED * TILE / d;
      e.cvx = dpx * k; e.cvy = dpy * k; e.cstate = 'charge'; e.cT = 0; e.cHit = false; e.cBlocked = false;
    } else if (e.cstate === 'charge') {
      e.cT += dt;
      if (!e.cHit && this.structures) for (const s of this.structures.list) {
        if (s.dying) continue;
        if (Math.hypot(wrapDeltaPx(s.px, e.px), s.py - e.py) / TILE <= RAM_HIT_R) { e.cHit = true; if (!this.debug) s.damage(RAM_DMG); this._hunterRecoverVel(e); return; }
      }
      if (e.cBlocked || e.cT >= RAM_CHARGE_MAX) this._hunterRecoverVel(e);
    } else if (e.cstate === 'recover') {
      e.cT += dt; e.cvx *= ENEMY_RECOVER_FRICTION; e.cvy *= ENEMY_RECOVER_FRICTION;
      if (e.cT >= RAM_RECOVER) { e.cstate = 'approach'; e.cT = 0; e.cvx = 0; e.cvy = 0; e.commit = null; e.target = null; e._tStruct = null; }
    }
  },
  // ЗАКЛАДКА: копатель-смертник. Роет к базе (как копатель), у базы ЗАКАПЫВАЕТСЯ и ждёт (заморожен).
  // Юнит подошёл вплотную → мигает (телеграф) → взрыв как у мины (`_mineBlast`) и гибнет. Ушёл — сброс.
  minePlanterBrain(e, dt) {
    const u = this.unit, b = this.cities[0];
    if (!e.mpState) e.mpState = 'tobase';
    if (e.mpState === 'armed') {
      e.draining = true;   // зарыт, не двигается
      const near = u && Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE <= MINE_PLANT_R;
      if (near) { e.mpT = (e.mpT || 0) + dt; if (e.mpT >= MINE_BLINK_T) { this._mineBlast({ tx: e.tileX, ty: e.tileY }); e.dead = true; } }
      else e.mpT = 0;   // отошёл — не взрывается
      return;
    }
    if (this.world.inCave(e.tileX, e.tileY) || this.near(e, b.cx, b.cy, RAID_REACH_R)) { e.mpState = 'armed'; e.draining = true; return; }
    e.target = { x: b.cx, y: b.cy };   // копает к базе
  },
  // ЗАЛЕЖЕНЬ: РОЖДАЕТСЯ В ГНЕЗДЕ → роет к юниту (`travel`, как закладка к базе) → в зоне засады ЗАРЫВАЕТСЯ в стенку
  // своего хода и замирает (`buried`, `draining`). Юнит вплотную → замах → px-ВЫПАД (cstate charge, локомоция охотника)
  // с уроном → отскок → СНАП обратно в нору и снова спит. НЕТ магического спавна вокруг юнита — общая логика мира.
  lurkerBrain(e, dt) {
    const u = this.unit, seeU = u && u.stealthT <= 0;
    if (!e.lurkState) e.lurkState = 'travel';
    if (e.lurkState === 'travel') {   // дорыв из гнезда к юниту, затем зарыться в породу
      e.lurkTravelT = (e.lurkTravelT || 0) + dt;
      const near = u && this.near(e, u.tileX, u.tileY, LURKER_SEED_MAX);
      if ((near || e.lurkTravelT > LURKER_TRAVEL_MAX) && this._lurkerBurrow(e)) return;
      e.target = u ? { x: u.tileX, y: u.tileY } : null;
      return;
    }
    if (e.lurkState === 'buried') {
      e.draining = true;
      if (seeU && Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE <= LURKER_WAKE_R) { e.lurkState = 'wind'; e.lurkT = 0; e.draining = false; }
    } else if (e.lurkState === 'wind') {
      e.lurkT += dt;
      if (e.lurkT >= LURKER_WIND) {
        const dpx = u ? wrapDeltaPx(u.px, e.px) : 1, dpy = u ? u.py - e.py : 0, d = Math.hypot(dpx, dpy) || 1, k = LURKER_LUNGE_SPEED * TILE / d;
        e.cvx = dpx * k; e.cvy = dpy * k; e.cstate = 'charge'; e.lurkState = 'strike'; e.lurkT = 0; e.cHit = false;
      }
    } else if (e.lurkState === 'strike') {
      e.lurkT += dt;
      if (u && !e.cHit && Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE <= LURKER_HIT_R) { e.cHit = true; if (!this.debug) u.hurt(LURKER_DMG, e); }
      if (e.cHit || e.lurkT >= LURKER_STRIKE_T) { e.cstate = 'recover'; e.cvx *= -0.6; e.cvy *= -0.6; e.lurkState = 'rebury'; e.lurkT = 0; }   // ИГНОРИМ cBlocked: выпад из породы
    } else if (e.lurkState === 'rebury') {
      e.lurkT += dt;
      if (e.lurkT >= LURKER_STRIKE_T * 2) {   // снап обратно в нору, замёрз
        e.cstate = null; e.cvx = 0; e.cvy = 0; e.cBlocked = false;
        e.tileX = e.lurkOX; e.tileY = e.lurkOY; e.px = e.tileX * TILE + TILE / 2; e.py = e.tileY * TILE + TILE / 2;
        e.draining = true; e.lurkState = 'buried';
      }
    }
  },
  // Зарыться в засаду: шагнуть в соседнюю ПОРОДУ (стенку прорытого хода) или, если уже в породе, замереть на месте.
  // Так залежень прячется В СТЕНЕ своего тоннеля — юнит, идя этим ходом, пройдёт в 1 тайле и вскроет засаду.
  _lurkerBurrow(e) {
    const W = this.world;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const tx = wrapX(e.tileX + dx), ty = e.tileY + dy;
      if (ty < 0 || ty >= MAP_H) continue;
      if (W.tileAt(tx, ty).type === ROCK) {
        e.tileX = tx; e.tileY = ty; e.px = tx * TILE + TILE / 2; e.py = ty * TILE + TILE / 2;
        e.lurkOX = tx; e.lurkOY = ty; e.lurkState = 'buried'; e.draining = true; e.cstate = null; e.commit = null; e.target = null;
        return true;
      }
    }
    if (W.tileAt(e.tileX, e.tileY).type === ROCK) {   // сам в породе (рыл вверх) — зарыться на месте
      e.lurkOX = e.tileX; e.lurkOY = e.tileY; e.lurkState = 'buried'; e.draining = true; e.cstate = null; e.commit = null; e.target = null;
      return true;
    }
    return false;   // вокруг только воздух (открытая полость) — продолжить дорыв
  },
  updateEnemies(dt) {
    // ВЫСТРЕЛЫ тикают ВСЕГДА (до раннего выхода): останки роботов (hazards.js) стреляют и в режиме истории, где врагов нет.
    if (this.shots) this.shots.update(dt, this.world, this.unit, (dmg) => { if (!this.debug && this.unit) this.unit.hurt(dmg); }, this.debug ? null : (this.structures && this.structures.list));
    const story = this.storyMode;   // режим истории: дикий город не действует, но РАЗБУЖЕННАЯ дружественная фракция работает
    if (!story && this.cycle.n !== this.lastCycleN) {
      this.onCycleStart(this.cycle.n); this.lastCycleN = this.cycle.n;
      if (typeof metaHas === 'function' && metaHas('amb_predict')) {   // ПРОГНОЗ (узел amb_predict): лог о НОВОЙ угрозе следующего цикла
        const f = this._waveHeadline(this.cycle.n + 1);
        if (f && f.isNew) this.logEvent(STR.log.forecast(ENEMY_RU[f.type]));
      }
    }
    for (const e of this.enemies) {
      if (story && !e.friendly) continue;   // в истории живут ТОЛЬКО дружественные (диких не спавним, существующих не тикаем)
      if (e.dying) {   // уничтожен: разовый выброс обломков, доигрываем анимацию, затем чистка (мозг/движение выкл)
        if (!e._fx) { e._fx = true; if (this.dust) for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, sp = TILE * (0.6 + Math.random() * 1.5); this.dust._grit(e.px, e.py, Math.cos(a) * sp, Math.sin(a) * sp - TILE * 0.5, Math.random() < 0.3); } }
        e.deathT -= dt; if (e.deathT <= 0) e.dead = true;
        continue;
      }
      if (e.stunT > 0) { e.stunT -= dt; continue; }   // ЭМИ-стан: заморожен (мозг/движение выкл)
      if (e.type === 'digger') this.diggerBrain(e);
      else if (e.type === 'collector') this.collectorBrain(e);
      else if (e.type === 'hunter') this.hunterBrain(e, dt);
      else if (e.type === 'hacker') this.hackerBrain(e);
      else if (e.type === 'sniper') this.sniperBrain(e, dt);
      else if (e.type === 'swarm_midge') this.midgeBrain(e, dt);
      else if (e.type === 'mender') this.menderBrain(e, dt);
      else if (e.type === 'siege_mortar') this.mortarBrain(e, dt);
      else if (e.type === 'siege_ram') this.ramBrain(e, dt);
      else if (e.type === 'mine_planter') this.minePlanterBrain(e, dt);
      else if (e.type === 'lurker') this.lurkerBrain(e, dt);
      else if (e.type === 'blight_sower') this.blightSowerBrain(e, dt);
      else this.raiderBrain(e, dt);
      e.update(dt, this.world);
      if (e.dug) { this.loot.spawn(e.dug.x, e.dug.y, e.dug.type); e.dug = null; } // прокопанная жила падает лутом, не пропадает
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  },
});
