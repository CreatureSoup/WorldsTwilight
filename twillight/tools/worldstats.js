'use strict';

// DEV-ИНСТРУМЕНТ СТАТИСТИКИ ГЕНЕРАЦИИ МИРА — НЕ в загрузчике index.html; грузится по требованию в превью
// (инжект <script src="/tools/worldstats.js?cb=…"> из preview_eval). Батч-прогон N сидов → агрегаты разброса/
// плотности дискретных сущностей. Чисто для ОБРАБОТКИ Claude: без UI, на выход — структурные данные + готовая
// ASCII-сводка `report` (многострочная строка), которую удобно читать в одном eval-результате.
//
//   WorldStats.run({ seeds, gridCols, gridRows, includeResources, excludeTestBase })  → { summary, anomalies, heatmap, byBand, density, resources, report }
//   WorldStats.print(opts)  → только строка report (то же, что .run(opts).report)
//
// Метрики: кол-ва (ожид/факт/срыв размещения) · соблюдение мин-дистанций · 2D-хитмап (мёртвые зоны/кластеры) ·
// разрез по глубинным бэндам (разнообразие = «интересность» региона) · ближайший-сосед (плотность) · покрытие ресурсом.
// ⚠ Убрать перед релизом (как tools/teaser.js). Требует глобалы World/MAP_W/MAP_H/CAVE_FLOOR_Y/*_MIN_DIST/*_COUNT.

