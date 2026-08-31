'use strict';

// Рендер мира в разрезе. Порода — плоские осколки с градиентом (без контура),
// плотность ∝ числу/размеру кусков (при высокой слипаются). Трещины бурения —
// паутина на КАЖДОМ осколке, проступает прогрессивно от края входа бура вглубь
// (ближние осколки трескаются раньше дальних). Прорытый ход светлее тьмы; по краям
// — длинная мягкая тень-«труба», отброшенная НЕРОВНЫМ силуэтом породы (повторяет
// рваную линию, а не сетку тайлов). На стенках — следы бура (горнопроходка).

function _hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
// Палитра породы по ГЛУБИНЕ всей колонки (стопы сверху вниз, привязаны к tileY). Нарратив-ось тороида:
// ВВЕРХ — погребённая людская цивилизация, ТЁПЛЫЕ тона (пепел→ржавчина→завалы→перегной); город —
// нейтральная земля; ВНИЗ — «внешняя сторона», ХОЛОДНЫЕ тона к фиолетовой бездне. Цвет интерполируется
// НЕПРЕРЫВНО между стопами (нет резкого шва на сетке). `sh` — 3 тона булыжника (тёмный→средний→светлый).
const _STRATA = [
  { y:   4, back: '#564a3c', gap: '#2a2219', sh: ['#4a4034', '#675b48', '#897a62'] }, // пепел (зола поверхности)
  { y:  24, back: '#613b20', gap: '#2c160b', sh: ['#5c3214', '#8c4c1e', '#c27a30'] }, // ржавчина (окислы)
  { y:  50, back: '#574122', gap: '#261b0d', sh: ['#4a3a1c', '#6e562c', '#96763c'] }, // завал (спрессованные руины)
  { y:  78, back: '#403a20', gap: '#1c190c', sh: ['#2e2c14', '#4c4824', '#6c6636'] }, // перегной (тёмно-оливковый)
  { y: 102, back: '#473a27', gap: '#2a2012', sh: ['#5e4b2e', '#6b5535', '#776039'] }, // город — нейтральная тёплая земля
  { y: 160, back: '#3f3a3a', gap: '#1d1c20', sh: ['#4c4031', '#574a3a', '#615345'] }, // средний — остывающий камень
  { y: 215, back: '#34323f', gap: '#17161e', sh: ['#393545', '#3f3a48', '#48434f'] }, // глубокий — холодный сине-серый
  { y: 262, back: '#2c2742', gap: '#140f22', sh: ['#2e2842', '#3a3358', '#4c4080'] }, // бездна — фиолетовый «космос»
].map((s) => ({ y: s.y, back: _hx(s.back), gap: _hx(s.gap), sh: s.sh.map(_hx) }));

const _stratMemo = [];
function _strat(y) {
  const yi = y < 0 ? 0 : (y >= MAP_H ? MAP_H - 1 : y | 0);
  const hit = _stratMemo[yi]; if (hit) return hit;
  const S = _STRATA; let i = 0; while (i < S.length - 2 && yi > S[i + 1].y) i++;
  const A = S[i], B = S[i + 1], t = Math.max(0, Math.min(1, (yi - A.y) / (B.y - A.y)));
  const lerp = (a, b) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  const m = { back: lerp(A.back, B.back), gap: lerp(A.gap, B.gap), sh: [lerp(A.sh[0], B.sh[0]), lerp(A.sh[1], B.sh[1]), lerp(A.sh[2], B.sh[2])] };
  _stratMemo[yi] = m; return m;
}
function backColor(y)  { return _strat(y).back; }
function gapColor(y)   { return _strat(y).gap; }
// Фон УКРЕПЛЁННОГО винтового хода (AIR-тайлы с `t.screw`): холодный бетонно-стальной СЕРЫЙ — отличается от тёплого
// backColor обычной пустоты (проходческий щит облицевал стенку). Чуть темнеет с глубиной, но остаётся серым.
function screwBackColor(y) { const d = Math.min(1, Math.max(0, y / MAP_H)); const v = Math.round(74 - d * 26); return `rgb(${v - 6},${v - 3},${v + 4})`; }
function shadeColor(tone, y) { return _strat(y).sh[tone]; }

