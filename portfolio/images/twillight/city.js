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
    this.recharge = CITY_TIMER_RECHARGE;   // апгрейд СУПЕР-ЧАРДЖЕР поднимает скорость дозарядки на базе
    this.repairLvl = 0;     // АВТО-ПОЧИНКА: 0 нет, 1 ядро, 2 +внутр, 3 +внешний (кольца с индексом < repairLvl чинятся сами)
    this.repairRestore = false;   // узел РЕКОНСТРУКЦИЯ (amb_recon): автопочинка ВОЗВРАЩАЕТ утерянные контуры (в охвате repairLvl)
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
  applyUpgrades(timerBonus, ringBonus, repairLvl, recharge, repairRestore) {
    this.timerMax = CITY_TIMER_MAX + (timerBonus || 0);
    this.timer = Math.min(this.timerMax, this.timer);
    this.repairLvl = repairLvl || 0;
    this.repairRestore = !!repairRestore;
    this.recharge = recharge || CITY_TIMER_RECHARGE;
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i], m = CITY_RING_HP + ((ringBonus && ringBonus[i]) || 0);
      r.max = m; if (!r.lost) r.hp = m;
    }
  }

  // АВТО-ПОЧИНКА контуров (узел ГОРОД·Регенерация): кольца с индексом < repairLvl (ядро→внутр→внешний) медленно
  // регенят HP даже ВНЕ базы. Утерянное (lost) кольцо по умолчанию НЕ восстанавливается; узел РЕКОНСТРУКЦИЯ
  // (`repairRestore`, amb_recon) — воскрешает его (un-lost) и регенит HP с нуля тем же темпом.
  _autoRepair(dt) {
    for (let i = 0; i < this.repairLvl && i < this.rings.length; i++) {
      const r = this.rings[i];
      if (r.lost) { if (this.repairRestore && r.max > 0) r.lost = false; else continue; }   // реконструкция воскрешает контур
      if (r.hp < r.max) r.hp = Math.min(r.max, r.hp + CITY_REPAIR_RATE * dt);
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

  // Дренаж рейдером («сосальщик»): СНАЧАЛА «оперативная энергия» — таймер до гибернации (его база восстановит,
  // потому ранние набеги = «гони домой»); переполнение — HP активного кольца (контуры теперь как HP: на базе НЕ
  // лечатся, узел РЕКОНСТРУКЦИЯ может вернуть). Кольцо в 0 = lost. Так раннее давление мягче, но «загон» — рушит.
  drain(amount) {
    if (this.dead) return;
    const fromTimer = Math.min(this.timer, amount);
    this.timer -= fromTimer; amount -= fromTimer;
    while (amount > 0) {
      const i = this.activeRing();
      if (i < 0) { this.dead = true; return; }
      const r = this.rings[i];
      const take = Math.min(amount, r.hp);
      r.hp -= take; amount -= take;
      if (r.hp <= 0) { r.hp = 0; r.lost = true; }
    }
    if (this.activeRing() < 0) this.dead = true;
  }

  update(dt, atBase) {
    if (this.dead) return;
    this.charging = false; this.full = false;

    if (atBase) {
      // на базе: таймер дозаряжается (СУПЕР-ЧАРДЖЕР — быстрее). КОНТУРЫ как HP — НЕ лечатся сами: их значение
      // фиксируется на момент возврата (восстановить можно только авто-починкой/реконструкцией).
      if (this.timer < this.timerMax) { this.timer = Math.min(this.timerMax, this.timer + this.recharge * dt); this.charging = true; }
      else this.full = true;
      this.dying = false;
      this._autoRepair(dt);   // на базе авто-починка тоже идёт (если узлы куплены)
      return;
    }

    this._autoRepair(dt);   // вне базы контуры медленно чинятся сами (по уровню охвата)
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
