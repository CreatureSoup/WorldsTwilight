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

// Один сегмент: ацтек-лабиринт (концентрические уступы + ядро). Чистый = кобальт; заражение снизу вверх по доле fill.
function drawMazeCell(ctx, x, y, w, h, fill, t, seed, breached) {
  ctx.fillStyle = 'rgba(6,10,9,0.95)'; ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2, step = Math.min(w, h) * 0.16;
  const maze = (col, lw) => {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
    for (let k = 0; k < 3; k++) {
      const ix = x + 3 + k * step, iy = y + 3 + k * step, iw = w - 2 * (3 + k * step), ih = h - 2 * (3 + k * step);
      if (iw <= 5 || ih <= 5) break;
      ctx.strokeRect(ix, iy, iw, ih);
      ctx.beginPath(); ctx.moveTo(cx, iy); ctx.lineTo(cx, iy + 3.2); ctx.stroke();   // ацтек-перемычки (верх/лево)
      ctx.beginPath(); ctx.moveTo(ix, cy); ctx.lineTo(ix + 3.2, cy); ctx.stroke();
    }
    ctx.fillRect(cx - 2, cy - 2, 4, 4);                                              // ядро-глиф
  };
  maze('rgba(58,126,200,0.55)', 1);                                                 // чистый файрволл (кобальт)
  if (fill > 0) {                                                                   // КОРРУПЦИЯ снизу вверх
    const fy = y + h * (1 - fill);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, fy, w, y + h - fy); ctx.clip();
    maze(breached ? '#ff5038' : '#c8ff5a', 1.4);                                    // заражённые дорожки
    ctx.restore();
    if (fill < 1) {                                                                 // мерцающий фронт заражения (скан-линия)
      ctx.save(); ctx.globalAlpha = 0.45 + 0.5 * Math.abs(Math.sin(t * 18 + seed * 2));
      ctx.strokeStyle = '#e8ff7a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, fy); ctx.lineTo(x + w, fy); ctx.stroke(); ctx.restore();
    }
  }
}
