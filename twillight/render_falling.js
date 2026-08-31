'use strict';

// Рендер нестабильной породы: трещины «между камней» поверх обычной породы (статичные тайлы)
// + летящие валуны (FallingRocks из falling.js). Чистый рендер, логика — falling.js/world.js.

// Ломаная между A и B с перпендикулярным «дрожанием» (концы без сдвига) — основа извилистой трещины.
function _jag(ax, ay, bx, by, n, amp, rnd) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, j = (i === 0 || i === n) ? 0 : (rnd(i) * 2 - 1) * amp;
    pts.push({ x: ax + dx * t + nx * j, y: ay + dy * t + ny * j });
  }
  return pts;
}
// Заливаем трещину как ОБЪЁМНУЮ ленту: ширина по точкам через hw(i,n) (профиль тонко→толсто→тонко).
function _taperPoly(ctx, pts, hw) {
  const n = pts.length; if (n < 2) return;
  const perp = (i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: -dy / l, y: dx / l }; };
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const p = perp(i), o = hw(i, n); const X = pts[i].x + p.x * o, Y = pts[i].y + p.y * o; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
  for (let i = n - 1; i >= 0; i--) { const p = perp(i), o = hw(i, n); ctx.lineTo(pts[i].x - p.x * o, pts[i].y - p.y * o); }
  ctx.closePath(); ctx.fill();
}

// Сеть трещин в тайле: 1-2 главных извилистых трещины (профиль тонко→толсто→тонко) + ветви
// (толсто у основания → в нить к кончику). Детерминированно по координатам; при `shaking` — дрожит/тлеет.
function _crackNet(ctx, hash, x, y, sh, t) {
  const rnd = (i) => { const v = hash(x * 7 + i * 131 + 1, y * 11 + i * 97 + 5); return v < 0 ? v + 1 : v; };
  const wMax = sh ? 4.8 : 3.6;
  ctx.fillStyle = sh ? 'rgba(20,12,8,0.92)' : 'rgba(13,8,6,0.62)';
  const mains = 1 + (rnd(0) > 0.55 ? 1 : 0);
  for (let m = 0; m < mains; m++) {
    // СЛУЧАЙНАЯ ориентация: центр у середины тайла + произвольный угол (не только вертикаль)
    const ang = rnd(1 + m * 17) * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang);
    const cxp = (0.3 + rnd(2 + m * 17) * 0.4) * TILE, cyp = (0.3 + rnd(3 + m * 17) * 0.4) * TILE;
    const half = (0.42 + rnd(4 + m * 17) * 0.32) * TILE;
    const pts = _jag(cxp - ca * half, cyp - sa * half, cxp + ca * half, cyp + sa * half, 6, TILE * 0.13, (i) => rnd(5 + m * 17 + i));
    _taperPoly(ctx, pts, (i, n) => wMax * 0.5 * Math.sin(Math.PI * i / (n - 1)) + 0.3);   // тонко на концах, толсто в середине
    const br = 1 + (rnd(9 + m * 17) > 0.5 ? 1 : 0);
    for (let b = 0; b < br; b++) {
      const base = pts[2 + Math.floor(rnd(10 + m * 17 + b) * 3)];                          // крепление в средней части
      const bang = ang + (rnd(13 + m * 17 + b) * 2 - 1) * 1.4, bl = (0.22 + rnd(14 + m * 17 + b) * 0.34) * TILE;   // ветвь под углом к главной
      const ex = base.x + Math.cos(bang) * bl, ey = base.y + Math.sin(bang) * bl;
      const bp = _jag(base.x, base.y, ex, ey, 4, TILE * 0.09, (i) => rnd(40 + b * 11 + i));
      _taperPoly(ctx, bp, (i, n) => (wMax * 0.4) * (1 - i / (n - 1)) + 0.18);              // толсто у основания → нить к кончику
    }
  }
  if (sh) {   // телеграф: тёплое тление вдоль трещины (тоже случайная ориентация)
    ctx.fillStyle = `rgba(220,150,80,${0.16 + 0.14 * (0.5 + 0.5 * Math.sin(t * 17))})`;
    const ang = rnd(60) * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang), half = (0.4 + rnd(61) * 0.28) * TILE;
    const cxp = (0.36 + rnd(62) * 0.28) * TILE, cyp = (0.36 + rnd(63) * 0.28) * TILE;
    const pts = _jag(cxp - ca * half, cyp - sa * half, cxp + ca * half, cyp + sa * half, 6, TILE * 0.12, (i) => rnd(64 + i));
    _taperPoly(ctx, pts, (i, n) => wMax * 0.28 * Math.sin(Math.PI * i / (n - 1)) + 0.15);
  }
}

// Трещины статичной нестабильной породы (поверх кладки/жил, до тумана). Per-tile клип.
function drawUnstableCracks(ctx, world, x0, y0, x1, y1, ox, oy) {
  const t = performance.now() / 1000;
  const hash = (a, b) => world.hash(a, b);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const tile = world.tileAt(x, y);
      if (tile.type !== ROCK || !tile.unstable) continue;
      const sh = !!tile.shaking;
      const jx = sh ? Math.sin(t * 46 + x * 1.7) * 1.3 : 0, jy = sh ? Math.cos(t * 53 + y * 2.1) * 1.3 : 0;   // дрожь
      const sx = x * TILE - ox, sy = y * TILE - oy;
      ctx.save();
      ctx.beginPath(); ctx.rect(sx, sy, TILE, TILE); ctx.clip();   // трещины не выходят за тайл
      ctx.translate(sx + jx, sy + jy);
      _crackNet(ctx, hash, x, y, sh, t);
      ctx.restore();
    }
}

