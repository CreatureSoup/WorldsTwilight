'use strict';

// Ассеты деталей юнита (ГИБРИД). Каждая деталь рисуется в КАНОНИЧЕСКОМ локальном
// кадре: центр в (0,0), «вперёд» = +X, «вверх» = −Y. Враппер drawPart делает
// translate→flip→rotate, поэтому одна и та же деталь (процедурная ИЛИ спрайт)
// верно ложится во всех позах: лево = зеркало, вверх/вниз = поворот.
const PART_SPRITES = {};   // kind → {img,w,h,px,py,...}; есть запись → рисуем спрайт
let _partsProc = false;    // отладка: рисовать ВСЕ детали ПРОЦЕДУРНО (игнорировать спрайты)
function partsProcedural(on) { _partsProc = !!on; }
function partsProcOn() { return _partsProc; }   // активны ли спрайты (false=да): кольцу — спрайт vs процедурный тор
// СПРАЙТЫ ПРИВЯЗАНЫ К ТИПУ КОРПУСА: ключ `<hull>:<id>`. Рендер ставит `partsHull(unit.hull)` перед
// отрисовкой, `spriteFor(id)` ищет namespaced-ключ (с откатом на плоский `id` — для редактора, где
// авторится один корпус плоскими ключами). Так core/scout не делят ассеты, без гонок.
let _partsHull = '';
function partsHull(h) { _partsHull = h || ''; }
function spriteFor(id) { if (_partsProc || !id) return null; return (_partsHull && PART_SPRITES[_partsHull + ':' + id]) || PART_SPRITES[id] || null; }
const CABLE_COL = { power: PAL.amber, data: PAL.cobalt, hydraulic: PAL.toxic };

// Положить спрайт на деталь. scale — масштаб картинки (px/px); по умолчанию вписать
// длинную сторону в 2R (диаметр массы). offX/offY — сдвиг точки крепления (пивота).
function setPartSprite(kind, img, scale, offX, offY, rot) {
  offX = offX || 0; offY = offY || 0; rot = rot || 0;   // rot — поворот СПРАЙТА (град) вокруг пивота, не трогает кинематику кости
  const sc = scale || ((TILE - 8) / Math.max(img.width, img.height));
  const w = img.width * sc, h = img.height * sc;
  PART_SPRITES[kind] = { img, w, h, px: w / 2 - offX, py: h / 2 - offY, nat: [img.width, img.height], scale: sc, offX, offY, rot };
}
function clearPartSprite(kind) { delete PART_SPRITES[kind]; }

// Авто-загрузка спрайтов для ИГРЫ (ключ = id детали/сегмента). Метаданные —
// из assets/scout/scout-rig.json (экспорт tools/rig_editor.html). Грузим из файлов
// `new Image()` — работает и при открытии index.html двойным кликом (file://),
// в отличие от fetch() самого JSON. Пути с пробелом — URL-кодируем.
// Ключи namespaced по корпусу (`scout:<id>`) — спрайты привязаны к типу юнита (см. spriteFor).
const PART_SPRITE_SRC = {
  'scout:reactor':    { url: 'assets/scout/reactor.png',     scale: 0.10050251256281408, offX: 0,    offY: 0,     rot: 0 },
  'scout:drill':      { url: 'assets/scout/drill.png',       scale: 0.10050251256281408, offX: 0,    offY: 0,     rot: 0 },
  'scout:hold':       { url: 'assets/scout/cargo.png',       scale: 0.101,               offX: 0,    offY: 0,     rot: 0 },
  'scout:engine':     { url: 'assets/scout/engine.png',      scale: 0.08048289738430583, offX: 0,    offY: 0,     rot: 0 },
  'scout:legR:thigh': { url: 'assets/scout/leg_01.png',      scale: 0.048,               offX: 13.4, offY: -10.2, rot: 100 },
  'scout:legR:shin':  { url: 'assets/scout/leg_02%201.png',  scale: 0.06,                offX: -0.9, offY: 7.4,   rot: 0 },
  'scout:legR:foot':  { url: 'assets/scout/leg_03.png',      scale: 0.055,               offX: -3,   offY: 7,     rot: 0 },
  'scout:legL:thigh': { url: 'assets/scout/leg_01.png',      scale: 0.048,               offX: 10.2, offY: -10.4, rot: 100 },
  'scout:legL:shin':  { url: 'assets/scout/leg_02%201.png',  scale: 0.06,                offX: 0.5,  offY: 7.4,   rot: 0 },
  'scout:legL:foot':  { url: 'assets/scout/leg_03.png',      scale: 0.055,               offX: -1,   offY: 7.7,   rot: 0 },
};
for (const k in PART_SPRITE_SRC) {
  const c = PART_SPRITE_SRC[k], im = new Image();
  im.onload = () => setPartSprite(k, im, c.scale, c.offX, c.offY, c.rot);
  im.src = c.url;
}