function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Рекурсивная ветка трещины с ФИКСИРОВАННОЙ геометрией (зигзаг-сегменты + форки, сужение к острому кончику).
// ⚠️ Трещины РАСТУТ, а не «выдвигаются»: геометрия детерминирована (tileHash), а `frontDist` (= prog·maxReach) — фронт
// ПРОРАСТАНИЯ по накопленной длине от корня `dist`. Уже открытые сегменты НЕ двигаются; на фронте прорастают новые
// (и появляются форки, когда фронт дошёл до точки ветвления). Клип последнего сегмента у фронта = «трещина ползёт».
function _crackBranch(ctx, px, py, ang, segLen, w, depth, dist, frontDist, x, y, sd) {
  if (depth <= 0 || dist >= frontDist) return;
  for (let s = 0; s < 2; s++) {
    if (dist >= frontDist) return;
    ang += (tileHash(x + sd + s * 5, y - sd + s * 3) - 0.5) * 0.95;          // резкий зигзаг (фикс по сиду)
    const draw = Math.min(segLen, frontDist - dist);                        // частичный сегмент у фронта → «прорастание»
    const nx = px + Math.cos(ang) * draw, ny = py + Math.sin(ang) * draw;
    ctx.lineWidth = Math.max(0.4, w);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny; dist += draw; w *= 0.62;                              // сужение → острый кончик
    if (depth > 1 && tileHash(x * 7 + sd + s, y * 11 - s) < 0.62) {          // ФОРК (фикс): прорастает, когда фронт дошёл сюда
      const side = (tileHash(x + s * 3, y + sd) < 0.5) ? 1 : -1;
      _crackBranch(ctx, px, py, ang + side * (0.55 + tileHash(sd + 1, s) * 0.7), segLen * 0.9, w * 0.9, depth - 1, dist, frontDist, x, y, sd * 3 + s + 7);
    }
  }
}

// Осколки породы (плоские, с лёгким градиентом, без контура) + разлом-трещины бурения,
// проступающие прогрессивно от стороны входа бура (соседний воздух) вглубь тайла.
function drawChunks(ctx, world, camera, W, H) {
  const ox = Math.round(camera.x), oy = Math.round(camera.y);
  const x0 = Math.floor(camera.x / TILE), y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.floor((camera.x + W) / TILE);
  const y1 = Math.min(MAP_H - 1, Math.floor((camera.y + H) / TILE));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = world.tileAt(x, y);
      if (t.type !== ROCK) continue;
      const dens = t.dens;
      const n = Math.round(2 + dens * 7);
      const ssize = TILE * (0.12 + dens * 0.2);
      const prog = t.dig > 0 ? Math.min(1, t.dig / digThreshold(t)) : 0;
      // сторона входа бура = соседний прорытый тайл; от неё трещины идут вглубь
      let ex = 0, ey = 1;
      if (prog > 0) {
        if (world.tileAt(x, y - 1).type === AIR && y - 1 >= SURFACE_ROWS) { ex = 0; ey = -1; }
        else if (world.tileAt(x, y + 1).type === AIR && y + 1 >= SURFACE_ROWS) { ex = 0; ey = 1; }
        else if (world.tileAt(x - 1, y).type === AIR) { ex = -1; ey = 0; }
        else if (world.tileAt(x + 1, y).type === AIR) { ex = 1; ey = 0; }
      }
      for (let k = 0; k < n; k++) {
        const hx = tileHash(x * 37 + k * 7, y * 53 + k * 3);
        const hy = tileHash(x * 29 + k * 5, y * 41 + k * 11);
        const cx = x * TILE + (hx * 1.1 - 0.05) * TILE - ox;
        const cy = y * TILE + (hy * 1.1 - 0.05) * TILE - oy;
        const r = ssize * (0.7 + tileHash(x * 7 + k, y * 9 + k) * 0.6);
        const V = 5, baseA = tileHash(x + k, y - k) * TAU;
        ctx.beginPath();
        for (let j = 0; j < V; j++) {
          const a = baseA + (j / V) * TAU;
          const rr = r * (0.68 + tileHash(x * 3 + k + j, y * 5 + k - j) * 0.55);
          const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        const tone = Math.floor(tileHash(x * 13 + k, y * 17 + k) * 3);
        const grad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
        grad.addColorStop(0, shadeColor(Math.min(2, tone + 1), y));
        grad.addColorStop(1, shadeColor(tone, y));
        ctx.fillStyle = grad;
        ctx.fill();
      }
      // ТРЕЩИНЫ БУРЕНИЯ: ЕДИНЫЙ разлом НА ВЕСЬ ТАЙЛ (не по осколкам), ПОВЕРХ кладки; растёт ОТ СТЕНКИ входа бура вглубь по prog
      // (юнит постепенно разрушает породу от той грани, где бурит). Общий для всех буров с этой анимацией.
      if (prog > 0) {
        const tsx = x * TILE - ox, tsy = y * TILE - oy;
        let o0x, o0y, gx, gy;                                       // точка входа на кромке (0..1 по тайлу) + направление РОСТА внутрь
        if (ey < 0) { o0x = 0.5; o0y = 0; gx = 0; gy = 1; }          // воздух сверху → трещина ВНИЗ
        else if (ey > 0) { o0x = 0.5; o0y = 1; gx = 0; gy = -1; }    // воздух снизу → ВВЕРХ
        else if (ex < 0) { o0x = 0; o0y = 0.5; gx = 1; gy = 0; }     // воздух слева → ВПРАВО
        else { o0x = 1; o0y = 0.5; gx = -1; gy = 0; }                // воздух справа → ВЛЕВО
        const px0 = tsx + o0x * TILE, py0 = tsy + o0y * TILE, baseAng = Math.atan2(gy, gx);
        ctx.strokeStyle = `rgba(6,3,2,${(0.35 + prog * 0.5).toFixed(3)})`;
        ctx.lineCap = 'butt';                                        // острые кончики (не круглые)
        // ФИКС геометрия (кол-во веток/глубина/длина сегмента НЕ зависят от prog) → трещины растут, а не выдвигаются;
        // `frontDist`=prog·maxReach — фронт прорастания; `w0` РАСТЁТ с prog → существующие трещины ТОЛСТЕЮТ.
        const segLen = TILE * 0.2, maxReach = TILE * 1.25, frontDist = prog * maxReach;
        const mains = 3, depth = 4, w0 = Math.max(1.6, TILE * 0.105 * (0.4 + prog * 0.7));   // толще корень (≈×3.5), сужается к кончикам
        for (let m = 0; m < mains; m++) {
          const spread = ((m / (mains - 1)) - 0.5) * 1.25;
          _crackBranch(ctx, px0, py0, baseAng + spread, segLen, w0, depth, 0, frontDist, x, y, m * 13 + 3);
        }
        ctx.lineCap = 'round';
      }
    }
}

