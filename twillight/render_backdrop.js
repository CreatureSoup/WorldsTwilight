'use strict';

// Фон пещер-сцен (логика входа/скана — game.updateBackdrops). Процедурная сцена («космический
// объект»: руины/машина/идол) рисуется ПОВЕРХ тумана, но КЛИПИТСЯ по ВОЗДУХУ пещеры
// (`clipVisibleAir`) и по ЭЛЛИПСУ полости → естественно вписывается в любую форму каверны.
// ПАРАЛАКС: 3 слоя смещаются на разную долю смещения юнита от центра пещеры (ближе слой —
// двигается сильнее). REVEAL (0..1) задаёт объёмный сканер: сцена проявляется по ходу свипа.

function _bdRng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function _bdrr(r, a, b) { return a + (b - a) * r(); }

// растровый ассет «космического объекта» в пещере (грузится через new Image → работает и на file://)
const _bdRobot = new Image(); _bdRobot.src = 'assets/junk/old_robot.png';
function _bdRobotReady() { return _bdRobot.complete && _bdRobot.naturalWidth > 0; }
// вписать ассет в пещеру: ширина ОРИЕНТИРОВАНА на ширину полости (крупно, пропорции сохранены),
// НИЗ — заметно НИЖЕ самой нижней точки пещеры (объект «стоит» на дне, низ срезается полом). Центр
// объекта стэшится в `b._astX/_astY/_astR` — туда целится конус сканера (`render_scan.drawBackdropScan`).
function _bdDrawRobot(ctx, b, sx, sy, hw, hh, offX, rev) {
  const iw = _bdRobot.naturalWidth, ih = _bdRobot.naturalHeight;
  let s = (hw * 2 * 1.35) / iw;                 // крупнее: ширина ~135% ширины пещеры
  const maxH = hh * 2 * 2.2; if (ih * s > maxH) s = maxH / ih;
  const dw = iw * s, dh = ih * s;
  const lx = sx - offX * 0.55 * 0.45;           // паралакс среднего слоя
  const bottomY = sy + hh + TILE * 1.2;         // низ ниже дна пещеры (срезается полом — без пустого тайла)
  const rdx = lx - dw / 2, rdy = bottomY - dh;
  ctx.save(); ctx.globalAlpha = rev; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(_bdRobot, rdx, rdy, dw, dh);
  ctx.restore();
  b._astX = lx; b._astY = bottomY - dh / 2; b._astR = Math.max(dw, dh) * 0.32;   // центр ассета для конуса сканера
  b._astRect = { dx: rdx, dy: rdy, dw, dh };   // точный прямоугольник отрисовки — маска свипа (`_bdSweep`)
}

function drawBackdrops(ctx, world, unit, camera, W, H) {
  const bs = world && world.backdrops; if (!bs || !bs.length) return;
  ctx.save();
  if (typeof clipVisibleAir === 'function') clipVisibleAir(ctx, world, camera);   // только сквозь воздух пещер
  for (const b of bs) {
    const rev = b.scanned ? 1 : b.reveal; if (rev <= 0.02) continue;
    const cxw = b.cx * TILE + TILE / 2, cyw = b.cy * TILE + TILE / 2;
    const sx = camera.screenX(cxw), sy = cyw - camera.y, hw = b.rx * TILE, hh = b.ry * TILE;
    if (sx < -hw - 80 || sx > W + hw + 80 || sy < -hh - 140 || sy > H + hh + 80) continue;
    const offX = unit ? wrapDeltaPx(unit.px, cxw) : 0, offY = unit ? (unit.py - cyw) : 0;
    _bdScene(ctx, b, sx, sy, hw, hh, offX, offY, rev);
    if (b.scanning) _bdSweep(ctx, b, sx, sy, hw, hh);
  }
  ctx.restore();
}

