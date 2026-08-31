'use strict';

// Рендер винтового бура (borers.js): автономные буры-щиты + след проходки на укреплённых ходах.
// ⚠️ перф: без ctx.filter/shadowBlur; трейл рисуется по видимому окну тайлов (как dust.ambient).

// След большого проходческого щита на укреплённых ходах (AIR-тайлы с `t.screw`): НЕ кричащие линии,
// а тихие сегменты-кольца обделки в стиле фоновой фактуры (drawBackTexture/boreSide) — тёмная борозда
// + слабый тёплый блик. Рёбра ПЕРПЕНДИКУЛЯРНЫ оси хода (t.screwAxis) → текстура разворачивается в
// вертикальных ходах. Рисуется ПОД туманом/светом (часть фактуры мира).
function drawScrewTrail(ctx, world, camera) {
  const tx0 = Math.floor(camera.x / TILE) - 1, txN = Math.ceil((camera.x + camera.viewW) / TILE) + 1;
  const ty0 = Math.max(0, Math.floor(camera.y / TILE) - 1), tyN = Math.min(MAP_H, Math.ceil((camera.y + camera.viewH) / TILE) + 1);
  ctx.save(); ctx.lineCap = 'round';
  for (let ty = ty0; ty < tyN; ty++) for (let tx = tx0; tx < txN; tx++) {
    const t = world.tileAt(tx, ty); if (!t || t.type !== AIR || !t.screw) continue;
    const cx = camera.screenX(tx * TILE + TILE / 2), cy = ty * TILE + TILE / 2 - camera.y;
    const horiz = (t.screwAxis || 0) === 0;           // ось хода 0=гориз → рёбра ВЕРТИКАЛЬНЫЕ
    const half = TILE * 0.32, bow = TILE * 0.05;       // длина ребра поперёк хода + слабый выгиб по ходу
    for (let s = -1; s <= 1; s += 2) {                 // два сегмента-кольца обделки на тайл (регулярная «лента»)
      const o = s * TILE * 0.24;
      for (let pass = 0; pass < 2; pass++) {           // pass0 — тёмная борозда, pass1 — тонкий блик со сдвигом (рельеф)
        const d = pass === 0 ? 0 : 1;
        ctx.beginPath();
        if (horiz) { ctx.moveTo(cx + o - bow + d, cy - half); ctx.quadraticCurveTo(cx + o + bow + d, cy, cx + o - bow + d, cy + half); }
        else       { ctx.moveTo(cx - half, cy + o - bow + d); ctx.quadraticCurveTo(cx, cy + o + bow + d, cx + half, cy + o - bow + d); }
        ctx.strokeStyle = pass === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(255,240,220,0.05)';
        ctx.lineWidth = pass === 0 ? 1.5 : 0.8;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// СОСТАВНОЙ АССЕТ проходческого щита (редактор → module_assets.js): две части — КРЕПЛЕНИЕ (`borer:mount`, сзади) +
// БУР-ЩИТ (`borer:shield`, спереди). Оба в каноническом кадре (вперёд=+X). Масштаб `k` — под фактический калибр щита
// (автономный TILE·0.3 / несомый TILE·0.27). При бурении поверх — процедурные искры-крошка (общий фидбэк). Есть хоть одна
// часть → ассет-режим, иначе процедурный корпус ниже.
function _borerAsset(ctx, mount, shield, alongH, perpH, spin, drilling, shieldOnly) {
  const k = perpH / (TILE * 0.3);
  const blit = (sp) => { if (!sp || !sp.img) return; ctx.save(); if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180); ctx.drawImage(sp.img, -sp.px * k, -sp.py * k, sp.w * k, sp.h * k); ctx.restore(); };
  if (!shieldOnly) blit(mount);   // shieldOnly (АВТОНОМНЫЙ деплой-щит): крепление остаётся ПОРТОМ на юните — не «едет» с проходческим щитом
  blit(shield);
  if (drilling) _borerSparks(ctx, alongH, perpH, spin);
}
// Искры-крошка у фрезы (мерцают по фазе — дёшево, без частиц). Общее для процедурного и ассет-режимов.
function _borerSparks(ctx, alongH, perpH, spin) {
  const s = spin + performance.now() * 0.02, hr = perpH * 0.82, hx = alongH * 0.35;
  const a0 = ctx.globalAlpha; ctx.fillStyle = '#eafff0';
  for (let i = 0; i < 3; i++) { const a = s * 1.7 + i * 2.1, rr = hr * (0.6 + 0.35 * Math.sin(s * 3 + i)); ctx.globalAlpha = a0 * (0.45 + 0.4 * Math.sin(s * 4 + i * 2)); ctx.beginPath(); ctx.arc(hx + alongH * 0.5 + Math.cos(a) * rr, Math.sin(a) * rr, 1.4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = a0;
}

// Корпус щита в локальных координатах (ось +x = направление хода): проходческий щит — УЗКИЙ вдоль хода
// (`alongH`), ВЫСОКИЙ поперёк (`perpH` ≈ калибр) + вращающаяся фреза-диск спереди. `drilling` → анимация
// работы (фреза вращается быстрее + искры-крошка). Общий для автономных и несомого «магазина».
// ⚠️ Если загружен ассет (`borer:mount`/`borer:shield` в PART_SPRITES) — рисуем СПРАЙТЫ, иначе процедурно (фолбэк).
function _shieldBody(ctx, alongH, perpH, spin, drilling, shieldOnly) {
  const P = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES;
  const mount = P && P['borer:mount'], shield = P && P['borer:shield'];
  if (mount || shield) { _borerAsset(ctx, mount, shield, alongH, perpH, spin, drilling, shieldOnly); return; }
  const r = Math.min(alongH, perpH) * 0.7;
  ctx.beginPath();                                   // корпус: узкий по ходу, высокий поперёк
  ctx.moveTo(-alongH + r, -perpH); ctx.lineTo(alongH - r, -perpH); ctx.arcTo(alongH, -perpH, alongH, -perpH + r, r);
  ctx.lineTo(alongH, perpH - r); ctx.arcTo(alongH, perpH, alongH - r, perpH, r);
  ctx.lineTo(-alongH + r, perpH); ctx.arcTo(-alongH, perpH, -alongH, perpH - r, r);
  ctx.lineTo(-alongH, -perpH + r); ctx.arcTo(-alongH, -perpH, -alongH + r, -perpH, r); ctx.closePath();
  ctx.fillStyle = '#16241a'; ctx.fill();
  ctx.strokeStyle = PAL.screwGreen; ctx.lineWidth = 1.6; ctx.stroke();
  const s = drilling ? spin + performance.now() * 0.02 : spin;   // при бурении фреза вращается заметно быстрее
  const hr = perpH * 0.82, hx = alongH * 0.35;                    // фреза-диск спереди (охватывает калибр)
  ctx.strokeStyle = 'rgba(154,208,160,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx, 0, hr, 0, TAU); ctx.stroke();
  ctx.strokeStyle = drilling ? '#f0fff4' : '#cfeccf'; ctx.lineWidth = drilling ? 2 : 1.5;
  for (let i = 0; i < 4; i++) { const a = s + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx + Math.cos(a) * hr, Math.sin(a) * hr); ctx.stroke(); }
  ctx.fillStyle = '#e6f6e6'; ctx.beginPath(); ctx.arc(alongH * 0.92, 0, 2, 0, TAU); ctx.fill();   // острие-носик
  if (drilling) _borerSparks(ctx, alongH, perpH, spin);   // искры-крошка у фрезы (общий хелпер)
}

// Автономные буры-щиты: проходческий щит (высокий поперёк, узкий вдоль хода) с фрезой по направлению
// проходки. Рисуется ПОВЕРХ тумана (игрок видит/отзывает щит в темноте). `b.drilling` → анимация работы.
function drawBorers(ctx, game, camera) {
  if (!game.borers || !game.borers.length) return;
  const s = (typeof unitDrawScale === 'function' && game.unit) ? unitDrawScale(game.unit) : 1;   // деплой-щит ЗАПУЩЕН юнитом → его калибр (совпадает с несомым/сборкой, иначе крупнее юнита)
  // Без узла «Сканеры на щитах» (mast_ds_scan) щит НЕ рисуется поверх тумана — только в разведанных тайлах (как остальной мир).
  // С узлом щит сам снимает туман вокруг себя (updateBorers) → всегда виден.
  const seeInFog = typeof metaHas === 'function' && metaHas('mast_ds_scan');
  ctx.save(); ctx.lineCap = 'round';
  for (const b of game.borers) {
    if (!seeInFog && game.world && !game.world.isSeen(b.tileX, b.tileY)) continue;   // в тумане без узла-сканера — скрыт
    const cx = camera.screenX(b.px), cy = b.py - camera.y;
    ctx.save(); ctx.globalAlpha = b.depleted ? 0.5 : 1;   // РАЗРЯЖЕН → корпус тусклее (неактивен)
    ctx.translate(cx, cy); ctx.rotate(Math.atan2(b.dy, b.dx)); ctx.scale(s, s);   // ось = направление проходки; размер = масштаб юнита
    _shieldBody(ctx, TILE * 0.15, TILE * 0.3, b.spin, b.drilling, true);   // shieldOnly: ТОЛЬКО бур-щит (крепление — порт на юните, не «едет»)
    ctx.restore();
    if (b.recharging || b.maxCharge) {   // индикаторы у щита: позиции в масштабе s (жмутся к маленькому щиту), штрихи/шрифт — читаемые (÷s), БЕЗ поворота
      ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
      if (b.recharging) {   // ПОДЗАРЯДКА: аддитивное пульс-кольцо (анимация «юнит заряжает щит»)
        const t = performance.now() / 1000;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 12);
        ctx.strokeStyle = PAL.screwGreen; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.arc(0, 0, TILE * 0.46, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (b.maxCharge) {   // ИНДИКАТОР ЗАРЯДА: тонкая полоска над щитом (зелёный→янтарь→красный), мигающий «!» при разряде
        const f = Math.max(0, Math.min(1, (b.charge || 0) / b.maxCharge));
        const gy = -TILE * 0.52, gw = TILE * 0.5;
        ctx.globalAlpha = 1; ctx.lineWidth = 2.4 / s; ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.moveTo(-gw / 2, gy); ctx.lineTo(gw / 2, gy); ctx.stroke();
        ctx.strokeStyle = b.depleted ? PAL.enemyEye : (f < 0.3 ? '#e0a040' : PAL.screwGreen);
        if (f > 0) { ctx.beginPath(); ctx.moveTo(-gw / 2, gy); ctx.lineTo(-gw / 2 + gw * f, gy); ctx.stroke(); }
        ctx.lineCap = 'round';
        if (b.depleted && !b.recharging && Math.sin(performance.now() / 140) > 0) {   // зов о подзарядке
          ctx.fillStyle = PAL.enemyHot; ctx.font = `bold ${9 / s}px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText('!', 0, gy - 2 / s);
        }
      }
      ctx.restore();
    }
  }
  ctx.restore();
}

// Несомый «следующий» щит из магазина: торчит из порта юнита и ПОВОРАЧИВАЕТСЯ ВМЕСТЕ С ЮНИТОМ (как простой
// бур — по доводке кольца `_ringAim` / взгляду). Рисуется ДО юнита (задняя половина уходит под кольцо).
function drawCarriedBorer(ctx, game, camera, bodyOff) {
  const u = game.unit;
  if (!u || !u.stats || !u.stats.screw) return;
  const max = game.borerMax ? game.borerMax() : (typeof SCREW_BORERS_BASE !== 'undefined' ? SCREW_BORERS_BASE : 2);
  const carried = max - ((game.borers && game.borers.length) || 0);
  if (carried <= 0) return;                          // нечему высовываться
  const aim = u._ringAim || 0;                       // вертикаль (±π/2) — из доводки кольца; горизонт — по faceX
  const ang = (Math.abs(aim) < 0.5) ? (u.faceX === -1 ? Math.PI : 0) : aim;
  const B = BORER_ON_UNIT;                            // ЕДИНЫЙ калибр (совпадает со сборкой/редактором)
  const s = (typeof unitDrawScale === 'function') ? unitDrawScale(u) : 1;   // ⚠️ масштаб юнита: кольцо рисуется в drawScale, щит ДОЛЖЕН ужиматься ВМЕСТЕ → иначе в игре крупнее/дальше, чем в редакторе (тот при full R)
  const bx = bodyOff ? bodyOff.x : 0, by = bodyOff ? bodyOff.y : 0;   // лаг корпуса на щупальцах — тот же, что у кольца (drawRingUnit opts.dx/dy)
  ctx.save(); ctx.lineCap = 'round';
  ctx.translate(camera.screenX(u.px) + bx + Math.cos(ang) * B.off * s, u.py - camera.y + by + Math.sin(ang) * B.off * s);
  ctx.rotate(ang); ctx.scale(s, s);
  ctx.globalAlpha = 0.95;
  _shieldBody(ctx, B.alongH, B.perpH, performance.now() * 0.0012, false);   // лёгкий idle-винт у пристыкованного
  ctx.restore();
}

// ЕДИНЫЙ калибр «щита НА ЮНИТЕ» — ОДИН источник для игры (drawCarriedBorer), сборки (drawMountedBorer) и редактор-превью
// (drawBorerOnUnit). Иначе `k=perpH/(TILE·0.3)` разный → оффсеты ассета читаются по-разному → авторская подгонка «не передаётся».
const BORER_ON_UNIT = { alongH: TILE * 0.14, perpH: TILE * 0.27, off: TILE * 0.5 };
// Щит ВИНТОВОГО бура НА ЮНИТЕ в ЛОКАЛЬНЫХ координатах (центр юнита = cx,cy в текущем transform, aim — взгляд). Для
// СТАТИЧНЫХ превью (экран сборки) где нет деплой-состояния и `drawCarriedBorer` не вызывается — показывает «установленный
// винтовой бур = щит» вместо скрытой детали-бура. Тот же калибр BORER_ON_UNIT, что drawCarriedBorer → совпадает с игрой.
function drawMountedBorer(ctx, cx, cy, aim) {
  if (typeof _shieldBody !== 'function') return;
  const B = BORER_ON_UNIT;
  ctx.save(); ctx.lineCap = 'round';
  ctx.translate(cx + Math.cos(aim) * B.off, cy + Math.sin(aim) * B.off); ctx.rotate(aim);
  _shieldBody(ctx, B.alongH, B.perpH, performance.now() * 0.0012, false);
  ctx.restore();
}
// Составной бур-щит, ВПИСАННЫЙ в бокс boxW×boxH (центр композиции = текущий origin) — для ИКОНОК/ГАЛЕРЕИ (не калибр юнита!).
// Меряет РЕАЛЬНЫЙ bbox спрайтов mount+shield → масштаб-под-бокс + центрирование → не вылезает и не смещён (в отличие от
// прямого `_shieldBody` с калибр-зависимым `k`, который на большой иконке раздувал ассет). Нет ассетов → процедурный фолбэк.
function drawBorerFit(ctx, boxW, boxH) {
  if (typeof _shieldBody !== 'function') return;
  const P = (typeof PART_SPRITES !== 'undefined') && PART_SPRITES;
  const mount = P && P['borer:mount'], shield = P && P['borer:shield'];
  if (mount || shield) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;   // bbox в НЕмасштабированных коорд. (как в _borerAsset, k=1)
    for (const sp of [mount, shield]) { if (!sp || !sp.img) continue; x0 = Math.min(x0, -sp.px); y0 = Math.min(y0, -sp.py); x1 = Math.max(x1, -sp.px + sp.w); y1 = Math.max(y1, -sp.py + sp.h); }
    const bw = (x1 - x0) || 1, bh = (y1 - y0) || 1, fit = Math.min(boxW / bw, boxH / bh);
    ctx.save(); ctx.scale(fit, fit); ctx.translate(-(x0 + x1) / 2, -(y0 + y1) / 2);   // вписать + центрировать bbox
    const blit = (sp) => { if (!sp || !sp.img) return; ctx.save(); if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180); ctx.drawImage(sp.img, -sp.px, -sp.py, sp.w, sp.h); ctx.restore(); };
    blit(mount); blit(shield);   // порядок как _borerAsset: крепление ПОД щитом
    ctx.restore();
  } else {
    const ph = Math.min(boxH * 0.42, boxW * 0.26);   // процедурный фолбэк, вписанный в бокс
    ctx.save(); ctx.lineCap = 'round'; _shieldBody(ctx, ph * 0.52, ph, 0.7, false); ctx.restore();
  }
}

// Узел «Навигация по бурам»: вокруг юнита на большом радиусе — стрелки-указатели на КАЖДЫЙ запущенный
// щит (даже за кадром/в темноте). Гейт metaHas('mast_ds_nav') — в game.drawScene. Тор по X через wrapDeltaPx.
function drawBorerArrows(ctx, game, camera) {
  const u = game.unit, borers = game.borers;
  if (!u || !borers || !borers.length) return;
  const ucx = camera.screenX(u.px), ucy = u.py - camera.y, R = TILE * 1.9;
  ctx.save(); ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of borers) {
    const dx = wrapDeltaPx(b.px, u.px), dy = b.py - u.py, d = Math.hypot(dx, dy);
    if (d < TILE * 1.3) continue;                       // щит рядом — указатель ни к чему
    const a = Math.atan2(dy, dx), ax = ucx + Math.cos(a) * R, ay = ucy + Math.sin(a) * R;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
    ctx.globalAlpha = Math.min(1, 0.45 + d / (TILE * 30));   // дальше щит → ярче стрелка
    ctx.fillStyle = PAL.screwGreen; ctx.beginPath();        // треугольник-наконечник наружу
    ctx.moveTo(6, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // дистанция в тайлах (round → стабильно, без джиттера) неярко чуть наружу за стрелкой
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#6f9a76';
    ctx.fillText(Math.round(d / TILE), ucx + Math.cos(a) * (R + 12), ucy + Math.sin(a) * (R + 12));
  }
  ctx.restore();
}
