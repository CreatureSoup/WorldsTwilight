'use strict';

// nav.js — Навигатор «до города»: A* по тайлам по МОДЕЛИ ЛОКОМОЦИИ юнита (unit.js: опора — клинг к соседней породе;
// вне опоры юнит ПАДАЕТ; породу может ПРОКОПАТЬ в любую сторону). Рёбра из стоячего тайла (открытый-с-опорой ИЛИ
// порода — внутри породы юнит держится всегда):
//   • ПОРОДА (сосед ROCK) — ПРОКОП в любую сторону, цена `NAV_STEP_COST + NAV_DIG_WEIGHT×твёрдость` (дорого);
//   • ВВЕРХ по открытому — лаз вдоль стены (сосед открыт И с опорой);
//   • ВНИЗ/ВЛЕВО/ВПРАВО по открытому — шаг на тайл С опорой; либо, если открыт БЕЗ опоры, СРЫВ-падение (`_navFall`)
//     до первого открытого тайла с опорой.
// Путь ПРЕДПОЧИТАЕТ открытые ходы (дёшево) и роет лишь когда открытого маршрута нет (завал камнем / прокоп из пещеры
// под базу) → находит путь ВСЕГДА. 4-связно (без диагоналей), тор по X. Логика без Canvas.
// Перф: буферы аллоцируются 1 раз (метка «поколения» вместо очистки); потолок узлов; раскрываются только стоячие узлы.

const _NAV_N = MAP_W * MAP_H;
const _navG = new Float64Array(_NAV_N);
const _navF = new Float64Array(_NAV_N);
const _navCame = new Int32Array(_NAV_N);
const _navGen = new Int32Array(_NAV_N);    // поколение «открыт» (g/f/came валидны)
const _navDone = new Int32Array(_NAV_N);   // поколение «закрыт»
let _navGenCur = 0;

const _navOpen = (world, x, y) => world.tileAt(x, y).type === AIR;
const _navSupported = (world, x, y) =>     // есть твёрдый сосед → юнит держится клингом (не падает)
  isSolid(world.tileAt(x + 1, y)) || isSolid(world.tileAt(x - 1, y)) ||
  isSolid(world.tileAt(x, y + 1)) || isSolid(world.tileAt(x, y - 1));

// Срыв из открытого БЕЗ опоры тайла (x,y): отвесный спуск до первого открытого тайла С опорой. y приземления или -1.
// Породу встретить нельзя (тайл над твёрдым ИМЕЕТ опору → приземлились бы выше); потолок NAV_FALL_MAX бьёт перф-спайки.
function _navFall(world, x, y) {
  for (let n = 0; y < MAP_H && n < NAV_FALL_MAX; y++, n++) {
    if (!_navOpen(world, x, y)) return -1;       // упёрлись в породу (защитный — недостижимо)
    if (_navSupported(world, x, y)) return y;    // приземлились на уступ/пол
  }
  return -1;                                     // улетел за нижнюю границу / слишком длинный срыв («бездонно»)
}

// ДВА ПРОХОДА: сперва ТОЛЬКО по открытым тайлам (приоритет — открытый маршрут ЛЮБОЙ длины); если открытого пути
// нет (завал / прокоп из пещеры под базу) — второй проход с ПРОКОПОМ. Так открытый ход всегда побеждает прокоп.
function navFindPath(world, sx, sy, tx, ty) {
  return _navAStar(world, sx, sy, tx, ty, false, NAV_H_OPEN) || _navAStar(world, sx, sy, tx, ty, true, NAV_H_DIG);
}

