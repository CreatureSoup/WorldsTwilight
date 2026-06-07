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
    this.upgrades = new Upgrades();
    this.save = loadSave();

    this.mode = 'menu';
    this.world = null;
    this.unit = null;
    this.city = null;
    this.loot = null;
    this.falling = null;
    this.fx = new Fx();
    this.intro = new Intro();
    this.cycle = new Cycle();
    this.enemies = [];         // враги диких гнёзд (волны по циклам)
    this.lastCycleN = 0;
    this.debug = false;        // B — дебаг-обзор карты (свободная камера, без тумана)
    this.debugTentacles = true;  // ноги-щупальца (IK, legik.js) — ПО УМОЛЧАНИЮ; T переключает на FK для сравнения
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
      if (this.mode === 'inventory') { e.preventDefault(); this.inventory.pointerDown(x, y); }
      else if (this.mode === 'upgrades') { e.preventDefault(); this.upgrades.pointerDown(x, y); }
      else if (this.mode === 'menu' || this.mode === 'paused' || this.mode === 'gameover') this.menuClick(x, y);
      // во время забега инвентарь не открывается — сборка модулей только перед стартом
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const p = pos(e); this.menuMouse = p;            // ховер кнопок меню/паузы/гейм-овера
      if (this.mode === 'inventory') this.inventory.pointerMove(p.x, p.y);
      else if (this.mode === 'upgrades') this.upgrades.pointerMove(p.x, p.y);
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (this.mode === 'inventory') { const { x, y } = pos(e); this.inventory.pointerUp(x, y); }
      else if (this.mode === 'upgrades') this.upgrades.pointerUp();
    });
    // окно-уровень: если при быстром драге курсор ушёл с канваса — всё равно
    // завершаем/двигаем перетаскивание (иначе ghost «залипает», дроп теряется).
    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'inventory' && this.inventory.drag) { const { x, y } = pos(e); this.inventory.pointerMove(x, y); }
    });
    window.addEventListener('mouseup', (e) => {
      if (this.mode === 'inventory' && this.inventory.drag) { const { x, y } = pos(e); this.inventory.pointerUp(x, y); }
      else if (this.mode === 'upgrades') this.upgrades.pointerUp();
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (this.mode === 'inventory') { e.preventDefault(); this.inventory.onWheel(e.deltaY * this.coordScale); }
      else if (this.mode === 'upgrades') { e.preventDefault(); this.upgrades.onWheel(e.deltaY * this.coordScale); }
    }, { passive: false });
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
        { id: 'restart',   label: 'Начать заново',  x, y: y0 + 64,  w, h },
        { id: 'mainmenu',  label: 'В главное меню', x, y: y0 + 128, w, h },
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
    if (!this.inventory.getStats().valid) return;
    this.doInventoryStart();
  }
  doInventoryStart() {
    const stats = this.inventory.getStats();
    // Модули во время забега не снимаются: в любой ситуации печать нового тела → интро.
    // (Открытие «Ядра» в паузе допустимо, но даст ту же стартовую сборку — игрок просто посмотрит.)
    this.startSession(stats);
    this.intro.reset();
    this.mode = 'intro';
  }

  startSession(stats) {
    this.world = new World();
    this.unit = new Unit(SPAWN_X, SPAWN_Y, stats);
    this.unit.hull = (this.inventory && this.inventory.hull) || 'scout';   // тип корпуса (scout | core-кольцо)
    this.city = new City();
    this.loot = new Loot();
    this.falling = new FallingRocks();   // нестабильная порода → падающие валуны
    this.fx.clear();
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
    this.inventory.unit = this.unit;   // груз читает эффективную ёмкость из unit.stats (единый источник)
    this.delivered = { iron: 0, organic: 0, crystal: 0 };
    this.deliveredTotal = 0;
    // Апгрейды сессии: набор по модулям + город (определяется на старте). Покупка
    // пересчитывает статы юнита и/или апгрейды города.
    this.upgrades.init(this.inventory.getStats(), this.cities[0].name);
    this.upgrades.onChange = (kind, id) => {
      // ЕДИНЫЙ путь: пересобрали эффективные статы (база сборки + апгрейды) → в unit.stats.
      // Все потребители (движение/бур/сканер/HP/ГРУЗ) читают unit.stats — отдельных кэшей нет.
      this.unit.setStats(this.upgrades.applyToStats());
      this.city.applyUpgrades(this.upgrades.cityTimerBonus(), this.upgrades.cityRingBonuses());
      if (id === 'ping') this.world.reveal(this.unit.tileX, this.unit.tileY, 9);  // орбит-пинг: вскрыть участок
    };
    this.dugTiles = 0;        // проходка за забег: счётчик прокопанных тайлов
    this.eventLog = [];       // лог крупных событий (таймстэмп = цикл сессии) — виджет справа внизу
    this.activeScan = null;   // сервер-хлам, который сейчас сканируется (для прогресс-бара/лучей)
    this._scanDoneT = 0;      // таймер надписи «ДАННЫЕ ИЗВЛЕЧЕНЫ» после выкачки
    this.radLevel = 0;        // сглаженный фон помех (0..1) у полюсов — глитчи интерфейса
    this.overReason = null;
    this.camera.snap(this.unit);
    this.world.reveal(SPAWN_X, SPAWN_Y, 3.5); // база видна сразу (в т.ч. на интро)
    this.save.runs = (this.save.runs || 0) + 1;
    writeSave(this.save);
  }
  endRun() {
    this.unit = null; this.world = null; this.city = null; this.loot = null; this.falling = null;
    // правки сборки между забегами НЕ переносятся: новый забег — стартовая комплектация
    this.inventory.reset();
  }

  // Лог крупных событий: таймстэмп — номер цикла сессии. Виджет показывает последние.
  logEvent(text) {
    const n = (this.cycle && this.cycle.n) || 1;
    this.eventLog.push({ cycle: n, text });
    if (this.eventLog.length > 16) this.eventLog.shift();
  }
  // Сканирование выкопанных серверов: ближайший в радиусе SCAN_RADIUS качает данные (dt/SCAN_TIME);
  // уход прерывает (прогресс сохранён в server.data — вернулся, докачал). По концу — лог-событие.
  updateServers(dt) {
    if (!this.world || !this.unit) return;
    let active = null, best = Infinity;
    for (const s of this.world.servers) {
      if (!s.dug || s.done) continue;
      const dx = wrapDeltaPx(this.unit.px, (s.tx + 0.5) * TILE), dy = this.unit.py - (s.ty + 0.5) * TILE;
      const d = Math.hypot(dx, dy);
      if (d <= SCAN_RADIUS * TILE && d < best) { best = d; active = s; }
    }
    if (active) {
      active.data = Math.min(1, active.data + dt / SCAN_TIME);
      if (active.data >= 1) { active.done = true; this.logEvent('НАЙДЕНЫ НОВЫЕ ДАННЫЕ'); this._scanDoneT = 2.4; active = null; }
    }
    this.activeScan = active;
    if (this._scanDoneT > 0) this._scanDoneT -= dt;
  }

  // AI диких гнёзд (спавн волн + поведение врагов + airPath) вынесен в ai.js —
  // домешан в Game.prototype: onCycleStart/near/nestAt/nearestResource/diggerBrain/
  // collectorBrain/airPath/raiderBrain/updateEnemies. Вызываются из loop/updateEnemies.

  // Сдача груза на принтере — по ОДНОЙ единице с интервалом (медленно): единица
  // вылетает из юнита вверх (анимация), счётчик уменьшается.
  deliverCargo() {
    const t = this.inventory.deliverOneCargo();
    if (!t) return;
    this.delivered[t] = (this.delivered[t] || 0) + 1; this.deliveredTotal++;
    this.upgrades.addBank(t, 1);                                       // та же сдача копит банк апгрейдов
    this.fx.burst(this.unit.px, this.unit.py, [t]);
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
    if (typeof drawServers === 'function') drawServers(ctx, this.world, this.camera, this.debug);   // серверы/хлам (туман приглушит невидимые; в дебаге — все)
    drawEnemies(ctx, this.enemies, this.camera);
    drawLoot(ctx, this.loot, this.camera);
    if (!this.debug) {
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      drawHeadlight(ctx, this.world, this.unit, this.camera, this.designW, this.designH);   // прожектор-конус у бура (тьма вокруг), с тенями от породы
    }
    if (typeof drawFalling === 'function' && this.falling) drawFalling(ctx, this.falling, this.camera);   // летящие валуны — ПОВЕРХ тумана (опасность всегда видна)
    if (typeof partsHull === 'function' && this.unit) partsHull(this.unit.hull);   // спрайты по типу корпуса (ноги+кольцо+детали)
    const tOff = this.debugTentacles ? tentacleBodyOffset() : null;   // корпус едет на щупальцах
    const ringDef = this.unit && typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[this.unit.hull];
    const isRing = !!(ringDef && ringDef.kind === 'ring');
    if (isRing) {
      // КОЛЬЦО: ноги (щупальца) рисуются ПОД кольцом/модулями (клип по видимому воздуху → не «вылезает»),
      // затем кластер кольца+модулей ПОВЕРХ. Кластер вращается к направлению бурения, ноги — нет.
      if (this.debugTentacles && this.unit) { ctx.save(); clipVisibleAir(ctx, this.world, this.camera); drawTentacles(ctx, this.camera); ctx.restore(); }
      drawRingUnit(ctx, this.world, this.unit, this.camera, { scale: unitDrawScale(this.unit), dx: tOff ? tOff.x : 0, dy: tOff ? tOff.y : 0 });
    } else {
      drawTachikoma(ctx, this.world, this.unit, this.camera, { scale: unitDrawScale(this.unit), hideLegs: this.debugTentacles, dx: tOff ? tOff.x : 0, dy: tOff ? tOff.y : 0 });
      if (this.debugTentacles && this.unit) {              // щупальца — ЗА породой (клип по видимому воздуху): юнит не «вылезает»
        ctx.save(); clipVisibleAir(ctx, this.world, this.camera); drawTentacles(ctx, this.camera); ctx.restore();
      }
    }
    if (typeof drawScanFx === 'function' && !this.debug) drawScanFx(ctx, this, this.camera);   // лучи сканера к серверу-хламу (поверх юнита)
    drawFx(ctx, this.fx, this.camera);
    drawCrtOverlay(ctx, this.designW, this.designH);   // виньетка + скан-лайны поверх мира (HUD крупнее)
    drawHUD(ctx, this.world, this.unit, this.inventory, { fps: this.fps, delivered: this.deliveredTotal, cycle: this.cycle, scan: this.activeScan, scanDoneT: this._scanDoneT, log: this.eventLog }, this.designW, this.designH);
    drawCity(ctx, this.city, this.designW);
    if (this.debug) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = `13px ${FONT_MONO}`; ctx.fillStyle = '#ffd24a';
      ctx.fillText('DEBUG: камера свободна (WASD), туман выкл, юнит в безопасности — B выкл · R +10 ресурсов', this.designW / 2, this.designH - 48);
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
      // очаги радиации: центр + кольцо радиуса влияния (только дебаг)
      for (const s of this.world.radSources) {
        const sx = this.camera.screenX(s.x * TILE + TILE / 2), sy = s.y * TILE + TILE / 2 - this.camera.y;
        ctx.strokeStyle = 'rgba(140,226,90,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sx, sy, s.r * TILE, 0, 6.283); ctx.stroke();
        ctx.fillStyle = '#c8e25a'; ctx.beginPath(); ctx.arc(sx, sy, 5, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#c8e25a'; ctx.fillText('☢', sx, sy - 10);
      }
      ctx.textAlign = 'left';
    }
    // помехи интерфейса от радиационного фона у полюсов (поверх всего; только в игре)
    if (this.mode === 'playing' && !this.debug) drawInterference(ctx, this.canvas, this.radLevel, performance.now() / 1000);
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
      if (this.input.pressed('KeyR')) { for (const k of ['iron', 'organic', 'crystal']) this.upgrades.addBank(k, 10); }  // дебаг: +10 каждого ресурса в банк
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
      if (this.input.pressed('KeyT')) this.debugTentacles = !this.debugTentacles;   // прототип щупалец
      this.unit.update(dt, this.input, this.world);
      if (this.debugTentacles) updateTentacles(dt, this.unit, this.world);
      if (typeof updateRingAim === 'function' && UNIT_DEFS[this.unit.hull] && UNIT_DEFS[this.unit.hull].kind === 'ring') updateRingAim(dt, this.unit);   // доворот кластера кольца к направлению бурения
      if (this.unit.dug) { this.loot.spawn(wrapX(this.unit.dug.x), this.unit.dug.y, this.unit.dug.type); this.unit.dug = null; }
      if (this.unit.broke) { this.dugTiles++; this.unit.broke = false; }   // проходка: считаем прокопанные тайлы
      this.updateServers(dt);   // авто-скан выкопанных серверов → данные + лог
      this.falling.update(dt, this.world, this.unit);   // нестабильная порода: срыв валунов + урон

      // фон помех (сглажен): полюса + очаги радиации у базы — интерфейс глючит
      this.radLevel += (this.world.radAt(this.unit.tileX, this.unit.tileY) - this.radLevel) * Math.min(1, dt * 2.5);
      this.loot.update(dt, this.world, this.unit, this.inventory, this.upgrades.pickupBonus());
      this.fx.update(dt);
      this.camera.follow(this.unit, dt);
      this.world.reveal(this.unit.tileX, this.unit.tileY, this.unit.stats.scanR || SCANNER_R);
      const atBase = this.atBase();
      if (atBase && this.inventory.cargoUsed()) {
        this.deliverCd = (this.deliverCd || 0) - dt;
        if (this.deliverCd <= 0) { this.deliverCargo(); this.deliverCd = DELIVER_INTERVAL; }
      } else this.deliverCd = 0;
      // гаджет «Ремонт-дрон»: реген HP вне базы
      if (!atBase && this.upgrades.gadgets.repair) this.unit.hp = Math.min(this.unit.stats.maxHp, this.unit.hp + REPAIR_RATE * dt);
      this.city.update(dt, atBase);
      this.cycle.update(dt);   // макро-таймер эскалации
      this.updateEnemies(dt);  // волны диких гнёзд
      if (this.dugTiles > (this.save.bestDug || 0)) { this.save.bestDug = this.dugTiles; writeSave(this.save); }
      if (this.unit.hp <= 0) { this.overReason = 'unit'; this.mode = 'gameover'; }
      else if (this.city.dead) { this.overReason = 'city'; this.mode = 'gameover'; }
      else if (this.input.pressed('Escape')) this.mode = 'paused';
      else if (this.input.pressed('Space') && atBase) { this.upgrades.sel = 0; this.upgrades.scrollY = 0; this.mode = 'upgrades'; }   // спец-действие на базе
      this.drawScene();
    } else if (this.mode === 'upgrades') {
      if (this.input.pressed('Escape')) { this.upgrades.endHold(); this.mode = 'playing'; }
      else {
        if (this.input.pressed('KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft')) this.upgrades.moveSel(-1);
        else if (this.input.pressed('KeyS', 'ArrowDown', 'KeyD', 'ArrowRight')) this.upgrades.moveSel(1);
        // покупка — УДЕРЖАНИЕ пробела (свежее нажатие стартует, отпускание отменяет)
        if (this.input.pressed('Space', 'Enter', 'NumpadEnter')) { const tr = this.upgrades.selTrack(); this.upgrades.beginHold(tr && tr.id, 'key'); }
        const buyHeld = this.input.keys.has('Space') || this.input.keys.has('Enter') || this.input.keys.has('NumpadEnter');
        if (this.upgrades.holdSrc === 'key' && !buyHeld) this.upgrades.endHold();
        this.upgrades.tickHold(dt);
      }
      this.city.update(dt, this.atBase());   // город продолжает заряжаться, пока открыто меню
      this.drawScene();
      this.upgrades.draw(ctx, this.designW, this.designH);
    } else if (this.mode === 'intro') {
      this.intro.update(dt);
      // реактор ВКЛ только ПОСЛЕ установки (фаза печати/влёта → выкл, drawRingUnit рисует reactor:off)
      if (this.unit) this.unit.reactorOn = this.intro.t >= (INTRO_PRINT + INTRO_REACTOR);
      if (this.debugTentacles && this.unit) updateTentacles(dt, this.unit, this.world);   // живые ноги-щупальца в интро
      if (this.intro.done || this.input.pressed('Space', 'Enter', 'NumpadEnter')) { if (this.unit) this.unit.reactorOn = true; this.mode = 'playing'; }
      ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, this.designW, this.designH);
      drawWorld(ctx, this.world, this.unit, this.camera);
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      drawIntro(ctx, this.intro, this.world, this.unit, this.camera, this.designW, this.designH);
    } else if (this.mode === 'gameover') {
      // ENTER уводит в меню; рисуем сцену ТОЛЬКО если ещё в gameover — после
      // endRun world/unit/city уже null и drawScene → drawWorld(null) бы крашился
      // (канвас застрял бы с тёмным фоном — «чёрный экран»).
      if (this.input.pressed('Enter', 'NumpadEnter')) { this.endRun(); this.mode = 'menu'; }
      else {
        this.drawScene();
        drawGameOver(ctx, this.menuButtons(), this.designW, this.designH, this.overReason, {
          dug: this.dugTiles, delivered: this.deliveredTotal, byType: this.delivered, best: this.save.bestDug || 0, cycle: this.cycle.n,
        });
      }
    } else if (this.mode === 'inventory') {
      if (this.input.pressed('Escape')) this.mode = this.unit ? 'playing' : 'menu';
      if (this.input.pressed('Enter', 'NumpadEnter')) this.onInventoryStart(); // быстрый старт «В шахту»
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

// Старт игры. Зовётся загрузчиком (index.html) ПОСЛЕ выполнения всех модулей (порядок async=false),
// плюс фолбэк на window.load. Флаг (а НЕ `!window.game`) для идемпотентности: `window.game`
// уже занят браузером — это элемент <canvas id="game"> (именованный глобал), `!window.game` ложен.
window.bootGame = function () { if (window._gameBooted) return; window._gameBooted = true; window.game = new Game(document.getElementById('game')); };
if (document.readyState === 'complete') window.bootGame(); else window.addEventListener('load', window.bootGame);
