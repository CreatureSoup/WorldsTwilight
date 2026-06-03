'use strict';

// City — нарративный таймер гибернации. Реактор города стоит в юните, поэтому
// пока юнит вне базы, город обесточивается: идёт обратный отсчёт; на базе он
// дозаряжается (`charging`). Когда отсчёт дошёл до нуля — город теряет HP по кольцам
// инфраструктуры; обнулённое кольцо не восстановить. Когда колец не осталось —
// город уходит в гибернацию (`dead`) = конец игры. Кольца теряются снаружи внутрь.
// `timerMax` и HP колец АПГРЕЙДЯТСЯ в сессии (апгрейды города: «батареи»/«контуры»).
class City {
  constructor() {
    this.timerMax = CITY_TIMER_MAX;       // апгрейд «ёмкость батарей» поднимает
    this.timer = this.timerMax;
    this.rings = [];                       // прочность каждого кольца апгрейдится отдельно
    for (let i = 0; i < CITY_RINGS; i++) this.rings.push({ hp: CITY_RING_HP, max: CITY_RING_HP, lost: false });
    this.dying = false;
    this.dead = false;
    this.charging = false;  // на базе и таймер растёт
    this.full = false;      // на базе и таймер полон
  }

  totalHp() { return this.rings.reduce((s, r) => s + r.hp, 0); }
  maxHp() { return this.rings.reduce((s, r) => s + (r.lost ? 0 : r.max), 0); }
  activeRing() {
    for (let i = this.rings.length - 1; i >= 0; i--) if (!this.rings[i].lost) return i;
    return -1;
  }

  // Апгрейды города (in-session): запас таймера + прочность КАЖDОГО кольца отдельно
  // (`ringBonus[i]` по индексу: 0=ядро, последнее=внешний). Живые кольца дозаряжаются
  // до нового максимума (награда за покупку).
  applyUpgrades(timerBonus, ringBonus) {
    this.timerMax = CITY_TIMER_MAX + (timerBonus || 0);
    this.timer = Math.min(this.timerMax, this.timer);
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i], m = CITY_RING_HP + ((ringBonus && ringBonus[i]) || 0);
      r.max = m; if (!r.lost) r.hp = m;
    }
  }

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
    this.charging = false; this.full = false;

    if (atBase) {
      // на базе: таймер дозаряжается (супер-чарж), недопотерянное кольцо восстановлено
      if (this.timer < this.timerMax) { this.timer = Math.min(this.timerMax, this.timer + CITY_TIMER_RECHARGE * dt); this.charging = true; }
      else this.full = true;
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
