'use strict';

// Внутриигровой HUD по дизайн-системе (design/ · кодекс): техно-рамки TechPanel
// (рамка + уголки + болты + шапка label/serial + опц. PCB-пальцы), акцент по смыслу,
// пульс-LED индикаторы. Шрифты Tektur/JetBrains Mono/Plex, палитра PAL.
function blinkA() { return 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 320)); }
// Обрезать строку по ширине с «…» (лог: длинные записи не вылезают из правого угла в печать/панель действий).
function _logTrunc(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  let lo = 1, hi = s.length;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
  return s.slice(0, lo) + '…';
}
// ПЕРЕКЛЮЧАТЕЛЬ-КАПСУЛА ВКЛ/ВЫКЛ — ПЕРЕИСПОЛЬЗУЕМЫЙ элемент (как в «Обнаружении угроз»): рамка + бегунок + подпись. Возвращает свой rect.
function hudToggleSwitch(ctx, sx, sy, on) {
  const sw = 30, sh = 14;
  ctx.fillStyle = on ? 'rgba(200,226,90,0.16)' : PAL.earth; ctx.fillRect(sx, sy, sw, sh);
  ctx.strokeStyle = on ? PAL.toxic : PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
  ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle';
  if (on) { ctx.fillStyle = PAL.toxic; ctx.textAlign = 'left'; ctx.fillText(STR.hud.toggle.on, sx + 5, sy + sh / 2 + 0.5); ctx.fillRect(sx + sw - 9, sy + 2, 7, sh - 4); }   // надпись слева, бегунок справа
  else { ctx.fillStyle = PAL.ash; ctx.fillRect(sx + 2, sy + 2, 7, sh - 4); ctx.textAlign = 'right'; ctx.fillText(STR.hud.toggle.off, sx + sw - 4, sy + sh / 2 + 0.5); }   // бегунок слева, надпись справа
  return { x: sx, y: sy, w: sw, h: sh };
}
function pulseDot(ctx, x, y, r, color) { ctx.save(); ctx.globalAlpha = blinkA(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); ctx.restore(); }
// мигающий КВАДРАТ (центр x,y, сторона s) — буллет директивы/индикатор.
function pulseSquare(ctx, x, y, s, color) { ctx.save(); ctx.globalAlpha = blinkA(); ctx.fillStyle = color; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); ctx.restore(); }

