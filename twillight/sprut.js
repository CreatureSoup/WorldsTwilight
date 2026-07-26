'use strict';

// ЯКОРНЫЕ ЩУПАЛЬЦА «СПРУТА» — ЛОГИКА (без Canvas; рендер — render_sprut.js). Корпус kind:'ring' с
// флагом `def.anchorLegs`: 8 ПРЯМЫХ щупалец-якорей (детали kind:'anchor' в UNIT_DEFS, ang/rad — из редактора).
//
// Нога — стейт-машина: folded (культя у крепления) → fire (выстрел к цели, SPRUT_FIRE_T) → hold (хват; держит,
// пока не растянута ×SPRUT_OVERSTRETCH / породу не выкопали / якорь не «позади» по ходу) → retract → folded…
// Цель — луч-марш от крепления наружу (веер углов вокруг нормали крепления), первый ТВЁРДЫЙ тайл = точка хвата.
// ОТКРЫТОЕ ПРОСТРАНСТВО: с ≥3 сторон по ≥2 тайла воздуха → активны только SPRUT_LEGS_OPEN ног (лучшие по
// близости опоры), остальные складываются; гистерезис SPRUT_OPEN_HYST.
//
// АНИМАЦИОННЫЙ СЛОЙ (батч «живость», 4 фичи):
// · ГРЕБОК — при движении перецепы идут РИТМИЧНОЙ волной по кругу (rig.gaitT/gaitI, период SPRUT_GAIT_PERIOD),
//   а веер выстрела НАКЛОНЯЕТСЯ к направлению хода (микс векторов, SPRUT_GAIT_BIAS) — ноги тянутся вперёд.
// · ПРЫЖОК-«СТРАЖ» («Матрица») — присед на якорях (squat в bodyOff, глубже к отрыву) → отрыв с ИМПУЛЬСОМ
//   корпуса (rig.kick по вектору скорости) → в ВОЗДУХЕ все ноги ШЛЕЙФОМ ЗА корпусом (веер против скорости,
//   SPRUT_TRAIL_LEN/SPREAD, лёгкое трепетание) → приземление: вжатие-kick по вектору падения + залп перецепов.
// · ПОИСКОВЫЕ ДВИЖЕНИЯ — стоя, сложенные ноги медленно покачиваются (SPRUT_SWAY_AMP, гаснет при движении),
//   свободная нога изредка делает холостой ЩУП в пустоту (state 'probe', вылет SPRUT_PROBE_LEN·reach,
//   лапа раскрывается на зависании; один щуп за раз, пауза SPRUT_PROBE_CD).
// · СОСКАЛЬЗЫВАНИЕ — якорь в НЕСТАБИЛЬНОЙ породе (t.unstable) «скребёт» (дрожь лапы L.slipJ) и через
//   SPRUT_SLIP_TIME срывается: отцеп + вздрагивание корпуса (kick от точки срыва) + быстрый перецеп.
// Визуальные направления/длины сложенных ног — L.vdir/L.vlen (плавный лерп к цели), рендер читает ИХ.
// Физику юнита НЕ трогает (чистый визуал, как tentacles.js): опора/клинг/падение решает unit.js.
//
// env-инъекция (мир И превью через один степпер): { cast(x,y,ang)→{x,y,d}|null, openCount()→0..4,
// dx(a,b)→дельта по X (тор/плоско), normX(x), solidAt(x,y), unstableAt(x,y) }. Игровой env — тайл-марш
// по world; превью (редактор/сборка) — аналитическая «камера» из плоскостей (envFromChamber).

const _spWrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

