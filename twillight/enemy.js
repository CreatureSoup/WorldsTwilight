'use strict';

// Enemy — враждебный юнит диких гнёзд. Локомоция общая (как у юнита: клинг к породе,
// гравитация, копание настоящих тоннелей), поведение задаёт `game` (стейт/цель).
//   копатель  — разведчик: ищет цивилизованные города, найдя — возвращается в гнездо;
//   собиратель — добывает 1 ресурс рядом и несёт в гнездо.
// Без опоры и снизу воздух — падает. Ход в воздух только если в точке назначения есть
// опора (клинг) → в открытом пространстве ползёт по краям до дальней стенки и копает там.
const ENEMY_SPEED = 2;     // тайла/сек (копатель/собиратель — тяжёлые машины, медленные)
const ENEMY_DIG = 1.0;     // скорость бурения
const FLOW_SCALE = 8;      // масштаб поля-потока (поиск без знания целей)
const UP_BIAS = 0.6;       // тяга вверх (копатель роет «наружу» — к поверхности/городам)
const DETECT_CITY_PAD = 4; // чутьё копателя на город — радиус обнаружения сверх размера каверны (тайлы)
const DETECT_RES = 2;      // радиус обнаружения ресурса собирателем (тайлы)
const COLLECTOR_CAP = 6;   // потолок собирателей
// Разведчик (боевая волна, фаза 5): быстрый, НЕ копает — бежит по готовым тоннелям
// копателей к разведанной базе, высасывает энергию контуров («ходячая батарейка») и
// уносит заряд домой. Полностью опустошённый контур не возобновляется (как гибернация).
const RAIDER_SPEED = 5;    // быстрее копателя/собирателя (тайла/сек)
const RAIDER_CAP = 3;      // потолок разведчиков
const RAID_DRAIN = 50;     // сколько энергии (HP контура) высасывает за набег
const RAID_REACH_R = 5;    // тайлов — «достиг базы» (упирается в неразрушимый фундамент снизу)

class Enemy {
  constructor(x, y, type, homeX, homeY, homeR) {
    this.tileX = x; this.tileY = y;
    this.px = x * TILE + TILE / 2; this.py = y * TILE + TILE / 2;
    this.type = type;                 // 'digger' | 'collector' | 'raider'
    this.speed = type === 'raider' ? RAIDER_SPEED : ENEMY_SPEED;
    this.homeX = homeX; this.homeY = homeY;
    this.homeR = homeR || 1;          // радиус «дома»: гнездо — открытая каверна, точный центр недостижим (клинг/гравитация)
    this.state = 'seek';              // seek | return | goresource
    this.target = null;              // {x,y} для goto, иначе null → блуждание
    this.carry = null;               // ресурс у собирателя
    this.dead = false;
    this.state2 = IDLE; this.fromX = x; this.fromY = y; this.toX = x; this.toY = y; this.progress = 0;
    this.dx = 0; this.dy = 1; this.drilling = false;
    this.dug = null;                 // выкопанная жила {x,y,type}: game роняет лутом (копатель не «съедает» ресурс)
    this.heading = Math.random() * Math.PI * 2;
    this.seed = Math.random() * 1000;
    this.lastDir = { x: 0, y: 0 };
    this.commit = null;
    this.recent = [];                // недавние тайлы (анти-петля: не кружить в полости)
  }
  startMove(nx, ny) { this.fromX = this.tileX; this.fromY = this.tileY; this.toX = nx; this.toY = ny; this.progress = 0; this.state2 = MOVING; }
  lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
  anchoredAt(world, x, y) {
    return isSolid(world.tileAt(x - 1, y)) || isSolid(world.tileAt(x + 1, y))
        || isSolid(world.tileAt(x, y - 1)) || isSolid(world.tileAt(x, y + 1));
  }
  passable(world, dx, dy) {
    const t = world.tileAt(this.tileX + dx, this.tileY + dy).type;
    if (t === ROCK) return this.type !== 'raider';                // разведчик НЕ копает — только по готовым ходам
    if (t === AIR) return this.type === 'raider' || this.anchoredAt(world, this.tileX + dx, this.tileY + dy); // разведчик лёгкий — летит по воздуху; прочим нужна опора
    return false;                                                 // неразрушимое/край
  }
  // Блуждание (без цели): поток-шум + тяга вверх; предпочитаем ВОЗДУХ (идём по открытому
  // пространству до края), затем копаем; не пятимся назад.
  wanderDir(world) {
    const f = world.pnoise(this.tileX + this.seed, this.tileY, FLOW_SCALE);
    this.heading = this.lerpAngle(this.heading, this.lerpAngle(f * 6.283, -Math.PI / 2, UP_BIAS), 0.25);
    const hx = Math.cos(this.heading), hy = Math.sin(this.heading);
    // у корки бурим СКВОЗЬ неё (вверх к городам), а не вдоль: горизонталь штрафуем
    const nearCrust = this.tileY > SURFACE_ROWS && this.tileY <= CRUST_Y1 + 1;
    return this.rank(world, (dx, dy) => {
      const tx = wrapX(this.tileX + dx), ty = this.tileY + dy, tile = world.tileAt(tx, ty);
      const along = nearCrust && dy === 0 ? 1 : 0;                // вдоль корки — хуже (роем сквозь, не вдоль)
      const seen = this.recent.includes(tx + ',' + ty) ? 1 : 0;   // не топтаться по пройденному → выход из полости
      const old = (tile.type === AIR && tile.dug) ? 1 : 0;        // прорытые ходы избегаем → роем новое (расползание)
      const air = tile.type === AIR ? 0 : 1;
      return [along, seen, old, -(dx * hx + dy * hy), air];       // не-вдоль → новое → не-старый-ход → ПО HEADING → воздух
    });
  }
  // К цели (знаем координаты): по сокращению тороидальной дистанции; воздух в приоритете.
  gotoDir(world, tx, ty) {
    const cur = this.dist(tx, ty);
    return this.rank(world, (dx, dy) => {
      const nx = this.tileX + dx, ny = this.tileY + dy;
      const nd = this.distFrom(nx, ny, tx, ty);
      const seen = this.recent.includes(wrapX(nx) + ',' + ny) ? 1 : 0; // тупик у препятствия → обходим непосещённым
      const air = world.tileAt(nx, ny).type === AIR ? 0 : 1;
      return [nd - cur, seen, air];                              // ближе → непосещённое → воздух
    });
  }
  rank(world, keyFn) {
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.passable(world, dx, dy));
    if (!dirs.length) return null;
    dirs.sort((a, b) => { const ka = keyFn(...a), kb = keyFn(...b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; });
    for (const [dx, dy] of dirs) if (!(dx === -this.lastDir.x && dy === -this.lastDir.y)) return { x: dx, y: dy };
    return { x: dirs[0][0], y: dirs[0][1] };                      // только разворот доступен
  }
  dist(tx, ty) { return this.distFrom(this.tileX, this.tileY, tx, ty); }
  distFrom(x, y, tx, ty) { const d = Math.abs(((x - tx) % MAP_W + MAP_W) % MAP_W); return Math.min(d, MAP_W - d) + Math.abs(y - ty); }

