'use strict';

// Firewall — оборона базы от ВЗЛОМЩИКОВ диких. Хакеры встают вплотную к базе и «взламывают»:
// заполняют сегменты кибер-лабиринта. Чем больше активных хакеров — тем быстрее. Полный набор
// (`FIREWALL_SEGMENTS`) = ПРОБОЙ → гейм-овер. Юнит НА БАЗЕ обороняет (откатывает прогресс),
// узел ГОРОД·`amb_fw` замедляет взлом. Логика без Canvas; виджет — `render_firewall.js`.
class Firewall {
  constructor() { this.reset(); }
  reset() { this.hack = 0; this.active = 0; this.breached = false; this.segDone = 0; this.justSeg = false; }
  // active — число активных взломщиков; defended — юнит на базе; slow — владеет узлом amb_fw.
  update(dt, active, defended, slow) {
    this.active = active; this.justSeg = false;
    if (this.breached) return;
    this.hack += active * FIREWALL_HACK_RATE * (slow ? FIREWALL_FW_SLOW : 1) * dt;
    if (defended) this.hack -= FIREWALL_DEFEND_RATE * dt;       // на базе юнит обороняет — откат
    if (this.hack < 0) this.hack = 0;
    const seg = Math.floor(this.hack);                          // целые завершённые сегменты
    if (seg > this.segDone) { this.segDone = seg; this.justSeg = true; }   // событие: сегмент пробит (для лога/тревоги)
    else if (seg < this.segDone) this.segDone = seg;
    if (this.hack >= FIREWALL_SEGMENTS) { this.hack = FIREWALL_SEGMENTS; this.breached = true; }
  }
  // Виджет виден при активной атаке ИЛИ ненулевом прогрессе (показываем, пока есть угроза/след взлома).
  visible() { return this.active > 0 || this.hack > 0.001 || this.breached; }
}
