'use strict';

// Виджет ФАЙРВОЛЛА (HUD) — оборона базы от взломщиков. Три сегмента «ацтек-кибер-лабиринта»: чистый файрволл
// рисуется кобальтом (системная защита), а ВЗЛОМ заражает его снизу вверх токсично-зелёной коррупцией (вайб
// хакерской атаки Ангела из Evangelion: ползущее заражение по схемным дорожкам + мерцающий фронт). Заполнились
// все три → пробой (красный). Виден под капсулой гибернации, только при атаке (`firewall.visible()`).
// Перф: только штрихи/клипы, БЕЗ filter/shadowBlur/офскринов. Гейт/позиция — `game.drawScene`.
function drawFirewall(ctx, fw, W, t) {
  const segs = FIREWALL_SEGMENTS, ww = 360, hh = 70, x = 210, y = 56;
  const alarm = 0.5 + 0.5 * Math.abs(Math.sin(t * 5)), br = fw.breached;
  ctx.save();
  ctx.fillStyle = 'rgba(13,10,14,0.9)'; ctx.fillRect(x, y, ww, hh);
  ctx.strokeStyle = br ? '#ff3a22' : `rgba(200,226,90,${0.45 + 0.45 * alarm})`; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, ww - 1, hh - 1);
  ctx.font = `8px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = br ? '#ff5038' : '#c8e25a';
  ctx.fillText(br ? '// ФАЙРВОЛЛ ПРОБИТ' : '// ВЗЛОМ ФАЙРВОЛЛА', x + 10, y + 7);
  ctx.textAlign = 'right'; ctx.fillStyle = '#8fae5a';
  ctx.fillText('взломщиков: ' + fw.active, x + ww - 10, y + 7);
  const pad = 10, gap = 8, cellW = (ww - pad * 2 - gap * (segs - 1)) / segs, cellH = hh - 32, cyT = y + 24;
  for (let i = 0; i < segs; i++) drawMazeCell(ctx, x + pad + i * (cellW + gap), cyT, cellW, cellH, Math.max(0, Math.min(1, fw.hack - i)), t, i, br);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// Дорожка ацтек-лабиринта как ОДНА непрерывная полилиния: внешнее кольцо (с верх-центра по часовой) →
// перемычка внутрь → след. кольцо → … → ядро. По ней «ползёт» заражение (а не заливка снизу).
function _mazePath(x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2, step = Math.min(w, h) * 0.16, pts = [];
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const ix = x + 3 + k * step, iy = y + 3 + k * step, iw = w - 2 * (3 + k * step), ih = h - 2 * (3 + k * step);
    if (iw <= 5 || ih <= 5) break;
    rings.push({ ix, iy, iw, ih });
  }
  for (let k = 0; k < rings.length; k++) {
    const r = rings[k], tcx = r.ix + r.iw / 2, top = r.iy;
    pts.push({ x: tcx, y: top }, { x: r.ix + r.iw, y: top }, { x: r.ix + r.iw, y: r.iy + r.ih },
      { x: r.ix, y: r.iy + r.ih }, { x: r.ix, y: top }, { x: tcx, y: top });   // периметр кольца по часовой
    if (k < rings.length - 1) pts.push({ x: tcx, y: top + step });             // перемычка к след. кольцу
  }
  pts.push({ x: cx, y: cy });                                                   // ядро
  return pts;
}

// Один сегмент: ацтек-лабиринт (концентрические уступы + ядро). Чистый = кобальт; заражение ПОЛЗЁТ ПО ДОРОЖКЕ
// лабиринта (внешнее кольцо → внутрь → ядро) на долю fill, с мерцающим фронтом-точкой (вайб Eva-хака).
function drawMazeCell(ctx, x, y, w, h, fill, t, seed, breached) {
  ctx.fillStyle = 'rgba(6,10,9,0.95)'; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, step = Math.min(w, h) * 0.16;
  ctx.strokeStyle = 'rgba(58,126,200,0.55)'; ctx.fillStyle = 'rgba(58,126,200,0.55)'; ctx.lineWidth = 1;   // чистый файрволл (кобальт)
  for (let k = 0; k < 3; k++) {
    const ix = x + 3 + k * step, iy = y + 3 + k * step, iw = w - 2 * (3 + k * step), ih = h - 2 * (3 + k * step);
    if (iw <= 5 || ih <= 5) break;
    ctx.strokeRect(ix, iy, iw, ih);
    ctx.beginPath(); ctx.moveTo(cx, iy); ctx.lineTo(cx, iy + 3.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, cy); ctx.lineTo(ix + 3.2, cy); ctx.stroke();
  }
  ctx.fillRect(cx - 2, cy - 2, 4, 4);                                            // ядро-глиф
  if (fill <= 0) return;
  // КОРРУПЦИЯ ползёт по дорожке лабиринта (полилиния) на долю fill — токсично-зелёным (пробой — красным)
  const path = _mazePath(x, y, w, h);
  let total = 0; const seg = [];
  for (let i = 1; i < path.length; i++) { const L = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); seg.push(L); total += L; }
  const target = fill * total;
  ctx.strokeStyle = breached ? '#ff5038' : '#c8ff5a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
  let acc = 0, fx = path[0].x, fy = path[0].y;
  for (let i = 1; i < path.length; i++) {
    const L = seg[i - 1];
    if (acc + L <= target) { ctx.lineTo(path[i].x, path[i].y); acc += L; fx = path[i].x; fy = path[i].y; }
    else { const f = L > 0 ? (target - acc) / L : 0; fx = path[i - 1].x + (path[i].x - path[i - 1].x) * f; fy = path[i - 1].y + (path[i].y - path[i - 1].y) * f; ctx.lineTo(fx, fy); break; }
  }
  ctx.stroke();
  if (fill < 1) {   // мерцающий фронт заражения — точка-«голова» ползущей коррупции
    ctx.save(); ctx.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(t * 18 + seed * 2));
    ctx.fillStyle = '#e8ff7a'; ctx.beginPath(); ctx.arc(fx, fy, 2.3, 0, 6.283); ctx.fill(); ctx.restore();
  } else { ctx.fillStyle = breached ? '#ff5038' : '#c8ff5a'; ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5); }   // ядро заражено
}
