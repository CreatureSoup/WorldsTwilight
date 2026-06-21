'use strict';

// Camera — сглаженное следование за юнитом. Мир закольцован по X: камера держится в
// [0, WORLD_W), следует кратчайшим путём через шов, а сущности позиционируются через
// screenX (ближайшая «копия» по кольцу). По Y — обычные клампы.
class Camera {
  constructor(viewW, viewH) { this.x = 0; this.y = 0; this.viewW = viewW; this.viewH = viewH; }
  resize(w, h) { this.viewW = w; this.viewH = h; }
  snap(u) {
    this.x = wrapPx(u.px - this.viewW / 2);
    this.y = u.py - this.viewH / 2; this.clampY();
  }
  clampY() {
    const maxY = MAP_H * TILE - this.viewH;
    this.y = Math.min(this.y, Math.max(0, maxY));
    this.y = Math.max(-2 * TILE, this.y);
  }
  follow(u, dt) {
    const k = 1 - Math.pow(0.001, dt);
    this.x = wrapPx(this.x + wrapDeltaPx(u.px - this.viewW / 2, this.x) * k); // кратчайший путь через шов
    this.y += (u.py - this.viewH / 2 - this.y) * k;
    this.clampY();
  }
  // Экранная X для мирового px: ближайшая копия по кольцу (видимая попадёт в [0,viewW]).
  screenX(px) {
    let s = wrapPx(px) - this.x;
    if (s < -WORLD_W / 2) s += WORLD_W; else if (s >= WORLD_W / 2) s -= WORLD_W;
    return s;
  }
}
