'use strict';

// ═══════════ ТЕСТОВЫЙ ПОЛИГОН (домешан в Game.prototype, ПОСЛЕ game) ═══════════
// Отладочный режим: ровная полка породы под базой с ОДНИМ экземпляром КАЖДОГО объекта (ловушки, останки
// роботов, реликты, сервер, пещеры-сцены), выстроенными в ряды с debug-подписью типа. Юнит бессмертен
// (hp≤0 → мгновенный респаун у базы, БЕЗ гейм-овера), всё открыто (все узлы меты + принтер + «бесконечные»
// ресурсы), туман выкл. Активация — хоткей T в главном меню. РЕЖИМ НЕ ПИШЕТ В СЕЙВ (writeSave заглушён
// флагом game.sandbox; на выходе сейв восстанавливается из снимка). Расширяемо: `startSandbox(kind)` —
// сейчас 'objects', позже 'enemies' (полигон взаимодействия с врагами). ⚠️ узел kart_defuse ВЫКЛ по умолчанию
// (иначе объекты обезвреживаются на откопе, а не срабатывают) — тумблер F. ПАНЕЛЬ СПАВНА ВРАГОВ (справа): по кнопке
// на тип — 1 юнит в точке за 20 тайлов ЛЕВЕЕ города; без лимитов/задержек (перф-тест — можно спамить).
const SANDBOX_ENEMY_TYPES = ['digger', 'collector', 'raider', 'hunter', 'hacker', 'sniper', 'swarm_midge', 'lurker', 'mine_planter', 'mender', 'siege_ram', 'siege_mortar', 'blight_sower'];
Object.assign(Game.prototype, {

  // ── ВХОД / ВЫХОД ──
  startSandbox(kind) {
    if (this.sandbox) this.exitSandbox();            // повторный вход без выхода — сперва восстановить ЧИСТЫЙ сейв (не снимать дрейф)
    this._sandboxSnap = JSON.stringify(this.save);   // снимок сейва: в памяти натикает runs (writeSave заглушён) → откатим на выходе
    this.sandbox = true;                             // ↑ ДО startSession: writeSave заглушён, metaHas читает оверрайд
    this._sandboxKind = kind || 'objects';
    this._sandboxDefuse = false;
    this._sandboxUnlocks = this._sandboxUnlockMap();  // все узлы (кроме kart_defuse) открыты в памяти
    this.inventory.loadBuild();                       // модули ЮНИТА — из ПОСЛЕДНЕГО забега (save.build); все узлы открыты → любой сохранённый модуль валиден
    this.startSession(this.inventory.getStats());     // создаёт unit/city/(процедурный world) — world перезапишем
    this.storyMode = false;                           // спавн-панель врагов работает вне зависимости от режима истории сейва
    this.unit.stats.capacity = SANDBOX_CARGO_FILL;    // трюм не мешает печатать/копить
    this._buildSandboxTerrain();                      // плоский полигон вместо процедурного мира
    this._buildSandboxObjects();                      // ряды объектов
    this._sandboxRefill();                            // «бесконечные» ресурсы
    this.unit.respawn(SPAWN_X, SPAWN_Y);
    this.camera.snap(this.unit);
    this._epochBase = 0;                              // эпоха в сэндбоксе не тикает/не пишется
    this.mode = 'playing';
    this.unit.reactorOn = true;
    if (this.logEvent) this.logEvent('ПОЛИГОН: все объекты в ряд · R сброс · F обезвреж.');
  },

  exitSandbox() {
    if (!this.sandbox) return;
    this.sandbox = false; this._sandboxUnlocks = null;
    if (this._sandboxSnap) {                          // откат in-memory дрейфа сейва (диск не трогался — writeSave был заглушён)
      const snap = JSON.parse(this._sandboxSnap);
      for (const k in this.save) delete this.save[k];
      Object.assign(this.save, snap);
      this._sandboxSnap = null;
      if (typeof metaBindSave === 'function') metaBindSave(this.save);
    }
  },

  // ── СНАРЯЖЕНИЕ (всё открыто, в памяти) ──
  _sandboxUnlockMap() {
    const m = {};
    if (typeof META_NODES !== 'undefined') for (const n of META_NODES) if (!n.wip) m[n.id] = true;
    m.kart_defuse = !!this._sandboxDefuse;            // обезвреживание — по тумблеру (иначе объекты не срабатывают)
    return m;
  },
  _sandboxRefill() {
    const f = { iron: SANDBOX_CARGO_FILL, organic: SANDBOX_CARGO_FILL, crystal: SANDBOX_CARGO_FILL };
    if (this.inventory) this.inventory.cargo = Object.assign({}, f);
    if (this.upgrades) this.upgrades.bank = Object.assign({}, f);
  },

  // ── РЕСПАУН / СБРОС ──
  // РЕСПАУН (смерть юнита): ТОЛЬКО оживить юнита у базы — сцену НЕ трогаем (тоннели/спавн-враги/вскрытые объекты остаются).
  _sandboxRespawn() {
    const u = this.unit; u.respawn(SPAWN_X, SPAWN_Y);
    if (this._cableInit) this._cableInit();
    this.imp = { charge: 0, cd: 0, dir: [1, 0], held: false, wave: null };
    this._lastHpFloor = Math.floor(u.hp);
    this.camera.snap(u);
    this._sandboxRefill();
    if (this.logEvent) this.logEvent('ПОЛИГОН: респаун у базы (сцена сохранена)');
  },
  // ПОЛНЫЙ РЕСТАРТ (клавиша R): пересобрать террейн+объекты С НУЛЯ + снести всё наспавненное/напечатанное + сброс циклов.
  resetSandbox() {
    this._buildSandboxTerrain(); this._buildSandboxObjects();   // свежие тайлы + свежие объекты (флаги dug/triggered/opened сброшены — объекты новые)
    this.acidClouds = []; this.seismicWaves = [];               // активные эффекты ловушек
    if (this.shots && this.shots.clear) this.shots.clear();     // выстрелы врагов
    if (this.blightBeacons) this.blightBeacons = [];            // маяки скверны
    this.enemies = [];                                          // спавн-панель: все враги
    this.couriers = [];                                         // курьер-дроны в полёте
    if (this.structures) this.structures.list = [];             // напечатанные структуры
    if (this.loot) this.loot.drops = [];                        // дроп ресурсов на земле
    if (this.cycle && this.cycle.reset) this.cycle.reset();     // фаза мира → цикл 1
    this._sandboxRespawn();                                     // оживить юнита у базы
    if (this.logEvent) this.logEvent('ПОЛИГОН перезапущен — сцена, объекты и циклы восстановлены');
  },

  // ── ВВОД (в playing-цикле) ──
  updateSandboxInput() {
    if (!this.sandbox || this.mode !== 'playing') return;
    if (this.input.pressed('KeyR')) this.resetSandbox();
    if (this.input.pressed('KeyF')) {                 // тумблер обезвреживания (kart_defuse)
      this._sandboxDefuse = !this._sandboxDefuse;
      this._sandboxUnlocks.kart_defuse = this._sandboxDefuse;
      if (this.logEvent) this.logEvent('ПОЛИГОН: обезвреживание ' + (this._sandboxDefuse ? 'ВКЛ' : 'ВЫКЛ'));
    }
  },

  // ── ПЛОСКИЙ МИР ──
  _buildSandboxTerrain() {
    const w = this.world;
    w.caverns = []; w.wilds = []; w.backdrops = []; w.radSources = [];
    w.servers = []; w.artifacts = []; w.robots = []; w.traps = []; w.mines = []; w.containers = []; w.unstableTriggers = [];
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        let type = AIR, hardness = 0, dens = 0;
        if (y === MAP_H - 1) type = BORDER;                                   // дно карты
        else if (y >= SANDBOX_SHELF_TOP && y <= SANDBOX_SHELF_BOT) { type = ROCK; hardness = SANDBOX_SHELF_HARD; dens = 1; }   // ПОЛКА (объекты на верхнем тайле)
        else if (y >= SANDBOX_FLOOR_TOP) { type = ROCK; hardness = SANDBOX_SHELF_HARD; dens = 1; }            // ДНО-ловушка под воздухом
        w.tiles[y * MAP_W + x] = { type, hardness, resource: null, dig: 0, dens };
      }
    for (let y = CAVE_Y0; y <= CAVE_FLOOR_Y; y++) for (let x = CAVE_X0; x <= CAVE_X1; x++) w.tiles[y * MAP_W + wrapX(x)].type = AIR;   // карман базы
    w.layFoundation(PRINTER.x - 1, PRINTER.x + PRINTER.w, CAVE_FLOOR_Y + 1);   // неразрушимый пол под принтером
    w.seen.fill(1); w.revealT.fill(255);                                       // весь полигон открыт (туман выкл)
  },

  // ── ОБЪЕКТЫ: копаемые — ОДИН РЯД на ПЕРВОМ тайле породы (откоп в 1 тайл) ──
  _buildSandboxObjects() {
    const Y = SANDBOX_ROW_Y, g = SANDBOX_ROW_GAP; let x = SANDBOX_ROW_X0;
    for (const type of ['acid', 'seismic', 'cavein', 'mine']) { this._sbTrap(x, Y, type); x += g; }
    for (const kind of ['shooter', 'web', 'latch', 'jam', 'brood']) { this._sbRobot(x, Y, kind); x += g; }
    this._sbServer(x, Y); x += g;
    for (const type of ['iron', 'organic', 'crystal']) { this._sbContainer(x, Y, type); x += g; }   // контейнеры (по типу ресурса)
    if (typeof ARTIFACT_POOL !== 'undefined') for (const def of ARTIFACT_POOL) { this._sbArtifact(x, Y, def); x += g; }
    // каверны-сцены — широкие эллипсы (в них ВХОДЯТ, а не копают): 3 вида, разнесены, вскрываются у поверхности
    ['city', 'machine', 'idol'].forEach((kind, i) => this._sbBackdrop(SANDBOX_ROW_X0 + 8 + i * 40, SANDBOX_BACK_Y, kind));
    this.world.mines = this.world.traps.filter((t) => t.type === 'mine');      // фильтр-ссылка (drawMines)
  },
  _sbMark(tx, ty, key, obj) {
    const t = this.world.tiles[ty * MAP_W + wrapX(tx)];
    t.type = ROCK; t.dig = 0; t.resource = null; t.dens = 1; t.hardness = SANDBOX_SHELF_HARD; t[key] = obj;
  },
  _sbTrap(tx, ty, type) {
    const o = { tx: wrapX(tx), ty, type, dug: false, triggered: false };
    if (type === 'mine') { o.state = 'buried'; o.t = 0; o.defused = false; }
    this.world.traps.push(o); this._sbMark(tx, ty, 'trap', o);
  },
  _sbRobot(tx, ty, kind) {
    const o = { tx: wrapX(tx), ty, kind, dug: false, state: 'buried', t: 0, fired: 0, fireT: 0, scan: 0, scanned: false, defused: false, seed: 1.7 };
    this.world.robots.push(o); this._sbMark(tx, ty, 'robot', o);
  },
  _sbServer(tx, ty) {
    const o = { tx: wrapX(tx), ty, dug: false, data: 0, done: false };
    this.world.servers.push(o); this._sbMark(tx, ty, 'server', o);
  },
  _sbContainer(tx, ty, type) {
    const o = { tx: wrapX(tx), ty, dug: false, breach: 0, opened: false, type, amount: (CONTAINER_LOOT[type] || { max: 3 }).max };
    this.world.containers.push(o); this._sbMark(tx, ty, 'container', o);
  },
  _sbArtifact(tx, ty, def) {
    const o = { tx: wrapX(tx), ty, w: 2, h: 1, tech: def, dug: false, resolved: false };
    this.world.artifacts.push(o);
    for (let dx = 0; dx < o.w; dx++) this._sbMark(tx + dx, ty, 'artifact', o);
  },
  _sbBackdrop(cx, cy, kind) {
    const o = { cx: wrapX(cx), cy, rx: 4, ry: 3, floorY: cy + 3, kind, seed: 1234, scanned: false, scanning: false, sweepT: 0, reveal: 0 };
    this.world.backdrops.push(o);
    for (let dy = -o.ry; dy <= o.ry; dy++) for (let dx = -o.rx; dx <= o.rx; dx++)   // вырезать воздушный эллипс каверны
      if ((dx * dx) / (o.rx * o.rx) + (dy * dy) / (o.ry * o.ry) <= 1) { const t = this.world.tiles[(cy + dy) * MAP_W + wrapX(cx + dx)]; if (t) t.type = AIR; }
  },

  // ── ОТРИСОВКА (debug-подписи типов + баннер хоткеев) ──
  drawSandboxLabels(ctx, camera) {
    if (!this.sandbox || !this.world) return;
    ctx.save(); ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const lab = (tx, ty, text, col) => {
      const stag = (((Math.round(tx / SANDBOX_ROW_GAP) % 3) + 3) % 3) * 12;   // 3 уровня высоты — плотные подписи не наслаиваются
      const sx = Math.round(camera.screenX(tx * TILE + TILE / 2)), sy = Math.round(ty * TILE - camera.y) - 2 - stag;
      const tw = ctx.measureText(text).width;
      if (stag > 0) { ctx.strokeStyle = 'rgba(200,226,90,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, sy + 1); ctx.lineTo(sx, sy + 1 + stag); ctx.stroke(); }   // выносная черта к объекту
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - tw / 2 - 2, sy - 9, tw + 4, 10);
      ctx.fillStyle = col; ctx.fillText(text, sx, sy);
    };
    for (const t of this.world.traps) lab(t.tx, t.ty, t.type.toUpperCase(), '#e0a040');
    for (const r of this.world.robots) lab(r.tx, r.ty, r.kind.toUpperCase(), '#ff6a4a');
    for (const s of this.world.servers) lab(s.tx, s.ty, 'СЕРВЕР', '#7fb0e0');
    for (const k of this.world.containers) lab(k.tx, k.ty, 'КОНТ:' + k.type, '#e0b048');
    for (const a of this.world.artifacts) lab(a.tx, a.ty, a.tech.id, '#c264e0');
    for (const b of this.world.backdrops) lab(b.cx, b.cy - b.ry, 'СЦЕНА:' + b.kind, '#9ad0a0');
    const st = this._sandboxSpawnTile(); lab(st.x, st.y, '⚑ СПАВН ВРАГА', '#e0664a');   // точка спавна врагов (20 тайлов левее города)
    ctx.restore();
  },
  drawSandboxHud(ctx, W, H) {
    if (!this.sandbox) return;
    ctx.save(); ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#c8e25a';
    ctx.fillText('ПОЛИГОН ОБЪЕКТОВ · R сброс · F обезвреж.(' + (this._sandboxDefuse ? 'ВКЛ' : 'ВЫКЛ') + ') · Esc → меню', W / 2, H - 10);
    ctx.restore();
  },

  // ── ПАНЕЛЬ СПАВНА ВРАГОВ (справа) ──
  _sandboxSpawnTile() { return { x: wrapX(Math.round((CAVE_X0 + CAVE_X1) / 2) - 20), y: SPAWN_Y }; },   // 20 тайлов ЛЕВЕЕ города
  _sandboxSpawnEnemy(type) {
    if (!this.enemies) this.enemies = [];
    const s = this._sandboxSpawnTile();
    const e = new Enemy(s.x, s.y, type, s.x, s.y, 2);   // дом = точка спавна; мозг сам целит базу/юнита
    if (type === 'digger') e.sweepSign = 1;
    this.enemies.push(e);
  },
  sandboxSpawnClick(x, y) {   // ЛКМ по кнопке панели → спавн 1 юнита (без лимитов — можно спамить)
    if (!this.sandbox || !this._sandboxSpawnRects) return false;
    for (const b of this._sandboxSpawnRects) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this._sandboxSpawnEnemy(b.type); return true; }
    return false;
  },
  drawSandboxSpawnPanel(ctx, W, H) {
    if (!this.sandbox) return;
    const types = SANDBOX_ENEMY_TYPES, bw = 128, bh = 17, gap = 2, pad = 5, hdr = 13;
    const ph = pad + hdr + types.length * (bh + gap) + pad, x0 = W - bw - 8, y0 = 118;
    const mx = this.menuMouse ? this.menuMouse.x : -1, my = this.menuMouse ? this.menuMouse.y : -1;
    ctx.save(); ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(16,10,10,0.9)'; ctx.fillRect(x0, y0, bw, ph);
    ctx.strokeStyle = 'rgba(200,60,45,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, ph - 1);
    ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.fillStyle = '#e0664a';
    ctx.fillText('// СПАВН ВРАГА · ' + ((this.enemies && this.enemies.length) || 0), x0 + pad, y0 + hdr / 2 + 4);
    this._sandboxSpawnRects = [];
    let by = y0 + hdr + 2;
    for (const t of types) {
      const bx = x0 + pad, w = bw - pad * 2, hover = mx >= bx && mx <= bx + w && my >= by && my <= by + bh;
      this._sandboxSpawnRects.push({ x: bx, y: by, w, h: bh, type: t });
      ctx.fillStyle = hover ? 'rgba(200,60,45,0.24)' : 'rgba(30,18,18,0.7)'; ctx.fillRect(bx, by, w, bh);
      ctx.strokeStyle = hover ? '#e0664a' : 'rgba(120,60,50,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, bh - 1);
      ctx.textAlign = 'left'; ctx.fillStyle = hover ? '#ffd0c0' : '#d8b0a8';
      ctx.fillText((typeof ENEMY_RU !== 'undefined' && ENEMY_RU[t]) || t.toUpperCase(), bx + 6, by + bh / 2 + 0.5);
      const cnt = this.enemies ? this.enemies.reduce((n, e) => n + (e.type === t && !e.dead && !e.dying ? 1 : 0), 0) : 0;   // живых этого типа (перф-тест)
      if (cnt) { ctx.textAlign = 'right'; ctx.fillStyle = '#ff9a4a'; ctx.fillText('' + cnt, bx + w - 6, by + bh / 2 + 0.5); }
      by += bh + gap;
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
  },
});