function sprutMakeRig(def, scale) {
  const R = (TILE - 8) / 2;
  const legs = [];
  for (const p of def.parts) {
    if (p.kind !== 'anchor') continue;
    const ang = (p.ang || 0) * Math.PI / 180;
    legs.push({
      id: p.id, ang, rad: (p.rad || 1) * R,
      state: 'folded', t: 0, cd: legs.length * 0.06, chk: 0, active: true,
      ax: 0, ay: 0,          // точка хвата (px пространства вызова)
      rx: 0, ry: 0,          // точка отпускания (старт retract-лерпа)
      hx: 0, hy: 0, dir: 0,  // крепление + мировой угол нормали (пересчёт каждый шаг; читает рендер)
      candD: Infinity,       // дистанция ближайшего кандидата (ранжирование активной четвёрки)
      vdir: ang, vlen: SPRUT_FOLD_LEN, vopen: false,   // ВИЗУАЛ сложенной ноги: направление/длина/раскрытая лапа
      slip: 0, slipJ: 0,     // скольжение по нестабильной породе: накоп + дрожь для рендера
    });
  }
  return { legs, scale: scale || 1, reach: SPRUT_REACH * TILE, bodyOff: { x: 0, y: 0 }, off: { x: 0, y: 0 },
    t: 0, fireGate: 0, openT: 0, selT: 0, wasAir: false, jumpT: 0,
    gaitT: 0, gaitI: 0, kickX: 0, kickY: 0, probeCd: SPRUT_PROBE_CD, lvx: 0, lvy: 1, crouchPrev: 0, tdx: 0, tdy: -1 };
}

