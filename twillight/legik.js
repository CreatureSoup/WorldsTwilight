'use strict';

// Общий движок IK-ног (FABRIK) — ОДИН код для игры и редактора (WYSIWYG). Нога строится
// из КОНФИГА: точка крепления `hipOff` (от центра юнита, px), направление `dir`, длины
// сегментов `segLens` (px, переменные), спрайты на сегмент `spriteIds` (PART_SPRITES).
// Поведение: ready (вьётся) → stab (выстрел в РЕАЛЬНУЮ поверхность) → hold → retract.
// Правила: НЕ лезут в породу; ≥`LEGIK_MIN` всегда воткнуты (держат корпус). Синхрон с
// движением (скорость → планируют опору по ходу). `bodyOff` — корпус едет на ногах.

const LEGIK_MIN = 2;
const LEGIK_STAND = 0.3;                         // высота стойки в долях тайла: корпус приподнят над опорой, ноги тянутся ВНИЗ к полу (не «летает»). Больше → выше стоит, но меньше вынос ног ВПЕРЁД (короткие ноги)
const LEGIK_BEND = 7;                            // «вывих» колена в сторону (px, pole-вектор): сгиб разных ног в РАЗНЫЕ стороны, иначе все складываются одинаково
// SQUASH (присед/приземление): пружина просадки корпуса к опоре. `crouch` — глубина приседа перед
// прыжком (корпус сначала ВНИЗ); `landK`/`landMax` — просадка по инерции на ударе ∝ скорости падения;
// `stiff`/`damp` — недодемпфированная пружина (после приседа отыгрывает ВВЕРХ; после удара — назад).
const LEGIK_SQUASH = { crouch: 16, stiff: 170, damp: 13, landK: 0.1, landMax: 16, clamp: 22, landMinVel: 270 };  // landMinVel: «удар» только при настоящем падении (быстрее контролируемого хода/бурения) — иначе просадка на каждом шаге. landMax/crouch — БАЗА для полноразмерного юнита, скейлится drawScale.
let _legikProc = false;                          // отладка: рисовать ПРОЦЕДУРНО (капсулы), игнорируя спрайты
function legikProcedural(on) { _legikProc = !!on; }

function _ikSolid(world, x, y) { return !!world && isSolid(world.tileAt(Math.floor(x / TILE), Math.floor(y / TILE))); }
function _ikLerpAng(a, b, f) { let d = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return a + d * f; }
// Предпочитаем НАПРАВЛЕНИЕ `dir` (веер ОТ ЦЕНТРА наружу, берём первый хит) → опора ровно
// туда, куда целимся (ВПЕРЕДИ при ходьбе), а не просто ближайшую (иначе на полу всегда
// «прямо вниз» и опора не уходит вперёд). Контакт — НА границе породы (видимая кромка
// утоплена внутрь сеточной на ~эрозию `_ragDepth`≈0.16 тайла, см. render_world): ставим стопу
// ВНУТРЬ камня на чуть, чтобы доставала до ВИДИМОЙ поверхности; глубже скрывает окклюзия
// (щупальца клипуются по видимому воздуху, drawTentacles). Иначе нога «висела» в воздухе.
function _ikSurface(world, ax, ay, dir, reach) {
  for (const k of [0, 1, -1, 2, -2, 3, -3]) {
    const a = dir + k * 0.34, dx = Math.cos(a), dy = Math.sin(a);
    for (let d = TILE * 0.34; d <= reach; d += TILE * 0.24) {
      if (_ikSolid(world, ax + dx * d, ay + dy * d)) {
        const cd = d + TILE * 0.12;   // ВНУТРЬ камня (к видимой кромке); излишек прячет окклюзия
        return { x: ax + dx * cd, y: ay + dy * cd };
      }
    }
  }
  return null;
}
function _ikFabrik(pts, ax, ay, target, segLens, iters) {
  const n = pts.length;
  for (let it = 0; it < iters; it++) {
    pts[n - 1].x = target.x; pts[n - 1].y = target.y;
    for (let i = n - 2; i >= 0; i--) { const L = segLens[i], dx = pts[i].x - pts[i + 1].x, dy = pts[i].y - pts[i + 1].y, r = L / (Math.hypot(dx, dy) || 1e-6); pts[i].x = pts[i + 1].x + dx * r; pts[i].y = pts[i + 1].y + dy * r; }
    pts[0].x = ax; pts[0].y = ay;
    for (let i = 1; i < n; i++) { const L = segLens[i - 1], dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, r = L / (Math.hypot(dx, dy) || 1e-6); pts[i].x = pts[i - 1].x + dx * r; pts[i].y = pts[i - 1].y + dy * r; }
  }
}
function _ikAvoidRock(world, pts) {
  if (!world) return;
  for (let i = 1; i < pts.length - 1; i++) {
    if (!_ikSolid(world, pts[i].x, pts[i].y)) continue;
    let found = null, fd = 1e9;
    for (let r = TILE * 0.34; r <= TILE * 1.3 && !found; r += TILE * 0.34)
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, x = pts[i].x + Math.cos(a) * r, y = pts[i].y + Math.sin(a) * r; if (!_ikSolid(world, x, y) && r < fd) { fd = r; found = { x, y }; } }
    if (found) { pts[i].x = found.x; pts[i].y = found.y; }
  }
}

