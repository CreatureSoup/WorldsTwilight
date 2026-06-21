'use strict';

// Экран «СЕТЬ ПАМЯТИ» (мета-прогресс) — радиальное дерево по дизайну Tech Tree Web Standalone.
// Данные/логика — meta.js, режим/ввод — game.js ('progress'). Чистый рендер + хелперы раскладки.

// Раскладка: ЯДРО в центре, узлы по углу ветки (depth — кольцо, lane — поперечный фан).
function metaLayout(W, H) {
  const cx = W * 0.5, cy = H * 0.45, CORE_R = 44, STEP = 38, LANE = 32;
  const pos = { core: { x: cx, y: cy, core: true } };
  for (const n of META_NODES) {
    const br = META_BRANCH_BY_ID[n.b], a = br.angle * Math.PI / 180;
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const r = CORE_R + n.depth * STEP, off = n.lane * LANE;
    pos[n.id] = { x: cx + ux * r + vx * off, y: cy + uy * r + vy * off, node: n, br };
  }
  return { cx, cy, CORE_R, pos };
}

// Узел под курсором (для ховера/клика). Возвращает id или null.
function metaNodeAt(game, x, y) {
  const L = metaLayout(game.designW, game.designH);
  for (const n of META_NODES) {
    const p = L.pos[n.id], r = n.depth === 1 ? 16 : 13;
    if (Math.abs(x - p.x) + Math.abs(y - p.y) <= r + 4) return n.id;   // ромб → манхэттен
  }
  return null;
}

function _diamond(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }

// Минималистичные глифы веток (в корневом узле/ядре).
function _metaGlyph(ctx, kind, x, y, s, col) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.3; ctx.lineJoin = 'round';
  if (kind === 'gear') { ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 6.283); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.5, y + Math.sin(a) * s * 0.5); ctx.lineTo(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8); ctx.stroke(); } }
  else if (kind === 'print') { ctx.strokeRect(x - s * 0.55, y - s * 0.2, s * 1.1, s * 0.55); ctx.strokeRect(x - s * 0.32, y - s * 0.6, s * 0.64, s * 0.4); for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.25, y + s * 0.45); ctx.lineTo(x + i * s * 0.25, y + s * 0.7); ctx.stroke(); } }
  else if (kind === 'link') { ctx.beginPath(); ctx.arc(x - s * 0.35, y, s * 0.38, 0, 6.283); ctx.arc(x + s * 0.35, y, s * 0.38, 0, 6.283); ctx.stroke(); }
  else if (kind === 'scan') { for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(x, y + s * 0.4, s * 0.3 * i, -2.4, -0.74); ctx.stroke(); } }
  else if (kind === 'lock') { ctx.strokeRect(x - s * 0.5, y - s * 0.1, s, s * 0.7); ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.32, Math.PI, 0); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, 6.283); ctx.stroke(); }   // core fallback
}

