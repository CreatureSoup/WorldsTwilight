'use strict';

// FX ВЗЛОМА ГОРОДА (render_hack.js): рисует канал взлома game.activeHack ({city, t}). Намеренно ОТЛИЧАЕТСЯ от
// скана (синий гладкий конус) — лиловая «интрузия»: РВАНЫЙ дрожащий тетер от юнита к сердцу города + бегущие
// дата-биты + КОЛЬЦО-ПРОГРЕСС у цели (заполняется к hackT=1) + ядро-вспышка. Поверх мира/юнита, под HUD.
// ⚠️ перф (spec_render): 'lighter', без ctx.filter/shadowBlur; пара мелких радиальных градиентов за кадр — как у скана.

const HACK_HUE = '192,110,230';   // лиловый — акцент ветви МИР (crystal), контраст синему скану

function drawHackFx(ctx, game, camera) {
  const h = game.activeHack; if (!h || !game.unit) return;
  const u = game.unit, p = Math.max(0, Math.min(1, h.t)), t = performance.now() / 1000;
  const sx = camera.screenX(u.px), sy = u.py - camera.y;                       // юнит (исток)
  const tx = camera.screenX(h.hx), ty = h.hy - camera.y;                       // сердце города (на полу каверны)
  const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1, nx = dx / len, ny = dy / len, px = -ny, py = nx;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // ── РВАНЫЙ ТЕТЕР: ломаная с дрожанием поперёк (две прорисовки: тусклая широкая + яркая тонкая) ──
  const segs = 8, jit = Math.min(7, len * 0.06);
  const pt = (i) => {
    const f = i / segs, jx = (i === 0 || i === segs) ? 0 : Math.sin(t * 22 + i * 1.9) * jit * (0.5 + 0.5 * Math.sin(t * 7 + i));
    return [sx + dx * f + px * jx, sy + dy * f + py * jx];
  };
  for (const pass of [0, 1]) {
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) { const [x, y] = pt(i); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.strokeStyle = `rgba(${HACK_HUE},${pass ? 0.85 : 0.28})`;
    ctx.lineWidth = pass ? 1.3 : 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.globalAlpha = pass ? (0.7 + 0.3 * Math.sin(t * 9)) : 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ── ДАТА-БИТЫ: 3 квадрата бегут от юнита к цели (фаза по времени), скорость растёт с прогрессом ──
  for (let k = 0; k < 3; k++) {
    const f = ((t * (0.6 + p * 0.9) + k / 3) % 1);
    const bx = sx + dx * f, by = sy + dy * f, s = 2.2;
    ctx.fillStyle = `rgba(${HACK_HUE},${0.9 * (1 - Math.abs(f - 0.5) * 1.2)})`;
    ctx.fillRect(bx - s, by - s, s * 2, s * 2);
  }

  // ── КОЛЬЦО-ПРОГРЕСС у сердца города ──
  const R = 17;
  ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${HACK_HUE},0.18)`;                       // фоновое кольцо
  ctx.beginPath(); ctx.arc(tx, ty, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = `rgba(${HACK_HUE},0.95)`;                       // дуга прогресса
  ctx.beginPath(); ctx.arc(tx, ty, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke();
  // мерцающий «фронт» взлома на конце дуги
  const fa = -Math.PI / 2 + Math.PI * 2 * p, fx = tx + Math.cos(fa) * R, fy = ty + Math.sin(fa) * R;
  ctx.fillStyle = `rgba(${HACK_HUE},${0.6 + 0.4 * Math.sin(t * 18)})`;
  ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, Math.PI * 2); ctx.fill();

  // ── ЯДРО-ВСПЫШКА у цели (ярче к завершению) ──
  const cr = 6 + 8 * p, g = ctx.createRadialGradient(tx, ty, 0, tx, ty, cr);
  g.addColorStop(0, `rgba(${HACK_HUE},${0.35 + 0.5 * p})`); g.addColorStop(1, `rgba(${HACK_HUE},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, cr, 0, Math.PI * 2); ctx.fill();

  // процент в центре кольца
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(${HACK_HUE},0.95)`; ctx.font = `bold 9px ${typeof FONT_MONO !== 'undefined' ? FONT_MONO : 'monospace'}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(p * 100) + '%', tx, ty);
  ctx.restore();
}

