'use strict';

// ============================================================
// Twilight of the World (Сумерки мира) — оркестрация:
// режимы (menu / inventory / playing / paused), главный цикл,
// склейка систем. Логика и рендер живут в своих файлах.
// ============================================================
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.camera = new Camera(canvas.width, canvas.height);
    this.inventory = new Inventory();
    this.inventory.onStart = () => this.onInventoryStart();
    this.save = loadSave();

    this.mode = 'menu';
    this.world = null;
    this.unit = null;
    this.city = null;
    this.loot = null;
    this.fx = new Fx();
    this.radWidget = new RadWidget();
    this.intro = new Intro();
    this.cycle = new Cycle();
    this.enemies = [];         // враги диких гнёзд (волны по циклам)
    this.lastCycleN = 0;
    this.debug = false;        // B — дебаг-обзор карты (свободная камера, без тумана)
    this.last = performance.now();
    this.fps = 60;

    // предзагрузка шрифтов дизайн-системы, чтобы canvas не мигал фолбэком
    if (document.fonts) [`700 16px ${FONT_DISPLAY}`, `500 13px ${FONT_MONO}`, `400 15px ${FONT_BODY}`].forEach((f) => document.fonts.load(f));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    // Рендерим в НАТИВНОМ разрешении (резко, без апскейла), а зум/раскладку держим
    // в фиксированном «design»-пространстве: ровно VIEW_TILES_Y тайлов по вертикали
    // на любом экране. this.scale переводит design-юниты в нативные пиксели.
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.designH = VIEW_TILES_Y * TILE;
    this.scale = this.canvas.height / this.designH;   // нативных px на 1 design-юнит
    this.designW = this.canvas.width / this.scale;    // ширина видимой области в design-юнитах
    this.coordScale = this.designH / cssH;            // курсор: CSS px → design-юниты
    this.camera.resize(this.designW, this.designH);
  }

  bindPointer() {
    const pos = (e) => ({ x: e.clientX * this.coordScale, y: e.clientY * this.coordScale });
    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = pos(e);
      if (this.mode === 'inventory') this.inventory.pointerDown(x, y);
      else if (this.mode === 'menu' || this.mode === 'paused' || this.mode === 'gameover') this.menuClick(x, y);
      else if (this.mode === 'playing') {
        const ib = invBtnRect(this.designW);
        if (x >= ib.x && x <= ib.x + ib.w && y >= ib.y && y <= ib.y + ib.h) this.openInventory(false);
      }
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const p = pos(e); this.menuMouse = p;            // ховер кнопок меню/паузы/гейм-овера
      if (this.mode === 'inventory') this.inventory.pointerMove(p.x, p.y);
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (this.mode === 'inventory') { const { x, y } = pos(e); this.inventory.pointerUp(x, y); }
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      if (this.mode === 'inventory') { e.preventDefault(); const { x, y } = pos(e); this.inventory.rotateAt(x, y); }
    });
  }

  menuButtons() {
    const W = this.designW, H = this.designH, w = 260, h = 50, x = W / 2 - w / 2;
    let bs = [];
    if (this.mode === 'menu') {
      const lw = 340, lx = W - 48 - lw;
      bs = [{ id: 'start', label: 'Новый забег', desc: 'seed · random', x: lx, y: H * 0.42, w: lw, h: 46, primary: true }];
    } else if (this.mode === 'paused') {
      const y0 = H / 2 - 60;
      bs = [
        { id: 'resume',    label: 'Продолжить',     x, y: y0,       w, h },
        { id: 'inventory', label: 'Ядро / сборка',  x, y: y0 + 64,  w, h },
        { id: 'restart',   label: 'Начать заново',  x, y: y0 + 128, w, h },
        { id: 'mainmenu',  label: 'В главное меню', x, y: y0 + 192, w, h },
      ];
    } else if (this.mode === 'gameover') {
      const bw = 220, bh = 42;
      bs = [{ id: 'mainmenu', label: 'В меню · ENTER', x: W - 48 - bw, y: H - 56, w: bw, h: bh, primary: true }];
    }
    const m = this.menuMouse;
    if (m) for (const b of bs) b.hover = m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;
    return bs;
  }

  menuClick(x, y) {
    for (const b of this.menuButtons()) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.doMenuAction(b.id); return; }
    }
  }
  doMenuAction(id) {
    if (id === 'start') this.openInventory(true);
    else if (id === 'resume') this.mode = 'playing';
    else if (id === 'inventory') this.openInventory(false);
    else if (id === 'restart') { this.endRun(); this.openInventory(true); }
    else if (id === 'mainmenu') { this.endRun(); this.mode = 'menu'; }
  }

  openInventory(preGame) { this.inventory.preGame = preGame; this.mode = 'inventory'; }

  onInventoryStart() {
    if (!this.inventory.getStats().valid) return; // не выпускаем без обязательных модулей
    if (this.inventory.needsExitConfirm() && !this.inventory.confirm) { // нет бура/кожуха → подтверждение выхода
      this.inventory.confirm = () => this.doInventoryStart();
      return;
    }
    this.doInventoryStart();
  }
  doInventoryStart() {
    const stats = this.inventory.getStats();
    if (!this.unit) {        // печать нового тела → интро; всё с полки остаётся на базе
      this.startSession(stats);
      this.intro.reset();
      this.mode = 'intro';
    } else {                  // правка ядра на лету — груз/снятые модули с полки выпадают в мир
      this.unit.setStats(stats);
      this.spillShelfCargo();
      this.mode = 'playing';
    }
  }

  // Полка «Земля» в инвентаре = земля в мире: сброшенный туда груз при выходе
  // выпадает дропами у юнита (с задержкой подбора, чтобы не всосался сразу).
  spillShelfCargo() {
    if (!this.loot) return;
    const shelf = this.inventory.cargo.filter((c) => c.where === 'ground');
    for (const c of shelf) this.loot.spawn(this.unit.tileX, this.unit.tileY, c.type);
    if (shelf.length) this.inventory.cargo = this.inventory.cargo.filter((c) => c.where !== 'ground');
    // снятые модули с полки → инертные дропы в мире, из инвентаря удаляются
    const mods = [...this.inventory.modules.values()].filter((m) => m.where === 'ground');
    for (const m of mods) { this.loot.spawnModule(this.unit.tileX, this.unit.tileY, m.type); this.inventory.modules.delete(m.id); }
    if (mods.length) this.inventory.recompute();
  }

  startSession(stats) {
    this.world = new World();
    this.unit = new Unit(SPAWN_X, SPAWN_Y, stats);
    this.city = new City();
    this.loot = new Loot();
    this.fx.clear();
    this.radWidget.reset();
    this.cycle.reset();
    this.enemies = [];
    this.lastCycleN = 0;
    // цивилизованные города (цель копателей-разведчиков): дом игрока + дружественные
    const homeCx = Math.round(PRINTER.x + PRINTER.w / 2), homeCy = Math.round((CAVE_Y0 + CAVE_Y1) / 2);
    // радиус как у каверны: половина размера пещеры базы + «чутьё» (копатели пробивают корку
    // и доходят до района базы, отдельный большой радиус вниз больше не нужен)
    const homeR = Math.max(Math.ceil((CAVE_X1 - CAVE_X0) / 2), Math.ceil((CAVE_Y1 - CAVE_Y0) / 2)) + DETECT_CITY_PAD;
    // радиус обнаружения покрывает всю каверну (центр — её середина), чтобы копатель не прошёл насквозь незаметно
    this.cities = [{ cx: homeCx, cy: homeCy, dr: homeR, found: false, name: 'База' }]
      .concat(this.world.caverns.map((c) => ({ cx: c.cx, cy: c.cy, dr: Math.max(c.rx, c.ry) + DETECT_CITY_PAD, found: false, name: c.name })));
    this.inventory.resetCargo();
    this.delivered = { iron: 0, organic: 0, crystal: 0 };
    this.deliveredTotal = 0;
    if (!this.save.rep) this.save.rep = {};
    this.quest = makeQuest(this.cycle.n);   // задание контрактного (домашнего) города
    this.questMsg = null;                   // уведомление о результате (текст+таймер)
    this.overReason = null;
    this.camera.snap(this.unit);
    this.world.reveal(SPAWN_X, SPAWN_Y, 3.5); // база видна сразу (в т.ч. на интро)
    this.save.runs = (this.save.runs || 0) + 1;
    writeSave(this.save);
  }
  endRun() { this.unit = null; this.world = null; this.city = null; this.loot = null; }

  // Волны: с началом каждого цикла гнёзда досылают врагов из случайного гнезда.
  onCycleStart(n) {
    const nests = this.world.wilds; if (!nests.length) return;
    const nest = () => nests[Math.floor(Math.random() * nests.length)];
    const homeR = (w) => Math.max(w.rx, w.ry) + 1;  // «дом» = вся каверна гнезда, иначе центр недостижим
    // копатель-разведчик: 1/цикл до числа цивилизованных городов, пока есть ненайденные
    const diggers = this.enemies.filter((e) => e.type === 'digger').length;
    if (this.cities.some((c) => !c.found) && diggers < this.cities.length) {
      const w = nest(); this.enemies.push(new Enemy(w.cx, w.cy, 'digger', w.cx, w.cy, homeR(w)));
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
  }
  near(e, cx, cy, r) { const d = Math.abs(((e.tileX - cx) % MAP_W + MAP_W) % MAP_W); return Math.min(d, MAP_W - d) <= r && Math.abs(e.tileY - cy) <= r; }
  nestAt(x, y) { return this.world.wilds.find((w) => w.cx === x && w.cy === y); }   // гнездо по координатам дома врага
  nearestResource(cx, cy, r) {
    let best = null, bestD = 1e9;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const y = cy + dy; if (y < 0 || y >= MAP_H) continue;
      const t = this.world.tileAt(cx + dx, y);
      if (t.type === ROCK && t.resource) { const d = Math.abs(dx) + Math.abs(dy); if (d < bestD) { bestD = d; best = { x: wrapX(cx + dx), y }; } }
    }
    return best;
  }
  diggerBrain(e) {
    if (e.state === 'seek') {
      for (const c of this.cities) if (!c.found && this.near(e, c.cx, c.cy, c.dr)) {
        c.found = true;
        // к БАЗЕ дорываем магистраль (рейдеры не копают — им нужен ход), к чужим — сразу домой
        if (c === this.cities[0]) { e.state = 'tocity'; e.target = { x: c.cx, y: c.cy }; }
        else { e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; }
        break;
      }
      // разведка завершена (все города найдены) → домой, иначе копатель блуждал бы вечно
      if (e.state === 'seek' && this.cities.every((c) => c.found)) { e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; }
    } else if (e.state === 'tocity') {
      if (this.near(e, e.target.x, e.target.y, RAID_REACH_R)) { e.state = 'return'; e.target = { x: e.homeX, y: e.homeY }; } // магистраль достроена
    } else if (e.state === 'return' && this.near(e, e.homeX, e.homeY, e.homeR)) e.dead = true; // вернулся в гнездо
  }
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
  }
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
  }
  // Разведчик: бежит к разведанной базе по тоннелям копателей (BFS, не копает), высасывает
  // энергию контура и уносит заряд домой. В дебаге без урона (наблюдение).
  raiderBrain(e) {
    const toHome = !!e.carry;
    const gx = toHome ? e.homeX : this.cities[0].cx, gy = toHome ? e.homeY : this.cities[0].cy;
    const gr = toHome ? e.homeR : RAID_REACH_R;
    if (this.near(e, gx, gy, gr)) {                              // у цели
      if (!toHome) { if (!this.debug) this.city.damage(RAID_DRAIN); e.carry = 'charge'; } // высосал контур
      else { const n = this.nestAt(e.homeX, e.homeY); if (n) n.charge++; e.dead = true; } // донёс заряд домой
      return;
    }
    if (e.state2 !== IDLE) return;                               // путь нужен только при выборе следующего хода
    const path = this.airPath(e.tileX, e.tileY, gx, gy, gr);
    e.target = path && path.length > 1 ? { x: path[1].x, y: path[1].y } : { x: gx, y: gy };
  }
  updateEnemies(dt) {
    if (this.cycle.n !== this.lastCycleN) { this.onCycleStart(this.cycle.n); this.lastCycleN = this.cycle.n; }
    for (const e of this.enemies) {
      if (e.type === 'digger') this.diggerBrain(e);
      else if (e.type === 'collector') this.collectorBrain(e);
      else this.raiderBrain(e);
      e.update(dt, this.world);
      if (e.dug) { this.loot.spawn(e.dug.x, e.dug.y, e.dug.type); e.dug = null; } // прокопанная жила падает лутом, не пропадает
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  // Сдача груза на принтере — по ОДНОЙ единице с интервалом (медленно): единица
  // вылетает из юнита вверх (анимация), гекс освобождается.
  deliverCargo() {
    const t = this.inventory.deliverOneBoardCargo();
    if (!t) return;
    this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++;
    this.fx.burst(this.unit.px, this.unit.py, [t]);
    if (this.quest && this.quest.onDeliver(t)) this.completeQuest();   // сдача двигает задание
  }

  // Репутация домашнего (контрактного) города в save двигается ±1; уведомление в HUD.
  questReward(delta) {
    const name = this.cities[0].name;
    this.save.rep[name] = Math.max(0, (this.save.rep[name] || 0) + delta);
    writeSave(this.save);
    return this.save.rep[name];
  }
  completeQuest() {
    const rep = this.questReward(+1);
    this.questMsg = { text: `Задание выполнено! Репутация «${this.cities[0].name}»: ${rep}`, t: QUEST_MSG_TIME, ok: true };
    this.quest = makeQuest(this.cycle.n);
  }
  failQuest() {
    const rep = this.questReward(-1);
    this.questMsg = { text: `Задание провалено. Репутация «${this.cities[0].name}»: ${rep}`, t: QUEST_MSG_TIME, ok: false };
    this.quest = makeQuest(this.cycle.n);
  }

  // База — клетки принтера и пол пещеры вокруг него; там таймер города заряжается.
  atBase() {
    const u = this.unit;
    return u.tileX >= PRINTER.x - 1 && u.tileX <= PRINTER.x + PRINTER.w
        && u.tileY >= PRINTER.y && u.tileY <= CAVE_FLOOR_Y;
  }

  drawScene() {
    const ctx = this.ctx;
    ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, this.designW, this.designH);
    drawWorld(ctx, this.world, this.unit, this.camera, this.debug);
    drawEnemies(ctx, this.enemies, this.camera);
    drawLoot(ctx, this.loot, this.camera);
    if (!this.debug) drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH); // дебаг — без тумана
    drawTachikoma(ctx, this.world, this.unit, this.camera);
    drawFx(ctx, this.fx, this.camera);
    drawCrtOverlay(ctx, this.designW, this.designH);   // виньетка + скан-лайны поверх мира (HUD крупнее)
    drawHUD(ctx, this.world, this.unit, this.inventory, { fps: this.fps, delivered: this.deliveredTotal, radWidget: this.radWidget, cycle: this.cycle, quest: this.quest, questMsg: this.questMsg, rep: this.save.rep[this.cities[0].name] || 0 }, this.designW, this.designH);
    drawCity(ctx, this.city, this.designW);
    if (this.debug) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `13px ${FONT_MONO}`; ctx.fillStyle = '#ffd24a';
      ctx.fillText('DEBUG: камера свободна (WASD), туман выкл, юнит в безопасности — B выкл', this.designW / 2, this.designH - 48);
      // список городов: разведаны ли копателями
      ctx.textAlign = 'right'; ctx.font = `12px ${FONT_MONO}`;
      const rx = this.designW - 14; let ly = 168;   // ниже панели задания (справа под кнопкой «Ядро»)
      ctx.fillStyle = '#ffd24a'; ctx.fillText('ГОРОДА (разведка):', rx, ly); ly += 17;
      for (const c of this.cities) {
        ctx.fillStyle = c.found ? '#7ad05a' : '#e0664a';
        ctx.fillText((c.found ? '✓ ' : '✗ ') + c.name, rx, ly); ly += 15;
      }
      // над дикими гнёздами — накоплено: ресурсы (собиратели) и заряд (разведчики)
      ctx.textAlign = 'center'; ctx.font = `12px ${FONT_MONO}`; ctx.fillStyle = '#ffd24a';
      for (const w of this.world.wilds) {
        const sx = Math.round(this.camera.screenX(w.cx * TILE + TILE / 2)), sy = Math.round(w.cy * TILE - this.camera.y);
        ctx.fillText(`ресурс ${w.loot} · заряд ${w.charge}`, sx, sy - TILE * 2);
      }
      ctx.textAlign = 'left';
    }
  }

  loop(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-6)) * 0.1;

    const ctx = this.ctx;
    // нативный рендер с масштабом design→пиксели (резко на любом DPI/разрешении)
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (this.mode === 'playing' && this.debug) {
      // дебаг-обзор: свободная камера (WASD/стрелки), туман выкл, юнит заморожен и в
      // безопасности; мир ЖИВЁТ (цикл/враги) — чтобы видеть, что происходит на карте.
      if (this.input.pressed('KeyB')) this.debug = false;
      const sp = 16 * TILE * dt;
      if (this.input.left())  this.camera.x = wrapPx(this.camera.x - sp);
      if (this.input.right()) this.camera.x = wrapPx(this.camera.x + sp);
      if (this.input.up())    this.camera.y -= sp;
      if (this.input.down())  this.camera.y += sp;
      this.camera.clampY();
      this.cycle.update(dt);
      this.updateEnemies(dt);
      this.loot.update(dt, this.world, this.unit, this.inventory); // дропы падают и в дебаге (юнит заморожен — подбора нет)
      this.fx.update(dt);
      if (this.input.pressed('Escape')) this.mode = 'paused';
      this.drawScene();
    } else if (this.mode === 'playing') {
      if (this.input.pressed('KeyB')) this.debug = true;
      this.unit.load = this.inventory.boardLoad();   // вес = груз + съёмные модули
      this.unit.update(dt, this.input, this.world);
      if (this.unit.dug) { this.loot.spawn(wrapX(this.unit.dug.x), this.unit.dug.y, this.unit.dug.type); this.unit.dug = null; }
      if (this.loot.update(dt, this.world, this.unit, this.inventory)) this.unit.setStats(this.inventory.getStats());
      this.fx.update(dt);
      this.camera.follow(this.unit, dt);
      this.world.reveal(this.unit.tileX, this.unit.tileY, SCANNER_R);
      const atBase = this.atBase();
      if (atBase && this.inventory.cargoUsed()) {
        this.deliverCd = (this.deliverCd || 0) - dt;
        if (this.deliverCd <= 0) { this.deliverCargo(); this.deliverCd = DELIVER_INTERVAL; }
      } else this.deliverCd = 0;
      this.city.update(dt, atBase);
      this.cycle.update(dt);   // макро-таймер эскалации
      if (this.quest && this.quest.checkDeadline(this.cycle.n)) this.failQuest();   // дедлайн в циклах
      if (this.questMsg) { this.questMsg.t -= dt; if (this.questMsg.t <= 0) this.questMsg = null; }
      this.updateEnemies(dt);  // волны диких гнёзд
      // скверна: локальный фон вытекает в HP вне базы; на базе принтер лечит юнит
      const rad = this.world.radAt(this.unit.px / TILE, this.unit.py / TILE);
      this.unit.hp = Math.max(0, this.unit.hp - Math.max(0, rad - this.unit.stats.radResist) * dt);
      if (atBase) this.unit.hp = Math.min(this.unit.stats.maxHp, this.unit.hp + HEAL_RATE * dt);
      this.radWidget.update(dt, rad, this.unit.stats.radResist);
      const depth = Math.max(0, this.unit.tileY - CAVE_FLOOR_Y);
      if (depth > this.save.bestDepth) { this.save.bestDepth = depth; writeSave(this.save); }
      if (this.unit.hp <= 0) { this.overReason = 'unit'; this.mode = 'gameover'; }
      else if (this.city.dead) { this.overReason = 'city'; this.mode = 'gameover'; }
      else if (this.input.pressed('Escape')) this.mode = 'paused';
      else if (this.input.pressed('KeyI')) this.openInventory(false);
      this.drawScene();
    } else if (this.mode === 'intro') {
      this.intro.update(dt);
      if (this.intro.done || this.input.pressed('Space', 'Enter', 'NumpadEnter')) this.mode = 'playing';
      ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, this.designW, this.designH);
      drawWorld(ctx, this.world, this.unit, this.camera);
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      drawIntro(ctx, this.intro, this.world, this.unit, this.camera, this.designW, this.designH);
    } else if (this.mode === 'gameover') {
      this.drawScene();
      drawGameOver(ctx, this.menuButtons(), this.designW, this.designH, this.overReason, {
        depth: this.unit ? Math.max(0, this.unit.tileY - CAVE_FLOOR_Y) : 0,
        delivered: this.deliveredTotal, byType: this.delivered, best: this.save.bestDepth, cycle: this.cycle.n,
      });
    } else if (this.mode === 'inventory') {
      if (!this.inventory.confirm) {  // пока открыта модалка выхода — хоткеи заблокированы
        if (this.input.pressed('Escape')) {
          if (this.unit) {
            const doExit = () => { this.unit.setStats(this.inventory.getStats()); this.spillShelfCargo(); this.mode = 'playing'; };
            if (this.inventory.needsExitConfirm()) this.inventory.confirm = doExit; else doExit();
          } else this.mode = 'menu';
        }
        if (this.input.pressed('Enter', 'NumpadEnter')) this.onInventoryStart(); // быстрый старт «В шахту»
        if (this.input.pressed('KeyR')) this.inventory.rotateSelected();
      }
      this.inventory.draw(ctx, this.designW, this.designH);
    } else if (this.mode === 'paused') {
      if (this.input.pressed('Escape')) this.mode = 'playing';
      this.drawScene();
      drawPauseMenu(ctx, this.menuButtons(), this.designW, this.designH);
    } else {
      if (this.input.pressed('Enter', 'NumpadEnter', 'Space')) this.openInventory(true);
      drawMainMenu(ctx, this.save, this.menuButtons(), this.designW, this.designH);
    }

    this.input.endFrame();
    requestAnimationFrame(this.loop);
  }
}

window.addEventListener('load', () => { window.game = new Game(document.getElementById('game')); });
