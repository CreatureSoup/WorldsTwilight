'use strict';

// Loot — выпавший ресурс в шахте. При выкапывании ресурсного тайла падает на пол
// (гравитация, по тайлам). Когда юнит проходит над дропом — он всасывается в трюм;
// если трюм ПОЛОН — дроп НЕ подбирается и остаётся лежать (заберём после сдачи).
// ⚠️ ТЮНИНГ (DROP_*/SUCK_*/PICKUP_*) — в constants.js, секция «ТЮНИНГ ПОДСИСТЕМ» (audit_2026-08).

class Drop {
  constructor(x, y, type, cooldown = PICKUP_ARM) {
    this.tileX = x; this.tileY = y; this.type = type;
    this.px = x * TILE + TILE / 2;
    this.py = y * TILE + TILE / 2;
    this.vy = 0;
    this.cooldown = cooldown; // лежит на земле, пока не истечёт (нельзя подобрать)
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
}

class Loot {
  constructor() { this.drops = []; }
  spawn(x, y, type, cooldown) { this.drops.push(new Drop(x, y, type, cooldown)); }

  // Модули во время забега не выпадают (in-game removal убрали из дизайна).
  // Дроп — только ресурсы; подбор увеличивает счётчик груза до `inventory.cargoCapacity()`.
  // `rBonus` — прибавка радиуса подхвата (гаджет «Авто-сборщик»).
  update(dt, world, unit, inv, rBonus) {
    const R = PICKUP_R + (rBonus || 0);
    for (const d of this.drops) {
      if (d.picked) {
        d.suckT += dt;
        d.ux = unit.px; d.uy = unit.py;                  // позиция юнита — для рисовки лап-граберов
        const t = Math.min(1, d.suckT / SUCK_TIME);
        const ease = t * t;                              // плавно тянем (ускоряется к концу)
        d.px = d.sx + (unit.px - d.sx) * ease;
        d.py = d.sy + (unit.py - d.sy) * ease;
        continue;
      }
      d.update(dt, world);
      if (d.cooldown > 0) continue;        // ещё лежит — подобрать нельзя
      if (inv.cargoFree() <= 0) continue;  // трюм полон — НЕ подбираем (дроп остаётся лежать, заберём после сдачи)
      const dxw = Math.abs(((d.tileX - unit.tileX) % MAP_W + MAP_W) % MAP_W); // радиус подхвата (тороидально по X)
      if (Math.min(dxw, MAP_W - dxw) > R || Math.abs(d.tileY - unit.tileY) > R) continue;
      if (inv.addCargo(d.type)) { d.picked = true; d.suckT = 0; d.sx = d.px; d.sy = d.py; d.ux = unit.px; d.uy = unit.py; }
    }
    this.drops = this.drops.filter((d) => !(d.picked && d.suckT >= SUCK_TIME));
  }
}
