'use strict';

// Отрисовка печатаемых структур — ПРОЦЕДУРНО (ассеты будут следующим этапом: появится спрайт → подменим).
// В мире, ПОД туманом/светом (как враги). Перф-правила spec_render.md: без ctx.filter/shadowBlur/офскринов.
// Энергобар у активных структур; «стройка» — полупрозрачный силуэт + прогресс; «гибель» — затухание + искры.
function drawStructures(ctx, structures, camera) {
  if (!structures) return;
  const vw = camera.viewW || 4000;
  for (const s of structures.list) {
    const cx = Math.round(camera.screenX(s.px)), cy = Math.round(s.py - camera.y);
    if (cx < -TILE * 2 || cx > vw + TILE * 2) continue;
    drawStructure(ctx, s, cx, cy);
  }
  for (const t of structures.tracers) {                       // трассеры выстрелов турелей (рейлган — толстый луч-пробой)
    const x1 = Math.round(camera.screenX(t.x1)), y1 = Math.round(t.y1 - camera.y);
    const x2 = x1 + Math.round(wrapDeltaPx(t.x2, t.x1)), y2 = Math.round(t.y2 - camera.y);   // дельта x1→x2 (wrapDeltaPx(a,b)=a−b)
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t.life / (t.beam ? STRUCT_TRACER_TTL * 2 : STRUCT_TRACER_TTL));
    ctx.strokeStyle = t.beam ? '#bfe0ff' : '#ffe0a0'; ctx.lineWidth = t.beam ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
}

// Голограмма размещения (режим place): контур тайла + силуэт, зелёный=валидно / красный=нельзя.
function drawPrintGhost(ctx, game, camera) {
  if (!game.printGhost || game.printMode !== 'place' || !game.printSel) return;
  const U = game.unit;
  if (U) {   // РАДИУС СТРОИТЕЛЬСТВА вокруг юнита — тонкая пунктирная линия (видно границу досягаемости печати)
    const reach = (U.stats && U.stats.printReach) || PRINT_REACH;
    const ucx = Math.round(camera.screenX(U.px)), ucy = Math.round(U.py - camera.y);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ff8f3a'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(ucx, ucy, reach * TILE, 0, 6.283); ctx.stroke();
    ctx.restore();
  }
  const g = game.printGhost, def = STRUCT_DEFS[game.printSel];
  const cx = Math.round(camera.screenX(g.tileX * TILE + TILE / 2)), cy = Math.round(g.tileY * TILE + TILE / 2 - camera.y);
  const col = g.valid ? '#5fbf6a' : '#ff5a4a', h = TILE / 2;
  ctx.save();
  ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]); ctx.strokeRect(cx - h, cy - h, TILE, TILE); ctx.setLineDash([]);
  ctx.globalAlpha = 0.85;
  if (typeof drawStructGlyph === 'function') drawStructGlyph(ctx, game.printSel, cx, cy, h * 0.5, col);
  ctx.restore();
}

function drawStructure(ctx, s, cx, cy) {
  if (s.dying) { drawStructDeath(ctx, s, cx, cy); return; }
  const b = s.def.b, building = s.state === 'building';
  // Активные «садятся» на пол (рисуются по центру тайла → парили бы над неровной кромкой). Стена/шипы — нет.
  const dcy = cy + ((b === 'wall' || b === 'spike') ? 0 : Math.round(TILE * 0.34));
  if (!building) {   // ауры/конусы/импульсы непрерывных эффектов — ПОД корпусом
    if (b === 'microwave' && s.active2) drawMwCone(ctx, s, cx, dcy);
    else if ((b === 'jammer' || b === 'repair') && s.active2) drawAura(ctx, cx, dcy, s.def.radius, s.def.color);
    if ((b === 'emp' || b === 'repulsor') && s.pulse > 0) drawPulseRing(ctx, s, cx, dcy);
    if (b === 'siege' && s.pulse > 0) drawSiegeShock(ctx, s, cx, dcy);   // резонанс-фронт к гнезду
  }
  ctx.save();
  if (building) ctx.globalAlpha = 0.45;
  switch (b) {
    case 'wall': drawWallStruct(ctx, s, cx, cy); break;
    case 'spike': drawSpikeStruct(ctx, s, cx, cy); break;
    case 'turret': case 'railgun': drawTurretStruct(ctx, s, cx, dcy); break;
    case 'microwave': drawMwStruct(ctx, s, cx, dcy); break;
    case 'emp': drawEmpStruct(ctx, s, cx, dcy); break;
    case 'repulsor': drawRepulsorStruct(ctx, s, cx, dcy); break;
    case 'jammer': drawJammerStruct(ctx, s, cx, dcy); break;
    case 'repair': drawRepairStruct(ctx, s, cx, dcy); break;
    case 'battery': drawBatteryStruct(ctx, s, cx, dcy); break;
    case 'siege': drawSiegeStruct(ctx, s, cx, dcy); break;
  }
  ctx.restore();
  if (building) { drawBuildProgress(ctx, s, cx, dcy); return; }
  if (s.active) drawEnergyBar(ctx, s, cx, dcy);
}

