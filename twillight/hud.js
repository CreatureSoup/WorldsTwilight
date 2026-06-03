'use strict';

// Внутриигровой HUD по дизайн-системе (design/ · кодекс): техно-рамки TechPanel
// (рамка + уголки + болты + шапка label/serial + опц. PCB-пальцы), акцент по смыслу,
// пульс-LED индикаторы. Шрифты Tektur/JetBrains Mono/Plex, палитра PAL.
function blinkA() { return 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 320)); }
function pulseDot(ctx, x, y, r, color) { ctx.save(); ctx.globalAlpha = blinkA(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.restore(); }

// Болт-голова (шестигранник с прорезью) — в углах техно-панелей.
function boltHead(ctx, cx, cy, s, color) {
  const p = [[-0.30, -0.43], [0.30, -0.43], [0.50, 0], [0.30, 0.43], [-0.30, 0.43], [-0.50, 0]];
  ctx.fillStyle = PAL.earth; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx + p[0][0] * s, cy + p[0][1] * s);
  for (let i = 1; i < 6; i++) ctx.lineTo(cx + p[i][0] * s, cy + p[i][1] * s);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 0.2 * s, cy - 0.2 * s); ctx.lineTo(cx + 0.2 * s, cy + 0.2 * s); ctx.stroke();
}
// PCB-«пальцы» (ряд контактных площадок) — под панелью.
function edgeFingers(ctx, x, y, w, count, color) {
  const gap = 2, fw = (w - gap * (count - 1)) / count;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) ctx.fillRect(x + i * (fw + gap), y, fw, 3);
}
// Hazard-лента (диагональные полоски). Горизонтальная и вертикальная.
function hazardTape(ctx, x, y, w, h, color) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.lineWidth = h * 1.5; ctx.strokeStyle = color;
  for (let i = -h; i < w + h; i += 22) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
  ctx.restore();
}
function hazardTapeV(ctx, x, y, w, h, color) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.lineWidth = w * 1.5; ctx.strokeStyle = color;
  for (let i = -w; i < h + w; i += 18) { ctx.beginPath(); ctx.moveTo(x + w, y + i); ctx.lineTo(x, y + i + w); ctx.stroke(); }
  ctx.restore();
}
// Серийный «штамп» — мелкая моно-метка в коробочке (earth + рамка). align: 'left'|'right'.
function serialChip(ctx, x, y, text, color, align) {
  ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'top';
  const tw = ctx.measureText(text).width, pad = 5, w = tw + pad * 2, h = 13;
  const bx = align === 'right' ? x - w : x;
  ctx.fillStyle = PAL.earth; ctx.fillRect(bx, y, w, h);
  ctx.strokeStyle = color === PAL.gold ? PAL.goldDim : color; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(text, bx + pad, y + 3);
}

// Техно-панель: фон + рамка (bronze для gold-акцента, иначе акцент) + уголки-скобки +
// болты по углам + шапка (label слева / serial-штамп справа) + опц. PCB-пальцы / hazard.
// Возвращает Y начала контента (под шапкой).
function techPanel(ctx, x, y, w, h, o) {
  o = o || {}; const accent = o.accent || PAL.gold;
  ctx.fillStyle = 'rgba(13,10,14,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent === PAL.gold ? PAL.bronze : accent; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  const s = 9; ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(x + 0.5, y + s); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x + s, y + 0.5);
  ctx.moveTo(x + w - s, y + 0.5); ctx.lineTo(x + w - 0.5, y + 0.5); ctx.lineTo(x + w - 0.5, y + s);
  ctx.moveTo(x + 0.5, y + h - s); ctx.lineTo(x + 0.5, y + h - 0.5); ctx.lineTo(x + s, y + h - 0.5);
  ctx.moveTo(x + w - s, y + h - 0.5); ctx.lineTo(x + w - 0.5, y + h - 0.5); ctx.lineTo(x + w - 0.5, y + h - s);
  ctx.stroke();
  if (o.bolts !== false) { const b = 4.5, bs = 4.5; boltHead(ctx, x + b, y + b, bs, accent); boltHead(ctx, x + w - b, y + b, bs, accent); boltHead(ctx, x + b, y + h - b, bs, accent); boltHead(ctx, x + w - b, y + h - b, bs, accent); }
  if (o.hazardV) hazardTapeV(ctx, x + 2, y + 8, 4, h - 16, o.hazardV);
  let cy = y + 9;
  if (o.label || o.serial) {
    if (o.label) { ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = accent; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.label, x + 11, cy); }
    if (o.serial) serialChip(ctx, x + w - 9, cy - 2, o.serial, accent, 'right');
    cy += 15;
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 9, cy - 3.5); ctx.lineTo(x + w - 9, cy - 3.5); ctx.stroke();
  }
  if (o.fingers) edgeFingers(ctx, x + 10, y + h - 7, w - 20, 14, accent);
  return cy;
}

