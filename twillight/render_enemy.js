'use strict';

// Отрисовка врагов: тёмные дроны, у каждого типа СВОЙ силуэт. Копатель — округлый дрон с
// крупным буром и красным глазом (проходчик); собиратель — приземистый «жук-носильщик» с
// открытым кузовом (конкурент за добычу); разведчик — резкий ромб (диверсант).
function drawEnemies(ctx, enemies, camera) {
  if (!enemies) return;
  for (const e of enemies) {
    const cx = Math.round(camera.screenX(e.px)), cy = Math.round(e.py - camera.y);
    const r = (TILE - 12) / 2;
    if (e.friendly && !e.dying) {   // ДРУЖЕСТВЕННЫЙ (разбуженный город) — лазурный ореол-метка; турели игнорируют
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(90,210,180,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 6.283); ctx.stroke();
      ctx.restore();
    }
    if (e.hitT > 0 && !e.dying) {   // удар-флэш: аддитивная вспышка-ореол при получении урона (за силуэтом → светящийся кант)
      const f = e.hitT / HIT_FLASH_TIME;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.55 * f;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r * (1.05 + (1 - f) * 0.6), 0, 6.283); ctx.fill(); ctx.restore();
    }
    if (e.dying) { drawEnemyDeath(ctx, e, cx, cy, r); continue; }   // уничтожен: затухающий обломок + искры
    if (e.type === 'raider') { drawRaider(ctx, e, cx, cy, r); continue; }
    if (e.type === 'collector') { drawCollector(ctx, e, cx, cy, r); continue; }
    if (e.type === 'hunter') { drawHunter(ctx, e, cx, cy, r); continue; }
    if (e.type === 'hacker') { drawHacker(ctx, e, cx, cy, r); continue; }
    if (e.type === 'sniper') { drawSniper(ctx, e, cx, cy, r); continue; }
    if (e.type === 'swarm_midge') { drawMidge(ctx, e, cx, cy, r); continue; }
    if (e.type === 'mender') { drawMender(ctx, e, cx, cy, r); continue; }
    if (e.type === 'siege_mortar') { drawMortar(ctx, e, cx, cy, r); continue; }
    if (e.type === 'siege_ram') { drawSiegeRam(ctx, e, cx, cy, r); continue; }
    if (e.type === 'mine_planter') { drawMinePlanter(ctx, e, cx, cy, r); continue; }
    if (e.type === 'lurker') { drawLurker(ctx, e, cx, cy, r); continue; }
    if (e.type === 'blight_sower') { drawBlightSower(ctx, e, cx, cy, r); continue; }
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

// Мошкара — рой-мелочь: крошечная тёмная блоха с дрожащими крылышками и красной точкой-глазом.
// Намеренно НЕ читается как «дрон» — это гнус, мусор-облако. Дёшев (рисуется много).
function drawMidge(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, ph = e.seed || 0, rr = r * 0.5;
  ctx.fillStyle = '#241a22';
  ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.85, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,110,0.5)'; ctx.lineWidth = 1;
  const w = Math.sin(t * 30 + ph) * rr * 0.6;
  ctx.beginPath(); ctx.moveTo(cx - rr, cy); ctx.lineTo(cx - rr - 2, cy + w); ctx.moveTo(cx + rr, cy); ctx.lineTo(cx + rr + 2, cy - w); ctx.stroke();
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath(); ctx.arc(cx, cy, rr * 0.34, 0, 6.283); ctx.fill();
}