function drawMeta(ctx, game, W, H) {
  const save = game.save, L = metaLayout(W, H);
  if (typeof drawStaticBg === 'function') drawStaticBg(ctx, W, H); else { ctx.fillStyle = PAL.void; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(7,5,10,0.55)'; ctx.fillRect(0, 0, W, H);   // притемнить под дерево
  if (typeof hazardTape === 'function') hazardTape(ctx, 0, 0, W, 5, PAL.goldDim);

  // ── шапка ──
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText('// СЕТЬ ПАМЯТИ · МЕТА', 16, 24);
  ctx.font = `800 22px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.chalk; ctx.fillText('СЕТЬ ПАМЯТИ', 16, 47);
  // баланс токенов (справа)
  const bw = 196, bx = W - 16 - bw, by = 14, bh = 42;
  ctx.fillStyle = 'rgba(20,16,10,0.85)'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = PAL.goldDim; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  _diamond(ctx, bx + 24, by + bh / 2, 12); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1.4; ctx.stroke();
  _metaGlyph(ctx, 'core', bx + 24, by + bh / 2, 9, PAL.goldBright);
  ctx.textAlign = 'left'; ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.fillText('БАНК · ' + META_NAME, bx + 44, by + 16);
  ctx.font = `800 22px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.goldBright; ctx.fillText(`${save.meta || 0}`, bx + 44, by + 36);
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText(META_ABBR, bx + 44 + ctx.measureText(`${save.meta || 0}`).width * 1.0 + 44, by + 36);

  // ── рёбра (под узлами) ──
  for (const n of META_NODES) {
    const p = L.pos[n.id], par = L.pos[n.parent || 'core'];
    const st = metaState(save, n), ac = L.pos[n.id].br.accent;
    ctx.strokeStyle = st === 'powered' ? PAL[ac] : st === 'available' ? (PAL[ac + 'Dim'] || 'rgba(120,110,95,0.5)') : 'rgba(70,64,56,0.35)';
    ctx.lineWidth = st === 'powered' ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(par.x, par.y); ctx.lineTo(p.x, p.y); ctx.stroke();
  }

  // ── ЯДРО ──
  const cpos = L.pos.core, hov = game.menuMouse && metaNodeAt(game, game.menuMouse.x, game.menuMouse.y);
  ctx.save(); ctx.shadowColor = PAL.gold; ctx.shadowBlur = 16;
  _diamond(ctx, cpos.x, cpos.y, 24); ctx.fillStyle = 'rgba(40,30,12,0.9)'; ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  _metaGlyph(ctx, 'gear', cpos.x, cpos.y, 14, PAL.goldBright);

  // ── узлы ──
  for (const n of META_NODES) {
    const p = L.pos[n.id], st = metaState(save, n), root = n.depth === 1, r = root ? 16 : 13;
    const ac = PAL[p.br.accent], acB = PAL[p.br.accent + 'Bright'] || ac;
    const isHov = hov === n.id, buy = metaCanBuy(save, n);
    if (st === 'powered') {
      ctx.save(); ctx.shadowColor = ac; ctx.shadowBlur = isHov ? 14 : 8;
      _diamond(ctx, p.x, p.y, r); ctx.fillStyle = ac; ctx.fill();
      ctx.strokeStyle = acB; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      _metaGlyph(ctx, root ? p.br.icon : 'core', p.x, p.y, root ? 12 : 7, PAL.void);
    } else if (st === 'available') {
      _diamond(ctx, p.x, p.y, r); ctx.fillStyle = 'rgba(18,14,12,0.9)'; ctx.fill();
      ctx.strokeStyle = buy ? acB : ac; ctx.lineWidth = isHov ? 2.2 : 1.6; ctx.stroke();
      if (buy) { ctx.save(); const pl = 0.5 + 0.5 * Math.sin(performance.now() / 220); ctx.globalAlpha = 0.35 + 0.45 * pl; _diamond(ctx, p.x, p.y, r + 3 + pl * 2); ctx.strokeStyle = acB; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
      _metaGlyph(ctx, root ? p.br.icon : 'core', p.x, p.y, root ? 11 : 6, buy ? acB : ac);
      ctx.fillStyle = buy ? acB : PAL.pewter; ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'center';
      ctx.fillText(`${n.cost}`, p.x, p.y + r + 11);
    } else {
      _diamond(ctx, p.x, p.y, r); ctx.fillStyle = 'rgba(14,12,12,0.8)'; ctx.fill();
      ctx.strokeStyle = 'rgba(90,80,70,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(120,110,98,0.7)'; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.fillText('?', p.x, p.y + 3);
    }
  }

  // ── прогресс «запитано» + легенда: ПОД токен-панелью (справа вверху) ──
  const powered = metaPoweredCount(save);
  const px = W - 16 - 196, py = 74;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.fillText(`ЗАПИТАНО  ${powered} / ${META_TOTAL}`, px, py);
  ctx.fillStyle = 'rgba(60,54,46,0.6)'; ctx.fillRect(px, py + 6, 196, 4);
  ctx.fillStyle = PAL.gold; ctx.fillRect(px, py + 6, 196 * powered / META_TOTAL, 4);
  const lg = [['ЗАПИТАН', PAL.gold, 1], ['ДОСТУПЕН', PAL.gold, 0], ['СКРЫТ', 'rgba(120,110,98,0.7)', 0]];
  let lx = px; ctx.font = `7px ${FONT_MONO}`; ctx.textBaseline = 'middle';
  for (const [lab, c, fill] of lg) { _diamond(ctx, lx + 4, py + 22, 4); if (fill) { ctx.fillStyle = c; ctx.fill(); } else { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.stroke(); } ctx.fillStyle = PAL.pewter; ctx.textAlign = 'left'; ctx.fillText(lab, lx + 12, py + 23); lx += 14 + ctx.measureText(lab).width + 10; }
  ctx.textBaseline = 'alphabetic';

  // ── деталь наведённого/выбранного узла: нижняя панель (слева) ──
  const detId = hov || game.metaSel, det = detId && META_BY_ID[detId];
  if (det) {
    const st = metaState(save, det), ac = PAL[META_BRANCH_BY_ID[det.b].accent], acB = PAL[META_BRANCH_BY_ID[det.b].accent + 'Bright'] || ac;
    const dx = 16, dyb = H - 92, dw = Math.min(388, W - 150), dh = 78;
    ctx.fillStyle = 'rgba(16,12,16,0.94)'; ctx.fillRect(dx, dyb, dw, dh);
    ctx.strokeStyle = ac; ctx.lineWidth = 1; ctx.strokeRect(dx + 0.5, dyb + 0.5, dw - 1, dh - 1);
    ctx.fillStyle = ac; ctx.fillRect(dx, dyb, 4, dh);
    ctx.textAlign = 'left';
    ctx.fillStyle = PAL.pewter; ctx.font = `8px ${FONT_MONO}`; ctx.fillText('// ' + META_BRANCH_BY_ID[det.b].name, dx + 14, dyb + 16);
    ctx.fillStyle = PAL.chalk; ctx.font = `700 14px ${FONT_DISPLAY}`; ctx.fillText(det.t.toUpperCase(), dx + 14, dyb + 35);
    ctx.fillStyle = PAL.bone; ctx.font = `11px ${FONT_BODY}`; wrapText(ctx, det.d, dx + 14, dyb + 52, dw - 96, 13);
    ctx.textAlign = 'right';
    if (st === 'powered') { ctx.fillStyle = PAL.toxic; ctx.font = `9px ${FONT_MONO}`; ctx.fillText('● ЗАПИТАН', dx + dw - 12, dyb + 18); }
    else if (st === 'available') { const ok = (save.meta || 0) >= det.cost; ctx.fillStyle = ok ? acB : PAL.bloodBright; ctx.font = `800 20px ${FONT_DISPLAY}`; ctx.fillText(`${det.cost}`, dx + dw - 26, dyb + 30); ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText(META_ABBR, dx + dw - 12, dyb + 30); ctx.fillStyle = ok ? PAL.toxic : PAL.bloodBright; ctx.fillText(ok ? 'ЛКМ · ЗАПИТАТЬ' : 'НЕ ХВАТАЕТ МТ', dx + dw - 12, dyb + 64); }
    else { ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`; ctx.fillText('ЗАКРЫТ — открой предка', dx + dw - 12, dyb + 18); }
    ctx.textAlign = 'left';
  }
  // подсказка выхода — низ справа
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('ESC · НАЗАД', W - 16, H - 16);
  ctx.textAlign = 'left';
}