// configs: [{ hipOff:{x,y}, dir, segLens:[px..], spriteIds:[id..] }]
function makeLegRig(configs, drawScale) {
  const legs = configs.map((c) => {
    const segLens = c.segLens.slice(), reach = segLens.reduce((a, b) => a + b, 0);
    return { hipOff: c.hipOff, dir: c.dir, spriteIds: c.spriteIds || null, segLens, n: segLens.length, reach,
      pts: [], tip: null, phase: 'ready', t: Math.random() * 1.0, dur: 0.4 + Math.random() * 1.0,
      goal: null, anchor: null, wander: Math.random() * 6.283, seed: Math.random() * 6.283, plantT: 99,
      stance: 0, up: false, bend: Math.sign(c.hipOff.x) || 1, bendUp: 0, releaseR: 0.9 };   // releaseR: на ходу держим стопу, пока не растянулась до этой доли reach (рандом по шагам — отрыв не синхронный)
  });
  // СТАНЦ-СЛОТЫ: равномерный разнос стоп ВДОЛЬ опоры в idle, чтобы ноги не слипались.
  // Сортируем по продольному креплению (hipOff.x) → слот рядом со своим бедром (мало тянуться).
  const order = legs.map((_, i) => i).sort((a, b) => legs[a].hipOff.x - legs[b].hipOff.x);
  const N = legs.length;
  order.forEach((idx, rank) => {
    legs[idx].stance = N > 1 ? (rank / (N - 1) - 0.5) * 1.1 : 0;   // [-0.55..0.55] тайла
    legs[idx].up = Math.sin(legs[idx].dir) < -0.1;                 // верхний сектор (тянется к потолку, если он есть)
  });
  // drawScale (= UNIT_DRAW_SCALE в игре): спрайты сегментов ужимаются вместе с костями (segLens уже
  // отмасштабированы в legConfigsFromUnit). Иначе спрайт рисуется в абсолютных sp.w px и не совпадает
  // с укороченной костью — как в редакторе (там общий ctx.scale(zoom)). Редактор зовёт без → 1.
  return { legs, prev: null, vel: { x: 0, y: 0 }, bodyOff: { x: 0, y: 0 }, supportAngle: 0, drawScale: drawScale || 1 };  // supportAngle: куда «низ» ног (0=вниз, -PI/2=стена справа, PI=потолок)
}