(function () {
  const TYPES = ['artifact', 'server', 'robot', 'trap', 'backdrop', 'cavern', 'wild'];   // мина — подтип ловушки (в w.traps), отдельно не считаем
  // ожидаемое кол-во (без +1 тест-объекта у базы — те исключаются); idol-сцена даёт backdrops = COUNT+1
  // top-level const НЕ на window → читаем по голому идентификатору (общий глобальный лекс-скоуп <script>-ов) с typeof-гардом
  const EXPECT = () => ({   // ожид = ГЛУБОКИЙ счётчик + ВЕРХНИЙ бюджет (UP); backdrop +1 idol-сцена
    artifact: (typeof ARTIFACT_SEED_COUNT !== 'undefined' ? ARTIFACT_SEED_COUNT : 0) + (typeof ARTIFACT_SEED_UP !== 'undefined' ? ARTIFACT_SEED_UP : 0),
    server: (typeof SERVER_COUNT !== 'undefined' ? SERVER_COUNT : 0) + (typeof SERVER_UP !== 'undefined' ? SERVER_UP : 0),
    robot: (typeof ROBOT_COUNT !== 'undefined' ? ROBOT_COUNT : 0) + (typeof ROBOT_UP !== 'undefined' ? ROBOT_UP : 0),
    trap: (typeof TRAP_COUNT !== 'undefined' ? TRAP_COUNT : 0) + (typeof TRAP_UP !== 'undefined' ? TRAP_UP : 0),   // вкл. мину как подтип
    backdrop: (typeof BACKDROP_COUNT !== 'undefined' ? BACKDROP_COUNT : 0) + (typeof BACKDROP_UP !== 'undefined' ? BACKDROP_UP : 0) + 1,
    cavern: typeof OTHER_CITIES !== 'undefined' ? OTHER_CITIES : 0,
    wild: typeof WILD_NESTS !== 'undefined' ? WILD_NESTS : 0,
  });
  const MIN_DIST = () => ({
    artifact: typeof ARTIFACT_MIN_DIST !== 'undefined' ? ARTIFACT_MIN_DIST : null,
    server: typeof SERVER_MIN_DIST !== 'undefined' ? SERVER_MIN_DIST : null,
    hazard: typeof HAZARD_MIN_DIST !== 'undefined' ? HAZARD_MIN_DIST : null,   // роботы/ловушки/мины — единый пул
  });

  const torX = (a, b) => { const d = Math.abs(a - b) % MAP_W; return Math.min(d, MAP_W - d); };
  const dist2D = (x1, y1, x2, y2) => Math.hypot(torX(x1, x2), y1 - y2);

  function collect(w, excludeTestBase) {
    const testY = (typeof CAVE_FLOOR_Y !== 'undefined' ? CAVE_FLOOR_Y : 0) + 3, E = [];
    const push = (type, x, y, sub) => { if (excludeTestBase && y === testY) return; E.push({ type, x, y, sub }); };
    for (const a of w.artifacts) push('artifact', a.tx, a.ty, a.tech && a.tech.id);
    for (const s of w.servers) push('server', s.tx, s.ty);
    for (const r of w.robots) push('robot', r.tx, r.ty, r.kind);
    for (const t of w.traps) push('trap', t.tx, t.ty, t.type);   // мина — подтип ловушки (sub='mine')
    for (const b of w.backdrops) push('backdrop', b.cx, b.cy, b.kind);
    for (const c of w.caverns) push('cavern', c.cx, c.cy);
    for (const wd of w.wilds) push('wild', wd.cx, wd.cy);
    return E;
  }

  function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
  function stdev(a) { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); }
  function median(a) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function r1(x) { return Math.round(x * 10) / 10; }

  function run(opts) {
    opts = opts || {};
    const seeds = opts.seeds || 40, cols = opts.gridCols || 12, rows = opts.gridRows || 16;
    const includeResources = opts.includeResources !== false, excludeTestBase = opts.excludeTestBase !== false;
    if (typeof World !== 'function') return { error: 'World не определён — открой страницу игры' };
    const cellW = MAP_W / cols, cellH = MAP_H / rows;
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));               // суммарно сущностей в ячейке (по всем сидам)
    const gridTypes = Array.from({ length: rows }, () => Array.from({ length: cols }, () => new Set()));   // набор типов в ячейке (разнообразие)
    const resGrid = Array.from({ length: rows }, () => new Array(cols).fill(0));            // тайлов-ресурсов в ячейке
    const resCells = Array.from({ length: rows }, () => new Array(cols).fill(0));           // сколько раз ячейка вообще ИГРАЛА (для нормировки покрытия) — = rows-cols всегда seeds
    const counts = {}, perSeedMin = {}, globalMin = {}, nnByType = {}, nnAll = [], anomalies = [];
    for (const t of TYPES) { counts[t] = []; nnByType[t] = []; }
    perSeedMin.artifact = []; perSeedMin.server = []; perSeedMin.hazard = [];
    globalMin.artifact = Infinity; globalMin.server = Infinity; globalMin.hazard = Infinity;
    const bandTypeCount = Array.from({ length: rows }, () => ({}));   // на бэнд — счётчик по типам

    for (let si = 0; si < seeds; si++) {
      const seed = (opts.seedBase || 101) + si * 2654435761 % 1e9;
      const w = new World(seed >>> 0); w.generate();
      const E = collect(w, excludeTestBase);
      const byType = {}; for (const t of TYPES) byType[t] = [];
      for (const e of E) {
        byType[e.type].push(e);
        const c = Math.min(cols - 1, Math.max(0, Math.floor(e.x / cellW)));
        const r = Math.min(rows - 1, Math.max(0, Math.floor(e.y / cellH)));
        grid[r][c]++; gridTypes[r][c].add(e.type);
        bandTypeCount[r][e.type] = (bandTypeCount[r][e.type] || 0) + 1;
      }
      for (const t of TYPES) counts[t].push(byType[t].length);
      // мин-дистанции и NN
      const minPair = (arr) => { let m = Infinity; for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) { const d = dist2D(arr[i].x, arr[i].y, arr[j].x, arr[j].y); if (d < m) m = d; } return m; };
      const haz = byType.robot.concat(byType.trap);   // ловушки вкл. мины (единый пул опасностей)
      if (byType.artifact.length > 1) { const m = minPair(byType.artifact); perSeedMin.artifact.push(m); globalMin.artifact = Math.min(globalMin.artifact, m); }
      if (byType.server.length > 1) { const m = minPair(byType.server); perSeedMin.server.push(m); globalMin.server = Math.min(globalMin.server, m); }
      if (haz.length > 1) { const m = minPair(haz); perSeedMin.hazard.push(m); globalMin.hazard = Math.min(globalMin.hazard, m); }
      // ближайший сосед (плотность): для каждой сущности — расстояние до ближайшей ЛЮБОЙ другой; и в рамках типа
      for (const e of E) {
        let nnAny = Infinity, nnT = Infinity;
        for (const o of E) { if (o === e) continue; const d = dist2D(e.x, e.y, o.x, o.y); if (d < nnAny) nnAny = d; if (o.type === e.type && d < nnT) nnT = d; }
        if (isFinite(nnAny)) nnAll.push(nnAny);
        if (isFinite(nnT)) nnByType[e.type].push(nnT);
      }
      // ресурс-покрытие (опц.): тайлы с resource по ячейкам
      if (includeResources && w.tiles) {
        for (let y = 0; y < MAP_H; y++) { const r = Math.min(rows - 1, Math.floor(y / cellH)); const base = y * MAP_W;
          for (let x = 0; x < MAP_W; x++) { const t = w.tiles[base + x]; if (t && t.resource) { const c = Math.min(cols - 1, Math.floor(x / cellW)); resGrid[r][c]++; } } }
      }
      // аномалии: срыв размещения (факт < ожид по дискретным; backdrops/cavern/wild фикс.)
      const exp = EXPECT();
      for (const t of ['artifact', 'server', 'robot', 'trap']) {
        const got = byType[t].length, want = exp[t] - 0;   // (test исключён → факт должен == want)
        if (got < want) anomalies.push(`seed#${si}: ${t} ${got}/${want} (срыв размещения — тесно)`);
      }
    }

    // агрегаты
    const exp = EXPECT(), md = MIN_DIST();
    const summary = { seeds, grid: `${rows}×${cols}`, cellTiles: `${r1(cellW)}×${r1(cellH)}`, counts: {}, spacing: {} };
    for (const t of TYPES) summary.counts[t] = { expect: exp[t], avg: r1(mean(counts[t])), min: Math.min(...counts[t]), max: Math.max(...counts[t]), stdev: r1(stdev(counts[t])) };
    summary.spacing.artifact = { minReq: md.artifact, globalMin: r1(globalMin.artifact), avgPerSeedMin: r1(mean(perSeedMin.artifact)), violations: perSeedMin.artifact.filter((d) => d < md.artifact - 1e-6).length };
    summary.spacing.server = { minReq: md.server, globalMin: r1(globalMin.server), avgPerSeedMin: r1(mean(perSeedMin.server)), violations: perSeedMin.server.filter((d) => d < md.server - 1e-6).length };
    summary.spacing.hazard = { minReq: md.hazard, globalMin: r1(globalMin.hazard), avgPerSeedMin: r1(mean(perSeedMin.hazard)), violations: perSeedMin.hazard.filter((d) => d < md.hazard - 1e-6).length };

    const density = { nnAll: { mean: r1(mean(nnAll)), median: r1(median(nnAll)), min: r1(Math.min(...nnAll)) }, byType: {} };
    for (const t of TYPES) if (nnByType[t].length) density.byType[t] = { meanNN: r1(mean(nnByType[t])), medianNN: r1(median(nnByType[t])), minNN: r1(Math.min(...nnByType[t])) };

    // хитмап (avg сущностей/ячейку) + мёртвые/горячие ячейки
    const avgGrid = grid.map((row) => row.map((v) => v / seeds));
    const dead = []; const flat = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const v = avgGrid[r][c]; if (v < 0.02) dead.push([r, c]); flat.push({ r, c, v }); }
    flat.sort((a, b) => b.v - a.v); const hot = flat.slice(0, 5).map((o) => ({ band: o.r, col: o.c, avg: r1(o.v) }));

    // разрез по бэндам глубины (интересность = разнообразие типов)
    const byBand = [];
    for (let r = 0; r < rows; r++) {
      const y0 = Math.round(r * cellH), y1 = Math.round((r + 1) * cellH);
      const tc = bandTypeCount[r], total = Object.values(tc).reduce((s, x) => s + x, 0);
      const kinds = Object.keys(tc).filter((k) => tc[k] > 0);
      byBand.push({ band: r, yRange: `${y0}-${y1}`, depthPct: `${Math.round(100 * (y0 + y1) / 2 / MAP_H)}%`, avgEntities: r1(total / seeds), types: kinds.length, kinds });
    }

    // ── ASCII-СВОДКА ──
    const ramp = (v) => v < 0.02 ? ' ' : v < 0.4 ? '·' : v < 1 ? ':' : v < 2 ? '+' : v < 4 ? '*' : v < 7 ? '#' : '█';
    const L = [];
    L.push(`# WorldStats — ${seeds} сидов · сетка ${rows}×${cols} (ячейка ${r1(cellW)}×${r1(cellH)} тайла) · MAP ${MAP_W}×${MAP_H}`);
    L.push('');
    L.push('## КОЛИЧЕСТВА (test-объекты у базы исключены)');
    L.push('тип        ожид  avg   min  max  σ');
    for (const t of TYPES) { const s = summary.counts[t]; L.push(`${t.padEnd(10)} ${String(s.expect).padStart(4)} ${String(s.avg).padStart(5)} ${String(s.min).padStart(4)} ${String(s.max).padStart(4)} ${s.stdev}`); }
    L.push('');
    L.push('## РАЗНОС (мин-дистанция, 2D по тору)');
    for (const k of ['artifact', 'server', 'hazard']) { const s = summary.spacing[k]; L.push(`${k.padEnd(9)} требуется ≥${s.minReq} · глоб.min ${s.globalMin} · ср.посид.min ${s.avgPerSeedMin} · нарушений ${s.violations}`); }
    L.push('');
    L.push('## ПЛОТНОСТЬ (ближайший сосед, тайлов)');
    L.push(`любой тип: mean ${density.nnAll.mean} · median ${density.nnAll.median} · min ${density.nnAll.min}`);
    for (const t of TYPES) if (density.byType[t]) L.push(`  ${t.padEnd(9)} mean ${density.byType[t].meanNN} · median ${density.byType[t].medianNN} · min ${density.byType[t].minNN}`);
    L.push('');
    L.push('## ХИТМАП РАЗМЕЩЕНИЯ (строка=глубина ↓, символ∝avg сущностей/ячейку: " "0 ·:+*#█)');
    L.push('     ' + Array.from({ length: cols }, (_, c) => (c % 10)).join(''));
    for (let r = 0; r < rows; r++) { const y0 = Math.round(r * cellH); L.push(`${String(Math.round(100 * y0 / MAP_H)).padStart(3)}% ${avgGrid[r].map(ramp).join('')}  ${r1(avgGrid[r].reduce((s, v) => s + v, 0))}`); }
    if (includeResources) {
      L.push('');
      L.push('## ХИТМАП РЕСУРСОВ (символ∝avg тайлов-ресурса/ячейку: " "0 ·:+*#█ при /10)');
      const rmax = Math.max(1, ...resGrid.flat()) / seeds;
      const rramp = (v) => { const n = v / 10; return n < 0.05 ? ' ' : n < 0.4 ? '·' : n < 1 ? ':' : n < 2 ? '+' : n < 4 ? '*' : n < 7 ? '#' : '█'; };
      L.push('     ' + Array.from({ length: cols }, (_, c) => (c % 10)).join(''));
      for (let r = 0; r < rows; r++) L.push(`${String(Math.round(100 * Math.round(r * cellH) / MAP_H)).padStart(3)}% ${resGrid[r].map((v) => rramp(v / seeds)).join('')}  ${r1(resGrid[r].reduce((s, v) => s + v, 0) / seeds)}`);
    }
    L.push('');
    L.push('## ИНТЕРЕСНОСТЬ ПО БЭНДАМ (разнообразие типов на глубине)');
    for (const b of byBand) L.push(`${b.depthPct.padStart(4)} y${b.yRange.padEnd(9)} ентити/сид ${String(b.avgEntities).padStart(5)} · типов ${b.types} ${b.types ? '[' + b.kinds.join(',') + ']' : '— ПУСТО'}`);
    L.push('');
    const realDead = dead.filter(([r]) => Math.round(r * cellH) > (typeof CAVE_FLOOR_Y !== 'undefined' ? CAVE_FLOOR_Y : 0));   // мёртвые НИЖЕ города (выше — норма: поверхность/воздух)
    L.push(`## АНОМАЛИИ: срывов размещения ${anomalies.length} · мёртвых ячеек ниже города ${realDead.length}/${rows * cols}`);
    if (anomalies.length) L.push('  ' + anomalies.slice(0, 8).join('\n  ') + (anomalies.length > 8 ? `\n  …+${anomalies.length - 8}` : ''));
    if (realDead.length) L.push('  мёртвые (band,col): ' + realDead.slice(0, 20).map((d) => `(${d[0]},${d[1]})`).join(' '));

    const report = L.join('\n');
    return { summary, anomalies, density, heatmap: { avgGrid, dead, hot }, byBand, resources: includeResources ? { resGrid } : null, report };
  }

  function print(opts) { const r = run(opts); return r.error || r.report; }

  window.WorldStats = { run, print, collect, TYPES };
})();
