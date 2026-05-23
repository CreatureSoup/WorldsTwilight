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
    this.caverns = [];                          // чужие города (пещеры)
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
    if (y <= 45) return 1.5;
    if (y <= 62) return 2.5;
    return 4.0;
  }
  layerName(y) {
    if (y < SURFACE_ROWS) return 'поверхность';
    if (y < CAVE_Y0) return 'свод';
    if (y <= CAVE_FLOOR_Y) return 'город';
    if (y >= CRUST_Y0 && y <= CRUST_Y1) return 'корка';
    if (y <= 45) return 'верхний';
    if (y <= 62) return 'средний';
    return 'глубокий';
  }
  inCave(x, y) { return x >= CAVE_X0 && x <= CAVE_X1 && y >= CAVE_Y0 && y <= CAVE_Y1; }

  // тороидальная дистанция по X в тайлах
  torDist(a, b) { const d = Math.abs(a - b) % MAP_W; return Math.min(d, MAP_W - d); }
  inCavern(x, y) {
    for (const c of this.caverns) {
      const dx = wrapDeltaPx(x * TILE, c.cx * TILE) / TILE, dy = y - c.cy;
      if ((dx * dx) / (c.rx * c.rx) + (dy * dy) / (c.ry * c.ry) <= 1) return true;
    }
    return false;
  }
  // Размещение чужих городов: разные глубины, разнесены по кольцу.
  genCaverns() {
    const bands = [[34, 44], [48, 58], [63, 74]];
    const startCx = (CAVE_X0 + CAVE_X1) / 2;
    const list = [];
    for (let i = 0; i < OTHER_CITIES; i++) {
      const band = bands[i % bands.length];
      let cx = -1, cy = 0;
      for (let tries = 0; tries < 80; tries++) {
        const x = Math.floor(this.rand() * MAP_W);
        const y = band[0] + Math.floor(this.rand() * (band[1] - band[0] + 1));
        const farStart = this.torDist(x, startCx) >= CITY_MIN_GAP_X;
        const farOthers = list.every((c) => this.torDist(x, c.cx) >= CITY_MIN_GAP_X);
        if (farStart && farOthers) { cx = x; cy = y; break; }
      }
      if (cx < 0) {  // фолбэк: равномерно разнести по кольцу от старта
        cx = wrapX(Math.round(startCx + (i + 1) * MAP_W / (OTHER_CITIES + 1)));
        cy = band[0] + ((band[1] - band[0]) >> 1);
      }
      const rx = 5 + Math.floor(this.rand() * 3), ry = 3 + Math.floor(this.rand() * 2);
      list.push({ cx, cy, rx, ry, floorY: cy + ry, name: CITY_NAMES[i % CITY_NAMES.length], rep: 0 });
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
  // Локальный фон скверны (HP/сек до резиста): база растёт с глубиной + периодическое
  // поле очагов/оазисов (бесшовно по кольцу). Принимает дробные координаты.
  radAt(x, y) {
    const depth = Math.max(0, y - CAVE_FLOOR_Y);
    const base = 0.3 + depth * 0.05;
    return base * (0.2 + this.pnoise(x, y, 6) * 1.7);
  }

  generate() {
    this.caverns = this.genCaverns();
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        let type = AIR, hardness = 0, dens = 0, resource = null;
        if (y === MAP_H - 1) type = BORDER;            // дно (боковых границ нет — кольцо)
        else if (y < SURFACE_ROWS) type = AIR;          // внешняя поверхность
        else if (this.inCave(x, y)) type = AIR;         // стартовый город
        else if (this.inCavern(x, y)) type = AIR;       // чужие города
        else {
          type = ROCK;
          if (y >= CRUST_Y0 && y <= CRUST_Y1) {         // спрессованный хлам: барьер
            dens = 1; hardness = this.hardnessForY(y) * CRUST_HARD;
          } else {
            const zone = this.pnoise(x, y, 4), fine = this.tileNoise(x * 3 + 1, y * 5 + 7);
            dens = Math.min(1, Math.max(0, zone * 0.72 + fine * 0.32 + 0.04));
            hardness = this.hardnessForY(y) * (0.5 + dens);
            resource = this.resourceFor(x, y);
            if (this.pnoise(x, y, VOID_SCALE) > VOID_THRESHOLD) { type = AIR; hardness = 0; dens = 0; resource = null; } // пустота
          }
        }
        this.tiles[y * MAP_W + x] = { type, hardness, resource, dig: 0, dens };
      }
    // Неразрушимый фундамент ТОЛЬКО под самим городом (принтер + площадка спавна;
    // у чужих — под маркером). Остальной пол пещеры — обычная порода (копается).
    this.layFoundation(PRINTER.x - 1, PRINTER.x + PRINTER.w, CAVE_FLOOR_Y + 1);
    for (const c of this.caverns) this.layFoundation(c.cx - 1, c.cx + 1, c.floorY + 1);
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
  setAir(x, y) { const t = this.tileAt(x, y); if (t.type === ROCK) { t.type = AIR; t.hardness = 0; t.dig = 0; t.resource = null; } }
}
