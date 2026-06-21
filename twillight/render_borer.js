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

// Корпус щита в локальных координатах (ось +x = направление хода): проходческий щит — УЗКИЙ вдоль хода
// (`alongH`), ВЫСОКИЙ поперёк (`perpH` ≈ калибр) + вращающаяся фреза-диск спереди. `drilling` → анимация
// работы (фреза вращается быстрее + искры-крошка). Общий для автономных и несомого «магазина».
function _shieldBody(ctx, alongH, perpH, spin, drilling) {
  const r = Math.min(alongH, perpH) * 0.7;
  ctx.beginPath();                                   // корпус: узкий по ходу, высокий поперёк
  ctx.moveTo(-alongH + r, -perpH); ctx.lineTo(alongH - r, -perpH); ctx.arcTo(alongH, -perpH, alongH, -perpH + r, r);
  ctx.lineTo(alongH, perpH - r); ctx.arcTo(alongH, perpH, alongH - r, perpH, r);
  ctx.lineTo(-alongH + r, perpH); ctx.arcTo(-alongH, perpH, -alongH, perpH - r, r);
  ctx.lineTo(-alongH, -perpH + r); ctx.arcTo(-alongH, -perpH, -alongH + r, -perpH, r); ctx.closePath();
  ctx.fillStyle = '#16241a'; ctx.fill();
  ctx.strokeStyle = '#9ad0a0'; ctx.lineWidth = 1.6; ctx.stroke();
  const s = drilling ? spin + performance.now() * 0.02 : spin;   // при бурении фреза вращается заметно быстрее
  const hr = perpH * 0.82, hx = alongH * 0.35;                    // фреза-диск спереди (охватывает калибр)
  ctx.strokeStyle = 'rgba(154,208,160,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx, 0, hr, 0, 6.283); ctx.stroke();
  ctx.strokeStyle = drilling ? '#f0fff4' : '#cfeccf'; ctx.lineWidth = drilling ? 2 : 1.5;
  for (let i = 0; i < 4; i++) { const a = s + i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(hx, 0); ctx.lineTo(hx + Math.cos(a) * hr, Math.sin(a) * hr); ctx.stroke(); }
  ctx.fillStyle = '#e6f6e6'; ctx.beginPath(); ctx.arc(alongH * 0.92, 0, 2, 0, 6.283); ctx.fill();   // острие-носик
  if (drilling) {                                    // искры-крошка у фрезы (мерцают по фазе — дёшево, без частиц)
    const a0 = ctx.globalAlpha; ctx.fillStyle = '#eafff0';
    for (let i = 0; i < 3; i++) { const a = s * 1.7 + i * 2.1, rr = hr * (0.6 + 0.35 * Math.sin(s * 3 + i)); ctx.globalAlpha = a0 * (0.45 + 0.4 * Math.sin(s * 4 + i * 2)); ctx.beginPath(); ctx.arc(hx + alongH * 0.5 + Math.cos(a) * rr, Math.sin(a) * rr, 1.4, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = a0;
  }
}

// Автономные буры-щиты: проходческий щит (высокий поперёк, узкий вдоль хода) с фрезой по направлению
// проходки. Рисуется ПОВЕРХ тумана (игрок видит/отзывает щит в темноте). `b.drilling` → анимация работы.
function drawBorers(ctx, game, camera) {
  if (!game.borers || !game.borers.length) return;
  ctx.save(); ctx.lineCap = 'round';
  for (const b of game.borers) {
    const cx = camera.screenX(b.px), cy = b.py - camera.y;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(b.dy, b.dx));   // ось щита = направление проходки
    _shieldBody(ctx, TILE * 0.15, TILE * 0.3, b.spin, b.drilling);
    ctx.restore();
  }
  ctx.restore();
}

// Несомый «следующий» щит из магазина: торчит из порта юнита и ПОВОРАЧИВАЕТСЯ ВМЕСТЕ С ЮНИТОМ (как простой
// бур — по доводке кольца `_ringAim` / взгляду). Рисуется ДО юнита (задняя половина уходит под кольцо).
function drawCarriedBorer(ctx, game, camera) {
  const u = game.unit;
  if (!u || !u.stats || !u.stats.screw) return;
  const max = game.borerMax ? game.borerMax() : (typeof SCREW_BORERS_BASE !== 'undefined' ? SCREW_BORERS_BASE : 2);
  const carried = max - ((game.borers && game.borers.length) || 0);
  if (carried <= 0) return;                          // нечему высовываться
  const aim = u._ringAim || 0;                       // вертикаль (±π/2) — из доводки кольца; горизонт — по faceX
  const ang = (Math.abs(aim) < 0.5) ? (u.faceX === -1 ? Math.PI : 0) : aim;
  const off = TILE * 0.5;
  ctx.save(); ctx.lineCap = 'round';
  ctx.translate(camera.screenX(u.px) + Math.cos(ang) * off, u.py - camera.y + Math.sin(ang) * off);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.95;
  _shieldBody(ctx, TILE * 0.14, TILE * 0.27, performance.now() * 0.0012, false);   // лёгкий idle-винт у пристыкованного
  ctx.restore();
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
    ctx.fillStyle = '#9ad0a0'; ctx.beginPath();        // треугольник-наконечник наружу
    ctx.moveTo(6, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // дистанция в тайлах (round → стабильно, без джиттера) неярко чуть наружу за стрелкой
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#6f9a76';
    ctx.fillText(Math.round(d / TILE), ucx + Math.cos(a) * (R + 12), ucy + Math.sin(a) * (R + 12));
  }
  ctx.restore();
}
