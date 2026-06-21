'use strict';

// Отрисовка частиц (Dust):
//  • КРОШКА ('grit'/'pebble') — чёткие мелкие квадраты (каменные сколы), `bone`/`ash`;
//  • ПЫЛЬ ('fine') — мягкий полупрозрачный КЛУБ (лёгкая дымка): один КЭШИРОВАННЫЙ радиальный спрайт
//    (создан ОДИН раз), per-частица — `drawImage` со scale (расплывается) + альфа. Не дискретные точки.
// Перф: спрайт-клуб делается единожды (не офскрин-на-кадр), `drawImage` дешёв; крошка — `fillRect`.
let _dustPuff = null;
function _dustPuffSprite() {
  if (_dustPuff) return _dustPuff;
  const S = 48, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  // `bone` (184,168,150). РОВНАЯ серёдка (без яркого центра-«светлячка»), мягкий спад только у КРАЯ.
  const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(184,168,150,0.30)');
  g.addColorStop(0.6, 'rgba(184,168,150,0.27)');
  g.addColorStop(0.85, 'rgba(184,168,150,0.12)');
  g.addColorStop(1, 'rgba(184,168,150,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  _dustPuff = cv; return cv;
}

function drawDust(ctx, dust, camera) {
  if (!dust || !dust.parts.length) return;
  const puff = _dustPuffSprite();
  for (const p of dust.parts) {
    const a = Math.max(0, 1 - p.life / p.ttl);
    const sx = camera.screenX(p.px), sy = p.py - camera.y;
    if (p.kind === 'fine') {                          // мягкий клуб: растёт по жизни (дисперсия дымки), тон/мягкость в спрайте
      const sz = p.size * (1 + p.life * 0.8);
      ctx.globalAlpha = a;
      ctx.drawImage(puff, sx - sz / 2, sy - sz / 2, sz, sz);
      continue;
    }
    const pebble = p.kind === 'pebble';
    ctx.globalAlpha = a * (pebble ? 0.92 : 0.7);
    ctx.fillStyle = pebble ? PAL.ash : PAL.bone;
    const s = p.size;
    ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}