// Большой одиночный КАМЕНЬ на весь тайл (плотная порода / тяжёлый валун). Рисуется в ЛОКАЛЬНОМ
// кадре с центром 0,0; `rnd(i)`→[0,1] детерминирует силуэт/крапины; `sh` — телеграф (тёплый контур).
function _bigRock(ctx, rnd, R, sh) {
  const n = 9, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * TAU; const rr = R * (0.82 + rnd(i) * 0.2); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath();
  const g = ctx.createLinearGradient(0, -R, 0, R);   // объём: свет сверху, тень снизу
  g.addColorStop(0, '#6b5f50'); g.addColorStop(0.5, '#4f463b'); g.addColorStop(1, '#322b24');
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.4;                                   // грани
  ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 0.18); ctx.lineTo(R * 0.1, R * 0.16); ctx.lineTo(R * 0.55, -R * 0.04); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-R * 0.08, R * 0.5); ctx.lineTo(R * 0.05, R * 0.06); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,134,110,0.45)'; ctx.lineWidth = 2;                                // блик
  ctx.beginPath(); ctx.moveTo(-R * 0.55, -R * 0.4); ctx.lineTo(-R * 0.08, -R * 0.62); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';                                                           // крапины
  for (let i = 0; i < 4; i++) { const a = rnd(20 + i) * TAU, rr = rnd(30 + i) * R * 0.6; ctx.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 3, 3); }
  ctx.restore();
  ctx.strokeStyle = sh ? 'rgba(222,150,80,0.7)' : 'rgba(18,13,9,0.6)'; ctx.lineWidth = sh ? 2 : 1.4; ctx.stroke();   // контур (тёплый при дрожи)
}

// Статичные тяжёлые ВАЛУНЫ (большой камень на тайл) поверх кладки, до тумана. При `shaking` — дрожь+тление.
function drawBoulders(ctx, world, x0, y0, x1, y1, ox, oy) {
  const t = performance.now() / 1000;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const tile = world.tileAt(x, y);
      if (tile.type !== ROCK || !tile.boulder) continue;
      const sh = !!tile.shaking;
      const jx = sh ? Math.sin(t * 46 + x * 1.7) * 1.4 : 0, jy = sh ? Math.cos(t * 53 + y * 2.1) * 1.4 : 0;
      const cx = x * TILE - ox + TILE / 2 + jx, cy = y * TILE - oy + TILE / 2 + jy;
      const rnd = (i) => { const v = world.hash(x * 7 + i * 131 + 1, y * 11 + i * 97 + 5); return v < 0 ? v + 1 : v; };
      ctx.save(); ctx.translate(cx, cy);
      if (sh) { const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, TILE * 0.6); const a = 0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 16)); gl.addColorStop(0, `rgba(222,150,80,${a})`); gl.addColorStop(1, 'rgba(222,150,80,0)'); ctx.fillStyle = gl; ctx.fillRect(-TILE * 0.6, -TILE * 0.6, TILE * 1.2, TILE * 1.2); }
      _bigRock(ctx, rnd, TILE * 0.46, sh);
      ctx.restore();
    }
}

// Летящие валуны (каменный блок с трещинами + трейл) и осколки после удара.
function drawFalling(ctx, mgr, camera) {
  if (!mgr) return;
  const t = performance.now() / 1000;
  const hash = (a, b) => (Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1;   // дешёвый хэш для граней
  for (const b of mgr.blocks) {
    const cxp = camera.screenX((b.tx + 0.5) * TILE), sy = b.py - camera.y;
    const sx = cxp - TILE / 2;
    ctx.save();
    ctx.translate(sx, sy);
    // трейл движения (бледный) над валуном
    const tg = ctx.createLinearGradient(0, -TILE * 0.9, 0, 0);
    tg.addColorStop(0, 'rgba(60,52,44,0)'); tg.addColorStop(1, 'rgba(74,66,56,0.35)');
    ctx.fillStyle = tg; ctx.fillRect(3, -TILE * 0.9, TILE - 6, TILE * 0.9);
    if (b.boulder) {                               // тяжёлый валун — большой камень на тайл
      ctx.translate(TILE / 2, TILE / 2);
      const rnd = (i) => { const v = Math.abs(hash(b.tx * 7 + i, (b.tx % 5) + i)); return v - Math.floor(v); };
      _bigRock(ctx, rnd, TILE * 0.46, false);
    } else {                                       // нестабильная — битый блок с трещинами
      ctx.fillStyle = '#4a4138'; ctx.fillRect(1, 1, TILE - 2, TILE - 2);
      ctx.fillStyle = 'rgba(120,104,84,0.30)'; ctx.fillRect(2, 2, TILE - 4, 4);                 // блик сверху
      ctx.fillStyle = 'rgba(0,0,0,0.40)'; ctx.fillRect(2, TILE - 6, TILE - 4, 4);               // тень снизу
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < 3; i++) { const fx = (0.15 + Math.abs(hash(b.tx + i, i * 3)) * 0.6) * TILE, fy = (0.2 + Math.abs(hash(i * 7, b.tx + i)) * 0.5) * TILE; ctx.fillRect(fx, fy, 6, 6); }
      ctx.beginPath(); ctx.rect(0, 0, TILE, TILE); ctx.clip();
      _crackNet(ctx, (a, c) => Math.abs(hash(a, c)), b.tx * 2, Math.floor(b.py / 7), true, t);
    }
    ctx.restore();
  }

  // осколки после удара — мелкие кувыркающиеся камни, тают
  for (const d of mgr.debris) {
    const a = Math.max(0, d.life / d.max);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(camera.screenX(d.x), d.y - camera.y);
    ctx.rotate(d.rot);
    ctx.fillStyle = '#4a4138'; ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(-d.size / 2, d.size / 2 - 1.5, d.size, 1.5);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
