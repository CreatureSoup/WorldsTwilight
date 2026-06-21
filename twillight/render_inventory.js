'use strict';

// Рендер экрана СБОРКИ юнита. Логика (статы/слоты/риг-превью/ввод) — в inventory.js;
// здесь только Canvas (свободные функции draw*, §6 CLAUDE.md). computeLayout/computeSlots/
// computeCards/cardAt и состояние (modules/scrollY/maxScroll/hoverCard) живут на классе —
// нужны вводу; рендер их читает и пишет (maxScroll/scrollY/hoverCard правятся в draw).

function drawInventory(ctx, inv, W, H) {
  const L = inv.computeLayout(W, H);
  inv.hoverCard = inv.cardAt(inv.mouse.x, inv.mouse.y);   // подсветка карточки (перетаскивание отключено)

  drawStaticBg(ctx, W, H);
  hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  pulseDot(ctx, W / 2 - 110, 23, 3, PAL.gold);
  ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText('// СБОРКА ЮНИТА · АКТИВНА', W / 2, 26);
  ctx.fillStyle = PAL.chalk; ctx.font = `700 28px ${FONT_DISPLAY}`;
  ctx.fillText('ЧЕРТЁЖ', W / 2, 54);
  ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`;
  ctx.fillText('ВЫБЕРИ МОДУЛЬ В ГАЛЕРЕЕ — ОН ВСТАНЕТ В СЛОТ · ENTER · В ШАХТУ', W / 2, 74);

  _invDrawBack(ctx, inv, L.back);
  _invDrawBlueprint(ctx, inv, L);
  _invDrawStats(ctx, inv, L);
  _invDrawList(ctx, inv, L);
  _invDrawStart(ctx, inv, L);

  // if (inv.drag) _invDrawDragGhost(ctx, inv);   // карточка-призрак при перетаскивании (отключено)
}

// «← назад» — лаконичная стрелка в рамке со скошенным углом (как `.mt-back`/`.cx-back` в DOM-разделах)
function _invDrawBack(ctx, inv, r) {
  const hov = !inv.drag && inv.inRect(inv.mouse.x, inv.mouse.y, r);
  const cut = 9;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(r.x + 0.5, r.y + 0.5);
  ctx.lineTo(r.x + r.w - 0.5, r.y + 0.5);
  ctx.lineTo(r.x + r.w - 0.5, r.y + r.h - 0.5);
  ctx.lineTo(r.x + cut + 0.5, r.y + r.h - 0.5);
  ctx.lineTo(r.x + 0.5, r.y + r.h - cut - 0.5);
  ctx.closePath();
  if (hov) { ctx.fillStyle = 'rgba(212,160,66,0.10)'; ctx.fill(); }
  ctx.strokeStyle = hov ? PAL.gold : PAL.ash; ctx.lineWidth = 1; ctx.stroke();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.strokeStyle = hov ? PAL.goldBright : PAL.bone; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 6, cy); ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx - 1, cy - 5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 1, cy + 5);
  ctx.stroke();
  ctx.restore();
}

function _invDrawBlueprint(ctx, inv, L) {
  const b = L.blueprint;
  techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.cobalt, label: '// ЮНИТ · СКИТАЛЕЦ', serial: 'RIG' });

  ctx.save();
  ctx.beginPath(); ctx.rect(b.x + 6, b.y + 22, b.w - 12, b.h - 28); ctx.clip();

  // лёгкая сетка-«пол» (атмосфера, не подложка-схема)
  ctx.strokeStyle = 'rgba(58,126,200,0.06)'; ctx.lineWidth = 1;
  for (let gy = b.y + 24; gy < b.y + b.h - 6; gy += 32) { ctx.beginPath(); ctx.moveTo(b.x + 6, gy + 0.5); ctx.lineTo(b.x + b.w - 6, gy + 0.5); ctx.stroke(); }

  // ЖИВОЙ риг юнита со спрайтами (по фактической сборке: нет модуля → деталь скрыта)
  const S = inv.blueprintScale(L);
  const fakeCam = { x: 0, y: 0, screenX: (px) => px };
  const dum = inv._dummyUnit(false), ringDef = UNIT_DEFS[inv.hull] && UNIT_DEFS[inv.hull].kind === 'ring';
  const lr = ringDef ? inv._previewLegRig() : null;
  // НИЗ композиции привязан к нижней кромке: кончики ног уходят чуть ЗА кадр (вся сцена едет
  // вместе — уровень пола относительно юнита НЕ меняется). Фикс. доля от высоты не годилась:
  // в высоком окне масштаб лимитируется ШИРИНОЙ панели → юнит мельче высоты → снизу пустота.
  // `_plLegDrop` — СТАБИЛЬНЫЙ (кэш), а не мгновенный max по кадрам (тот «гуляет» → юнит подпрыгивал).
  if (lr) b.cy = (b.y + b.h - 6) + TILE * 0.5 - inv._plLegDrop * S;   // +TILE*0.5 — насколько кончики за кромкой

  const slots = inv.computeSlots();

  ctx.save(); ctx.translate(b.cx, b.cy); ctx.scale(S, S);
  if (ringDef) {   // КОЛЬЦО: ноги-ЩУПАЛЬЦА (IK, как в игре) ПОД + кольцо-реактор/модули
    if (typeof partsHull === 'function') partsHull(dum.hull);
    if (lr) {   // IK-щупальца на фейковом полу + корпус едет на их bodyOff (как в игре)
      drawLegRig(ctx, lr, { y: inv._plWy, screenX: (px) => px });
      drawRingUnit(ctx, null, dum, fakeCam, { scale: 1, dx: lr.bodyOff.x, dy: lr.bodyOff.y });
    } else {    // фолбэк: FK-ноги
      const rig = resolveUnitRig(0, 0, inv._dummyUnit(true), inv._rigTime());
      for (const leg of rig.legs) drawLeg(ctx, leg, rig.R);
      drawRingUnit(ctx, null, dum, fakeCam, { scale: 1 });
    }
  } else {
    drawTachikoma(ctx, null, dum, fakeCam);
  }
  ctx.restore();

  // гнёзда — тонкие кольца статуса слота (занят cobalt / пуст amber). Перетаскивание отключено —
  // ветки драга/радар-пинга закомментированы (`_invDrawSlotPing`/`_invDrawDragGhost` — для будущего ре-энейбла).
  for (const s of slots) {
    const filled = !!inv.modules[s.category];
    // const matchable = inv.drag && inv.drag.category === s.category;
    // if (matchable) { _invDrawSlotPing(ctx, s, inv.hoverSlot && inv.hoverSlot.category === s.category, performance.now() / 1000); continue; }
    const r = 24;
    let col, lw, dash, alpha;
    // if (inv.drag)    { col = PAL.bronze; lw = 1;   dash = [3, 5]; alpha = 0.3; }   // чужая категория при драге
    if (filled)          { col = PAL.cobalt; lw = 1;   dash = [];     alpha = 0.5; }
    else                 { col = PAL.amber;  lw = 1.5; dash = [4, 4]; alpha = 1; }
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // выноски ПОВЕРХ юнита: название установленного модуля (чип клампится внутрь панели)
  for (const s of slots) _invDrawCallout(ctx, inv, s, b);

  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// Радар-пинг цели для дропа: прицел-кольцо + центральная точка + 2 расходящихся кольца
// БЕЗ заливки с фейд-аутом (в противофазе). hovering — курсор над целью: ярче/быстрее/крупнее.
function _invDrawSlotPing(ctx, s, hovering, t) {
  const col = hovering ? PAL.goldBright : PAL.gold;
  const period = hovering ? 0.8 : 1.15, rMin = 11, rMax = hovering ? 50 : 42;
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {                                  // расходящиеся кольца с фейд-аутом
    const ph = ((t / period) + k * 0.5) % 1;
    ctx.globalAlpha = (1 - ph) * (hovering ? 0.9 : 0.6);
    ctx.strokeStyle = col; ctx.lineWidth = 2.4 * (1 - ph) + 0.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, rMin + (rMax - rMin) * ph, 0, 6.283); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = hovering ? 2.6 : 1.8;   // прицел-кольцо
  ctx.beginPath(); ctx.arc(s.x, s.y, rMin, 0, 6.283); ctx.stroke();
  ctx.lineWidth = 1.6;                                           // прицельные риски по 4 сторонам
  for (const d of [0, 90, 180, 270]) {
    const a = d * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    ctx.beginPath(); ctx.moveTo(s.x + c * (rMin + 4), s.y + sn * (rMin + 4)); ctx.lineTo(s.x + c * (rMin + 9), s.y + sn * (rMin + 9)); ctx.stroke();
  }
  const pulse = 0.55 + 0.45 * Math.sin(t * 12.566 / period);     // центральная точка пульсирует
  ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(s.x, s.y, 3.6, 0, 6.283); ctx.fill();
  ctx.restore();
}

// Выноска ПОВЕРХ юнита: тёмный чип с НАЗВАНИЕМ установленного модуля + линия от гнезда к чипу.
// `b` — рект панели: чип клампится внутрь, чтобы длинные имена не обрезались кромкой.
function _invDrawCallout(ctx, inv, s, b) {
  const r = 22, gap = 30, dx = s.lx, dy = s.ly, n = Math.hypot(dx, dy) || 1;
  const type = inv.modules[s.category], def = type && MODULE_DEFS[type];
  const name = def ? def.name.toUpperCase() : 'МОДУЛЬ НЕ УСТАНОВЛЕН', accent = def ? def.color : PAL.bronze;
  ctx.font = `bold 9px ${FONT_MONO}`;
  const pad = 6, chipW = ctx.measureText(name).width + pad * 2, chipH = 17;
  // желаемое место чипа в сторону (dx,dy), затем КЛАМП внутрь панели
  let cx = s.x + (dx / n) * (r + gap) + (dx >= 0 ? 0 : -chipW);
  let cy = s.y + (dy / n) * (r + gap) - chipH / 2;
  cx = Math.max(b.x + 7, Math.min(cx, b.x + b.w - 7 - chipW));
  cy = Math.max(b.y + 24, Math.min(cy, b.y + b.h - 7 - chipH));
  // СГИБ: диагональ от кромки гнезда → колено → горизонталь к ближней стороне чипа
  const chipLeft = (cx + chipW / 2) < s.x, nearX = chipLeft ? cx + chipW : cx, kneeY = cy + chipH / 2;
  const kneeX = nearX + (chipLeft ? 14 : -14);
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.85; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x + (dx / n) * r, s.y + (dy / n) * r);
  ctx.lineTo(kneeX, kneeY); ctx.lineTo(nearX, kneeY);
  ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(7,5,10,0.82)'; ctx.fillRect(cx, cy, chipW, chipH);   // тёмная плашка — читаемо поверх юнита
  ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.strokeRect(cx + 0.5, cy + 0.5, chipW - 1, chipH - 1); ctx.globalAlpha = 1;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = def ? PAL.chalk : PAL.ash; ctx.fillText(name, cx + pad, cy + chipH / 2 + 0.5);
}

function _invDrawStats(ctx, inv, L) {
  const s = inv.getStats(), b = L.stats;
  techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.gold, label: '// СВОДКА', serial: 'STATS' });
  const items = [
    ['ХП',       `${s.maxHp}`,                          PAL.bloodBright],
    ['СКОРОСТЬ', s.canMove ? `${s.moveSpeed} т/с` : '—', PAL.cobalt],
    ['БУР',      s.canDig ? `×${s.digMult.toFixed(1)}` : '—', PAL.amber],
    ['СКАНЕР',   s.scanR ? `${s.scanR} т` : '—',        PAL.gold],
    ['ГРУЗ',     `${s.capacity}`,                       PAL.toxic],
  ];
  const cellW = (b.w - 24) / items.length;
  items.forEach(([k, v, c], i) => {
    const cx = b.x + 12 + cellW * (i + 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`; ctx.fillText(k, cx, b.y + 28);
    ctx.fillStyle = v === '—' ? PAL.ash : c; ctx.font = `800 22px ${FONT_DISPLAY}`;
    ctx.fillText(v, cx, b.y + 46);
  });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function _invDrawList(ctx, inv, L) {
  techPanel(ctx, L.list.x, L.list.y, L.list.w, L.list.h, { accent: PAL.gold, label: '// МОДУЛИ', serial: 'CAT' });
  const { cards, headers, contentH } = inv.computeCards();
  const innerY = L.list.y + 30, innerH = L.list.h - 38;
  inv.maxScroll = Math.max(0, contentH - innerH);
  if (inv.scrollY > inv.maxScroll) inv.scrollY = inv.maxScroll;

  ctx.save();
  ctx.beginPath(); ctx.rect(L.list.x + 4, innerY, L.list.w - 8, innerH); ctx.clip();
  for (const h of headers) {
    if (h.y + 14 < innerY || h.y > innerY + innerH) continue;
    ctx.fillStyle = PAL.gold; ctx.font = `bold 10px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`// ${h.label}`, h.x, h.y + 12);
    const tw = ctx.measureText(`// ${h.label}`).width;
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(h.x + tw + 8, h.y + 8); ctx.lineTo(h.x + h.w, h.y + 8); ctx.stroke();
  }
  for (const c of cards) {
    if (c.y + c.h < innerY || c.y > innerY + innerH) continue;
    const installed = inv.modules[c.category] === c.type;
    const hover = inv.hoverCard && inv.hoverCard.type === c.type;
    _invDrawCard(ctx, c.x, c.y, c.w, c.h, c.def, installed, hover, c.type);
  }
  ctx.restore();

  // Скролл-индикатор справа от списка
  if (inv.maxScroll > 0) {
    const trackX = L.list.x + L.list.w - 6, trackY = innerY + 2, trackH = innerH - 4;
    ctx.fillStyle = PAL.bronze; ctx.fillRect(trackX, trackY, 3, trackH);
    const thumbH = Math.max(20, trackH * innerH / (innerH + inv.maxScroll));
    const thumbY = trackY + (trackH - thumbH) * (inv.scrollY / inv.maxScroll);
    ctx.fillStyle = PAL.gold; ctx.fillRect(trackX, thumbY, 3, thumbH);
  }
}