// cx,cy — центр корпуса (px, мир). walkVel — {x,y} px/с (если null, считается из delta cx,cy).
function updateLegRig(rig, dt, cx, cy, world, walkVel) {
  const t = performance.now() / 1000;
  if (!rig.prev) rig.prev = { x: cx, y: cy };
  const vx = walkVel ? walkVel.x : (cx - rig.prev.x) / Math.max(dt, 1e-3);
  const vy = walkVel ? walkVel.y : (cy - rig.prev.y) / Math.max(dt, 1e-3);
  rig.vel.x += (vx - rig.vel.x) * Math.min(1, dt * 12); rig.vel.y += (vy - rig.vel.y) * Math.min(1, dt * 12);
  rig.prev.x = cx; rig.prev.y = cy;
  const speed = Math.hypot(rig.vel.x, rig.vel.y), moving = speed > 10, velAng = Math.atan2(rig.vel.y, rig.vel.x), moveF = Math.min(1, speed / (TILE * 3));
  // ВЗМАХ МАСШТАБИРУЕТСЯ СО СКОРОСТЬЮ: быстрее юнит (апгрейды привода) → короче замах/выстрел/перенос
  // → нога быстрее возвращается на землю → доля опоры (вес) держится РОВНОЙ на любой скорости.
  const swingScale = Math.max(0.5, Math.min(1, (TILE * 3) / (speed || 1)));   // 1 на базовой 3 т/с, ~0.6 на макс-апгрейде 5 т/с
  const s = rig.drawScale || 1;   // масштаб юнита: амплитуды «веса»/лага/просадки в ПИКСЕЛЯХ скейлятся, иначе мелкий юнит «сильно проседает»
  const stepBob = Math.sin(t * (2.4 + speed * 0.02)) * (0.8 + moveF * 0.8) * s;   // спокойнее, чтобы не «плавать»
  // КОРПУС: лаг по ходу (вес) + СТОЙКА (приподнят на LEGIK_STAND «вверх ОТ ОПОРЫ») + «ВЕС» —
  // ВЕРТИКАЛЬНОЕ покачивание ВДОЛЬ оси опоры. Поскольку и рендер корпуса (dy), и КОРНИ ног
  // (hip = cy+hoy+bodyOff.y) берут bodyOff.y, а стопы ПРИБИТЫ → корпус «продавливает» ноги вниз
  // и возвращается: ноги сгибаются/разгибаются СИНХРОННО с корпусом (вес на щупальцах). Дёшево:
  // одна синусоида; собственное «дыхание» рига отключено (noBob), чтобы корпус и ноги не расходились.
  const sa0 = rig.supportAngle || 0, upx = -Math.cos(Math.PI / 2 + sa0), upy = -Math.sin(Math.PI / 2 + sa0), stand = TILE * LEGIK_STAND;
  const weight = Math.sin(t * 1.8) * 4.0 * s * (1 - 0.3 * moveF) + stepBob * moveF;   // «вес»: дыхание (всегда, чуть тише на ходу) + походка
  const bxT = (-rig.vel.x / (speed || 1)) * Math.min(16, speed * 0.1) * s + upx * (stand + weight);
  const byT = upy * (stand + weight);
  if (rig._baseX == null) { rig._baseX = bxT; rig._baseY = byT; }
  rig._baseX += (bxT - rig._baseX) * Math.min(1, dt * 6);
  rig._baseY += (byT - rig._baseY) * Math.min(1, dt * 8);
  // SQUASH-ПРУЖИНА (присед перед прыжком + просадка на приземлении). sq>0 = корпус ПРОСЕЛ к опоре.
  // Драйв: приседаем под `crouch` пока `crouchT>0` (корпус ВНИЗ → потом пружина отыгрывает ВВЕРХ —
  // «сначала вниз, потом прыжок»); на УДАРе (был спуск + резкое торможение) — толчок вниз ∝ скорости.
  const aY = (rig.vel.y - (rig.prevVelY || 0)) / Math.max(dt, 1e-3);
  // УДАР о землю (был спуск + резкое торможение): СРАЗУ просаживаем корпус ∝ скорости падения
  // (видимый «тук»), дальше пружина отыгрывает вверх. Импульс по скорости стиф-пружина «съедала».
  if ((rig.prevVelY || 0) > LEGIK_SQUASH.landMinVel && aY < -300) { rig.sq = Math.max(rig.sq || 0, Math.min(rig.prevVelY * LEGIK_SQUASH.landK, LEGIK_SQUASH.landMax) * s); rig.sqv = 0; }
  rig.prevVelY = rig.vel.y;
  const sqTarget = rig.crouchT > 0 ? LEGIK_SQUASH.crouch * s : 0;
  rig.sqv = (rig.sqv || 0) + ((sqTarget - (rig.sq || 0)) * LEGIK_SQUASH.stiff - (rig.sqv || 0) * LEGIK_SQUASH.damp) * dt;
  rig.sq = Math.max(-LEGIK_SQUASH.clamp * s, Math.min(LEGIK_SQUASH.clamp * s, (rig.sq || 0) + rig.sqv * dt));
  rig.bodyOff.x = rig._baseX - upx * rig.sq;   // просадка ВДОЛЬ «вниз к опоре» (−up)
  rig.bodyOff.y = rig._baseY - upy * rig.sq;
  const obx = rig.bodyOff.x, oby = rig.bodyOff.y;

  let anchored = rig.legs.filter((L) => L.phase === 'shoot' || L.phase === 'hold').length;
  let planted = rig.legs.filter((L) => L.phase === 'hold').length;   // НА ЗЕМЛЕ сейчас (shoot ещё не воткнут) — отдельно от anchored: по этому гейтим отрыв при ходьбе, иначе «парит»
  const sa = rig.supportAngle || 0;
  for (const L of rig.legs) {
    const dir = L.dir + sa;                                  // направление reach с учётом опоры (вниз/стена/потолок)
    const hox = L.hipOff.x * Math.cos(sa) - L.hipOff.y * Math.sin(sa), hoy = L.hipOff.x * Math.sin(sa) + L.hipOff.y * Math.cos(sa);  // крепление поворачивается с корпусом
    const ax = cx + hox + obx, ay = cy + hoy + oby;
    if (!L.pts.length) { let lx = ax, ly = ay; L.pts.push({ x: lx, y: ly }); for (let i = 0; i < L.n; i++) { lx += Math.cos(dir) * L.segLens[i]; ly += Math.sin(dir) * L.segLens[i]; L.pts.push({ x: lx, y: ly }); } L.tip = { x: lx, y: ly }; }
    L.t += dt; L.plantT += dt;
    // отпускаем ТОЛЬКО воткнутую (hold) ногу, когда корпус УЕХАЛ и она вытянулась за предел;
    // НЕ трогаем 'shoot' — там бедро ещё ПОДЪЕЗЖАЕТ к якорю (цель выбрана с упреждением, на старте
    // выстрела может быть за пределом — это норма, нога дотянется к моменту втыка).
    if (L.phase === 'hold' && L.anchor && planted > 1 && Math.hypot(L.anchor.x - ax, L.anchor.y - ay) > L.reach * 1.02) { L.phase = 'retract'; L.t = 0; L.dur = 0.14 * swingScale; L.anchor = null; anchored--; planted--; }  // жёсткий бэкстоп: за пределом — отрыв (но не последняя нога, чтоб не «парить»)
    if (L.phase === 'ready') {
      L.wander += dt * 0.9;
      const r = L.reach * 0.42, a = dir + Math.sin(L.wander) * 0.5 + Math.cos(L.wander * 0.7) * 0.3;
      L.goal = { x: ax + Math.cos(a) * r, y: ay + Math.sin(a) * r };
      const eager = anchored < LEGIK_MIN;
      const wait = eager ? 0.06 : (moving ? 0.07 + Math.random() * 0.12 : 0.22);   // ход: случайная пауза → ноги РАСХОДЯТСЯ по фазе (не лок-степ), плюс успеваем перешагнуть вперёд
      if (L.t >= wait) {
        // КЛЮЧ: на ходу нога ставится так же ДАЛЕКО ВПЕРЁД, как и стоя — РЕАЛЬНАЯ длина та же.
        // Мешает не длина, а ЗАДЕРЖКА замах+выстрел (~0.2с): за неё корпус уезжает (~speed·0.2),
        // и стопа, выбранная под текущим бедром, к моменту втыка оказывается ПОЗАДИ. Решение:
        // целимся ВПЕРЁД ЦЕНТРА с упреждением на этот сдвиг, а достижимость проверяем по
        // ПРЕДСКАЗАННОМУ бедру (корпус подъедет к моменту втыка), а не по текущему.
        const stepT = 0.2 * swingScale;                             // замах+выстрел ≈ окно, за которое корпус уедет (масштаб со скоростью)
        const travel = speed * stepT;
        const fromCtr = Math.cos(velAng) * (cx + obx - ax) + Math.sin(velAng) * (cy + oby - ay);   // бедро позади центра вдоль хода (для заднего крепления >0)
        // лид варьируется ПО ШАГАМ (не фикс) → ноги не встают каждый раз в одно место (живее, не лок-степ)
        const proj = moving ? (fromCtr + travel + TILE * (0.4 + Math.random() * 0.4)) : 0;
        const hipPx = ax + Math.cos(velAng) * travel, hipPy = ay + Math.sin(velAng) * travel;       // бедро в МОМЕНТ втыка (корпус подъедет)
        const stag = 0.7 + 0.45 * Math.random();   // тоже ПО ШАГАМ → разброс дальности планта
        const scanDir = moving ? ((Math.PI / 2 + sa) + Math.sin(L.seed) * 0.2) : dir;
        let surf = null;
        if (!moving) {
          // СТОЯ: целимся в СТАНЦ-СЛОТ, разнесённый ВДОЛЬ опоры → ноги равномерно лево/право,
          // не слипаются. Верхние ноги тянутся к ПОТОЛКУ (бракинг), если он есть; иначе — на пол.
          const tanX = Math.cos(sa), tanY = Math.sin(sa);                         // вдоль опоры (горизонт на полу)
          const baseX = cx + obx + tanX * L.stance * TILE, baseY = cy + oby + tanY * L.stance * TILE;
          const downDir = Math.PI / 2 + sa, upDir = -Math.PI / 2 + sa;
          for (const sd of (L.up ? [upDir, downDir] : [downDir])) {
            const s = _ikSurface(world, baseX, baseY, sd, L.reach);
            if (s && Math.hypot(s.x - ax, s.y - ay) <= L.reach * 0.99) { surf = s; break; }
          }
        } else {
          // ХОД: максимально ВПЕРЁД, но достижимо ИЗ ПРЕДСКАЗАННОГО бедра — убывающий вынос,
          // первый годный (f=0 → строго вниз — всегда достаёт пол → нога ВСЕГДА встаёт, не висит).
          for (const f of [1, 0.7, 0.45, 0.22, 0]) {
            const ox = ax + Math.cos(velAng) * proj * stag * f, oy = ay + Math.sin(velAng) * proj * stag * f;
            const s = _ikSurface(world, ox, oy, scanDir, L.reach * 1.5);
            if (s && Math.hypot(s.x - hipPx, s.y - hipPy) <= L.reach * 0.97) { surf = s; break; }
          }
        }
        if (surf) {
          // ШАГ = поджаться к телу (windup) → ВЫСТРЕЛИТЬ в породу (shoot). Видимое движение,
          // не мгновенный снап: игрок видит и замах, и втык.
          L.anchor = surf;
          L.coil = { x: ax + Math.cos(dir) * L.reach * 0.28, y: ay + Math.sin(dir) * L.reach * 0.28 };  // поджатая к телу точка
          L.from = { x: L.tip.x, y: L.tip.y };
          L.phase = 'windup'; L.t = 0; L.dur = 0.07 * swingScale; anchored++;
        } else L.t = 0;                                        // нет поверхности — пробуем снова через wait (вьётся)
      }
    } else if (L.phase === 'windup') {
      const p = Math.min(1, L.t / L.dur), e = p * p;           // поджатие к телу (ускоряясь)
      L.tip.x = L.from.x + (L.coil.x - L.from.x) * e; L.tip.y = L.from.y + (L.coil.y - L.from.y) * e;
      L.goal = L.tip;
      if (L.t >= L.dur) { L.phase = 'shoot'; L.t = 0; L.dur = 0.13 * swingScale; L.from = { x: L.tip.x, y: L.tip.y }; }
    } else if (L.phase === 'shoot') {
      const p = Math.min(1, L.t / L.dur), e = 1 - (1 - p) * (1 - p);   // ВЫСТРЕЛ: разгон, затем втык в породу
      L.tip.x = L.from.x + (L.anchor.x - L.from.x) * e; L.tip.y = L.from.y + (L.anchor.y - L.from.y) * e;
      L.goal = L.tip;
      if (L.t >= L.dur) { L.phase = 'hold'; L.t = 0; L.plantT = 0; L.tip.x = L.anchor.x; L.tip.y = L.anchor.y; planted++; L.dur = moving ? 0.05 + Math.random() * 0.08 : 0.4 + Math.random() * 0.9;
        L.bendUp = Math.random() < 0.7 ? 8 + Math.random() * 12 : 0;   // ЧАСТО колено ВВЕРХ (пологая ∧-дуга), рандом по шагам — поза не «под копирку»
        L.releaseR = 0.84 + Math.random() * 0.14; }   // до какого растяжения держать стопу (рандом по шагам → ноги отрываются вразнобой, не залпом)
    } else if (L.phase === 'hold') {
      L.goal = L.anchor;
      // при ХОДЬБЕ — стопа ДЕРЖИТСЯ за свою точку, пока корпус не оттащит её к пределу досягаемости
      // (≈releaseR·reach, рандом по ногам) → ноги реально несут вес, не «парят»; ≥MIN всегда воткнуто.
      // (жёсткий бэкстоп reach·1.04 выше — на случай если у предела осталось ровно MIN ног.)
      if (moving && planted > LEGIK_MIN && Math.hypot(L.anchor.x - ax, L.anchor.y - ay) > L.reach * L.releaseR) { L.phase = 'retract'; L.t = 0; L.dur = (0.1 + Math.random() * 0.06) * swingScale; L.anchor = null; anchored--; planted--; }
      // СТОЯ — иначе держим, НО если стопа далеко от своего СТАНЦ-СЛОТА (осталась с ходьбы —
      // ноги слиплись/кривой постав), переставляем её к слоту (по одной, ≥MIN воткнуто). Раз в ~0.5с.
      else if (!moving && anchored > LEGIK_MIN && L.t > 0.5) {
        const slotX = cx + obx + Math.cos(sa) * L.stance * TILE;
        if (Math.abs(L.anchor.x - slotX) > TILE * 0.38) { L.phase = 'retract'; L.t = 0; L.dur = 0.12; L.anchor = null; anchored--; }
      }
    } else {
      // ВЗМАХ: при ходьбе нога идёт ВПЕРЁД по ходу + приподнимается от опоры (фаза переноса),
      // а НЕ тянется назад вдоль оси покоя — иначе ноги «волочатся» позади (осьминог).
      if (moving) {
        const ux = -Math.cos(Math.PI / 2 + sa), uy = -Math.sin(Math.PI / 2 + sa);   // «вверх» от опоры
        L.goal = { x: ax + Math.cos(velAng) * L.reach * 0.5 + ux * L.reach * 0.32, y: ay + Math.sin(velAng) * L.reach * 0.5 + uy * L.reach * 0.32 };
      } else {
        L.goal = { x: ax + Math.cos(dir) * L.segLens[0] * 1.1, y: ay + Math.sin(dir) * L.segLens[0] * 1.1 };
      }
      if (L.t >= L.dur) { L.phase = 'ready'; L.t = 0; L.dur = moving ? 0.04 * swingScale : 0.4 + Math.random() * 1.1; }
    }
    // windup/shoot ставят кончик САМИ (тайм-лерп, видимое движение); прочие фазы — мягкий догон.
    if (L.phase === 'hold') { L.tip.x = L.anchor.x; L.tip.y = L.anchor.y; }
    else if (L.phase === 'ready' || L.phase === 'retract') {
      const sp = L.phase === 'retract' ? 9 : 3.2, k = Math.min(1, dt * sp);
      L.tip.x += (L.goal.x - L.tip.x) * k; L.tip.y += (L.goal.y - L.tip.y) * k;
    }
    _ikFabrik(L.pts, ax, ay, L.tip, L.segLens, 4);
    _ikAvoidRock(world, L.pts);
    // СДВИГИ позы (вывих колена вбок + волна + подъём колена ∧) — ДО финального FABRIK,
    // чтобы он ВОССТАНОВИЛ длины звеньев (иначе перпендикулярные сдвиги растягивают сегменты).
    const wob = (L.phase === 'hold' || L.phase === 'shoot') ? 0.3 : 0.85;   // тише «волна»
    const n2 = L.pts.length - 1;
    const upX = -Math.cos(Math.PI / 2 + sa), upY = -Math.sin(Math.PI / 2 + sa);   // «вверх» от опоры (для подъёма колена)
    const tanX = Math.cos(sa), tanY = Math.sin(sa);          // ВДОЛЬ опоры (горизонт на полу)
    for (let i = 1; i < n2; i++) {
      const px = L.pts[i + 1].x - L.pts[i - 1].x, py = L.pts[i + 1].y - L.pts[i - 1].y, l = Math.hypot(px, py) || 1;
      const w = Math.sin(Math.PI * i / n2);                  // пик в СЕРЕДИНЕ цепи (колено), 0 на концах
      // «вывих» колена ВДОЛЬ ОПОРЫ по знаку крепления: нога на стороне бура гнёт колено К БУРУ,
      // с дальней — ОТ него. Ноги НЕ зеркалятся по взгляду, поэтому фикс-ось по `sign(hipOff.x)` верна
      // при обоих направлениях (бур ушёл на −x → те же +x-ноги стали задними, колено +x = назад). Не зависит от позы цепи.
      const kb = L.bend * LEGIK_BEND * w;
      const wv = Math.sin(t * 2.2 + L.seed + i * 0.8) * wob * (i / L.pts.length);   // лёгкая «волна» (поперёк цепи)
      let nx = L.pts[i].x + tanX * kb + (-py / l) * wv, ny = L.pts[i].y + tanY * kb + (px / l) * wv;
      nx += upX * L.bendUp * w; ny += upY * L.bendUp * w;    // иногда поднять колено ВВЕРХ → пологая ∧-дуга
      if (!_ikSolid(world, nx, ny)) { L.pts[i].x = nx; L.pts[i].y = ny; }
    }
    _ikAvoidRock(world, L.pts); _ikFabrik(L.pts, ax, ay, L.tip, L.segLens, 3);   // ФИНАЛ = FABRIK: длины звеньев ТОЧНЫЕ (avoidRock до него; иначе он растягивает сегменты)
    // сглаживание рендера: ИНТЕРЬЕРНЫЕ суставы догоняют (мягко), а ВОТКНУТАЯ стопа
    // ПРИБИТА к якорю (без лага) → нога реально «держит» грунт, корпус проезжает мимо.
    if (!L.draw) L.draw = L.pts.map((p) => ({ x: p.x, y: p.y }));
    const smk = Math.min(1, dt * 30), last = L.pts.length - 1;
    for (let i = 0; i < L.pts.length; i++) { L.draw[i].x += (L.pts[i].x - L.draw[i].x) * smk; L.draw[i].y += (L.pts[i].y - L.draw[i].y) * smk; }
    // КОРЕНЬ ЖЁСТКО на корпусе, стопа — к якорю (`pts[last]`), длины ТОЧНЫЕ: FABRIK по сглаженным
    // точкам (двусторонняя привязка). Раньше односторонний проход от стопы «прыгал» бедром при дыхании.
    _ikFabrik(L.draw, ax, ay, L.pts[last], L.segLens, 2);
  }
}