// Жилы ресурса в породе: кластер мелких фигурок-вкраплений по силуэту типа
// (см. render_resource.js). Туман (рисуется позже) сам притеняет невидимое и
// приглушает вне пятна сканера. Сдвиг центра по тайлу — чтобы вкрапление не
// липло строго к сетке и читалось органичнее.
function drawResourceVeins(ctx, world, ox, oy, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = world.tileAt(x, y);
      if (t.type !== ROCK || !t.resource) continue;
      const seed = x * 73856093 + y * 19349663;
      const jx = (tileHash(x * 3 + 1, y * 7 + 5) - 0.5) * TILE * 0.18;
      const jy = (tileHash(x * 5 + 9, y * 11 + 2) - 0.5) * TILE * 0.18;
      const cx = x * TILE + TILE / 2 + jx - ox, cy = y * TILE + TILE / 2 + jy - oy;
      drawResourceCluster(ctx, t.resource, cx, cy, TILE * 0.3, seed);
    }
}

// Маркеры дружественных городов: ступенчатая «пирамида» на полу пещеры + имя.
function drawCityMarkers(ctx, world, camera, debug) {
  const oy = Math.round(camera.y);
  for (const c of world.caverns) {
    if (!debug && !world.isSeen(c.cx, c.floorY)) continue;
    const sx = camera.screenX((c.cx + 0.5) * TILE);
    if (sx < -TILE * 4 || sx > camera.viewW + TILE * 4) continue;
    const fy = c.floorY * TILE - oy, w = TILE * 2.4, h = TILE * 0.5;
    ctx.fillStyle = '#3a5a6e';
    for (let i = 0; i < 3; i++) { const ww = w * (1 - i * 0.26); ctx.fillRect(sx - ww / 2, fy - (i + 1) * h, ww, h); }
    ctx.strokeStyle = '#7fd7ff'; ctx.lineWidth = 1; ctx.strokeRect(sx - w / 2, fy - 3 * h, w, 3 * h);
    ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(c.name.toUpperCase(), sx, fy - 3 * h - 6);
    ctx.textAlign = 'left';
  }
}

