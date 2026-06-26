'use strict';

// Рендер экрана УЛУЧШЕНИЙ. Логика/экономика — в upgrades.js; здесь только Canvas
// (свободные функции draw*, как требует §6 CLAUDE.md). computeLayout/hit-rects (`buttons`)
// остаются на классе — нужны вводу; рендер их читает и пишет (buttons/scrollY/maxScroll/
// _selScreenY/_followSel — наблюдаемое состояние на инстансе Upgrades).

function drawUpgrades(ctx, u, W, H) {
  const L = u.computeLayout(W, H);
  drawStaticBg(ctx, W, H);
  hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);

  // ===== шапка: заголовок + кошелёк =====
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  pulseDot(ctx, L.list.x + 4, 24, 3, PAL.amber);
  ctx.fillStyle = PAL.amber; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.upgrades.kicker, L.list.x + 16, 27);
  ctx.fillStyle = PAL.chalk; ctx.font = `700 26px ${FONT_DISPLAY}`;
  ctx.fillText(STR.upgrades.title, L.list.x, 56);
  ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.upgrades.controls(u.cityName.toUpperCase()), L.list.x, 74);
  // надпись «не хватает ресурсов»: если выбранный апгрейд не по карману (или была
  // неудачная попытка покупки) — мигаем в шапке справа от заголовка.
  const lowOnRes = u.selNextCost() && !u.selAffordable();
  const flashing = performance.now() - (u.warnT || -1e9) < 1400;
  if (lowOnRes || flashing) {
    const a = flashing ? (0.6 + 0.4 * Math.sin(performance.now() / 120)) : 0.85;
    ctx.globalAlpha = a; ctx.fillStyle = PAL.bloodBright; ctx.font = `bold 12px ${FONT_MONO}`;
    ctx.fillText('⚠ ' + STR.upgrades.lowRes, L.list.x + 220, 54); ctx.globalAlpha = 1;
  }
  _drawUpgWallet(ctx, u, L.list.x + L.list.w, 36);

  // ===== прокручиваемый список секций: каждый трек = РЯД карточек по уровням =====
  const innerY = L.list.y, innerH = L.list.h;
  u.buttons = [];
  ctx.save();
  ctx.beginPath(); ctx.rect(L.list.x - 4, innerY, L.list.w + 8, innerH); ctx.clip();
  let cy = innerY - u.scrollY;
  const rowH = 58, rowGap = 10;
  const drawSection = (title, accent, items) => {
    ctx.fillStyle = accent; ctx.font = `700 15px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    if (cy + 18 > innerY && cy < innerY + innerH) {
      ctx.fillText(title, L.list.x, cy + 13);
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
      const tw = ctx.measureText(title).width;
      ctx.beginPath(); ctx.moveTo(L.list.x + tw + 12, cy + 8); ctx.lineTo(L.list.x + L.list.w, cy + 8); ctx.stroke();
    }
    cy += 24;
    for (const tr of items) {
      const selected = tr === u.selTrack();
      if (selected) u._selScreenY = cy;   // запомнить для авто-скролла
      if (cy + rowH > innerY && cy < innerY + innerH) _drawUpgTrackRow(ctx, u, L.list.x, cy, L.list.w, rowH, tr, selected);
      cy += rowH + rowGap;
    }
    cy += 16;
  };

  u._selScreenY = null;
  drawSection(STR.upgrades.secUnit, PAL.cobalt, u.tracks.filter((t) => t.cat === 'unit'));
  const cityTracks = u.tracks.filter((t) => t.cat === 'city');
  if (cityTracks.length) drawSection(STR.upgrades.secCity(u.cityName.toUpperCase()), PAL.amber, cityTracks);
  else if (cy + 14 > innerY && cy < innerY + innerH) {   // раздел закрыт: не открыт ни один узел ветки ГОРОД
    ctx.fillStyle = PAL.ash; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'left';
    ctx.fillText(STR.upgrades.secCityLocked, L.list.x, cy + 13);
    cy += 24;
  }
  ctx.restore();

  const contentH = cy + u.scrollY - innerY;
  u.maxScroll = Math.max(0, contentH - innerH);
  if (u.scrollY > u.maxScroll) u.scrollY = u.maxScroll;
  // авто-доводка к выбранному ряду — ТОЛЬКО когда выбор сменили WASD (`_followSel`), разово.
  // Иначе она срабатывала каждый кадр и возвращала экран к выбранному ряду → колесо/свайп не скроллили.
  if (u._followSel && u._selScreenY != null) {
    if (u._selScreenY < innerY + 24) u.scrollY = Math.max(0, u.scrollY - (innerY + 24 - u._selScreenY));
    else if (u._selScreenY + rowH > innerY + innerH) u.scrollY = Math.min(u.maxScroll, u.scrollY + (u._selScreenY + rowH - (innerY + innerH)));
    u._followSel = false;
  }
  if (u.maxScroll > 0) {
    const tX = L.list.x + L.list.w + 4, tY = innerY, tH = innerH;
    ctx.fillStyle = PAL.bronze; ctx.fillRect(tX, tY, 3, tH);
    const thH = Math.max(24, tH * innerH / (innerH + u.maxScroll));
    ctx.fillStyle = PAL.gold; ctx.fillRect(tX, tY + (tH - thH) * (u.scrollY / u.maxScroll), 3, thH);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function _drawUpgWallet(ctx, u, rightX, y) {
  const keys = ['iron', 'organic', 'crystal'], cw = 96, gap = 8;
  let x = rightX - (cw * keys.length + gap * (keys.length - 1));
  for (const k of keys) {
    ctx.fillStyle = 'rgba(20,16,12,0.96)'; ctx.fillRect(x, y, cw, 38);
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, 37);
    paintResource(ctx, k, x + 16, y + 19, 8, (k.charCodeAt(0) * 99) | 0);
    ctx.fillStyle = PAL.pewter; ctx.font = `7px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(RESOURCE_DEFS[k].name.toUpperCase(), x + 30, y + 7);
    ctx.fillStyle = RESOURCE_DEFS[k].color; ctx.font = `700 16px ${FONT_MONO}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${u.bank[k] || 0}`, x + 30, y + 31);
    x += cw + gap;
  }
}

