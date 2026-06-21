'use strict';

// Input — held-state по физическим кодам (e.code), раскладко-независимо.
class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();
    const prevent = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (prevent.has(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.justPressed.clear(); });
  }
  up()    { return this.keys.has('KeyW') || this.keys.has('ArrowUp'); }
  down()  { return this.keys.has('KeyS') || this.keys.has('ArrowDown'); }
  left()  { return this.keys.has('KeyA') || this.keys.has('ArrowLeft'); }
  right() { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); }
  pressed(...c) { return c.some((k) => this.justPressed.has(k)); }
  endFrame() { this.justPressed.clear(); }
}