// Латальщик — саппорт-дрон: тёмное тело-капля, ЗЕЛЁНЫЙ дорсальный эмиттер (инструмент = зелёный, как у
// игрока), красный глаз (всё же диких). При активном лечении — мягкий зелёный пульс-ореол (фидбэк).
function drawMender(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, fx = e.dx || ((e.lastDir && e.lastDir.x) || 1);
  const healing = e._healTgt && !e._healTgt.dead && e.target === null;
  if (healing) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 + 0.25 * Math.abs(Math.sin(t * 6));
    ctx.strokeStyle = '#5fd29a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, 6.283); ctx.stroke(); ctx.restore();
  }
  ctx.fillStyle = '#23302a';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.9, r * 0.7, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#3f8f6a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#5fd29a'; ctx.lineWidth = 2;   // эмиттер-крест
  ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.95); ctx.lineTo(cx, cy - r * 0.35); ctx.moveTo(cx - r * 0.28, cy - r * 0.65); ctx.lineTo(cx + r * 0.28, cy - r * 0.65); ctx.stroke();
  ctx.fillStyle = '#d0402f';
  ctx.beginPath(); ctx.arc(cx + fx * r * 0.45, cy, r * 0.22, 0, 6.283); ctx.fill();
}

// Мортира — дальний структуролом: приземистый короб с толстым задранным стволом (по aimAng), дульная
// вспышка на залпе. Силуэт «артиллерия», лиловая чрома (осадная родня тарана). Красный глаз.
function drawMortar(ctx, e, cx, cy, r) {
  const ang = e.aimAng || 0;
  ctx.fillStyle = '#332433';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.95, r * 0.8, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#7a3a6a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.fillStyle = '#4a3550'; ctx.fillRect(r * 0.2, -r * 0.32, r * 0.95, r * 0.64);
  ctx.strokeStyle = '#8a5a9a'; ctx.lineWidth = 1.5; ctx.strokeRect(r * 0.2, -r * 0.32, r * 0.95, r * 0.64);
  if (e.firing > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,160,90,0.8)'; ctx.beginPath(); ctx.arc(r * 1.2, 0, r * 0.32, 0, 6.283); ctx.fill(); ctx.restore(); }
  ctx.restore();
  ctx.fillStyle = e.firing > 0 ? '#ff9a4a' : '#d0402f';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.24, 0, 6.283); ctx.fill();
}

// Таран — наземный структуролом-мили: бронекорпус-клин с серой таран-плитой спереди, ориентирован по
// рывку/ходу. Телеграф замаха (пульс-кольцо) и след-разгон — как у охотника, но массивнее. Красный глаз.
function drawSiegeRam(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000;
  let ax, ay;
  if (e.cstate === 'charge' || e.cstate === 'recover') { ax = e.cvx; ay = e.cvy; } else { ax = e.dx; ay = e.dy; }
  if (!ax && !ay) ax = 1;
  const ang = Math.atan2(ay, ax), charging = e.cstate === 'charge';
  if (e.cstate === 'wind') { const f = Math.min(1, (e.cT || 0) / RAM_WIND);
    ctx.save(); ctx.globalAlpha = 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(t * 22)));
    ctx.strokeStyle = '#ff7a3a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.7 - 0.7 * f), 0, 6.283); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  if (charging) { ctx.strokeStyle = 'rgba(255,120,60,0.3)'; ctx.lineWidth = 2;
    for (const o of [-0.4, 0.4]) { ctx.beginPath(); ctx.moveTo(-r * 1.1, o * r); ctx.lineTo(-r * 2.4, o * r); ctx.stroke(); } }
  ctx.fillStyle = '#352a2a';
  ctx.beginPath(); ctx.moveTo(r * 1.15, 0); ctx.lineTo(-r * 0.7, -r * 0.85); ctx.lineTo(-r * 0.9, 0); ctx.lineTo(-r * 0.7, r * 0.85); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9a5a3a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#7a8088';   // таран-плита
  ctx.beginPath(); ctx.moveTo(r * 1.15, -r * 0.5); ctx.lineTo(r * 1.5, 0); ctx.lineTo(r * 1.15, r * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = charging ? '#ff6a4a' : '#d0402f';
  ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * r * 0.2, cy + Math.sin(ang) * r * 0.2, r * 0.26, 0, 6.283); ctx.fill();
}