// Кибер-мускул между двумя узлами: провисающая дуга + бегущий импульс (абс. коорд.).
function drawCable(ctx, ax, ay, bx, by, type, t) {
  const sp = PART_SPRITES['cable'];
  if (sp) {  // ассет-кабель: тянется по длине A→B (стрейч при анимации)
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
    const hh = (TILE - 8) * 0.22;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.drawImage(sp.img, 0, -hh / 2, len, hh); ctx.restore();
    return;
  }
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const sag = Math.min(len * 0.22, 6);
  const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4.4;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  ctx.strokeStyle = CABLE_COL[type] || PAL.pewter; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
  const ph = (t * 0.7) % 1, u = 1 - ph;
  const qx = u * u * ax + 2 * u * ph * mx + ph * ph * bx;
  const qy = u * u * ay + 2 * u * ph * my + ph * ph * by;
  ctx.fillStyle = PAL.chalk; ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(qx, qy, 1.5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1;
}

// Враппер: общий трансформ + спрайт-или-процедура. angle/flip из рига. Спрайт
// ищем по ID детали (opts.id) — у каждой детали свой ассет. Если ассета нет и
// `proc:false` — деталь НЕ рисуется (и в редакторе не экспортируется).
function drawPart(ctx, kind, x, y, S, angle, flip, t, opts) {
  const sp = spriteFor(opts && opts.id);
  if (!sp && opts && opts.proc === false) return;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(angle || 0);
  if (sp) { if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180); ctx.drawImage(sp.img, -sp.px, -sp.py, sp.w, sp.h); }
  else if (kind === 'reactor') drawReactorPart(ctx, S, t);
  else if (kind === 'hold') drawHoldPart(ctx, S);
  else if (kind === 'sensor') drawSensorPart(ctx, S);
  else if (kind === 'drill') drawDrillPart(ctx, S);
  else if (kind === 'engine') drawEnginePart(ctx, S);
  else if (kind === 'weapon') drawWeaponPart(ctx, S);
  else if (kind === 'custom') drawCustomPart(ctx, S);
  ctx.restore();
}

// Нога — сегментный мини-риг (из rig.resolveLeg): кадр ноги (хип + зеркало),
// затем сегменты по z. Сегмент = спрайт (пивот в его точке) ИЛИ процедурная капсула
// пивот→стык. Порядок z задаёт перекрытие (стопа поверх голени и т.д.).
function drawLeg(ctx, leg, R) {
  ctx.save();
  ctx.translate(leg.hipX, leg.hipY);
  // поворот корпуса (вертикаль) — ДО зеркала, иначе flip разворачивает поворот в
  // обратную сторону и зеркальная (задняя) нога крутится не туда.
  if (leg.rot) ctx.rotate(leg.rot);
  if (leg.flip) ctx.scale(-1, 1);
  for (const sg of leg.segs) {
    const sp = spriteFor(sg.spriteId);
    if (sp) {  // пивот (центр вращения) = px/py спрайта (правится offX/offY/колесом в редакторе)
      ctx.save(); ctx.translate(sg.lx, sg.ly); ctx.rotate(sg.A - Math.PI / 2);
      if (sp.rot) ctx.rotate(sp.rot * Math.PI / 180);
      ctx.drawImage(sp.img, -sp.px, -sp.py, sp.w, sp.h);
      ctx.restore();
    } else {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#243a4a'; ctx.lineWidth = Math.max(3, sg.w * R);
      ctx.beginPath(); ctx.moveTo(sg.lx, sg.ly); ctx.lineTo(sg.jx, sg.jy); ctx.stroke();
      ctx.strokeStyle = '#6fa9c8'; ctx.lineWidth = Math.max(1, sg.w * R * 0.4);
      ctx.beginPath(); ctx.moveTo(sg.lx, sg.ly); ctx.lineTo(sg.jx, sg.jy); ctx.stroke();
    }
  }
  ctx.restore();
}

// --- процедурные детали (локальный кадр, центр 0,0, вперёд +X) ---
function platedBox(ctx, w, h, r, fill, edge) {
  ctx.beginPath();
  ctx.moveTo(-w / 2 + r, -h / 2);
  ctx.lineTo(w / 2 - r, -h / 2); ctx.lineTo(w / 2, -h / 2 + r);
  ctx.lineTo(w / 2, h / 2 - r); ctx.lineTo(w / 2 - r, h / 2);
  ctx.lineTo(-w / 2 + r, h / 2); ctx.lineTo(-w / 2, h / 2 - r);
  ctx.lineTo(-w / 2, -h / 2 + r); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = Math.max(1, w * 0.05); ctx.stroke();
}

