'use strict';

// Рендер якорных щупалец «Спрута» (логика/риг — sprut.js). Прямая нога: гнездо-крепление → ЗВЕНЬЯ
// `sprut:link` тиражом вдоль луча → ЯКОРЬ-ЛАПА `sprut:claw` на конце. Ключи ГЛОБАЛЬНЫЕ плоские
// (как borer:*/wheel:* — читаем PART_SPRITES напрямую, редактор кладёт их без префикса корпуса).
// Нет ассетов → процедурный фолбэк: двухслойный луч + точки-сочленения + трёхпалая лапа.
// В игре рисуется ПОД кольцом-корпусом в клипе видимого воздуха (game.drawScene, как tentacles).
// ⚠️ перф (spec_render): без ctx.filter/shadowBlur; 'lighter' не используется.

function _sprutEase(q) { return 1 - (1 - q) * (1 - q) * (1 - q); }   // easeOutCubic — выстрел резкий, довод мягкий

// Кончик ноги по состоянию (экранные координаты). hx/hy — гнездо; sax/say — якорь;
// srx/sry — точка отпускания (L.rx/L.ry рига, переведённая в экран); k — масштаб.
// Сложенная поза (folded/probe/шлейф в полёте) — из ВИЗУАЛЬНЫХ полей L.vdir/L.vlen (степпер ведёт их
// лерпом: покачивания idle, шлейф за корпусом, профиль щупа); лапа при хвате/щупе раскрыта.
function _sprutTip(L, hx, hy, sax, say, srx, sry, k) {
  const fx = hx + Math.cos(L.vdir) * L.vlen * k, fy = hy + Math.sin(L.vdir) * L.vlen * k;   // сложенная поза
  if (L.state === 'hold') {
    if (L.slipJ) { const p = Math.atan2(say - hy, sax - hx) + Math.PI / 2; return { x: sax + Math.cos(p) * L.slipJ * k, y: say + Math.sin(p) * L.slipJ * k, open: true }; }   // скребёт нестабильную породу
    return { x: sax, y: say, open: true };
  }
  if (L.state === 'fire') { const q = _sprutEase(Math.min(1, L.t / SPRUT_FIRE_T)); return { x: fx + (sax - fx) * q, y: fy + (say - fy) * q, open: true }; }
  if (L.state === 'retract') { const q = Math.min(1, L.t / SPRUT_RETRACT_T); return { x: srx + (fx - srx) * (q * q), y: sry + (fy - sry) * (q * q), open: false }; }
  return { x: fx, y: fy, open: !!L.vopen };   // folded / probe (щуп раскрывает лапу на зависании)
}

// Одна нога: звенья вдоль луча + лапа на конце + гнездо. Всё в экранных px; k — масштаб спрайтов.
function _sprutLegDraw(ctx, L, hx, hy, tx, ty, open, k) {
  const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy);
  if (d > 0.5) {
    const ang = Math.atan2(dy, dx);
    const spL = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES['sprut:link'];
    if (spL && spL.img) {
      const n = Math.max(1, Math.round(d / (SPRUT_LINK_SPACING * k)));
      for (let i = 0; i < n; i++) {
        const p = (i + 0.5) / n;
        ctx.save(); ctx.translate(hx + dx * p, hy + dy * p); ctx.rotate(ang + (spL.rot ? spL.rot * Math.PI / 180 : 0));
        ctx.drawImage(spL.img, -spL.px * k, -spL.py * k, spL.w * k, spL.h * k);
        ctx.restore();
      }
    } else {   // фолбэк: тёмный луч + светлое ребро + точки-сочленения по шагу звеньев
      ctx.lineCap = 'round';
      ctx.strokeStyle = PAL.carbon; ctx.lineWidth = Math.max(1.5, 4.5 * k);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = Math.max(1, 2 * k);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = PAL.ash;
      const n = Math.max(1, Math.round(d / (SPRUT_LINK_SPACING * k)));
      for (let i = 1; i < n; i++) { const p = i / n; ctx.beginPath(); ctx.arc(hx + dx * p, hy + dy * p, Math.max(1, 1.7 * k), 0, TAU); ctx.fill(); }
    }
    if (L.state === 'fire') {   // вспышка выстрела: яркая сердцевина на миг
      ctx.strokeStyle = 'rgba(242,200,120,0.55)'; ctx.lineWidth = Math.max(1, 1.3 * k);
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
    }
    // лапа-якорь на конце
    const spC = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES['sprut:claw'];
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
    if (spC && spC.img) {
      if (spC.rot) ctx.rotate(spC.rot * Math.PI / 180);
      ctx.drawImage(spC.img, -spC.px * k, -spC.py * k, spC.w * k, spC.h * k);
    } else {   // процедурная трёхпалая лапа: 2 крюка (раскрыты при хвате) + центральный шип
      const spread = open ? 0.62 : 0.2, hl = 6.5 * k;
      ctx.strokeStyle = PAL.bone; ctx.lineWidth = Math.max(1, 1.8 * k); ctx.lineCap = 'round';
      for (const sgn of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(-2 * k, 0);
        ctx.quadraticCurveTo(hl * 0.4, sgn * hl * spread, hl, sgn * hl * spread * 0.55);
        ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-1 * k, 0); ctx.lineTo(hl * 0.85, 0); ctx.stroke();
    }
    ctx.restore();
  }
  // гнездо-крепление (поверх основания звеньев)
  ctx.fillStyle = PAL.carbon; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.6, 2.8 * k), 0, TAU); ctx.fill();
  ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx, hy, Math.max(1.6, 2.8 * k), 0, TAU); ctx.stroke();
}