// Закладка — копатель-смертник: тёмный корпус с буром (роет к базе) + круглый ЗАРЯД на спине. В режиме
// «armed» (зарыт у базы) — заряд мигает красным при приближении юнита (телеграф взрыва, как у мины).
function drawMinePlanter(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, dx = e.dx || 1, dy = e.dy;
  ctx.fillStyle = '#2c2a22';
  ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.9, r * 0.72, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#7a6a30'; ctx.lineWidth = 2; ctx.stroke();
  if (e.mpState !== 'armed') {   // в пути — малый бур по ходу
    const bx = cx + dx * r * 0.95, by = cy + dy * r * 0.5;
    ctx.fillStyle = '#9098a0';
    ctx.beginPath(); ctx.moveTo(bx + dx * r * 0.3, by + dy * r * 0.3); ctx.lineTo(bx + dy * r * 0.25, by - dx * r * 0.25); ctx.lineTo(bx - dy * r * 0.25, by + dx * r * 0.25); ctx.closePath(); ctx.fill();
  }
  // заряд на спине — круг с чекой
  ctx.fillStyle = '#3a2018';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.55, r * 0.42, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#b06030'; ctx.lineWidth = 1.5; ctx.stroke();
  // огонёк: спокойный тускло-красный; при «armed» рядом с юнитом (mpT>0) — учащённое мигание
  const armedBlink = e.mpState === 'armed' && (e.mpT || 0) > 0;
  const lit = armedBlink ? (Math.sin(t * 30) > 0 ? 1 : 0.15) : 0.5 + 0.3 * Math.sin(t * 3);
  ctx.save(); if (armedBlink) ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = lit; ctx.fillStyle = armedBlink ? '#ff5030' : '#d0402f';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.55, r * 0.18, 0, 6.283); ctx.fill(); ctx.restore();
}

// Залежень — засадник в породе: низкий горб, почти утопленный (виден только бугор + красный сенсор). Замах —
// сенсор разгорается + пульс-кольцо; выпад (charge) — вытянутый рывок по вектору cv. Силуэт «капкан», не дрон.
function drawLurker(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000;
  const lunging = e.cstate === 'charge' || e.cstate === 'recover';
  let ax = e.cvx, ay = e.cvy; if (!ax && !ay) { ax = e.dx || 1; ay = e.dy; }
  const ang = Math.atan2(ay, ax);
  if (e.lurkState === 'wind') {   // телеграф замаха
    const f = Math.min(1, (e.lurkT || 0) / LURKER_WIND);
    ctx.save(); ctx.globalAlpha = 0.5 * (0.4 + 0.6 * Math.abs(Math.sin(t * 28)));
    ctx.strokeStyle = '#ff6a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * (1.5 - 0.6 * f), 0, 6.283); ctx.stroke(); ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.fillStyle = '#27201c';
  if (lunging) { ctx.beginPath(); ctx.moveTo(r * 1.0, 0); ctx.lineTo(-r * 0.8, -r * 0.55); ctx.lineTo(-r * 0.8, r * 0.55); ctx.closePath(); ctx.fill(); }   // вытянутый рывок
  else { ctx.beginPath(); ctx.ellipse(0, r * 0.25, r * 0.95, r * 0.5, 0, Math.PI, 2 * Math.PI); ctx.fill(); }   // низкий горб (низ срезан — утоплен)
  ctx.strokeStyle = '#6a4a3a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  // красный сенсор (ярче в замахе/выпаде)
  const hot = e.lurkState === 'wind' || lunging;
  ctx.fillStyle = hot ? '#ff6a4a' : '#a83a2f';
  ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * r * 0.3, cy + Math.sin(ang) * r * 0.1, r * 0.22, 0, 6.283); ctx.fill();
}

