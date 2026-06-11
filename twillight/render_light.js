'use strict';

// Слой освещения/видимости (вынесен из render_world.js): туман войны, прожектор-конус
// от реактора (с окклюзией породой, пенумброй и ambient-гало) и пыль в луче. Свободные
// функции draw*; вызываются из game.drawScene после рендера мира, перед юнитом.
// `drawHeadlight` опирается на `unitLightAnchor` (render_unit.js) — резолв в момент вызова.

// Туман войны + свет одним мягким градиентом. Диапазон с запасом в 1 тайл за
// краями вьюпорта — иначе при движении у нижней/верхней кромки мелькает порода.
let _fogC = null, _fogX = null;
function drawFog(ctx, world, unit, camera, W, H) {
  const x0 = Math.floor(camera.x / TILE) - 1, y0 = Math.max(0, Math.floor(camera.y / TILE) - 1);
  const x1 = Math.floor((camera.x + W) / TILE) + 1;
  const y1 = Math.min(MAP_H - 1, Math.floor((camera.y + H) / TILE) + 1);
  const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
  if (cols <= 0 || rows <= 0) return;
  if (!_fogC) { _fogC = document.createElement('canvas'); _fogX = _fogC.getContext('2d'); }
  if (_fogC.width < cols || _fogC.height < rows) { _fogC.width = cols; _fogC.height = rows; }
  const img = _fogX.createImageData(cols, rows), d = img.data;
  const ux = unit.px / TILE - 0.5, uy = unit.py / TILE - 0.5;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const tx = x0 + i, ty = y0 + j;
      let a;
      if (!world.isSeen(tx, ty)) a = 1;
      else {
        let dxw = tx - ux;                              // расстояние до света — по кольцу
        if (dxw > MAP_W / 2) dxw -= MAP_W; else if (dxw < -MAP_W / 2) dxw += MAP_W;
        const dist = Math.hypot(dxw, ty - uy);
        a = Math.min(1, Math.max(0, (dist - LIGHT_R0) / (LIGHT_R1 - LIGHT_R0))) * FOG_EXPLORED;
      }
      const o = (j * cols + i) * 4;
      d[o] = 7; d[o + 1] = 5; d[o + 2] = 10; d[o + 3] = Math.round(a * 255);  // PAL.void — тёплая темнота тумана
    }
  _fogX.putImageData(img, 0, 0);
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_fogC, 0, 0, cols, rows, x0 * TILE - camera.x, y0 * TILE - camera.y, cols * TILE, rows * TILE);
  ctx.imageSmoothingEnabled = sm;
}