function drawReactorPart(ctx, S, t) {
  const w = S * 1.5, h = S * 1.35;
  platedBox(ctx, w, h, S * 0.22, PAL.carbon, PAL.bronze);
  const pulse = ANIM.reactorPulse(t), cw = w * 0.42, ch = h * 0.5;
  ctx.fillStyle = PAL.night; ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  const gr = ctx.createRadialGradient(0, 0, 1, 0, 0, cw * 0.9);
  gr.addColorStop(0, `rgba(120,255,170,${0.55 + 0.4 * pulse})`);
  gr.addColorStop(0.5, `rgba(58,209,122,${0.4 + 0.3 * pulse})`);
  gr.addColorStop(1, 'rgba(20,60,40,0)');
  ctx.fillStyle = gr; ctx.fillRect(-cw, -ch, cw * 2, ch * 2);
  ctx.fillStyle = `rgba(180,255,210,${0.7 + 0.3 * pulse})`;
  ctx.fillRect(-cw * 0.12, -ch / 2, cw * 0.24, ch);
  ctx.fillStyle = PAL.ash;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * w * 0.4, sy * h * 0.38, S * 0.08, 0, 6.283); ctx.fill(); }
}

function drawHoldPart(ctx, S) {
  const w = S * 1.0, h = S * 1.05;
  platedBox(ctx, w, h, S * 0.18, PAL.bronze, PAL.carbon);
  ctx.fillStyle = PAL.cobalt;
  for (let i = -1; i <= 1; i++) ctx.fillRect(-w * 0.28, i * S * 0.26 - S * 0.04, w * 0.56, S * 0.07);
}

function drawSensorPart(ctx, S) {
  const lens = (lx, ly, r) => {
    ctx.fillStyle = PAL.night; ctx.beginPath(); ctx.arc(lx, ly, r + S * 0.05, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#bff4ff'; ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = PAL.cobalt; ctx.beginPath(); ctx.arc(lx, ly, r * 0.5, 0, 6.283); ctx.fill();
  };
  lens(S * 0.06, 0, S * 0.2);             // главная линза — вперёд (+X)
  lens(-S * 0.05, S * 0.34, S * 0.12);    // фланги — по перпендикуляру
  lens(-S * 0.05, -S * 0.34, S * 0.12);
}

function drawDrillPart(ctx, S) {
  const L = S * 0.95, W = S * 0.5;
  ctx.fillStyle = '#c9d2da';
  ctx.beginPath(); ctx.moveTo(L, 0); ctx.lineTo(0, W); ctx.lineTo(0, -W); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#7f8b96'; ctx.lineWidth = Math.max(1, S * 0.06); ctx.stroke();
  ctx.strokeStyle = 'rgba(50,60,70,0.7)'; ctx.lineWidth = Math.max(1, S * 0.05);
  for (let i = 1; i <= 3; i++) { const fx = i / 4; ctx.beginPath(); ctx.moveTo(L * fx, W * (1 - fx)); ctx.lineTo(L * (fx - 0.12), -W * (1 - fx + 0.12)); ctx.stroke(); }
  ctx.fillStyle = PAL.bronze; ctx.fillRect(-S * 0.18, -W, S * 0.18, W * 2);
}

function drawEnginePart(ctx, S) {  // основа ног — низкий широкий блок с креплениями
  const w = S * 1.4, h = S * 0.7;
  platedBox(ctx, w, h, S * 0.12, PAL.bronze, PAL.carbon);
  ctx.fillStyle = PAL.night;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * w * 0.32, h * 0.35, S * 0.16, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = PAL.amber; ctx.fillRect(-w * 0.18, -h * 0.18, w * 0.36, S * 0.07);
}

function drawWeaponPart(ctx, S) {  // ствол по направлению (+X)
  const L = S * 1.05, W = S * 0.34;
  platedBox(ctx, S * 0.5, W * 1.8, S * 0.1, PAL.carbon, PAL.bronze);  // казённик
  ctx.fillStyle = '#8a9099'; ctx.fillRect(0, -W / 2, L, W);            // ствол
  ctx.strokeStyle = PAL.carbon; ctx.lineWidth = Math.max(1, S * 0.05); ctx.strokeRect(0, -W / 2, L, W);
  ctx.fillStyle = PAL.bloodBright; ctx.beginPath(); ctx.arc(L, 0, W * 0.5, 0, 6.283); ctx.fill();  // дуло
}

function drawCustomPart(ctx, S) {  // плейсхолдер кастомной детали (до загрузки ассета)
  ctx.strokeStyle = PAL.pewter; ctx.lineWidth = Math.max(1, S * 0.06); ctx.setLineDash([S * 0.18, S * 0.12]);
  ctx.strokeRect(-S * 0.6, -S * 0.6, S * 1.2, S * 1.2); ctx.setLineDash([]);
  ctx.fillStyle = PAL.pewter; ctx.font = `${Math.round(S * 0.7)}px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', 0, 0); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
