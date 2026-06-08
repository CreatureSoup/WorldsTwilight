'use strict';

// Unit — грид-стейт-машина. Паук-бур: цепляется за соседнюю породу (клинг),
// статы из выбранных модулей. Бурение ПРЕРЫВАЕМО: повреждение копится на тайле
// (`tile.dig`) и сохраняется — можно бросить и продолжить позже.
// Энергии/расхода нет: упрощённая модель (см. CLAUDE.md §«Сборка»).
class Unit {
  constructor(x, y, stats) {
    this.tileX = x; this.tileY = y;
    this.px = x * TILE + TILE / 2;
    this.py = y * TILE + TILE / 2;
    this.state = IDLE;
    this.dx = 1; this.dy = 0;
    this.faceX = 1;   // последний ГОРИЗОНТАЛЬНЫЙ взгляд (тело рисуется горизонтально, флип L/R)
    this.fromX = x; this.fromY = y; this.toX = x; this.toY = y;
    this.moveSpeed = 4; this.progress = 0;
    this.drilling = false; this.drillX = 0; this.drillY = 0;
    this.dug = null; // событие «выкопан ресурсный тайл» для оркестратора (game)
    this.broke = false; // событие «прокопан ЛЮБОЙ тайл» (game считает проходку)
    this.crouchT = 0; this.crouchTarget = null; // присед перед прыжком вверх (ощущение веса)
    this.setStats(stats);
  }
  setStats(stats) {
    const prevMax = this.stats ? this.stats.maxHp : null;
    this.stats = stats;
    if (this.hp === undefined) this.hp = stats.maxHp;
    else if (prevMax != null && stats.maxHp > prevMax) this.hp += stats.maxHp - prevMax;  // апгрейд корпуса лечит НА ПРИБАВКУ (не полностью)
    this.hp = Math.min(this.hp, stats.maxHp);
  }
  // опора: только соседняя порода (клинг). Никаких «искусственных» полов —
  // пол стартовой пещеры держится за породу под ним (гарантируется генерацией).
  anchoredAt(world, x, y) {
    return isSolid(world.tileAt(x - 1, y)) || isSolid(world.tileAt(x + 1, y))
        || isSolid(world.tileAt(x, y - 1)) || isSolid(world.tileAt(x, y + 1));
  }
  isAnchored(world) { return this.anchoredAt(world, this.tileX, this.tileY); }
  // Скорость хода — напрямую от модуля «Двигатель». Замедления от веса нет.
  effectiveSpeed() { return this.stats.moveSpeed; }
  startMove(toX, toY, speed) {
    this.fromX = this.tileX; this.fromY = this.tileY;
    this.toX = toX; this.toY = toY;
    this.moveSpeed = speed; this.progress = 0;
    this.state = MOVING;
  }
  // Толчок (валуном): мгновенно перенести юнита в клетку (nx,ny), сбросив движение/бур.
  shove(nx, ny) {
    this.tileX = nx; this.tileY = ny;
    this.px = nx * TILE + TILE / 2; this.py = ny * TILE + TILE / 2;
    this.fromX = nx; this.fromY = ny; this.toX = nx; this.toY = ny;
    this.progress = 0; this.state = IDLE; this._dugBlock = null;
  }
  update(dt, input, world) {
    const s = this.stats;
    this.drilling = false;
    if (this.dx === 1 || this.dx === -1) this.faceX = this.dx;  // запомнить горизонталь до возможной смены на «вверх/вниз»

    // «Замок» свежепрокопанного тайла: разовое нажатие (пробил → отпустил) НЕ въезжает в дыру —
    // юнит стоит. Тем же УДЕРЖАНИЕМ заходит лишь спустя `DRILL_HOLD_ADVANCE` (непрерывный тоннель).
    // Снимается при отпускании направления (следующее нажатие — свежее).
    if (this._dugBlock) {
      if (!(input.up() || input.down() || input.left() || input.right())) this._dugBlock = null;
      else this._dugBlockT += dt;
    }

    if (this.state === MOVING) {
      this.progress += this.moveSpeed * dt;
      // НЕПРЕРЫВНОЕ ПАДЕНИЕ: при завершении тайла, если всё ещё свободное падение (нет опоры, снизу
      // воздух), сразу цепляем следующий тайл, ПЕРЕНОСЯ остаток progress — без кадра-заморозки на стыке.
      // Иначе py замирал на тайл-границе (1 кадр) → скачок скорости → ложный «удар» squash на КАЖДОМ
      // тайле (дёргано). Чейн только для падения (moveSpeed===FALL_SPEED); обычный ход — как было.
      while (this.progress >= 1) {
        this.tileX = wrapX(this.toX); this.tileY = this.toY; // переход через шов мира
        this.px = this.tileX * TILE + TILE / 2;
        this.py = this.tileY * TILE + TILE / 2;
        const falling = this.moveSpeed === FALL_SPEED && !this.isAnchored(world) && world.tileAt(this.tileX, this.tileY + 1).type === AIR;
        if (falling) { this.fromX = this.tileX; this.fromY = this.tileY; this.toX = this.tileX; this.toY = this.tileY + 1; this.progress -= 1; }
        else { this.state = IDLE; this.progress = 0; break; }
      }
      if (this.state === MOVING) {
        const fx = this.fromX * TILE + TILE / 2, fy = this.fromY * TILE + TILE / 2;
        const tx = this.toX * TILE + TILE / 2, ty = this.toY * TILE + TILE / 2;
        this.px = fx + (tx - fx) * this.progress;
        this.py = fy + (ty - fy) * this.progress;
      }
      return;
    }

    // присед перед прыжком: стоим JUMP_CROUCH_T, затем прыгаем (замедленно — тяжесть)
    if (this.crouchT > 0) {
      this.crouchT -= dt;
      if (this.crouchT <= 0 && this.crouchTarget) {
        const [jx, jy] = this.crouchTarget; this.crouchTarget = null;
        this.startMove(jx, jy, this.effectiveSpeed() * JUMP_SPEED_FRAC);
      }
      return;
    }

    // Любой ход/лазанье — только с ОПОРЫ (клинг к породе). В свободном падении
    // управление не действует: зажатые клавиши отделены от физики (гравитации),
    // поэтому «полетать» вбок по воздуху нельзя.
    const anchored = this.isAnchored(world);

    // ПОДЪЁМ по «вверх»: смарт-климб на уступ / лазанье по шахте / прыжок.
    // Присед-прыжок — ТОЛЬКО когда прыгаем в открытый воздух; лазанье с опорой — без приседа.
    if (anchored && s.canMove && input.up()) {
      const reqHx = input.left() ? -1 : input.right() ? 1 : 0;
      // 1) явный «вверх+вбок» → диагональ на боковой уступ
      if (reqHx !== 0 && world.tileAt(this.tileX + reqHx, this.tileY - 1).type === AIR) {
        this.dx = reqHx; this.dy = 0;
        this.startMove(this.tileX + reqHx, this.tileY - 1, this.effectiveSpeed());
        return;
      }
      // 2) «вверх» в воздух без явного вбок
      if (reqHx === 0 && world.tileAt(this.tileX, this.tileY - 1).type === AIR) {
        if (this.anchoredAt(world, this.tileX, this.tileY - 1)) {            // наверху есть опора (шахта/стена) → лезем
          this.dx = 0; this.dy = -1;
          this.startMove(this.tileX, this.tileY - 1, this.effectiveSpeed());
          return;
        }
        // прямо вверх не зацепиться → авто-цепляние за ЕДИНСТВЕННЫЙ боковой уступ (без чёткого «вбок»)
        const ledges = [];
        for (const sgn of [-1, 1])
          if (world.tileAt(this.tileX + sgn, this.tileY - 1).type === AIR && this.anchoredAt(world, this.tileX + sgn, this.tileY - 1)) ledges.push(sgn);
        const side = ledges.length === 1 ? ledges[0] : (ledges.length === 2 && ledges.includes(this.dx) ? this.dx : null);
        if (side !== null) {
          this.dx = side; this.dy = 0;
          this.startMove(this.tileX + side, this.tileY - 1, this.effectiveSpeed());
          return;
        }
        // настоящий прыжок в открытый воздух → присед, затем замедленный прыжок (тяжесть)
        this.dx = 0; this.dy = -1;
        this.crouchT = JUMP_CROUCH_T; this.crouchTarget = [this.tileX, this.tileY - 1];
        return;
      }
    }

    // --- IDLE: намерение (W/S приоритетнее A/D) ---
    let dx = 0, dy = 0;
    if (input.up())         dy = -1;
    else if (input.down())  dy =  1;
    else if (input.left())  dx = -1;
    else if (input.right()) dx =  1;

    if (dx !== 0 || dy !== 0) {
      this.dx = dx; this.dy = dy;
      const nx = this.tileX + dx, ny = this.tileY + dy;
      const t = world.tileAt(nx, ny);
      if (t.type === ROCK && s.canDig) {
        // бурим: соседняя порода = опора по определению
        this.drilling = true; this.drillX = nx; this.drillY = ny;
        t.dig += s.digMult * dt;
        if (t.dig >= digThreshold(t)) {
          const res = t.resource;
          world.setAir(nx, ny);
          this.broke = true;
          if (res) this.dug = { x: nx, y: ny, type: res };
          // ⚠️ НЕ ДОБАВЛЯЙ здесь startMove! На кадре ПРОБИТИЯ юнит ОСТАЁТСЯ НА МЕСТЕ (решено с игроком).
          //    Ставим «замок» на прокопанный тайл: тем же удержанием въедем только спустя DRILL_HOLD_ADVANCE
          //    (тоннель), а разовое нажатие (отпустил) — стоим. Избыток мощности бура в движение НЕ переходит.
          this._dugBlock = { x: nx, y: ny }; this._dugBlockT = 0;
        }
        return;
      }
      // ход в воздух (вбок/вниз) — только с опоры; подъём «вверх» обработан выше.
      // НО не въезжаем в ТОЛЬКО ЧТО прокопанный тайл тем же удержанием раньше DRILL_HOLD_ADVANCE
      // (разовое нажатие → стой; держишь дольше → заходишь = непрерывный тоннель).
      if (t.type === AIR && s.canMove && anchored) {
        if (this._dugBlock && this._dugBlock.x === nx && this._dugBlock.y === ny && this._dugBlockT < DRILL_HOLD_ADVANCE) return;
        this._dugBlock = null;
        this.startMove(nx, ny, this.effectiveSpeed()); return;
      }
    }

    // гравитация: без опоры и снизу пусто — падаем
    if (world.tileAt(this.tileX, this.tileY + 1).type === AIR && !anchored) {
      this.startMove(this.tileX, this.tileY + 1, FALL_SPEED);
    }
  }
}