// Прожектор у основания бура: конус света вперёд по взгляду, гаснет по дистанции,
// ОТСЕКАЕТСЯ ПОРОДОЙ (свет не проходит сквозь камень). Окклюзия — через лучевую
// «видимость»: веер лучей из вершины, каждый останавливается на первом твёрдом
// тайле → строим полигон освещённой зоны. На оффскрине заливаем тьму и вырезаем
// (destination-out) ТОЛЬКО этот полигон (радиальный фейд) — дыру в затемнении, не в
// сцене; затем тёплый отблеск тем же полигоном (аддитивно). Остальное — затемнено.
let _hlC = null, _hlX = null;
// Свет глушится не по сетке тайлов, а по ВИЗУАЛЬНОЙ кромке: точка в породе считается
// «открытой», если попадает в зону эрозии грани, выходящей в воздух (тот же `_ragDepth`,
// что рисует рваный край в render_world.js). Так конус повторяет неровный ландшафт.
function _coneSolid(world, wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE), t = world.tileAt(tx, ty);
  if (t.type === BORDER || t.type === INDESTRUCT) return true;   // рукотворное/край — прямой клип по сетке
  if (t.type !== ROCK) return false;                              // воздух — свет проходит
  const lx = wx / TILE - tx, ly = wy / TILE - ty;                 // позиция внутри тайла 0..1
  const airU = (dx, dy) => { const n = world.tileAt(tx + dx, ty + dy); return n.type === AIR && (ty + dy) >= SURFACE_ROWS; };
  if (airU(0, 1)  && (1 - ly) < _ragDepth(tx + lx, 0)) return false;   // эрозия снизу
  if (airU(0, -1) && ly       < _ragDepth(tx + lx, 1)) return false;   // сверху
  if (airU(-1, 0) && lx       < _ragDepth(ty + ly, 2)) return false;   // слева
  if (airU(1, 0)  && (1 - lx) < _ragDepth(ty + ly, 3)) return false;   // справа
  return true;                                                    // настоящая порода
}
function _coneVisibility(world, camera, ax, ay, fx, fy, L, half) {
  const axisA = Math.atan2(fy, fx); half = half || 0.30;   // полу-угол конуса (передаётся по уровню прожектора)
  const ox = camera.x, oy = camera.y, step = TILE * 0.28;
  const pts = [[ax, ay]];
  const N = 72;                                             // плотный веер: тоньше «лесенка»
  for (let i = 0; i <= N; i++) {
    const a = axisA + (i / N - 0.5) * 2 * half;
    const dx = Math.cos(a), dy = Math.sin(a);
    const solidAt = (tt) => { const wx = ax + ox + dx * tt, wy = ay + oy + dy * tt; return world && _coneSolid(world, wx, wy); };
    let t = step, hit = L;
    for (; t <= L; t += step) {
      if (solidAt(t)) {
        // луч уже ВНУТРИ породы → уточняем границу бисекцией между прошлым (воздух) и t,
        // чтобы конус останавливался ровно у поверхности камня, а не залезал в него.
        let lo = t - step, hi = t;
        for (let b = 0; b < 5; b++) { const mid = (lo + hi) / 2; if (solidAt(mid)) hi = mid; else lo = mid; }
        hit = lo; break;
      }
    }
    const tEnd = Math.min(L, hit);
    pts.push([ax + dx * tEnd, ay + dy * tEnd]);
  }
  return pts;
}
function drawHeadlight(ctx, world, unit, camera, W, H) {
  // вершина/направление — от узла реактора (через трансформ юнита) → свет дышит с ним
  const an = unitLightAnchor(world, unit, camera);
  const ax = an.ax, ay = an.ay, fx = an.fx, fy = an.fy;
  // центр юнита — для ambient-гало: в тесном проходе (стенки вокруг) конус схлопывается,
  // и подсветить надо сам тайл, где стоит юнит, чтобы проход читался.
  const ux = Math.round(camera.screenX(unit.px)), uy = Math.round(unit.py - camera.y);
  const HALO = TILE * 1.3;
  // ПРОЖЕКТОР: уровень 0..3 (стат projLvl) растит ШИРИНУ, ЯРКОСТЬ и немного длину — значимые шаги
  const pl = (unit.stats && unit.stats.projLvl) || 0;       // равномерно по 3 уровням (без прожектора темно — норма)
  const half = 0.25 + pl * 0.11;                            // ширина: ур.0 0.25 (очень узкий) → ур.3 0.58
  const L = TILE * (3.5 + pl * 0.9);                        // длина/рассеивание: ур.0 3.5 → ур.3 6.2 тайла
  const cutA = 0.60 + pl * 0.13, glowA = 0.05 + pl * 0.05;  // яркость: ур.0 0.60 (тусклый) → ур.3 ~0.99 (яркий)
  const pts = _coneVisibility(world, camera, ax, ay, fx, fy, L, half);
  const lit = (g) => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); };

  if (!_hlC) { _hlC = document.createElement('canvas'); _hlX = _hlC.getContext('2d'); }
  if (_hlC.width !== Math.ceil(W) || _hlC.height !== Math.ceil(H)) { _hlC.width = Math.ceil(W); _hlC.height = Math.ceil(H); }
  const h = _hlX;
  // ПЕНУМБРА: ядро луча рисуем РЕЗКО (заливка с фейдом только по дистанции), а мягкость
  // даём отдельным узким размытым «гало» по контуру — интерьер остаётся чётким.
  // Резкий радиальный профиль: ярко до ~78% длины, затем гаснет к концу.
  const coreGrad = (g, a0, a1) => { const r = g.createRadialGradient(ax, ay, TILE * 0.2, ax, ay, L);
    r.addColorStop(0, a0); r.addColorStop(0.5, a0); r.addColorStop(1, a1); return r; };  // гаснет раньше
  const rim = TILE * 0.16;                                  // ширина мягкой полутени

  // 1) затемнение сцены; РЕЗКО вырезаем ядро + мягкая полутень по краю
  h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, _hlC.width, _hlC.height);
  h.globalCompositeOperation = 'source-over';
  h.fillStyle = 'rgba(6,5,11,0.46)'; h.fillRect(0, 0, _hlC.width, _hlC.height);
  // ядро — резкий клип
  h.save(); lit(h); h.clip();
  h.globalCompositeOperation = 'destination-out';
  h.fillStyle = coreGrad(h, `rgba(0,0,0,${cutA})`, 'rgba(0,0,0,0)'); h.fillRect(0, 0, _hlC.width, _hlC.height);   // ядро вырезаем по уровню → ярче с апгрейдом
  h.restore();
  // полутень — размытый контур (только кромка): убираем ещё немного тьмы мягким штрихом
  h.save();
  h.globalCompositeOperation = 'destination-out';
  h.filter = `blur(${rim.toFixed(1)}px)`;
  h.lineJoin = 'round'; h.lineWidth = rim * 1.8;
  h.strokeStyle = 'rgba(0,0,0,0.5)'; lit(h); h.stroke();
  h.restore(); h.filter = 'none';
  // ambient-гало вокруг юнита (без клипа по конусу) — освещает текущий проход даже в тупике
  h.save();
  h.globalCompositeOperation = 'destination-out';
  const gh = h.createRadialGradient(ux, uy, TILE * 0.15, ux, uy, HALO);
  gh.addColorStop(0, 'rgba(0,0,0,0.92)'); gh.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
  h.fillStyle = gh; h.fillRect(0, 0, _hlC.width, _hlC.height);
  h.restore();
  ctx.drawImage(_hlC, 0, 0);

  // 2) тёплый отблеск — резкое ядро тем же профилем (без блюра интерьера)
  h.setTransform(1, 0, 0, 1, 0, 0); h.clearRect(0, 0, _hlC.width, _hlC.height);
  h.globalCompositeOperation = 'source-over';
  h.save(); lit(h); h.clip();
  const gw = h.createRadialGradient(ax, ay, TILE * 0.2, ax, ay, L);
  gw.addColorStop(0, `rgba(255,214,150,${glowA})`); gw.addColorStop(0.5, `rgba(255,196,124,${glowA * 0.4})`); gw.addColorStop(1, 'rgba(255,180,90,0)');
  h.fillStyle = gw; h.fillRect(0, 0, _hlC.width, _hlC.height);
  h.restore();
  // тёплый ambient-отблеск вокруг юнита (без клипа) — в тон гало подсветки прохода
  const gwh = h.createRadialGradient(ux, uy, TILE * 0.1, ux, uy, HALO * 0.9);
  gwh.addColorStop(0, 'rgba(255,206,150,0.13)'); gwh.addColorStop(1, 'rgba(255,206,150,0)');
  h.fillStyle = gwh; h.fillRect(0, 0, _hlC.width, _hlC.height);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(_hlC, 0, 0); ctx.restore();

  // 3) ПЫЛЬ в луче: тонкая дрейфующая зернистость (клип по конусу, аддитивно)
  _drawDust(ctx, pts, ax, ay, L, camera);
}