// Карточка модуля: высокая и узкая (видно, что в галерее есть ещё). Сверху —
// область ассета (пока крупная иконка-плейсхолдер), ниже имя и стат.
function _invDrawCard(ctx, x, y, w, h, def, installed, hover, type) {
  const accent = def.color;
  ctx.fillStyle = installed ? 'rgba(20,16,12,0.96)' : 'rgba(13,10,14,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = installed ? accent : (hover ? PAL.bone : PAL.bronze);
  ctx.lineWidth = installed ? 1.5 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  // область ассета: настоящий спрайт модуля (та же деталь, что на юните); если
  // спрайта нет (напр. сканер) — фолбэк на монохромную иконку.
  const imgH = Math.round(h * 0.52);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + 1, w - 2, imgH);
  // спрайт КОНКРЕТНОГО варианта модуля (`mod:<id>`) → откат на спрайт детали категории → проц-иконка
  const CAT2SPRITE = { drill: 'drill', engine: 'engine', cargo: 'hold', scanner: 'sensor' };
  const sp = (typeof spriteFor === 'function') ? (spriteFor('mod:' + type) || spriteFor(CAT2SPRITE[def.category])) : PART_SPRITES[CAT2SPRITE[def.category]];
  ctx.save(); ctx.translate(x + w / 2, y + 1 + imgH / 2);
  if (sp && sp.img && sp.img.complete) {
    const boxW = (w - 8) * 0.92, boxH = imgH * 0.84;
    const k = Math.min(boxW / sp.img.width, boxH / sp.img.height);
    ctx.drawImage(sp.img, -sp.img.width * k / 2, -sp.img.height * k / 2, sp.img.width * k, sp.img.height * k);
  } else {
    drawModuleIcon(ctx, def.category, 0, 0, imgH * 0.42, accent);
  }
  ctx.restore();
  // тонкая линия-разделитель
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 1, y + imgH + 1.5); ctx.lineTo(x + w - 1, y + imgH + 1.5); ctx.stroke();
  // полоска цвета категории сверху
  ctx.fillStyle = accent; ctx.fillRect(x, y, w, 3);

  // имя
  ctx.font = `bold 10px ${FONT_MONO}`; ctx.fillStyle = PAL.chalk; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(def.name.toUpperCase(), x + w / 2, y + imgH + 20);
  // стат
  let statStr = '';
  if (def.digMult)  statStr = `СИЛА ×${def.digMult.toFixed(1)}`;
  if (def.speed)    statStr = `${def.speed} Т/С`;
  if (def.scanR)    statStr = `РАДИУС ${def.scanR}`;
  if (def.capacity) statStr = `ГРУЗ ${def.capacity}`;
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter;
  ctx.fillText(statStr, x + w / 2, y + imgH + 36);
  // бейдж «установлен» — галка в углу
  if (installed) {
    ctx.fillStyle = accent; ctx.font = `bold 8px ${FONT_MONO}`; ctx.textAlign = 'center';
    ctx.fillText('✓ УСТАНОВЛЕН', x + w / 2, y + h - 8);
  }
  ctx.textAlign = 'left';
}

