'use strict';

// Firewall — оборона базы от ВЗЛОМЩИКОВ диких. Хакеры встают вплотную к базе и «взламывают»:
// заполняют сегменты кибер-лабиринта. Чем больше активных хакеров — тем быстрее. Полный набор
// (`FIREWALL_SEGMENTS`) = ПРОБОЙ → гейм-овер. ⚠️ ЮНИТ НИКАК НЕ влияет на взлом (защита = УБИТЬ хакеров
// турелями/боем); без активных хакеров файрволл МЕДЛЕННО самовосстанавливается (`FIREWALL_DECAY`).
// Узел ГОРОД·`amb_fw` замедляет взлом. Логика без Canvas; виджет — `render_firewall.js`.
class Firewall {
  constructor() { this.reset(); }
  reset() { this.hack = 0; this.active = 0; this.breached = false; this.segDone = 0; this.justSeg = false; }
  // active — число активных взломщиков; slow — владеет узлом amb_fw. (Юнит на взлом НЕ влияет.)
  update(dt, active, slow) {
    this.active = active; this.justSeg = false;
    if (this.breached) return;
    if (active > 0) this.hack += active * FIREWALL_HACK_RATE * (slow ? FIREWALL_FW_SLOW : 1) * dt;
    else this.hack -= FIREWALL_DECAY * dt;                      // нет хакеров — медленное самовосстановление (юнит ни при чём)
    if (this.hack < 0) this.hack = 0;
    const seg = Math.floor(this.hack);                          // целые завершённые сегменты
    if (seg > this.segDone) { this.segDone = seg; this.justSeg = true; }   // событие: сегмент пробит (для лога/тревоги)
    else if (seg < this.segDone) this.segDone = seg;
    if (this.hack >= FIREWALL_SEGMENTS) { this.hack = FIREWALL_SEGMENTS; this.breached = true; }
  }
  // Виджет виден при активной атаке ИЛИ ненулевом прогрессе (показываем, пока есть угроза/след взлома).
  visible() { return this.active > 0 || this.hack > 0.001 || this.breached; }
}
