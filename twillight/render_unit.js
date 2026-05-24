'use strict';

// Рендер юнита-Tachikoma: корпус-капсула, кластер глаз-линз спереди,
// 4 сегментные ноги к опорной породе (клинг), бур по направлению взгляда.
// Все размеры пропорциональны R, поэтому юнит масштабируется вместе с TILE.
function drawTachikoma(ctx, world, unit, camera) {
  const cx = Math.round(camera.screenX(unit.px)), cy = Math.round(unit.py - camera.y);
  const R = (TILE - 8) / 2;
  const dxn = unit.dx, dyn = unit.dy;
  const px = dyn, py = dxn; // перпендикуляр направлению

  // ноги к каждой соседней породе (сегментные)
  ctx.lineCap = 'round';
  const dirs = [[0, 1], [0, -1], [-1, 0], [1, 0]];
  for (const [nx, ny] of dirs) {
    if (!isSolid(world.tileAt(unit.tileX + nx, unit.tileY + ny))) continue;
    const ppx = ny, ppy = nx;
    const footBX = cx + nx * (TILE / 2), footBY = cy + ny * (TILE / 2);
    for (const sgn of [-1, 1]) {
      const hipX = cx + nx * (R - 2) + ppx * sgn * R * 0.42;
      const hipY = cy + ny * (R - 2) + ppy * sgn * R * 0.42;
      const kneeX = (hipX + footBX) / 2 + nx * R * 0.42 + ppx * sgn * R * 0.33;
      const kneeY = (hipY + footBY) / 2 + ny * R * 0.42 + ppy * sgn * R * 0.33;
      const footX = footBX + ppx * sgn * R * 0.58, footY = footBY + ppy * sgn * R * 0.58;
      ctx.strokeStyle = '#243a4a'; ctx.lineWidth = Math.max(3, R * 0.33);
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
      ctx.strokeStyle = '#6fa9c8'; ctx.lineWidth = Math.max(1, R * 0.13);
      ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
      ctx.fillStyle = '#243a4a';
      ctx.beginPath(); ctx.arc(footX, footY, R * 0.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // присед перед прыжком — корпус (и голова/бур) сжимается вниз к опоре; ноги не трогаем
  const squashY = unit.crouchT > 0 ? 0.68 : 1;
  ctx.save();
  if (squashY !== 1) { const baseY = cy + R * 0.6; ctx.translate(cx, baseY); ctx.scale(1, squashY); ctx.translate(-cx, -baseY); }

  // корпус-капсула
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, 2, cx, cy, R * 1.2);
  bodyGrad.addColorStop(0, '#9fdcf2');
  bodyGrad.addColorStop(0.5, '#3f9fc9');
  bodyGrad.addColorStop(1, '#1d5f86');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.86, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#123247'; ctx.lineWidth = Math.max(1.5, R * 0.1); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(cx - R * 0.35, cy - R * 0.42, R * 0.32, R * 0.18, 0, 0, Math.PI * 2); ctx.fill();

  // «голова» с глазами на фронте
  const hx = cx + dxn * R * 0.55, hy = cy + dyn * R * 0.55;
  ctx.fillStyle = '#16384b';
  ctx.beginPath(); ctx.ellipse(hx, hy, R * 0.5, R * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  const eye = (ex, ey, rr, glow) => {
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(ex, ey, rr + R * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#bff4ff'; ctx.beginPath(); ctx.arc(ex, ey, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c6fa0'; ctx.beginPath(); ctx.arc(ex, ey, rr * 0.5, 0, Math.PI * 2); ctx.fill();
  };
  const g = '#5fd0ff';
  eye(hx + dxn * R * 0.17, hy + dyn * R * 0.17, R * 0.27, g);
  eye(hx + px * R * 0.42 - dxn * R * 0.08, hy + py * R * 0.42 - dyn * R * 0.08, R * 0.17, g);
  eye(hx - px * R * 0.42 - dxn * R * 0.08, hy - py * R * 0.42 - dyn * R * 0.08, R * 0.17, g);

  // бур спереди — при копании вибрирует (движение вперёд-назад)
  const digWob = unit.drilling ? Math.sin(performance.now() / 30) * R * 0.16 : 0;
  const fwd = R + 1 + digWob;
  const bx = cx + dxn * fwd, by = cy + dyn * fwd;
  ctx.fillStyle = '#c9d2da';
  ctx.beginPath();
  ctx.moveTo(bx + dxn * R * 0.67, by + dyn * R * 0.67);
  ctx.lineTo(bx + px * R * 0.42, by + py * R * 0.42);
  ctx.lineTo(bx - px * R * 0.42, by - py * R * 0.42);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7f8b96'; ctx.lineWidth = Math.max(1, R * 0.06); ctx.stroke();

  ctx.restore();   // конец сжатия приседа
}