const BAR_PAL = { hp: ['#5a1a14', PAL.bloodBright], data: ['#1f3a48', PAL.cobalt], gold: ['#4a3618', PAL.gold] };
// Шкала: моно-подпись слева + значение справа над треком; цвет-кодная заливка; мигает при <25%.
function hudBar(ctx, x, y, w, h, frac, label, value, kind) {
  frac = Math.max(0, Math.min(1, frac));
  const [dim, bright] = BAR_PAL[kind] || ['#3a302a', PAL.bone];
  ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left'; ctx.fillStyle = PAL.pewter; ctx.fillText(label, x, y - 3);
  ctx.textAlign = 'right'; ctx.fillStyle = bright; ctx.fillText(value, x + w, y - 3);
  ctx.textAlign = 'left';
  ctx.fillStyle = PAL.earth; ctx.fillRect(x, y, w, h);
  const low = frac < 0.25, blnk = low && Math.floor(performance.now() / 250) % 2 === 0;
  if (!(low && !blnk) && frac > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, dim); g.addColorStop(1, bright);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * frac, h);
  }
  ctx.strokeStyle = blnk ? PAL.bloodBright : PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Фон статичных экранов: тёплая пустота + сетка + радиальные пятна + скан-лайны.
function drawStaticBg(ctx, W, H) {
  ctx.fillStyle = PAL.pit; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(122,112,94,0.05)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 48) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
  for (let y = 0; y <= H; y += 48) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
  ctx.stroke();
  let g = ctx.createRadialGradient(W * 0.5, H * 0.08, 0, W * 0.5, H * 0.08, H * 0.8);
  g.addColorStop(0, 'rgba(212,160,66,0.05)'); g.addColorStop(1, 'rgba(212,160,66,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.82, H * 0.22, 0, W * 0.82, H * 0.22, H * 0.65);
  g.addColorStop(0, 'rgba(168,40,28,0.07)'); g.addColorStop(1, 'rgba(168,40,28,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(232,220,196,0.02)'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

// CRT-атмосфера поверх игрового вьюпорта: виньетка + тонкие скан-лайны.
function drawCrtOverlay(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H * 0.52, Math.min(W, H) * 0.30, W / 2, H * 0.52, Math.max(W, H) * 0.64);
  g.addColorStop(0, 'rgba(7,5,10,0)'); g.addColorStop(1, 'rgba(7,5,10,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(7,5,10,0.14)'; for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

function drawHUD(ctx, world, unit, inv, dbg, W, H) {
  const depth = Math.max(0, unit.tileY - CAVE_FLOOR_Y);

  // ===== TOP-LEFT: статус юнита (gold) — без энергии (упрощённая модель) =====
  const vx = 10, vy = 8, vw = 188, vh = 58;
  let cy = techPanel(ctx, vx, vy, vw, vh, { accent: PAL.gold, label: '// ЮНИТ · НОРД', serial: 'TR-014' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.pewter; ctx.font = `7px ${FONT_MONO}`;
  ctx.fillText(`${world.layerName(unit.tileY)} · ГЛУБ ${depth} · ${unit.effectiveSpeed().toFixed(1)} т/с`, vx + 11, cy + 8);
  const bx = vx + 11, bw = vw - 22, bh = 9;
  hudBar(ctx, bx, cy + 24, bw, bh, unit.hp / unit.stats.maxHp, 'HP / КОРПУС', `${Math.round(unit.hp)}/${unit.stats.maxHp}`, 'hp');

  // ===== TOP-LEFT (под статусом): груз (toxic) — фигурки ресурсов + счётчик =====
  const gy = vy + vh + 6, gh = 40, used = inv.cargoUsed(), cap = inv.cargoCapacity();
  const gcy = techPanel(ctx, vx, gy, vw, gh, { accent: PAL.toxic, label: '// ГРУЗ', serial: `${used}/${cap}`, bolts: false });
  const counts = inv.cargoCounts(), keys = Object.keys(RESOURCE_DEFS);
  const cellW = (vw - 24) / keys.length, ry = gcy + 9;
  ctx.textBaseline = 'middle';
  keys.forEach((key, i) => {
    const n = counts[key] || 0, sx = vx + 14 + cellW * i;
    ctx.globalAlpha = n > 0 ? 1 : 0.32; paintResource(ctx, key, sx + 6, ry, 6, 7); ctx.globalAlpha = 1;
    ctx.fillStyle = n > 0 ? PAL.chalk : PAL.ash; ctx.font = `bold 11px ${FONT_MONO}`; ctx.textAlign = 'left';
    ctx.fillText(`${n}`, sx + 17, ry);
  });
  ctx.textBaseline = 'alphabetic';

  // ===== СПРАВА от капсулы таймера (Hibernation Widget): цикл =====
  // Капсула стоит на x=210..570; ставим цикл сразу после неё, выше панели задания.
  if (dbg.cycle) {
    const gx = 580;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `700 14px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.chalk;
    ctx.fillText(`ЦИКЛ ${dbg.cycle.n}`, gx, 10);
    ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter;
    ctx.fillText(`СЛЕД. ЧЕРЕЗ ${Math.ceil(dbg.cycle.timeLeft())}С`, gx, 26);
    ctx.textBaseline = 'alphabetic';
  }

  // ===== BOTTOM: подсказка управления =====
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText('WASD · ХОД/ЛАЗАНЬЕ    УПОР В ПОРОДУ = БУР    ESC · ПАУЗА', 12, H - 10);
}