// Маркеры диких городов (гнёзд): тёмная разрушенная масса + тлеющее красное ядро.
function drawWildMarkers(ctx, world, camera, debug) {
  const oy = Math.round(camera.y);
  for (const w of world.wilds) {
    if (!debug && !world.isSeen(w.cx, w.floorY)) continue;
    const sx = camera.screenX((w.cx + 0.5) * TILE);
    if (sx < -TILE * 5 || sx > camera.viewW + TILE * 5) continue;
    const fy = w.floorY * TILE - oy, ww = TILE * 2.6, h = TILE * 0.5;
    ctx.fillStyle = w.disabled ? '#1b181f' : '#2a2230';
    for (let i = 0; i < 3; i++) {
      const cw = ww * (1 - i * 0.28), off = (tileHash(w.cx + i, w.floorY) - 0.5) * TILE * 0.5;
      ctx.fillRect(sx - cw / 2 + off, fy - (i + 1) * h, cw, h + 1);
    }
    // ядро-сердце: подавлено → тусклое серое; попадание осады → белая вспышка; САБОТАЖ → янтарный медленный пульс; иначе красный пульс
    if (w.disabled) ctx.fillStyle = 'rgba(120,120,132,0.5)';
    else if (w.hitT > 0) ctx.fillStyle = `rgba(255,240,220,${0.6 + 0.4 * (w.hitT / WILD_HIT_FLASH)})`;
    else if (w.saboted) { const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 900 + w.cx); ctx.fillStyle = `rgba(225,150,60,${0.4 + 0.35 * pulse})`; }
    else { const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500 + w.cx); ctx.fillStyle = `rgba(210,70,55,${0.45 + 0.4 * pulse})`; }
    ctx.beginPath(); ctx.arc(sx, fy - h * 1.6, TILE * 0.17, 0, TAU); ctx.fill();
    // полоса HP — когда гнездо ранено, но ещё живо (осада сбивает hp к 0 → ПОДАВЛЕНО)
    if (!w.disabled && w.hp < w.maxHp) {
      const bw = TILE * 1.6, bx = sx - bw / 2, byb = fy - 3 * h - 16, f = Math.max(0, w.hp / w.maxHp);
      ctx.fillStyle = 'rgba(20,14,16,0.85)'; ctx.fillRect(bx - 1, byb - 1, bw + 2, 5);
      ctx.fillStyle = PAL.blood; ctx.fillRect(bx, byb, bw * f, 3);
    }
    ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = w.disabled ? 'rgba(140,140,150,0.7)' : w.saboted ? PAL.amber : PAL.bloodBright;
    const tag = w.disabled ? ' · ' + STR.world.wildDisabled : w.saboted ? ' · ' + STR.world.wildSaboted : '';
    ctx.fillText(STR.world.wildCity + tag, sx, fy - 3 * h - 6);
    ctx.textAlign = 'left';
  }
}

// Неоднородность дна ходов: тёмные впадины + редкие светлые крупинки.
function drawBackTexture(ctx, world, camera, W, H) {
  const CELL = Math.round(TILE * 0.6);
  const gx0 = Math.floor(camera.x / CELL) - 1, gx1 = Math.floor((camera.x + W) / CELL) + 1;
  const gy0 = Math.floor(camera.y / CELL) - 1, gy1 = Math.floor((camera.y + H) / CELL) + 1;
  for (let gy = gy0; gy <= gy1; gy++)
    for (let gx = gx0; gx <= gx1; gx++) {
      const r0 = tileHash(gx * 3, gy * 7);
      if (r0 > 0.5) continue;
      const wx = gx * CELL + tileHash(gx, gy) * CELL, wy = gy * CELL + tileHash(gx * 2, gy * 5) * CELL;
      const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
      if (ty < SURFACE_ROWS || world.tileAt(tx, ty).type !== AIR) continue;
      const cx = wx - camera.x, cy = wy - camera.y;
      const size = CELL * (0.2 + r0 * 0.35);
      ctx.fillStyle = r0 < 0.26 ? 'rgba(0,0,0,0.18)' : 'rgba(255,240,220,0.025)';
      ctx.beginPath(); ctx.ellipse(cx, cy, size, size * 0.7, tileHash(gx, gy * 3) * Math.PI, 0, TAU); ctx.fill();
    }
}

