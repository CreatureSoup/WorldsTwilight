'use strict';

// Экранные меню: главное, пауза и общий рендер кнопок.
function drawButtons(ctx, buttons) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of buttons) {
    ctx.fillStyle = b.primary ? '#1f7a44' : 'rgba(20,40,55,0.95)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.primary ? '#5fe08a' : '#46c6ff';
    ctx.lineWidth = 2; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = '#eaf6ff'; ctx.font = 'bold 17px monospace';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawMainMenu(ctx, save, buttons, W, H) {
  ctx.fillStyle = '#0a0e14'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#46c6ff'; ctx.font = 'bold 40px monospace';
  ctx.fillText('TWILIGHT OF THE WORLD', W / 2, H / 2 - 130);
  ctx.fillStyle = '#9fb3c8'; ctx.font = '16px monospace';
  ctx.fillText('Сумерки мира — M0 прототип', W / 2, H / 2 - 96);
  ctx.fillStyle = '#7fd7ff'; ctx.font = '15px monospace';
  ctx.fillText(`Лучшая глубина: ${save.bestDepth}     Запусков: ${save.runs}`, W / 2, H / 2 - 40);
  drawButtons(ctx, buttons);
  ctx.textAlign = 'left';
}

function drawPauseMenu(ctx, buttons, W, H) {
  ctx.fillStyle = 'rgba(5,8,12,0.78)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfe7ff'; ctx.font = 'bold 36px monospace';
  ctx.fillText('ПАУЗА', W / 2, H / 2 - 120);
  drawButtons(ctx, buttons);
  ctx.textAlign = 'left';
}

function drawGameOver(ctx, buttons, W, H, reason) {
  ctx.fillStyle = 'rgba(20,5,5,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const unit = reason === 'unit';
  ctx.fillStyle = '#ff7a7a'; ctx.font = 'bold 40px monospace';
  ctx.fillText(unit ? 'ЮНИТ РАЗРУШЕН' : 'СВЯЗЬ ПОТЕРЯНА', W / 2, H / 2 - 130);
  ctx.fillStyle = '#caa6a6'; ctx.font = '15px monospace';
  ctx.fillText(unit ? 'Скверна разъела корпус' : 'Город ушёл в гибернацию — канал связи оборван', W / 2, H / 2 - 96);
  drawButtons(ctx, buttons);
  ctx.textAlign = 'left';
}
