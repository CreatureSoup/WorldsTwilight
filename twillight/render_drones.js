'use strict';

// Рендер ДРОНОВ-КОМПАНЬОНОВ (game.drone). Маленький летун: корпус-капсула (тон по типу) + ротор-черта + ядро-глаз +
// несомый груз / канал взлома (hacker). ПОВЕРХ тумана (виден в темноте). Перф: без filter/shadowBlur; 'lighter' точечно.
const DRONE_COL = { collector: '#9ad0a0', courier: '#5fd0e0', battery: '#f0c84a', scout: '#7fb0e0', hacker: '#c06ee6' };

function drawDrones(ctx, game, camera) {
  const d = game.drone; if (!d) return;
  const x = Math.round(camera.screenX(d.px)), y = Math.round(d.py - camera.y);
  const col = DRONE_COL[d.kind] || '#cfe0e0', bob = Math.sin(d.bob * 4) * 1.5;

  if (d.kind === 'hacker' && d.state === 'hack' && d.target) {   // канал взлома — луч к сердцу гнезда + кольцо-прогресс
    const w = d.target, hx = Math.round(camera.screenX((w.cx + 0.5) * TILE)), hy = Math.round((w.floorY + 0.5) * TILE - camera.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(x, y + bob); ctx.lineTo(hx, hy); ctx.stroke();
    const f = Math.min(1, d.t / DRONE_HACK_TIME);
    ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(hx, hy, TILE * 0.6, -Math.PI / 2, -Math.PI / 2 + f * 6.283); ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (d.state === 'dying') ctx.globalAlpha = Math.max(0, 1 - d.t / 0.6);
  ctx.fillStyle = '#10161c'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;                         // корпус-капсула
  ctx.beginPath(); ctx.ellipse(x, y + bob, TILE * 0.36, TILE * 0.26, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = (d.state === 'dying' ? ctx.globalAlpha : 1) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 1.5;   // ротор-черта
  const rw = TILE * 0.4 * Math.cos(d.bob * 16);
  ctx.beginPath(); ctx.moveTo(x - rw, y + bob - TILE * 0.28); ctx.lineTo(x + rw, y + bob - TILE * 0.28); ctx.stroke();
  ctx.globalAlpha = (d.state === 'dying') ? Math.max(0, 1 - d.t / 0.6) : 1;
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y + bob, 2, 0, 6.283); ctx.fill();              // ядро-глаз
  if (d.carry || d.carryMap) { ctx.fillStyle = '#e8dcc0'; ctx.fillRect(x - 2, y + bob + TILE * 0.22, 4, 4); }   // несомый груз
  ctx.restore();

  if (d.fx > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, d.fx * 2); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y + bob, TILE * 0.55 * (1 - d.fx), 0, 6.283); ctx.fill(); ctx.restore(); }
}
