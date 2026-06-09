'use strict';

// Hints — крупные сюжетные подсказки (логика; рендер — render_hint.js). Очень короткий текст
// на ~⅓ высоты экрана, полупрозрачный, с плавным въездом/уходом. Показывается ОДНА за раз
// (новая вытесняет старую). Триггеры (в game): первая встреча объекта + подъём к поверхности.
class Hints {
  constructor() { this.cur = null; }
  clear() { this.cur = null; }
  show(text, dur) { this.cur = { text, t: 0, dur: dur || HINT_DUR }; }
  update(dt) { if (this.cur && (this.cur.t += dt) >= this.cur.dur) this.cur = null; }
  alpha() {
    if (!this.cur) return 0;
    const { t, dur } = this.cur;
    if (t < HINT_FADE) return t / HINT_FADE;
    if (t > dur - HINT_FADE) return Math.max(0, (dur - t) / HINT_FADE);
    return 1;
  }
}