// A* от (sx,sy) к (tx,ty). allowDig — разрешён ли ПРОКОП породы; hWeight — вес эвристики. Массив [x,y] или null.
function _navAStar(world, sx, sy, tx, ty, allowDig, hWeight) {
  sx = wrapX(sx); tx = wrapX(tx);
  if (sy < 0) sy = 0; else if (sy >= MAP_H) sy = MAP_H - 1;
  if (ty < 0) ty = 0; else if (ty >= MAP_H) ty = MAP_H - 1;
  // старт в открытой пустоте без опоры → юнит падает: стартуем с точки приземления (нет приземления → пути нет)
  if (_navOpen(world, sx, sy) && !_navSupported(world, sx, sy)) { const fy = _navFall(world, sx, sy); if (fy < 0) return null; sy = fy; }
  const W = MAP_W, gen = ++_navGenCur, gk = ty * W + tx;
  const heur = (x, y) => { let dx = Math.abs(x - tx); if (dx > W - dx) dx = W - dx; return (dx + Math.abs(y - ty)) * hWeight; };

  const heap = [];                               // бинарная мин-куча по _navF (ключи тайлов); ленивое удаление через _navDone
  const less = (a, b) => _navF[a] < _navF[b];
  const push = (k) => { heap.push(k); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (less(heap[i], heap[p])) { const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } else break; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; const n = heap.length; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < n && less(heap[l], heap[m])) m = l; if (r < n && less(heap[r], heap[m])) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; };

  let ck = 0, cg = 0;                            // текущий узел/стоимость (обновляются в цикле; relax их читает)
  const relax = (nx, ny, addCost) => {
    const nk = ny * W + nx;
    if (_navDone[nk] === gen) return;
    const ng = cg + addCost;
    if (_navGen[nk] !== gen || ng < _navG[nk]) { _navG[nk] = ng; _navF[nk] = ng + heur(nx, ny); _navCame[nk] = ck; _navGen[nk] = gen; push(nk); }
  };

  const sk = sy * W + sx;
  _navG[sk] = 0; _navF[sk] = heur(sx, sy); _navCame[sk] = -1; _navGen[sk] = gen; push(sk);
  let expanded = 0;
  while (heap.length) {
    ck = pop();
    if (_navDone[ck] === gen) continue;
    _navDone[ck] = gen;
    if (ck === gk) {
      const path = []; let k = ck;
      while (k !== -1) { path.push([k % W, (k / W) | 0]); k = _navCame[k]; }
      return path.reverse();
    }
    if (++expanded > NAV_PATH_BUDGET) return null;
    const cx = ck % W, cy = (ck / W) | 0; cg = _navG[ck];

    // (цель-база достижима ВСЕГДА — юнит там стоит; проверяем ДО типа тайла)
    // ВВЕРХ — прокоп вверх / лаз вдоль стены
    let ny = cy - 1;
    if (ny >= 0) {
      if (ny * W + cx === gk) relax(cx, ny, NAV_STEP_COST);
      else { const t = world.tileAt(cx, ny);
        if (t.type === ROCK) { if (allowDig) relax(cx, ny, NAV_STEP_COST + NAV_DIG_WEIGHT * (t.hardness || 1)); }
        else if (t.type === AIR && _navSupported(world, cx, ny)) relax(cx, ny, NAV_CLIMB_COST); }
    }
    // ВНИЗ — прокоп вниз / шаг на уступ / срыв
    ny = cy + 1;
    if (ny < MAP_H) {
      if (ny * W + cx === gk) relax(cx, ny, NAV_STEP_COST);
      else { const t = world.tileAt(cx, ny);
        if (t.type === ROCK) { if (allowDig) relax(cx, ny, NAV_STEP_COST + NAV_DIG_WEIGHT * (t.hardness || 1)); }
        else if (t.type === AIR) {
          if (_navSupported(world, cx, ny)) relax(cx, ny, NAV_STEP_COST);
          else { const fy = _navFall(world, cx, ny); if (fy >= 0) relax(cx, fy, NAV_STEP_COST + (fy - ny) * NAV_FALL_COST); }
        } }
    }
    // ВЛЕВО/ВПРАВО — прокоп вбок / шаг / шаг-с-уступа в срыв
    for (let s = -1; s <= 1; s += 2) {
      const nx = wrapX(cx + s);
      if (nx === tx && cy === ty) { relax(nx, cy, NAV_STEP_COST); continue; }
      const t = world.tileAt(nx, cy);
      if (t.type === ROCK) { if (allowDig) relax(nx, cy, NAV_STEP_COST + NAV_DIG_WEIGHT * (t.hardness || 1)); continue; }
      if (t.type !== AIR) continue;                                  // BORDER/INDESTRUCT — не прокопать
      if (_navSupported(world, nx, cy)) relax(nx, cy, NAV_STEP_COST);
      else { const fy = _navFall(world, nx, cy); if (fy >= 0) relax(nx, fy, NAV_STEP_COST + (fy - cy) * NAV_FALL_COST); }
    }
  }
  return null;
}