// drawSeg(ctx, ax, ay, bx, by, i, n, spriteId) — необязательный колбэк; иначе капсула+спрайт.
function drawLegRig(ctx, rig, camera, drawSeg) {
  for (const L of rig.legs) {
    const src = L.draw || L.pts;                             // сглажённые точки (плавнее)
    const sp = src.map((p) => ({ x: camera ? camera.screenX(p.x) : p.x, y: camera ? p.y - camera.y : p.y }));
    const n = sp.length;
    for (let i = 0; i < n - 1; i++) {
      const a = sp[i], b = sp[i + 1], id = L.spriteIds && L.spriteIds[i], spr = !_legikProc && typeof spriteFor === 'function' ? spriteFor(id) : null;
      if (drawSeg) { drawSeg(ctx, a.x, a.y, b.x, b.y, i, n, id); continue; }
      if (spr && spr.img) {                                  // СПРАЙТ на сегмент — ТА ЖЕ схема, что в FK `drawLeg`
        const ang = Math.atan2(b.y - a.y, b.x - a.x), s = rig.drawScale || 1;   // (масштаб/поворот/пивот из setPartSprite: px/py/w/h/rot)
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang - Math.PI / 2 + (spr.rot || 0) * Math.PI / 180);
        if (s !== 1) ctx.scale(s, s);                        // спрайт ужимается вместе с костью (segLens уже ×scale) — совпадает с редактором
        ctx.drawImage(spr.img, -spr.px, -spr.py, spr.w, spr.h);
        ctx.restore();
      } else {                                               // капсула-фолбэк
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const w = 5.4 - 3.0 * (i / (n - 1));
        ctx.strokeStyle = '#1a1620'; ctx.lineWidth = w + 2.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.strokeStyle = '#6b6172'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (i > 0) { ctx.fillStyle = '#8a8194'; ctx.beginPath(); ctx.arc(a.x, a.y, 2.6 - 1.0 * (i / n), 0, 6.283); ctx.fill(); }
      }
    }
    if (!drawSeg && (_legikProc || !(L.spriteIds && L.spriteIds.some((id) => { const s = typeof spriteFor === 'function' && spriteFor(id); return s && s.img; })))) {
      const tip = sp[n - 1], pen = sp[n - 2], a = Math.atan2(tip.y - pen.y, tip.x - pen.x);   // коготь только у процедурной (без спрайтов)
      ctx.strokeStyle = '#9a90a4'; ctx.lineWidth = 1.6;
      for (const s of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + Math.cos(a + s) * 5, tip.y + Math.sin(a + s) * 5); ctx.stroke(); }
    }
  }
}

