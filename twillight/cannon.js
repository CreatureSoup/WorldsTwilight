'use strict';

// АВТО-ТУРЕЛЬ КАНОНИРА (домешан в Game.prototype ПОСЛЕ game). Только у корпуса kind:'wheel' с установленной
// турелью (`unit.stats.turret`). Поворотная (медленный доворот через верх — aimOverTop, как городские/структурные),
// САМА бьёт ближайшего врага в радиусе по прямой видимости (хитскан + трассер). Ствол/купол/вспышку рисует
// render_wheel (по `unit._turretAim`/`_turretFlash`); трассеры — `drawUnitTurretFx`. ⚠️ боевые цели — только НЕ-friendly.
Object.assign(Game.prototype, {
  updateUnitTurret(dt) {
    const u = this.unit; if (!u) return;
    const tr = this._unitTurretTracers || (this._unitTurretTracers = []);
    for (let i = tr.length - 1; i >= 0; i--) { tr[i].life += dt; if (tr[i].life > STRUCT_TRACER_TTL) tr.splice(i, 1); }
    if (!u.stats || !u.stats.turret) return;                              // турель не установлена
    if (u._turretAim === undefined) u._turretAim = (u.faceX === -1 ? Math.PI : 0);   // ⚠️ та же rest-формула, что ленивый init в render_wheel.updateWheelSpin — ЕДИНАЯ поза старта (audit: два файла ставили разные)
    if (u._turretCd === undefined) u._turretCd = 0;
    if (u._turretCd > 0) u._turretCd -= dt;
    const rest = (u.faceX === -1) ? Math.PI : 0;   // ПОКОЙ = ствол по взгляду (aim=0 = канонический кадр редактора, ствол +X), не вверх
    if (this.mode !== 'playing' || !this.enemies || !this.enemies.length) { u._turretAim = aimOverTop(u._turretAim, rest, TURRET_TURN_RATE * dt * 0.6); return; }
    let best = null, bd = UNIT_TURRET_RANGE + 0.5;
    for (const e of this.enemies) {
      if (e.dying || e.dead || e.friendly) continue;                     // дружественную фракцию не бьём
      const d = Math.hypot(wrapDeltaPx(u.px, e.px), u.py - e.py) / TILE;
      if (d < bd && this.world.hasLineOfSight(u.px, u.py, e.px, e.py)) { bd = d; best = e; }   // не сквозь породу
    }
    if (!best) { u._turretAim = aimOverTop(u._turretAim, rest, TURRET_TURN_RATE * dt * 0.6); return; }
    const tgt = Math.atan2(best.py - u.py, wrapDeltaPx(best.px, u.px));
    u._turretAim = aimOverTop(u._turretAim, tgt, TURRET_TURN_RATE * dt);  // медленный доворот через верх
    if (turretAimed(u._turretAim, tgt) && u._turretCd <= 0) {
      u._turretCd = UNIT_TURRET_FIRECD; u._turretFlash = 0.06; best.damage(UNIT_TURRET_DMG);
      tr.push({ x1: u.px, y1: u.py, x2: best.px, y2: best.py, life: 0 });
    }
  },
});
