'use strict';

// Ассеты модулей: узнаваемые монохромные иконки по типу. Используются и в ядре
// (тёмным силуэтом на цветном гексе), и для дропов модулей на земле (цветом).
// Модуль как объект: его гекс-форма (в цвете) + иконка по центру. Общий ассет для
// инвентаря (полка) и дропов в мире — размер ∝ числу гексов (cellR на гекс).
function drawModulePiece(ctx, type, cx, cy, cellR) {
  const def = MODULE_DEFS[type];
  const pts = def.shape.map(([q, r]) => ({ x: cellR * SQRT3 * (q + r / 2), y: cellR * 1.5 * r }));
  const ax = pts.reduce((s, p) => s + p.x, 0) / pts.length, ay = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  for (const p of pts) {
    hexPath(ctx, cx + p.x - ax, cy + p.y - ay, cellR * 0.9);
    ctx.fillStyle = def.color; ctx.fill();
    ctx.lineWidth = Math.max(1, cellR * 0.06); ctx.strokeStyle = '#0d1117'; ctx.stroke();
  }
  drawModuleIcon(ctx, type, cx, cy, cellR * 0.55, '#0d1117');
}

function drawModuleIcon(ctx, type, cx, cy, r, color) {
  color = color || (MODULE_DEFS[type] ? MODULE_DEFS[type].color : '#cfe7ff');
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (type === 'battery') {                       // реактор: ядро + лучи-контакты
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 6.283); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.2);
    for (const a of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6]) {
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95); ctx.stroke();
    }
  } else if (type === 'drill') {                  // бур: хвостовик + коронка
    ctx.fillRect(cx - r * 0.22, cy - r * 0.85, r * 0.44, r * 0.5);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy - r * 0.4); ctx.lineTo(cx + r * 0.55, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.9); ctx.closePath(); ctx.fill();
  } else if (type === 'engine') {                 // двигатель: шестерня
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, 6.283); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 3); ctx.fillRect(-r * 0.14, -r * 0.86, r * 0.28, r * 0.3); ctx.restore(); }
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, 6.283); ctx.fill();
  } else if (type === 'casing') {                 // кожух: щит
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx + r * 0.7, cy - r * 0.4); ctx.lineTo(cx + r * 0.7, cy + r * 0.2);
    ctx.quadraticCurveTo(cx + r * 0.7, cy + r * 0.78, cx, cy + r * 0.9);
    ctx.quadraticCurveTo(cx - r * 0.7, cy + r * 0.78, cx - r * 0.7, cy + r * 0.2);
    ctx.lineTo(cx - r * 0.7, cy - r * 0.4); ctx.closePath(); ctx.fill();
  } else {                                        // кабель/прочее: перемычка с контактами
    ctx.lineWidth = Math.max(2, r * 0.34);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - r * 0.5, cy, r * 0.26, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.5, cy, r * 0.26, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}
