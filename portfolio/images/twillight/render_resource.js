'use strict';

// Единый язык форм ресурсов (общий для жил в породе, дропов и груза в ядре).
// Силуэт читается по типу — как в Dome Keeper, где руда узнаётся по форме:
//   железо   — рвано-квадратные обломки (фермы / остатки машин-киберорганизмов);
//   органика — округлые биологические «клетки»;
//   кристалл — ромбы-самоцветы.
// В породе ресурс — это КЛАСТЕР мелких фигурок (органичное вкрапление), а в виде
// дропа/груза — одна крупная фигура того же силуэта.

function _rh(n) { let h = Math.imul((n ^ 0x9e3779b9) >>> 0, 2654435761); h ^= h >>> 15; return (h >>> 0) / 4294967296; }

function _ironPath(ctx, cx, cy, r, seed) {
  const j = (i) => (_rh(seed * 7 + i) - 0.5) * r * 0.5;
  const v = [[-1, -1], [0, -1.05], [1, -1], [1.05, 0], [1, 1], [0, 1.05], [-1, 1], [-1.05, 0]];
  ctx.beginPath();
  v.forEach(([x, y], i) => { const px = cx + x * r + j(i * 2), py = cy + y * r + j(i * 2 + 1); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
  ctx.closePath();
}
function _organicPath(ctx, cx, cy, r, seed) {
  const N = 9, pts = [];
  for (let i = 0; i < N; i++) { const a = (i / N) * 6.283; const rr = r * (0.72 + _rh(seed * 5 + i) * 0.42); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[N - 1][0]) / 2, (pts[0][1] + pts[N - 1][1]) / 2);
  for (let i = 0; i < N; i++) { const c = pts[i], nx = pts[(i + 1) % N]; ctx.quadraticCurveTo(c[0], c[1], (c[0] + nx[0]) / 2, (c[1] + nx[1]) / 2); }
  ctx.closePath();
}
function _crystalPath(ctx, cx, cy, r, seed) {
  const w = r * 0.62 * (0.9 + _rh(seed) * 0.2);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + w, cy - r * 0.05);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - w, cy - r * 0.05);
  ctx.closePath();
}

// Одна фигура ресурса с заливкой, кромкой и характерной деталью/бликом.
function paintResource(ctx, type, cx, cy, r, seed) {
  const def = RESOURCE_DEFS[type];
  ctx.lineJoin = 'round';
  if (type === 'iron') _ironPath(ctx, cx, cy, r, seed);
  else if (type === 'organic') _organicPath(ctx, cx, cy, r, seed);
  else _crystalPath(ctx, cx, cy, r, seed);
  ctx.fillStyle = def.color; ctx.fill();
  ctx.strokeStyle = def.edge; ctx.lineWidth = Math.max(1, r * 0.16); ctx.stroke();

  if (type === 'iron') {
    ctx.strokeStyle = 'rgba(20,26,32,0.7)'; ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.7, cy); ctx.lineTo(cx + r * 0.7, cy); ctx.stroke();
    ctx.fillStyle = def.edge;
    for (const [sx, sy] of [[-0.55, -0.55], [0.55, 0.55]]) { ctx.beginPath(); ctx.arc(cx + sx * r, cy + sy * r, r * 0.16, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath(); ctx.arc(cx - r * 0.4, cy - r * 0.4, r * 0.16, 0, 6.283); ctx.fill();
  } else if (type === 'organic') {
    ctx.fillStyle = 'rgba(220,255,210,0.32)';
    _organicPath(ctx, cx - r * 0.16, cy - r * 0.16, r * 0.4, seed + 991); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx - r * 0.62, cy - r * 0.05); ctx.lineTo(cx, cy + r * 0.15); ctx.closePath(); ctx.fill();
  }
}

// Кластер вкрапления в породу: несколько мелких фигурок одного силуэта.
function drawResourceCluster(ctx, type, cx, cy, R, seed) {
  const n = type === 'organic' ? 4 : 3;
  const items = [];
  for (let i = 0; i < n; i++) {
    const ang = _rh(seed + i * 3) * 6.283, dist = _rh(seed + i * 7) * R * 0.62;
    const r = R * (0.26 + _rh(seed + i * 5) * 0.2);
    items.push({ ox: Math.cos(ang) * dist, oy: Math.sin(ang) * dist, r, s: seed + i * 131 });
  }
  items.sort((a, b) => a.oy - b.oy); // верхние рисуем позади
  for (const it of items) paintResource(ctx, type, cx + it.ox, cy + it.oy, it.r, it.s);
}