// Ряд трека: слева компактная подпись (иконка+имя+тек.значение), справа — ВСЕ
// уровни карточками. Куплённые — залиты акцентом; следующий — активен (по клику
// покупка, если хватает банка); дальние — заблокированы (видны, но не кликабельны).
function _drawUpgTrackRow(ctx, u, x, y, w, h, tr, selected) {
  const lvl = u.levels[tr.id] || 0, accent = tr.accent;
  const labelW = 156;
  // СЕТКА: рисуем только реально достижимые слоты — базовый `cap` плюс открываемые узлом СЕТИ ПАМЯТИ
  // (`metaCap.cap`). За ними слотов НЕТ (жёсткий потолок) → пустые ячейки не рисуем. Ширина ячейки
  // фиксированная (как при полной сетке) — размер слотов стабилен, короткие треки просто короче.
  const nCells = (typeof trCap === 'function') ? trCap(tr) : (tr.metaCap ? tr.metaCap.cap : (tr.cap || UPG_MAX));   // рисуем ровно достижимый потолок (вкл. гейт «Верстак ИИ»: без узла — 1 ячейка)
  const ca = x + labelW, gap = 6, cw = (x + w - ca - gap * (UPG_MAX - 1)) / UPG_MAX, ch = h;
  const rowRight = ca + nCells * cw + (nCells - 1) * gap;   // правый край реальных ячеек
  // подсветка выбранного ряда (WASD-курсор) — по фактической ширине, без пустого хвоста
  if (selected) {
    const hw = rowRight - x;
    ctx.fillStyle = 'rgba(212,160,66,0.06)'; ctx.fillRect(x - 4, y - 2, hw + 8, h + 4);
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 1.5, hw + 7, h + 3);
  }
  // иконка
  if (tr.icon) { ctx.save(); ctx.translate(x + 16, y + h / 2); drawModuleIcon(ctx, tr.icon, 0, 0, 12, accent); ctx.restore(); }
  const tx = x + (tr.icon ? 34 : 8);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.chalk; ctx.font = `bold 11px ${FONT_MONO}`; ctx.fillText(tr.label, tx, y + 18);
  ctx.fillStyle = PAL.pewter; ctx.font = `8px ${FONT_MONO}`; ctx.fillText(tr.sub, tx, y + 32);
  const cap = trCap(tr);
  ctx.fillStyle = lvl >= cap ? accent : PAL.bone; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.upgrades.current(tr.fmt(u.trackVal(tr, lvl))) + (lvl >= cap ? STR.upgrades.maxSuffix : ''), tx, y + 47);

  // карточки уровней (ca/gap/cw/ch посчитаны выше): слоты между базовым `cap` и `metaCap.cap` —
  // «ЗАКРЫТО» (откроются узлом СЕТИ ПАМЯТИ); за `metaCap.cap`/`cap` ячеек уже нет (см. nCells).
  for (let k = 1; k <= nCells; k++) {
    const cx = ca + (k - 1) * (cw + gap);
    if (k > cap) {   // за потолком трека: инертная тёмная ячейка
      const liftable = tr.metaCap && k <= tr.metaCap.cap;   // выше — поднимается узлом СЕТИ ПАМЯТИ; иначе жёсткий потолок
      ctx.fillStyle = 'rgba(8,6,10,0.5)'; ctx.fillRect(cx, y, cw, ch);
      ctx.strokeStyle = PAL.carbon; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, ch - 1); ctx.setLineDash([]);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (liftable) {
        ctx.fillStyle = PAL.ash; ctx.font = `7px ${FONT_MONO}`; ctx.fillText(STR.upgrades.cellLocked, cx + cw / 2, y + ch / 2 - 5);
        ctx.fillStyle = PAL.carbon; ctx.fillText(STR.upgrades.cellMemNet, cx + cw / 2, y + ch / 2 + 8);
      } else { ctx.fillStyle = PAL.carbon; ctx.font = `13px ${FONT_MONO}`; ctx.fillText('—', cx + cw / 2, y + ch / 2); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      continue;
    }
    const owned = k <= lvl, next = k === lvl + 1, locked = k > lvl + 1;
    const cost = u.tierCost(k - 1, tr), afford = next && u.canAfford(cost);
    const edge = next && selected;   // «крайний» слот выбранного трека (курсор WASD)
    // фон/рамка по состоянию
    if (owned) { ctx.fillStyle = 'rgba(20,16,12,0.96)'; }
    else if (next) { ctx.fillStyle = afford ? 'rgba(20,16,12,0.96)' : 'rgba(13,10,14,0.7)'; }
    else { ctx.fillStyle = 'rgba(10,8,12,0.55)'; }
    ctx.fillRect(cx, y, cw, ch);
    const bcol = edge ? PAL.goldBright : owned ? accent : next ? (afford ? accent : PAL.bronze) : PAL.carbon;
    ctx.strokeStyle = bcol; ctx.lineWidth = edge ? 2.4 : (next && afford) ? 1.6 : 1; ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, ch - 1);
    if (owned) { ctx.fillStyle = accent; ctx.globalAlpha = 0.12; ctx.fillRect(cx, y, cw, ch); ctx.globalAlpha = 1; }
    // «УР k»
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = owned ? accent : next ? PAL.bone : PAL.ash; ctx.font = `7px ${FONT_MONO}`;
    ctx.fillText(STR.upgrades.level(k), cx + 6, y + 13);
    if (owned) { ctx.fillStyle = accent; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'right'; ctx.fillText('✓', cx + cw - 6, y + 13); }
    // значение уровня (результат)
    ctx.textAlign = 'left'; ctx.fillStyle = owned ? PAL.chalk : next ? PAL.chalk : PAL.ash; ctx.font = `bold 10px ${FONT_MONO}`;
    ctx.fillText(tr.fmt(u.trackVal(tr, k)), cx + 6, y + 30);
    // цена (для не-купленных)
    if (!owned) {
      ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'middle';
      let px = cx + 6; const cyc = y + ch - 12;
      for (const rk of Object.keys(cost)) {
        paintResource(ctx, rk, px + 4, cyc, 4, 7);
        ctx.fillStyle = locked ? PAL.ash : (u.bank[rk] || 0) >= cost[rk] ? RESOURCE_DEFS[rk].color : PAL.bloodBright;
        ctx.textAlign = 'left'; ctx.fillText(`${cost[rk]}`, px + 11, cyc + 1);
        px += 11 + ctx.measureText(`${cost[rk]}`).width + 6;
      }
      ctx.textBaseline = 'alphabetic';
    }
    // заполнение при удержании покупки (ПРОБЕЛ/ЛКМ) — растёт СЛЕВА НАПРАВО
    if (next && afford && u.holdId === tr.id) {
      const frac = u.holdFrac(), fw = cw * frac;
      ctx.save(); ctx.beginPath(); ctx.rect(cx, y, cw, ch); ctx.clip();
      const gfill = ctx.createLinearGradient(cx, y, cx + cw, y);
      gfill.addColorStop(0, accent); gfill.addColorStop(1, PAL.goldBright);
      ctx.globalAlpha = 0.5; ctx.fillStyle = gfill; ctx.fillRect(cx, y, fw, ch);
      ctx.globalAlpha = 1; ctx.strokeStyle = PAL.chalk; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx + fw, y); ctx.lineTo(cx + fw, y + ch); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = PAL.goldBright; ctx.lineWidth = 2.4; ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, ch - 1);
    }
    // вспышка-подтверждение покупки: купленная карточка коротко вспыхивает свечением
    if (u.buyFlash && u.buyFlash.id === tr.id && u.buyFlash.level === k) {
      const p = (performance.now() - u.buyFlash.t0) / 420;   // длительность вспышки
      if (p >= 1) u.buyFlash = null;
      else {
        const a = 1 - p;
        ctx.save();
        ctx.globalAlpha = 0.5 * a; ctx.fillStyle = PAL.goldBright; ctx.fillRect(cx, y, cw, ch);
        ctx.globalAlpha = a; ctx.shadowColor = PAL.goldBright; ctx.shadowBlur = 16 * a;
        ctx.strokeStyle = PAL.goldBright; ctx.lineWidth = 2.5;
        const g = 3 * (1 - a);                                  // лёгкий «pop» наружу
        ctx.strokeRect(cx - g + 0.5, y - g + 0.5, cw + 2 * g - 1, ch + 2 * g - 1);
        ctx.restore();
      }
    }
    // hit-rect карточки (клик = выбор; покупаемая → удержание)
    u.buttons.push({ x: cx, y: y, w: cw, h: ch, trackId: tr.id, level: k, next, buyable: next && afford });
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