// Рваный край прохода — НЕПРЕРЫВНЫЙ неровный контур (не прямоугольные зубцы и без
// ровной линии по сетке). Заливаем «полосу» от кромки тайла (она утоплена под цвет
// дна → невидима) внутрь породы до зубчатой линии value-шума. Шум берётся в МИРОВЫХ
// координатах вдоль кромки → у соседних тайлов край стыкуется бесшовно; на концах
// тайла глубина НЕ нулевая → нет периодических «защипов» на стыках. Минимальная
// глубина `MIN` гарантирует, что плоских участков на линии сетки не остаётся.
// Один контур кормит и видимый край (заливка цветом дна), и силуэт тени (destination-out).
function _ragHash(n) { let h = (Math.imul(n | 0, 374761393) + 0x9e3779b9) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
// ЛИНЕЙНАЯ интерполяция (не smoothstep) → угловатые зубцы, а не пологие волны.
function _ragLin(a) { const i = Math.floor(a), f = a - i; return _ragHash(i) * (1 - f) + _ragHash(i + 1) * f; }
// Глубина эрозии кромки В ДОЛЯХ ТАЙЛА. Острый рваный профиль (высокочастотный
// зубец + редкая глубокая выемка). Чистая функция мировой координаты вдоль кромки →
// бесшовно у соседей. Тот же контур читает конус света (render_light.js) — клип по нему.
function _ragDepth(along, side) {
  const c = along + side * 5.7;
  const v = 0.7 * _ragLin(c * 3.7) + 0.3 * _ragLin(c * 1.6 + 2.1);  // 0..1, угловато
  return (0.1 + v * 0.9) * 0.34;   // мин. глубина (нет плоских участков на сетке) … до ~0.34 тайла
}
// Зубчатый контур эрозийной каймы (без beginPath/fill — добавляется в общий путь).
function _appendTeeth(ctx, x, y, sx, sy, side) {
  const N = 9;                                             // плотнее → острые зубцы читаются
  if (side === 0 || side === 1) {                          // горизонтальная кромка (низ=0 / верх=1)
    const baseY = side === 0 ? sy + TILE : sy, dir = side === 0 ? -1 : 1;
    ctx.moveTo(sx, baseY); ctx.lineTo(sx + TILE, baseY);   // внешняя сторона полосы — по сетке (утоплена)
    for (let i = N; i >= 0; i--)                            // внутренняя сторона — зубчатый контур
      ctx.lineTo(sx + (i / N) * TILE, baseY + dir * _ragDepth(x + i / N, side) * TILE);
  } else {                                                 // вертикальная кромка (лево=2 / право=3)
    const baseX = side === 2 ? sx : sx + TILE, dir = side === 2 ? 1 : -1;
    ctx.moveTo(baseX, sy); ctx.lineTo(baseX, sy + TILE);
    for (let i = N; i >= 0; i--)
      ctx.lineTo(baseX + dir * _ragDepth(y + i / N, side) * TILE, sy + (i / N) * TILE);
  }
  ctx.closePath();
}
function raggedTeethRects(ctx, x, y, sx, sy, side) { ctx.beginPath(); _appendTeeth(ctx, x, y, sx, sy, side); ctx.fill(); }
function raggedEdge(ctx, x, y, sx, sy, side, backHex) { ctx.fillStyle = backHex; raggedTeethRects(ctx, x, y, sx, sy, side); }

// Клип по ВИДИМОМУ воздуху: тоннели/каверны + эрозийная кайма (которую raggedEdge красит
// цветом дна → визуально это воздух). Щупальца юнита рисуются ТОЛЬКО внутри → за породой
// они СКРЫТЫ (юнит не «вылезает»), а точки, ушедшие в камень, окклюдируются по ТОЙ ЖЕ
// видимой кромке (`_ragDepth`), что и рендер мира — без рассинхрона сетка/визуал.
function clipVisibleAir(ctx, world, camera) {
  const W = camera.viewW, H = camera.viewH, ox = Math.round(camera.x), oy = Math.round(camera.y);
  const x0 = Math.floor(camera.x / TILE), y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.floor((camera.x + W) / TILE), y1 = Math.min(MAP_H - 1, Math.floor((camera.y + H) / TILE));
  const airU = (x, y) => world.tileAt(x, y).type === AIR && y >= SURFACE_ROWS;
  ctx.beginPath();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const sx = x * TILE - ox, sy = y * TILE - oy;
      if (airU(x, y)) { ctx.rect(sx, sy, TILE, TILE); continue; }   // ⚠️ БЕЗ +1: иначе rect залезает на 1px вправо/вниз в кайму породы, а зубцы стороны 2 (правая стена) намотаны ОБРАТНО → winding гасится (nonzero) → дыра в клипе на кромке → тень не доходит → СВЕТЛАЯ полоска. Зубцы покрывают кайму на всю глубину сами.
      if (world.tileAt(x, y).type === ROCK) {              // кайма со стороны воздуха = видимый воздух
        if (airU(x, y + 1)) _appendTeeth(ctx, x, y, sx, sy, 0);
        if (airU(x, y - 1)) _appendTeeth(ctx, x, y, sx, sy, 1);
        if (airU(x - 1, y)) _appendTeeth(ctx, x, y, sx, sy, 2);
        if (airU(x + 1, y)) _appendTeeth(ctx, x, y, sx, sy, 3);
      }
    }
  ctx.clip();
}