function _invDrawDragGhost(ctx, inv) {
  const m = MODULE_DEFS[inv.drag.type];
  const w = inv.CARD_W(), h = inv.CARD_H();
  ctx.save(); ctx.globalAlpha = 0.92;
  _invDrawCard(ctx, inv.mouse.x - w / 2, inv.mouse.y - h / 2, w, h, m, false, false, inv.drag.type);
  ctx.restore();
}

function _invDrawStart(ctx, inv, L) {
  const s = inv.getStats(), valid = s.valid, b = L.start;
  const hot = inv.inRect(inv.mouse.x, inv.mouse.y, b);
  ctx.fillStyle = valid && hot ? PAL.gold : 'rgba(13,10,14,0.9)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = valid ? PAL.gold : PAL.ash; ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (valid) {
    ctx.fillStyle = hot ? PAL.void : PAL.gold; ctx.font = `14px ${FONT_MONO}`;
    ctx.fillText('В ШАХТУ ▶', b.x + b.w / 2, b.y + b.h / 2);
  } else {
    ctx.fillStyle = PAL.ash; ctx.font = `12px ${FONT_MONO}`;
    const cat2label = { drill: 'бур', engine: 'двигатель', scanner: 'сканер', cargo: 'трюм' };
    ctx.fillText('УСТАНОВИ: ' + s.missing.map((c) => cat2label[c]).join(', ').toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}
