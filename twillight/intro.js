'use strict';

// Intro — короткая заставка старта забега: принтер печатает юнит, затем внутрь
// влетает реактор (источник энергии города). Чисто по таймеру; пропуск — Пробел.
const INTRO_PRINT = 1.0;    // сек — печать корпуса (заливка снизу вверх)
const INTRO_REACTOR = 0.9;  // сек — реактор влетает из принтера в юнит
const INTRO_SETTLE = 0.7;   // сек — вспышка установки и синхронизация
const INTRO_DUR = INTRO_PRINT + INTRO_REACTOR + INTRO_SETTLE;

class Intro {
  constructor() { this.t = 0; this.done = false; }
  reset() { this.t = 0; this.done = false; }
  update(dt) { this.t += dt; if (this.t >= INTRO_DUR) this.done = true; }
}
