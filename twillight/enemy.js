'use strict';

// Enemy — враждебный юнит диких гнёзд, 13 типов (digger/collector/raider/hunter/hacker/sniper/
// swarm_midge/lurker/mine_planter/mender/siege_ram/siege_mortar/blight_sower — мозги в ai.js,
// рендер в render_enemy.js, тюнинг в constants.js). Локомоция общая (клинг к породе, гравитация,
// копание настоящих тоннелей — наземные; ENEMY_FLYERS летают по готовым ходам), поведение задаёт
// `game` (стейт/цель). Базовые роли: копатель ищет города, собиратель таскает ресурс в гнездо.
// Без опоры и снизу воздух — падает. Ход в воздух только если в точке назначения есть
// опора (клинг) → в открытом пространстве ползёт по краям до дальней стенки и копает там.
// ⚠️ ТЮНИНГ-КОНСТАНТЫ (ENEMY_*/RAIDER_*/HUNTER_*/SNIPER_* и пр.) ПЕРЕЕХАЛИ в constants.js — секция «ВРАГИ: БАЗОВЫЕ ТИПЫ» (audit_2026-08: один домен — один реестр).
// Летающие типы: по воздуху-тоннелям, без гравитации/клинга, НЕ копают (как рейдер). hacker/sniper — заделы (ниже).
const ENEMY_FLYERS = { raider: 1, hunter: 1, hacker: 1, sniper: 1, swarm_midge: 1, mender: 1, siege_ram: 1, siege_mortar: 1 };   // mine_planter/lurker/blight_sower — НАЗЕМНЫЕ (копают/сидят в породе)

