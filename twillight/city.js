'use strict';

// City — нарративный таймер гибернации. Реактор города стоит в юните, поэтому
// пока юнит вне базы, город обесточивается: идёт обратный отсчёт; на базе он
// сбрасывается. Когда отсчёт дошёл до нуля — город теряет HP по кольцам
// инфраструктуры; обнулённое кольцо не восстановить. Когда колец не осталось —
// город уходит в гибернацию (`dead`): канал связи ИИ с юнитом обрывается = конец
// игры. Кольца теряются снаружи внутрь (внешнее — первым).
class City {
  constructor() {
    this.timer = CITY_TIMER_MAX;
    this.rings = [];
    for (let i = 0; i < CITY_RINGS; i++) this.rings.push({ hp: CITY_RING_HP, max: CITY_RING_HP, lost: false });
    this.dying = false;
    this.dead = false;
  }

  totalHp() { return this.rings.reduce((s, r) => s + r.hp, 0); }
  maxHp() { return CITY_RINGS * CITY_RING_HP; }
  // внешнее (последний индекс) — текущее теряемое кольцо
  activeRing() {
    for (let i = this.rings.length - 1; i >= 0; i--) if (!this.rings[i].lost) return i;
    return -1;
  }

  // Прямой урон рейдом по кольцам (снаружи внутрь). Пробитое кольцо теряется
  // навсегда; если на базе — недопробитое активное кольцо позже дозарядится (update).
  damage(amount) {
    if (this.dead) return;
    let dmg = amount;
    while (dmg > 0) {
      const i = this.activeRing();
      if (i < 0) { this.dead = true; return; }
      const take = Math.min(dmg, this.rings[i].hp);
      this.rings[i].hp -= take; dmg -= take;
      if (this.rings[i].hp <= 0) { this.rings[i].hp = 0; this.rings[i].lost = true; }
    }
    if (this.activeRing() < 0) this.dead = true;
  }

  update(dt, atBase) {
    if (this.dead) return;

    if (atBase) {
      // на базе: таймер быстро дозаряжается (супер-чарж, не мгновенно),
      // недопотерянное кольцо восстановлено
      this.timer = Math.min(CITY_TIMER_MAX, this.timer + CITY_TIMER_RECHARGE * dt);
      this.dying = false;
      const i = this.activeRing();
      if (i >= 0) this.rings[i].hp = this.rings[i].max;
      return;
    }

    if (this.timer > 0) { this.timer = Math.max(0, this.timer - dt); return; }

    // таймер истёк — город гибнет: текущее кольцо теряет HP
    this.dying = true;
    const i = this.activeRing();
    if (i < 0) { this.dead = true; return; }
    this.rings[i].hp -= CITY_DMG * dt;
    if (this.rings[i].hp <= 0) {
      this.rings[i].hp = 0;
      this.rings[i].lost = true;
      if (this.activeRing() < 0) this.dead = true;
    }
  }
}