  update(dt, world) {
    this.drilling = false;
    if (this.state2 === MOVING) {
      this.progress += this.speed * dt;
      if (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY;
        this.px = this.tileX * TILE + TILE / 2; this.py = this.tileY * TILE + TILE / 2; this.state2 = IDLE;
        this.lastDir = { x: this.dx, y: this.dy }; this.commit = null;
        this.recent.push(this.tileX + ',' + this.tileY); if (this.recent.length > 24) this.recent.shift();
      } else {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const txp = this.toX * TILE + TILE / 2, typ = this.toY * TILE + TILE / 2;
        this.px = fx + (txp - fx) * this.progress; this.py = fy + (typ - fy) * this.progress;
      }
      return;
    }
    // гравитация: без опоры и снизу воздух — падаем (разведчик лёгкий — летит, не падает)
    if (this.type !== 'raider' && !this.anchoredAt(world, this.tileX, this.tileY) && world.tileAt(this.tileX, this.tileY + 1).type === AIR) {
      this.dx = 0; this.dy = 1; this.startMove(this.tileX, this.tileY + 1); this.commit = null; return;
    }
    if (!this.commit) this.commit = this.target ? this.gotoDir(world, this.target.x, this.target.y) : this.wanderDir(world);
    if (!this.commit) return;
    const dx = this.commit.x, dy = this.commit.y; this.dx = dx; this.dy = dy;
    const nx = this.tileX + dx, ny = this.tileY + dy, t = world.tileAt(nx, ny);
    if (t.type === AIR) { this.startMove(nx, ny); return; }
    if (t.type === ROCK) {
      this.drilling = true; t.dig += ENEMY_DIG * dt;
      if (t.dig >= digThreshold(t)) {
        if (t.resource) this.dug = { x: wrapX(nx), y: ny, type: t.resource }; // жилу не теряем — game уронит лутом
        world.setAir(nx, ny); this.startMove(nx, ny);
      }
      return;
    }
    this.commit = null;                                          // уперлись в неразрушимое
  }
}