class Enemy {
  constructor(x, y, type, homeX, homeY, homeR) {
    this.tileX = x; this.tileY = y;
    this.px = x * TILE + TILE / 2; this.py = y * TILE + TILE / 2;
    this.type = type;                 // digger|collector|raider|hunter|hacker|sniper | mine_planter|lurker|swarm_midge|mender|siege_ram|siege_mortar|blight_sower
    this.maxHp = ENEMY_HP_BY_TYPE[type] || ENEMY_HP; this.hp = this.maxHp;   // прочность по роли (задел под перехват/бой)
    this.speed = type === 'raider' ? RAIDER_SPEED : ENEMY_SPEED;
    this.homeX = homeX; this.homeY = homeY;
    this.homeR = homeR || 1;          // радиус «дома»: гнездо — открытая каверна, точный центр недостижим (клинг/гравитация)
    this.state = 'seek';              // seek | return | goresource
    this.target = null;              // {x,y} для goto, иначе null → блуждание
    this.carry = null;               // ресурс у собирателя
    this.draining = false; this.drainT = 0;  // разведчик у города: фаза «заполнения» перед кражей
    this.scan = 0; this.scanned = false;      // прогресс сканирования врага игроком (0..1) → данные кодекса (разово)
    this.dead = false;
    this.dying = false; this.deathT = 0; this._fx = false;   // уничтожение: фаза анимации (обломки/искры) до чистки
    this.stunT = 0; this.slowT = 0;   // ЭМИ-стан (заморозка) / глушилка-замедление (структуры игрока)
    this.knockT = 0; this.knockVx = 0; this.knockVy = 0;   // ОТБРОС отталкивателем (плавное смещение по скорости)
    this.state2 = IDLE; this.fromX = x; this.fromY = y; this.toX = x; this.toY = y; this.progress = 0;
    this.dx = 0; this.dy = 1; this.drilling = false;
    this.dug = null;                 // выкопанная жила {x,y,type}: game роняет лутом (копатель не «съедает» ресурс)
    this.heading = Math.random() * Math.PI * 2;
    this.seed = Math.random() * 1000;
    this.lastDir = { x: 0, y: 0 };
    this.commit = null;
    this.recent = [];                // недавние тайлы (анти-петля: не кружить в полости)
    this.cstate = null; this.cT = 0; this.cvx = 0; this.cvy = 0; this.cHit = false; this.cBlocked = false; // охотник: фаза тарана (approach|wind|charge|recover)
  }
  startMove(nx, ny) { this.fromX = this.tileX; this.fromY = this.tileY; this.toX = nx; this.toY = ny; this.progress = 0; this.state2 = MOVING; }
  damage(n) { if (this.dying) return; this.hp -= n; if (this.hp <= 0) { this.hp = 0; this.dying = true; this.deathT = ENEMY_DEATH_TIME; } }
  lerpAngle(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
  anchoredAt(world, x, y) {
    return isSolid(world.tileAt(x - 1, y)) || isSolid(world.tileAt(x + 1, y))
        || isSolid(world.tileAt(x, y - 1)) || isSolid(world.tileAt(x, y + 1));
  }
  passable(world, dx, dy) {
    const ny = this.tileY + dy;
    if (this.type === 'digger' && ny < DIGGER_MIN_Y) return false; // копатель не лезет в верхние слои-страты и на поверхность
    const t = world.tileAt(this.tileX + dx, ny).type;
    if (t === ROCK) return !ENEMY_FLYERS[this.type];              // летающие (рейдер/охотник/…) НЕ копают — только по готовым ходам
    if (t === AIR) return !!ENEMY_FLYERS[this.type] || this.anchoredAt(world, this.tileX + dx, this.tileY + dy); // летающие лёгкие — по воздуху; прочим нужна опора
    return false;                                                 // неразрушимое/край
  }
  // Блуждание (без цели). КОПАТЕЛЬ ниже городского диапазона — поднимается в него; внутри —
  // ГОРИЗОНТАЛЬНЫЙ СВИП (на торе обойдёт все X → найдёт города на любой долготе) с лёгким
  // вертикальным дрейфом по шуму (охват глубин диапазона). Постоянная тяга вверх пинила копателя в
  // локальный минимум у потолка, и города на других X не находились. Прочие враги — прежний flow-вандер.
  wanderDir(world) {
    if (this.type === 'digger') {
      if (this.tileY > DIGGER_MAX_Y) {
        this.heading = this.lerpAngle(this.heading, -Math.PI / 2, 0.3);          // ниже диапазона — вверх в него
      } else {
        if (!this.sweepSign) this.sweepSign = (this.seed | 0) % 2 ? 1 : -1;       // постоянное направление свипа
        // свип вбок + ТЯГА ВВЕРХ → лесенка снизу вверх по диапазону: охватывает все глубины (находит
        // глубокие города по пути) и доходит до базы у потолка. Шум качает вертикаль → чередование
        // «вбок/вверх» (а не прямая линия). Уперевшись в потолок (DIGGER_MIN_Y) — чисто вбок над базой.
        // КРУТОЙ подъём к ВЕРХУ диапазона (там база), затем — горизонтальный свип у потолка
        // (`DIGGER_MIN_Y`) по долготам до базы. Скорость бурения та же — путь лишь более вертикальный
        // (меньше тайлов до верха), поэтому до базы доходит быстрее и стабильнее (меньше «лесенки» в середине).
        const atTop = this.tileY <= DIGGER_MIN_Y + 4;
        const vy = atTop ? (world.pnoise(this.tileX + this.seed, this.tileY, FLOW_SCALE) - 0.5) * 0.5 - 0.15  // у потолка — почти вбок (свип по долготам)
                         : (world.pnoise(this.tileX + this.seed, this.tileY, FLOW_SCALE) - 0.5) * 0.65 - 1.10; // ниже — вверх (тюнинг: время до базы ≈ целевое окно)
        this.heading = this.lerpAngle(this.heading, Math.atan2(vy, this.sweepSign), 0.3);
      }
      const hx = Math.cos(this.heading), hy = Math.sin(this.heading);
      // heading — ГЛАВНЫЙ критерий (иначе анти-петля `seen` перебивала тягу и копатель не лез вверх по
      // своему недавнему столбцу); rank() и так не даёт развернуться назад. `old` — слабый добор: не
      // перерывать собственные ходы при равном направлении (расползание на новые глубины).
      return this.rank(world, (dx, dy) => {
        const tile = world.tileAt(wrapX(this.tileX + dx), this.tileY + dy);
        const old = (tile.type === AIR && tile.dug) ? 1 : 0;
        return [-(dx * hx + dy * hy), old];
      });
    }
    const f = world.pnoise(this.tileX + this.seed, this.tileY, FLOW_SCALE);
    this.heading = this.lerpAngle(this.heading, this.lerpAngle(f * TAU, -Math.PI / 2, UP_BIAS), 0.25);
    const hx = Math.cos(this.heading), hy = Math.sin(this.heading);
    const nearCrust = this.tileY > SURFACE_ROWS && this.tileY <= CRUST_Y1 + 1;
    return this.rank(world, (dx, dy) => {
      const tx = wrapX(this.tileX + dx), ty = this.tileY + dy, tile = world.tileAt(tx, ty);
      const along = nearCrust && dy === 0 ? 1 : 0;
      const seen = this.recent.includes(tx + ',' + ty) ? 1 : 0;
      const old = (tile.type === AIR && tile.dug) ? 1 : 0;
      const air = tile.type === AIR ? 0 : 1;
      return [along, seen, old, -(dx * hx + dy * hy), air];
    });
  }
  // К цели (знаем координаты): по сокращению тороидальной дистанции; воздух в приоритете.
  gotoDir(world, tx, ty, airFirst) {
    const cur = this.dist(tx, ty);
    return this.rank(world, (dx, dy) => {
      const nx = this.tileX + dx, ny = this.tileY + dy;
      const nd = this.distFrom(nx, ny, tx, ty);
      const seen = this.recent.includes(wrapX(nx) + ',' + ny) ? 1 : 0; // тупик у препятствия → обходим непосещённым
      const air = world.tileAt(nx, ny).type === AIR ? 0 : 1;
      // airFirst (возврат копателя): СНАЧАЛА открытый ход (свой тоннель домой), потом ближе — чтобы идти
      // пешком по уже прорытому, а не долбить новую прямую в крусты и застревать.
      return airFirst ? [air, nd - cur, seen] : [nd - cur, seen, air];   // обычно: ближе → непосещённое → воздух
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
    const slowMul = this.slowT > 0 ? JAM_SLOW : 1;   // глушилка замедляет всё движение/копку
    if (this.slowT > 0) this.slowT = Math.max(0, this.slowT - dt);
    // ОТБРОС отталкивателем: ПЛАВНОЕ смещение по скорости (не телепорт), приоритет над всеми состояниями; упор в породу — стоп на краю.
    if (this.knockT > 0) {
      this.knockT -= dt;
      const nx = wrapPx(this.px + this.knockVx * dt), ny = this.py + this.knockVy * dt;
      const ntx = wrapX(Math.round((nx - TILE / 2) / TILE)), nty = Math.round((ny - TILE / 2) / TILE);
      if (isSolid(world.tileAt(ntx, nty))) { this.knockT = 0; }   // впереди порода — не вдавливаемся, гасим отброс
      else { this.px = nx; this.py = ny; this.tileX = ntx; this.tileY = nty; }
      return;
    }
    // ОХОТНИК в боевой фазе: рывок/отскок — свободное движение по px (без тайл-локомоции); телеграф — стоит.
    if (this.cstate === 'charge' || this.cstate === 'recover') {
      this.px = wrapPx(this.px + this.cvx * slowMul * dt); this.py += this.cvy * slowMul * dt;
      this.tileX = wrapX(Math.round((this.px - TILE / 2) / TILE)); this.tileY = Math.round((this.py - TILE / 2) / TILE);
      if (isSolid(world.tileAt(this.tileX, this.tileY))) this.cBlocked = true;   // упор в породу → мозг переведёт в recover
      return;
    }
    if (this.cstate === 'wind') return;
    if (this.state2 === MOVING) {
      this.progress += this.speed * slowMul * dt;
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
    if (this.draining) return;   // стоит у цели (рейдер высасывает / хакер взламывает) — не двигается
    // гравитация: без опоры и снизу воздух — падаем (летающие — лёгкие, не падают)
    if (!ENEMY_FLYERS[this.type] && !this.anchoredAt(world, this.tileX, this.tileY) && world.tileAt(this.tileX, this.tileY + 1).type === AIR) {
      this.dx = 0; this.dy = 1; this.startMove(this.tileX, this.tileY + 1); this.commit = null; return;
    }
    if (!this.commit) this.commit = this.target ? this.gotoDir(world, this.target.x, this.target.y, this._returning) : this.wanderDir(world);
    if (!this.commit) return;
    const dx = this.commit.x, dy = this.commit.y; this.dx = dx; this.dy = dy;
    const nx = this.tileX + dx, ny = this.tileY + dy, t = world.tileAt(nx, ny);
    if (t.type === AIR) { this.startMove(nx, ny); return; }
    if (t.type === ROCK) {
      this.drilling = true; t.dig += ENEMY_DIG * slowMul * dt;
      if (t.dig >= digThreshold(t)) {
        if (t.resource) this.dug = { x: wrapX(nx), y: ny, type: t.resource }; // жилу не теряем — game уронит лутом
        world.setAir(nx, ny); this.startMove(nx, ny);
      }
      return;
    }
    this.commit = null;                                          // уперлись в неразрушимое
  }
}
