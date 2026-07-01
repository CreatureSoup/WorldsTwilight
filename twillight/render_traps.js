'use strict';

// Рендер ловушек: активные эффекты (буровые маркеры скрыты, как мины — срабатывают на откоп).
//  • КИСЛОТНОЕ ОБЛАКО — химический жёлто-зелёный шиммер нанороботов в радиусе (НЕ лиловый, чтобы не путать со скверной).
//  • СЕЙСМО-ВОЛНА — расходящаяся ЛИНЗА (искажение, не цвет): перерисовка аннулюса кадра увеличенным (рефракция) + яркий фронт.
// ⚠️ перф: без ctx.filter/shadowBlur; линза — ОДИН drawImage по bbox аннулюса (волна кратковременна ~0.75с).
function drawTraps(ctx, game, camera) {
  const t = performance.now() / 1000;
  // ── КИСЛОТНЫЕ НАНОРОБОТЫ ──
  if (game.acidClouds) for (const c of game.acidClouds) {
    const cx = Math.round(camera.screenX((c.cx + 0.5) * TILE)), cy = Math.round((c.cy + 0.5) * TILE - camera.y);
    const r = (c.r || 0) * TILE, fade = c.t > ACID_DUR - 1 ? Math.max(0, ACID_DUR - c.t) : 1, armed = c.t >= ACID_ARM;
    if (r <= 0) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * fade; ctx.strokeStyle = '#b6e84a'; ctx.lineWidth = 2;   // граница облака
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#c8f060';                                                        // рой точек-нанороботов
    const N = armed ? 30 : 16;
    for (let i = 0; i < N; i++) {
      const a = i * 2.39996 + t * (0.5 + (i % 3) * 0.35), rr = r * (0.15 + ((i * 41) % 85) / 100);
      ctx.globalAlpha = (0.25 + 0.4 * Math.abs(Math.sin(t * 3 + i))) * fade;
      ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a + t * 0.7) * rr * 0.92, 2, 2);
    }
    ctx.restore();
  }
  // ── СЕЙСМО-ВОЛНА (линза) ──
  if (game.seismicWaves) for (const w of game.seismicWaves) {
    const f = w.t / SEISMIC_WAVE_T;                              // 0→1
    const cx = camera.screenX((w.cx + 0.5) * TILE), cy = (w.cy + 0.5) * TILE - camera.y;
    const rad = SEISMIC_R * TILE * f, band = TILE * 1.3, cv = ctx.canvas;
    ctx.save();                                                  // линза: клип к аннулюсу фронта, перерисовать кадр увеличенным от центра
    ctx.beginPath(); ctx.arc(cx, cy, rad + band, 0, 6.283); ctx.arc(cx, cy, Math.max(0, rad - band), 0, 6.283, true); ctx.clip();
    const s = 1 + 0.11 * (1 - f);
    ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy);
    const bb = rad + band, x0 = Math.max(0, Math.round(cx - bb)), y0 = Math.max(0, Math.round(cy - bb));
    const ww = Math.min(cv.width - x0, Math.round(bb * 2)), hh = Math.min(cv.height - y0, Math.round(bb * 2));
    if (ww > 0 && hh > 0) ctx.drawImage(cv, x0, y0, ww, hh, x0, y0, ww, hh);   // рефракция: bbox аннулюса самого кадра, масштабом
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 * (1 - f); ctx.strokeStyle = '#e8f0ff'; ctx.lineWidth = 2;   // тонкий яркий фронт
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.283); ctx.stroke(); ctx.restore();
  }
}
