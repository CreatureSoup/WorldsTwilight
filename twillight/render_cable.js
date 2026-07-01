'use strict';

// ЭНЕРГОШЛЕЙФ (print_cable / print_batt) — рендер ФИЗИЧЕСКОГО трейлинг-кабеля (логика — cable.js).
// Кабель идёт по тайлам ПУТИ юнита (game.cable.path), ПОДВЕШЕН шестами к ближайшей породе (потолок → свисает чуть
// ниже него, не лежит на полу; иначе слегка приподнят), бежит искрами к юниту. Длина кончилась (c.exhausted) →
// конец замирает на ПОСЛЕДНЕМ шесте, к юниту не тянется. print_batt — короткий локальный тетер до батареи.
// ПОВЕРХ тумана (лайфлайн). Перф spec_render.md: без ctx.filter/shadowBlur/офскринов; 'lighter' только на искрах.

// ⚠️ имя `drawEnergyCable` (НЕ `drawCable`) — `drawCable` занят render_parts.js (провода-мускулы юнита); коллизия глушила их рендер.
function drawEnergyCable(ctx, game, camera) {
  const c = game && game.cable; if (!c || c.state === 'lost' || !game.unit || !c.path || !c.path.length) return;   // 'lost' — троса нет: НЕ рисуем (иначе серая копия «залипает» в мире)
  const U = game.unit, world = game.world, path = c.path, n = path.length;
  const ucx = Math.round(camera.screenX(U.px)), ucy = Math.round(U.py - camera.y);
  const sx = (wx) => ucx + Math.round(wrapDeltaPx(wx, U.px));   // X анкерим к копии юнита (тор-непрерывность)
  const sy = (wy) => Math.round(wy - camera.y);

  // точка подвеса + корень шеста: крепим к БЛИЖАЙШЕЙ породе из 4 сторон (потолок свисает / пол держит чуть выше / стена пришпиливает)
  function hang(t) {
    const cx = (t.x + 0.5) * TILE, cy = (t.y + 0.5) * TILE;
    let best = null;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]])
      for (let k = 1; k <= CABLE_CEIL_SCAN; k++)
        if (isSolid(world.tileAt(t.x + dx * k, t.y + dy * k))) { if (!best || k < best.k) best = { k, dx, dy }; break; }
    if (!best) return { x: cx, y: cy, kx: cx, ky: cy, has: false };   // нет породы рядом (открытый провал) — без шеста
    const st = { x: t.x + best.dx * best.k, y: t.y + best.dy * best.k };   // тайл породы
    // ⚠️ КРОМКА ПОРОДЫ ЭРОДИРОВАНА ВНУТРЬ на ~`TILE*STRUCT_EDGE_INSET` (профиль `_ragDepth`, render_world) — как и для стоп юнита/структур
    // (`dcy` в render_structure). Корень шеста ставим НА ВИДИМУЮ кромку (глубже сетки), иначе шест «плавает» в воздушном зазоре.
    const IN = TILE * STRUCT_EDGE_INSET;
    if (best.dy < 0) { const cb = (st.y + 1) * TILE; return { x: cx, y: cb + TILE * 0.42, kx: cx, ky: cb - IN, has: true }; }   // ПОТОЛОК → корень вверх В породу
    if (best.dy > 0) { const ft = st.y * TILE;       return { x: cx, y: ft - TILE * 0.32, kx: cx, ky: ft + IN, has: true }; }   // ПОЛ → корень вниз В породу
    const wx = (best.dx < 0 ? st.x + 1 : st.x) * TILE; return { x: cx, y: cy, kx: wx + (best.dx < 0 ? -IN : IN), ky: cy, has: true };   // СТЕНА → корень вбок В породу
  }

  // экранные точки подвеса по пути
  const pts = new Array(n);
  for (let i = 0; i < n; i++) { const h = hang(path[i]); pts[i] = { x: sx(h.x), y: sy(h.y), kx: sx(h.kx), ky: sy(h.ky), has: h.has }; }

  // изгибы пути → точки-ШЕСТЫ (корень, изгибы, каждый 3-й на прямой, конец). Кабель ВИСИТ МЕЖДУ шестами (фестоном), а не пришпилен к каждому тайлу.
  const dir = (i, j) => { const t = path[i], p = path[j]; return (Math.sign(t.x - p.x) + 2) * 8 + (Math.sign(t.y - p.y) + 2); };
  const isBend = (i) => i > 0 && i < n - 1 && dir(i, i - 1) !== dir(i + 1, i);
  const pin = [];
  for (let i = 0; i < n; i++) if (i === 0 || i === n - 1 || isBend(i) || i % 3 === 0) pin.push(i);

  const live = c.state === 'live', collapsing = c.state === 'collapsing';
  const grayT = c.grayT || 0, fallT = collapsing ? (c.fallT || 0) : 0;
  const drop = fallT > 0 ? CABLE_FALL_DIST * TILE * fallT * fallT : 0;   // ускоряющееся падение (крах вниз)
  const fade = collapsing ? Math.max(0, 1 - fallT) : 1;                  // растворение при обрушении

  // полилиния кабеля: точки-шесты + (ТОЛЬКО live) живой конец в юните. При обрушении — точки ПАДАЮТ вниз (+джиттер-крах).
  const jit = (i) => 0.62 + 0.5 * (((i * 53 + 11) % 17) / 17);
  const line = pin.map((i) => ({ x: pts[i].x, y: pts[i].y + drop * jit(i) }));
  if (live) line.push({ x: ucx, y: ucy });

  // грубая отсечка: всё за экраном
  const vw = camera.viewW || 4000; let minx = 1e9, maxx = -1e9;
  for (const p of line) { if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; }
  if (maxx < -TILE * 2 || minx > vw + TILE * 2) return;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ПРОВИС: live — лёгкий ∝ горизонтали; ОБЕСТОЧЕН — слабнет, провисает сильнее.
  const sag = (a, b) => Math.min(live ? 20 : 48, Math.abs(b.x - a.x) * (live ? 0.22 : 0.6)) + (live ? 0 : 5);
  // СВИП-СЕРОСТЬ («уход в серое», заполнение): фронт обесточивания идёт от ОТОРВАННОГО КОНЦА (p=1) к КОРНЮ (p=0) по grayT.
  const EDGE = 0.18, AMB = [255, 196, 110], GRY = [126, 130, 138], AMBS = [110, 72, 28], GRYS = [60, 62, 68], LR = (a, b, g) => Math.round(a + (b - a) * g);
  const segGray = (k) => { const p = line.length < 2 ? 1 : k / (line.length - 1), endDist = 1 - p; return Math.max(0, Math.min(1, (grayT * (1 + EDGE) - endDist) / EDGE)); };
  const col = (amb, gry, g, a) => `rgba(${LR(amb[0], gry[0], g)},${LR(amb[1], gry[1], g)},${LR(amb[2], gry[2], g)},${a})`;
  const traceSwept = (w, amb, gry, a0, a1) => {   // a0=янтарная альфа, a1=серая; ×fade при обрушении
    for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i], g = segGray(i);
      ctx.strokeStyle = col(amb, gry, g, (a0 + (a1 - a0) * g) * fade); ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag(a, b), b.x, b.y); ctx.stroke(); }
  };
  traceSwept(3, AMBS, GRYS, 0.55, 0.5);     // тёмная оплётка
  traceSwept(1.4, AMB, GRY, 0.9, 0.55);     // жила: янтарь → серый по свипу

  // ── ШЕСТЫ — пока кабель ВИСИТ (live/dormant). При ОБРУШЕНИИ кабель сорвался с шестов → шесты не рисуем (падает только жила). ──
  if (!collapsing) for (let k = 0; k < pin.length; k++) {
    const i = pin[k], p = pts[i]; if (!p.has) continue;
    const end = (i === n - 1), root = (i === 0), g = segGray(k);
    ctx.strokeStyle = 'rgba(135,96,46,0.9)'; ctx.lineWidth = end ? 2.6 : 1.9;        // шест от породы к кабелю
    ctx.beginPath(); ctx.moveTo(p.kx, p.ky); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = 'rgba(95,68,34,0.95)';                                            // основание шеста в породе
    ctx.beginPath(); ctx.arc(p.kx, p.ky, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col([255, 170, 90], [132, 136, 144], g, end ? 0.95 : 0.9);        // узел-крепление (сереет по свипу)
    ctx.beginPath(); ctx.arc(p.x, p.y, end ? 3 : 2, 0, Math.PI * 2); ctx.fill();
    if (root) { ctx.fillStyle = 'rgba(120,86,40,0.9)'; ctx.fillRect(p.kx - 4, p.ky - 3, 8, 6); }   // розетка у базы
  }
  // DORMANT (с реле): оборванный конец ВИСИТ серым хвостом вниз (ждёт реконнекта). При обрушении хвоста нет — падает вся жила.
  if (c.state === 'dormant') {
    const e = pts[n - 1]; ctx.strokeStyle = col(AMB, GRY, segGray(line.length - 1), 0.55); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.quadraticCurveTo(e.x + 6, e.y + TILE * 0.55, e.x + 1, e.y + TILE * 1.0); ctx.stroke();
    ctx.fillStyle = 'rgba(110,114,122,0.6)'; ctx.beginPath(); ctx.arc(e.x + 1, e.y + TILE * 1.0, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // ── бегущие энерго-искры (по дуге фестона) — ТОЛЬКО пока кабель ЖИВ ──
  if (live) {
    let tot = 0; const cum = [0];
    for (let i = 1; i < line.length; i++) { tot += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y); cum.push(tot); }
    if (tot > 1) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,224,150,0.9)';
      const t = performance.now() / 1000;
      for (let k = 0; k < 3; k++) {
        const d = (1 - ((t * 0.5 + k / 3) % 1)) * tot;   // ток идёт ЮНИТ→БАЗА (реактор питает город): tot=юнит → 0=база
        let i = 1; while (i < cum.length && cum[i] < d) i++;
        const a = line[i - 1], b = line[Math.min(i, line.length - 1)], f = (d - cum[i - 1]) / Math.max(1e-3, cum[i] - cum[i - 1]);
        const bow = 2 * (1 - f) * f * sag(a, b);   // искра едет по дуге провиса, а не по хорде
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + bow, 2.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ── ЯКОРЯ-БАТАРЕИ (print_batt): маркер-крепёж на каждом якоре цепи + короткий линк к батарее (лазурный) ──
  if (c.anchors && c.anchors.length && !collapsing) {
    for (const A of c.anchors) {
      const p = pts[A.idx]; if (!p) continue;
      const bx = ucx + Math.round(wrapDeltaPx(A.batt.px, U.px)), by = Math.round(A.batt.py - camera.y);
      ctx.strokeStyle = `rgba(120,210,235,${0.85 * fade})`; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(p.x, p.y + drop * jit(A.idx)); ctx.lineTo(bx, by); ctx.stroke();   // линк кабель→батарея
      ctx.fillStyle = `rgba(150,225,255,${0.95 * fade})`; ctx.beginPath(); ctx.arc(bx, by, 3.4, 0, Math.PI * 2); ctx.fill();   // узел-якорь на батарее
      ctx.strokeStyle = `rgba(200,240,255,${0.7 * fade})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(bx, by, 5.5, 0, Math.PI * 2); ctx.stroke();   // кольцо крепежа
    }
  }
  // подсветка батареи, доступной для якоря/открепления (юнит в радиусе) — пульс-кольцо
  if (live && game._cableNearBattery && game._cableNearBattery() && game.structures) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 1000 * 5);
    for (const s of game.structures.list) if (s.type === 'battery' && s.state === 'active' && !s.dying && !s.dead) {
      if (Math.hypot(wrapDeltaPx(U.px, s.px), U.py - s.py) / TILE > CABLE_ANCHOR_R) continue;
      const bx = ucx + Math.round(wrapDeltaPx(s.px, U.px)), by = Math.round(s.py - camera.y);
      ctx.strokeStyle = `rgba(150,225,255,${0.4 + 0.4 * pulse})`; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(bx, by, TILE * 0.5, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}
