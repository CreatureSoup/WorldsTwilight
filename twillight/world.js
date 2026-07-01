'use strict';

// World — карта, тайлы, слои, генерация. Стартовый город — в фиксированной пещере;
// мир закольцован по горизонтали (X) и генерится из seed (разнообразие за сессию).
const CITY_NAMES = ['Гелон', 'Тартесс', 'Аркаим', 'Мероэ', 'Кахокия', 'Нан-Мадол'];

class World {
  constructor(seed) {
    this.w = MAP_W; this.h = MAP_H;
    this.seed = ((seed == null ? (Math.random() * 1e9) : seed) >>> 0) || 1;
    this._s = this.seed;
    this.tiles = new Array(MAP_W * MAP_H);
    this.seen = new Uint8Array(MAP_W * MAP_H); // туман войны
    this.revealT = new Uint8Array(MAP_W * MAP_H); // 0..255 плавное проявление seen-тайлов (сглаживание открытия тумана)
    this.caverns = [];                          // дружественные чужие города
    this.wilds = [];                            // дикие города-гнёзда (источники волн)
    this.backdrops = [];                        // большие пещеры-сцены с фоном-объектом (объёмный скан)
    this.radSources = [];                       // очаги сильной радиации (помехи интерфейсу)
    this.servers = [];                          // старые серверы в породе — источники данных
    this.artifacts = [];                        // большие погребённые объекты — откопал → модалка (технология/данные/переработка)
    this.unstableTriggers = [];                 // очередь «потеряла опору» (setAir → клетка сверху), читает falling.js
    this.generate();
  }