// Пыль/взвесь в луче: ОТДЕЛЬНЫЕ пылинки, не тайл-паттерн. Каждая лёгкая — дрейфует
// МЕДЛЕННО по СЛОЖНОЙ траектории (две синусоиды разной частоты/фазы на ось → плавная
// кривая Лиссажу, направление постоянно меняется, без линейного «снега»). Пылинки
// разложены на параллакс-сетке, анкерены в МИРЕ (при движении юнита проплывают мимо),
// клип по конусу, плотнее у источника (фейд по дистанции). Спрайт-точка кэшируется.
let _dustDot = null;
function _ensureDot() {
  if (_dustDot) return;
  _dustDot = document.createElement('canvas'); _dustDot.width = _dustDot.height = 16;
  const d = _dustDot.getContext('2d');
  const g = d.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,243,212,1)'); g.addColorStop(0.45, 'rgba(255,240,205,0.5)'); g.addColorStop(1, 'rgba(255,240,205,0)');
  d.fillStyle = g; d.fillRect(0, 0, 16, 16);
}
function _dustHash(i) { let h = Math.imul((i | 0) ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
// Один параллакс-слой пыли: пылинка на ячейку сетки (мир), плавное блуждание, фейд по дистанции.
function _dustLayer(ctx, camera, t, ax, ay, L, W, H, par, cell, szMin, szMax, bright, wander, seedOff) {
  const camx = camera.x * par, camy = camera.y * par;            // эффективная камера слоя (параллакс)
  const gx0 = Math.floor((camx - cell) / cell), gx1 = Math.floor((camx + W + cell) / cell);
  const gy0 = Math.floor((camy - cell) / cell), gy1 = Math.floor((camy + H + cell) / cell);
  const ampX = cell * 0.42, ampY = cell * 0.42, TAU = 6.2832;
  for (let gy = gy0; gy <= gy1; gy++)
    for (let gx = gx0; gx <= gx1; gx++) {
      const seed = ((gx * 73856093) ^ (gy * 19349663) ^ seedOff) >>> 0;
      const r1 = _dustHash(seed), r2 = _dustHash(seed + 7), r3 = _dustHash(seed + 13), r4 = _dustHash(seed + 23), r5 = _dustHash(seed + 41);
      // дом ячейки (в мире) + СЛОЖНОЕ медленное блуждание: 2 частоты на ось, разные фазы
      const f1 = (0.03 + r3 * 0.06) * wander, f2 = (0.02 + r4 * 0.05) * wander, ph = r5 * TAU;
      const dx = ampX * Math.sin(t * f1 * TAU + ph) + ampX * 0.55 * Math.sin(t * f2 * TAU + ph * 1.7 + 1.3);
      const dy = ampY * Math.cos(t * f1 * TAU * 0.83 + ph * 1.3) + ampY * 0.55 * Math.sin(t * f2 * TAU * 1.2 + ph + 0.7);
      const sx = gx * cell + r1 * cell + dx - camx, sy = gy * cell + r2 * cell + dy - camy;  // экран (с параллаксом)
      const ddx = sx - ax, ddy = sy - ay, dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist >= L) continue;                                   // вне досягаемости конуса — пропускаем
      const fd = 1 - dist / L, fade = fd * fd * (3 - 2 * fd);    // плотнее у источника (smoothstep)
      const tw = 0.6 + 0.4 * Math.sin(t * (0.4 + r2 * 0.9) + ph * 2.1);  // лёгкое мерцание
      const sz = szMin + r3 * (szMax - szMin);
      ctx.globalAlpha = Math.min(1, bright * fade * tw);
      ctx.drawImage(_dustDot, sx - sz, sy - sz, sz * 2, sz * 2);
    }
}
function _drawDust(ctx, pts, ax, ay, L, camera) {
  _ensureDot();
  const t = performance.now() / 1000, W = camera.viewW, H = camera.viewH;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  _dustLayer(ctx, camera, t, ax, ay, L, W, H, 1.0, TILE * 1.5, 0.8, 2.3, 1.0, 1.0, 0);        // ближний: крупнее, ярче
  _dustLayer(ctx, camera, t, ax, ay, L, W, H, 0.55, TILE * 2.0, 0.5, 1.3, 0.6, 0.7, 90017);   // дальний: мельче, медленнее, тусклее
  ctx.globalAlpha = 1;
  ctx.restore();
}
