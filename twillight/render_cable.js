'use strict';

// ЭНЕРГОШЛЕЙФ (print_cable / print_batt) — рендер ФИЗИЧЕСКОГО трейлинг-кабеля (логика — cable.js).
// Кабель идёт по тайлам ПУТИ юнита (game.cable.path), ПОДВЕШЕН шестами к ближайшей породе (потолок → свисает чуть
// ниже него, не лежит на полу; иначе слегка приподнят), бежит искрами к юниту. Длина кончилась (c.exhausted) →
// конец замирает на ПОСЛЕДНЕМ шесте, к юниту не тянется. print_batt — короткий локальный тетер до батареи.
// ПОВЕРХ тумана (лайфлайн). Перф spec_render.md: без ctx.filter/shadowBlur/офскринов; 'lighter' только на искрах.

function drawCable(ctx, game, camera) {
  const c = game && game.cable; if (!c || !game.unit || !c.path || !c.path.length) return;
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
    if (best.dy < 0) { const cb = (st.y + 1) * TILE; return { x: cx, y: cb + TILE * 0.42, kx: cx, ky: cb, has: true }; }   // ПОТОЛОК → свисаем ниже него
    if (best.dy > 0) { const ft = st.y * TILE;       return { x: cx, y: ft - TILE * 0.32, kx: cx, ky: ft, has: true }; }   // ПОЛ → держим чуть выше
    const wx = (best.dx < 0 ? st.x + 1 : st.x) * TILE; return { x: cx, y: cy, kx: wx, ky: cy, has: true };                  // СТЕНА → пришпилен сбоку
  }

  // экранные точки подвеса по пути
  const pts = new Array(n);
  for (let i = 0; i < n; i++) { const h = hang(path[i]); pts[i] = { x: sx(h.x), y: sy(h.y), kx: sx(h.kx), ky: sy(h.ky), has: h.has }; }

  // изгибы пути → точки-ШЕСТЫ (корень, изгибы, каждый 3-й на прямой, конец). Кабель ВИСИТ МЕЖДУ шестами (фестоном), а не пришпилен к каждому тайлу.
  const dir = (i, j) => { const t = path[i], p = path[j]; return (Math.sign(t.x - p.x) + 2) * 8 + (Math.sign(t.y - p.y) + 2); };
  const isBend = (i) => i > 0 && i < n - 1 && dir(i, i - 1) !== dir(i + 1, i);
  const pin = [];
  for (let i = 0; i < n; i++) if (i === 0 || i === n - 1 || isBend(i) || i % 3 === 0) pin.push(i);

  // полилиния кабеля: точки-шесты + (если не исчерпан) живой конец в юните
  const line = pin.map((i) => ({ x: pts[i].x, y: pts[i].y }));
  if (!c.exhausted) line.push({ x: ucx, y: ucy });

  // грубая отсечка: всё за экраном
  const vw = camera.viewW || 4000; let minx = 1e9, maxx = -1e9;
  for (const p of line) { if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; }
  if (maxx < -TILE * 2 || minx > vw + TILE * 2) return;

  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // ПРОВИС между шестами — контрольная точка опущена ВНИЗ на величину ∝ ГОРИЗОНТАЛИ пролёта (вертикаль → 0: кабель в шахте прямой)
  const sag = (a, b) => Math.min(20, Math.abs(b.x - a.x) * 0.22);
  const trace = (w, style) => {
    ctx.strokeStyle = style; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) { const a = line[i - 1], b = line[i]; ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag(a, b), b.x, b.y); }
    ctx.stroke();
  };
  trace(3, 'rgba(110,72,28,0.55)');                                                  // тёмная оплётка
  trace(1.4, c.exhausted ? 'rgba(160,128,86,0.7)' : 'rgba(255,196,110,0.9)');        // жила (тускнеет, если питание прервано)

  // ── ШЕСТЫ (на пинах, где рядом порода) ──
  for (const i of pin) {
    const p = pts[i]; if (!p.has) continue;
    const end = (i === n - 1), root = (i === 0);
    ctx.strokeStyle = 'rgba(135,96,46,0.9)'; ctx.lineWidth = end ? 2.6 : 1.9;        // шест от породы к кабелю
    ctx.beginPath(); ctx.moveTo(p.kx, p.ky); ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.fillStyle = 'rgba(95,68,34,0.95)';                                            // основание шеста в породе
    ctx.beginPath(); ctx.arc(p.kx, p.ky, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = end ? 'rgba(255,170,90,0.95)' : 'rgba(210,150,80,0.9)';          // узел-крепление кабеля к шесту
    ctx.beginPath(); ctx.arc(p.x, p.y, end ? 3 : 2, 0, Math.PI * 2); ctx.fill();
    if (root) { ctx.fillStyle = 'rgba(120,86,40,0.9)'; ctx.fillRect(p.kx - 4, p.ky - 3, 8, 6); }   // розетка у базы
  }
  if (c.exhausted) { const e = pts[n - 1]; ctx.strokeStyle = 'rgba(160,128,86,0.6)'; ctx.lineWidth = 1.4;   // оборванный конец свисает
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + 3, e.y + 7); ctx.stroke(); }

  // ── бегущие энерго-искры (по дуге фестона) ──
  if (!c.exhausted) {
    let tot = 0; const cum = [0];
    for (let i = 1; i < line.length; i++) { tot += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y); cum.push(tot); }
    if (tot > 1) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,224,150,0.9)';
      const t = performance.now() / 1000;
      for (let k = 0; k < 3; k++) {
        const d = ((t * 0.5 + k / 3) % 1) * tot;   // 0=база → tot=юнит
        let i = 1; while (i < cum.length && cum[i] < d) i++;
        const a = line[i - 1], b = line[Math.min(i, line.length - 1)], f = (d - cum[i - 1]) / Math.max(1e-3, cum[i] - cum[i - 1]);
        const bow = 2 * (1 - f) * f * sag(a, b);   // искра едет по дуге провиса, а не по хорде
        ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + bow, 2.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ── print_batt: локальный тетер до батареи (короткий, лазурный) ──
  if (c.batt) {
    const bx = ucx + Math.round(wrapDeltaPx(c.batt.px, U.px)), by = Math.round(c.batt.py - camera.y);
    ctx.strokeStyle = 'rgba(150,220,255,0.8)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ucx, ucy); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = 'rgba(150,220,255,0.85)'; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