// Один шаг рига. (cx,cy) — центр корпуса БЕЗ bodyOff; flip — зеркало взгляда (±1); mvx/mvy — скорость px/с;
// anchored — юнит держится за породу (unit.isAnchored); crouchT — присед перед прыжком (unit.crouchT, счёт ВНИЗ).
function sprutRigStep(rig, dt, cx, cy, flip, env, mvx, mvy, anchored, crouchT) {
  rig.t += dt;
  rig.fireGate = Math.max(0, rig.fireGate - dt);
  rig.kickX *= Math.exp(-dt * 6); rig.kickY *= Math.exp(-dt * 6);   // импульс-выброс корпуса спадает сам
  const spd = Math.hypot(mvx, mvy), moving = spd > 12;
  const mnx = moving ? mvx / spd : 0, mny = moving ? mvy / spd : 0;
  const n = rig.legs.length || 1;

  // 8↔4 с гистерезисом: открытое пространство по правилу «≥3 сторон с >1 тайла воздуха»
  const open = env.openCount() >= 3;
  rig.openT = open ? Math.min(SPRUT_OPEN_HYST, rig.openT + dt) : Math.max(0, rig.openT - dt);
  const mode4 = rig.openT >= SPRUT_OPEN_HYST;

  // ПРЫЖОК-«СТРАЖ»: КАТАПУЛЬТА на истечении приседа (выброс корпуса вверх+по ходу) → фаза подъёма
  // СЧИТАЕТСЯ «воздухом» для слоя ног (airLike: тайловая модель держит isAnchored=true весь подъём —
  // без этого ноги суетились бы перецепами вместо шлейфа) → приземление: вжатие + залп перецепов.
  const _launch = rig.crouchPrev > 0.005 && (crouchT || 0) <= 0.005;           // присед истёк → отрыв В ЭТОМ кадре
  if (_launch) { rig.kickX = mnx * SPRUT_KICK * 0.6 * rig.scale; rig.kickY = -SPRUT_KICK * rig.scale; rig.jumpT = 0.6; }
  if (rig.jumpT > 0) { rig.jumpT -= dt; if (anchored && mvy >= -10 && rig.jumpT < 0.45) rig.jumpT = 0; }   // встал/зацепился — прыжок кончился
  const airLike = !anchored || (rig.jumpT > 0 && mvy < -10);
  if (airLike) { const k = 1 - Math.exp(-dt * 8); rig.lvx += (mvx - rig.lvx) * k; rig.lvy += (mvy - rig.lvy) * k; }
  if (!airLike && rig.wasAir) {
    rig.legs.forEach((L, i) => { L.cd = Math.min(L.cd, i * 0.04); });          // залп перецепов волной
    const lv = Math.hypot(rig.lvx, rig.lvy);
    if (lv > 30) { rig.kickX = rig.lvx / lv * SPRUT_KICK * 0.8 * rig.scale; rig.kickY = rig.lvy / lv * SPRUT_KICK * 0.8 * rig.scale; }   // вжатие ПО ходу удара, отпружинит спадом
    rig.jumpT = 0;
  }
  rig.wasAir = airLike;
  rig.crouchPrev = crouchT || 0;

  // крепления (мировые координаты БЕЗ bodyOff — без обратной связи на подвес)
  for (const L of rig.legs) {
    const dx = Math.cos(L.ang) * flip, dy = Math.sin(L.ang);
    L.hx = cx + dx * L.rad * rig.scale; L.hy = cy + dy * L.rad * rig.scale;
    L.dir = Math.atan2(dy, dx);
  }

  // Активная четвёрка (только mode4): ранжируем по близости опоры — раз в 0.25с (не каждый кадр, 8 кастов)
  rig.selT -= dt;
  if (rig.selT <= 0) {
    rig.selT = 0.25;
    for (const L of rig.legs) { const c = env.cast(L.hx, L.hy, L.dir); L.candD = c ? c.d : Infinity; }
    if (mode4) {
      const order = rig.legs.slice().sort((a, b) => a.candD - b.candD);
      rig.legs.forEach((L) => { L.active = order.indexOf(L) < SPRUT_LEGS_OPEN; });
    } else rig.legs.forEach((L) => { L.active = true; });
  }

  // ГРЕБОК: при устойчивом ходе перецепляем ноги РИТМИЧНОЙ волной по кругу (не ждём перерастяжки)
  if (!airLike && moving) {
    rig.gaitT += dt;
    if (rig.gaitT >= SPRUT_GAIT_PERIOD) {
      rig.gaitT = 0;
      for (let k = 0; k < n; k++) {   // следующая по кругу нога-хват, чей якорь НЕ впереди по ходу
        const L = rig.legs[(rig.gaitI + k) % n];
        if (L.state !== 'hold' || !L.active) continue;
        if (env.dx(L.ax, cx) * mnx + (L.ay - cy) * mny > 0.35 * rig.reach) continue;   // уже вынесен вперёд — не трогаем
        L.state = 'retract'; L.t = 0; L.rx = L.ax; L.ry = L.ay; L.cd = 0.06; L.slip = 0;
        rig.fireGate = SPRUT_STAGGER * 0.5; rig.gaitI = (rig.gaitI + k + 1) % n;
        break;
      }
    }
  } else rig.gaitT = 0;

  // ХОЛОСТОЙ ЩУП: стоя на месте свободная нога изредка «принюхивается» к пустоте (один за раз)
  if (!airLike && !moving) {
    rig.probeCd -= dt;
    if (rig.probeCd <= 0) {
      rig.probeCd = SPRUT_PROBE_CD * (0.8 + 0.4 * Math.random());
      for (let k = 0; k < n; k++) {   // сложенная нога БЕЗ опоры-кандидата или вне активной четвёрки
        const L = rig.legs[(rig.gaitI + k) % n];
        if (L.state === 'folded' && (!L.active || L.candD === Infinity)) { L.state = 'probe'; L.t = 0; rig.gaitI = (rig.gaitI + k + 1) % n; break; }
      }
    }
  }

  // ВИЗУАЛ сложенных ног: покачивания (idle) / ШЛЕЙФ за корпусом (воздух/прыжок) / профиль щупа — плавный лерп
  const idleF = !airLike ? Math.max(0, 1 - spd / 40) : 0;
  if (airLike) {   // направление шлейфа = ПРОТИВ скорости (корпус летит вперёд, щупальца позади)
    const lv = Math.hypot(rig.lvx, rig.lvy);
    if (lv > 30) { const k = 1 - Math.exp(-dt * 10); rig.tdx += (-rig.lvx / lv - rig.tdx) * k; rig.tdy += (-rig.lvy / lv - rig.tdy) * k; }
  }
  const trailA = Math.atan2(rig.tdy, rig.tdx), kV = 1 - Math.exp(-dt * 10);
  rig.legs.forEach((L, i) => {
    let tvd, tvl, tvo = false;
    if (airLike) {   // ШЛЕЙФ: веер против хода + трепетание
      tvd = trailA + ((i - (n - 1) / 2) / Math.max(1, (n - 1) / 2)) * SPRUT_TRAIL_SPREAD + Math.sin(rig.t * 6 + i * 1.7) * 0.06;
      tvl = SPRUT_TRAIL_LEN * (0.85 + 0.15 * Math.sin(rig.t * 5 + i));
    } else {           // ПОКОЙ: лёгкое «принюхивание» вокруг нормали крепления
      tvd = L.dir + Math.sin(rig.t * 1.35 + i * 2.1) * SPRUT_SWAY_AMP * idleF;
      tvl = SPRUT_FOLD_LEN * (1 + 0.18 * Math.sin(rig.t * 1.05 + i * 1.3) * idleF);
    }
    if (L.state === 'probe') {   // профиль щупа: вылет → зависание (лапа раскрыта, дрожит) → возврат
      const pl = rig.reach * SPRUT_PROBE_LEN, q = L.t;
      if (q < 0.25) { const e = 1 - Math.pow(1 - q / 0.25, 3); tvl = tvl + (pl - tvl) * e; }
      else if (q < 0.55) { tvl = pl + Math.sin(rig.t * 9 + i) * 2; tvo = true; }
      else { const e = Math.min(1, (q - 0.55) / 0.25); tvl = pl + (SPRUT_FOLD_LEN - pl) * e * e; }
    }
    L.vdir += _spWrapA(tvd - L.vdir) * kV; L.vlen += (tvl - L.vlen) * kV; L.vopen = tvo;
  });

  for (const L of rig.legs) {
    L.cd = Math.max(0, L.cd - dt);
    if (L.state === 'probe') {
      L.t += dt;
      if (!anchored || moving || L.t >= 0.8) { L.state = 'folded'; L.t = 0; }   // щуп закончен/прерван (vlen доедет лерпом)
      continue;
    }
    if (L.state === 'hold') {
      // юнит в воздухе/прыжке (airLike) / нога вне активной четвёрки → отпустить (все хваты рвутся на отрыве — шлейф)
      if (airLike || !L.active) { L.state = 'retract'; L.t = 0; L.rx = L.ax; L.ry = L.ay; L.cd = SPRUT_REFIRE_CD; L.slip = 0; continue; }
      L.chk += dt;
      if (L.chk >= 0.1) {
        L.chk = 0;
        const dx = env.dx(L.ax, L.hx), dy = L.ay - L.hy, d = Math.hypot(dx, dy);
        const solid = env.solidAt ? env.solidAt(L.ax, L.ay) : true;
        const hard = !solid || d > rig.reach * 1.35;                          // порода выкопана / совсем порвало
        let soft = d > rig.reach * SPRUT_OVERSTRETCH;                          // мягкая перерастяжка
        if (!soft && moving && env.dx(L.ax, cx) * mnx + (L.ay - cy) * mny < -SPRUT_BEHIND_FRAC * rig.reach) soft = true;   // якорь «позади» по ходу
        // СОСКАЛЬЗЫВАНИЕ: лапа на нестабильной породе скребёт и срывается
        if (env.unstableAt && env.unstableAt(L.ax, L.ay)) {
          L.slip += 0.1;
          if (L.slip >= SPRUT_SLIP_TIME) {
            const ddx = env.dx(L.ax, cx), ddy = L.ay - cy, dd = Math.hypot(ddx, ddy) || 1;
            rig.kickX -= ddx / dd * 2.5 * rig.scale; rig.kickY -= ddy / dd * 2.5 * rig.scale;   // корпус вздрагивает ОТ точки срыва
            L.state = 'retract'; L.t = 0; L.rx = L.ax; L.ry = L.ay; L.cd = 0.12; L.slip = 0;
            continue;
          }
        } else L.slip = 0;
        if (hard || (soft && L.cd <= 0 && rig.fireGate <= 0)) {
          L.state = 'retract'; L.t = 0; L.rx = L.ax; L.ry = L.ay; L.cd = SPRUT_REFIRE_CD; L.slip = 0;
          if (!hard) rig.fireGate = SPRUT_STAGGER;                             // мягкий перецеп — в очередь волны
        }
      }
      L.slipJ = L.slip > 0 ? Math.sin(rig.t * 42 + L.hx) * 1.4 * Math.min(1, L.slip / SPRUT_SLIP_TIME) : 0;   // дрожь для рендера
    } else if (L.state === 'fire') {
      L.t += dt;
      if (L.t >= SPRUT_FIRE_T) { L.state = 'hold'; L.chk = 0; L.slip = 0; }
    } else if (L.state === 'retract') {
      L.t += dt;
      if (L.t >= SPRUT_RETRACT_T) { L.state = 'folded'; L.t = 0; }
    } else {   // folded: попытка выстрела (только активная, НЕ в полёте/прыжке, по кулдауну и очереди волны)
      if (L.active && !airLike && anchored && L.cd <= 0 && rig.fireGate <= 0) {
        // ГРЕБОК: при движении веер выстрела наклоняется К ходу (микс вектора нормали и вектора скорости)
        let base = L.dir;
        if (moving) base = Math.atan2(Math.sin(L.dir) + mny * SPRUT_GAIT_BIAS, Math.cos(L.dir) + mnx * SPRUT_GAIT_BIAS);
        let hit = null;
        for (const off of [0, -0.3, 0.3, -0.6, 0.6]) {                         // веер вокруг базового угла
          hit = env.cast(L.hx, L.hy, base + off); if (hit) break;
        }
        if (hit) { L.state = 'fire'; L.t = 0; L.ax = env.normX(hit.x); L.ay = hit.y; rig.fireGate = SPRUT_STAGGER; }
        else L.cd = 0.15;                                                      // опоры нет — поищем чуть позже
      }
    }
  }

  // ПОДВЕС корпуса: тяга к натянутым якорям + «дыхание» + ПРИСЕД перед прыжком; финал rig.off = подвес + kick
  let ox = 0, oy = 0;
  for (const L of rig.legs) {
    if (L.state !== 'hold') continue;
    const dx = env.dx(L.ax, L.hx), dy = L.ay - L.hy, d = Math.hypot(dx, dy) || 1;
    const err = Math.max(0, d / rig.reach - 0.45);                             // натянута дальше «покоя» → тянет
    ox += (dx / d) * err * SPRUT_BODY_SWAY * 2; oy += (dy / d) * err * SPRUT_BODY_SWAY * 2;
  }
  oy += Math.sin(rig.t * 1.8) * 0.8;
  const cap = SPRUT_BODY_SWAY * rig.scale, m = Math.hypot(ox, oy);
  if (m > cap) { ox *= cap / m; oy *= cap / m; }
  const cT = (typeof JUMP_CROUCH_T !== 'undefined') ? JUMP_CROUCH_T : 0.09;
  const squat = (anchored && crouchT > 0) ? (1 - Math.min(1, crouchT / cT)) : 0;   // глубже к моменту отрыва
  oy += squat * SPRUT_SQUAT * rig.scale;
  const k = 1 - Math.exp(-dt * (squat > 0 ? 18 : 7));                          // присед короткий (0.09с) — лерп быстрее
  rig.bodyOff.x += (ox - rig.bodyOff.x) * k; rig.bodyOff.y += (oy - rig.bodyOff.y) * k;
  rig.off.x = rig.bodyOff.x + rig.kickX; rig.off.y = rig.bodyOff.y + rig.kickY;
}

