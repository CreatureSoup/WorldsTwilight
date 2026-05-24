'use strict';

// Внутриигровой HUD: дебаг-инфо, бар энергии (мигает при низком заряде),
// кнопка ядра, строка управления.
function invBtnRect(W) { return { x: W - 130, y: 12, w: 118, h: 30 }; }

// Полоска-индикатор с подписью; pal = [норма, средне, мало], мигает при низком.
function hudBar(ctx, x, y, w, h, frac, label, pal) {
  frac = Math.max(0, Math.min(1, frac));
  const low = frac < 0.25;
  const blink = low && Math.floor(performance.now() / 250) % 2 === 0;
  ctx.fillStyle = '#1c2530'; ctx.fillRect(x, y, w, h);
  if (!(low && !blink)) {
    ctx.fillStyle = low ? pal[2] : (frac < 0.5 ? pal[1] : pal[0]);
    ctx.fillRect(x, y, w * frac, h);
  }
  ctx.strokeStyle = low && blink ? '#ff9a9a' : 'rgba(255,255,255,0.25)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#0d1117'; ctx.font = '11px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 4, y + 2);
}

function drawHUD(ctx, world, unit, inv, dbg, W, H) {
  const stateName = unit.drilling ? 'DIGGING' : ['IDLE', 'MOVING'][unit.state];
  const depth = Math.max(0, unit.tileY - CAVE_FLOOR_Y);
  const lines = [
    `tile: ${unit.tileX}, ${unit.tileY}`,
    `state: ${stateName}`,
    `слой: ${world.layerName(unit.tileY)}  (глубина ${depth})`,
    `скорость: ${unit.effectiveSpeed().toFixed(1)} тайл/с`,
  ];
  const boxW = 250, boxH = 18 * lines.length + 56;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(8, 8, boxW, boxH);
  ctx.font = '13px monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillStyle = '#cfe7ff';
  lines.forEach((l, i) => ctx.fillText(l, 16, 16 + i * 18));

  // бары: HP корпуса и энергия
  const barX = 16, barW = boxW - 16, barH = 14;
  const hpY = 16 + lines.length * 18 + 6, enY = hpY + barH + 6;
  const cap = unit.stats.capacity;
  hudBar(ctx, barX, hpY, barW, barH, unit.hp / unit.stats.maxHp, `HP ${Math.round(unit.hp)}/${unit.stats.maxHp}`, ['#5fe08a', '#ffae42', '#ff5a5a']);
  hudBar(ctx, barX, enY, barW, barH, cap > 0 ? unit.energy / cap : 0, `энергия ${Math.round(unit.energy)}/${Math.round(cap)}`, ['#5fe08a', '#ffd24a', '#ff5a5a']);

  // груз: свободные/всего гексы ядра + разбивка по типам ресурса
  const cargoY = 8 + boxH + 6;
  const free = inv.cargoFreeHexes(), total = inv.cargoTotalHexes();
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(8, cargoY, boxW, 30);
  ctx.font = '12px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = free === 0 ? '#ffb14a' : '#9fb3c8';
  ctx.fillText('Гексы', 16, cargoY + 15);
  ctx.fillStyle = free === 0 ? '#ffd24a' : '#cfe7ff'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`${free}/${total}`, 62, cargoY + 15);
  const counts = inv.cargoCounts();
  let gx = 120;
  for (const key of Object.keys(RESOURCE_DEFS)) {
    const def = RESOURCE_DEFS[key], n = counts[key] || 0;
    ctx.fillStyle = n > 0 ? def.color : 'rgba(120,130,140,0.5)';
    ctx.beginPath(); ctx.arc(gx, cargoY + 15, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = n > 0 ? '#cfe7ff' : 'rgba(150,160,170,0.5)'; ctx.font = '12px monospace';
    ctx.fillText(`${n}`, gx + 9, cargoY + 15);
    gx += 42;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';

  // виджет защиты от скверны (ядро + щит + налетающие частицы)
  if (dbg.radWidget) drawRadWidget(ctx, dbg.radWidget, 8, cargoY + 30 + 6);

  // кнопка ядра/инвентаря
  const ib = invBtnRect(W);
  ctx.fillStyle = 'rgba(20,40,55,0.85)'; ctx.fillRect(ib.x, ib.y, ib.w, ib.h);
  ctx.strokeStyle = '#46c6ff'; ctx.strokeRect(ib.x + 0.5, ib.y + 0.5, ib.w - 1, ib.h - 1);
  ctx.fillStyle = '#cfe7ff'; ctx.font = '13px monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText('⚙ Ядро (I)', ib.x + ib.w / 2, ib.y + ib.h / 2);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';

  // индикатор цикла (макро-таймер) — вверху по центру, под баром города
  if (dbg.cycle) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#9fd0ff';
    ctx.fillText(`ЦИКЛ ${dbg.cycle.n}`, W / 2, 84);
    ctx.font = '11px monospace'; ctx.fillStyle = '#7f93a8';
    ctx.fillText(`след. через ${Math.ceil(dbg.cycle.timeLeft())}с`, W / 2, 104);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }

  // задание от города + репутация — справа, ПОД кнопкой «Ядро»
  if (dbg.quest) {
    const q = dbg.quest, left = Math.max(0, q.deadlineCycle - (dbg.cycle ? dbg.cycle.n : 0));
    const pw = 200, px = W - 12 - pw, py = ib.y + ib.h + 8, rx = W - 18;
    const rows = dbg.questMsg ? 5 : 4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px, py, pw, rows * 16 + 10);
    let qy = py + 6; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#d9c47a'; ctx.fillText('ЗАДАНИЕ', rx, qy); qy += 16;
    ctx.font = '12px monospace'; ctx.fillStyle = '#cfe7ff'; ctx.fillText(q.label(), rx, qy); qy += 16;
    ctx.fillStyle = '#9fb3c8'; ctx.fillText(`осталось циклов: ${left}`, rx, qy); qy += 16;
    ctx.fillText(`репутация: ${dbg.rep || 0}`, rx, qy); qy += 16;
    if (dbg.questMsg) { ctx.font = 'bold 12px monospace'; ctx.fillStyle = dbg.questMsg.ok ? '#7ad05a' : '#e0664a'; ctx.fillText(dbg.questMsg.text, rx, qy); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }

  const hint = 'WASD/стрелки — ход и лазанье   упор в породу = бур   I — ядро   Esc — пауза';
  ctx.font = '13px monospace';
  const hw = ctx.measureText(hint).width + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, H - 28, hw, 22);
  ctx.fillStyle = '#9fb3c8'; ctx.fillText(hint, 16, H - 24);
}
