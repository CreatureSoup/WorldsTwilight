'use strict';

// Visions — редкие призрачные «видения» в неосвещённой части экрана (логика; рендер —
// render_visions.js). Грандиозные пугающие силуэты (пейзажи / гиганты-роботы) наплывают
// из-за края экрана со стороны, ПРОТИВОПОЛОЖНОЙ взгляду юнита (там темно, прожектор светит
// в сторону `faceX`), медленно дрейфуют внутрь, еле видны, потом сами растворяются.
// Триггеры появления: юнит ДОЛГО СТОИТ на месте (ускоряет) ИЛИ просто прошло время.
// При повороте взгляда В СТОРОНУ видения — оно исчезает МГНОВЕННО.
class Visions {
  constructor() {
    this.list = [];
    this.timer = VISION_MIN_GAP + Math.random() * (VISION_MAX_GAP - VISION_MIN_GAP);
    this.idleT = 0;
    this._lpx = undefined; this._lpy = undefined;
  }
  clear() { this.list.length = 0; }

  update(dt, unit, W, H) {
    if (!unit) { this.list.length = 0; return; }
    // простой юнита: позиция не меняется и не бурит
    const moved = (this._lpx !== undefined && (Math.abs(unit.px - this._lpx) > 0.5 || Math.abs(unit.py - this._lpy) > 0.5)) || unit.drilling;
    this._lpx = unit.px; this._lpy = unit.py;
    this.idleT = moved ? 0 : this.idleT + dt;

    // таймер до следующего видения; в простое тикает быстрее
    const rate = 1 + (this.idleT > VISION_IDLE_AFTER ? VISION_IDLE_RATE - 1 : 0);
    this.timer -= dt * rate;
    if (this.timer <= 0 && this.list.length < VISION_MAX) {
      this._spawn(unit, W, H);
      this.timer = VISION_MIN_GAP + Math.random() * (VISION_MAX_GAP - VISION_MIN_GAP);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const v = this.list[i]; this._step(v, dt, unit);
      if (v.dead) this.list.splice(i, 1);
    }
  }

  _spawn(unit, W, H) {
    const side = -(unit.faceX || 1);                          // тёмная сторона = напротив взгляда (−1 лево / +1 право)
    const type = ['monster', 'landscape', 'tendrils', 'idol', 'glyphs'][(Math.random() * 5) | 0];
    let bw, bh, x, y;
    if (type === 'monster') { bw = W * 0.5; bh = H * 0.96; x = side < 0 ? -bw * 0.5 : W - bw * 0.5; y = H - bh * 0.97; }   // гигант стоит, голова у верха
    else if (type === 'idol') { bw = W * 0.42; bh = H * 0.9; x = side < 0 ? -bw * 0.5 : W - bw * 0.5; y = H - bh * 0.97; } // колоссальный идол-тотем
    else if (type === 'landscape') { bw = W * 0.64; bh = H * 0.72; x = side < 0 ? -bw * 0.5 : W - bw * 0.5; y = H * 0.30; }
    else if (type === 'glyphs') { bw = W * 0.56; bh = H * 0.22; x = side < 0 ? -bw * 0.4 : W - bw * 0.6; y = H * (0.24 + Math.random() * 0.4); }  // лента ацтек-узоров (бегут L→R)
    else { bw = W * 0.24; bh = H * 0.5; x = side < 0 ? -bw * 0.25 : W - bw * 0.75; y = H * (0.26 + Math.random() * 0.36); }  // tendrils — самостоятельный призрак у тёмного края
    this.list.push({
      type, seed: (Math.random() * 1e9) >>> 0, side, x, y, w: bw, h: bh,
      vx: (side < 0 ? VISION_SPEED : -VISION_SPEED) * (0.7 + Math.random() * 0.6),
      vy: (Math.random() - 0.5) * 2,
      t: 0, alpha: 0, dead: false, diss: false,
    });
  }

  _step(v, dt, unit) {
    v.t += dt; v.x += v.vx * dt; v.y += v.vy * dt;
    // взгляд повернулся В СТОРОНУ видения → мгновенное растворение
    if ((unit.faceX || 1) === v.side) v.diss = true;
    if (v.diss) {
      v.alpha -= (VISION_ALPHA / VISION_DISSIPATE) * dt;
      if (v.alpha <= 0) { v.alpha = 0; v.dead = true; }
      return;
    }
    // огибающая видимости: проявление → жизнь → самостоятельное растворение
    const tIn = VISION_FADE_IN, tFull = tIn + VISION_LIFE, tEnd = tFull + VISION_FADE_OUT;
    let a;
    if (v.t < tIn) a = v.t / tIn;
    else if (v.t < tFull) a = 1;
    else if (v.t < tEnd) a = 1 - (v.t - tFull) / VISION_FADE_OUT;
    else { a = 0; v.dead = true; }
    v.alpha = a * VISION_ALPHA;
  }
}
