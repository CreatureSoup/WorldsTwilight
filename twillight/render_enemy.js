'use strict';

// Отрисовка врагов: тёмные дроны, у каждого типа СВОЙ силуэт. Копатель — округлый дрон с
// крупным буром и красным глазом (проходчик); собиратель — приземистый «жук-носильщик» с
// открытым кузовом (конкурент за добычу); разведчик — резкий ромб (диверсант).
function drawEnemies(ctx, enemies, camera) {
  if (!enemies) return;
  for (const e of enemies) {
    const cx = Math.round(camera.screenX(e.px)), cy = Math.round(e.py - camera.y);
    const r = (TILE - 12) / 2;
    if (e.dying) { drawEnemyDeath(ctx, e, cx, cy, r); continue; }   // уничтожен: затухающий обломок + искры
    if (e.type === 'raider') { drawRaider(ctx, e, cx, cy, r); continue; }
    if (e.type === 'collector') { drawCollector(ctx, e, cx, cy, r); continue; }
    if (e.type === 'hunter') { drawHunter(ctx, e, cx, cy, r); continue; }
    if (e.type === 'hacker') { drawHacker(ctx, e, cx, cy, r); continue; }
    if (e.type === 'sniper') { drawSniper(ctx, e, cx, cy, r); continue; }
    ctx.fillStyle = '#3a2730';
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7a2030'; ctx.lineWidth = 2; ctx.stroke();
    // бур по направлению движения
    const bx = cx + e.dx * (r + 1), by = cy + e.dy * (r + 1);
    ctx.fillStyle = '#9098a0';
    ctx.beginPath();
    ctx.moveTo(bx + e.dx * r * 0.55, by + e.dy * r * 0.55);
    ctx.lineTo(bx + e.dy * r * 0.4, by + e.dx * r * 0.4);
    ctx.lineTo(bx - e.dy * r * 0.4, by - e.dx * r * 0.4);
    ctx.closePath(); ctx.fill();
    // глаз (ярче при бурении)
    ctx.fillStyle = e.drilling ? '#ff6a4a' : '#d0402f';
    ctx.beginPath(); ctx.arc(cx + e.dx * r * 0.35, cy + e.dy * r * 0.35, r * 0.3, 0, 6.283); ctx.fill();
  }
}