// Следы бура на стенках: короткие дугообразные борозды вдоль породы + тонкий
// блик-рельеф рядом — ощущение прорытости (как в горнопроходке).
function boreSide(ctx, x, y, sx, sy, side) {
  const n = 2 + Math.floor(tileHash(x * 7 + side * 3, y * 11 + side * 5) * 2);
  for (let i = 0; i < n; i++) {
    const t = tileHash(x * 5 + i * 13 + side * 17, y * 3 + i * 7 + side * 11);
    const off = (0.08 + tileHash(x + i + side, y - i) * 0.20) * TILE;
    const len = (0.35 + tileHash(x - i, y + i + side) * 0.4) * TILE;
    const bow = (tileHash(x * 3 + i + side, y * 5 + i) - 0.5) * 0.16 * TILE;
    let ax, ay, bx, by, mx, my;
    if (side === 1) { ax = sx + t * TILE - len / 2; ay = sy + off; bx = ax + len; by = ay; mx = (ax + bx) / 2; my = ay + bow; }
    else if (side === 0) { ax = sx + t * TILE - len / 2; ay = sy + TILE - off; bx = ax + len; by = ay; mx = (ax + bx) / 2; my = ay + bow; }
    else if (side === 2) { ax = sx + off; ay = sy + t * TILE - len / 2; bx = ax; by = ay + len; mx = ax + bow; my = (ay + by) / 2; }
    else { ax = sx + TILE - off; ay = sy + t * TILE - len / 2; bx = ax; by = ay + len; mx = ax + bow; my = (ay + by) / 2; }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = Math.max(1, TILE * 0.05);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,244,222,0.06)';
    ctx.lineWidth = Math.max(0.8, TILE * 0.028);
    ctx.beginPath(); ctx.moveTo(ax, ay - 1); ctx.quadraticCurveTo(mx, my - 1, bx, by - 1); ctx.stroke();
  }
}
function drawBoreMarks(ctx, world, ox, oy, x0, y0, x1, y1) {
  const airU = (x, y) => world.tileAt(x, y).type === AIR && y >= SURFACE_ROWS;
  const rk = (x, y) => { const tp = world.tileAt(x, y).type; return tp === ROCK || tp === BORDER || tp === INDESTRUCT; };
  ctx.lineCap = 'round';
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!airU(x, y) || world.inCave(x, y)) continue; // в природной пещере города бура не было
      const sx = x * TILE - ox, sy = y * TILE - oy;
      if (rk(x, y + 1)) boreSide(ctx, x, y, sx, sy, 0);
      if (rk(x, y - 1)) boreSide(ctx, x, y, sx, sy, 1);
      if (rk(x - 1, y)) boreSide(ctx, x, y, sx, sy, 2);
      if (rk(x + 1, y)) boreSide(ctx, x, y, sx, sy, 3);
    }
}