// Стена — бронеплита поверх тайла-породы (рёбра + заклёпки), цвет металла.
function drawWallStruct(ctx, s, cx, cy) {
  const h = TILE / 2 - 1;
  ctx.fillStyle = '#5a636d';
  ctx.fillRect(cx - h, cy - h, h * 2, h * 2);
  ctx.strokeStyle = '#9aa7b3'; ctx.lineWidth = 2; ctx.strokeRect(cx - h + 1, cy - h + 1, h * 2 - 2, h * 2 - 2);
  ctx.strokeStyle = '#3a424c'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, cy - h + 2); ctx.lineTo(cx, cy + h - 2); ctx.stroke();   // центральный шов
  ctx.fillStyle = '#c2c8ce';
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(cx + dx * (h - 4), cy + dy * (h - 4), 1.6, 0, 6.283); ctx.fill(); }
}

// Шипы — ряд треугольников на полу тайла (пассивный режущий пол).
function drawSpikeStruct(ctx, s, cx, cy) {
  const h = TILE / 2 - 2, base = cy + h;
  ctx.fillStyle = '#3a424c'; ctx.fillRect(cx - h, base - 2, h * 2, 3);   // планка-основание
  ctx.fillStyle = s.def.color;
  for (let i = -2; i <= 2; i++) {
    const x = cx + i * (h * 0.42);
    ctx.beginPath(); ctx.moveTo(x - h * 0.18, base - 1); ctx.lineTo(x, base - h * 0.95); ctx.lineTo(x + h * 0.18, base - 1); ctx.closePath(); ctx.fill();
  }
}

// Турель — основание + поворотный ствол по aimAng + красный сенсор + вспышка дула.
function drawTurretStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 4, off = s.active && s.energy < s.def.eShot ? 0.4 : 1;   // мало энергии → турель «гаснет»
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#4a4036';                                       // станина
  ctx.fillRect(cx - r, cy + r * 0.2, r * 2, r * 0.8);
  ctx.fillStyle = s.def.color;                                     // купол
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, r * 0.85, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#7a6a44'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy + r * 0.2, r * 0.85, Math.PI, 0); ctx.stroke();
  const rail = s.def.b === 'railgun', a = s.aimAng, oy = cy + r * 0.2;
  const blen = rail ? r * 2.0 : r * 1.5, bx = cx + Math.cos(a) * blen, by = oy + Math.sin(a) * blen;   // ствол (рейлган длиннее)
  ctx.strokeStyle = rail ? '#bfe0ff' : '#9098a0'; ctx.lineWidth = rail ? 4 : 3; ctx.beginPath(); ctx.moveTo(cx, oy); ctx.lineTo(bx, by); ctx.stroke();
  if (rail) { const nx = -Math.sin(a), ny = Math.cos(a); ctx.lineWidth = 2; for (const k of [0.5, 0.78]) { const mx = cx + Math.cos(a) * blen * k, my = oy + Math.sin(a) * blen * k; ctx.beginPath(); ctx.moveTo(mx - nx * 3, my - ny * 3); ctx.lineTo(mx + nx * 3, my + ny * 3); ctx.stroke(); } }   // катушки
  if (s.flash > 0) { ctx.fillStyle = rail ? '#dff0ff' : '#ffe0a0'; ctx.beginPath(); ctx.arc(bx, by, rail ? 4 : 3.2, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = '#d0402f'; ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, 2, 0, 6.283); ctx.fill();   // сенсор
  ctx.restore();
}

