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
    this.caverns = [];                          // дружественные чужие города
    this.wilds = [];                            // дикие города-гнёзда (источники волн)
    this.radSources = [];                       // очаги сильной радиации (помехи интерфейсу)
    this.servers = [];                          // старые серверы в породе — источники данных
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
  reveal(cx, cy, r) {
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(MAP_H - 1, Math.ceil(cy + r));
    const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.seen[y * MAP_W + wrapX(x)] = 1;
      }
  }
  hardnessForY(y) {
    if (y <= MAP_H * 0.5) return 1.5;
    if (y <= MAP_H * 0.78) return 2.5;
    return 4.0;
  }
  layerName(y) {
    if (y < SURFACE_ROWS) return 'поверхность';
    for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return 'кровля';
    if (y < CAVE_Y0) return 'свод';
    if (y <= CAVE_FLOOR_Y) return 'город';
    if (y >= CRUST_Y0 && y <= CRUST_Y1) return 'корка';
    if (y <= MAP_H * 0.5) return 'верхний';
    if (y <= MAP_H * 0.78) return 'средний';
    return 'глубокий';
  }
  inCave(x, y) { return x >= CAVE_X0 && x <= CAVE_X1 && y >= CAVE_Y0 && y <= CAVE_Y1; }

  // тороидальная дистанция по X в тайлах
  torDist(a, b) { const d = Math.abs(a - b) % MAP_W; return Math.min(d, MAP_W - d); }
  inEllipseList(x, y, list) {
    for (const c of list) {
      const dx = wrapDeltaPx(x * TILE, c.cx * TILE) / TILE, dy = y - c.cy;
      if ((dx * dx) / (c.rx * c.rx) + (dy * dy) / (c.ry * c.ry) <= 1) return true;
    }
    return false;
  }
  inCavern(x, y) { return this.inEllipseList(x, y, this.caverns); }
  inWild(x, y) { return this.inEllipseList(x, y, this.wilds); }
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
  // Дружественные чужие города (несут name/rep — задел под задания/мету).
  genCaverns() {
    const H = MAP_H;
    const bands = [[H * 0.28, H * 0.42], [H * 0.46, H * 0.60], [H * 0.64, H * 0.80]].map((b) => [Math.round(b[0]), Math.round(b[1])]);
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    const list = this.placeNest(bands, OTHER_CITIES, [{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    return list.map((c, i) => ({ ...c, name: CITY_NAMES[i % CITY_NAMES.length], rep: 0 }));
  }
  // Дикие города-гнёзда: глубже, разнесены от старта, дружественных и друг друга.
  genWilds() {
    const H = MAP_H;
    const bands = [[H * 0.40, H * 0.60], [H * 0.66, H * 0.86]].map((b) => [Math.round(b[0]), Math.round(b[1])]);
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    const avoid = this.caverns.map((c) => ({ cx: c.cx, cy: c.cy })).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    return this.placeNest(bands, WILD_NESTS, avoid).map((w) => ({ ...w, hp: WILD_HP, maxHp: WILD_HP, loot: 0, charge: 0 }));
  }

  // Старые серверы — точечные источники данных, вкраплённые в породу (не в пещерах/крусте).
  // Каждый: {tx,ty, dug, data(0..1), done}. Тайл сервера делается ПОРОДОЙ (копается); найти —
  // по маркеру в раскрытой туманом породе. Разнесены по тору 2D друг от друга и от городов.
  genServers() {
    const H = MAP_H, list = [];
    const bands = [[Math.round(H * 0.33), Math.round(H * 0.54)], [Math.round(H * 0.58), Math.round(H * 0.82)]];
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    // ТЕСТ: гарантированный сервер у базы — пара тайлов вниз от пола стартовой пещеры (быстро дотянуться
    // и проверить дайджест dig→хлам→скан без глубокой копки). Сдвиг по X от принтера → не в фундаменте.
    list.push({ tx: wrapX(Math.round(startCx) + 4), ty: CAVE_FLOOR_Y + 3, dug: false, data: 0, done: false });
    const avoid = this.caverns.concat(this.wilds).concat([{ cx: startCx, cy: CAVE_FLOOR_Y }]);
    for (let i = 0; i < SERVER_COUNT; i++) {
      const band = bands[i % bands.length];
      let tx = -1, ty = 0;
      for (let tries = 0; tries < 120; tries++) {
        const x = Math.floor(this.rand() * MAP_W), y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        if (this.inCave(x, y) || this.inCavern(x, y) || this.inWild(x, y)) continue;
        if (y >= CRUST_Y0 && y <= CRUST_Y1) continue;
        const farCity = avoid.every((a) => this.torDist(x, a.cx) >= 5 || Math.abs(y - a.cy) >= 6);
        const farSrv = list.every((s) => this.torDist(x, s.tx) >= 8 || Math.abs(y - s.ty) >= 6);
        if (farCity && farSrv) { tx = x; ty = y; break; }
      }
      if (tx >= 0) list.push({ tx: wrapX(tx), ty, dug: false, data: 0, done: false });
    }
    return list;
  }

  resourceFor(x, y) {
    const depth = Math.max(0, y - CAVE_FLOOR_Y);
    const pRes = Math.min(0.32, 0.06 + 0.015 * (depth / 10));
    if (this.tileNoise(x * 7 + 13, y * 11 + 5) >= pRes) return null;
    const depthF = Math.min(1, depth / (MAP_H - CAVE_FLOOR_Y));
    const pCrystal = 0.02 + 0.22 * depthF, pOrganic = 0.30;
    const r = this.tileNoise(x * 5 + 91, y * 3 + 17);
    if (r < pCrystal) return 'crystal';
    if (r < pCrystal + pOrganic) return 'organic';
    return 'iron';
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
      if (d < s.r) v = Math.max(v, 1 - d / s.r);
    }
    return Math.min(1, v);
  }

  // Очаги радиации: рассеяны недалеко от базы (по X — разброс от спавна, по глубине —
  // ниже города). Невидимы в мире; «находятся» по нарастанию помех при приближении.
  genRadSources() {
    const list = [];
    for (let i = 0; i < RAD_SOURCES; i++) {
      const x = wrapX(SPAWN_X + Math.round((this.rand() * 2 - 1) * RAD_SOURCE_SPREAD));
      const y = RAD_SOURCE_BAND[0] + Math.floor(this.rand() * (RAD_SOURCE_BAND[1] - RAD_SOURCE_BAND[0] + 1));
      list.push({ x, y, r: RAD_SOURCE_R });
    }
    return list;
  }

  generate() {
    this.caverns = this.genCaverns();
    this.wilds = this.genWilds();
    this.radSources = this.genRadSources();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        let type = AIR, hardness = 0, dens = 0, resource = null;
        if (y === MAP_H - 1) type = BORDER;            // дно (боковых границ нет — кольцо)
        else if (y < SURFACE_ROWS) type = AIR;          // внешняя поверхность
        else if (this.inCave(x, y)) type = AIR;         // стартовый город
        else if (this.inCavern(x, y)) type = AIR;       // дружественные города
        else if (this.inWild(x, y)) type = AIR;         // дикие гнёзда (без фундамента — будущий рейд)
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
            resource = this.resourceFor(x, y);
            // Природные пустоты — только НИЖЕ города (между крустами вверху коридоров не нужно:
            // подъём к поверхности — это копание через барьеры, а не свободный проход).
            if (y > CAVE_FLOOR_Y && this.pnoise(x, y, VOID_SCALE) > VOID_THRESHOLD) { type = AIR; hardness = 0; dens = 0; resource = null; }
          }
        }
        this.tiles[y * MAP_W + x] = { type, hardness, resource, dig: 0, dens };
      }
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
    this.genUnstable();   // нестабильная порода (после серверов/фундамента — их не помечаем)
  }
  // Помечаем часть породы НИЖЕ города как «нестабильную» (падающие валуны) — НЕ большими кластерами,
  // а МЕЛКИМИ группами по 1-3 соседних тайла, разбросанными так, чтобы покрытие было ~20%. Только где
  // СНИЗУ есть опора на старте (не висит над пустотой сразу) и не круста/сервер/фундамент.
  genUnstable() {
    const inCeil = (y) => { for (const c of CEILING_CRUSTS) if (y >= c.y0 && y <= c.y1) return true; return false; };
    const eligible = (t, y) => t && t.type === ROCK && !t.server && !(y >= CRUST_Y0 && y <= CRUST_Y1) && !inCeil(y);
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
    // ТЕСТ: гарантированная группа у базы (пара тайлов вглубь сбоку от старта) — быстро проверить падение.
    const startCx = Math.round((CAVE_X0 + CAVE_X1) / 2);
    for (let dx = 6; dx <= 8; dx++) {
      const t = this.tiles[(CAVE_FLOOR_Y + 2) * MAP_W + wrapX(startCx + dx)];
      if (t && t.type === ROCK && !t.server) t.unstable = true;
    }
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
  setAir(x, y) {
    const t = this.tileAt(x, y);
    if (t.type === ROCK) { if (t.server) t.server.dug = true; t.type = AIR; t.hardness = 0; t.dig = 0; t.resource = null; t.dug = true; } // dug=прорытый ход (не природная пустота) — враги избегают своих ходов; сервер → «хлам» (источник данных)
    const a = this.tileAt(x, y - 1);   // клетка СВЕРХУ потеряла опору? нестабильная — в очередь на срыв (falling.js)
    if (a.type === ROCK && a.unstable) this.unstableTriggers.push({ x: wrapX(x), y: y - 1 });
  }
}