// ---- ИГРОВАЯ обвязка (модульное состояние, как _legRig у tentacles) ----
let _spRig = null, _spUnit = null;
function sprutRig() { return _spRig; }
function sprutBodyOffset() { return _spRig ? { x: _spRig.off.x, y: _spRig.off.y } : { x: 0, y: 0 }; }
function updateSprutLegs(dt, unit, world) {
  const def = (typeof UNIT_DEFS !== 'undefined') && UNIT_DEFS[unit.hull];
  if (!def || !def.anchorLegs) return;
  const scale = (typeof unitDrawScale === 'function') ? unitDrawScale(unit) : 1;
  if (!_spRig || _spUnit !== unit) { _spRig = sprutMakeRig(def, scale); _spUnit = unit; _spRig._ppx = unit.px; _spRig._ppy = unit.py; }
  const rig = _spRig, reach = rig.reach;
  const env = {
    dx: (a, b) => wrapDeltaPx(a, b),
    normX: (x) => ((x % WORLD_W) + WORLD_W) % WORLD_W,
    solidAt: (x, y) => isSolid(world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE))),
    unstableAt: (x, y) => { const t = world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE)); return !!(t && t.unstable); },
    cast(x, y, ang) {   // тайл-марш до первого твёрдого (шаг TILE/3 — тайл не перепрыгнет)
      const step = TILE / 3, c = Math.cos(ang), s = Math.sin(ang);
      for (let d = step; d <= reach; d += step) {
        const px = x + c * d, py = y + s * d;
        if (isSolid(world.tileAt(Math.floor(px / TILE), Math.floor(py / TILE)))) return { x: px, y: py, d };
      }
      return null;
    },
    openCount() {
      const tx = unit.tileX, ty = unit.tileY, air = (x, y) => !isSolid(world.tileAt(x, y));
      let n = 0;
      if (air(tx - 1, ty) && air(tx - 2, ty)) n++;
      if (air(tx + 1, ty) && air(tx + 2, ty)) n++;
      if (air(tx, ty - 1) && air(tx, ty - 2)) n++;
      if (air(tx, ty + 1) && air(tx, ty + 2)) n++;
      return n;
    },
  };
  let mvx = wrapDeltaPx(unit.px, rig._ppx) / Math.max(dt, 1e-4), mvy = (unit.py - rig._ppy) / Math.max(dt, 1e-4);
  if (Math.abs(unit.px - rig._ppx) > TILE * 2 || Math.abs(unit.py - rig._ppy) > TILE * 2) { mvx = 0; mvy = 0; }   // телепорт/респавн
  rig._ppx = unit.px; rig._ppy = unit.py;
  // РАПЕЛЬ: вис на тросе = «заякорен» для слоя ног (верхние сами дотянутся до кромки подвеса — cast честный;
  // без этого вис уводил бы ноги в шлейф-режим полёта).
  const anch = unit.isAnchored(world) || (typeof unit._rappelHold === 'function' && unit._rappelHold(world));
  sprutRigStep(rig, dt, unit.px, unit.py, unit._ringFlip ? -1 : 1, env, mvx, mvy, anch, unit.crouchT || 0);
}

