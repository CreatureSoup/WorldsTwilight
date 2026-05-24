'use strict';

// ============================================================
// Inventory — модульное «ядро»: гекс-сетка, мультигекс-модули
// (тащи — перемести, клик — выбрать, кнопка — повернуть).
// Не влезающие модули падают в зону «Земля». Из активной (связанной
// с реактором) сборки выводятся боевые статы юнита.
// ============================================================

const HEX_SIZE = 30;
const SQRT3 = Math.sqrt(3);
const NODE_R = Math.max(2, HEX_SIZE * 0.14);
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const EDGE_OFFSET = HEX_DIRS.map(([dq, dr]) => ({
  x: HEX_SIZE * SQRT3 * (dq + dr / 2),
  y: HEX_SIZE * 1.5 * dr,
}));

// shape — клетки (axial-смещения). nodes — [индекс_клетки, грань] коннекторы;
// если не задан — все внешние грани (хаб).
// Размерная сетка модулей: 1..8 гексов. size зашит в каждый модуль.
const SIZE_NAMES = ['', 'малый', 'компактный', 'средний', 'крупный', 'большой', 'массивный', 'огромный', 'гигантский'];

// `removable: false` — снять с юнита (отправить на полку «Земля») нельзя.
const MODULE_DEFS = {
  battery: { name: 'Реактор',   glyph: 'Р', color: '#3ad17a', kind: 'source', required: false, removable: false, size: 3,
             shape: [[0, 0], [1, 0], [0, 1]], nodes: [[0, 3], [1, 2], [2, 5]], capacity: 60, regen: 9 },
  drill:   { name: 'Бур',       glyph: 'Б', color: '#ffae42', kind: 'drill', required: false, removable: true, size: 1,
             shape: [[0, 0]], nodes: [[0, 0], [0, 1], [0, 2]], digMult: 1.0, digCost: 5, draw: 0.4 },
  engine:  { name: 'Двигатель', glyph: 'Д', color: '#46c6ff', kind: 'engine', required: true, removable: false, size: 2,
             shape: [[0, 0], [1, 0]], nodes: [[0, 3], [1, 0]], speed: 4, moveCost: 0.5, draw: 0.3 },
  conduit: { name: 'Кабель',    glyph: 'К', color: '#8a93a0', kind: 'wire', required: false, removable: true, size: 1,
             shape: [[0, 0]] },
  casing:  { name: 'Кожух',     glyph: 'Щ', color: '#7fb0c8', kind: 'shield', required: false, removable: true, size: 1,
             shape: [[0, 0]], radResist: 1.2, draw: 0.06 },
};

const cubeFromAxial = (q, r) => ({ x: q, y: -q - r, z: r });
function rotAxial(q, r, times) {
  let c = cubeFromAxial(q, r);
  times = ((times % 6) + 6) % 6;
  for (let i = 0; i < times; i++) c = { x: -c.y, y: -c.z, z: -c.x };
  return { q: c.x, r: c.z };
}
function baseNodes(type) {
  const def = MODULE_DEFS[type];
  if (def.nodes) return def.nodes;
  const set = new Set(def.shape.map(([q, r]) => `${q},${r}`));
  const out = [];
  def.shape.forEach(([q, r], ci) => {
    for (let e = 0; e < 6; e++) {
      const nq = q + HEX_DIRS[e][0], nr = r + HEX_DIRS[e][1];
      if (!set.has(`${nq},${nr}`)) out.push([ci, e]);
    }
  });
  return out;
}
function cellsOf(m) {
  return MODULE_DEFS[m.type].shape.map(([dq, dr]) => {
    const o = rotAxial(dq, dr, m.rot);
    return { q: m.q + o.q, r: m.r + o.r };
  });
}
function nodesAbs(m) {
  const shape = MODULE_DEFS[m.type].shape;
  return baseNodes(m.type).map(([ci, e]) => {
    const o = rotAxial(shape[ci][0], shape[ci][1], m.rot);
    return { q: m.q + o.q, r: m.r + o.r, edge: (e + m.rot) % 6 };
  });
}
function axialToPixel(q, r, ox, oy) {
  return { x: ox + HEX_SIZE * SQRT3 * (q + r / 2), y: oy + HEX_SIZE * 1.5 * r };
}
function hexRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  return { q: rx, r: rz };
}
function pixelToAxial(px, py, ox, oy) {
  const dx = px - ox, dy = py - oy;
  return hexRound((SQRT3 / 3 * dx - 1 / 3 * dy) / HEX_SIZE, (2 / 3 * dy) / HEX_SIZE);
}
function hexPath(ctx, cx, cy, size) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    const x = cx + size * Math.cos(a), y = cy + size * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

class Inventory {
  constructor() {
    this.hull = 'scout';        // корпус задаёт сетку ядра, HP и стойкость к скверне
    const R = HULL_DEFS[this.hull].radius;
    this.cells = [];
    for (let q = -R; q <= R; q++)
      for (let r = -R; r <= R; r++)
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= R) this.cells.push({ q, r });
    this.cellSet = new Set(this.cells.map((c) => `${c.q},${c.r}`));