// Тень-«труба»: силуэт породы с РВАНЫМ краем рисуем на оффскрине (зубцы вырезаем
// destination-out — повторяем видимую неровную линию), затем отбрасываем от него
// длинную мягкую тень внутрь хода (клип по воздуху, shadowBlur).
let _shC = null, _shX = null;
function drawTunnelShadow(ctx, world, camera, ox, oy, x0, y0, x1, y1) {
  const W = Math.ceil(camera.viewW), H = Math.ceil(camera.viewH);
  if (!_shC) { _shC = document.createElement('canvas'); _shX = _shC.getContext('2d'); }
  if (_shC.width < W || _shC.height < H) { _shC.width = W; _shC.height = H; }
  const s = _shX;
  s.setTransform(1, 0, 0, 1, 0, 0);
  s.clearRect(0, 0, _shC.width, _shC.height);
  s.fillStyle = '#000';
  let anyRock = false;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const tp = world.tileAt(x, y).type;
      if (tp === ROCK || tp === BORDER || tp === INDESTRUCT) { s.fillRect(x * TILE - ox, y * TILE - oy, TILE, TILE); anyRock = true; }
    }
  if (!anyRock) return;
  const airU = (x, y) => world.tileAt(x, y).type === AIR && y >= SURFACE_ROWS;
  s.globalCompositeOperation = 'destination-out';
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (world.tileAt(x, y).type !== ROCK) continue;
      const sx = x * TILE - ox, sy = y * TILE - oy;
      if (airU(x, y + 1)) raggedTeethRects(s, x, y, sx, sy, 0);
      if (airU(x, y - 1)) raggedTeethRects(s, x, y, sx, sy, 1);
      if (airU(x - 1, y)) raggedTeethRects(s, x, y, sx, sy, 2);
      if (airU(x + 1, y)) raggedTeethRects(s, x, y, sx, sy, 3);
    }
  s.globalCompositeOperation = 'source-over';

  ctx.save();
  // ⚠️ клип по ВИДИМОМУ воздуху (тоннель + эрозийная КАЙМА `_ragDepth`), а НЕ по квадратам тайлов. Иначе в кайме
  // (она покрашена в цвет дна → визуально воздух, но НЕ квадрат-тайл) тени НЕТ → у границы тайла образуется
  // СВЕТЛАЯ кайма (без тени) рядом с ТЁМНЫМ воздушным тайлом (с тенью) = квадратный ШОВ. Теперь тень идёт ровно
  // от рваного края породы внутрь хода.
  clipVisibleAir(ctx, world, camera);
  ctx.shadowColor = 'rgba(3,2,1,0.95)';
  ctx.shadowBlur = TILE * 1.05;
  ctx.drawImage(_shC, 0, 0);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.restore();
}

// Ассет города игрока (грузится через new Image → работает и на file://). Рисуется на фундаменте.
const _cityImg = new Image(); _cityImg.src = 'assets/aztec_city/aztec_city.png';
function _cityReady() { return _cityImg.complete && _cityImg.naturalWidth > 0; }
// Город сидит НА фундаменте (INDESTRUCT-плита под принтером, x: PRINTER.x-1 .. PRINTER.x+PRINTER.w):
// ширина вписана в фундамент, низ — на полу, где стоит юнит (верх плиты = (CAVE_FLOOR_Y+1)·TILE).
function drawPlayerCity(ctx, camera, oy) {
  if (!_cityReady()) return;
  const fw = (PRINTER.w + 2) * TILE;                                   // ширина фундамента (5 тайлов)
  const s = fw / _cityImg.naturalWidth, dw = fw, dh = _cityImg.naturalHeight * s;
  const cx = camera.screenX((PRINTER.x + PRINTER.w / 2) * TILE);        // центр фундамента/принтера
  const baseY = (CAVE_FLOOR_Y + 1) * TILE - oy;                        // пол базы (низ города на нём)
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_cityImg, cx - dw / 2, baseY - dh, dw, dh);
  ctx.restore();
}