// Конфиги ног из блупринта UNIT_DEFS (data-driven): hip из f/s, длины из segments.len*R,
// спрайт на сегмент = 'legId:segId'. dir — вниз + по продольной оси (f).
// `scale` — масштаб юнита (UNIT_DRAW_SCALE) для ИГРЫ: hip И длины сегментов ужимаются вместе с
// корпусом/кольцом (иначе ноги крепятся в 1/scale раз дальше, чем рисуется кольцо). Редактор
// зовёт без scale (=1) — там общий `ctx.scale(zoom)` масштабирует весь холст.
function legConfigsFromUnit(unit, scale) {
  const def = (typeof UNIT_DEFS !== 'undefined' && UNIT_DEFS[unit.hull]) || UNIT_DEFS.scout, R = (TILE - 8) / 2 * (scale || 1);
  const legs = def.parts.filter((p) => p.kind === 'leg' && p.ik);
  // секторы: ноги тянутся в РАЗНЫЕ стороны → цепляются за разные поверхности (пол И потолок/стены),
  // а не все в одну. Для 4 ног: 2 вниз, 2 вверх (с наклоном в стороны); supportAngle поворачивает весь набор.
  const Q4 = [Math.PI * 0.62, Math.PI * 0.38, -Math.PI * 0.38, -Math.PI * 0.62];  // ↙ ↘ ↗ ↖ (y вниз)
  return legs.map((p, i) => {
    const segs = p.segments || [];
    return {
      hipOff: { x: p.f * R, y: (p.s || 0) * R },
      dir: legs.length >= 4 ? Q4[i % 4] : Math.atan2(0.8, p.f * 0.9),
      segLens: segs.map((sd) => (sd.len != null ? sd.len : 0.5) * R),
      spriteIds: segs.map((sd) => p.id + ':' + sd.id),
    };
  });
}
