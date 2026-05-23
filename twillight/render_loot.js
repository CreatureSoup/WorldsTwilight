'use strict';

// Отрисовка выпавших ресурсов: гранёный самоцвет с мягким свечением; при
// всасывании в юнит уменьшается в точку.
function drawLoot(ctx, loot, camera) {
  if (!loot) return;
  for (const d of loot.drops) {
    const def = RESOURCE_DEFS[d.type];
    const cx = Math.round(camera.screenX(d.px)), cy = Math.round(d.py - camera.y);
    const scale = d.picked ? Math.max(0, 1 - d.suckT / SUCK_TIME) : 1;
    if (scale <= 0) continue;
    if (d.module) {                                  // снятый модуль: его форма (гексы+иконка), ∝ размеру
      const mc = MODULE_DEFS[d.type].color;
      ctx.globalAlpha = 0.18 * scale; ctx.fillStyle = mc;
      ctx.beginPath(); ctx.arc(cx, cy, TILE * 0.5 * scale, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
      drawModulePiece(ctx, d.type, cx, cy, TILE * 0.4 * scale);
      continue;
    }

    const r = TILE * 0.26 * scale;                   // ресурс ~ 1 гекс
    ctx.globalAlpha = 0.22 * scale;
    ctx.fillStyle = def.color;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.7, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;

    paintResource(ctx, d.type, cx, cy, r, (d.tileX * 131 + d.tileY * 17) | 0);
  }
}