// Мировой проход (game.drawScene, в клипе видимого воздуха, ПОД drawRingUnit).
function drawSprutLegs(ctx, camera) {
  const rig = (typeof sprutRig === 'function') && sprutRig(); if (!rig) return;
  const bo = rig.off, k = rig.scale;   // подвес + импульс-kick (прыжок/приземление/срыв)
  ctx.save();
  for (const L of rig.legs) {
    const hx = camera.screenX(L.hx) + bo.x, hy = L.hy - camera.y + bo.y;
    const tip = _sprutTip(L, hx, hy, camera.screenX(L.ax), L.ay - camera.y, camera.screenX(L.rx), L.ry - camera.y, k);
    _sprutLegDraw(ctx, L, hx, hy, tip.x, tip.y, tip.open, k);
  }
  ctx.restore();
}

// ПРЕВЬЮ (редактор/сборка): юнит в начале координат текущего трансформа, живой риг из sprut.js.
// chamber — плоскости «камеры» в design-px; рисуем и тонкие линии-подсказки поверхностей (если drawHints).
function drawSprutPreview(ctx, unit, def, key, chamber, drawHints) {
  if (typeof sprutPreviewStep !== 'function') return;
  const rig = sprutPreviewStep(key, unit, def, chamber);
  ctx.save();
  if (drawHints) {   // едва заметные линии опор — якорям есть за что держаться визуально
    ctx.strokeStyle = 'rgba(122,112,94,0.28)'; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
    const X = SPRUT_REACH * TILE;
    if (chamber.floorY != null) { ctx.beginPath(); ctx.moveTo(-X, chamber.floorY); ctx.lineTo(X, chamber.floorY); ctx.stroke(); }
    if (chamber.ceilY != null) { ctx.beginPath(); ctx.moveTo(-X, chamber.ceilY); ctx.lineTo(X, chamber.ceilY); ctx.stroke(); }
    if (chamber.wallL != null) { ctx.beginPath(); ctx.moveTo(chamber.wallL, chamber.ceilY != null ? chamber.ceilY : -X); ctx.lineTo(chamber.wallL, chamber.floorY != null ? chamber.floorY : X); ctx.stroke(); }
    if (chamber.wallR != null) { ctx.beginPath(); ctx.moveTo(chamber.wallR, chamber.ceilY != null ? chamber.ceilY : -X); ctx.lineTo(chamber.wallR, chamber.floorY != null ? chamber.floorY : X); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  const bo = rig.off;
  for (const L of rig.legs) {
    const hx = L.hx + bo.x, hy = L.hy + bo.y;
    const tip = _sprutTip(L, hx, hy, L.ax, L.ay, L.rx, L.ry, 1);
    _sprutLegDraw(ctx, L, hx, hy, tip.x, tip.y, tip.open, 1);
  }
  ctx.restore();
  return rig;
}
