'use strict';

// Виджет ДЕТЕКТОРА ЗАГРЯЗНЕНИЯ (свойство сканера, узел меты `mast_sr`) — «Гейгер-ветер» в кибер-ацтек
// стиле. Линза-СОНЦЕ: лучи-КОРОНА вокруг «разгораются» с интенсивностью загрязнения (без явного бара),
// морось влетает СО СТОРОНЫ источника в ядро-глиф (вспышка на попадании), ВНУТРЕННЯЯ дуга-пеленг (с
// отступом от обода → виден ход) показывает сторону. Состояние/частицы — `RadarCompass` (radar.js).
// Перф: прямой Canvas2D без filter/офскринов.
const RADAR_W = 188, RADAR_H = 56, RADAR_RAYS = 14;

function drawRadarCompass(ctx, w, x, y) {
  techPanel(ctx, x, y, RADAR_W, RADAR_H, { accent: PAL.toxic, label: STR.hud.contam.title, bolts: false, hazardV: PAL.toxic });
  const cx = x + 36, cy = y + 34, R = 13, active = w.signal > 0.03, sig = w.signal;
  const pulse = 0.5 + 0.5 * Math.sin(w.t * 5);

  ctx.fillStyle = 'rgba(10,14,6,0.55)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.fill();   // тёмная линза

  // КОРОНА-СОНЦЕ (кибер-ацтек): лучи alt длинный/короткий «разгораются» с интенсивностью загрязнения
  ctx.lineCap = 'round';
  for (let i = 0; i < RADAR_RAYS; i++) {
    const a = -Math.PI / 2 + (i + 0.5) * (6.283 / RADAR_RAYS), long = (i % 2) === 0;   // +0.5: ни один луч не бьёт прямо в шапку
    const len = (long ? 4 : 2.4) * (0.45 + 0.55 * sig) * (0.92 + 0.08 * pulse);
    const r0 = R + 1.5, r1 = r0 + len;
    ctx.globalAlpha = active ? (0.22 + 0.72 * sig) * (long ? 1 : 0.7) : 0.3;
    ctx.strokeStyle = active ? (sig > 0.6 ? PAL.toxicBright : PAL.toxic) : PAL.bronze;
    ctx.lineWidth = long ? 1.7 : 1.1;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';

  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R - 1, 0, 6.283); ctx.clip();   // содержимое — внутри линзы
  if (active) {
    for (const p of w.parts) {                          // морось летит со стороны источника в ядро
      const px = cx + p.x * R, py = cy + p.y * R, lx = px - p.vx * R * 0.07, ly = py - p.vy * R * 0.07;
      ctx.globalAlpha = Math.min(1, p.life * 2) * (0.4 + 0.45 * Math.min(1.2, Math.hypot(p.x, p.y)));
      ctx.strokeStyle = PAL.toxicBright; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(px, py); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(122,112,94,0.55)';            // нет сигнала — фоновая «снежная» рябь
    for (let i = 0; i < 4; i++) {
      const tw = Math.sin(w.t * (5 + i) + i * 2.3); if (tw < 0.3) continue;
      const ang = i * 1.7 + w.t * 0.2, rr = (0.3 + 0.6 * ((i * 0.37) % 1)) * R;
      ctx.globalAlpha = (tw - 0.3) * 0.9;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1.1, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (active) {                                          // ВНУТРЕННЯЯ дуга-пеленг (отступ R−4 от обода → виден ход)
    const spread = 0.4 + 0.8 * (1 - sig);
    ctx.globalAlpha = 0.55 + 0.4 * sig; ctx.strokeStyle = PAL.toxicBright; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R - 4, w.dir - spread, w.dir + spread); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  ctx.strokeStyle = active ? PAL.toxic : PAL.bronze; ctx.lineWidth = 1.4;   // обод
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();

  // ЯДРО-ГЛИФ (мини-сонце): ромб, разгорается с сигналом + вспышка при попадании частицы
  const cs = 2.4 + (active ? 1.5 * sig : 0) + (w.flash || 0) * 2;
  ctx.globalAlpha = active ? 0.55 + 0.45 * pulse : 0.6;
  ctx.fillStyle = !active ? PAL.ash : (w.flash > 0.3 ? PAL.toxicBright : PAL.toxic);
  ctx.beginPath(); ctx.moveTo(cx, cy - cs); ctx.lineTo(cx + cs, cy); ctx.lineTo(cx, cy + cs); ctx.lineTo(cx - cs, cy); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;

  // статус справа (БЕЗ бара — интенсивность читается короной/ядром)
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `9px ${FONT_MONO}`;
  if (active) { ctx.fillStyle = PAL.toxic; ctx.fillText(STR.hud.contam.inZone, x + 60, cy); }
  else { ctx.fillStyle = PAL.ash; ctx.fillText(STR.hud.contam.scanBg, x + 60, cy); }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}