// ЛАКОНИЧНЫЙ тумблер «ПУТЬ» (показ навигации до города) — справа на ВЕРХНЕМ ряду (вровень с капсулой города /
// счётчиком циклов). Rect общий с кликом (game.navClick).
// МАЯЧОК ГОРОДА — верхний слот; ПУТЬ встаёт ПОД ним, если маячок открыт (оба тумблера не наезжают).
function beaconHudRect(W) { const w = 58, h = 15; return { x: W - 12 - w, y: 11, w, h }; }
function navHudRect(W) {
  const w = 58, h = 15;
  const down = (typeof metaHas === 'function' && metaHas('amb_beacon')) ? (h + 3) : 0;   // под маячком (если он есть) — иначе верхний слот
  return { x: W - 12 - w, y: 11 + down, w, h };
}
function drawBeaconToggle(ctx, on, W) {
  const r = beaconHudRect(W), acc = on ? PAL.amber : PAL.bronze, x = r.x, y = r.y, w = r.w, h = r.h, c = 4, iy = y + h / 2;
  ctx.save();
  ctx.beginPath();                              // пилюля со срезанными углами (как ПУТЬ)
  ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
  ctx.fillStyle = on ? 'rgba(240,138,42,0.12)' : 'rgba(13,10,14,0.45)'; ctx.fill();
  ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.stroke();
  // глиф-маяк: стрелка → точка-база (залит=вкл / контур=выкл)
  ctx.strokeStyle = acc; ctx.fillStyle = acc; ctx.lineWidth = 1; const gx = x + 8;
  ctx.beginPath(); ctx.moveTo(gx - 3, iy); ctx.lineTo(gx + 2, iy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gx + 1.5, iy - 2.6); ctx.lineTo(gx + 5, iy); ctx.lineTo(gx + 1.5, iy + 2.6); ctx.closePath(); on ? ctx.fill() : ctx.stroke();
  ctx.beginPath(); ctx.arc(gx + 9, iy, 1.5, 0, 6.283); on ? ctx.fill() : ctx.stroke();
  ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = on ? PAL.chalk : PAL.pewter; ctx.fillText(STR.hud.beaconToggle, x + 27, iy + 0.5);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
function drawNavToggle(ctx, on, W) {
  const r = navHudRect(W), acc = on ? PAL.cobalt : PAL.bronze, x = r.x, y = r.y, w = r.w, h = r.h, c = 4, iy = y + h / 2;
  ctx.save();
  ctx.beginPath();                              // пилюля со срезанными углами (техно-рамка)
  ctx.moveTo(x + c, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + c); ctx.closePath();
  ctx.fillStyle = on ? 'rgba(58,126,200,0.12)' : 'rgba(13,10,14,0.45)'; ctx.fill();
  ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.stroke();
  // глиф-маршрут: исток · пунктир · ромб-назначение (залит=вкл / контур=выкл)
  ctx.strokeStyle = acc; ctx.fillStyle = acc; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x + 8, iy, 1.4, 0, 6.283); ctx.fill();
  ctx.setLineDash([1.5, 1.5]); ctx.beginPath(); ctx.moveTo(x + 10, iy); ctx.lineTo(x + 16, iy); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(x + 19, iy); ctx.rotate(Math.PI / 4); if (on) ctx.fillRect(-1.7, -1.7, 3.4, 3.4); else ctx.strokeRect(-1.7, -1.7, 3.4, 3.4); ctx.restore();
  ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = on ? PAL.chalk : PAL.pewter; ctx.fillText(STR.hud.navToggle, x + 27, iy + 0.5);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── ПАНЕЛЬ ПЕЧАТИ СТРУКТУР (низ слева; гейт — принтер в доп-слоте). Геометрия общая с кликом (game.printClick).
function printPanelLayout(W, H, types) {
  const w = 312, h = 98, x = 12, y = H - 26 - h, pad = 11, gap = 6, n = Math.max(1, types.length);   // выше нижней подсказки управления (H−10)
  const cardY = y + 26, cardH = 26, cardW = (w - pad * 2 - gap * (n - 1)) / n, cards = [];
  for (let i = 0; i < types.length; i++) cards.push({ type: types[i], x: x + pad + i * (cardW + gap), y: cardY, w: cardW, h: cardH });
  return { x, y, w, h, pad, cards, btn: { x: x + w - pad - 78, y: y + 58, w: 78, h: 17 }, rowY: y + 66, toggle: { x: x + pad, y: y + h - 19, w: 132, h: 15 } };
}
// Мини-глиф структуры для карточки/превью.
function drawStructGlyph(ctx, type, cx, cy, r, color) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  const def = STRUCT_DEFS[type], turret = (a) => { ctx.beginPath(); ctx.arc(cx, cy + r * 0.3, r * 0.8, Math.PI, 0); ctx.fill(); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.3); ctx.lineTo(cx + r * a, cy - r * 0.5); ctx.stroke(); };
  switch (def.b) {
    case 'wall': ctx.strokeRect(cx - r, cy - r, r * 2, r * 2); ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); break;
    case 'spike': for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.7 - r * 0.3, cy + r); ctx.lineTo(cx + i * r * 0.7, cy - r); ctx.lineTo(cx + i * r * 0.7 + r * 0.3, cy + r); ctx.closePath(); ctx.fill(); } break;
    case 'turret': turret(1.1); break;
    case 'railgun': turret(1.4); break;
    case 'microwave': ctx.beginPath(); ctx.arc(cx, cy + r * 0.3, r * 0.7, Math.PI, 0); ctx.fill(); ctx.lineWidth = 1.5; for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.2); ctx.lineTo(cx + r * (1 + k), cy - r * 0.7); ctx.stroke(); } break;
    case 'emp': ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.4, r * 0.85, 0, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 2, 0, 6.283); ctx.fill(); break;
    case 'repulsor': ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, 6.283); ctx.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); } break;
    case 'jammer': ctx.fillRect(cx - 1.5, cy - r, 3, r * 2); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx + k * r * 0.8, cy - r); ctx.stroke(); } break;
    case 'repair': ctx.strokeRect(cx - r * 0.85, cy - r * 0.85, r * 1.7, r * 1.7); ctx.fillRect(cx - 1.5, cy - r * 0.6, 3, r * 1.2); ctx.fillRect(cx - r * 0.6, cy - 1.5, r * 1.2, 3); break;
    case 'courier': ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.7, r * 0.42, 0, 0, 6.283); ctx.stroke(); for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.2); ctx.lineTo(cx + k * r * 0.85, cy - r * 0.55); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + k * r * 0.85, cy - r * 0.6, r * 0.28, 0, 6.283); ctx.stroke(); } ctx.fillRect(cx - r * 0.4, cy + r * 0.45, r * 0.8, r * 0.5); break;   // дрон с контейнером
    case 'siege': { const baseY = cy + r, topY = cy - r; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, topY); ctx.stroke();   /* мачта */ ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx - r * 0.7, baseY); ctx.lineTo(cx, cy + r * 0.2); ctx.lineTo(cx + r * 0.7, baseY); ctx.stroke();   /* раскосы-тренога */ ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, topY, r * 0.55, -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1); ctx.stroke();   /* дуга-излучатель к цели */ ctx.beginPath(); ctx.arc(cx, topY, r * 0.22, 0, 6.283); ctx.fill();   /* ядро-резонатор */ break; }
    default: ctx.strokeRect(cx - r * 0.7, cy - r, r * 1.4, r * 2); ctx.fillRect(cx - r * 0.7, cy, r * 1.4, r); ctx.fillRect(cx - 2, cy - r - 2, 4, 2);   // battery
  }
  ctx.restore();
}
function drawPrintHud(ctx, game, W, H) {
  if (!game.printActive || !game.printActive()) return;
  if (game.printMode) { drawPrintHint(ctx, game, W, H); return; }
  ctx.save();   // ⚠️ ИЗОЛЯЦИЯ: внутри меняем globalAlpha (тусклые карточки/кнопка) — без restore утечка в след. кадр (мир/туман на 0.4 = «туман пропал»)
  const RED = PAL.blood || '#ff3a22', REDB = PAL.bloodBright || '#ff6a4a';
  const types = game.printTypes(), L = printPanelLayout(W, H, types);
  if (typeof HudLayout !== 'undefined') HudLayout.reserve('bl', L.w, L.h);   // застолбить низ зоны bl → бур-статус стекается НАД панелью печати (без наложения)
  techPanel(ctx, L.x, L.y, L.w, L.h, { accent: RED, label: STR.hud.print.title });
  drawCargoToggle(ctx, L.toggle, !!game.hoardCargo);   // тумблер копить/отдавать — только при установленном принтере (плашка видна)
  // имя наведённого чертежа рядом с заголовком — цветом самого объекта (отличным от красного заголовка)
  let hov = null; const m = game.menuMouse;
  if (m) for (const c of L.cards) if (m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h) { hov = c.type; break; }
  if (hov) {
    ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillStyle = STRUCT_DEFS[hov].color;
    ctx.fillText(STRUCT_DEFS[hov].name.toUpperCase(), L.x + 11 + ctx.measureText(STR.hud.print.title + ' ').width, L.y + 9);
    ctx.textBaseline = 'alphabetic';
  }
  for (const c of L.cards) {
    const def = STRUCT_DEFS[c.type], sel = game.printSel === c.type, afford = game.printCanAfford(c.type);
    ctx.globalAlpha = afford ? 1 : 0.4;
    ctx.fillStyle = sel ? 'rgba(255,58,34,0.18)' : 'rgba(20,16,18,0.8)'; ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = sel ? REDB : PAL.bronze; ctx.lineWidth = sel ? 1.5 : 1; ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    drawStructGlyph(ctx, c.type, c.x + c.w / 2, c.y + c.h / 2 - 1, 7, def.color);
    ctx.globalAlpha = 1;
  }
  if (game.printSel) {
    const cost = game.structCost(game.printSel), RC = { iron: '#9aa7b3', organic: '#5fbf6a', crystal: '#c264e0' };
    ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let cx = L.x + L.pad; const cyR = L.rowY;
    for (const k of Object.keys(cost)) {
      const have = (game.inventory.cargo[k] || 0) >= cost[k];
      ctx.fillStyle = RC[k]; ctx.fillRect(cx, cyR - 3, 6, 6);
      ctx.fillStyle = have ? PAL.bone : REDB; ctx.fillText(cost[k] + '', cx + 9, cyR + 1);
      cx += 30;
    }
    const afford = game.printCanAfford(game.printSel), b = L.btn;
    ctx.globalAlpha = afford ? 1 : 0.4;
    ctx.fillStyle = afford ? 'rgba(255,58,34,0.2)' : 'rgba(20,16,18,0.6)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = afford ? REDB : PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = afford ? PAL.chalk : PAL.pewter; ctx.textAlign = 'center'; ctx.fillText(STR.hud.print.button, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.textAlign = 'left';
  }
  ctx.restore();   // снимает все изменения ctx (globalAlpha/выравнивание) — никакой утечки в кадр
}
// Подсказка в режиме печати: при размещении — управление (steady); при печати — МИГАЮЩАЯ «Esc — отмена».
function drawPrintHint(ctx, game, W, H) {
  const placing = game.printMode === 'place', REDB = PAL.bloodBright || '#ff6a4a';
  const msg = placing ? STR.hud.print.placeHint : STR.hud.print.printingHint;
  ctx.save(); ctx.font = `10px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(msg).width, x = W / 2, y = H - 46;   // внизу по центру, над подсказкой управления
  ctx.fillStyle = 'rgba(13,10,14,0.82)'; ctx.fillRect(x - tw / 2 - 11, y - 11, tw + 22, 22);
  ctx.strokeStyle = REDB; ctx.lineWidth = 1; ctx.strokeRect(x - tw / 2 - 11 + 0.5, y - 11 + 0.5, tw + 22 - 1, 21);
  if (!placing && (Math.floor(performance.now() / 1000 / PRINT_BLINK) % 2)) ctx.globalAlpha = 0.32;   // мигание «печать…»
  ctx.fillStyle = placing ? PAL.chalk : REDB; ctx.fillText(msg, x, y + 0.5);
  ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

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

// Геометрия левого стека HUD (ЮНИТ → ГРУЗ → БАНК) — одна на рендер, клик-хит и переразметку под-виджетов.
const HUD_VX = 10, HUD_VY = 8, HUD_VW = 188, HUD_VH = 42;          // ЮНИТ (компактный: шапка + HP, ≈ высота блока таймера гибернации)
const HUD_GY = HUD_VY + HUD_VH + 6, HUD_GH = 46, HUD_BANK_GH = 46; // ГРУЗ исходной высоты (тумблер переехал в плашку ПЕЧАТЬ), БАНК
let _logMeasureSig = '', _logMeasureW = 0;   // кэш ширины лога событий (measureText) — пересчёт только при смене содержимого лога
function hudLeftBottom(hasBank) { return HUD_GY + HUD_GH + 6 + (hasBank ? HUD_BANK_GH + 6 : 0); }            // низ стека → якорь для виджетов ниже (радар)
// Тумблер «копить ресурс» (низ плашки ПЕЧАТЬ) — стандартная ВКЛ/ВЫКЛ-логика как у тумблера ПУТЬ:
// пилюля + ЗАЛИТЫЙ глиф/акцент = ВКЛ (копим), КОНТУР/тускло = ВЫКЛ (сдаём городу). Подпись = режим.
function drawCargoToggle(ctx, r, hoard) {
  const acc = hoard ? PAL.toxic : PAL.bronze, c = 4, iy = r.y + r.h / 2, gx = r.x + 11;
  ctx.beginPath();   // пилюля со срезанными углами (как drawNavToggle)
  ctx.moveTo(r.x + c, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w, r.y + r.h - c); ctx.lineTo(r.x + r.w - c, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x, r.y + c); ctx.closePath();
  ctx.fillStyle = hoard ? 'rgba(200,226,90,0.12)' : 'rgba(13,10,14,0.45)'; ctx.fill();
  ctx.strokeStyle = acc; ctx.lineWidth = 1; ctx.stroke();
  ctx.strokeStyle = acc; ctx.fillStyle = acc; ctx.lineWidth = 1.2;   // глиф-ящик: залит=ВКЛ / контур=ВЫКЛ
  if (hoard) ctx.fillRect(gx - 4, iy - 3, 8, 6); else ctx.strokeRect(gx - 4 + 0.5, iy - 3 + 0.5, 7, 5);
  ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = hoard ? PAL.chalk : PAL.pewter;
  ctx.fillText(hoard ? STR.hud.cargo.hoard : STR.hud.cargo.deliver, gx + 11, iy + 0.5);
  ctx.textBaseline = 'alphabetic';
}

// Панель состояния буров-щитов (винтовой бур): по слоту на каждый щит — НЕСОМ (залитая капсула) или
// В ХОДУ (тусклый контур). Низ-лево, над строкой управления. Гейт — установлен винтовой бур.
function drawBorerStatus(ctx, game, W, H) {
  const u = game.unit; if (!u || !u.stats || !u.stats.screw) return;
  const max = game.borerMax ? game.borerMax() : 2;
  const deployed = (game.borers && game.borers.length) || 0, carried = Math.max(0, max - deployed);
  const depleted = (game.borers || []).reduce((n, b) => n + (b.depleted ? 1 : 0), 0);   // разряженные щиты (лежат, ждут подзарядки)
  const active = deployed - depleted;                          // слоты по состояниям: [несомые][в ходу][РАЗРЯД]
  let x, y;   // зона bl (низ-лево): стекается НАД панелью печати, если та активна (иначе — у самого низа). Раскладка — hud_layout.js
  if (typeof HudLayout !== 'undefined') { const box = HudLayout.slot('bl', 140, 44); x = box.x + 2; y = box.y + 8; }
  else { x = 14; y = H - 96; }
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.fillText(STR.hud.borer.title, x, y);
  const iy = y + 9, iw = 26, ih = 12, gap = 7, r = ih / 2;
  const dead = depleted > 0 && Math.sin(performance.now() / 220) > 0;   // РАЗРЯД мигает (зов о подзарядке, как «!» у щита в мире)
  for (let i = 0; i < max; i++) {                              // порядок слотов: несомые → в ходу → РАЗРЯД (красный)
    const ix = x + i * (iw + gap), cx0 = ix + r, cx1 = ix + iw - r, cyc = iy + r;
    const st = i < carried ? 'carry' : (i < carried + active ? 'run' : 'dead');   // состояние слота
    ctx.beginPath();
    ctx.moveTo(cx0, iy); ctx.lineTo(cx1, iy); ctx.arc(cx1, cyc, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(cx0, iy + ih); ctx.arc(cx0, cyc, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    ctx.fillStyle = st === 'carry' ? 'rgba(154,208,160,0.85)' : st === 'dead' ? 'rgba(208,64,47,0.16)' : 'rgba(154,208,160,0.08)'; ctx.fill();
    ctx.strokeStyle = st === 'carry' ? '#cfeccf' : st === 'dead' ? (dead ? '#ff6a4a' : '#d0402f') : 'rgba(154,208,160,0.45)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = st === 'carry' ? '#16241a' : st === 'dead' ? '#ff6a4a' : 'rgba(207,236,207,0.5)'; ctx.beginPath(); ctx.arc(cx1 - 1.5, cyc, 1.6, 0, 6.283); ctx.fill();
  }
  ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.ash;
  ctx.fillText(STR.hud.borer.counts(carried, active, depleted), x, iy + ih + 11);   // В ХОДУ = активные (без разряженных) — совпадает с зелёными слотами
  ctx.restore();
}

function drawHUD(ctx, world, unit, inv, dbg, W, H) {
  // ===== TOP-LEFT: статус юнита (gold) — КОМПАКТНО: только шапка + HP (глубина/скорость/страта убраны, высота ≈ блока таймера) =====
  const vx = HUD_VX, vy = HUD_VY, vw = HUD_VW, vh = HUD_VH;
  let cy = techPanel(ctx, vx, vy, vw, vh, { accent: PAL.gold, label: STR.hud.unit.title, serial: 'TR-014' });
  const bx = vx + 11, bw = vw - 22, bh = 9;
  hudBar(ctx, bx, cy + 8, bw, bh, unit.hp / unit.stats.maxHp, STR.hud.unit.hp, `${Math.round(unit.hp)}/${unit.stats.maxHp}`, 'hp');

  // ===== TOP-LEFT (под статусом): груз (toxic) — фигурки ресурсов + счётчик; сворачивается язычком (dockShift) =====
  const gy = HUD_GY, gh = HUD_GH, used = inv.cargoUsed(), cap = inv.cargoCapacity();
  const cgx = (typeof HudLayout !== 'undefined') ? HudLayout.dockShift('cargo', vx, gy, vw, gh, PAL.toxic) : vx;   // slid-x при сворачивании
  const gcy = techPanel(ctx, cgx, gy, vw, gh, { accent: PAL.toxic, label: STR.hud.cargo.title, serial: `${used}/${cap}`, bolts: false });
  const counts = inv.cargoCounts(), keys = Object.keys(RESOURCE_DEFS);
  const cellW = (vw - 24) / keys.length, ry = gcy + 9;
  ctx.textBaseline = 'middle';
  keys.forEach((key, i) => {
    const n = counts[key] || 0, sx = cgx + 14 + cellW * i;
    ctx.globalAlpha = n > 0 ? 1 : 0.32; paintResource(ctx, key, sx + 6, ry, 6, 7); ctx.globalAlpha = 1;
    ctx.fillStyle = n > 0 ? PAL.chalk : PAL.ash; ctx.font = `bold 11px ${FONT_MONO}`; ctx.textAlign = 'left';
    ctx.fillText(`${n}`, sx + 17, ry);
  });
  ctx.textBaseline = 'alphabetic';

  // ===== БАНК ГОРОДА (узел ГОРОД·Счётчик ресурсов): сданные ресурсы — gated `metaHas('amb_hub')` в game =====
  if (dbg.bank) {
    const by = gy + gh + 6, bgh = HUD_BANK_GH;   // авто-сдвиг под плашкой ГРУЗ
    const bkx = (typeof HudLayout !== 'undefined') ? HudLayout.dockShift('bank', vx, by, vw, bgh, PAL.amber) : vx;   // slid-x при сворачивании
    const bcy = techPanel(ctx, bkx, by, vw, bgh, { accent: PAL.amber, label: STR.hud.bank.title, bolts: false });
    const bry = bcy + 9;
    ctx.textBaseline = 'middle';
    keys.forEach((key, i) => {
      const n = dbg.bank[key] || 0, sx = bkx + 14 + cellW * i;
      ctx.globalAlpha = n > 0 ? 1 : 0.32; paintResource(ctx, key, sx + 6, bry, 6, 7); ctx.globalAlpha = 1;
      ctx.fillStyle = n > 0 ? PAL.chalk : PAL.ash; ctx.font = `bold 11px ${FONT_MONO}`; ctx.textAlign = 'left';
      ctx.fillText(`${n}`, sx + 17, bry);
    });
    ctx.textBaseline = 'alphabetic';
  }

  // ===== СПРАВА от капсулы таймера (Hibernation Widget): цикл =====
  // Капсула стоит на x=210..570; ставим цикл сразу после неё, выше панели задания.
  if (dbg.cycle) {
    const gx = 580;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `700 14px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.chalk;
    const cn = (dbg.cycleNum != null) ? dbg.cycleNum : dbg.cycle.n;   // глобальный цикл существования ИИ (эпоха + прожитые)
    ctx.fillText(STR.hud.cycle(typeof numGroup === 'function' ? numGroup(cn) : cn), gx, 10);
    ctx.textBaseline = 'alphabetic';   // прогресс/таймер до волны рисует drawWavePredict (бар всегда, тип+отсчёт — с узлом)
  }

  // ===== ПРАВО, ПОД виджетом города: цели сессии (директивы) — компактно, мигающий квадрат на цель =====
  if (typeof SESSION_GOALS !== 'undefined') {
    const rx = W - 12; let dyG = 70;   // ниже капсулы гибернации (она занимает верх справа)
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText(STR.hud.directives.title, rx, dyG); dyG += 14;
    for (const g of SESSION_GOALS) {
      ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.bone; ctx.textAlign = 'right';
      ctx.fillText(g.short, rx - 10, dyG + 1);
      pulseSquare(ctx, rx - 3, dyG + 4, 6, PAL[g.accent] || PAL.gold);
      dyG += 12;
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  // ===== BOTTOM-RIGHT: круговой прогресс извлечения данных (когда сканируем сервер-хлам) — 2× =====
  if (dbg.scan || dbg.scanDoneT > 0) {
    const ccx = W - SCAN_RING.dx, ccy = H - SCAN_RING.dy, r = SCAN_RING.r, frac = dbg.scan ? dbg.scan.data : 1;
    ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.strokeStyle = PAL.earth; ctx.beginPath(); ctx.arc(ccx, ccy, r, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = PAL.cobalt; ctx.beginPath(); ctx.arc(ccx, ccy, r, -Math.PI / 2, -Math.PI / 2 + 6.283 * frac); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = PAL.chalk; ctx.font = `700 26px ${FONT_DISPLAY}`; ctx.fillText(`${Math.round(frac * 100)}`, ccx, ccy + 2);
    ctx.textBaseline = 'top'; ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = dbg.scan ? PAL.cobalt : (dbg.scanMsg ? PAL.pewter : PAL.toxic);
    ctx.fillText(dbg.scan ? STR.hud.scan.extracting : (dbg.scanMsg || STR.hud.scan.extracted), ccx, ccy + r + 8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ===== BOTTOM-RIGHT угол: лог событий — ВСЕГДА виден (пустое состояние на старте) =====
  {
    const rx = W - 12, last = (dbg.log && dbg.log.length) ? dbg.log.slice(-3) : null;
    const logMaxW = Math.min(250, W * 0.42);                    // КАП ширины лога — держит его в правом углу, вне печати/панели действий
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText(STR.hud.log.title, rx, H - 54);
    if (last) last.forEach((e, i) => { ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.fillText(_logTrunc(ctx, STR.hud.log.entry(e.cycle, e.text), logMaxW), rx, H - 40 + i * 13); });
    else { ctx.font = `7px ${FONT_MONO}`; ctx.fillStyle = PAL.ash; ctx.fillText(STR.hud.log.empty, rx, H - 40); }
    ctx.textAlign = 'left';
    // ширина лога для mark() — measureText КЭШИРУЕТСЯ по сигнатуре содержимого (лог меняется редко → не мерим каждый кадр); учитываем обрезку
    const sig = last ? last.map((e) => e.cycle + ':' + e.text).join('|') : '';
    if (sig !== _logMeasureSig) {
      ctx.font = `8px ${FONT_MONO}`; let mw = ctx.measureText(STR.hud.log.title).width;
      if (last) last.forEach((e) => { ctx.font = `7px ${FONT_MONO}`; mw = Math.max(mw, ctx.measureText(_logTrunc(ctx, STR.hud.log.entry(e.cycle, e.text), logMaxW)).width); });
      else { ctx.font = `7px ${FONT_MONO}`; mw = Math.max(mw, ctx.measureText(STR.hud.log.empty).width); }
      _logMeasureSig = sig; _logMeasureW = mw;
    }
    // лог занимает низ-право → панель действий (drawActionBar) обходит его при центрировании
    if (typeof HudLayout !== 'undefined') HudLayout.mark(rx - _logMeasureW - 4, H - 62, _logMeasureW + 8, 52, 'event-log');
  }

  // ===== BOTTOM: подсказка управления =====
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText(STR.hud.controls, 12, H - 10);
}