// Скверносей — наземный краулер-сеятель: низкий сегментный корпус на ножках + ДОРСАЛЬНЫЙ ЭМИТТЕР
// (лиловый «улей»-сопло), сочащийся скверной. Красный глаз (диких). Лиловая чрома роднит с маяками.
function drawBlightSower(ctx, e, cx, cy, r) {
  const t = performance.now() / 1000, ph = e.seed || 0, fx = e.dx || ((e.lastDir && e.lastDir.x) || 1);
  const moving = e.state2 === MOVING;
  ctx.strokeStyle = '#4a3a52'; ctx.lineWidth = 2;   // ножки семенят
  for (let i = 0; i < 4; i++) { const lx = cx + (i - 1.5) * r * 0.5, sw = moving ? Math.sin(t * 14 + ph + i * 2) * 2 : 0; ctx.beginPath(); ctx.moveTo(lx, cy + r * 0.3); ctx.lineTo(lx + sw, cy + r * 0.8); ctx.stroke(); }
  ctx.fillStyle = '#2c2433';   // сегментный корпус
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.1, r * 1.0, r * 0.5, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = '#7a4a8a'; ctx.lineWidth = 2; ctx.stroke();
  // дорсальный эмиттер — сопло-улей, сочится
  ctx.fillStyle = '#3a2a44';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy - r * 0.2); ctx.lineTo(cx + r * 0.4, cy - r * 0.2); ctx.lineTo(cx + r * 0.22, cy - r * 0.95); ctx.lineTo(cx - r * 0.22, cy - r * 0.95); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9a6aae'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + 0.3 * Math.abs(Math.sin(t * 4 + ph));   // сочение скверны
  ctx.fillStyle = '#b07ad0'; ctx.beginPath(); ctx.arc(cx, cy - r * 0.95, r * 0.2, 0, 6.283); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#d0402f';   // красный глаз
  ctx.beginPath(); ctx.arc(cx + fx * r * 0.55, cy + r * 0.05, r * 0.16, 0, 6.283); ctx.fill();
}

// Маяки скверны (game.blightBeacons) — стационарные сущности с HP, поднимают помехи (≤50%) в радиусе. Рисуются
// в мире (под туманом): тёмный кол-эмиттер + пульсирующее лиловое кольцо-помеха + узкая HP-полоса (мигает при ударе).
// Вызывается из game.draw отдельно от drawEnemies (это не враг-дрон, а объект). ⚠️ перф: 'lighter', без filter/shadowBlur.
function drawBlightBeacons(ctx, beacons, camera) {
  if (!beacons || !beacons.length) return;
  const t = performance.now() / 1000;
  for (const b of beacons) {
    const cx = Math.round(camera.screenX(b.px)), cy = Math.round(b.py - camera.y);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';   // кольцо-помеха (радиус влияния, дышит)
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    ctx.globalAlpha = 0.12 + 0.1 * pulse; ctx.strokeStyle = '#b07ad0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, BLIGHT_BEACON_R * TILE * (0.5 + 0.06 * pulse), 0, 6.283); ctx.stroke();
    ctx.restore();
    // кол-эмиттер
    ctx.fillStyle = b.hit > 0 ? '#5a3a6a' : '#2c2030';
    ctx.fillRect(cx - 3, cy - 8, 6, 16);
    ctx.strokeStyle = '#9a6aae'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 3, cy - 8, 6, 16);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(t * 5));
    ctx.fillStyle = '#c08ae0'; ctx.beginPath(); ctx.arc(cx, cy - 8, 3, 0, 6.283); ctx.fill(); ctx.restore();
    // HP-полоса (если бит)
    if (b.hp < b.maxHp) { const w = 16, h = 2.5, x = cx - w / 2, y = cy - 16; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h); ctx.fillStyle = b.hit > 0 ? '#ff6a4a' : '#b07ad0'; ctx.fillRect(x, y, w * Math.max(0, b.hp / b.maxHp), h); }
  }
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