  // seeded PRNG (mulberry32) — для размещения пещер.
  rand() {
    this._s = (this._s + 0x6D2B79F5) | 0;
    let t = Math.imul(this._s ^ (this._s >>> 15), 1 | this._s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Хэш-шум, замешан с seed → мир уникален за сессию.
  hash(a, b) {
    let h = (a * 374761393 + b * 668265263 + this.seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  tileNoise(x, y) { return this.hash(x, y); }
  // Периодический value-noise: бесшовен по кольцу X (lattice wraps на MAP_W/scale).
  pnoise(x, y, scale) {
    const P = Math.round(MAP_W / scale);
    const lx = x / scale, ly = y / scale;
    const xi = Math.floor(lx), yi = Math.floor(ly), tx = lx - xi, ty = ly - yi;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const wp = (a) => ((a % P) + P) % P;
    const c = (a, b) => this.hash(wp(a) * 131 + 9, b * 97 + 5);
    const top = c(xi, yi) * (1 - sx) + c(xi + 1, yi) * sx;
    const bot = c(xi, yi + 1) * (1 - sx) + c(xi + 1, yi + 1) * sx;
    return top * (1 - sy) + bot * sy;
  }

  isSeen(x, y) {
    if (y < 0 || y >= MAP_H) return false;
    return this.seen[y * MAP_W + wrapX(x)] === 1;
  }
  // Обзор КРУГОМ (Euclidean): радиус R тайлов вокруг (cx,cy). Целые тайлы (R округляем — дробный r напр. 3.5
  // при вскрытии базы дал бы нецелые индексы Uint8Array → запись в пустоту → интро на чёрном фоне).
  reveal(cx, cy, r) {
    const R = Math.max(0, Math.round(r)), r2 = R * R + R + 0.25;   // (R+0.5)² — диск ВКЛЮЧАЕТ диагонали (R=1 → 3×3, не «крест»); на больших R срезает дальние углы (круг)
    const y0 = Math.max(0, cy - R), y1 = Math.min(MAP_H - 1, cy + R);
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r2) this.seen[y * MAP_W + wrapX(cx + dx)] = 1;
    }
  }
  hardnessForY(y) {
    if (y < CAVE_Y0) {                          // НАД городом: 4 страты погребённой цивилизации
      if (y <= CEIL_BANDS[0]) return 1.6;       // пепел (поверхностная зола)
      if (y <= CEIL_BANDS[1]) return 1.3;       // ржавчина (окислы)
      if (y <= CEIL_BANDS[2]) return 1.5;       // завал (спрессованные руины — плотнее)
      return 1.0;                               // перегной (мягкий слой у города)
    }
    if (y <= MAP_H * 0.5) return 1.5;
    if (y <= MAP_H * 0.78) return 2.5;
    return 4.0;
  }
  layerName(y) {
    if (y < SURFACE_ROWS) return STR.hud.strata.surface;
    for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return STR.hud.strata.rubble;
    if (y < CAVE_Y0) {                          // страты НАД городом (погребённая цивилизация)
      if (y <= CEIL_BANDS[0]) return STR.hud.strata.ash;
      if (y <= CEIL_BANDS[1]) return STR.hud.strata.rust;
      if (y <= CEIL_BANDS[2]) return STR.hud.strata.rubble;
      return STR.hud.strata.humus;
    }
    if (y <= CAVE_FLOOR_Y) return STR.hud.strata.city;
    if (y >= CRUST_Y0 && y <= CRUST_Y1) return STR.hud.strata.crust;
    if (y <= MAP_H * 0.5) return STR.hud.strata.upper;
    if (y <= MAP_H * 0.78) return STR.hud.strata.middle;
    return STR.hud.strata.deep;
  }
  // Стартовая пещера — ОРГАНИЧНАЯ: плоский пол (нижние ряды — функционал базы: принтер/спавн/фундамент) +
  // куполообразный потолок (полу-эллипс) с лёгкой шероховатостью кромки. Детерминированно (tileNoise по x,y)
  // → одинаково на генерации и в рантайме.
  inCave(x, y) {
    if (x < CAVE_X0 || x > CAVE_X1 || y < CAVE_Y0 || y > CAVE_Y1) return false;
    if (y >= CAVE_Y1 - 1) return true;                         // плоский пол (нижние 2 ряда)
    const cx = (CAVE_X0 + CAVE_X1) / 2, fy = CAVE_Y1 - 1;
    const nx = (x - cx) / ((CAVE_X1 - CAVE_X0) / 2 + 0.5), ny = (y - fy) / ((fy - CAVE_Y0) + 0.5);
    const wob = (this.tileNoise(x * 2 + 5, y * 2 + 3) - 0.5) * 0.22;   // рваная кромка купола
    return nx * nx + ny * ny <= 1 + wob;
  }

  // тороидальная дистанция по X в тайлах
  torDist(a, b) { const d = Math.abs(a - b) % MAP_W; return Math.min(d, MAP_W - d); }
  torDist2D(x1, y1, x2, y2) { const dx = this.torDist(x1, x2), dy = y1 - y2; return Math.hypot(dx, dy); }   // дистанция точка-точка по кольцу (X-тор, Y прямой)
  // ВЕРХНЯЯ СТРАТА (погребённая цивилизация НАД городом): диапазон засева тематических объектов (данные/руины/старые защиты).
  _upperBand() { return [SURFACE_ROWS + 4, CAVE_FLOOR_Y - 4]; }
  // Ряд-БАРЬЕР (не сеем спецобъекты): главная корка пола + ПОТОЛОЧНЫЕ крусты (барьеры подъёма к поверхности).
  _blockedSeedRow(y) {
    if (y >= CRUST_Y0 && y <= CRUST_Y1) return true;
    if (typeof CEILING_CRUSTS !== 'undefined') for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return true;
    return false;
  }
  inEllipseList(x, y, list) {
    for (const c of list) {
      const dx = wrapDeltaPx(x * TILE, c.cx * TILE) / TILE, dy = y - c.cy;
      if ((dx * dx) / (c.rx * c.rx) + (dy * dy) / (c.ry * c.ry) <= 1) return true;
    }
    return false;
  }
  inCavern(x, y) { return this.inEllipseList(x, y, this.caverns); }
  inWild(x, y) { return this.inEllipseList(x, y, this.wilds); }
  inBackdrop(x, y) { return this.inEllipseList(x, y, this.backdrops); }
  // большие пещеры-сцены: эллипс-полости НИЖЕ города, разнесены по тору, с фоном-объектом + сидом
  genBackdrops() {
    const H = MAP_H, list = [];
    const bands = [[CAVE_FLOOR_Y + 14, Math.floor(H * 0.55)], [Math.floor(H * 0.55), Math.floor(H * 0.78)], [Math.floor(H * 0.78), H - 8]];
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    // ТЕСТ: гарантированная пещера-сцена рядом с базой (быстро докопаться и проверить объёмный скан). Убрать перед релизом.
    list.push({ cx: wrapX(Math.round(startCx) + 14), cy: CAVE_FLOOR_Y + 7, rx: 4, ry: 3, floorY: CAVE_FLOOR_Y + 10, kind: 'idol', seed: 1234, scanned: false, scanning: false, sweepT: 0, reveal: 0 });
    const avoid = this.caverns.concat(this.wilds).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]).concat(list.map((b) => ({ cx: b.cx, cy: b.cy })));
    const kinds = ['city', 'machine', 'idol'];
    const place = (band, i) => {
      let placed = null;
      for (let tries = 0; tries < 50 && !placed; tries++) {
        const x = Math.floor(this.rand() * MAP_W), y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        if (this.inCave(x, y) || this.inCavern(x, y) || this.inWild(x, y) || this.inBackdrop(x, y)) continue;
        if (this._blockedSeedRow(y)) continue;
        if (avoid.some((a) => this.torDist(x, a.cx) < 20 && Math.abs(y - a.cy) < 16)) continue;
        placed = { cx: x, cy: y };
      }
      if (!placed) return;
      const rx = BACKDROP_RX[0] + Math.floor(this.rand() * (BACKDROP_RX[1] - BACKDROP_RX[0] + 1));
      const ry = BACKDROP_RY[0] + Math.floor(this.rand() * (BACKDROP_RY[1] - BACKDROP_RY[0] + 1));
      list.push({ cx: placed.cx, cy: placed.cy, rx, ry, floorY: placed.cy + ry, kind: kinds[i % kinds.length], seed: (this.rand() * 1e9) >>> 0, scanned: false, scanning: false, sweepT: 0, reveal: 0 });
      avoid.push({ cx: placed.cx, cy: placed.cy });   // следующие держатся подальше
    };
    for (let i = 0; i < BACKDROP_COUNT; i++) place(bands[i % bands.length], i);   // ГЛУБОКИЕ сцены
    const up = this._upperBand(); for (let i = 0; i < BACKDROP_UP; i++) place(up, i);   // ВЕРХНЯЯ страта (руины-сцены)
    return list;
  }
  // Размещение в эллипс-бэндах глубины с разносом 2D (далеко по X ИЛИ по глубине).
  placeNest(bands, count, avoid) {
    const list = [];
    for (let i = 0; i < count; i++) {
      const band = bands[i % bands.length];
      let cx = -1, cy = 0;
      for (let tries = 0; tries < 100; tries++) {
        const x = Math.floor(this.rand() * MAP_W);
        const y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        const far = avoid.concat(list).every((a) => this.torDist(x, a.cx) >= CITY_MIN_GAP_X || Math.abs(y - a.cy) >= 14);
        if (far) { cx = x; cy = y; break; }
      }
      if (cx < 0) { cx = wrapX(Math.round(this.rand() * MAP_W)); cy = band[0] + ((band[1] - band[0]) >> 1); }
      const rx = 5 + Math.floor(this.rand() * 3), ry = 3 + Math.floor(this.rand() * 2);
      list.push({ cx, cy, rx, ry, floorY: cy + ry });
    }
    return list;
  }
  // Нейтральные (спящие) чужие города. `awoken`/`hackT` — состояние взлома (hack.js): спят, пока юнит не
  // взломает сердце (модуль взлома) у центра → пробуждение в автономную фракцию.
  genCaverns() {
    const H = MAP_H;
    const bands = [[H * 0.45, H * 0.57], [H * 0.60, H * 0.72], [H * 0.75, H * 0.87]].map((b) => [Math.round(b[0]), Math.round(b[1])]);   // ниже опущенного города
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    const list = this.placeNest(bands, OTHER_CITIES, [{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    return list.map((c, i) => ({ ...c, name: CITY_NAMES[i % CITY_NAMES.length], awoken: false, hackT: 0 }));
  }
  // Дикие города-гнёзда: глубже, разнесены от старта, дружественных и друг друга.
  genWilds() {
    const H = MAP_H;
    const bands = [[H * 0.48, H * 0.64], [H * 0.70, H * 0.88]].map((b) => [Math.round(b[0]), Math.round(b[1])]);   // глубже города
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    const avoid = this.caverns.map((c) => ({ cx: c.cx, cy: c.cy })).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    return this.placeNest(bands, WILD_NESTS, avoid).map((w) => ({ ...w, hp: WILD_HP, maxHp: WILD_HP, loot: 0, charge: 0 }));
  }

  // Старые серверы — точечные источники данных, вкраплённые в породу (не в пещерах/крусте).
  // Каждый: {tx,ty, dug, data(0..1), done}. Тайл сервера делается ПОРОДОЙ (копается); найти —
  // по маркеру в раскрытой туманом породе. Разнесены по тору 2D друг от друга и от городов.
  genServers() {
    const H = MAP_H, list = [];
    const bands = [[Math.round(H * 0.45), Math.round(H * 0.62)], [Math.round(H * 0.66), Math.round(H * 0.97)]];   // ниже города, до ~дна
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    // ТЕСТ: гарантированный сервер у базы — пара тайлов вниз от пола стартовой пещеры (быстро дотянуться
    // и проверить дайджест dig→хлам→скан без глубокой копки). Сдвиг по X от принтера → не в фундаменте.
    list.push({ tx: wrapX(Math.round(startCx) + 4), ty: CAVE_FLOOR_Y + 3, dug: false, data: 0, done: false });
    const avoid = this.caverns.concat(this.wilds).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    const place = (band) => {
      for (let tries = 0; tries < 120; tries++) {
        const x = Math.floor(this.rand() * MAP_W), y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        if (this.inCave(x, y) || this.inCavern(x, y) || this.inWild(x, y) || this.inBackdrop(x, y)) continue;
        if (this._blockedSeedRow(y)) continue;
        const farCity = avoid.every((a) => this.torDist(x, a.cx) >= 5 || Math.abs(y - a.cy) >= 6);
        const farSrv = list.every((s) => this.torDist2D(x, y, s.tx, s.ty) >= SERVER_MIN_DIST);   // 2D-дистанция: не липнут по диагонали
        if (farCity && farSrv) { list.push({ tx: wrapX(x), ty: y, dug: false, data: 0, done: false }); return; }
      }
    };
    for (let i = 0; i < SERVER_COUNT; i++) place(bands[i % bands.length]);   // ГЛУБОКИЕ серверы
    const up = this._upperBand(); for (let i = 0; i < SERVER_UP; i++) place(up);   // ВЕРХНЯЯ страта (архивы данных)
    return list;
  }
  // Артефакты: продолговатый регион ПОРОДЫ (2×1 ИЛИ 1×2 — ориентация случайна, маркер `t.artifact`),
  // разнесены по тору и от городов/серверов/пещер. Каждому — случайная технология из пула (для модалки).
  genArtifacts() {
    const H = MAP_H, list = [];
    const avoid = this.caverns.concat(this.wilds);
    // НАБОР из пула БЕЗ ПОВТОРОВ (Фишер-Йейтс на seed-rand) → каждая сессия даёт разный состав по мере роста пула.
    const pool = ARTIFACT_POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    const picks = pool.slice(0, Math.min(ARTIFACT_SEED_COUNT + ARTIFACT_SEED_UP, pool.length));
    const up = this._upperBand();
    picks.forEach((def, idx) => {
      const upper = idx < ARTIFACT_SEED_UP;   // ПЕРВЫЕ ARTIFACT_SEED_UP — в верхнюю страту (человеческое техно над городом)
      const horiz = this.rand() < 0.5, w = horiz ? ARTIFACT_LONG : 1, h = horiz ? 1 : ARTIFACT_LONG;
      const band = upper ? up : (def.tier === 'rare' ? [Math.round(H * 0.78), Math.round(H * 0.97)] : [Math.round(H * 0.5), Math.round(H * 0.78)]);   // редкий — ГЛУБЖЕ (опаснее добыть), до ~дна
      let ax = -1, ay = 0;
      for (let tries = 0; tries < 200; tries++) {
        const x = Math.floor(this.rand() * MAP_W), y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        if (y + h >= MAP_H - 2) continue;
        let ok = true;
        for (let dy = 0; dy < h && ok; dy++) for (let dx = 0; dx < w && ok; dx++) {
          const xx = x + dx, yy = y + dy;
          if (this.inCave(xx, yy) || this.inCavern(xx, yy) || this.inWild(xx, yy) || this.inBackdrop(xx, yy)) ok = false;
          else if (this._blockedSeedRow(yy)) ok = false;
          else if (this.tiles[yy * MAP_W + wrapX(xx)].server) ok = false;
        }
        if (!ok) continue;
        const farCity = avoid.every((a) => this.torDist(x, a.cx) >= 6 || Math.abs(y - a.cy) >= 7);
        const farOther = list.every((o) => this.torDist2D(x, y, o.tx, o.ty) >= ARTIFACT_MIN_DIST);   // 2D ≥ 2×RAD_SOURCE_R → очаги радиации не перекрываются
        if (farCity && farOther) { ax = x; ay = y; break; }
      }
      if (ax >= 0) list.push({ tx: wrapX(ax), ty: ay, w, h, tech: def, dug: false, resolved: false });
      else console.warn('genArtifacts: не удалось разместить артефакт', def.id, '(тесно/много объектов)');   // тихий пропуск → меньше артефактов; диагностика
    });
    return list;
  }
  // Погребённые опасные объекты (1 тайл, маркер t.robot / t.mine; всегда копаются). Останки роботов —
  // боевой протокол при откопке; старые мины — взрыв. Разнесены по тору и от городов/серверов/артефактов.
  // `extraAvoid` — уже размещённые ОПАСНОСТИ другого типа (роботы/ловушки/мины): держим `HAZARD_MIN_DIST` ОТ НИХ ТОЖЕ
  // (единый пул) → ловушки и останки роботов не липнут друг к другу. Тест-объект у базы дистанцию не проверяет (форсирован).
  // `upCount`/`upBand` — ДОП. посев в ВЕРХНЕЙ страте (старые защиты погребённой цивилизации); единый `list` →
  // спейсинг (`HAZARD_MIN_DIST`) и кросс-тип покрывают верх+глубину вместе. Крусты (вкл. потолочные) — барьеры, не сеем.
  _genHazard(count, band, testDx, make, extraAvoid, upCount, upBand) {
    const list = [], startCx = (CAVE_X0 + CAVE_X1) / 2;
    const avoid = this.caverns.concat(this.wilds).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    const others = extraAvoid || [];
    list.push(make(wrapX(Math.round(startCx) + testDx), CAVE_FLOOR_Y + 3));   // ТЕСТ у базы (быстро найти/проверить)
    const place = (n, bnd) => {
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 120; tries++) {
        const x = Math.floor(this.rand() * MAP_W), y = bnd[0] + Math.floor(this.rand() * (bnd[1] - bnd[0] + 1));
        if (this.inCave(x, y) || this.inCavern(x, y) || this.inWild(x, y) || this.inBackdrop(x, y)) continue;
        if (this._blockedSeedRow(y)) continue;
        const t = this.tiles[y * MAP_W + wrapX(x)];
        if (t.server || t.artifact || t.robot || t.trap) continue;
        const farCity = avoid.every((a) => this.torDist(x, a.cx) >= 5 || Math.abs(y - a.cy) >= 6);
        const farHaz = list.every((h) => this.torDist2D(x, y, h.tx, h.ty) >= HAZARD_MIN_DIST) && others.every((h) => this.torDist2D(x, y, h.tx, h.ty) >= HAZARD_MIN_DIST);   // 2D от своих И чужих опасностей
        if (farCity && farHaz) { list.push(make(wrapX(x), y)); break; }
      }
    };
    place(count, band);                          // ГЛУБОКИЕ
    if (upCount && upBand) place(upCount, upBand);   // ВЕРХНЯЯ страта
    return list;
  }
  genRobots() { const RK = ['shooter', 'shooter', 'web', 'latch', 'jam', 'brood']; return this._genHazard(ROBOT_COUNT, [Math.round(MAP_H * 0.46), Math.round(MAP_H * 0.97)], 8,
    (tx, ty) => ({ tx, ty, kind: RK[Math.floor(this.rand() * RK.length)], dug: false, state: 'buried', t: 0, fired: 0, fireT: 0, scan: 0, scanned: false, defused: false, seed: this.rand() * 6.283 }), null, ROBOT_UP, this._upperBand()); }
  // ЛОВУШКИ (ЕДИНЫЙ тип): маркер `t.trap` (всегда копается); тип вперемешку. МИНА — ОДИН ИЗ типов пула (своя стейт-машина
  // dug→blink→взрыв в traps.js, поля state/t/defused; `world.mines`=фильтр type==='mine' для drawMines). Откоп `setAir` → `trap.dug` → срабатывание.
  genTraps(extraAvoid) {
    const TT = ['acid', 'seismic', 'cavein', 'mine'];   // мина — равноправный тип ловушки (~1/4); brood переехал в останки роботов (robot.kind)
    const make = (tx, ty) => { const type = TT[Math.floor(this.rand() * TT.length)], o = { tx, ty, type, dug: false, triggered: false }; if (type === 'mine') { o.state = 'buried'; o.t = 0; o.defused = false; } return o; };
    return this._genHazard(TRAP_COUNT, TRAP_BAND, 11, make, extraAvoid, TRAP_UP, this._upperBand());
  }

  // ── РЕСУРСЫ (зовётся из generate() ПОСЛЕ кладки породы, ДО спецобъектов — те затирают resource на своих тайлах).
  // КАРКАС ПОКРЫТИЯ (jittered-grid зёрен) + ЖЕЛЕЗО-ЖИЛЫ / ОРГАНИКА-КАРМАНЫ (размер РАСТЁТ С ГЛУБИНОЙ) / КРИСТАЛЛ-ОДИНОЧКИ.
  _seedResources() {
    this._seedCoverageGrid();   // КАРКАС: одно зерно на ячейку (джиттер) → ГАРАНТИЯ покрытия, нет мёртвых зон. ДО залежей → залежи перекрывают.
    // ЖЕЛЕЗО — ЖИЛЫ: базовая длина × глубинный множитель (чем глубже от старта, тем протяжённее), до IRON_VEIN_CAP.
    for (let i = 0; i < IRON_VEINS; i++) {
      const x = Math.floor(this.rand() * MAP_W), y = SURFACE_ROWS + Math.floor(this.rand() * (MAP_H - SURFACE_ROWS - 1));
      if (!this._isPlainRock(x, y)) continue;
      const base = IRON_VEIN_LEN[0] + Math.floor(this.rand() * (IRON_VEIN_LEN[1] - IRON_VEIN_LEN[0] + 1));
      this._stampVein(x, y, 'iron', Math.min(IRON_VEIN_CAP, Math.round(base * this._depthRich(y))));
    }
    // ОРГАНИКА — КАРМАНЫ: базовый размер × глубинный множитель (глубже — крупнее), до ORGANIC_BLOB_CAP.
    for (let i = 0; i < ORGANIC_BLOBS; i++) {
      const x = Math.floor(this.rand() * MAP_W), y = SURFACE_ROWS + Math.floor(this.rand() * (MAP_H - SURFACE_ROWS - 1));
      if (!this._isPlainRock(x, y)) continue;
      const base = ORGANIC_BLOB_SIZE[0] + Math.floor(this.rand() * (ORGANIC_BLOB_SIZE[1] - ORGANIC_BLOB_SIZE[0] + 1));
      this._stampBlob(x, y, 'organic', Math.min(ORGANIC_BLOB_CAP, Math.round(base * this._depthRich(y))));
    }
    for (let i = 0; i < CRYSTAL_DEPOSITS; i++) {
      // ГЛУБИННЫЙ БИАС (sqrt тянет выборку к НИЗУ карты): РЕДКО в верхних стратах / у базы — ранний доступ ЕСТЬ,
      // ГУСТО глубоко. Раньше был жёсткий обрез (только y≥137) → кристалл недосягаем на ранних этапах (исправлено).
      const x = Math.floor(this.rand() * MAP_W), y = SURFACE_ROWS + Math.floor(Math.sqrt(this.rand()) * (MAP_H - SURFACE_ROWS - 1));
      if (!this._isPlainRock(x, y) || this._hasResNear(x, y, 'crystal', 1)) continue;   // ОДИНОЧКА: НИКОГДА не вплотную к другому кристаллу (и совпадением тоже)
      this._stampRes(x, y, 'crystal');
      if (this.rand() < CRYSTAL_PAIR_CHANCE) {   // супер-редко: второй кристалл РЯДОМ, но НЕ вплотную — направление×зазор даёт Чебышёв 2-3 (нет 8-соседства)
        const gap = CRYSTAL_PAIR_GAP[0] + Math.floor(this.rand() * (CRYSTAL_PAIR_GAP[1] - CRYSTAL_PAIR_GAP[0] + 1));
        const dir = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][Math.floor(this.rand() * 8)];
        const x2 = wrapX(x + dir[0] * gap), y2 = y + dir[1] * gap;
        if (this._isPlainRock(x2, y2) && !this._hasResNear(x2, y2, 'crystal', 1)) this._stampRes(x2, y2, 'crystal');
      }
    }
  }
  // КАРКАС ПОКРЫТИЯ (jittered-grid / стратифицированная сетка): РОВНО одно зерно на ячейку RES_CELL×RES_CELL со
  // случайным смещением RES_JIT → ГАРАНТИЯ, что из любой точки ближайший ресурс ≤ ~RES_CELL·1.4 (нет «мёртвых зон»
  // на 2+ ходки), но без видимой сетки. Невалидный тайл (воздух/корка/спецобъект) → ищем валидную породу В ЯЧЕЙКЕ
  // (иначе зазор не гарантирован); вся ячейка пустая (каверна) → пропуск (в пустоте скуки нет — юнит идёт быстро).
  // ⚠️ глобальный this.rand() (gen — один проход, детерминирован сидом; чанк-стриминга нет → пер-ячейковый хэш не нужен).
  _seedCoverageGrid() {
    const cols = Math.round(MAP_W / RES_CELL), cw = MAP_W / cols, rows = Math.ceil((MAP_H - SURFACE_ROWS) / RES_CELL);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      const x0 = cx * cw, y0 = SURFACE_ROWS + cy * RES_CELL;
      let tx = wrapX(Math.floor(x0 + (0.5 + RES_JIT * (this.rand() - 0.5)) * cw));
      let ty = Math.min(MAP_H - 2, Math.floor(y0 + (0.5 + RES_JIT * (this.rand() - 0.5)) * RES_CELL));
      if (!this._isPlainRock(tx, ty)) {   // нудж к валидной породе В ТОЙ ЖЕ ячейке (сохраняет границу зазора)
        let ok = false;
        for (let k = 0; k < 6 && !ok; k++) { const nx = wrapX(Math.floor(x0 + this.rand() * cw)), ny = Math.min(MAP_H - 2, Math.floor(y0 + this.rand() * RES_CELL)); if (this._isPlainRock(nx, ny)) { tx = nx; ty = ny; ok = true; } }
        if (!ok) continue;
      }
      this._stampRes(tx, ty, this.rand() < GRAIN_ORGANIC_P ? 'organic' : 'iron');
    }
  }
  // множитель «богатства» залежи от глубины НИЖЕ стартового слоя: 1.0 у города → DEPTH_RICH_MAX на DEPTH_RICH_SPAN
  // ниже (ЛИНЕЙНО, с потолком — НЕ экспонента). Выше города (страты) — база (f=1). Кормит длину жил / размер карманов.
  _depthRich(y) {
    const f = Math.min(1, Math.max(0, (y - CAVE_FLOOR_Y) / DEPTH_RICH_SPAN));
    return 1 + (DEPTH_RICH_MAX - 1) * f;
  }
  // тайл годен под залежь: обычная порода (не корка/спецобъект/пустота/прокоп), ниже неба
  _isPlainRock(x, y) {
    if (y < SURFACE_ROWS || y >= MAP_H - 1) return false;
    const t = this.tiles[y * MAP_W + wrapX(x)];
    if (!t || t.type !== ROCK || t.dug || t.server || t.artifact || t.robot || t.trap || t.boulder) return false;
    if (y >= CRUST_Y0 && y <= CRUST_Y1) return false;
    for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return false;
    return true;
  }
  // есть ли ресурс данного типа в радиусе r (Чебышёв) — для запрета соседства кристаллов-одиночек
  _hasResNear(x, y, type, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const yy = y + dy; if (yy < 0 || yy >= MAP_H) continue;
      const t = this.tiles[yy * MAP_W + wrapX(x + dx)];
      if (t && t.resource === type) return true;
    }
    return false;
  }
  _stampRes(x, y, type) {
    const t = this.tiles[y * MAP_W + wrapX(x)]; if (!t) return;
    t.resource = type; t.amount = RES_AMOUNT_MIN + Math.floor(this.rand() * (RES_AMOUNT_MAX - RES_AMOUNT_MIN + 1));   // 1..3 в тайле
  }
  // ЖИЛА: направленный random-walk с лёгким поворотом ±45°, редким перпенд. «вздутием» и короткой веткой
  _stampVein(sx, sy, type, len) {
    const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let di = Math.floor(this.rand() * 8), x = sx, y = sy;
    for (let i = 0; i < len; i++) {
      if (!this._isPlainRock(x, y)) break;
      this._stampRes(x, y, type);
      if (this.rand() < 0.35) { const p = D[(di + 2) % 8]; if (this._isPlainRock(x + p[0], y + p[1])) this._stampRes(x + p[0], y + p[1], type); }   // толщина
      if (i > 0 && this.rand() < 0.18) {   // короткая боковая ветка
        const b = D[(di + (this.rand() < 0.5 ? 2 : 6)) % 8]; let bx = x, by = y;
        for (let k = 0; k < 2; k++) { bx = wrapX(bx + b[0]); by += b[1]; if (!this._isPlainRock(bx, by)) break; this._stampRes(bx, by, type); }
      }
      if (this.rand() < 0.4) di = (di + (this.rand() < 0.5 ? 1 : 7)) % 8;   // поворот ±45°
      x = wrapX(x + D[di][0]); y += D[di][1];
    }
  }
  // КАРМАН: рост от фронтира случайными соседями (округлая амёба)
  _stampBlob(sx, sy, type, size) {
    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    const seen = new Set(), key = (x, y) => wrapX(x) + ',' + y;
    let frontier = [[sx, sy]], n = 0; seen.add(key(sx, sy));
    while (n < size && frontier.length) {
      const cell = frontier.splice(Math.floor(this.rand() * frontier.length), 1)[0], x = cell[0], y = cell[1];
      if (!this._isPlainRock(x, y)) continue;
      this._stampRes(x, y, type); n++;
      for (const d of NB) { const nx = wrapX(x + d[0]), ny = y + d[1], k = key(nx, ny); if (!seen.has(k) && this.rand() < 0.6) { seen.add(k); frontier.push([nx, ny]); } }
    }
  }
  // Радиационный ФОН у полюсов (0..1) — НЕ урон, а интенсивность помех интерфейсу.
  // Растёт к поверхности (выше города) и ко дну (глубже RAD_BOT_Y); середина «тихая».
  poleRad(y) {
    const top = RAD_TOP_Y > 0 ? Math.max(0, (RAD_TOP_Y - y) / RAD_TOP_Y) : 0;
    const bot = Math.max(0, (y - RAD_BOT_Y) / (MAP_H - RAD_BOT_Y));
    return Math.min(1, Math.max(top, bot));
  }
  // Итоговый фон в точке (0..1): максимум из полюсов и вклада ближайших очагов
  // (в центре очага 1, линейно к нулю на радиусе r) — «гейгер»: ближе очаг — сильнее.
  radAt(x, y) {
    let v = this.poleRad(y);
    for (const s of this.radSources) {
      const dx = this.torDist(x, s.x), dy = y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < s.r) v = Math.max(v, (s.cap || 1) * (1 - d / s.r));   // s.cap<1 — слабый очаг (маяк скверносея, кап 50%); природные без cap → 1
    }
    return Math.min(1, v);
  }

  // Очаги радиации ПРИВЯЗАНЫ К АРТЕФАКТАМ: каждый артефакт «горячий» (детектор загрязнения ведёт к ним).
  // Вызывается ПОСЛЕ genArtifacts (нужен this.artifacts). Центр очага — центр объекта-реликта. Невидимы в
  // мире; «находятся» по нарастанию помех. Радиус прежний (`RAD_SOURCE_R`).
  genRadSources() {
    return this.artifacts.map((a) => ({ x: wrapX(a.tx + (a.w > 1 ? 1 : 0)), y: a.ty + (a.h > 1 ? 1 : 0), r: RAD_SOURCE_R, artifact: a }));
  }

  generate() {
    this.caverns = this.genCaverns();
    this.wilds = this.genWilds();
    this.backdrops = this.genBackdrops();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        let type = AIR, hardness = 0, dens = 0, resource = null;
        if (y === MAP_H - 1) type = BORDER;            // дно (боковых границ нет — кольцо)
        else if (y < SURFACE_ROWS) type = AIR;          // внешняя поверхность
        else if (this.inCave(x, y)) type = AIR;         // стартовый город
        else if (this.inCavern(x, y)) type = AIR;       // дружественные города
        else if (this.inWild(x, y)) type = AIR;         // дикие гнёзда (без фундамента — будущий рейд)
        else if (this.inBackdrop(x, y)) type = AIR;     // большие пещеры-сцены с фоном-объектом
        else {
          type = ROCK;
          let crustHard = null;
          if (y >= CRUST_Y0 && y <= CRUST_Y1) crustHard = CRUST_HARD;
          else for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) { crustHard = c.hard; break; }
          if (crustHard !== null) {                     // корка снизу или кровля сверху — барьер без жил и пустот
            dens = 1; hardness = this.hardnessForY(y) * crustHard;
          } else {
            const zone = this.pnoise(x, y, 4), fine = this.tileNoise(x * 3 + 1, y * 5 + 7);
            dens = Math.min(1, Math.max(0, zone * 0.72 + fine * 0.32 + 0.04));
            hardness = this.hardnessForY(y) * (0.5 + dens);
            // resource засеваем НЕ поштучно — месторождениями (this._seedResources ниже, после кладки)
            // Природные пустоты — только НИЖЕ города (между крустами вверху коридоров не нужно:
            // подъём к поверхности — это копание через барьеры, а не свободный проход).
            if (y > CAVE_FLOOR_Y && this.pnoise(x, y, VOID_SCALE) > VOID_THRESHOLD) { type = AIR; hardness = 0; dens = 0; resource = null; }
          }
        }
        this.tiles[y * MAP_W + x] = { type, hardness, resource, dig: 0, dens };
      }
    this._seedResources();   // РЕСУРСЫ месторождениями (жилы/карманы/кристалл) — ДО спецобъектов (те затирают resource на своих тайлах)
    // Неразрушимый фундамент ТОЛЬКО под самим городом (принтер + площадка спавна;
    // у чужих — под маркером). Остальной пол пещеры — обычная порода (копается).
    this.layFoundation(PRINTER.x - 1, PRINTER.x + PRINTER.w, CAVE_FLOOR_Y + 1);
    for (const c of this.caverns) this.layFoundation(c.cx - 1, c.cx + 1, c.floorY + 1);
    // Серверы: тайл делаем ПОРОДОЙ с маркером `server` (всегда копается, не в пустоте).
    this.servers = this.genServers();
    for (const s of this.servers) {
      const t = this.tiles[s.ty * MAP_W + wrapX(s.tx)];
      t.type = ROCK; t.hardness = this.hardnessForY(s.ty) * 1.2; t.dig = 0; t.resource = null; t.dens = 1; t.server = s;
    }
    // Артефакты: регион ПОРОДЫ с маркером `t.artifact` (всегда копается). ДО genUnstable — их тайлы не помечаем.
    this.artifacts = this.genArtifacts();
    for (const a of this.artifacts)
      for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) {
        const t = this.tiles[(a.ty + dy) * MAP_W + wrapX(a.tx + dx)];
        t.type = ROCK; t.hardness = this.hardnessForY(a.ty) * 1.3; t.dig = 0; t.resource = null; t.dens = 1; t.artifact = a;
      }
    this.radSources = this.genRadSources();   // очаги радиации = центры артефактов (после genArtifacts)
    // Останки роботов / старые мины: тайл — ПОРОДА с маркером (всегда копается). ДО genUnstable — их не помечаем.
    this.robots = this.genRobots();
    for (const r of this.robots) { const t = this.tiles[r.ty * MAP_W + wrapX(r.tx)]; t.type = ROCK; t.hardness = this.hardnessForY(r.ty) * 1.15; t.dig = 0; t.resource = null; t.dens = 1; t.robot = r; }
    this.traps = this.genTraps(this.robots);                   // ловушки (вкл. мину как тип) держат дистанцию ОТ роботов И друг от друга
    for (const tr of this.traps) { const t = this.tiles[tr.ty * MAP_W + wrapX(tr.tx)]; t.type = ROCK; t.hardness = this.hardnessForY(tr.ty) * (tr.type === 'mine' ? 1.1 : 1); t.dig = 0; t.resource = null; t.dens = 1; t.trap = tr; }
    this.mines = this.traps.filter((tr) => tr.type === 'mine');   // фильтр-ссылка (ТЕ ЖЕ объекты) — для drawMines/drawHazardDebug
    this.genUnstable();   // нестабильная порода (после серверов/артефактов/роботов/мин/ЛОВУШЕК/фундамента — их не помечаем)
  }
  // Помечаем часть породы НИЖЕ города как «нестабильную» (падающие валуны) — НЕ большими кластерами,
  // а МЕЛКИМИ группами по 1-3 соседних тайла, разбросанными так, чтобы покрытие было ~20%. Только где
  // СНИЗУ есть опора на старте (не висит над пустотой сразу) и не круста/сервер/фундамент.
  genUnstable() {
    const inCeil = (y) => { for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return true; return false; };
    const eligible = (t, y) => t && t.type === ROCK && !t.server && !t.artifact && !t.robot && !t.trap && !(y >= CRUST_Y0 && y <= CRUST_Y1) && !inCeil(y);
    for (let y = CAVE_FLOOR_Y + 2; y < MAP_H - 1; y++)
      for (let x = 0; x < MAP_W; x++) {
        const t = this.tiles[y * MAP_W + x];
        if (!eligible(t, y) || t.unstable) continue;
        if (!isSolid(this.tiles[(y + 1) * MAP_W + x])) continue;          // нужна опора снизу на старте
        if (this.tiles[y * MAP_W + wrapX(x - 1)].unstable) continue;      // не сливаемся с соседней группой слева
        if (this.hash(x * 31 + 7, y * 17 + 3) >= UNSTABLE_SEED_CHANCE) continue;   // «зерно» группы
        const size = 1 + Math.floor(this.hash(x * 13 + 1, y * 29 + 5) * 3);        // 1..3 тайла подряд
        for (let k = 0; k < size; k++) {
          const xx = wrapX(x + k), tt = this.tiles[y * MAP_W + xx];
          if (!eligible(tt, y) || !isSolid(this.tiles[(y + 1) * MAP_W + xx])) break;
          tt.unstable = true;
        }
      }
    // тяжёлые ВАЛУНЫ: одиночные плотные тайлы (реже нестабильной), высокая твёрдость, не на нестабильных.
    for (let y = CAVE_FLOOR_Y + 2; y < MAP_H - 1; y++)
      for (let x = 0; x < MAP_W; x++) {
        const t = this.tiles[y * MAP_W + x];
        if (!eligible(t, y) || t.unstable || t.boulder) continue;
        if (!isSolid(this.tiles[(y + 1) * MAP_W + x])) continue;             // опора снизу на старте
        if (this.hash(x * 23 + 11, y * 41 + 9) >= BOULDER_SEED_CHANCE) continue;
        t.boulder = true; t.hardness = this.hardnessForY(y) * BOULDER_HARD; t.dens = 1; t.resource = null;
      }
    // ТЕСТ: у базы — группа нестабильной + пара валунов (быстро проверить оба типа).
    const startCx = Math.round((CAVE_X0 + CAVE_X1) / 2);
    for (let dx = 6; dx <= 8; dx++) {
      const t = this.tiles[(CAVE_FLOOR_Y + 2) * MAP_W + wrapX(startCx + dx)];
      if (t && t.type === ROCK && !t.server) { t.unstable = true; t.boulder = false; }
    }
    for (let dx = 10; dx <= 11; dx++) {
      const t = this.tiles[(CAVE_FLOOR_Y + 2) * MAP_W + wrapX(startCx + dx)];
      if (t && t.type === ROCK && !t.server) { t.boulder = true; t.unstable = false; t.hardness = this.hardnessForY(CAVE_FLOOR_Y + 2) * BOULDER_HARD; t.dens = 1; t.resource = null; }
    }
  }
  // Валун приземлился — клетка снова становится ПОРОДОЙ (блокирует ход; может упасть опять).
  settleRock(x, y, hardness, resource, boulder) {
    const t = this.tileAt(x, y);
    t.type = ROCK; t.hardness = hardness; t.resource = resource || null; t.dens = 1; t.dig = 0; t.dug = false;
    t.unstable = false; t.boulder = !!boulder;
  }
  layFoundation(x0, x1, y) {
    if (y < 0 || y >= MAP_H) return;
    for (let x = x0; x <= x1; x++) {
      const t = this.tiles[y * MAP_W + wrapX(x)];
      t.type = INDESTRUCT; t.hardness = 0; t.dig = 0; t.resource = null; t.dens = 1;
    }
  }
  tileAt(x, y) {
    if (y < 0) return { type: AIR, hardness: 0, resource: null, dig: 0, dens: 0 };
    if (y >= MAP_H) return { type: BORDER, hardness: 0, resource: null, dig: 0, dens: 0 };
    return this.tiles[y * MAP_W + wrapX(x)];
  }
  setAir(x, y, noTrigger) {
    const t = this.tileAt(x, y);
    if (t.type === ROCK) { if (t.server) t.server.dug = true; if (t.artifact) t.artifact.dug = true; if (t.robot) t.robot.dug = true; if (t.trap) t.trap.dug = true; t.type = AIR; t.hardness = 0; t.dig = 0; t.resource = null; t.dug = true; } // dug=прорытый ход (не природная пустота) — враги избегают своих ходов; сервер → «хлам»; артефакт → откопан (модалка по близости юнита)
    if (noTrigger) return;             // ВИНТОВОЙ бур: укреплённый ход — НЕ осыпает породу/валуны сверху
    const a = this.tileAt(x, y - 1);   // клетка СВЕРХУ потеряла опору? нестабильная/валун — в очередь на срыв (falling.js)
    if (a.type === ROCK && (a.unstable || a.boulder)) this.unstableTriggers.push({ x: wrapX(x), y: y - 1 });
  }
}
