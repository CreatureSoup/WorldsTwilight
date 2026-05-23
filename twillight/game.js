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
    this.last = performance.now();
    this.fps = 60;

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
      if (this.mode === 'inventory') { const { x, y } = pos(e); this.inventory.pointerMove(x, y); }
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
    if (this.mode === 'menu') {
      return [{ id: 'start', label: 'НОВАЯ ИГРА', x, y: H / 2 + 10, w, h, primary: true }];
    }
    if (this.mode === 'paused') {
      const y0 = H / 2 - 60;
      return [
        { id: 'resume',    label: 'Продолжить',     x, y: y0,       w, h },
        { id: 'inventory', label: 'Ядро / сборка',  x, y: y0 + 64,  w, h },
        { id: 'restart',   label: 'Начать заново',  x, y: y0 + 128, w, h },
        { id: 'mainmenu',  label: 'В главное меню', x, y: y0 + 192, w, h },
      ];
    }
    if (this.mode === 'gameover') {
      return [{ id: 'mainmenu', label: 'В главное меню', x, y: H / 2 + 10, w, h, primary: true }];
    }
    return [];
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
    this.inventory.resetCargo();
    this.delivered = { iron: 0, organic: 0, crystal: 0 };
    this.deliveredTotal = 0;
    this.overReason = null;
    this.camera.snap(this.unit);
    this.world.reveal(SPAWN_X, SPAWN_Y, 3.5); // база видна сразу (в т.ч. на интро)
    this.save.runs = (this.save.runs || 0) + 1;
    writeSave(this.save);
  }
  endRun() { this.unit = null; this.world = null; this.city = null; this.loot = null; }

  // Сдача груза на принтере: весь груз из ядра уходит в счётчик сессии, гексы
  // освобождаются; единицы вылетают из юнита вверх (анимация).
  deliverCargo() {
    const types = this.inventory.deliverBoardCargo();
    for (const t of types) { this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++; }
    if (types.length) this.fx.burst(this.unit.px, this.unit.py, types);
  }

  // База — клетки принтера и пол пещеры вокруг него; там таймер города заряжается.
  atBase() {
    const u = this.unit;
    return u.tileX >= PRINTER.x - 1 && u.tileX <= PRINTER.x + PRINTER.w
        && u.tileY >= PRINTER.y && u.tileY <= CAVE_FLOOR_Y;
  }

  drawScene() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, this.designW, this.designH);
    drawWorld(ctx, this.world, this.unit, this.camera);
    drawLoot(ctx, this.loot, this.camera);
    drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
    drawTachikoma(ctx, this.world, this.unit, this.camera);
    drawFx(ctx, this.fx, this.camera);
    drawHUD(ctx, this.world, this.unit, this.inventory, { fps: this.fps, delivered: this.deliveredTotal, radWidget: this.radWidget }, this.designW, this.designH);
    drawCity(ctx, this.city, this.designW);
  }

  loop(now) {
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-6)) * 0.1;

    const ctx = this.ctx;
    // нативный рендер с масштабом design→пиксели (резко на любом DPI/разрешении)
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (this.mode === 'playing') {
      this.unit.load = this.inventory.cargoUsed();
      this.unit.update(dt, this.input, this.world);
      if (this.unit.dug) { this.loot.spawn(wrapX(this.unit.dug.x), this.unit.dug.y, this.unit.dug.type); this.unit.dug = null; }
      if (this.loot.update(dt, this.world, this.unit, this.inventory)) this.unit.setStats(this.inventory.getStats());
      this.fx.update(dt);
      this.camera.follow(this.unit, dt);
      this.world.reveal(this.unit.tileX, this.unit.tileY, SCANNER_R);
      const atBase = this.atBase();
      if (atBase && this.inventory.cargoUsed()) this.deliverCargo();
      this.city.update(dt, atBase);
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
      ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, this.designW, this.designH);
      drawWorld(ctx, this.world, this.unit, this.camera);
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      drawIntro(ctx, this.intro, this.world, this.unit, this.camera, this.designW, this.designH);
    } else if (this.mode === 'gameover') {
      this.drawScene();
      drawGameOver(ctx, this.menuButtons(), this.designW, this.designH, this.overReason);
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