    this.modules = new Map();   // id -> {id,type,rot,where:'board'|'ground'|'drag',q,r,gxFrac}
    this.nextId = 1;
    this.cargo = [];            // груз: перетаскиваемые объекты ресурса {id,type,res,where,q,r,gxFrac}

    this.pending = null;
    this.drag = null;
    this.confirm = null;        // модалка подтверждения снятия последнего бура/щита
    this.selected = null;
    this.hover = null;
    this.mouse = { x: 0, y: 0 };
    this.layout = null;
    this.onStart = null;
    this.preGame = true;

    this.defaultBuild();
    this.recompute();
  }

  add(type, where, q, r, gxFrac, rot) {
    const m = { id: this.nextId++, type, rot: rot || 0, where, q: q || 0, r: r || 0, gxFrac };
    this.modules.set(m.id, m);
    return m;
  }
  defaultBuild() {
    // Стартовая сборка: всё установлено в ядро (полка пуста).
    this.add('battery', 'board', 0, 0, null, 0);
    this.add('drill', 'board', -1, 0, null, 0);
    this.add('engine', 'board', 1, -1, null, 2);
    this.add('casing', 'board', 0, 2, null, 0);   // подключается к реактору (грань 5 ↔ 2)
  }

  // -------- связность и статы --------
  occMap(excludeId) {
    const map = new Map();
    for (const m of this.modules.values()) {
      if (m.where !== 'board' || m.id === excludeId) continue;
      for (const c of cellsOf(m)) map.set(`${c.q},${c.r}`, m.id);
    }
    return map;
  }
  canPlace(type, rot, q, r, excludeId) {
    const occ = this.occCells(excludeId);   // модули И груз — на занятый гекс не встать
    for (const [dq, dr] of MODULE_DEFS[type].shape) {
      const o = rotAxial(dq, dr, rot);
      const k = `${q + o.q},${r + o.r}`;
      if (!this.cellSet.has(k)) return false;
      if (occ.has(k)) return false;
    }
    return true;
  }

  recompute() {
    const board = [...this.modules.values()].filter((m) => m.where === 'board');
    const occ = this.occMap(null);
    const nodeSig = {}, absNodes = {};
    for (const m of board) {
      const an = nodesAbs(m);
      absNodes[m.id] = an;
      nodeSig[m.id] = new Set(an.map((n) => `${n.q},${n.r}|${n.edge}`));
    }
    const parent = {};
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    board.forEach((m) => (parent[m.id] = m.id));

    const liveSig = new Set(), connPairs = new Set();
    for (const m of board) {
      for (const n of absNodes[m.id]) {
        const nq = n.q + HEX_DIRS[n.edge][0], nr = n.r + HEX_DIRS[n.edge][1];
        const oid = occ.get(`${nq},${nr}`);
        if (!oid || oid === m.id) continue;
        const opp = (n.edge + 3) % 6;
        if (!nodeSig[oid].has(`${nq},${nr}|${opp}`)) continue;
        union(m.id, oid);
        liveSig.add(`${n.q},${n.r}|${n.edge}`);
        liveSig.add(`${nq},${nr}|${opp}`);
        connPairs.add(m.id < oid ? `${m.id}-${oid}` : `${oid}-${m.id}`);
      }
    }
    const compBattery = {};
    for (const m of board) if (m.type === 'battery') compBattery[find(m.id)] = true;
    const active = new Set();
    for (const m of board) if (compBattery[find(m.id)]) active.add(m.id);

    let capacity = 0, regen = 0, draw = 0, digMult = 0, digCost = 5;
    let moveSpeed = 0, moveCost = 0.5, drills = 0, engines = 0, radResist = 0;
    const activeTypes = new Set();
    for (const m of board) {
      if (!active.has(m.id)) continue;
      activeTypes.add(m.type);
      const d = MODULE_DEFS[m.type];
      if (d.kind === 'source') { capacity += d.capacity; regen += d.regen; }
      if (d.kind === 'drill')  { digMult += d.digMult; drills++; draw += d.draw; digCost = d.digCost; }
      if (d.kind === 'engine') { moveSpeed = Math.max(moveSpeed, d.speed); engines++; draw += d.draw; moveCost = d.moveCost; }
      if (d.kind === 'shield') { radResist += d.radResist; draw += d.draw; }
    }
    const required = Object.keys(MODULE_DEFS).filter((t) => MODULE_DEFS[t].required);
    const missing = required.filter((t) => !activeTypes.has(t)).map((t) => MODULE_DEFS[t].name);

    const hull = HULL_DEFS[this.hull];
    this.activeIds = active;
    this.liveSig = liveSig;
    this.connPairs = [...connPairs];
    this.stats = {
      capacity: Math.max(capacity, 10), regen, passiveDraw: draw,
      canDig: drills > 0, digMult: Math.max(digMult, 0.001), digCost,
      canMove: engines > 0, moveSpeed: moveSpeed || 4, moveCost,
      maxHp: hull.hp, radResist,
      activeCount: active.size, totalCount: board.length,
      valid: missing.length === 0, missing,
    };
    return this.stats;
  }
  getStats() { return this.recompute(); }

  // -------- груз (ресурсы-объекты в гексах ядра) --------
  // Груз — перетаскиваемые объекты, как модули: в свободном гексе ядра
  // (where:'board') либо на полке «Земля» (where:'ground', не в ядре). Чем тяжелее
  // сборка — тем меньше места под добычу (скрытый trade-off, GDD §4.5).
  moduleCellCount() {
    let n = 0;
    for (const m of this.modules.values()) if (m.where === 'board') n += MODULE_DEFS[m.type].shape.length;
    return n;
  }
  // Занятые ячейки доски: модули + груз (для коллизий при размещении).
  occCells(excludeId) {
    const s = new Set();
    for (const m of this.modules.values()) if (m.where === 'board' && m.id !== excludeId) for (const c of cellsOf(m)) s.add(`${c.q},${c.r}`);
    for (const cg of this.cargo) if (cg.where === 'board' && cg.id !== excludeId) s.add(`${cg.q},${cg.r}`);
    return s;
  }
  firstFreeCargoCell() {
    const occ = this.occCells(null);
    for (const c of this.cells) if (!occ.has(`${c.q},${c.r}`)) return c;
    return null;
  }
  pieceById(id) { return this.modules.get(id) || this.cargo.find((c) => c.id === id) || null; }

  cargoTotalHexes() { return this.cells.length; }                          // всего гексов в ядре
  cargoCapacity() { return Math.max(0, this.cells.length - this.moduleCellCount()); } // максимум груза
  cargoUsed() { return this.cargo.filter((c) => c.where === 'board').length; }        // груз в ядре
  // Вес для скорости: груз + СЪЁМНЫЕ модули на доске (несъёмный каркас реактор+движок —
  // «бесплатный», его вес заложен в базовую скорость; снимаешь модуль → едешь быстрее).
  boardLoad() {
    let n = this.cargoUsed();
    for (const m of this.modules.values())
      if (m.where === 'board' && MODULE_DEFS[m.type].removable) n += MODULE_DEFS[m.type].shape.length;
    return n;
  }
  cargoFreeHexes() { return Math.max(0, this.cargoCapacity() - this.cargoUsed()); }   // пустые гексы (xx)
  cargoCounts() { const c = {}; for (const cg of this.cargo) if (cg.where === 'board') c[cg.type] = (c[cg.type] || 0) + 1; return c; }
  addCargo(type) {
    const cell = this.firstFreeCargoCell();
    if (!cell) return false;   // нет свободного гекса — первый свободный отсутствует
    this.cargo.push({ id: this.nextId++, type, res: true, where: 'board', q: cell.q, r: cell.r, rot: 0, gxFrac: 0.5 });
    return true;
  }
  // Сдача на базе: весь груз ИЗ ядра уходит (гексы освобождаются); груз на полке остаётся.
  deliverBoardCargo() {
    const types = this.cargo.filter((c) => c.where === 'board').map((c) => c.type);
    this.cargo = this.cargo.filter((c) => c.where !== 'board');
    return types;
  }
  // Сдать ОДНУ единицу груза из ядра (для постепенной сдачи на базе); вернуть её тип или null.
  deliverOneBoardCargo() {
    const i = this.cargo.findIndex((c) => c.where === 'board');
    if (i < 0) return null;
    const t = this.cargo[i].type; this.cargo.splice(i, 1); return t;
  }
  resetCargo() { this.cargo = []; }

  // -------- раскладка --------
  computeLayout(W, H) {
    const bo = { x: W * 0.36, y: H * 0.40 };          // ниже, чтобы верхний гекс не лез под заголовок
    const ground = { x: W * 0.06, y: H * 0.66, w: W * 0.56, h: H * 0.14 };
    ground.cy = ground.y + ground.h / 2;
    const panelX = W - 300, panelW = 286;
    const summary = { x: panelX, y: 92, w: panelW };
    const card = { x: panelX, y: 312, w: panelW };   // под сводкой (10 строк по 18px), не налезает
    const rotateBtn = { x: panelX, y: 470, w: panelW, h: 46 };
    const start = { x: W / 2 - 140, y: H - 70, w: 280, h: 50 };
    const cw = 380, ch = 156, cmx = W / 2 - cw / 2, cmy = H / 2 - ch / 2;
    const confirm = { x: cmx, y: cmy, w: cw, h: ch };
    const confirmYes = { x: cmx + 26, y: cmy + ch - 58, w: 150, h: 42 };
    const confirmNo = { x: cmx + cw - 176, y: cmy + ch - 58, w: 150, h: 42 };
    this.layout = { bo, ground, summary, card, rotateBtn, start, confirm, confirmYes, confirmNo, W, H };
    return this.layout;
  }

  // -------- ввод --------
  inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  groundX(m, g) { return g.x + Math.min(0.95, Math.max(0.05, m.gxFrac)) * g.w; }
  pieceAt(x, y) {
    const L = this.layout; if (!L) return null;
    const a = pixelToAxial(x, y, L.bo.x, L.bo.y);
    if (this.cellSet.has(`${a.q},${a.r}`)) {
      const id = this.occMap(null).get(`${a.q},${a.r}`);
      if (id) return id;
      for (const cg of this.cargo) if (cg.where === 'board' && cg.q === a.q && cg.r === a.r) return cg.id;
    }
    for (const m of this.modules.values()) {
      if (m.where !== 'ground') continue;
      if (Math.hypot(x - this.groundX(m, L.ground), y - L.ground.cy) < HEX_SIZE * 1.9) return m.id;
    }
    for (const cg of this.cargo) {
      if (cg.where !== 'ground') continue;
      if (Math.hypot(x - this.groundX(cg, L.ground), y - L.ground.cy) < HEX_SIZE * 1.9) return cg.id;
    }
    return null;
  }

  pointerDown(x, y) {
    const L = this.layout; if (!L) return;
    if (this.confirm) {                          // модалка выхода перехватывает ввод
      if (this.inRect(x, y, L.confirmYes)) { const cb = this.confirm; this.confirm = null; cb(); }
      else if (this.inRect(x, y, L.confirmNo)) { this.confirm = null; }
      return;
    }
    if (this.selected != null && this.inRect(x, y, L.rotateBtn)) { this.rotateInPlace(this.selected); this.recompute(); return; }
    if (this.inRect(x, y, L.start)) { if (this.stats.valid && this.onStart) this.onStart(); return; }
    const id = this.pieceAt(x, y);
    if (id) { this.pending = { id, sx: x, sy: y }; }
    else { this.selected = null; }
    this.mouse = { x, y };
  }
  pointerMove(x, y) {
    this.mouse = { x, y };
    if (this.pending && !this.drag && Math.hypot(x - this.pending.sx, y - this.pending.sy) > 6) this.beginDrag();
  }
  beginDrag() {
    const m = this.pieceById(this.pending.id);
    const a = pixelToAxial(this.pending.sx, this.pending.sy, this.layout.bo.x, this.layout.bo.y);
    this.drag = { id: m.id, grab: m.where === 'board' ? { q: a.q - m.q, r: a.r - m.r } : { q: 0, r: 0 } };
    this.selected = m.id;
    m.where = 'drag';
    this.recompute();
  }
  pointerUp(x, y) {
    if (this.drag) { this.dropDrag(x, y); this.selected = this.drag.id; }
    else if (this.pending) { this.selected = this.pending.id; }
    this.pending = null; this.drag = null;
    this.recompute();
  }
  countBoard(kind) {
    let n = 0;
    for (const m of this.modules.values()) if (m.where === 'board' && MODULE_DEFS[m.type].kind === kind) n++;
    return n;
  }
  dropDrag(x, y) {
    const m = this.pieceById(this.drag.id);
    const L = this.layout;
    const hov = pixelToAxial(x, y, L.bo.x, L.bo.y);
    const aq = hov.q - this.drag.grab.q, ar = hov.r - this.drag.grab.r;
    const fits = m.res
      ? (this.cellSet.has(`${aq},${ar}`) && !this.occCells(m.id).has(`${aq},${ar}`))   // груз — один гекс
      : (this.cellSet.has(`${hov.q},${hov.r}`) && this.canPlace(m.type, m.rot, aq, ar, m.id));
    if (fits) { m.where = 'board'; m.q = aq; m.r = ar; return; }
    // сброшено мимо ядра. Модули реактора/двигателя снять нельзя — возвращаем на место.
    if (!m.res && !MODULE_DEFS[m.type].removable) { m.where = 'board'; return; }
    // на полку «Земля» (груз и снимаемые модули). Подтверждение — не здесь, а на выходе.
    m.where = 'ground';
    m.gxFrac = Math.min(0.95, Math.max(0.05, (x - L.ground.x) / L.ground.w));
  }
  // На доске нет бура или кожуха → выход требует подтверждения.
  needsExitConfirm() { return this.countBoard('drill') === 0 || this.countBoard('shield') === 0; }
  // Авто-переустановка подобранного модуля: первый свободный гекс, где он подключается
  // к реактору. true — установлен (мутирует сборку), false — места/связи нет.
  tryInstall(type) {
    for (const c of this.cells) {
      for (let rot = 0; rot < 6; rot++) {
        if (!this.canPlace(type, rot, c.q, c.r, null)) continue;
        const m = this.add(type, 'board', c.q, c.r, null, rot);
        this.recompute();
        if (this.activeIds.has(m.id)) return true;
        this.modules.delete(m.id);
      }
    }
    this.recompute();
    return false;
  }
  rotateInPlace(id) {
    const m = this.pieceById(id);
    if (!m || m.res) return;   // у груза нет поворота
    const nr = (m.rot + 1) % 6;
    if (m.where !== 'board') { m.rot = nr; return; }
    if (this.canPlace(m.type, nr, m.q, m.r, m.id)) { m.rot = nr; return; }
    // wall-kick: модуль «уперся» — пробуем сдвинуть в ближайшую валидную позицию
    const kicks = [];
    for (const [dq, dr] of HEX_DIRS) kicks.push([dq, dr]);
    for (const [dq, dr] of HEX_DIRS) kicks.push([dq * 2, dr * 2]);
    for (const [dq, dr] of kicks) {
      if (this.canPlace(m.type, nr, m.q + dq, m.r + dr, m.id)) { m.rot = nr; m.q += dq; m.r += dr; return; }
    }
    // совсем нет места — показываем флэш, чтобы кнопка не казалась «сломанной»
    this.rotateFail = { id, t: performance.now() };
  }
  rotateSelected() { if (this.selected != null) { this.rotateInPlace(this.selected); this.recompute(); } }
  rotateAt(x, y) { const id = this.pieceAt(x, y); if (id) { this.selected = id; this.rotateInPlace(id); this.recompute(); } }

  // -------- рендер --------
  draw(ctx, W, H) {
    const L = this.computeLayout(W, H);
    this.hover = this.drag ? null : this.pieceAt(this.mouse.x, this.mouse.y);

    drawStaticBg(ctx, W, H);
    hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    pulseDot(ctx, W / 2 - 78, 23, 3, PAL.gold);
    ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`; ctx.fillText('// СБОРКА ЯДРА · АКТИВНА', W / 2, 26);
    ctx.fillStyle = PAL.chalk; ctx.font = `700 28px ${FONT_DISPLAY}`;
    ctx.fillText('ЯДРО ЮНИТА', W / 2, 54);
    ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`;
    ctx.fillText('ТАЩИ · ПЕРЕМЕСТИТЬ    КЛИК · ВЫБРАТЬ    R · ПОВОРОТ', W / 2, 74);

    // направляющие круги + крестики-прицелы вокруг доски (как в кодексе)
    let br = 0;
    for (const c of this.cells) { const p = axialToPixel(c.q, c.r, L.bo.x, L.bo.y); br = Math.max(br, Math.hypot(p.x - L.bo.x, p.y - L.bo.y)); }
    br += HEX_SIZE * 0.9;
    ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(168,40,28,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(L.bo.x, L.bo.y, br, 0, 6.283); ctx.stroke();
    ctx.setLineDash([1, 6]); ctx.strokeStyle = 'rgba(212,160,66,0.3)';
    ctx.beginPath(); ctx.arc(L.bo.x, L.bo.y, br + 14, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const cx = L.bo.x + dx * (br + 14), cy = L.bo.y + dy * (br + 14);
      ctx.beginPath(); ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5); ctx.stroke();
    }

    // ячейки доски
    for (const c of this.cells) {
      const p = axialToPixel(c.q, c.r, L.bo.x, L.bo.y);
      hexPath(ctx, p.x, p.y, HEX_SIZE * 0.96);
      ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fill();
      ctx.strokeStyle = 'rgba(120,160,200,0.22)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // связи
    for (const pair of this.connPairs) {
      const [a, b] = pair.split('-').map(Number);
      const ca = this.centroid(this.modules.get(a), L.bo), cb = this.centroid(this.modules.get(b), L.bo);
      const live = this.activeIds.has(a) && this.activeIds.has(b);
      ctx.strokeStyle = live ? 'rgba(90,224,138,0.9)' : 'rgba(120,130,140,0.5)';
      ctx.lineWidth = live ? 3 : 2;
      ctx.beginPath(); ctx.moveTo(ca.x, ca.y); ctx.lineTo(cb.x, cb.y); ctx.stroke();
    }
    // модули на доске
    for (const m of this.modules.values())
      if (m.where === 'board') this.drawBoardModule(ctx, m, L.bo, this.activeIds.has(m.id), { selected: this.selected === m.id });

    // груз: объекты-ресурсы в гексах ядра (силуэт по типу), перетаскиваемые как модули
    for (const cg of this.cargo)
      if (cg.where === 'board') {
        const p = axialToPixel(cg.q, cg.r, L.bo.x, L.bo.y);
        this.drawCargoPiece(ctx, p.x, p.y, cg.type, cg.id, this.selected === cg.id);
      }

    // флэш «нет места» при неудачном повороте
    if (this.rotateFail && performance.now() - this.rotateFail.t < 400) {
      const m = this.modules.get(this.rotateFail.id);
      if (m && m.where === 'board') {
        ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3;
        for (const c of cellsOf(m)) { const p = axialToPixel(c.q, c.r, L.bo.x, L.bo.y); hexPath(ctx, p.x, p.y, HEX_SIZE * 1.02); ctx.stroke(); }
        const cen = this.centroid(m, L.bo);
        ctx.fillStyle = PAL.bloodBright; ctx.font = `bold 11px ${FONT_MONO}`; ctx.textAlign = 'center';
        ctx.fillText('НЕТ МЕСТА', cen.x, cen.y - HEX_SIZE * 1.3);
      }
    }

    // земля (полка)
    techPanel(ctx, L.ground.x, L.ground.y, L.ground.w, L.ground.h, { accent: PAL.gold, label: '// ЗЕМЛЯ · НЕ УСТАНОВЛЕНО', serial: 'STK', bolts: false });
    for (const m of this.modules.values()) {
      if (m.where !== 'ground') continue;
      this.drawMini(ctx, this.groundX(m, L.ground), L.ground.cy, m, this.selected === m.id);
    }
    for (const cg of this.cargo) {
      if (cg.where !== 'ground') continue;
      this.drawCargoPiece(ctx, this.groundX(cg, L.ground), L.ground.cy, cg.type, cg.id, this.selected === cg.id);
    }

    this.drawSummary(ctx, L);
    this.drawCard(ctx, L);
    this.drawRotateBtn(ctx, L);
    this.drawStart(ctx, L);

    // призрак перетаскивания
    if (this.drag) {
      const m = this.pieceById(this.drag.id);
      const hov = pixelToAxial(this.mouse.x, this.mouse.y, L.bo.x, L.bo.y);
      const aq = hov.q - this.drag.grab.q, ar = hov.r - this.drag.grab.r;
      if (m.res) {
        const onCell = this.cellSet.has(`${aq},${ar}`);
        const ok = onCell && !this.occCells(m.id).has(`${aq},${ar}`);
        if (onCell) {
          const p = axialToPixel(aq, ar, L.bo.x, L.bo.y);
          ctx.globalAlpha = 0.7; this.drawCargoPiece(ctx, p.x, p.y, m.type, m.id, false, ok ? '#5fe08a' : '#ff5a5a'); ctx.globalAlpha = 1;
        } else {
          this.drawCargoPiece(ctx, this.mouse.x, this.mouse.y, m.type, m.id, false);
        }
      } else {
        const onBoard = this.cellSet.has(`${hov.q},${hov.r}`);
        const ok = onBoard && this.canPlace(m.type, m.rot, aq, ar, m.id);
        if (onBoard) {
          ctx.globalAlpha = 0.7;
          this.drawBoardModule(ctx, { type: m.type, rot: m.rot, q: aq, r: ar }, L.bo, true, { overrideStroke: ok ? '#5fe08a' : '#ff5a5a' });
          ctx.globalAlpha = 1;
        } else {
          this.drawMini(ctx, this.mouse.x, this.mouse.y, m, false);
        }
      }
    }
    if (this.confirm) this.drawConfirm(ctx, L);
    ctx.textAlign = 'left';
  }

  drawConfirm(ctx, L) {
    const noDrill = this.countBoard('drill') === 0, noShield = this.countBoard('shield') === 0;
    const what = noDrill && noShield ? 'БЕЗ БУРА И КОЖУХА' : noDrill ? 'БЕЗ БУРА' : 'БЕЗ КОЖУХА';
    const sub = noDrill ? 'Юнит не сможет копать породу.' : 'Юнит останется без защиты от скверны.';
    const b = L.confirm;
    ctx.fillStyle = 'rgba(7,5,10,0.78)'; ctx.fillRect(0, 0, L.W, L.H);
    techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.blood });
    hazardTape(ctx, b.x + 1, b.y + 1, b.w - 2, 6, PAL.blood);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.bloodBright; ctx.font = `700 18px ${FONT_DISPLAY}`;
    ctx.fillText(`ВЫЙТИ ${what}?`, b.x + b.w / 2, b.y + 44);
    ctx.fillStyle = PAL.bone; ctx.font = `12px ${FONT_BODY}`;
    ctx.fillText(sub, b.x + b.w / 2, b.y + 70);
    const btn = (r, label, danger) => {
      ctx.fillStyle = 'rgba(13,10,14,0.95)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = danger ? PAL.blood : PAL.ash; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = danger ? PAL.bloodBright : PAL.bone; ctx.font = `13px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2); ctx.textBaseline = 'alphabetic';
    };
    btn(L.confirmYes, 'ВЫЙТИ', true); btn(L.confirmNo, 'ОТМЕНА', false);
    ctx.textAlign = 'left';
  }

  centroid(m, bo) {
    const cs = cellsOf(m).map((c) => axialToPixel(c.q, c.r, bo.x, bo.y));
    return { x: cs.reduce((s, p) => s + p.x, 0) / cs.length, y: cs.reduce((s, p) => s + p.y, 0) / cs.length };
  }

  drawBoardModule(ctx, m, bo, active, opts) {
    opts = opts || {};
    const def = MODULE_DEFS[m.type];
    const cells = cellsOf(m);
    const baseAlpha = ctx.globalAlpha;
    for (const c of cells) {
      const p = axialToPixel(c.q, c.r, bo.x, bo.y);
      hexPath(ctx, p.x, p.y, HEX_SIZE * 0.9);
      ctx.globalAlpha = baseAlpha * (active ? 0.92 : 0.5);
      ctx.fillStyle = def.color; ctx.fill();
      ctx.globalAlpha = baseAlpha;
      ctx.lineWidth = 2; ctx.strokeStyle = opts.overrideStroke || (active ? '#eaffff' : 'rgba(255,255,255,0.4)');
      ctx.stroke();
    }
    if (opts.selected) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.strokeStyle = `rgba(255,210,74,${0.55 + 0.45 * pulse})`; ctx.lineWidth = 2.5;
      for (const c of cells) { const p = axialToPixel(c.q, c.r, bo.x, bo.y); hexPath(ctx, p.x, p.y, HEX_SIZE * 1.02); ctx.stroke(); }
    }
    for (const n of nodesAbs(m)) {
      const p = axialToPixel(n.q, n.r, bo.x, bo.y);
      const ex = p.x + EDGE_OFFSET[n.edge].x / 2, ey = p.y + EDGE_OFFSET[n.edge].y / 2;
      const live = this.liveSig && this.liveSig.has(`${n.q},${n.r}|${n.edge}`);
      ctx.beginPath(); ctx.arc(ex, ey, NODE_R, 0, Math.PI * 2);
      ctx.fillStyle = live ? '#5fe08a' : 'rgba(20,25,32,0.85)'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = '#eaffff'; ctx.stroke();
    }
    const cen = this.centroid(m, bo);
    drawModuleIcon(ctx, m.type, cen.x, cen.y, HEX_SIZE * 0.5, '#0d1117');
  }

  drawCargoPiece(ctx, cx, cy, type, seedId, selected, overrideStroke) {
    ctx.globalAlpha = ctx.globalAlpha * 0.22;
    ctx.fillStyle = RESOURCE_DEFS[type].color;
    ctx.beginPath(); ctx.arc(cx, cy, HEX_SIZE * 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = ctx.globalAlpha / 0.22;
    paintResource(ctx, type, cx, cy, HEX_SIZE * 0.5, (seedId * 2654435761) | 0);
    if (overrideStroke) { hexPath(ctx, cx, cy, HEX_SIZE * 0.96); ctx.strokeStyle = overrideStroke; ctx.lineWidth = 2; ctx.stroke(); }
    if (selected) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      hexPath(ctx, cx, cy, HEX_SIZE * 1.02);
      ctx.strokeStyle = `rgba(255,210,74,${0.55 + 0.45 * pulse})`; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }

  drawMini(ctx, cx, cy, m, selected) {
    const def = MODULE_DEFS[m.type];
    const mini = HEX_SIZE * 0.95;
    const cells = MODULE_DEFS[m.type].shape.map(([q, r]) => rotAxial(q, r, m.rot));
    const pts = cells.map((c) => ({ x: mini * SQRT3 * (c.q + c.r / 2), y: mini * 1.5 * c.r }));
    const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length, ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    for (const p of pts) {
      hexPath(ctx, cx + p.x - ax, cy + p.y - ay, mini * 0.9);
      ctx.fillStyle = def.color; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5; ctx.strokeStyle = selected ? '#ffd24a' : '#0d1117'; ctx.stroke();
    }
    drawModuleIcon(ctx, m.type, cx, cy, HEX_SIZE * 0.5, '#0d1117');
  }

  drawSummary(ctx, L) {
    const s = this.stats, x = L.summary.x, y = L.summary.y, w = L.summary.w;
    // скорость с учётом веса (груз + съёмные модули; как у юнита)
    const load = this.boardLoad();
    const eff = s.moveSpeed * Math.max(SPEED_MIN_FRAC, 1 - load * LOAD_PENALTY);
    const speedVal = load > 0 ? `${eff.toFixed(1)} (баз ${s.moveSpeed})` : `${eff.toFixed(1)}`;
    const lines = [
      ['Ёмкость', `${Math.round(s.capacity)}`],
      ['Реген', `+${s.regen.toFixed(1)}/с`],
      ['Расход', `-${s.passiveDraw.toFixed(1)}/с`],
      ['Баланс', `${s.regen - s.passiveDraw >= 0 ? '+' : ''}${(s.regen - s.passiveDraw).toFixed(1)}/с`],
      ['Бур', s.canDig ? 'подключён' : 'НЕТ'],
      ['Двигатель', s.canMove ? 'подключён' : 'НЕТ'],
      ['Скорость', s.canMove ? `${speedVal} тайл/с` : 'НЕТ'],
      ['Прочность', `${s.maxHp} HP`],
      ['Стойкость', `${s.radResist.toFixed(1)} скв.`],
      ['Груз', `${this.cargoUsed()}/${this.cargoCapacity()} гексов`],
    ];
    const LH = 18;   // компактная строка — сводка не залезает на карточку выделенного
    const cyTop = techPanel(ctx, x, y, w, lines.length * LH + 36, { accent: PAL.cobalt, label: '// СБОРКА', serial: 'STATS' });
    ctx.font = `11px ${FONT_MONO}`; ctx.textBaseline = 'top';
    lines.forEach(([k, v], i) => {
      const ly = cyTop + 6 + i * LH;
      ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter; ctx.fillText(k, x + 12, ly);
      ctx.textAlign = 'right'; ctx.fillStyle = v === 'НЕТ' ? PAL.bloodBright : PAL.chalk; ctx.fillText(v, x + w - 12, ly);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  moduleInfo(m) {
    if (m.res) {
      const r = RESOURCE_DEFS[m.type];
      return { name: r.name, color: r.color, lines: [['Тип', 'ресурс'], ['Гексы', '1'], ['Статус', m.where === 'board' ? 'в ядре' : 'на земле']] };
    }
    const d = MODULE_DEFS[m.type], lines = [];
    if (d.kind === 'source') { lines.push(['Ёмкость', `${d.capacity}`], ['Регенерация', `+${d.regen}/с`]); }
    if (d.kind === 'drill') { lines.push(['Скорость бура', `×${d.digMult}`], ['Копание', `${d.digCost}/блок`], ['Потребление', `${d.draw}/с`]); }
    if (d.kind === 'engine') { lines.push(['Скорость', `${d.speed}`], ['Ход', `${d.moveCost}/блок`], ['Потребление', `${d.draw}/с`]); }
    if (d.kind === 'shield') { lines.push(['Стойкость', `${d.radResist} скв.`], ['Потребление', `${d.draw}/с`]); }
    if (d.kind === 'wire') lines.push(['Тип', 'коннектор']);
    lines.push(['Размер', `${SIZE_NAMES[d.size]} (${d.size})`]);
    if (m.where === 'board') lines.push(['Статус', this.activeIds.has(m.id) ? 'подключён' : 'не подключён']);
    else lines.push(['Статус', 'на земле']);
    return { name: d.name, color: d.color, lines };
  }
  drawCard(ctx, L) {
    const id = this.hover != null ? this.hover : this.selected;
    if (id == null) return;
    const m = this.pieceById(id); if (!m) return;
    const info = this.moduleInfo(m);
    const x = L.card.x, y = L.card.y, w = L.card.w, h = info.lines.length * 20 + 40;
    const cyTop = techPanel(ctx, x, y, w, h, { accent: info.color, label: '// ' + info.name.toUpperCase(), serial: m.res ? 'RES' : 'MOD', fingers: true });
    ctx.textBaseline = 'top'; ctx.font = `11px ${FONT_MONO}`;
    info.lines.forEach(([k, v], i) => {
      const ly = cyTop + 6 + i * 20;
      ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter; ctx.fillText(k, x + 12, ly);
      ctx.textAlign = 'right'; ctx.fillStyle = PAL.chalk; ctx.fillText(v, x + w - 12, ly);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  drawRotateBtn(ctx, L) {
    if (this.selected == null) return;
    const sel = this.pieceById(this.selected);
    if (!sel || sel.res) return;   // у груза нет поворота
    const b = L.rotateBtn;
    const hot = this.inRect(this.mouse.x, this.mouse.y, b);
    ctx.fillStyle = hot ? PAL.carbon : 'rgba(13,10,14,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PAL.cobalt; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = PAL.cobalt; ctx.font = `12px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⟳ ПОВЕРНУТЬ · R', b.x + b.w / 2, b.y + b.h / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  drawStart(ctx, L) {
    const valid = this.stats.valid, b = L.start;
    const hot = this.inRect(this.mouse.x, this.mouse.y, b);
    ctx.fillStyle = valid && hot ? PAL.gold : 'rgba(13,10,14,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = valid ? PAL.gold : PAL.ash; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = valid ? (hot ? PAL.void : PAL.gold) : PAL.ash; ctx.font = `14px ${FONT_MONO}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.preGame ? 'В ШАХТУ ▶' : 'ПРОДОЛЖИТЬ ▶', b.x + b.w / 2, b.y + b.h / 2);
    ctx.textBaseline = 'alphabetic';
    if (!valid && this.inRect(this.mouse.x, this.mouse.y, b)) {
      const msg = 'ПОДКЛЮЧИТЕ К РЕАКТОРУ: ' + this.stats.missing.join(', ').toUpperCase();
      ctx.font = `11px ${FONT_MONO}`;
      const tw = ctx.measureText(msg).width + 20, tx = this.mouse.x - tw / 2, ty = b.y - 40;
      ctx.fillStyle = 'rgba(13,10,14,0.95)'; ctx.fillRect(tx, ty, tw, 28);
      ctx.strokeStyle = PAL.bloodBright; ctx.lineWidth = 1; ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 27);
      ctx.fillStyle = PAL.bloodBright; ctx.textBaseline = 'middle'; ctx.fillText(msg, this.mouse.x, ty + 14);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.textAlign = 'left';
  }
}
