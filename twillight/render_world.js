'use strict';

// Рендер мира в разрезе. Порода — плоские осколки с градиентом (без контура),
// плотность ∝ числу/размеру кусков (при высокой слипаются). Трещины бурения —
// паутина на КАЖДОМ осколке, проступает прогрессивно от края входа бура вглубь
// (ближние осколки трескаются раньше дальних). Прорытый ход светлее тьмы; по краям
// — длинная мягкая тень-«труба», отброшенная НЕРОВНЫМ силуэтом породы (повторяет
// рваную линию, а не сетку тайлов). На стенках — следы бура (горнопроходка).

const GAP_HEX  = ['#2a2012', '#231d14', '#181620']; // тёмный фон между осколками
const SHADES   = [
  ['#5e4b2e', '#6b5535', '#776039'],
  ['#4c4031', '#574a3a', '#615345'],
  ['#393545', '#3f3a48', '#48434f'],
];
const BACK_HEX = ['#473a27', '#3e3526', '#2e2b37']; // дно хода: темнее породы, но светлее тьмы

// Геологические зоны раньше переключались РЕЗКО на границах твёрдости (y=MAP_H/2,
// 0.78·MAP_H) → на сетке проступал горизонтальный шов (особенно на ровном дне хода
// под прожектором). Теперь цвет базы интерполируется НЕПРЕРЫВНО: переход размазан по
// полосе `_LBAND` тайлов вокруг границы — шва нет. `layerFloat(y)` ∈ [0..2].
function _hx(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
const GAP_RGB = GAP_HEX.map(_hx), BACK_RGB = BACK_HEX.map(_hx), SHADES_RGB = SHADES.map((r) => r.map(_hx));
const _LB1 = MAP_H * 0.5, _LB2 = MAP_H * 0.78, _LBAND = 9;
function layerFloat(y) {
  const a = Math.max(0, Math.min(1, (y - (_LB1 - _LBAND)) / (2 * _LBAND)));
  const b = Math.max(0, Math.min(1, (y - (_LB2 - _LBAND)) / (2 * _LBAND)));
  return a + b;
}
function _palAt(rgb, lf) { const i = Math.max(0, Math.min(rgb.length - 2, Math.floor(lf))), f = lf - i, A = rgb[i], B = rgb[i + 1];
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * f)},${Math.round(A[1] + (B[1] - A[1]) * f)},${Math.round(A[2] + (B[2] - A[2]) * f)})`; }
function backColor(y) { const lf = layerFloat(y); return lf === (lf | 0) ? BACK_HEX[lf] : _palAt(BACK_RGB, lf); }   // быстрый путь вне полос перехода
function gapColor(y)  { const lf = layerFloat(y); return lf === (lf | 0) ? GAP_HEX[lf] : _palAt(GAP_RGB, lf); }
function shadeColor(tone, y) {
  const lf = layerFloat(y); if (lf === (lf | 0)) return SHADES[lf][tone];
  const i = Math.min(1, lf | 0), f = lf - i, A = SHADES_RGB[i][tone], B = SHADES_RGB[i + 1][tone];
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * f)},${Math.round(A[1] + (B[1] - A[1]) * f)},${Math.round(A[2] + (B[2] - A[2]) * f)})`;
}

function tileHash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Осколки породы (плоские, с лёгким градиентом, без контура) + паутина трещин,
// проступающая прогрессивно от стороны входа бура (соседний воздух) вглубь тайла.
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
        const V = 5, baseA = tileHash(x + k, y - k) * 6.283;
        ctx.beginPath();
        for (let j = 0; j < V; j++) {
          const a = baseA + (j / V) * 6.283;
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
        // паутина трещин на самом осколке: глубина осколка вдоль оси бурения
        // задаёт порог появления (ближние к входу трескаются раньше дальних).
        if (prog > 0) {
          const lx = Math.min(1, Math.max(0, hx * 1.1 - 0.05));
          const ly = Math.min(1, Math.max(0, hy * 1.1 - 0.05));
          let depth;
          if (ey < 0) depth = ly; else if (ey > 0) depth = 1 - ly;
          else if (ex < 0) depth = lx; else depth = 1 - lx;
          const lp = Math.min(1, Math.max(0, (prog - depth * 0.7) / 0.3));
          if (lp > 0.04) {
            const web = 3 + Math.floor(lp * 2);
            ctx.strokeStyle = `rgba(7,4,2,${0.3 + lp * 0.55})`;
            ctx.lineWidth = Math.max(0.8, r * 0.1);
            const a0 = tileHash(x * 5 + k, y * 9 + k) * 6.283;
            for (let b = 0; b < web; b++) {
              const ang = a0 + b * (6.283 / web) + (tileHash(x + b + k, y - b) - 0.5) * 0.7;
              const len = r * (0.35 + lp * 0.85);
              let px = cx, py = cy;
              ctx.beginPath(); ctx.moveTo(px, py);
              for (let s = 1; s <= 2; s++) {
                px += Math.cos(ang) * len / 2 + (tileHash(x + s + b + k, y - s) - 0.5) * r * 0.3;
                py += Math.sin(ang) * len / 2 + (tileHash(x - s, y + s + b + k) - 0.5) * r * 0.3;
                ctx.lineTo(px, py);
              }
              ctx.stroke();
            }
          }
        }
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
    ctx.fillStyle = '#2a2230';
    for (let i = 0; i < 3; i++) {
      const cw = ww * (1 - i * 0.28), off = (tileHash(w.cx + i, w.floorY) - 0.5) * TILE * 0.5;
      ctx.fillRect(sx - cw / 2 + off, fy - (i + 1) * h, cw, h + 1);
    }
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 500 + w.cx);
    ctx.fillStyle = `rgba(210,70,55,${0.45 + 0.4 * pulse})`;
    ctx.beginPath(); ctx.arc(sx, fy - h * 1.6, TILE * 0.17, 0, 6.283); ctx.fill();
    ctx.fillStyle = PAL.bloodBright; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ДИКИЙ ГОРОД', sx, fy - 3 * h - 6);
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
      ctx.beginPath(); ctx.ellipse(cx, cy, size, size * 0.7, tileHash(gx, gy * 3) * Math.PI, 0, 6.283); ctx.fill();
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
      if (airU(x, y)) { ctx.rect(sx, sy, TILE + 1, TILE + 1); continue; }
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
  ctx.beginPath();
  let anyAir = false;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (airU(x, y)) { ctx.rect(x * TILE - ox, y * TILE - oy, TILE, TILE); anyAir = true; }
  if (!anyAir) { ctx.restore(); return; }
  ctx.clip();
  ctx.shadowColor = 'rgba(3,2,1,0.95)';
  ctx.shadowBlur = TILE * 1.05;
  ctx.drawImage(_shC, 0, 0);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
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
      else if (t.type === AIR) ctx.fillStyle = backColor(y);
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

  // 2b) жилы ресурса в породе
  drawResourceVeins(ctx, world, ox, oy, x0, y0, x1, y1);

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

  const prx = camera.screenX((PRINTER.x + PRINTER.w / 2) * TILE) - PRINTER.w * TILE / 2;
  const pry = PRINTER.y * TILE - oy;
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(prx, pry, PRINTER.w * TILE, PRINTER.h * TILE);
  ctx.strokeStyle = '#7fd7ff';
  ctx.strokeRect(prx + 0.5, pry + 0.5, PRINTER.w * TILE - 1, PRINTER.h * TILE - 1);

  drawCityMarkers(ctx, world, camera, debug);
  drawWildMarkers(ctx, world, camera, debug);
}