// HUD-таймер ПЕРЕХВАТА РЕАКТОРА (после пробуждения при узле kart_hackcity) — крупная полоса вверху по центру.
function drawWinTimer(ctx, game, W) {
  const wt = game._winTimer; if (!wt) return;
  const p = Math.min(1, wt.t / HACKCITY_WIN_TIME), rem = Math.max(0, HACKCITY_WIN_TIME - wt.t);
  const w = 300, h = 28, x = (W - w) / 2, y = 70, t = performance.now() / 1000;
  ctx.save();
  ctx.fillStyle = 'rgba(13,12,16,0.86)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `rgba(${HACK_HUE},0.9)`; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = `rgba(${HACK_HUE},0.32)`; ctx.fillRect(x + 3, y + 3, (w - 6) * p, h - 6);
  const ex = x + 3 + (w - 6) * p;
  ctx.fillStyle = `rgba(${HACK_HUE},${0.6 + 0.4 * Math.sin(t * 8)})`; ctx.fillRect(ex - 2, y + 3, 3, h - 6);
  ctx.fillStyle = '#e8dcff'; ctx.font = `bold 10px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText('⚡ ПЕРЕХВАТ РЕАКТОРА', x + 10, y + h / 2);
  ctx.textAlign = 'right'; ctx.fillText(Math.ceil(rem) + 'с', x + w - 10, y + h / 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.restore();
}

// КАТ-СЦЕНА ПОБЕДЫ — зеркало интро: ядро (реактор) ИЗВЛЕКАЕТСЯ из сердца города → летит в юнит → вспышка интеграции.
function drawWinCutscene(ctx, game, camera, W, H) {
  const wc = game._winCut; if (!wc || !game.unit) return;
  const u = game.unit, c = wc.city, t = wc.t, ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) * (1 - p));
  const eT = Math.min(1, t / WINCUT_EXTRACT);
  const trT = Math.min(1, Math.max(0, (t - WINCUT_EXTRACT) / WINCUT_TRANSFER));
  const flT = Math.min(1, Math.max(0, (t - WINCUT_EXTRACT - WINCUT_TRANSFER) / WINCUT_FLASH));
  const ux = camera.screenX(u.px), uy = u.py - camera.y;
  const hx = camera.screenX((c.cx + 0.5) * TILE), hy = (c.floorY + 0.5) * TILE - camera.y, rr = 9;
  ctx.save();
  ctx.fillStyle = `rgba(6,4,10,${0.2 + 0.5 * flT})`; ctx.fillRect(0, 0, W, H);

  let ox, oy;
  if (t < WINCUT_EXTRACT) { ox = hx; oy = hy - eT * 10; }
  else if (trT < 1) { const e = ease(trT); ox = hx + (ux - hx) * e; oy = (hy - 10) + (uy - (hy - 10)) * e; }
  else { ox = ux; oy = uy; }

  if (t < WINCUT_EXTRACT + WINCUT_TRANSFER) {           // связка город→ядро
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${HACK_HUE},0.5)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalCompositeOperation = 'lighter';             // аура ядра
  let g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr * 2.4);
  g.addColorStop(0, `rgba(${HACK_HUE},0.6)`); g.addColorStop(1, `rgba(${HACK_HUE},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, rr * 2.4, 0, 6.283); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#f0c24a'; ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 6.283); ctx.fill();   // ядро города (золото)
  ctx.fillStyle = '#2a1c08'; ctx.font = `bold ${Math.round(rr * 1.3)}px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Р', ox, oy + 1);

  if (flT > 0) {                                        // вспышка интеграции у юнита (зелёная, как реактор юнита)
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(120,255,170,${(1 - flT) * 0.9})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(ux, uy, 10 + flT * 70, 0, 6.283); ctx.stroke();
    g = ctx.createRadialGradient(ux, uy, 0, ux, uy, 40 * flT + 8);
    g.addColorStop(0, `rgba(160,255,200,${0.5 * (1 - flT) + 0.2})`); g.addColorStop(1, 'rgba(160,255,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ux, uy, 40 * flT + 8, 0, 6.283); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  const label = t < WINCUT_EXTRACT ? 'ИЗВЛЕЧЕНИЕ РЕАКТОРА' : trT < 1 ? 'ПЕРЕДАЧА ЯДРА' : 'ДИРЕКТИВА ВЫПОЛНЕНА';
  const PALr = (typeof PAL !== 'undefined') ? PAL : {};
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALr.gold || '#d4a042'; ctx.font = `9px ${FONT_MONO}`; ctx.fillText('// ПЕРЕХВАТ КЛАСТЕРА', W / 2, 30);
  ctx.fillStyle = flT > 0 ? '#bfffd6' : (PALr.chalk || '#fff'); ctx.font = `700 24px ${FONT_DISPLAY}`; ctx.fillText(label, W / 2, 56);
  ctx.fillStyle = PALr.pewter || '#9a8e7a'; ctx.font = `9px ${FONT_MONO}`; ctx.fillText('ПРОБЕЛ · ПРОПУСТИТЬ', W / 2, H - 20);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
}