// Батарея — корпус-ячейка с вертикальной шкалой заряда + клеммы.
function drawBatteryStruct(ctx, s, cx, cy) {
  const w = TILE / 2 - 3, h = TILE / 2 - 2;
  ctx.fillStyle = '#2a3a2c'; ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 2; ctx.strokeRect(cx - w + 1, cy - h + 1, w * 2 - 2, h * 2 - 2);
  const f = s.energyMax ? s.energy / s.energyMax : 0;
  ctx.fillStyle = s.def.color; ctx.globalAlpha *= 0.85;
  ctx.fillRect(cx - w + 3, cy + h - 3 - (h * 2 - 6) * f, w * 2 - 6, (h * 2 - 6) * f);
  ctx.globalAlpha /= 0.85;
  ctx.fillStyle = '#9aa7b3'; ctx.fillRect(cx - 3, cy - h - 2, 6, 2);   // клемма
}

// СВЧ-турель — дисковый излучатель с раструбом по aimAng.
function drawMwStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 4, off = s.energy <= 0 ? 0.4 : 1, a = s.aimAng, oy = cy + r * 0.2;
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#4a3a2c'; ctx.fillRect(cx - r, oy, r * 2, r * 0.8);
  ctx.fillStyle = s.def.color; ctx.beginPath(); ctx.arc(cx, oy, r * 0.7, Math.PI, 0); ctx.fill();
  const ex = cx + Math.cos(a) * r * 1.2, ey = oy + Math.sin(a) * r * 1.2, nx = -Math.sin(a), ny = Math.cos(a);   // раструб
  ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(cx + nx * 3, oy + ny * 3); ctx.lineTo(cx - nx * 3, oy - ny * 3); ctx.lineTo(ex - nx * 6, ey - ny * 6); ctx.lineTo(ex + nx * 6, ey + ny * 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d0402f'; ctx.beginPath(); ctx.arc(cx, oy - 1, 2, 0, 6.283); ctx.fill();
  ctx.restore();
}
// СВЧ-конус — полупрозрачный сектор урона (когда бьёт).
function drawMwCone(ctx, s, cx, cy) {
  const a = s.aimAng, L = s.def.range * TILE, c = s.def.cone, oy = cy + (TILE / 2 - 4) * 0.2;
  ctx.save(); ctx.globalAlpha = 0.16; ctx.fillStyle = s.def.color;
  ctx.beginPath(); ctx.moveTo(cx, oy); ctx.arc(cx, oy, L, a - c, a + c); ctx.closePath(); ctx.fill(); ctx.restore();
}
// ЭМИ — катушка-сфера (стан-импульс).
function drawEmpStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 5, off = s.energy < s.def.eShot ? 0.5 : 1;
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#1c2e34'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.stroke();
  for (const e of [0.45, 0.75]) { ctx.beginPath(); ctx.ellipse(cx, cy, r * e, r, 0, 0, 6.283); ctx.stroke(); }   // катушки
  ctx.fillStyle = s.def.color; ctx.beginPath(); ctx.arc(cx, cy, 2.2, 0, 6.283); ctx.fill();
  ctx.restore();
}
// Отталкиватель — кольцо-эмиттер с лепестками.
function drawRepulsorStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 5, off = s.energy < s.def.eShot ? 0.5 : 1;
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#2a2236'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 6.283); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  ctx.restore();
}
// Глушилка — мачта-антенна с «усами».
function drawJammerStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 4, off = s.energy <= 0 ? 0.5 : 1;
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#26342a'; ctx.fillRect(cx - 3, cy - r, 6, r * 2);   // мачта
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 1.5;
  for (const k of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx + k * r * 0.8, cy - r); ctx.stroke(); }   // усы
  ctx.fillStyle = s.def.color; ctx.beginPath(); ctx.arc(cx, cy - r, 2.4, 0, 6.283); ctx.fill();
  ctx.restore();
}
// Ремонт-дрон — корпус с крестом-эмблемой.
function drawRepairStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 5, off = s.energy <= 0 ? 0.5 : 1;
  ctx.save(); ctx.globalAlpha *= off;
  ctx.fillStyle = '#203026'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 1.5; ctx.strokeRect(cx - r + 1, cy - r + 1, r * 2 - 2, r * 2 - 2);
  ctx.fillStyle = s.def.color; ctx.fillRect(cx - 1.6, cy - r * 0.6, 3.2, r * 1.2); ctx.fillRect(cx - r * 0.6, cy - 1.6, r * 1.2, 3.2);   // крест
  ctx.restore();
}
// Аура непрерывного эффекта (глушилка/ремонт) — тонкое пунктирное кольцо радиуса действия.
function drawAura(ctx, cx, cy, radiusTiles, color) {
  ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.arc(cx, cy, radiusTiles * TILE, 0, 6.283); ctx.stroke(); ctx.restore();
}
// Импульс-кольцо (ЭМИ/отталкиватель) — расходится и гаснет.
function drawPulseRing(ctx, s, cx, cy) {
  const p = Math.min(1, s.pulse / 0.45), rr = s.def.radius * TILE * p;
  ctx.save(); ctx.globalAlpha = (1 - p) * 0.7; ctx.strokeStyle = s.def.color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, 6.283); ctx.stroke(); ctx.restore();
}

