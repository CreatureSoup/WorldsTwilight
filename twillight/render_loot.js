'use strict';

// Две сегментные лапы-грабера тянутся от юнита к ресурсу и утягивают его внутрь.
function drawGrabLegs(ctx, ux, uy, dx, dy) {
  const ang = Math.atan2(dy - uy, dx - ux), perp = ang + Math.PI / 2;
  const bow = Math.min(7, Math.hypot(dx - ux, dy - uy) * 0.3);
  for (const s of [-1, 1]) {
    const kx = (ux + dx) / 2 + Math.cos(perp) * bow * s, ky = (uy + dy) / 2 + Math.sin(perp) * bow * s;
    ctx.strokeStyle = '#243a4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.quadraticCurveTo(kx, ky, dx, dy); ctx.stroke();
    ctx.strokeStyle = '#6fa9c8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.quadraticCurveTo(kx, ky, dx, dy); ctx.stroke();
  }
  ctx.fillStyle = '#243a4a'; ctx.beginPath(); ctx.arc(dx, dy, 2.6, 0, TAU); ctx.fill();
}

// Отрисовка выпавших ресурсов: гранёный самоцвет с мягким свечением; при
// подборе лапы-граберы тянут его в юнит, и он уменьшается в точку.
function drawLoot(ctx, loot, camera) {
  if (!loot) return;
  for (const d of loot.drops) {
    const def = RESOURCE_DEFS[d.type];
    const cx = Math.round(camera.screenX(d.px)), cy = Math.round(d.py - camera.y);
    const scale = d.picked ? Math.max(0, 1 - d.suckT / SUCK_TIME) : 1;
    if (scale <= 0) continue;
    if (d.picked && d.ux !== undefined) drawGrabLegs(ctx, Math.round(camera.screenX(d.ux)), Math.round(d.uy - camera.y), cx, cy);
    const r = TILE * 0.26 * scale;                   // ресурс ~ 1 тайл
    ctx.globalAlpha = 0.22 * scale;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    paintResource(ctx, d.type, cx, cy, r, (d.tileX * 131 + d.tileY * 17) | 0);
  }
}