// Уничтоженный враг — разовая анимация (deathT): тёмный кренящийся обломок гаснет + разлёт искр
// (обломки-крошка летят через dust, см. ai.updateEnemies). Силуэт типа не нужен — общий «слом».
function drawEnemyDeath(ctx, e, cx, cy, r) {
  const p = 1 - Math.max(0, e.deathT) / ENEMY_DEATH_TIME;   // 0→1
  ctx.save();
  ctx.translate(cx, cy + p * r * 0.6);                       // оседает
  ctx.rotate((e.seed % 1 - 0.5) * p * 1.2);                  // кренится
  ctx.globalAlpha = (1 - p) * 0.85;
  ctx.fillStyle = '#2a2026';
  ctx.beginPath(); ctx.ellipse(0, 0, r * (1 - p * 0.4), r * 0.8 * (1 - p * 0.4), 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#7a2030'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 1.5;   // искры
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + e.seed, l = r * (0.5 + p * 1.6); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
}

// Собиратель — «жук-носильщик», конкурент за добычу (НЕ боец и НЕ проходчик): приземистый
// широкий корпус на семенящих ножках, ОТКРЫТЫЙ КУЗОВ на спине (добыча едет В нём, не парит),
// спереди пара клешней-манипуляторов + МАЛЫЙ бур (копает по необходимости) и два сенсора.
function drawCollector(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, ph = e.seed || 0;
  const dx = e.dx, dy = e.dy, ang = Math.atan2(dy, dx);
  const fx = dx !== 0 ? dx : ((e.lastDir && e.lastDir.x) || 1);   // горизонтальный «фейс» для сенсоров
  // ножки-стерженьки (семенят на ходу)
  const moving = e.state2 === MOVING;
  ctx.strokeStyle = '#46563c'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const lx = cx + (i - 1.5) * r * 0.5;
    const sw = moving ? Math.sin(t * 16 + ph + i * 2.1) * 2 : 0;
    ctx.beginPath(); ctx.moveTo(lx, cy + r * 0.3); ctx.lineTo(lx + sw, cy + r * 0.8); ctx.stroke();
  }
  // корпус — широкий и низкий (жук)
  ctx.fillStyle = '#2f3a30';
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.08, r * 1.02, r * 0.55, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = 2; ctx.stroke();
  // открытый кузов-трапеция на спине; светлый обод = открытый верх
  const bw = r * 0.92, bTop = cy - r * 0.95, bBot = cy - r * 0.24;
  ctx.fillStyle = '#202a22';
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.72, bTop); ctx.lineTo(cx + bw * 0.72, bTop);
  ctx.lineTo(cx + bw, bBot); ctx.lineTo(cx - bw, bBot);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = '#8fae5a';
  ctx.beginPath(); ctx.moveTo(cx - bw * 0.72, bTop); ctx.lineTo(cx + bw * 0.72, bTop); ctx.stroke();
  // добыча — В кузове (сид стабильный, не мерцает при движении)
  if (e.carry) paintResource(ctx, e.carry, cx, bTop + 1, TILE * 0.13, (e.homeX * 7 + e.homeY * 3) | 0);
  // перед: клешни-манипуляторы + малый бур по направлению хода
  const axp = cx + Math.cos(ang) * r * 0.95, ayp = cy + r * 0.08 + Math.sin(ang) * r * 0.5;
  ctx.strokeStyle = '#7a925a'; ctx.lineWidth = 2;
  for (const s of [-0.55, 0.55]) {
    const pa = ang + s;
    ctx.beginPath();
    ctx.moveTo(axp - Math.cos(ang) * r * 0.22, ayp - Math.sin(ang) * r * 0.22);
    ctx.lineTo(axp + Math.cos(pa) * r * 0.4, ayp + Math.sin(pa) * r * 0.4);
    ctx.stroke();
  }
  const wob = e.drilling ? Math.sin(t * 40) * r * 0.05 : 0;       // малый бур «долбит»
  const bx = axp + Math.cos(ang) * (r * 0.26 + wob), by = ayp + Math.sin(ang) * (r * 0.26 + wob);
  ctx.fillStyle = '#9098a0';
  ctx.beginPath();
  ctx.moveTo(bx + Math.cos(ang) * r * 0.32, by + Math.sin(ang) * r * 0.32);
  ctx.lineTo(bx + Math.cos(ang + 2.1) * r * 0.2, by + Math.sin(ang + 2.1) * r * 0.2);
  ctx.lineTo(bx + Math.cos(ang - 2.1) * r * 0.2, by + Math.sin(ang - 2.1) * r * 0.2);
  ctx.closePath(); ctx.fill();
  // два сенсора-глаза (пара мелких, не один крупный как у копателя) — КРАСНЫЕ (общий знак диких)
  ctx.fillStyle = e.drilling ? '#ff6a4a' : '#d0402f';
  ctx.beginPath(); ctx.arc(cx + fx * r * 0.62, cy - r * 0.02, r * 0.13, 0, 6.283); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + fx * r * 0.34, cy + r * 0.06, r * 0.13, 0, 6.283); ctx.fill();
}

// Охотник — летающий хищник-дротик: остриё вперёд, отогнутые крылья, агрессивный глаз. Телеграф перед
// рывком (пульс-кольцо), при разгоне — вытянут + след; ориентация по скорости тарана / направлению хода.
function drawHunter(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000;
  let ax, ay;
  if (e.cstate === 'charge' || e.cstate === 'recover') { ax = e.cvx; ay = e.cvy; } else { ax = e.dx; ay = e.dy; }
  if (!ax && !ay) ax = 1;
  const ang = Math.atan2(ay, ax), charging = e.cstate === 'charge';
  if (e.cstate === 'wind') {                                       // телеграф: сжимающееся пульс-кольцо
    const f = Math.min(1, (e.cT || 0) / HUNTER_WIND);
    ctx.save(); ctx.globalAlpha = 0.55 * (0.4 + 0.6 * Math.abs(Math.sin(t * 26)));
    ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.6 - 0.7 * f), 0, 6.283); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  if (charging) {                                                  // след-разгон (motion lines)
    ctx.strokeStyle = 'rgba(255,120,60,0.32)'; ctx.lineWidth = 2;
    for (const o of [-0.42, 0, 0.42]) { ctx.beginPath(); ctx.moveTo(-r * 1.2, o * r); ctx.lineTo(-r * 2.7, o * r); ctx.stroke(); }
  }
  const stretch = charging ? 1.35 : 1;                            // тело-дротик
  ctx.fillStyle = '#3a1c1a';
  ctx.beginPath();
  ctx.moveTo(r * 1.15 * stretch, 0); ctx.lineTo(-r * 0.5, -r * 0.85); ctx.lineTo(-r * 0.15, 0); ctx.lineTo(-r * 0.5, r * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#e8642a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = charging ? '#ff9a4a' : (e.cstate === 'wind' ? '#ff6a3a' : '#ff4030');   // глаз — КРАСНЫЙ (общий знак диких), ярче при разгоне
  ctx.beginPath(); ctx.arc(r * 0.4, 0, r * 0.3, 0, 6.283); ctx.fill();
  ctx.restore();
}