// ОСАДНАЯ БАШНЯ — высокая мачта с резонанс-диском, поворачивается к гнезду; пульсирующее ядро, когда резонирует.
function drawSiegeStruct(ctx, s, cx, cy) {
  const r = TILE / 2 - 4, off = s.active && s.energy < s.def.eShot ? 0.45 : 1;
  ctx.save(); ctx.globalAlpha *= off; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const baseY = cy + r, topY = cy - r * 1.7;
  ctx.strokeStyle = '#5a4a44'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, baseY); ctx.lineTo(cx, topY); ctx.stroke();   // мачта
  ctx.strokeStyle = '#3a302c'; ctx.lineWidth = 2; ctx.beginPath();   // раскосы
  ctx.moveTo(cx - r * 0.7, baseY); ctx.lineTo(cx, cy - r * 0.2); ctx.lineTo(cx + r * 0.7, baseY); ctx.stroke();
  const a = s.aimAng != null ? s.aimAng : -Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
  const hx = cx + dx * 3, hy = topY + dy * 3;
  ctx.strokeStyle = s.def.color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.6, a - 1.15, a + 1.15); ctx.stroke();   // дуга-излучатель к цели
  const beat = s.active2 ? (0.55 + 0.45 * Math.sin(performance.now() / 120)) : 0.45;
  ctx.fillStyle = s.flash > 0 ? '#fff0e0' : s.def.color; ctx.globalAlpha *= beat;
  ctx.beginPath(); ctx.arc(hx, hy, r * 0.24, 0, 6.283); ctx.fill();   // ядро-резонатор
  ctx.restore();
}

// Резонанс-фронт: дуги-волны уходят от башни В СТОРОНУ гнезда (s.aimAng) — площадной удар, не луч.
function drawSiegeShock(ctx, s, cx, cy) {
  const p = Math.min(1, s.pulse / 0.45);
  const a = s.aimAng != null ? s.aimAng : -Math.PI / 2, dx = Math.cos(a), dy = Math.sin(a);
  const reach = s.def.range * TILE * 0.5;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const f = p - i * 0.22; if (f <= 0 || f > 1) continue;
    const d = f * reach;
    ctx.globalAlpha = 0.4 * (1 - f); ctx.strokeStyle = s.def.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx + dx * d, cy + dy * d, TILE * 0.5 * f, a - 1.2, a + 1.2); ctx.stroke();
  }
  ctx.restore();
}

function drawEnergyBar(ctx, s, cx, cy) {
  if (!s.energyMax || s.def.feed) return;   // у батареи свой индикатор
  const w = TILE / 2, f = s.energy / s.energyMax, y = cy + TILE / 2 - 1;
  ctx.fillStyle = 'rgba(10,8,6,0.7)'; ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 4);
  ctx.fillStyle = f > 0.25 ? '#d4a042' : '#c0402f'; ctx.fillRect(cx - w / 2, y, w * f, 2);
}

function drawBuildProgress(ctx, s, cx, cy) {
  const w = TILE / 2, f = Math.min(1, s.buildT / s.buildTime), y = cy + TILE / 2 - 1;
  ctx.fillStyle = 'rgba(10,8,6,0.7)'; ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, 4);
  ctx.fillStyle = '#5fbfe0'; ctx.fillRect(cx - w / 2, y, w * f, 2);   // голубой — «печать»
  const sy = cy - TILE / 2 + (TILE) * f;                              // скан-линия печати
  ctx.strokeStyle = 'rgba(95,191,224,0.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - w / 2, sy); ctx.lineTo(cx + w / 2, sy); ctx.stroke();
}

// Гибель структуры — затухание + расходящиеся искры (обломки — через dust, см. structures._deathFx).
function drawStructDeath(ctx, s, cx, cy) {
  const p = 1 - Math.max(0, s.deathT) / STRUCT_DEATH_TIME, r = TILE / 2 - 4;
  ctx.save(); ctx.globalAlpha = (1 - p) * 0.8;
  ctx.fillStyle = '#2a2622'; ctx.fillRect(cx - r, cy - r * 0.4, r * 2, r * 1.4);
  ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + s.px, l = r * (0.6 + p * 1.4); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke(); }
  ctx.restore();
}
