'use strict';

// Unit — грид-стейт-машина. Паук-бур: цепляется за соседнюю породу (клинг),
// статы из сборки ядра. Бурение ПРЕРЫВАЕМО: повреждение копится на тайле
// (`tile.dig`) и сохраняется — можно бросить и продолжить позже.
class Unit {
  constructor(x, y, stats) {
    this.tileX = x; this.tileY = y;
    this.px = x * TILE + TILE / 2;
    this.py = y * TILE + TILE / 2;
    this.state = IDLE;
    this.dx = 1; this.dy = 0;
    this.fromX = x; this.fromY = y; this.toX = x; this.toY = y;
    this.moveSpeed = 4; this.progress = 0;
    this.drilling = false; this.drillX = 0; this.drillY = 0;
    this.dug = null; // событие «выкопан ресурсный тайл» для оркестратора (game)
    this.load = 0;   // вес груза (занятые гексы), выставляет game перед update
    this.setStats(stats);
    this.energy = this.stats.capacity;
  }
  setStats(stats) {
    this.stats = stats;
    if (this.energy === undefined) this.energy = stats.capacity;
    this.energy = Math.min(this.energy, stats.capacity);
    if (this.hp === undefined) this.hp = stats.maxHp;
    this.hp = Math.min(this.hp, stats.maxHp);
  }
  // опора: только соседняя порода (клинг). Никаких «искусственных» полов —
  // пол стартовой пещеры держится за породу под ним (гарантируется генерацией).
  anchoredAt(world, x, y) {
    return isSolid(world.tileAt(x - 1, y)) || isSolid(world.tileAt(x + 1, y))
        || isSolid(world.tileAt(x, y - 1)) || isSolid(world.tileAt(x, y + 1));
  }
  isAnchored(world) { return this.anchoredAt(world, this.tileX, this.tileY); }
  // Скорость хода с учётом веса груза (скорость движка — абсолют без нагрузки).
  effectiveSpeed() { return this.stats.moveSpeed * Math.max(SPEED_MIN_FRAC, 1 - this.load * LOAD_PENALTY); }
  startMove(toX, toY, speed, cost) {
    this.fromX = this.tileX; this.fromY = this.tileY;
    this.toX = toX; this.toY = toY;
    this.moveSpeed = speed; this.progress = 0;
    if (cost) this.energy = Math.max(0, this.energy - cost);
    this.state = MOVING;
  }
  update(dt, input, world) {
    const s = this.stats;
    this.energy = Math.max(0, Math.min(s.capacity, this.energy + (s.regen - s.passiveDraw) * dt));
    this.drilling = false;

    if (this.state === MOVING) {
      this.progress += this.moveSpeed * dt;
      if (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY; // переход через шов мира
        this.px = this.tileX * TILE + TILE / 2;
        this.py = this.tileY * TILE + TILE / 2;
        this.state = IDLE;
      } else {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const tx = this.toX * TILE + TILE / 2, ty = this.toY * TILE + TILE / 2;
        this.px = fx + (tx - fx) * this.progress;
        this.py = fy + (ty - fy) * this.progress;
      }
      return;
    }

    // Любой ход/лазанье — только с ОПОРЫ (клинг к породе). В свободном падении
    // управление не действует: зажатые клавиши отделены от физики (гравитации),
    // поэтому «полетать» вбок по воздуху нельзя.
    const anchored = this.isAnchored(world);

    // СМАРТ-ЛАЗАНЬЕ: «вверх + вбок» → шаг по диагонали на боковой уступ (с опоры).
    if (anchored && this.energy > 0 && s.canMove && input.up()) {
      const hx = input.left() ? -1 : input.right() ? 1 : 0;
      if (hx !== 0 && world.tileAt(this.tileX + hx, this.tileY - 1).type === AIR) {
        this.dx = hx; this.dy = 0;
        this.startMove(this.tileX + hx, this.tileY - 1, this.effectiveSpeed(), s.moveCost);
        return;
      }
    }

    // --- IDLE: намерение (W/S приоритетнее A/D) ---
    let dx = 0, dy = 0;
    if (input.up())         dy = -1;
    else if (input.down())  dy =  1;
    else if (input.left())  dx = -1;
    else if (input.right()) dx =  1;

    if ((dx !== 0 || dy !== 0) && this.energy > 0) {
      this.dx = dx; this.dy = dy;
      const nx = this.tileX + dx, ny = this.tileY + dy;
      const t = world.tileAt(nx, ny);
      if (t.type === ROCK && s.canDig) {
        // бурим: соседняя порода = опора по определению
        this.drilling = true; this.drillX = nx; this.drillY = ny;
        t.dig += s.digMult * dt;
        this.energy = Math.max(0, this.energy - s.digCost * dt);
        if (t.dig >= digThreshold(t)) {
          const res = t.resource;
          world.setAir(nx, ny);
          if (res) this.dug = { x: nx, y: ny, type: res };
          this.startMove(nx, ny, this.effectiveSpeed(), 0);
        }
        return;
      }
      // ход в воздух (вкл. прыжок вверх на 1) — только с опоры
      if (t.type === AIR && s.canMove && anchored) { this.startMove(nx, ny, this.effectiveSpeed(), s.moveCost); return; }
    }

    // гравитация: без опоры и снизу пусто — падаем
    if (world.tileAt(this.tileX, this.tileY + 1).type === AIR && !anchored) {
      this.startMove(this.tileX, this.tileY + 1, FALL_SPEED, 0);
    }
  }
}
