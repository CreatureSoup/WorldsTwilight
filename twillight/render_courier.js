'use strict';

// КУРЬЕР-ДРОН — рендер летящих контейнер-курьеров (game.couriers; логика — courier.js). ПОВЕРХ тумана: дрон идёт
// над тоннелями, игрок видит маршрут в темноте. Бирюзовая капсула-корпус + пара несущих роторов + подвешенный
// контейнер (с грузом) + узкая HP-полоса; мигает при попадании; гибель — разлёт обломков, прибытие — вспышка-сдача.
// ⚠️ перф (spec_render.md): без ctx.filter/shadowBlur/офскринов; 'lighter' только на вспышках.

function drawCouriers(ctx, game, camera) {
  const cs = game.couriers; if (!cs || !cs.length) return;
  const vw = camera.viewW || 4000, col = '#5fd0d8';
  for (const c of cs) {
    const cx = Math.round(camera.screenX(c.px)), cy = Math.round(c.py - camera.y);
    if (cx < -TILE * 2 || cx > vw + TILE * 2) continue;
    if (c.state === 'fly' || c.state === 'return') drawCourierDrone(ctx, c, cx, cy, col, c.state === 'return');   // 'return' — порожний дрон домой на терминал
    else drawCourierEnd(ctx, c, cx, cy, col);
  }
}

function drawCourierDrone(ctx, c, cx, cy, col, empty) {
  const r = TILE * 0.42, bob = Math.sin(c.bob * 9) * 1.5, y = cy + bob;
  const spin = (c.bob * 26) % TAU;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // несущие роторы — две размытые дуги по бокам (вращение)
  ctx.strokeStyle = col; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.5;
  for (const sx of [-1, 1]) {
    const hx = cx + sx * r * 0.95;
    ctx.beginPath(); ctx.arc(hx, y - r * 0.5, r * 0.42, spin, spin + 2.4); ctx.stroke();
    ctx.strokeStyle = '#2a3a3c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, y - r * 0.2); ctx.lineTo(hx, y - r * 0.5); ctx.stroke();   // лучи-балки
    ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  }
  ctx.globalAlpha = 1;
  // корпус-капсула
  const hit = c.hitT > 0;
  ctx.fillStyle = hit ? '#ffd0c0' : '#1c2e30';
  ctx.strokeStyle = hit ? '#fff0e0' : col; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, y, r * 0.9, r * 0.55, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, y, r * 0.2, 0, TAU); ctx.fill();   // ядро-глаз
  // подвешенный контейнер с грузом (бирюзовая коробка под корпусом)
  const bx = cx, by = y + r * 0.85, bw = r * 0.62, bh = r * 0.5;
  ctx.strokeStyle = '#2a3a3c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - bw * 0.5, y + r * 0.3); ctx.lineTo(cx - bw * 0.5, by - bh * 0.5); ctx.moveTo(cx + bw * 0.5, y + r * 0.3); ctx.lineTo(cx + bw * 0.5, by - bh * 0.5); ctx.stroke();   // тросы
  ctx.fillStyle = '#16383a'; ctx.strokeStyle = col; ctx.lineWidth = 1.2;
  ctx.fillRect(bx - bw, by - bh * 0.5, bw * 2, bh); ctx.strokeRect(bx - bw, by - bh * 0.5, bw * 2, bh);
  if (!empty) { ctx.fillStyle = col; ctx.globalAlpha = 0.55; ctx.fillRect(bx - bw + 1, by - bh * 0.5 + 1, bw * 2 - 2, bh - 2); ctx.globalAlpha = 1; }   // порожний дрон (return) — коробка пустая
  // HP-полоса над дроном (если повреждён)
  if (c.hp < c.maxHp) {
    const w = r * 1.6, f = Math.max(0, c.hp / c.maxHp), yb = y - r * 1.15;
    ctx.fillStyle = 'rgba(10,8,6,0.7)'; ctx.fillRect(cx - w / 2 - 1, yb - 1, w + 2, 3.5);
    ctx.fillStyle = f > 0.3 ? col : '#c0402f'; ctx.fillRect(cx - w / 2, yb, w * f, 1.8);
  }
  ctx.restore();
}

// Конец маршрута — прибытие (вспышка-сдача, бирюза) или гибель (разлёт обломков, тревожно-красный).
function drawCourierEnd(ctx, c, cx, cy, col) {
  const p = 1 - Math.max(0, c.deathT) / COURIER_DRONE_TTL, r = TILE * 0.42;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (c.state === 'arrived' || c.state === 'docked') {   // сдача у базы / стыковка на терминале — бирюзовая вспышка-кольцо
    ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * (0.4 + p * 1.6), 0, TAU); ctx.stroke();
  } else {
    ctx.globalAlpha = (1 - p) * 0.9; ctx.strokeStyle = '#ff7a4a'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + c.bob, l = r * (0.5 + p * 1.8); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); }
  }
  ctx.restore();
}