// Взломщик — кибер-интрудер: угловатый шестиугольник, сканер-глаз, при взломе у базы — вращающиеся
// пульс-щупы (data probes). Токсично-зелёный (цвет диких). Образ: проникающий хакер, не боец/не носильщик.
function drawHacker(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, hacking = e.hacking || e.draining;
  ctx.fillStyle = '#1e2a1c';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + 0.52, px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * 0.92; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7ac83a'; ctx.lineWidth = 2; ctx.stroke();
  if (hacking) {                                                  // взлом: вращающиеся пульс-щупы наружу
    ctx.save(); ctx.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(t * 6)); ctx.strokeStyle = '#c8ff5a'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.5708; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.lineTo(cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55); ctx.stroke(); }
    ctx.restore();
  }
  ctx.fillStyle = hacking ? '#ff6a4a' : '#d0402f';               // сканер-глаз — КРАСНЫЙ (общий знак диких)
  ctx.beginPath(); ctx.arc(cx + (e.dx || 0) * r * 0.2, cy + (e.dy || 0) * r * 0.2, r * 0.28, 0, 6.283); ctx.fill();
}

// Снайпер — летающий стрелок: приземистый ромб-корпус + ДЛИННЫЙ ствол по направлению прицела (на юнита),
// оптика-глаз; при выстреле — вспышка у дула. Образ: держит дистанцию, бьёт издали.
function drawSniper(ctx, e, cx, cy, r) {
  const firing = (e.firing || 0) > 0;
  ctx.fillStyle = '#262c1e';                                      // корпус-ромб
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx + r * 0.78, cy); ctx.lineTo(cx, cy + r * 0.7); ctx.lineTo(cx - r * 0.78, cy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9aae5a'; ctx.lineWidth = 2; ctx.stroke();
  const ang = (e.aimAng !== undefined) ? e.aimAng : Math.atan2(e.dy || 0, e.dx || 1);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = '#7a8a5a'; ctx.lineWidth = 3; ctx.lineCap = 'round';   // ствол-пушка вперёд
  ctx.beginPath(); ctx.moveTo(r * 0.3, 0); ctx.lineTo(r * 1.7, 0); ctx.stroke();
  if (firing) { ctx.fillStyle = '#e8ff7a'; ctx.beginPath(); ctx.arc(r * 1.85, 0, r * 0.42, 0, 6.283); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = firing ? '#ff8a5a' : '#d0402f';                // оптика-глаз — КРАСНЫЙ (общий знак диких)
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.26, 0, 6.283); ctx.fill();
}

// Трассеры выстрелов: короткая линия от прошлой к текущей позиции + яркая головка (токсично-зелёный).
function drawShots(ctx, shots, camera) {
  if (!shots || !shots.list.length) return;
  ctx.save(); ctx.lineCap = 'round';
  for (const s of shots.list) {
    const x2 = camera.screenX(s.px), y2 = s.py - camera.y, x1 = x2 - wrapDeltaPx(s.px, s.ppx), y1 = y2 - (s.py - s.ppy);
    ctx.strokeStyle = 'rgba(200,255,90,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.fillStyle = '#e8ff7a'; ctx.beginPath(); ctx.arc(x2, y2, 2, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

function drawRaider(ctx, e, cx, cy, r) {
  // тело-ромб — резкий быстрый силуэт
  ctx.fillStyle = '#46161c';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.85, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.85, cy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#c83828'; ctx.lineWidth = 2; ctx.stroke();
  // глаз по направлению движения
  ctx.fillStyle = '#ff5038';
  ctx.beginPath(); ctx.arc(cx + e.dx * r * 0.25, cy + e.dy * r * 0.25, r * 0.32, 0, 6.283); ctx.fill();
  // фаза «заполнения» у города: растущее кольцо заряда + пульсация (видно, что копит, не мгновенно)
  if (e.draining) {
    const frac = Math.max(0, Math.min(1, (e.drainT || 0) / RAID_DRAIN_TIME));
    const t = performance.now() / 1000;
    ctx.save();
    ctx.strokeStyle = 'rgba(111,224,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, -Math.PI / 2, -Math.PI / 2 + frac * 6.283); ctx.stroke();
    ctx.shadowColor = '#6fe0ff'; ctx.shadowBlur = 6 + 8 * frac;
    ctx.fillStyle = `rgba(191,244,255,${0.4 + 0.5 * frac})`;
    const rr = r * (0.18 + 0.3 * frac) * (1 + 0.12 * Math.sin(t * 9));
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  // унесённый заряд энергии («ходячая батарейка»)
  if (e.carry) {
    ctx.save();
    ctx.shadowColor = '#6fe0ff'; ctx.shadowBlur = 9;
    ctx.fillStyle = '#bff4ff';
    ctx.beginPath(); ctx.arc(cx, cy - r - 5, r * 0.42, 0, 6.283); ctx.fill();
    ctx.restore();
  }
}