function _bdScene(ctx, b, sx, sy, hw, hh, offX, offY, rev) {
  const PAR = 0.45;
  ctx.save();
  ctx.beginPath(); ctx.ellipse(sx, sy, hw * 1.1, hh * 1.35, 0, 0, 6.283); ctx.clip();   // в пределах полости, низ растянут до дна (`clipVisibleAir` всё равно режет по воздуху)
  // фон-зарево (cobalt — «данные»)
  const gg = ctx.createRadialGradient(sx, sy, 6, sx, sy, Math.max(hw, hh) * 1.2);
  gg.addColorStop(0, `rgba(58,126,200,${0.14 * rev})`); gg.addColorStop(1, 'rgba(58,126,200,0)');
  ctx.fillStyle = gg; ctx.fillRect(sx - hw * 1.1, sy - hh * 1.1, hw * 2.2, hh * 2.2);
  const layer = (d, col, kind) => {
    const lx = sx - offX * d * PAR, by = sy - offY * d * PAR * 0.6 + hh * 0.72;
    ctx.globalAlpha = rev * (0.5 + d * 0.5); ctx.fillStyle = col;
    _bdKind(ctx, kind, _bdRng(b.seed + ((d * 100) | 0)), lx, by, hw, hh);
  };
  layer(0.22, '#3a302a', 'sky');      // дальний горизонт руин (позади объекта)
  if (_bdRobotReady()) _bdDrawRobot(ctx, b, sx, sy, hw, hh, offX, rev);   // главный объект — растровый робот
  else layer(0.55, '#1a140e', b.kind);                                  // фолбэк: процедурный объект, пока картинка грузится
  ctx.globalAlpha = 1;
  ctx.restore();
}

// слой сцены: набор силуэтов по kind (заливка текущим fillStyle), привязка к (cx, by=земля)
function _bdKind(ctx, kind, r, cx, by, hw, hh) {
  const W = hw * 2;
  if (kind === 'sky') { let x = cx - hw; while (x < cx + hw) { const tw = _bdrr(r, W * 0.04, W * 0.09), th = _bdrr(r, hh * 0.15, hh * 0.5); ctx.fillRect(x, by - th, tw, th); x += tw + _bdrr(r, W * 0.01, W * 0.04); } return; }
  if (kind === 'city') { for (let i = 0; i < 7; i++) { const tw = _bdrr(r, W * 0.05, W * 0.12), tx = cx - hw * 0.7 + _bdrr(r, 0, hw * 1.4), th = _bdrr(r, hh * 0.3, hh * 1.0); ctx.fillRect(tx, by - th, tw, th); } return; }
  if (kind === 'machine') {
    const wr = hh * 0.55, wx = cx, wy = by - hh * 0.55; ctx.lineWidth = hh * 0.05; ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath(); ctx.arc(wx, wy, wr, 0, 6.283); ctx.stroke();
    for (let a = 0; a < 10; a++) { const an = a / 10 * 6.283; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(an) * wr, wy + Math.sin(an) * wr); ctx.stroke(); }
    ctx.fillRect(cx - hw * 0.06, wy, hw * 0.12, by - wy);   // мачта/опора
    return;
  }
  if (kind === 'idol') {
    let y = by, tw = hw * 0.7; for (let i = 0; i < 5; i++) { const th = hh * 0.16; ctx.fillRect(cx - tw / 2, y - th, tw, th); y -= th; tw *= 0.86; }
    ctx.fillRect(cx - hw * 0.38, y - hh * 0.2, hw * 0.76, hh * 0.22);   // маска-голова
    const prev = ctx.fillStyle; ctx.fillStyle = '#07050a';             // ниши глаз (опаковая тьма, без destination-out)
    ctx.fillRect(cx - hw * 0.22, y - hh * 0.13, hw * 0.13, hh * 0.06); ctx.fillRect(cx + hw * 0.09, y - hh * 0.13, hw * 0.13, hh * 0.06);
    ctx.fillStyle = prev;
    return;
  }
}

// объёмный сканер: яркая cobalt-полоса проходит по пещере слева→направо (sweepT 0..1)
function _bdSweep(ctx, b, sx, sy, hw, hh) {
  const lx = sx - hw + (b.sweepT || 0) * hw * 2;        // X линии скана (координаты пещеры)
  ctx.save();
  ctx.beginPath(); ctx.rect(lx - 18, sy - hh * 1.4, 36, hh * 2.8); ctx.clip();   // вертикальная полоса свипа
  if (b._astRect && _bdRobotReady()) {
    // подсветка ТОЛЬКО по альфе ассета (`lighter` поднимает яркость лишь непрозрачных пикселей) —
    // луч идёт ПО ОБЪЕКТУ, а не по пустоте пещеры.
    const r = b._astRect;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(_bdRobot, r.dx, r.dy, r.dw, r.dh);
  } else {
    ctx.beginPath(); ctx.ellipse(sx, sy, hw * 1.1, hh * 1.35, 0, 0, 6.283); ctx.clip();
    const g = ctx.createLinearGradient(lx - 16, 0, lx + 16, 0);
    g.addColorStop(0, 'rgba(58,126,200,0)'); g.addColorStop(0.5, 'rgba(130,205,245,0.5)'); g.addColorStop(1, 'rgba(58,126,200,0)');
    ctx.fillStyle = g; ctx.fillRect(lx - 16, sy - hh, 32, hh * 2);
  }
  ctx.restore();
}