// ---- ПРЕВЬЮ-обвязка (редактор/сборка): аналитическая «камера» из плоскостей, свои часы ----
// chamber: { floorY, ceilY, wallL, wallR } в design-px относительно центра корпуса (любое поле можно опустить).
const _spPrev = {};   // key → rig (кэш по контексту 'editor'/'inv' + корпус)
function envFromChamber(ch) {
  const planes = [];
  if (ch.floorY != null) planes.push({ nx: 0, ny: 1, d: ch.floorY });
  if (ch.ceilY != null) planes.push({ nx: 0, ny: -1, d: -ch.ceilY });
  if (ch.wallR != null) planes.push({ nx: 1, ny: 0, d: ch.wallR });
  if (ch.wallL != null) planes.push({ nx: -1, ny: 0, d: -ch.wallL });
  return {
    dx: (a, b) => a - b, normX: (x) => x, solidAt: () => true, unstableAt: () => false,
    cast(x, y, ang) {
      const c = Math.cos(ang), s = Math.sin(ang);
      let best = null;
      for (const p of planes) {
        const denom = c * p.nx + s * p.ny; if (denom <= 1e-6) continue;        // луч от плоскости
        const d = (p.d - (x * p.nx + y * p.ny)) / denom;
        if (d > 0 && (!best || d < best.d)) best = { x: x + c * d, y: y + s * d, d };
      }
      return best && best.d <= SPRUT_REACH * TILE ? best : null;
    },
    openCount: () => 0,   // превью всегда в «камере» → режим 8 ног
  };
}
function sprutPreviewStep(key, unit, def, chamber) {
  let rig = _spPrev[key];
  const anchors = def.parts.filter((p) => p.kind === 'anchor');
  if (!rig || rig._hull !== unit.hull || rig.legs.length !== anchors.length) { rig = _spPrev[key] = sprutMakeRig(def, 1); rig._hull = unit.hull; rig._pt = 0; }
  else {   // редактор двигает крепления (ang/rad) живьём → синхрон in-place, состояния ног не сбрасываем
    const R = (TILE - 8) / 2, byId = {};
    for (const p of anchors) byId[p.id] = p;
    for (const L of rig.legs) { const p = byId[L.id]; if (p) { L.ang = (p.ang || 0) * Math.PI / 180; L.rad = (p.rad || 1) * R; } }
  }
  const now = performance.now() / 1000, dt = Math.min(0.05, rig._pt ? now - rig._pt : 1 / 60);
  rig._pt = now;
  sprutRigStep(rig, dt, 0, 0, unit.faceX === -1 ? -1 : 1, envFromChamber(chamber), 0, 0, true, 0);
  return rig;
}
