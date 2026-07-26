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
    this.inventory.onBack = () => { this.mode = this.unit ? 'playing' : 'menu'; };   // как ESC
    this.upgrades = new Upgrades();
    this.save = loadSave();
    if (typeof metaBindSave === 'function') metaBindSave(this.save);   // metaHas(id) для эффектов узлов в забеге
    if (typeof codexBindSave === 'function') codexBindSave(this.save);  // персист кодекса (диски/глоссарий) в save.codex
    this.inventory.bindSave(this.save);   // восстановить ПОСЛЕДНЮЮ сборку (по умолчанию — как в прошлом забеге)

    this.mode = 'menu';
    this.menuSel = 0;        // выбранная кнопка меню (WASD/стрелки + мышь); Space/Enter — нажать
    this._modePrev = null;   // смена режима → сброс menuSel
    this.world = null;
    this.unit = null;
    this.city = null;
    this.loot = null;
    this.falling = null;
    this.fx = new Fx();
    this.dust = new Dust();
    this.navPath = null; this._navPathT = 0; this._navPathFrom = -1;   // кэш РЕАЛЬНОГО пути навигации (A*, nav.js)
    this.firewall = new Firewall();   // оборона базы от взломщиков диких (firewall.js)
    this.shots = new Projectiles();   // выстрелы врагов (снайпер) — projectiles.js
    this.structures = new Structures();   // печатаемые игроком сооружения (structures.js)
    this.intro = new Intro();
    this.cycle = new Cycle();
    this.enemies = [];         // враги диких гнёзд (волны по циклам)
    this.lastCycleN = 0;
    this.storyMode = false;    // режим истории (save.storyMode): дикий город отключён; снимок берётся в startSession
    this.debug = false;        // B — дебаг-обзор карты (свободная камера, без тумана)
    this.alertView = true;     // ОБНАРУЖЕНИЕ УГРОЗ (узел меты mast_sa): голо-маркеры врагов/нестабильностей; тумблер V / клик по HUD
    this.navView = true;       // НАВИГАЦИЯ ДО ГОРОДА (узел amb_nav): показ пути; тумблер N / клик по HUD
    this.beaconView = true;    // МАЯЧОК ГОРОДА (узел amb_beacon): стрелка-указатель к базе; тумблер G / клик по HUD
    this.debugTentacles = true;  // ноги-щупальца (IK, legik.js) — ПО УМОЛЧАНИЮ; T переключает на FK для сравнения
    this.last = performance.now();
    this.fps = 60;

    // предзагрузка шрифтов дизайн-системы, чтобы canvas не мигал фолбэком
    if (document.fonts) [`700 16px ${FONT_DISPLAY}`, `500 13px ${FONT_MONO}`, `400 15px ${FONT_BODY}`].forEach((f) => document.fonts.load(f));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();

    this.loop = this.loop.bind(this);
    // ЭНЕРГОСБЕРЕЖЕНИЕ: rAF браузер тормозит ТОЛЬКО для скрытой вкладки; «видимо, но окно НЕ в фокусе»
    // (другое приложение сверху) он гонит на полной частоте → GPU грелся «в фоне». Скрытую вкладку
    // ставим на ПОЛНУЮ паузу (без rAF), расфокус — роняем до BG_FPS. `_rafPending` — один кадр в полёте.
    this._hidden = !!document.hidden;
    this._focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
    this._rafPending = false;
    document.addEventListener('visibilitychange', () => { this._hidden = !!document.hidden; this._syncIdle(); if (!this._hidden) { this.last = performance.now(); this._schedule(); } });
    window.addEventListener('focus', () => { this._focused = true; this._syncIdle(); this._schedule(); });
    window.addEventListener('blur', () => { this._focused = false; this._syncIdle(); });   // не в фокусе — кадры реже (FPS-кэп в loop)
    this._syncIdle();
    this._schedule();
  }

  _schedule() { if (!this._rafPending && !this._hidden) { this._rafPending = true; requestAnimationFrame(this.loop); } }
  // DOM-оверлеи мета/кодекса живут на бесконечных CSS-анимациях — их компоновщик GPU НЕ тормозит при
  // «окно видимо, но не в фокусе» (в отличие от rAF). Класс на <html> даёт им animation-play-state:paused
  // (правила в meta_dom.css/codex_dom.css). Скрытую вкладку браузер и так паузит, но ставим для надёжности.
  _syncIdle() { document.documentElement.classList.toggle('bg-idle', this._hidden || !this._focused); }

  resize() {
    // Рендерим в НАТИВНОМ разрешении (резко, без апскейла), а зум/раскладку держим
    // в фиксированном «design»-пространстве: ровно VIEW_TILES_Y тайлов по вертикали
    // на любом экране. this.scale переводит design-юниты в нативные пиксели.
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);   // потолок DPR: на retina (dpr=2) бэкстор канваса вдвое меньше → меньше нагрузки GPU
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
      else if (this.mode === 'artifact') this.artifactClick(x, y);
      else if (this.mode === 'playing' && !this.debug) {   // ЛКМ: подтвердить размещение печати / панель печати / HUD-тумблеры (УГРОЗЫ / ПУТЬ)
        if (typeof HudLayout !== 'undefined' && HudLayout.dockClick(x, y)) {}   // язычок сворачивания левого виджета (проверяем ПЕРВЫМ — левее тела виджета)
        else if (this.sandbox && this.sandboxSpawnClick && this.sandboxSpawnClick(x, y)) {}   // ПОЛИГОН: кнопка спавна врага (справа)
        else if (this.actionBarClick(x, y)) {}   // кнопка активного действия (низ-центр) → инжект хоткея
        else if (this.printMode === 'place') this.printConfirm();
        else if (this._econClick(x, y)) {}   // чипы экономики города (конвертер/электростанция)
        else if (!this.printClick(x, y) && !this.radarSwitchClick(x, y) && !this.alertClick(x, y) && !this.beaconClick(x, y)) this.navClick(x, y);
      }
      // во время забега инвентарь не открывается — сборка модулей только перед стартом
    });
    this.canvas.addEventListener('mousemove', (e) => {
      const p = pos(e); this.menuMouse = p;            // мышь двигает тот же курсор выбора, что и WASD
      if (this.mode === 'menu' || this.mode === 'paused' || this.mode === 'gameover') {
        const bs = this.menuButtons();
        for (let i = 0; i < bs.length; i++) { const b = bs[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { this.menuSel = i; break; } }
      }
      if (this.mode === 'inventory') this.inventory.pointerMove(p.x, p.y);
      else if (this.mode === 'upgrades') this.upgrades.pointerMove(p.x, p.y);
    });
    this.canvas.addEventListener('mouseup', (e) => {
      this.actionBarRelease();   // отпустили кнопку активного действия → снять удержание хоткея
      if (this.mode === 'inventory') { const { x, y } = pos(e); this.inventory.pointerUp(x, y); }
      else if (this.mode === 'upgrades') this.upgrades.pointerUp();
    });
    // окно-уровень: если при быстром драге курсор ушёл с канваса — всё равно
    // завершаем/двигаем перетаскивание (иначе ghost «залипает», дроп теряется).
    window.addEventListener('mousemove', (e) => {
      if (this.mode === 'inventory' && this.inventory.drag) { const { x, y } = pos(e); this.inventory.pointerMove(x, y); }
    });
    window.addEventListener('mouseup', (e) => {
      this.actionBarRelease();   // мышь отпущена даже вне канваса → снять удержание
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
      // вертикальный список (menuLine) внизу-справа — не перекрывает заголовок/сюжет/директивы
      const lw = 340, lx = W - 48 - lw, bh = 46, mt = (this.save && this.save.meta) || 0;
      bs = [
        // режим истории (глушит дикий город, см. updateEnemies) — тумблер ВНУТРИ кнопки забега: правая
        // зона `storyRect` переключает, левая (бо́льшая) запускает забег. `storyRect` — единый источник
        // геометрии для рендера (drawStartStoryToggle) и хит-теста (menuClick).
        { id: 'start', label: STR.menu.buttons.start, desc: 'seed · random', x: lx, y: H - 186, w: lw, h: bh, primary: true, story: true, storyRect: { x: lx + lw - 150, y: H - 186, w: 150, h: bh } },
        { id: 'progress', label: STR.menu.buttons.progress, desc: STR.menu.buttons.progressDesc(mt), x: lx, y: H - 132, w: lw, h: bh },
        { id: 'database', label: STR.menu.buttons.database, desc: STR.menu.buttons.databaseDesc, x: lx, y: H - 78, w: lw, h: bh },
      ];
    } else if (this.mode === 'paused') {
      const y0 = H / 2 - 60;
      bs = [
        { id: 'resume',    label: STR.menu.buttons.resume,   x, y: y0,       w, h },
        { id: 'restart',   label: STR.menu.buttons.restart,  x, y: y0 + 64,  w, h },
        { id: 'mainmenu',  label: STR.menu.buttons.mainmenu, x, y: y0 + 128, w, h },
      ];
    } else if (this.mode === 'gameover') {
      const bw = 220, bh = 42;
      bs = [{ id: 'mainmenu', label: STR.menu.buttons.toMenu, x: W - 48 - bw, y: H - 56, w: bw, h: bh, primary: true }];
    }
    // подсветка = выбранная кнопка (общий курсор для мыши и WASD/стрелок)
    this.menuSel = Math.max(0, Math.min(bs.length - 1, this.menuSel));
    bs.forEach((b, i) => { b.hover = i === this.menuSel; });
    return bs;
  }

  // навигация по меню с клавиатуры: WASD/стрелки — выбор, Space/Enter — нажать
  menuNav() {
    if (this.mode === 'menu' && this.input.pressed('KeyT') && this.startSandbox) { this.startSandbox('objects'); return; }   // ТЕСТОВЫЙ ПОЛИГОН (sandbox.js)
    const bs = this.menuButtons();
    if (!bs.length) return;
    if (this.input.pressed('KeyW', 'ArrowUp', 'KeyA', 'ArrowLeft')) this.menuSel = (this.menuSel - 1 + bs.length) % bs.length;
    else if (this.input.pressed('KeyS', 'ArrowDown', 'KeyD', 'ArrowRight')) this.menuSel = (this.menuSel + 1) % bs.length;
    if (this.input.pressed('Space', 'Enter', 'NumpadEnter')) { const b = bs[Math.min(this.menuSel, bs.length - 1)]; if (b) this.doMenuAction(b.id); }
  }

  menuClick(x, y) {
    for (const b of this.menuButtons()) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        const r = b.storyRect;   // правая зона кнопки забега = тумблер истории: клик по ней ПЕРЕКЛЮЧАЕТ, а НЕ запускает
        if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.doMenuAction('storymode'); return; }
        this.doMenuAction(b.id); return;
      }
    }
  }
  doMenuAction(id) {
    if (id === 'start') this.openInventory(true);
    else if (id === 'progress') { this.mode = 'progress'; if (typeof metaDomShow === 'function') metaDomShow(this); }   // экран — DOM-оверлей (meta_dom.js)
    else if (id === 'database') { this.mode = 'database'; if (typeof codexDomShow === 'function') codexDomShow(this); }  // экран — DOM-оверлей (codex_dom.js)
    else if (id === 'resume') this.mode = 'playing';
    else if (id === 'inventory') this.openInventory(false);
    else if (id === 'restart') { this.endRun(); this.openInventory(true); }
    else if (id === 'mainmenu') { this.endRun(); this.mode = 'menu'; }
    else if (id === 'storymode') { this.save.storyMode = !this.save.storyMode; writeSave(this.save); }   // тумблер режима истории (персист)
  }

  openInventory(preGame) { this.inventory.preGame = preGame; this.mode = 'inventory'; }

  onInventoryStart() {
    if (!this.inventory.getStats().valid) return;
    this.doInventoryStart();
  }
  doInventoryStart() {
    this.inventory.saveBuild();   // запомнить сборку этого забега → дефолт следующего
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
    this.unit.modules = Object.assign({}, this.inventory && this.inventory.modules);   // слот→модуль: спрайт конкретного варианта на корпусе
    this.city = new City();
    this.firewall.reset();   // новый забег — файрволл базы чист
    this.shots.clear();
    this.structures.clear();   // новый забег — печатных структур нет
    this.couriers = [];        // новый забег — курьер-дронов в полёте нет (vault_courier)
    this.drones = [];          // дрон-компаньоны (реликты дрон-слота, до кап-слота) — пересоздаются _syncDrone из _applyArtifacts
    if (this._cityTurretsInit) this._cityTurretsInit();   // ТУРЕЛИ ГОРОДА (узлы amb_turret*): расставляются по кол-ву узлов (cityturret.js)
    this.blightBeacons = [];   // новый забег — маяков скверны нет (скверносей расставляет в забеге)
    this.acidClouds = []; this.seismicWaves = [];   // ловушки: активные эффекты (кислотные облака / сейсмо-волны) — чисто на старте
    this.scanJamT = 0;   // дебафф глушилки сканера (останок-робот) — чисто на старте (паутина/прыгун на unit, сбрасываются с новым телом)
    this._fxUnitHp = null; this.shakeT = 0; this.shakeMag = 0;   // удар-фидбэк: сброс детектора урона/тряски
    this.printSel = null; this.printMode = null; this.printStruct = null; this.printGhost = null; this.printFace = 0;   // печать: чистое состояние
    this.imp = { charge: 0, cd: 0, dir: [1, 0], held: false, wave: null };   // импульсный бур: чистое состояние
    this.borers = [];   // винтовой бур: автономные щиты (пусто на старте)
    this._scanInit();   // радар/эхо-сканеры (варианты слота сканер): развёртка, блипы, кулдаун эхо
    this._hackInit();   // взлом города (модуль взлома, доп-слот): канал взлома спящих каверн
    this.awakenedCaverns = [];   // взломанные (разбуженные) города этого забега
    this._winTimer = null; this._winCut = null;   // победа через взлом: большой таймер перехвата → кат-сцена (kart_hackcity)
    this._lifeUsed = false;   // print_life: резервное тело ещё не использовано
    if (this._cableInit) this._cableInit();   // print_cable: трейлинг-кабель чист на старте забега
    this.pendingArtifact = null; this.artifactSel = 0; this._artChoose = null;   // артефакты: модалка/выбор/анимация
    this.artifactSlots = { city: [], unit: [], drone: [] };   // установленные техно по слотам (ЗАЛОЧЕНО на забег); сброс на старте
    this.artifactRerolls = 0;   // «повторный анализ» реликта (узел kart_reroll): израсходовано за забег; лимит artifactRerollMax()
    this.hoardCargo = false;   // тумблер ГРУЗ: по умолчанию отдаём ресурс городу
    this.loot = new Loot();
    this.falling = new FallingRocks();   // нестабильная порода → падающие валуны
    if (typeof Visions === 'function') this.visions = new Visions();   // призрачные видения в темноте
    if (typeof Hints === 'function') this.hints = new Hints();         // крупные сюжетные подсказки
    if (typeof RadarCompass === 'function') this.radar = new RadarCompass();   // детектор загрязнения (свойство сканера, узел mast_sr)
    this._depthFired = new Set();                                      // какие отсечки высоты уже показаны
    this._discDone = false; this._discT = 0;                           // состояние опроса находок (сброс на забег)
    this.fx.clear(); this.dust.clear();
    this.cycle.reset();
    if (this._econReset) this._econReset();   // ЭКОНОМИКА ГОРОДА (реликты синтез/конвертер/электростанция): сброс состояния забега (economy.js) — после cycle.reset (детект смены цикла с n=1)
    this._epochBase = Math.floor(this.save.epoch || EPOCH_START);   // забег стартует с ТЕКУЩЕГО глобального цикла (первый цикл = эпоха, не 1)
    this.enemies = [];
    this.lastCycleN = 0;
    this.storyMode = !!(this.save && this.save.storyMode);   // забег фиксирует режим истории на старте: дикий город не действует

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
      this._applyArtifacts();   // АРТЕФАКТЫ: пересборка статов апгрейдом стирает флаги — возвращаем их поверх (jets/lootMagnet/combatDrill/щит)
      this.city.applyUpgrades(this.upgrades.cityTimerBonus(), this.upgrades.cityRingBonuses(), this.upgrades.cityRepairLevel(), this.upgrades.cityRecharge(), (typeof metaHas === 'function' && metaHas('amb_recon')));
      if (id === 'ping') this.world.reveal(this.unit.tileX, this.unit.tileY, 9);  // орбит-пинг: вскрыть участок
    };
    if (typeof metaHas === 'function' && metaHas('print_hub'))   // print_hub «Контракт снабжения»: город копит ресурс между забегами → стартовый банк
      for (const k in PRINT_HUB_BANK) this.upgrades.addBank(k, PRINT_HUB_BANK[k]);
    this.dugTiles = 0;        // проходка за забег: счётчик прокопанных тайлов
    this.eventLog = [];       // лог крупных событий (таймстэмп = цикл сессии) — виджет справа внизу
    this.activeScan = null;   // сервер-хлам, который сейчас сканируется (для прогресс-бара/лучей)
    this.scanEnemy = null;    // вражеский юнит, который сейчас сканируется (данные кодекса)
    this._scanDoneT = 0; this._scanMsg = null;   // таймер+текст HUD-надписи после скана («ДАННЫЕ ИЗВЛЕЧЕНЫ» / «ОБЪЕКТ ОПОЗНАН»)
    this.dataCount = 0;       // извлечено серверов данных за забег (вход в мета-пересчёт)
    this.directivesDone = 0;  // выполнено директив за забег (задел: система директив ещё впереди)
    this.metaResult = null;   // результат мета-пересчёта (считается один раз на gameover)
    this.overT = 0;           // таймер финального экрана — для анимации счётчиков
    this.radLevel = 0;        // сглаженный фон помех (0..1) у полюсов — глитчи интерфейса
    this.overReason = null;
    this._threatCleared = false;   // директива «устрани угрозу»: все дикие гнёзда подавлены (wildcity.js)
    this.camera.snap(this.unit);
    this.world.reveal(SPAWN_X, SPAWN_Y, 3.5); // база видна сразу (в т.ч. на интро)
    this.save.runs = (this.save.runs || 0) + 1;
    writeSave(this.save);
  }
  endRun() {
    if (this.sandbox && this.exitSandbox) this.exitSandbox();   // ТЕСТОВЫЙ ПОЛИГОН: снять флаг + восстановить сейв из снимка (in-memory дрейф runs откатывается; диск не трогался)
    if (this._epochBase) { this.save.epoch = this._epochBase + (this.cycle.n - 1) + this.cycle.frac(); this._epochBase = 0; writeSave(this.save); }   // глобальный цикл += прожитые забегом циклы → меню продолжит тикать отсюда
    this.unit = null; this.world = null; this.city = null; this.loot = null; this.falling = null;
    this.navPath = null;
    this.metaResult = null;
    // правки сборки между забегами НЕ переносятся: новый забег — стартовая комплектация
    this.inventory.reset();
  }

  // Пересчёт метрик забега в МЕТА-ТОКЕНЫ (коэффициенты META_COEF). Результат — строки для
  // анимированного экрана (значение × коэф = токены) + итог. Считается один раз на gameover.
  computeMeta() {
    const resMined = this.deliveredTotal + (this.inventory && this.inventory.cargoUsed ? this.inventory.cargoUsed() : 0);
    const has = (id) => typeof metaHas === 'function' && metaHas(id);
    // ЦИКЛЫ и ДАННЫЕ по умолчанию НЕ начисляются — их возвращают узлы красной ветки «Хроника» / «Усвоение данных».
    const rows = [
      { label: STR.gameover.rows.dug,      accent: 'gold',   value: this.dugTiles,       coef: META_COEF.dug },
      { label: STR.gameover.rows.resource, accent: 'amber',  value: resMined,            coef: META_COEF.resource },
    ];
    if (has('print_mtdata')) rows.push({ label: STR.gameover.rows.data, accent: 'cobalt', value: this.dataCount,        coef: META_COEF.data });    // print_mtdata: усвоение данных
    if (has('print_mtcyc'))  rows.push({ label: STR.gameover.rows.cycle,  accent: 'crystal', value: this.cycle ? this.cycle.n : 0, coef: META_COEF.cycle }); // print_mtcyc: хроника прожитого
    rows.push({ label: STR.gameover.rows.directive, accent: 'toxic', value: this.directivesDone, coef: META_COEF.directive });
    if (this.overReason === 'hack_win') rows.push({ label: STR.gameover.rows.winBonus, accent: 'toxic', value: 1, coef: META_WIN_BONUS });   // бонус за победу (перехват реактора)
    else if (this.overReason === 'threat_win') rows.push({ label: STR.gameover.rows.threatBonus, accent: 'toxic', value: 1, coef: META_WIN_BONUS });   // бонус за победу (угроза устранена)
    let total = 0;
    for (const r of rows) { r.tokens = Math.round(r.value * r.coef); total += r.tokens; }
    // print_mtmod: расширённый контекст усваивает больше памяти — множитель НА ИТОГ (строка-бонус, чтобы было видно на экране)
    if (has('print_mtmod') && total > 0) {
      const r = { label: STR.gameover.rows.contextMult, accent: 'blood', value: total, coef: +(PRINT_MT_MULT - 1).toFixed(2) };
      r.tokens = Math.round(r.value * r.coef); rows.push(r); total += r.tokens;
    }
    return { rows, total };
  }

  // Лог крупных событий: таймстэмп — номер цикла сессии. Виджет показывает последние.
  logEvent(text) {
    const n = (typeof this.cycleLabel === 'function' && this.cycle) ? this.cycleLabel() : ((this.cycle && this.cycle.n) || 1);
    this.eventLog.push({ cycle: n, text });
    if (this.eventLog.length > 16) this.eventLog.shift();
  }
  // ПРОГНОЗ ВОЛН (узел amb_predict): «заголовок» волны цикла nextN — высший по опасности доступный тип (`WAVE_TIERS`
  // упорядочен по возрастанию); isNew=true, если тип ВПЕРВЫЕ появляется этим циклом (эскалация). null до первой волны.
  _waveHeadline(nextN) {
    const avail = WAVE_TIERS.filter((t) => nextN >= WAVE_CYCLE[t]);
    if (!avail.length) return null;
    const fresh = avail.filter((t) => WAVE_CYCLE[t] === nextN);
    const list = fresh.length ? fresh : avail;
    return { type: list[list.length - 1], isNew: fresh.length > 0 };
  }
  // ОТОБРАЖАЕМЫЙ номер цикла = глобальная эпоха забега (`_epochBase`, снимок save.epoch на старте) + прожитые циклы.
  // Эскалация волн по-прежнему берёт session-relative `cycle.n` (1,2,3…) — глобальный номер чисто косметический.
  cycleLabel() { return (this._epochBase ? this._epochBase + this.cycle.n - 1 : this.cycle.n); }
  // Тик глобального цикла в МЕНЮ (1 цикл / CYCLE_TIME реального времени). Персист — только при смене целой части (редко).
  _tickEpoch(dt) {
    if (typeof CYCLE_TIME === 'undefined') return;
    const before = Math.floor(this.save.epoch || EPOCH_START);
    this.save.epoch = (this.save.epoch || EPOCH_START) + dt / CYCLE_TIME;
    if (Math.floor(this.save.epoch) !== before) writeSave(this.save);
  }

  // ИЗВЛЕЧЕНИЕ ДАННЫХ → КОДЕКС вынесено в datascan.js — домешано в Game.prototype (ПОСЛЕ game):
  // _scanT/_dataGain · updateServers · updateEnemyScan · _codexAnchor · discover · _idKnown/_idMark ·
  // checkDiscoveries · updateBackdrops/_backdropDone. Вызовы — из loop (updateServers/EnemyScan/Discoveries/Backdrops).

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

  // print_life «Резервное тело»: ОДИН раз за забег смерть не заканчивает забег — тело печатается заново у базы (HP полный).
  // Прогресс забега цел, но НЕСОМЫЙ ГРУЗ ломается и рассыпается лутом на месте гибели (цена второго шанса).
  _reprintBody() {
    this._lifeUsed = true;
    const u = this.unit, c = this.inventory.cargoCounts();
    for (const k in c) for (let i = 0; i < c[k]; i++) this.loot.spawn(wrapX(u.tileX + Math.round((Math.random() - 0.5) * 3)), u.tileY, k);
    if (this.fx) this.fx.burst(u.px, u.py, Object.keys(c).filter((k) => c[k] > 0));   // вспышка распада тела на месте гибели
    this.inventory.resetCargo();
    u.respawn(SPAWN_X, SPAWN_Y);
    if (this._cableInit) this._cableInit();   // тело перепечатано у базы (телепорт) → шлейф смотать заново
    this.imp = { charge: 0, cd: 0, dir: [1, 0], held: false, wave: null };   // сбросить заряд импульса (тело было залочено/копило)
    this._lastHpFloor = Math.floor(u.hp);   // не плодить «+» лечения от скачка HP при печати
    this.camera.snap(u);
    if (this.fx) this.fx.burst(u.px, u.py, ['crystal']);   // вспышка печати у базы
    this.logEvent(STR.log.reserveBody);
  }

  // НАВИГАЦИЯ ДО ГОРОДА (узел amb_nav) вынесена в nav_run.js — домешана в Game.prototype (ПОСЛЕ game):
  // _navTarget/_navStraightDist/_navReturnTime/_navActive/_updateNavPath/_drawNavPath/navClick. A*-движок — nav.js.
  // Вызовы — из loop (_updateNavPath, клавиша N) и drawScene (_drawNavPath); navClick — из click-роутинга.

  _alertActive() { return typeof metaHas === 'function' && metaHas(ALERT.node); }   // ОБНАРУЖЕНИЕ УГРОЗ открыто узлом mast_sa
  _contamActive() { return typeof metaHas === 'function' && metaHas('mast_sr') && this.unit && (this.unit.stats.scanR || 0) > 0; }   // ДЕТЕКТОР ЗАГРЯЗНЕНИЯ — свойство сканера, открыто узлом mast_sr
  _alertThreats() { return this.enemies ? this.enemies.reduce((n, e) => n + ((e.dead || e.friendly) ? 0 : 1), 0) : 0; }   // дружественные — не угрозы
  // Клик в забеге: тумблер «ОБНАРУЖЕНИЕ УГРОЗ» в HUD (если узел открыт).
  alertClick(x, y) {
    if (!this._alertActive() || typeof alertHudRect !== 'function') return false;
    const r = alertHudRect();
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { this.alertView = !this.alertView; return true; }
    return false;
  }
  // Клик в забеге: кнопки типа ресурса РАДАРА (3 сегмента; клик по кнопке = выбрать её тип). Если радар установлен и не полный спектр.
  radarSwitchClick(x, y) {
    if (typeof radarSwitchVisible !== 'function' || !radarSwitchVisible(this) || typeof radarSwitchButtons !== 'function') return false;
    for (const b of radarSwitchButtons()) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.radarSetType(b.type); return true; }
    return false;
  }
  _addShake(mag) { this.shakeMag = Math.min(SHAKE_MAX, Math.max(this.shakeMag || 0, mag)); this.shakeT = SHAKE_TIME; }
  // Направление искр «ОТ источника урона» (вывод по БЛИЖАЙШЕЙ угрозе в момент удара — игра не хранит откуда прилетело).
  // Дёшево: один проход по `list` (+ опц. юнит) ТОЛЬКО в кадр удара (удары редки). Вектор = жертва − ближайший источник.
  _hitAwayDir(px, py, list, includeUnit) {
    let bx = null, by = null, bd = Infinity;
    if (list) for (const s of list) { if (!s || s.dying || s.dead || s.friendly) continue; const dx = wrapDeltaPx(s.px, px), dy = s.py - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; bx = s.px; by = s.py; } }
    if (includeUnit && this.unit) { const dx = wrapDeltaPx(this.unit.px, px), dy = this.unit.py - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; bx = this.unit.px; by = this.unit.py; } }
    if (bx == null || bd < 1) return null;
    const dx = wrapDeltaPx(px, bx), dy = py - by, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
  // Хаб удар-фидбэка: ЛОВИТ ПАДЕНИЕ hp у юнита/врагов/структур (детект по кадру — без правок их damage()) →
  // искры (game.fx) + флэш-таймер `hitT` (читает рендер) + тряска экрана (только за ранение ЮНИТА). Тикает hitT/shake.
  _hitFxPass(dt) {
    const fx = this.fx, u = this.unit;
    if (u) {
      if (this._fxUnitHp != null && u.hp < this._fxUnitHp - 0.001) {
        if (fx) fx.hit(u.px, u.py, '#ff5040', HIT_SPARK_UNIT, this._hitAwayDir(u.px, u.py, this.enemies, false));   // искры от ближайшего врага
        u.hitT = HIT_FLASH_TIME; /* ТРЯСКА ОТКЛЮЧЕНА (вкл — раскомментировать): this._addShake(Math.min(SHAKE_MAX, SHAKE_HIT + (this._fxUnitHp - u.hp) * SHAKE_PER_DMG)); */
      }
      this._fxUnitHp = u.hp; if (u.hitT > 0) u.hitT = Math.max(0, u.hitT - dt);
    }
    for (const e of this.enemies) {
      if (e._fxHp != null && e.hp < e._fxHp - 0.001 && !e.dying) { if (fx) fx.hit(e.px, e.py, '#ffd070', HIT_SPARK_ENEMY, this._hitAwayDir(e.px, e.py, null, true)); e.hitT = HIT_FLASH_TIME; }   // искры от юнита (бур/импульс/осада)
      e._fxHp = e.hp; if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
    }
    if (this.structures) for (const s of this.structures.list) {
      if (s._fxHp != null && s.hp < s._fxHp - 0.001 && !s.dying) { if (fx) fx.hit(s.px, s.py, '#ff9a4a', HIT_SPARK_STRUCT, this._hitAwayDir(s.px, s.py, this.enemies, false)); s.hitT = HIT_FLASH_TIME; }   // искры от ближайшего врага
      s._fxHp = s.hp; if (s.hitT > 0) s.hitT = Math.max(0, s.hitT - dt);
    }
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
  }
  drawScene() {
    const ctx = this.ctx;
    ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, this.designW, this.designH);
    // ТРЯСКА ЭКРАНА (удар-фидбэк): мировой слой смещается на затухающий мелкий офсет; HUD/CRT — без тряски (restore до них).
    let _shx = 0, _shy = 0;
    // ТРЯСКА ЭКРАНА ВРЕМЕННО ОТКЛЮЧЕНА (вкл — раскомментировать строку ниже + вызов _addShake в _hitFxPass):
    // if (this.shakeT > 0 && this.shakeMag) { const f = this.shakeT / SHAKE_TIME, t = performance.now() / 1000; _shx = Math.round(Math.cos(t * 97) * this.shakeMag * f); _shy = Math.round(Math.sin(t * 83) * this.shakeMag * f); }
    ctx.save(); ctx.translate(_shx, _shy);
    drawWorld(ctx, this.world, this.unit, this.camera, this.debug);
    if (typeof drawScrewTrail === 'function') drawScrewTrail(ctx, this.world, this.camera);   // винтовой бур: «резьба» на укреплённых ходах (текстура тайла)
    if (typeof drawServers === 'function') drawServers(ctx, this.world, this.camera, this.debug);   // серверы/хлам (туман приглушит невидимые; в дебаге — все)
    if (typeof drawArtifacts === 'function') drawArtifacts(ctx, this.world, this.camera);   // артефакты-реликты в породе (под туманом, как серверы)
    if (typeof drawRobots === 'function') drawRobots(ctx, this, this.camera);   // останки роботов (погребённые под туманом; активные — поверх)
    if (typeof drawMines === 'function') drawMines(ctx, this, this.camera);     // старые мины (мигают перед взрывом)
    if (typeof drawContainers === 'function') drawContainers(ctx, this, this.camera);   // контейнеры-хранилища: крейт + анимация взлома (под туманом, в прокопанном ходе)
    if (typeof drawBlightBeacons === 'function') drawBlightBeacons(ctx, this.blightBeacons, this.camera);   // маяки скверны (под туманом, до врагов/структур)
    drawEnemies(ctx, this.enemies, this.camera);
    if (typeof drawStructures === 'function') drawStructures(ctx, this.structures, this.camera);   // печатные структуры (в мире, под туманом)
    if (typeof drawCityTurrets === 'function') drawCityTurrets(ctx, this, this.camera);   // ТУРЕЛИ ГОРОДА (узлы amb_turret*): авто-оборона базы
    if (typeof drawCityShield === 'function') drawCityShield(ctx, this, this.camera);   // ЩИТ ГОРОДА (артефакт city_shield): купол над базой
    if (typeof drawShots === 'function') drawShots(ctx, this.shots, this.camera);   // трассеры выстрелов врагов (снайпер)
    drawLoot(ctx, this.loot, this.camera);
    if (typeof drawDust === 'function') drawDust(ctx, this.dust, this.camera);   // пыль — В мире, ПОД туманом/светом (гаснет в незримом)
    if (typeof drawFalling === 'function' && this.falling) drawFalling(ctx, this.falling, this.camera);   // обвалы/валуны — В МИРЕ, ПОД туманом (видны только в зримом/освещённом; раньше рисовались поверх тумана)
    if (!this.debug) {
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      drawHeadlight(ctx, this.world, this.unit, this.camera, this.designW, this.designH, this.radLevel);   // прожектор-конус у бура (тьма вокруг), с тенями от породы; пыль зеленеет от радиации
    }
    // фон пещер-сцен — поверх тумана, клип по воздуху пещеры (под юнитом/видениями)
    if (!this.debug && typeof drawBackdrops === 'function') drawBackdrops(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
    // видения в темноте — поверх тумана (в неосвещённой части), ПОД юнитом/валунами (они на переднем плане);
    // щупальцам нужна экранная позиция юнита (тянутся к нему)
    if (this.mode === 'playing' && !this.debug && this.visions && typeof drawVisions === 'function') {
      drawVisions(ctx, this.visions, this.designW, this.designH, performance.now() / 1000, this.camera.screenX(this.unit.px), this.unit.py - this.camera.y);
    }
    if (!this.debug) this._drawNavPath(ctx);   // НАВИГАЦИЯ к городу: поверх тумана (видно в темноте), но ПОД валунами/юнитом — опасность важнее путеводной линии
    if (!this.debug) this._drawCityBeacon(ctx);   // МАЯЧОК ГОРОДА: янтарная стрелка-указатель к базе вокруг юнита
    if (typeof drawBorers === 'function') drawBorers(ctx, this, this.camera);   // винтовой бур: щиты ПОВЕРХ тумана (игрок видит/отзывает их в темноте)
    if (typeof drawEnergyCable === 'function') drawEnergyCable(ctx, this, this.camera);   // энергошлейф (print_cable/print_batt): тетер база/батарея→юнит ПОВЕРХ тумана (лайфлайн)
    if (typeof drawCouriers === 'function') drawCouriers(ctx, this, this.camera);   // курьер-дроны (vault_courier): летят к базе ПОВЕРХ тумана (видно маршрут)
    if (typeof drawDrones === 'function') drawDrones(ctx, this, this.camera);   // дрон-компаньон (реликт дрон-слота): ПОВЕРХ тумана
    if (typeof drawTraps === 'function') drawTraps(ctx, this, this.camera);   // ловушки: кислотное облако-шиммер + сейсмо-волна-линза (поверх тумана — опасность видна)
    if (typeof drawJets === 'function') drawJets(ctx, this, this.camera);   // ПРЫЖКОВЫЕ ДВИЖКИ (артефакт): выхлоп из-под юнита в полёте
    const _uDef = this.unit && typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[this.unit.hull];
    const _wheelHull = !!(_uDef && _uDef.kind === 'wheel');
    const _anchorHull = !!(_uDef && _uDef.anchorLegs);   // «Спрут»: якорные щупальца вместо IK (sprut.js)
    const tOff = _anchorHull ? sprutBodyOffset() : ((this.debugTentacles && !_wheelHull) ? tentacleBodyOffset() : null);   // корпус едет на ногах (лаг/подвес) — нужен и щиту; у колеса ног нет
    if (typeof drawCarriedBorer === 'function') drawCarriedBorer(ctx, this, this.camera, tOff);   // несомый «следующий» щит торчит из юнита (рисуется ДО юнита → задняя половина уходит под корпус); tOff → приклеен к корпусу
    if (this.printMode === 'place' && typeof drawPrintGhost === 'function') drawPrintGhost(ctx, this, this.camera);   // голограмма размещения печати (поверх тумана — это UI)
    if (typeof partsHull === 'function' && this.unit) partsHull(this.unit.hull);   // спрайты по типу корпуса (ноги+кольцо+детали)
    const ringDef = this.unit && typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[this.unit.hull];
    const isRing = !!(ringDef && ringDef.kind === 'ring');
    const isWheel = !!(ringDef && ringDef.kind === 'wheel');
    if (isWheel) {
      // МОНО-КОЛЕСО «Канонир»: ног/щупалец нет, лага корпуса нет — колесо на месте юнита, турель поверх.
      // Клип по видимому воздуху → колесо ЗА породой (как щупальца), не вылезает на камень.
      ctx.save(); clipVisibleAir(ctx, this.world, this.camera);
      if (typeof drawWheelUnit === 'function') drawWheelUnit(ctx, this.world, this.unit, this.camera, { scale: unitDrawScale(this.unit), dy: (typeof wheelGroundDy === 'function' ? wheelGroundDy(this.unit) : 0) });   // колесо садится на пол (не парит)
      ctx.restore();
    } else if (isRing) {
      // КОЛЬЦО: ноги (щупальца/якоря «Спрута») рисуются ПОД кольцом/модулями (клип по видимому воздуху →
      // не «вылезает»), затем кластер кольца+модулей ПОВЕРХ. Кластер вращается к направлению бурения, ноги — нет.
      if (_anchorHull && this.unit && typeof drawSprutLegs === 'function') { ctx.save(); clipVisibleAir(ctx, this.world, this.camera); drawSprutLegs(ctx, this.camera); ctx.restore(); }
      else if (this.debugTentacles && this.unit) { ctx.save(); clipVisibleAir(ctx, this.world, this.camera); drawTentacles(ctx, this.camera); ctx.restore(); }
      drawRingUnit(ctx, this.world, this.unit, this.camera, { scale: unitDrawScale(this.unit), dx: tOff ? tOff.x : 0, dy: tOff ? tOff.y : 0 });
    } else {
      drawTachikoma(ctx, this.world, this.unit, this.camera, { scale: unitDrawScale(this.unit), hideLegs: this.debugTentacles, dx: tOff ? tOff.x : 0, dy: tOff ? tOff.y : 0 });
      if (this.debugTentacles && this.unit) {              // щупальца — ЗА породой (клип по видимому воздуху): юнит не «вылезает»
        ctx.save(); clipVisibleAir(ctx, this.world, this.camera); drawTentacles(ctx, this.camera); ctx.restore();
      }
    }
    if (isWheel && typeof drawUnitTurretFx === 'function') drawUnitTurretFx(ctx, this, this.camera);   // трассеры авто-турели канонира
    if (this.unit && this.unit.hitT > 0) {   // удар-флэш ЮНИТА: красная аддитивная вспышка поверх корпуса
      const f = this.unit.hitT / HIT_FLASH_TIME, ux = this.camera.screenX(this.unit.px), uy = this.unit.py - this.camera.y;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 * f; ctx.fillStyle = '#ff5040';
      ctx.beginPath(); ctx.arc(ux, uy, TILE * 0.72, 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (typeof drawUnitDebuffFx === 'function' && !this.debug) drawUnitDebuffFx(ctx, this, this.camera);   // дебаффы останков на юните: паутина-нити / прыгун на буре
    if (typeof drawDrillHeat === 'function' && !this.debug) drawDrillHeat(ctx, this, this.camera);   // ФОРСАЖ БУРА (реликт): термометр нагрева над юнитом
    if (typeof drawDashFx === 'function' && !this.debug) drawDashFx(ctx, this, this.camera);   // РЫВОК (реликт): стрики-послесвечение во время рывка
    if (typeof drawHarpoonFx === 'function' && !this.debug) drawHarpoonFx(ctx, this, this.camera);   // ГАРПУН (реликт): трос юнит→якорь
    if (typeof drawBorerArrows === 'function' && !this.debug && typeof metaHas === 'function' && metaHas('mast_ds_nav')) drawBorerArrows(ctx, this, this.camera);   // узел: стрелки-указатели на запущенные щиты вокруг юнита
    if (typeof drawScanFx === 'function' && !this.debug) drawScanFx(ctx, this, this.camera);   // лучи сканера к серверу-хламу (поверх юнита)
    if (typeof drawHackFx === 'function' && !this.debug) drawHackFx(ctx, this, this.camera);   // канал взлома города (лиловый тетер + кольцо-прогресс, поверх юнита)
    if (typeof drawEnemyScanFx === 'function' && !this.debug) drawEnemyScanFx(ctx, this, this.camera);   // лучи сканера к сканируемому врагу
    if (typeof drawBackdropScan === 'function' && !this.debug) drawBackdropScan(ctx, this, this.camera);   // конус сканера к объекту пещеры при объёмном скане
    drawFx(ctx, this.fx, this.camera);
    if (typeof drawImpulseWave === 'function' && !this.debug) { drawImpulseWave(ctx, this, this.camera); drawImpulseCharge(ctx, this, this.camera); }   // импульсный бур: волна-выстрел + дуга заряда (поверх юнита/света)
    if (typeof drawSiegeBeam === 'function' && !this.debug) { drawSiegeBeam(ctx, this, this.camera); drawSiegeCharge(ctx, this, this.camera); }   // осадный модуль: луч-копьё + сходящийся фокус-заряд
    if (typeof drawStealthFx === 'function' && !this.debug) drawStealthFx(ctx, this, this.camera);   // стелс-модуль: маскировка-шиммер поверх юнита, пока невидим
    if (typeof drawJamFx === 'function' && !this.debug) drawJamFx(ctx, this, this.camera);   // взлом юнитов: расходящееся кольцо-помеха на импульсе
    if (typeof drawKineticHeat === 'function' && !this.debug) drawKineticHeat(ctx, this, this.camera);   // кинетический бур: глоу контакта + пипы разгона
    // ОБНАРУЖЕНИЕ УГРОЗ: голо-маркеры врагов/нестабильностей поверх мира/тумана, ПОД CRT/HUD (только в игре, при владении узлом и включённом тумблере)
    if (this.mode === 'playing' && !this.debug && this.alertView && this._alertActive() && typeof drawAlertOverlay === 'function')
      drawAlertOverlay(ctx, this, this.camera, this.designW, this.designH, performance.now() / 1000);
    if (this.mode === 'playing' && !this.debug) {   // РАДАР-развёртка + ЭХО-волна: ПОВЕРХ тумана (блипы видны сквозь тьму — радар «сквозь породу»), ПОД CRT/HUD
      if (typeof drawRadarSweep === 'function') drawRadarSweep(ctx, this, this.camera);
      if (typeof drawEchoWave === 'function') drawEchoWave(ctx, this, this.camera);
    }
    if (this.debug && typeof drawHazardDebug === 'function') drawHazardDebug(ctx, this, this.camera);   // ДЕБАГ: маркеры артефактов/роботов/мин (туман выкл)
    ctx.restore();   // конец смещённого тряской мирового слоя — HUD/CRT рисуются без тряски
    if (this._cinematic) return;   // КИНОРЕЖИМ (tools/teaser.js — тизер): рисуем ТОЛЬКО мир, без HUD/CRT-рамки/виджетов
    if (typeof HudLayout !== 'undefined') HudLayout.begin(this.designW, this.designH);   // сброс зон-слотов HUD на кадр (дизайн-система «виджеты не наслаиваются» — hud_layout.js)
    if (this.sandbox && this.drawSandboxLabels) this.drawSandboxLabels(ctx, this.camera);   // ТЕСТОВЫЙ ПОЛИГОН: debug-подписи типов над объектами
    drawCrtOverlay(ctx, this.designW, this.designH);   // виньетка + скан-лайны поверх мира (HUD крупнее)
    drawHUD(ctx, this.world, this.unit, this.inventory, { fps: this.fps, delivered: this.deliveredTotal, cycle: this.cycle, cycleNum: this.cycleLabel(), scan: this.activeScan || (this.scanEnemy ? { data: this.scanEnemy.scan } : null), scanDoneT: this._scanDoneT, scanMsg: this._scanMsg, log: this.eventLog, bank: (typeof metaHas === 'function' && metaHas('amb_hub')) ? this.upgrades.bank : null, hoard: this.hoardCargo }, this.designW, this.designH);
    if (typeof HudLayout !== 'undefined' && typeof hudLeftBottom === 'function')
      HudLayout.reserve('tl', HUD_VW, hudLeftBottom(typeof metaHas === 'function' && metaHas('amb_hub')) - HUD_VY);   // застолбить фикс-панели (ЮНИТ/ГРУЗ/БАНК) → условные виджеты зоны tl стекаются НИЖЕ них
    if (typeof drawWavePredict === 'function') drawWavePredict(ctx, this, 580, 24);   // ПРОГНОЗ ВОЛН (узел amb_predict): графический таймер + глиф угрозы, под «ЦИКЛ N»
    if (this.mode === 'playing' && !this.debug && typeof drawDebuffBadge === 'function') drawDebuffBadge(ctx, this, this.designW, this.designH);   // мигающая плашка активных дебаффов (паутина/прыгун/глушилка)
    if (this.mode === 'playing' && !this.debug && this._alertActive() && typeof drawAlertToggle === 'function')
      drawAlertToggle(ctx, this.alertView, this._alertThreats(), performance.now() / 1000);   // HUD-тумблер (виден при владении узлом)
    if (this.mode === 'playing' && !this.debug && typeof drawPrintHud === 'function') drawPrintHud(ctx, this, this.designW, this.designH);   // панель печати структур / подсказка режима
    if (this.mode === 'playing' && !this.debug && typeof drawBorerStatus === 'function') drawBorerStatus(ctx, this, this.designW, this.designH);   // винтовой бур: статус щитов (несом/в ходу)
    if (this.mode === 'playing' && !this.debug && typeof drawEconomyWidgets === 'function') drawEconomyWidgets(ctx, this, this.designW, this.designH);   // ЭКОНОМИКА ГОРОДА: чипы конвертера/электростанции (реликты converter/power_plant)
    if (typeof drawActionBar === 'function') drawActionBar(ctx, this, this.designW, this.designH);   // панель активных действий (низ-центр): дубль хоткеев кнопками
    if (this.mode === 'playing' && !this.debug && typeof metaHas === 'function' && metaHas('amb_nav') && typeof drawNavToggle === 'function')
      drawNavToggle(ctx, this.navView, this.designW);   // лаконичный HUD-тумблер ПУТЬ (под маячком, если он есть; виден при владении узлом amb_nav)
    if (this.mode === 'playing' && !this.debug && typeof metaHas === 'function' && metaHas('amb_beacon') && typeof drawBeaconToggle === 'function')
      drawBeaconToggle(ctx, this.beaconView, this.designW);   // HUD-тумблер ГОРОД (янтарный, верхний слот; виден при владении узлом amb_beacon)
    if (typeof drawRadarSwitch === 'function') drawRadarSwitch(ctx, this);   // HUD-чип переключателя типа ресурса радара (клик / C); скрыт без радара/при полном спектре
    // ⚠️ НЕ УДАЛЯТЬ ПОКА: виджет кулдауна сканера временно ОТКЛЮЧЁН — кулдаун теперь показывает заливка иконок в
    // панели активных действий (drawActionBar). Код виджета (drawScanCooldown/scanCdInfo, render_scanners.js) оставлен.
    // if (typeof drawScanCooldown === 'function') drawScanCooldown(ctx, this, this.designW);
    if (this.mode === 'playing' && !this.debug && this.radar && this._contamActive() && typeof drawRadarCompass === 'function') {   // ДЕТЕКТОР ЗАГРЯЗНЕНИЯ: слот зоны tl (стек под фикс-панелями)
      const s = (typeof HudLayout !== 'undefined') ? HudLayout.slotDock('tl', RADAR_W, RADAR_H, 'contam', PAL.amber) : { x: 10, y: (typeof hudLeftBottom === 'function' ? hudLeftBottom(metaHas('amb_hub')) : 118) + 6 };
      drawRadarCompass(ctx, this.radar, s.x, s.y);
    }
    if (this.mode === 'playing' && !this.debug && this.dataCompass && this.artifactHas('data_detector') && typeof drawDataCompass === 'function') {   // ДЕТЕКТОР ДАННЫХ (реликт города): слот зоны tl (стек ПОД детектором загрязнения)
      const s = (typeof HudLayout !== 'undefined') ? HudLayout.slotDock('tl', DATADET_W, DATADET_H, 'datadet', PAL.cobalt) : { x: 10, y: ((typeof hudLeftBottom === 'function' ? hudLeftBottom(metaHas('amb_hub')) : 118) + 6) + (this._contamActive() ? RADAR_H + 6 : 0) };
      drawDataCompass(ctx, this.dataCompass, s.x, s.y);
    }
    drawCity(ctx, this.city, this.designW);
    if (this.mode === 'playing' && !this.debug && this.atBase()) {   // подсказка действия под капсулой таймера (в зоне города)
      const ctx2 = ctx; ctx2.save(); ctx2.font = `8px ${FONT_MONO}`; ctx2.textBaseline = 'top'; ctx2.textAlign = 'left';
      ctx2.globalAlpha = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() / 400));
      ctx2.fillStyle = PAL.gold; ctx2.fillText(STR.hud.cityUpgradeHint(STR.input.space), 214, 56);
      ctx2.restore();
    }
    if (this.mode === 'playing' && !this.debug && this.firewall && this.firewall.visible() && typeof drawFirewall === 'function')
      drawFirewall(ctx, this.firewall, this.designW, performance.now() / 1000);   // виджет взлома файрволла (под капсулой, только при атаке)
    if (this.mode === 'playing' && !this.debug && this._winTimer && typeof drawWinTimer === 'function') drawWinTimer(ctx, this, this.designW);   // ПЕРЕХВАТ РЕАКТОРА: таймер победы (kart_hackcity) — ПОСЛЕ капсулы/файрволла: слот зоны tc стекается под ними
    if (this.mode === 'playing' && !this.debug && typeof drawBigHint === 'function') drawBigHint(ctx, this.hints, this.designW, this.designH);   // крупная сюжетная подсказка
    if (this.sandbox && this.drawSandboxHud) this.drawSandboxHud(ctx, this.designW, this.designH);   // ТЕСТОВЫЙ ПОЛИГОН: баннер хоткеев (низ-центр)
    if (this.sandbox && this.drawSandboxSpawnPanel) this.drawSandboxSpawnPanel(ctx, this.designW, this.designH);   // ПАНЕЛЬ СПАВНА ВРАГОВ (справа)
    if (typeof HudLayout !== 'undefined') HudLayout.drawDockTabs(ctx);   // язычки сворачивания левых виджетов — ПОВЕРХ них
    if (typeof HudLayout !== 'undefined') HudLayout.validate();   // DEV-сеть (гибрид D): ворчит на наложения HUD-виджетов, дедуп в validate() (только при смене набора — без спама)
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
    if (this.mode === 'playing' && !this.debug) {
      const noise = Math.max(0, this.radLevel - ((this.unit.stats && this.unit.stats.noiseResist) || 0));   // апгрейд ЭКРАН ПОМЕХ гасит глитчи
      drawInterference(ctx, this.canvas, noise, performance.now() / 1000);
    }
  }

  loop(now) {
    this._rafPending = false;
    if (this._hidden) return;            // вкладка скрыта/свёрнута — ПОЛНАЯ пауза (ни рендера, ни перепланирования)
    this._schedule();                    // следующий кадр СРАЗУ — ранний return ниже не должен оборвать цикл
    // КАП FPS: на 120/144Гц рендерим не чаще FPS_CAP — вдвое меньше нагрев GPU. Игра кадрово-независима
    // (скорости берут dt), пропущенный rAF-тик просто не рисует. this.last двигается только на отрисованных кадрах.
    // Окно НЕ в фокусе → роняем до BG_FPS (видимо, но «в фоне» — не жечь GPU зря).
    const cap = this._focused ? FPS_CAP : BG_FPS;
    if (now - this.last < 1000 / cap - 1) return;
    let dt = (now - this.last) / 1000; this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 1e-6)) * 0.1;

    const ctx = this.ctx;
    // нативный рендер с масштабом design→пиксели (резко на любом DPI/разрешении)
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    if (this.mode !== this._modePrev) { this.menuSel = 0; this._modePrev = this.mode; }   // вход в меню → курсор на первую кнопку
    if (this.mode === 'menu') this._tickEpoch(dt);   // глобальный цикл существования ИИ тикает на главной

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
      this.structures.update(dt, this);   // структуры живут и в дебаг-обзоре (видно работу турелей)
      this.loot.update(dt, this.world, this.unit, this.inventory); // дропы падают и в дебаге (юнит заморожен — подбора нет)
      this.fx.update(dt);
      if (this.input.pressed('Escape')) this.mode = 'paused';
      this.drawScene();
      // ДЕБАГ-ОВЕРЛЕЙ: fps + координаты юнита по тайлам мира
      ctx.save(); ctx.font = `10px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.toxic || '#c8e25a';
      ctx.fillText(`FPS ${Math.round(this.fps || 0)}  ·  XY ${this.unit ? this.unit.tileX : '-'},${this.unit ? this.unit.tileY : '-'}`, 12, this.designH - 24);
      ctx.restore();
    } else if (this.mode === 'playing') {
      if (this.input.pressed('KeyB')) this.debug = true;
      if (this.input.pressed(ALERT.key) && this._alertActive()) this.alertView = !this.alertView;   // ОБНАРУЖЕНИЕ УГРОЗ: вкл/выкл
      if (this.input.pressed('KeyN') && typeof metaHas === 'function' && metaHas('amb_nav')) this.navView = !this.navView;   // ПУТЬ навигации: вкл/выкл
      if (this.input.pressed('KeyG') && typeof metaHas === 'function' && metaHas('amb_beacon')) this.beaconView = !this.beaconView;   // ГОРОД (маячок): вкл/выкл
      if (this.input.pressed('KeyC')) this.radarCycleType();   // РАДАР: переключить тип ресурса (no-op без радара/при полном спектре)
      if (this.input.pressed('KeyT')) this.debugTentacles = !this.debugTentacles;   // прототип щупалец
      if (this.sandbox && this.updateSandboxInput) this.updateSandboxInput();   // ТЕСТОВЫЙ ПОЛИГОН: R сброс, F тумблер обезвреживания
      this.updatePrint(dt);   // ПЕЧАТЬ: размещение/печать структур, лок юнита, Esc-отмена (до unit.update — кадр уважит frozenPrint)
      this.updateImpulse(dt);   // ИМПУЛЬСНЫЙ БУР: заряд Пробелом/выстрел-волна (до unit.update — кадр уважит frozenImpulse)
      this.updateBorers(dt);    // ВИНТОВОЙ БУР: автономные щиты-проходчики (запуск/возврат по Пробелу)
      this.updateHack(dt);      // ВЗЛОМ ГОРОДА: канал взлома у сердца спящей каверны (до unit.update — кадр уважит frozenHack)
      this.updateSiege(dt);     // ОСАДНЫЙ МОДУЛЬ: заряд цифрой 3 → пробойный луч по дикому гнезду (до unit.update — кадр уважит frozenSiege)
      this.updateStealth(dt);   // СТЕЛС-МОДУЛЬ: разовая активация невидимости (доп-действие) → unit.stealthT для ai.js
      this.updateJam(dt);       // ВЗЛОМ ЮНИТОВ: импульс-глушение (доп-действие) → e.slowT врагам в радиусе
      this.updateJets(dt);      // ПРЫЖКОВЫЕ ДВИЖКИ (артефакт): удержание доп-действия → unit.flying (до unit.update — полёт через воздух)
      this.updateDash(dt);      // РЫВОК (артефакт): доп-действие → unit.dashing (до unit.update — авто-проходка по воздуху)
      this.updateHarpoon(dt);   // ГАРПУН (артефакт): доп-действие → притяг к стене через dash-машинерию (до unit.update)
      this.unit.update(dt, this.input, this.world);
      const _hullKind = UNIT_DEFS[this.unit.hull] && UNIT_DEFS[this.unit.hull].kind;
      const _hullAnchor = UNIT_DEFS[this.unit.hull] && UNIT_DEFS[this.unit.hull].anchorLegs;
      if (_hullAnchor) updateSprutLegs(dt, this.unit, this.world);   // «Спрут»: якорные щупальца (sprut.js)
      else if (this.debugTentacles && _hullKind !== 'wheel') updateTentacles(dt, this.unit, this.world);   // у колеса ног нет
      if (typeof updateRingAim === 'function' && _hullKind === 'ring') updateRingAim(dt, this.unit);   // доворот кластера кольца к направлению бурения
      if (_hullKind === 'wheel') {
        if (typeof updateWheelSpin === 'function') updateWheelSpin(dt, this.unit);   // качение колеса + раскрутка бура
        if (typeof this.updateUnitTurret === 'function') this.updateUnitTurret(dt);  // авто-турель канонира (cannon.js)
      }
      if (this.unit.dug) {
        const d = this.unit.dug, n = d.amount || 1;
        for (let i = 0; i < n; i++) this.loot.spawn(wrapX(d.x + (n > 1 ? Math.round((Math.random() - 0.5) * 2.2) : 0)), d.y, d.type);   // богатый тайл (1..3) → несколько дропов
        // print_ore «Анализ породы»: глубже читает структуру → шанс выжать из той же залежи лишнюю единицу СВЕРХУ
        if (typeof metaHas === 'function' && metaHas('print_ore') && Math.random() < PRINT_ORE_CHANCE) this.loot.spawn(wrapX(d.x), d.y, d.type);
        this.unit.dug = null;
      }
      if (this.unit.broke) {   // проходка: считаем прокопанные тайлы; ДЕБАФФ прыгуна сбрасывается по проходке (не по таймеру)
        this.dugTiles++;
        if (this.unit.latchTiles > 0) { this.unit.latchTiles--; if (this.unit.latchTiles <= 0 && !this.debug) this.logEvent(STR.log.robotLatchOff); }
        this.unit.broke = false;
      }
      if (this.unit.kinBurstFx) {   // ВЗРЫВНОЙ ПРОБОЙ кинетики (mast_dk_burst): FX на мгновенно пробитом тайле (лут/проходка идут обычным путём dug/broke)
        const d = this.unit.kinBurstFx, px = (wrapX(d.x) + 0.5) * TILE, py = (d.y + 0.5) * TILE;
        if (this.dust && this.dust.burst) this.dust.burst(px, py);
        if (this.fx) this.fx.hit(px, py, '#ffb060', 7);   // тёплая вспышка-разряд кинетики (сопровождает сам пробой — заряд незаметен)
        this.unit.kinBurstFx = null;
      }
      if (this.unit.echoBreak) {   // ЭХО-БУР (реликт): соседний тайл пробит — лут + проходка + FX
        const d = this.unit.echoBreak, n = d.amount || 1, px = (wrapX(d.x) + 0.5) * TILE, py = (d.y + 0.5) * TILE;
        if (d.type) for (let i = 0; i < n; i++) this.loot.spawn(wrapX(d.x), d.y, d.type);
        this.dugTiles++;
        if (this.dust && this.dust.burst) this.dust.burst(px, py);
        this.unit.echoBreak = null;
      }
      this.updateServers(dt);   // авто-скан выкопанных серверов → данные + лог
      this.updateEnemyScan(dt);  // скан вражеских юнитов в радиусе сканера → данные кодекса
      this.updateScanners(dt);   // РАДАР-развёртка (блипы залежей/врагов) + ЭХО-волна (метки залежей по X)
      this.updateHazards(dt);    // погребённые опасности: останки роботов (стрельба) + старые мины (взрыв); откоп → срабатывание
      this.updateBlight(dt);     // маяки скверны (скверносей): добивание бурением → снятие очага помех
      this.updateTraps(dt);      // ловушки: срабатывание свежевыкопанных + тик активных (кислота DoT / сейсмо-волна / рассеивание)
      this.updateContainers(dt); // контейнеры-хранилища: юнит рядом + узел kart_hackbox → взлом-таймер → дроп ресурсов
      this.falling.update(dt, this.world, this.unit);   // нестабильная порода: срыв валунов + урон
      if (this.visions) this.visions.update(dt, this.unit, this.designW, this.designH);   // видения в темноте
      if (this.hints) this.hints.update(dt);
      this.checkDiscoveries(dt);   // первые встречи объектов → глоссарий+лог+подсказка; подъём → подсказка
      this.updateBackdrops(dt);  // вход в пещеру-сцену → объёмный скан → извлечение данных

      // фон помех (сглажен): полюса + очаги радиации у базы — интерфейс глючит
      this.radLevel += (this.world.radAt(this.unit.tileX, this.unit.tileY) - this.radLevel) * Math.min(1, dt * 2.5);
      if (this.radar && this._contamActive()) this.radar.update(dt, this.world, this.unit);   // детектор загрязнения (свойство сканера)

      this.loot.update(dt, this.world, this.unit, this.inventory, this.upgrades.pickupBonus() + ((this.unit.stats && this.unit.stats.lootMagnet) || 0));   // +лут-магнит (артефакт)
      this.fx.update(dt);
      this.camera.follow(this.unit, dt);
      this.dust.drill(dt, this.unit);                         // пыль бурения (от блока к юниту)
      if (this.borers) for (const b of this.borers) this.dust.borerDrill(dt, b);   // ВИНТОВЫЕ ЩИТЫ: та же крошка/пыль у фрезы, что у дефолтного бура
      this.dust.ambient(dt, this.world, this.camera);         // редкая фоновая пыль/камушки с потолка (после follow — камера актуальна)
      this.dust.update(dt);
      if (this.scanJamT > 0) { this.scanJamT = Math.max(0, this.scanJamT - dt); if (this.scanJamT <= 0 && !this.debug) this.logEvent(STR.log.robotJamOff); }   // ДЕБАФФ глушилка: спад → восстановление сканера
      if (this.unit.latchT > 0) { this.unit.latchT -= dt; if (this.unit.latchT <= 0 && this.unit.latchTiles > 0) { this.unit.latchTiles = 0; if (!this.debug) this.logEvent(STR.log.robotLatchOff); } }   // ДЕБАФФ прыгун: авто-отвал по времени (не только по проходке)
      if (this.scanJamT <= 0) this.world.reveal(this.unit.tileX, this.unit.tileY, Math.max(1, Math.round(this.unit.stats.scanR || SCANNER_R)));   // ЧЕСТНЫЕ целые тайлы (1/2/3); при глушении — туман НЕ снимается
      this._updateNavPath(dt);   // НАВИГАЦИЯ: пересчёт реального пути A* к базе (троттлинг внутри)
      const atBase = this.atBase();
      if (atBase && !this.hoardCargo && this.inventory.cargoUsed()) {   // режим «копить» — на базе НЕ сдаём ресурс
        this.deliverCd = (this.deliverCd || 0) - dt;
        if (this.deliverCd <= 0) { this.deliverCargo(); this.deliverCd = DELIVER_INTERVAL; }
      } else this.deliverCd = 0;
      // гаджет «Ремонт-дрон»: реген HP вне базы
      if (!atBase && this.upgrades.gadgets.repair) this.unit.hp = Math.min(this.unit.stats.maxHp, this.unit.hp + REPAIR_RATE * dt);
      // РЕМОНТНЫЙ ТРЮМ: непрерывный реген (healRate — HP за 10с)
      if (this.unit.stats.healRate) this.unit.hp = Math.min(this.unit.stats.maxHp, this.unit.hp + this.unit.stats.healRate / 10 * dt);
      // РЕМОНТНЫЙ ДОК (узел ГОРОД): на базе юнит лечит HP корпуса
      if (atBase) { const dr = this.upgrades.cityDockRate(); if (dr) this.unit.hp = Math.min(this.unit.stats.maxHp, this.unit.hp + dr * dt); }
      // ЭФФЕКТ ЛЕЧЕНИЯ: «+» РОВНО когда видимое (целое) HP вырастает на 1 — синхронно с реальным
      // восстановлением (а не по таймеру/накоплению). hp растёт только лечением, падает уроном.
      const fh = Math.floor(this.unit.hp);
      if (this._lastHpFloor != null && fh > this._lastHpFloor) this.fx.heal(this.unit.px, this.unit.py - TILE * 0.4);
      this._lastHpFloor = fh;
      const siphoned = this.enemies.some((e) => e.type === 'raider' && e.draining && !e.dead);   // рейдер сосёт реактор → дозарядка на базе на паузе
      this._cableUpdate(dt);   // print_cable/print_batt: трейлинг-кабель за юнитом (прокладка/сматывание/длина/обрушение/якоря) → this.cable
      if (this._cableAnchorInput) this._cableAnchorInput();   // Энергорелеи: доп-действие якоря шлейфа на батарею
      if (this._updateEconomy) this._updateEconomy(dt);   // ЭКОНОМИКА ГОРОДА (economy.js): синтез/конвертер на смену цикла + электростанция жжёт органику (ДО city.update — держит контуры пока горит резерв)
      this.city.update(dt, atBase, siphoned, !!(this.cable && this.cable.powered));
      this.cycle.update(dt * this._waveSlowFactor());   // макро-таймер эскалации (взлом-саботаж гнёзд ЗАМЕДЛЯЕТ — wildcity.js)
      this.updateEnemies(dt);  // волны диких гнёзд
      this.updateWilds(dt);    // дикие гнёзда как цель: спад вспышки попадания; победа при подавлении всех (wildcity.js)
      this._combatDrillTick(dt);   // БОЙ-БУР (артефакт): контактный урон врагам у юнита
      this.updateArtifactsActive(dt);   // активные реликты (ЭМИ-импульс/подрыв-заряд/нано-ремонт): доп-действия по цифрам
      this.updateDrillOverdrive(dt);    // ФОРСАЖ БУРА (реликт, пассив): нагрев от бурения → множитель силы; перегрев → лок (после unit.update/updateBorers)
      this.updateXray(dt);              // РЕНТГЕН (реликт): доп-действие → временное снятие тумана с затуханием (unit.xrayR → render_light.drawFog)
      this.updateDataDetector(dt);      // ДЕТЕКТОР ДАННЫХ (реликт города): пеленг к ближайшему серверу с данными (game.dataCompass → drawDataCompass)
      this.updateDrones(dt);            // ДРОН-КОМПАНЬОН (реликт дрон-слота): collector/courier/battery/scout/hacker (game.drone)
      this.structures.update(dt, this);   // печатные структуры: турели бьют врагов, подзарядка от юнита, гибель
      if (this._updateCityTurrets) this._updateCityTurrets(dt);   // ТУРЕЛИ ГОРОДА (узлы amb_turret*): авто-оборона базы (cityturret.js)
      this.updateCouriers(dt);            // курьер-дроны (vault_courier): полёт к базе, перехват врагами, сдача груза
      this._hitFxPass(dt);   // удар-фидбэк: детект урона по юниту/врагам/структурам ЗА КАДР → искры + флэш + тряска
      // ФАЙРВОЛЛ: активные взломщики у базы заполняют сегменты; узел amb_fw замедляет; ЮНИТ на взлом НЕ влияет (защита — убить хакеров)
      const hackers = this.enemies.reduce((n, e) => n + (e.hacking ? 1 : 0), 0);
      this.firewall.update(dt, hackers, typeof metaHas === 'function' && metaHas('amb_fw'));
      if (this.firewall.justSeg && !this.debug) this.logEvent(STR.log.fwSegment(this.firewall.segDone, FIREWALL_SEGMENTS));
      if (!this.sandbox && this.dugTiles > (this.save.bestDug || 0)) { this.save.bestDug = this.dugTiles; writeSave(this.save); }
      if (this.unit.hp <= 0) {   // ⚠️ сэндбокс — ПЕРВОЙ веткой этого же if (не отдельным if перед цепочкой): иначе else-if ниже (Esc/Пробел) не выполнятся в полигоне
        if (this.sandbox) this._sandboxRespawn();   // ТЕСТОВЫЙ ПОЛИГОН: бессмертие — hp≤0 → респаун у базы, без гейм-овера
        else if (typeof metaHas === 'function' && metaHas('print_life') && !this._lifeUsed) this._reprintBody();   // print_life: ОДИН раз за забег — перепечатка тела вместо гибели
        else { this.overReason = 'unit'; this.mode = 'gameover'; }
      }
      else if (!this.sandbox && this.city.dead) { this.overReason = 'city'; this.mode = 'gameover'; }   // в полигоне город/файрволл НЕ завершают забег → цепочка идёт к вводу
      else if (!this.sandbox && this.firewall.breached) { this.overReason = 'hack'; this.mode = 'gameover'; }
      else if (this.input.pressed('Escape') && !this.printMode && !this._printEsc) this.mode = 'paused';   // Esc в печати — отмена (см. updatePrint), не пауза
      else if (this.input.pressed(KEY_PRIMARY) && atBase && this.unit.state === IDLE && !this.printMode && !this._actionHeld) { this.upgrades.sel = 0; this.upgrades.scrollY = 0; this.mode = 'upgrades'; }   // апгрейды у базы — ГЛАВНОЕ действие (Пробел); ТОЛЬКО стоя (не в движении); НЕ от клика по кнопке действия (`_actionHeld`)
      this._checkArtifacts();   // откопал артефакт рядом → модалка выбора (переключит mode на 'artifact')
      this.updateWinTimer(dt);   // большой таймер перехвата реактора (kart_hackcity) → по концу mode 'hackwin'
      this.drawScene();
    } else if (this.mode === 'hackwin') {
      // КАТ-СЦЕНА ПОБЕДЫ: передача реактора города юниту (мир заморожен). Пробел/конец таймера → пересчёт-победа.
      this._winCut.t += dt;
      if (this._winCut.t >= WINCUT_DUR || this.input.pressed('Space', 'Enter', 'NumpadEnter')) this._finishHackWin();
      else { this.drawScene(); if (typeof drawWinCutscene === 'function') drawWinCutscene(ctx, this, this.camera, this.designW, this.designH); }
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
      drawUpgrades(ctx, this.upgrades, this.designW, this.designH);
    } else if (this.mode === 'intro') {
      this.intro.update(dt);
      // реактор ВКЛ только ПОСЛЕ установки (фаза печати/влёта → выкл, drawRingUnit рисует reactor:off)
      if (this.unit) this.unit.reactorOn = this.intro.t >= (INTRO_PRINT + INTRO_REACTOR);
      if (this.unit && UNIT_DEFS[this.unit.hull] && UNIT_DEFS[this.unit.hull].anchorLegs) updateSprutLegs(dt, this.unit, this.world);   // якоря «Спрута» живут и в интро
      else if (this.debugTentacles && this.unit) updateTentacles(dt, this.unit, this.world);   // живые ноги-щупальца в интро
      if (this.intro.done || this.input.pressed('Space', 'Enter', 'NumpadEnter')) { if (this.unit) this.unit.reactorOn = true; this.mode = 'playing'; }
      ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, this.designW, this.designH);
      drawWorld(ctx, this.world, this.unit, this.camera);
      drawFog(ctx, this.world, this.unit, this.camera, this.designW, this.designH);
      // ПРОЖЕКТОРНАЯ ТЬМА как в drawScene (без неё интро выглядело «без тумана» — раскрытая порода слишком светлая):
      // до установки реактора конуса нет — плоское затемнение с мягким гало у принтера; после — полный drawHeadlight.
      if (this.unit && this.unit.reactorOn) drawHeadlight(ctx, this.world, this.unit, this.camera, this.designW, this.designH, 0);
      else if (this.unit) {
        const ux = this.camera.screenX(this.unit.px), uy = this.unit.py - this.camera.y;
        const gr = ctx.createRadialGradient(ux, uy, TILE * 0.8, ux, uy, TILE * 2.8);
        gr.addColorStop(0, 'rgba(6,5,11,0.10)'); gr.addColorStop(1, 'rgba(6,5,11,0.46)');   // те же 0.46, что тьма drawHeadlight → включение реактора без скачка
        ctx.fillStyle = gr; ctx.fillRect(0, 0, this.designW, this.designH);
      }
      drawIntro(ctx, this.intro, this.world, this.unit, this.camera, this.designW, this.designH);
    } else if (this.mode === 'gameover') {
      // ENTER уводит в меню; рисуем сцену ТОЛЬКО если ещё в gameover — после
      // endRun world/unit/city уже null и drawScene → drawWorld(null) бы крашился
      // (канвас застрял бы с тёмным фоном — «чёрный экран»).
      if (!this.metaResult) {   // ОДИН РАЗ: пересчёт забега → токены + зачисление в банк save.meta
        this.metaResult = this.computeMeta();
        this.save.meta = (this.save.meta || 0) + this.metaResult.total;
        writeSave(this.save);
        this.overT = 0;
      }
      this.overT += dt;         // таймер для анимации счётчиков
      if (this.input.pressed('Enter', 'NumpadEnter', 'Space')) { this.endRun(); this.mode = 'menu'; }
      else {
        this.drawScene();
        drawGameOver(ctx, this.menuButtons(), this.designW, this.designH, this.overReason, this.metaResult, this.overT, this.save.meta);
      }
    } else if (this.mode === 'progress' || this.mode === 'database') {
      // экран рисует DOM-оверлей (meta_dom.js / codex_dom.js), ввод/выход — там же; canvas под ним просто тёмный
      ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, this.designW, this.designH);
    } else if (this.mode === 'inventory') {
      if (this.input.pressed('Escape')) this.mode = this.unit ? 'playing' : 'menu';
      if (this.input.pressed('Enter', 'NumpadEnter', 'Space')) this.onInventoryStart(); // «В шахту» — пробел/ввод равнозначны
      drawInventory(ctx, this.inventory, this.designW, this.designH);
    } else if (this.mode === 'artifact') {
      // модалка артефакта: мир заморожен (как пауза), выбор обязателен (Esc не отменяет). Число карт — динамическое (2/3 техно + данные + переработка).
      if (this._artChoose) {   // АНИМАЦИЯ выбора: остальные карты сворачиваются в центр, выбранная разгорается → по концу применяем эффект
        this._artChoose.t += dt;
        if (this._artChoose.t >= this._artChoose.dur) { const idx = this._artChoose.idx; this._artChoose = null; this._artifactResolve(idx); }
      } else {
        const nC = this._artifactChoiceCount || 3;   // ставит рендер (drawArtifactModal) = offer.length + 2
        if (this.input.pressed('KeyA', 'ArrowLeft', 'KeyW', 'ArrowUp')) this.artifactSel = (this.artifactSel + nC - 1) % nC;
        else if (this.input.pressed('KeyD', 'ArrowRight', 'KeyS', 'ArrowDown')) this.artifactSel = (this.artifactSel + 1) % nC;
        if (this.input.pressed('KeyR')) this._artifactReroll();   // ПОВТОРНЫЙ АНАЛИЗ (узел kart_reroll; no-op без узла/сбросов/кристалла)
        if (this.input.pressed('Enter', 'NumpadEnter', 'Space')) this.artifactChoose(this.artifactSel);
      }
      this.drawScene();
      if (typeof drawArtifactModal === 'function') drawArtifactModal(ctx, this, this.designW, this.designH);
    } else if (this.mode === 'paused') {
      if (this.input.pressed('Escape')) this.mode = 'playing';
      else this.menuNav();
      this.drawScene();
      drawPauseMenu(ctx, this.menuButtons(), this.designW, this.designH);
    } else {
      this.menuNav();   // WASD/стрелки — выбор кнопки, Space/Enter — нажать
      drawMainMenu(ctx, this.save, this.menuButtons(), this.designW, this.designH);
    }

    this.input.endFrame();
  }
}

// Старт игры. Зовётся загрузчиком (index.html) ПОСЛЕ выполнения всех модулей (порядок async=false),
// плюс фолбэк на window.load. Флаг (а НЕ `!window.game`) для идемпотентности: `window.game`
// уже занят браузером — это элемент <canvas id="game"> (именованный глобал), `!window.game` ложен.
window.bootGame = function () { if (window._gameBooted) return; window._gameBooted = true; window.game = new Game(document.getElementById('game')); };
if (document.readyState === 'complete') window.bootGame(); else window.addEventListener('load', window.bootGame);
