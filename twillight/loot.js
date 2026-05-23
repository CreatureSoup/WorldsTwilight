'use strict';

// Loot — выпавший ресурс в шахте. При выкапывании ресурсного тайла падает на пол
// (гравитация, по тайлам). Когда юнит проходит над дропом — он всасывается в
// гексы инвентаря; если мест нет — после всасывания выбрасывается обратно.
const DROP_GRAV = 1500;   // px/сек² — притяжение дропа
const DROP_VMAX = 900;    // px/сек — терминальная скорость падения
const DROP_REST = 0.66;   // доля тайла: где дроп «лежит» на полу
const SUCK_TIME = 0.14;   // сек — длительность всасывания в юнит
const PICKUP_ARM = 1.0;   // сек — дроп лежит на земле, прежде чем его можно подобрать

class Drop {
  constructor(x, y, type, cooldown = PICKUP_ARM) {
    this.tileX = x; this.tileY = y; this.type = type;
    this.px = x * TILE + TILE / 2;
    this.py = y * TILE + TILE / 2;
    this.vy = 0;
    this.cooldown = cooldown; // лежит на земле, пока не истечёт (нельзя подобрать)
    this.module = false;      // снятый модуль: лежит инертно (не подбирается авто)
    this.picked = false;      // идёт анимация всасывания → потом удаление
    this.suckT = 0;
  }

  grounded(world) { return isSolid(world.tileAt(this.tileX, this.tileY + 1)) || this.tileY + 1 >= MAP_H; }

  update(dt, world) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.vy = Math.min(DROP_VMAX, this.vy + DROP_GRAV * dt);
    this.py += this.vy * dt;
    const ty = Math.floor(this.py / TILE);
    if (ty > this.tileY) {
      while (this.tileY < ty) {
        if (isSolid(world.tileAt(this.tileX, this.tileY + 1)) || this.tileY + 1 >= MAP_H) { this.vy = 0; break; }
        this.tileY++;
      }
    } else if (ty < this.tileY) {       // подскок после выброса
      while (this.tileY > ty) {
        if (isSolid(world.tileAt(this.tileX, this.tileY - 1)) || this.tileY - 1 < 0) { this.py = this.tileY * TILE; this.vy = 0; break; }
        this.tileY--;
      }
    }
    if (this.grounded(world)) {
      const restY = this.tileY * TILE + TILE * DROP_REST;
      if (this.py >= restY && this.vy >= 0) { this.py = restY; this.vy = 0; }
    }
    this.px = this.tileX * TILE + TILE / 2;
  }

  // нет места: подпрыгнуть и по возможности соскочить с тайла юнита вбок
  eject(world, unit) {
    this.cooldown = PICKUP_ARM;
    this.vy = -260;
    for (const dx of [unit.dx || 1, -(unit.dx || 1)]) {
      if (world.tileAt(this.tileX + dx, this.tileY).type === AIR) { this.tileX = wrapX(this.tileX + dx); break; }
    }
  }
}

class Loot {
  constructor() { this.drops = []; }
  spawn(x, y, type, cooldown) { this.drops.push(new Drop(x, y, type, cooldown)); }
  spawnModule(x, y, type) { const d = new Drop(x, y, type); d.module = true; this.drops.push(d); }

  // Возвращает true, если в этот кадр модуль был переустановлен (для рефреша статов).
  update(dt, world, unit, inv) {
    let installed = false;
    for (const d of this.drops) {
      if (d.picked) {
        d.suckT += dt;
        d.px += (unit.px - d.px) * Math.min(1, dt * 18);
        d.py += (unit.py - d.py) * Math.min(1, dt * 18);
        continue;
      }
      d.update(dt, world);
      if (d.cooldown > 0) continue;        // ещё лежит — подобрать нельзя
      if (d.tileX !== unit.tileX || d.tileY !== unit.tileY) continue;
      if (d.module) {                       // модуль — переустановка на доску (как подбор)
        if (inv.tryInstall(d.type)) { d.picked = true; d.suckT = 0; installed = true; }
      } else {                              // ресурс — в гексы груза
        if (inv.addCargo(d.type)) { d.picked = true; d.suckT = 0; }
        else d.eject(world, unit);
      }
    }
    this.drops = this.drops.filter((d) => !(d.picked && d.suckT >= SUCK_TIME));
    return installed;
  }
}