function drawWorld(ctx, world, unit, camera, debug) {
  const W = camera.viewW, H = camera.viewH;
  const ox = Math.round(camera.x), oy = Math.round(camera.y);
  const x0 = Math.floor(camera.x / TILE), y0 = Math.max(0, Math.floor(camera.y / TILE));
  const x1 = Math.floor((camera.x + W) / TILE);
  const y1 = Math.min(MAP_H - 1, Math.floor((camera.y + H) / TILE));
  const airU = (x, y) => world.tileAt(x, y).type === AIR && y >= SURFACE_ROWS;

  // 1) база
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = world.tileAt(x, y), sx = x * TILE - ox, sy = y * TILE - oy;
      if (t.type === BORDER) ctx.fillStyle = '#05070a';
      else if (t.type === INDESTRUCT) ctx.fillStyle = '#191d26';
      else if (t.type === AIR && y < SURFACE_ROWS) ctx.fillStyle = '#16202c';
      else if (t.type === AIR) ctx.fillStyle = t.screw ? screwBackColor(y) : backColor(y);   // винтовой ход — серый фон
      else ctx.fillStyle = gapColor(y);
      ctx.fillRect(sx, sy, TILE + 1, TILE + 1);
      if (t.type === INDESTRUCT) { // плита-основание: банты сверху/снизу
        ctx.fillStyle = 'rgba(150,170,200,0.07)'; ctx.fillRect(sx, sy, TILE, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx, sy + TILE - 2, TILE, 2);
      }
    }

  // 2) осколки + паутина трещин (клип по породе)
  ctx.save();
  ctx.beginPath();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (world.tileAt(x, y).type === ROCK) ctx.rect(x * TILE - ox, y * TILE - oy, TILE + 1, TILE + 1);
  ctx.clip();
  drawChunks(ctx, world, camera, W, H);
  ctx.restore();

  // 2a) ПЕРЕКРЫТЬ протёкшую в воздух породу: base-fill (gapColor) и чанки рисуются `TILE+1` → залезают на 1px
  // ВПРАВО/ВНИЗ в соседний воздушный тайл, а `raggedEdge` красит дно ТОЛЬКО внутри породы (в воздух не достаёт).
  // Из-за дробного scale этот 1px виден как «полоска породы» ровно по квадратной кромке тайла (и H, и V, всегда).
  // Перерисовываем дно воздуха `backColor` ПОВЕРХ осколков (тот же `TILE+1` — стыки воздух-воздух не разойдутся) →
  // квадратная кромка исчезает, остаётся только рваная эрозийная линия (её рисует raggedEdge ниже, внутрь породы).
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (airU(x, y)) { ctx.fillStyle = world.tileAt(x, y).screw ? screwBackColor(y) : backColor(y); ctx.fillRect(x * TILE - ox, y * TILE - oy, TILE + 1, TILE + 1); }

  // 2b) жилы ресурса в породе
  drawResourceVeins(ctx, world, ox, oy, x0, y0, x1, y1);

  // 2c) трещины нестабильной породы + большие камни (тяжёлые валуны) поверх кладки/жил
  if (typeof drawUnstableCracks === 'function') drawUnstableCracks(ctx, world, x0, y0, x1, y1, ox, oy);
  if (typeof drawBoulders === 'function') drawBoulders(ctx, world, x0, y0, x1, y1, ox, oy);

  // 3) фактура дна ходов (клип по прорытому)
  ctx.save();
  ctx.beginPath();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (airU(x, y)) ctx.rect(x * TILE - ox, y * TILE - oy, TILE + 1, TILE + 1);
  ctx.clip();
  drawBackTexture(ctx, world, camera, W, H);
  ctx.restore();

  // 4) рваные края у ходов
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const t = world.tileAt(x, y);
      if (t.type !== ROCK) continue;
      const sx = x * TILE - ox, sy = y * TILE - oy, back = backColor(y);
      if (airU(x, y + 1)) raggedEdge(ctx, x, y, sx, sy, 0, back);
      if (airU(x, y - 1)) raggedEdge(ctx, x, y, sx, sy, 1, back);
      if (airU(x - 1, y)) raggedEdge(ctx, x, y, sx, sy, 2, back);
      if (airU(x + 1, y)) raggedEdge(ctx, x, y, sx, sy, 3, back);
    }

  // 5) длинная тень-«труба» от неровного силуэта породы
  drawTunnelShadow(ctx, world, camera, ox, oy, x0, y0, x1, y1);

  // 6) следы бура на стенках (поверх тени — борозды читаются)
  ctx.save();
  ctx.beginPath();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (airU(x, y)) ctx.rect(x * TILE - ox, y * TILE - oy, TILE + 1, TILE + 1);
  ctx.clip();
  drawBoreMarks(ctx, world, ox, oy, x0, y0, x1, y1);
  ctx.restore();

  const surfaceY = Math.round(SURFACE_ROWS * TILE - oy);
  ctx.strokeStyle = 'rgba(120,160,200,0.35)';
  ctx.beginPath(); ctx.moveTo(0, surfaceY + 0.5); ctx.lineTo(W, surfaceY + 0.5); ctx.stroke();

  drawPlayerCity(ctx, camera, oy);   // ассет города на фундаменте (заменяет плейсхолдер-принтер; коорд. PRINTER ещё нужны для интро/atBase)

  drawCityMarkers(ctx, world, camera, debug);
  drawWildMarkers(ctx, world, camera, debug);
}
