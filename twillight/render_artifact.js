'use strict';

// Рендер артефактов (artifact.js / world.genArtifacts): объект-реликт в породе + модалка выбора.
// ⚠️ перф: без ctx.filter/shadowBlur (радиальные градиенты/пути — ОК). Объект — ПОД туманом (часть мира).
const ART_ACCENT = '#4fd6d0';   // бирюза-реликт: отлично от ресурсов/структур/города/данных

// Объект в породе. ВИДИМОСТЬ зависит от ОТКОПКИ: погребённый (тайлы ещё порода) — тусклый «залегающий»
// корпус БЕЗ сияния (намёк, что в породе что-то есть); по мере откопки ярче; ПОЛНОСТЬЮ выкопан → активное
// бирюзовое сияние + пульс ядра (готов к решению). Виден, где раскрыт туман.
function drawArtifacts(ctx, world, camera) {
  if (!world.artifacts || !world.artifacts.length) return;
  const tt = performance.now() / 1000;
  for (const a of world.artifacts) {
    if (a.resolved) continue;
    let seen = false, air = 0, n = a.w * a.h;
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) {
      if (world.isSeen(a.tx + dx, a.ty + dy)) seen = true;
      if (world.tileAt(wrapX(a.tx + dx), a.ty + dy).type === AIR) air++;
    }
    if (!seen) continue;
    const exc = air / n;                                               // доля откопки 0..1 (1 = полностью выкопан = «активен»)
    const sx = camera.screenX((a.tx + a.w / 2) * TILE), sy = (a.ty + a.h / 2) * TILE - camera.y;
    const w = a.w * TILE, h = a.h * TILE, pad = 5, pulse = 0.5 + 0.5 * Math.sin(tt * 2);
    ctx.save();
    if (exc > 0.001) {                                                 // сияние ТОЛЬКО по мере откопки (погребённый не светит)
      const gi = exc * (0.10 + 0.12 * pulse), g = ctx.createRadialGradient(sx, sy, 2, sx, sy, w * 0.75);
      g.addColorStop(0, 'rgba(79,214,208,' + gi.toFixed(3) + ')'); g.addColorStop(1, 'rgba(79,214,208,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, w * 0.75, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.4 + 0.6 * exc;                                 // погребённый — тусклее, выкопанный — в полную силу
    const x0 = sx - w / 2 + pad, y0 = sy - h / 2 + pad, ww = w - pad * 2, hh = h - pad * 2, r = 6;
    _artRoundRect(ctx, x0, y0, ww, hh, r);
    ctx.fillStyle = '#15201f'; ctx.fill();
    ctx.strokeStyle = ART_ACCENT; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(79,214,208,0.32)'; ctx.lineWidth = 1;     // гравировка-рёбра
    for (let i = 1; i <= 2; i++) { const yy = y0 + hh * i / 3; ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + ww - 4, yy); ctx.stroke(); }
    const cr = Math.min(ww, hh) * 0.17, cp = exc >= 1 ? (0.5 + 0.4 * pulse) : 0.4;   // пульс ядра только когда выкопан
    ctx.fillStyle = 'rgba(170,247,242,' + cp.toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(sx, sy - cr); ctx.lineTo(sx + cr, sy); ctx.lineTo(sx, sy + cr); ctx.lineTo(sx - cr, sy); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

// ЩИТ ГОРОДА (артефакт city_shield) — купол-полусфера над базой (центр — принтер). Яркость ∝ заряд щита + вспышка
// на попадании. ПОВЕРХ мира (виден над базой). ⚠️ перф: 'lighter', без ctx.filter/shadowBlur.
function drawCityShield(ctx, game, camera) {
  const c = game.city; if (!c || c.shieldMax <= 0 || c.shield <= 0) return;
  const cx = Math.round(camera.screenX(wrapPx((PRINTER.x + PRINTER.w / 2) * TILE)));
  const cy = Math.round(CAVE_FLOOR_Y * TILE - camera.y);
  const R = TILE * 6, f = c.shield / c.shieldMax, flash = c._shieldFlash > 0 ? c._shieldFlash / 0.25 : 0;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.1 * f + 0.16 * flash;                     // лёгкая заливка купола
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fillStyle = '#5fd0e0'; ctx.fill();
  ctx.globalAlpha = 0.32 * f + 0.6 * flash;                     // ободок купола
  ctx.strokeStyle = '#7fe0ee'; ctx.lineWidth = 2 + 2 * flash;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.restore();
}

// ФОРСАЖ БУРА (реликт drill_overdrive): термометр нагрева над юнитом. Холодный — скрыт; греется — зелёный→янтарь→жар;
// перегрев — красный МИГАЮЩИЙ бар остатка охлаждения (лок). Перф: только fillRect/strokeRect, без filter/shadow.
function drawDrillHeat(ctx, game, camera) {
  const u = game.unit, s = u && u.stats; if (!s || !s.drillOverdrive) return;
  const over = u.drillOverheatT > 0;
  if (!over && u.drillHeat <= 0.02) return;                       // холодный покой → не загромождаем экран
  const w = Math.round(TILE * 1.7), h = 4;
  const x = Math.round(camera.screenX(u.px)) - w / 2, y = Math.round(u.py - camera.y) - Math.round(TILE * 1.5);
  ctx.fillStyle = 'rgba(8,10,14,0.72)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);   // фон-плита
  if (over) {
    const blink = 0.55 + 0.45 * Math.sin(performance.now() / 1000 * 14);
    const frac = Math.max(0, u.drillOverheatT / OVERDRIVE_CD);
    ctx.globalAlpha = blink; ctx.fillStyle = '#ff4030'; ctx.fillRect(x, y, Math.round(w * frac), h); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff4030'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  } else {
    const heat = Math.max(0, Math.min(1, u.drillHeat));
    ctx.fillStyle = heat > 0.85 ? '#ff7a3a' : heat > 0.6 ? '#f0c84a' : PAL.screwGreen;
    ctx.fillRect(x, y, Math.round(w * heat), h);
    ctx.strokeStyle = 'rgba(180,200,210,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
    if (heat > 0.8) { ctx.fillStyle = '#ff4030'; ctx.fillRect(x + w - 2, y - 1, 2, h + 2); }   // красная риска «у предела»
  }
}

// РЫВОК (реликт drive_dash): стрики-послесвечение позади юнита, пока game.unit.dashing. Перф: 'lighter', только fillRect.
function drawDashFx(ctx, game, camera) {
  const u = game.unit; if (!u || !u.dashing) return;
  const ux = Math.round(camera.screenX(u.px)), uy = Math.round(u.py - camera.y);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#7fd0e0';
  for (let i = 1; i <= 4; i++) {
    ctx.globalAlpha = 0.26 / i;
    const off = -u.dashDir * i * TILE * 0.55;
    ctx.fillRect(ux + off - TILE * 0.28, uy - TILE * 0.34, TILE * 0.56, TILE * 0.68);
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// ГАРПУН (реликт harpoon): трос юнит→якорь, пока game.harpoon.t>0. Зацеп — натянутый трос + крюк; холостой — гаснущий пунктир. Перф: только line/arc.
function drawHarpoonFx(ctx, game, camera) {
  const h = game.harpoon, u = game.unit; if (!h || h.t <= 0 || !u || h.ax == null) return;
  const ux = Math.round(camera.screenX(u.px)), uy = Math.round(u.py - camera.y);
  const ax = Math.round(camera.screenX(h.ax)), ay = Math.round((h.ay != null ? h.ay : u.py) - camera.y);
  const f = h.t / HARPOON_FX_TIME;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = h.dry ? 'rgba(224,176,112,0.5)' : '#e0b070';
  ctx.lineWidth = h.dry ? 1 : 2; ctx.globalAlpha = h.dry ? f * 0.7 : 0.85;
  ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ax, ay); ctx.stroke();
  if (!h.dry) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#f0c890'; ctx.beginPath(); ctx.arc(ax, ay, 3, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.restore();
}

function _artRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// Простой перенос строки по словам.
function _artWrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// Модалка выбора (mode 'artifact'): затемнение + панель + N карт (техно из a._offer + данные + переработка) + кнопка
// ПОВТОРНЫЙ АНАЛИЗ (узел kart_reroll). Техно-карта показывает СЛОТ и ЗАНЯТОСТЬ (used/cap, цвет по свободе). Подсветка
// game.artifactSel. Hit-rect'ы: game._artifactRects (карты) + game._artifactRerollRect (кнопка) — ЛКМ в artifact.js.
function drawArtifactModal(ctx, game, W, H) {
  const a = game.pendingArtifact; if (!a) return;
  const offer = a._offer || [a.tech];
  ctx.save();
  ctx.fillStyle = 'rgba(8,7,6,0.74)'; ctx.fillRect(0, 0, W, H);
  // карты: техно×N (из offer) · ДАННЫЕ · ПЕРЕРАБОТКА
  const choices = offer.map((def) => {
    const used = game._artifactSlotUsed(def.slot), cap = game._artifactSlotCap(def.slot);
    return { label: STR.world.artifact.tech.label, sub: def.name, desc: def.desc, accent: ART_ACCENT, icon: 'tech', slot: def.slot, used, cap, locked: used >= cap };
  });
  choices.push({ label: STR.world.artifact.data.label, sub: STR.world.artifact.data.sub, desc: STR.world.artifact.data.desc, accent: PAL.cobalt, icon: 'data' });
  choices.push({ label: STR.world.artifact.scrap.label, sub: STR.world.artifact.scrap.sub, desc: STR.world.artifact.scrap.desc, accent: PAL.toxic, icon: 'scrap' });
  game._artifactChoiceCount = choices.length;   // game.js читает для навигации ← →

  const N = choices.length, gap = 20, canReroll = typeof metaHas === 'function' && metaHas('kart_reroll');
  const pw = Math.min(W - 40, N * 218 + (N - 1) * gap + 44), ph = canReroll ? 424 : 380;   // ширина адаптивна к числу карт, клампится к экрану
  const px = (W - pw) / 2, py = (H - ph) / 2;
  const cy = (typeof techPanel === 'function') ? techPanel(ctx, px, py, pw, ph, { accent: ART_ACCENT, label: STR.world.artifact.tag, serial: 'RELIC' }) : py + 30;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.chalk; ctx.font = `700 26px ${FONT_DISPLAY}`;
  ctx.fillText(STR.world.artifact.prompt, W / 2, cy + 24);
  ctx.fillStyle = PAL.ash; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.world.artifact.hint + (canReroll ? '  ·  ' + STR.world.artifact.reroll.hint : ''), W / 2, cy + 42);

  const cardW = (pw - 44 - gap * (N - 1)) / N, cardH = 210, cardY = cy + 62, x0 = px + 22;
  const rects = [], GRN = PAL.toxic, RED = PAL.rust;
  for (let i = 0; i < N; i++) {
    const c = choices[i], cx = x0 + i * (cardW + gap), sel = game.artifactSel === i;
    rects.push({ x: cx, y: cardY, w: cardW, h: cardH });
    ctx.save();
    const anim = game._artChoose;
    if (anim) {   // АНИМАЦИЯ ВЫБОРА (после клика/Enter): невыбранные сворачиваются в точку центра модалки + гаснут, выбранная разгорается
      const p = Math.min(1, anim.t / anim.dur), e = p * p * (3 - 2 * p), ccx = cx + cardW / 2, ccy = cardY + cardH / 2;
      if (i === anim.idx) { const gl = 1 + 0.05 * Math.sin(anim.t * 22); ctx.translate(ccx, ccy); ctx.scale(gl, gl); ctx.translate(-ccx, -ccy); }
      else { const s = Math.max(0.001, 1 - e); ctx.translate(ccx + (W / 2 - ccx) * e, ccy); ctx.scale(s, s); ctx.translate(-ccx, -ccy); ctx.globalAlpha = 1 - e; }
    }
    if (c.locked) ctx.globalAlpha *= 0.4;                         // слот занят — карта приглушена (выбор недоступен)
    _artRoundRect(ctx, cx, cardY, cardW, cardH, 8);
    ctx.fillStyle = sel ? 'rgba(255,255,255,0.05)' : 'rgba(13,12,10,0.6)'; ctx.fill();
    ctx.strokeStyle = sel && !c.locked ? c.accent : 'rgba(122,112,94,0.6)'; ctx.lineWidth = sel && !c.locked ? 2.5 : 1.2; ctx.stroke();
    _artIcon(ctx, c.icon, cx + cardW / 2, cardY + 42, c.accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = sel ? PAL.chalk : PAL.bone; ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillText(c.label, cx + cardW / 2, cardY + 88);
    ctx.fillStyle = c.accent; ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText(c.sub, cx + cardW / 2, cardY + 106);
    // СЛОТ + ЗАНЯТОСТЬ (задача 1): «СЛОТ · ТИП · used/cap» + СВОБОДЕН/ЗАНЯТ (цвет по свободе). Учитывает узлы-слоты (cap=2).
    if (c.slot) {
      ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`;
      ctx.fillText(STR.artifact.slotUse(STR.artifact.slot[c.slot], c.used, c.cap), cx + cardW / 2, cardY + 121);
      ctx.fillStyle = c.locked ? RED : GRN; ctx.font = `bold 9px ${FONT_MONO}`;
      ctx.fillText(c.locked ? STR.artifact.slotFull : STR.artifact.slotFree, cx + cardW / 2, cardY + 133);
    }
    ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`; ctx.textAlign = 'left';
    const lines = _artWrap(ctx, c.desc, cardW - 26);
    lines.forEach((ln, k) => ctx.fillText(ln, cx + 13, cardY + (c.slot ? 150 : 140) + k * 15));
    ctx.textAlign = 'center';
    if (!c.locked && sel) { ctx.fillStyle = c.accent; ctx.font = `bold 10px ${FONT_MONO}`; ctx.fillText('▸ ' + STR.world.artifact.select, cx + cardW / 2, cardY + cardH - 12); }
    if (anim && i === anim.idx) {   // ВЫБРАННАЯ разгорается — аддитивный акцент-глоу поверх, ярче к концу анимации
      const p = Math.min(1, anim.t / anim.dur);
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12 + 0.4 * p; ctx.fillStyle = c.accent;
      _artRoundRect(ctx, cx, cardY, cardW, cardH, 8); ctx.fill();
    }
    ctx.restore();
  }
  game._artifactRects = rects;

  // ── КНОПКА «ПОВТОРНЫЙ АНАЛИЗ» (узел kart_reroll): сменить предложенные техно за кристаллы, N сбросов за забег ──
  game._artifactRerollRect = null;
  if (canReroll) {
    const left = game.artifactRerollsLeft(), crystals = (game.inventory && game.inventory.cargo.crystal) || 0, can = game.artifactCanReroll();
    const bw = Math.min(320, pw - 44), bh = 34, bx = W / 2 - bw / 2, by = cardY + cardH + 16;
    game._artifactRerollRect = { x: bx, y: by, w: bw, h: bh };
    ctx.save();
    if (!can) ctx.globalAlpha = 0.5;
    _artRoundRect(ctx, bx, by, bw, bh, 6);
    ctx.fillStyle = 'rgba(13,12,10,0.7)'; ctx.fill();
    ctx.strokeStyle = can ? ART_ACCENT : 'rgba(122,112,94,0.6)'; ctx.lineWidth = can ? 2 : 1.2; ctx.stroke();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = can ? PAL.chalk : PAL.pewter; ctx.font = `bold 12px ${FONT_MONO}`;
    ctx.fillText('⟲ ' + STR.world.artifact.reroll.label, bx + 14, by + bh / 2);
    let status, scol;
    if (left <= 0) { status = STR.world.artifact.reroll.none; scol = RED; }
    else if (crystals < ARTIFACT_REROLL_COST) { status = STR.world.artifact.reroll.poor(ARTIFACT_REROLL_COST); scol = RED; }
    else { status = STR.world.artifact.reroll.cost(ARTIFACT_REROLL_COST) + '  ·  ' + STR.world.artifact.reroll.left(left); scol = ART_ACCENT; }
    ctx.textAlign = 'right'; ctx.fillStyle = scol; ctx.font = `10px ${FONT_MONO}`;
    ctx.fillText(status, bx + bw - 14, by + bh / 2);
    ctx.restore();
  }
  ctx.restore();
}

function _artIcon(ctx, kind, cx, cy, accent) {
  ctx.save(); ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (kind === 'tech') {                       // чип: квадрат + ножки
    ctx.strokeRect(cx - 11, cy - 11, 22, 22);
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    for (const s of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(cx + s, cy - 11); ctx.lineTo(cx + s, cy - 16); ctx.moveTo(cx + s, cy + 11); ctx.lineTo(cx + s, cy + 16); ctx.moveTo(cx - 11, cy + s); ctx.lineTo(cx - 16, cy + s); ctx.moveTo(cx + 11, cy + s); ctx.lineTo(cx + 16, cy + s); ctx.stroke(); }
  } else if (kind === 'data') {                 // диск данных: круг + дуга-сектор
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 9, -1.0, 0.6); ctx.stroke();
  } else {                                      // переработка: три стрелки по кругу
    for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; ctx.beginPath(); ctx.arc(cx, cy, 11, a + 0.25, a + 1.7); ctx.stroke(); const ex = cx + Math.cos(a + 1.7) * 11, ey = cy + Math.sin(a + 1.7) * 11; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 5, ey - 1); ctx.moveTo(ex, ey); ctx.lineTo(ex - 1, ey - 5); ctx.stroke(); }
  }
  ctx.restore();
}
