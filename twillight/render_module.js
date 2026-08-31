'use strict';

// Иконки модулей (монохромная пиктограмма по категории слота: drill / engine /
// scanner / cargo). Используются в карточках инвентаря и при необходимости — в
// HUD. Цвет передаётся явно (берётся из MODULE_DEFS[type].color при вызове).
function drawModuleIcon(ctx, category, cx, cy, r, color) {
  color = color || '#cfe7ff';
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = color; ctx.strokeStyle = color;
  if (category === 'drill') {                  // бур: хвостовик + коронка
    ctx.fillRect(cx - r * 0.22, cy - r * 0.85, r * 0.44, r * 0.5);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy - r * 0.4); ctx.lineTo(cx + r * 0.55, cy - r * 0.4); ctx.lineTo(cx, cy + r * 0.9); ctx.closePath();
    ctx.fill();
  } else if (category === 'engine') {          // двигатель: шестерня
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 3); ctx.fillRect(-r * 0.14, -r * 0.86, r * 0.28, r * 0.3); ctx.restore(); }
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, TAU); ctx.fill();
  } else if (category === 'scanner') {         // сканер: концентрические дуги + точка
    ctx.lineWidth = Math.max(1.5, r * 0.13);
    for (const k of [0.95, 0.6]) {
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.15, r * k, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.15, r * 0.15, 0, TAU); ctx.fill();
  } else if (category === 'cargo') {           // трюм: сундук-силуэт
    ctx.fillRect(cx - r * 0.7, cy - r * 0.3, r * 1.4, r * 0.95);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - r * 0.65, cy + r * 0.12, r * 1.3, r * 0.1);
    ctx.fillStyle = color;
    ctx.beginPath();                            // крышка-арка
    ctx.moveTo(cx - r * 0.7, cy - r * 0.3); ctx.quadraticCurveTo(cx, cy - r * 0.95, cx + r * 0.7, cy - r * 0.3); ctx.fill();
  } else {                                     // фолбэк: ромб
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx + r * 0.7, cy); ctx.lineTo(cx, cy + r * 0.7); ctx.lineTo(cx - r * 0.7, cy); ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
