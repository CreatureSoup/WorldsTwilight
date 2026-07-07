'use strict';

// Dust — косметические частицы (логика без Canvas, рендер в render_dust.js). Два «материала»:
//  • КРОШКА ('grit' + редкий 'pebble') — грубые частицы, падают по обычной гравитации;
//  • ПЫЛЬ ('fine') — мельчайшая, ЛЁГКАЯ: медленно оседает (терминальная скорость) + боковой дрейф,
//    долго висит (как осыпь в штольне: сеется струйками и частично зависает). НЕ дым — отдельные крапинки.
// Источники: БУРЕНИЕ (крошка + пыль ВМЕСТЕ, от грани блока к юниту); ФОН с «потолка» (рандомно крошка /
// пыль / вместе, РЕДКО, только в видимом окне). Потолок `DUST_MAX` частиц (перф).
class Dust {
  constructor() { this.parts = []; this._drillT = 0; this._ambT = 0; }
  _push(p) { if (this.parts.length < DUST_MAX) this.parts.push(p); }

  _grit(px, py, vx, vy, pebble) {
    this._push({ kind: pebble ? 'pebble' : 'grit', px, py, vx, vy,
      size: pebble ? 2.1 + Math.random() * 1.2 : 1.0 + Math.random() * 1.0,
      life: 0, ttl: pebble ? 0.9 + Math.random() * 0.5 : 0.4 + Math.random() * 0.4 });
  }
  _fine(px, py, vx, vy, ttl) {   // size — БАЗОВЫЙ диаметр клуба (растёт в рендере по жизни)
    this._push({ kind: 'fine', px, py, vx, vy, size: 9 + Math.random() * 5, seed: Math.random() * 6.283, life: 0, ttl });
  }

  // БУРЕНИЕ: порция КРОШКИ с грани блока В СТОРОНУ юнита + лёгкая ПЫЛЬ вместе (медленный пуф, потом висит).
  drill(dt, unit) {
    if (!unit.drilling) { this._drillT = 0; return; }
    this._drillT -= dt;
    if (this._drillT > 0) return;
    this._drillT = DUST_DRILL_DT;
    const bx = unit.drillX * TILE + TILE / 2, by = unit.drillY * TILE + TILE / 2;
    const dx = wrapDeltaPx(unit.px, bx), dy = unit.py - by, d = Math.hypot(dx, dy) || 1, nx = dx / d, ny = dy / d;
    const n = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const sx = bx + nx * TILE * 0.42 + (Math.random() - 0.5) * TILE * 0.5, sy = by + ny * TILE * 0.42 + (Math.random() - 0.5) * TILE * 0.5;
      const sp = TILE * (1.1 + Math.random() * 1.5);
      this._grit(sx, sy, nx * sp + (Math.random() - 0.5) * TILE, ny * sp - Math.random() * TILE * 0.7, Math.random() < 0.12);
    }
    const fn = 1 + (Math.random() * 2 | 0);   // дымка вместе с бурением — мягкие клубы, слабо плывут к юниту, расплываются и висят
    for (let i = 0; i < fn; i++) {
      const sx = bx + nx * TILE * 0.4 + (Math.random() - 0.5) * TILE * 0.6, sy = by + ny * TILE * 0.4 + (Math.random() - 0.5) * TILE * 0.6;
      this._fine(sx, sy, nx * TILE * 0.3 + (Math.random() - 0.5) * TILE * 0.25, ny * TILE * 0.3 - Math.random() * TILE * 0.2, 1.4 + Math.random() * 1.0);
    }
  }

  // БУРЕНИЕ ЩИТА-ПРОХОДЧИКА (автономный винтовой щит): как `drill()`, но крошка+пыль сыплются у ФРЕЗЫ и летят
  // НАЗАД (против хода проходки) + гравитация. Таймер НА самом щите (`b._dustT`) → несколько щитов сыпят
  // независимо. Только пока щит грызёт породу (`b.drilling`). Тот же материал/темп, что у дефолтного бура.
  borerDrill(dt, b) {
    if (!b || !b.drilling) { if (b) b._dustT = 0; return; }
    b._dustT = (b._dustT || 0) - dt;
    if (b._dustT > 0) return;
    b._dustT = DUST_DRILL_DT;
    const fx = b.px + b.dx * TILE * 0.5, fy = b.py + b.dy * TILE * 0.5;   // фреза-фронт по ходу проходки
    const nx = -b.dx, ny = -b.dy;                                          // крошка ОТЛЕТАЕТ назад (против хода) + гравитация
    const n = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < n; i++) {
      const sx = fx + (Math.random() - 0.5) * TILE * 0.45, sy = fy + (Math.random() - 0.5) * TILE * 0.45;
      const sp = TILE * (1.0 + Math.random() * 1.3);
      this._grit(sx, sy, nx * sp + (Math.random() - 0.5) * TILE * 0.6, ny * sp - Math.random() * TILE * 0.6, Math.random() < 0.12);
    }
    const fn = 1 + (Math.random() * 1 | 0);   // дымка вместе с бурением
    for (let i = 0; i < fn; i++) {
      const sx = fx + (Math.random() - 0.5) * TILE * 0.4, sy = fy + (Math.random() - 0.5) * TILE * 0.4;
      this._fine(sx, sy, nx * TILE * 0.3 + (Math.random() - 0.5) * TILE * 0.22, ny * TILE * 0.3 - Math.random() * TILE * 0.2, 1.4 + Math.random());
    }
  }

  // РАЗОВЫЙ «развал» тайла: крошка во все стороны + пыль (импульсный бур — порода не исчезает, а рассыпается).
  burst(px, py) {
    const n = 7 + (Math.random() * 4 | 0);               // погуще — тайл реально «разваливается», а не исчезает
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = TILE * (1.3 + Math.random() * 2.2);
      this._grit(px + (Math.random() - 0.5) * TILE * 0.6, py + (Math.random() - 0.5) * TILE * 0.6,
        Math.cos(a) * sp, Math.sin(a) * sp - Math.random() * TILE * 0.6, Math.random() < 0.22);
    }
    const fn = 2 + (Math.random() * 2 | 0);
    for (let i = 0; i < fn; i++)
      this._fine(px + (Math.random() - 0.5) * TILE * 0.6, py + (Math.random() - 0.5) * TILE * 0.6,
        (Math.random() - 0.5) * TILE * 0.35, -Math.random() * TILE * 0.25, 1.2 + Math.random() * 0.9);
  }

  // ФОН: РЕДКО, из-под потолка (воздух с породой СВЕРХУ) в видимом окне; рандомно — крошка / пыль / вместе.
  ambient(dt, world, camera) {
    this._ambT -= dt;
    if (this._ambT > 0) return;
    this._ambT = DUST_AMBIENT_DT * (0.6 + Math.random() * 0.9);
    const tx0 = Math.floor(camera.x / TILE), txN = Math.ceil(camera.viewW / TILE) + 1;
    const ty0 = Math.max(0, Math.floor(camera.y / TILE)), tyN = Math.ceil(camera.viewH / TILE) + 1;
    for (let tries = 0; tries < 10; tries++) {
      const tx = tx0 + (Math.random() * txN | 0), ty = ty0 + (Math.random() * tyN | 0);
      if (world.tileAt(tx, ty).type !== AIR || !isSolid(world.tileAt(tx, ty - 1))) continue;   // нужен воздух ПОД породой = потолок
      const px = tx * TILE + TILE * (0.2 + Math.random() * 0.6), py = ty * TILE + 1;
      let grit = Math.random() < 0.55, fine = Math.random() < 0.6;   // рандомно: крошка / пыль / вместе
      if (!grit && !fine) fine = true;
      if (grit) this._grit(px, py, (Math.random() - 0.5) * TILE * 0.3, Math.random() * TILE * 0.3, Math.random() < DUST_PEBBLE_P);
      if (fine) {   // дымка-струйка: мягкие клубы сеются вниз и расплываются, висят
        const k = 2 + (Math.random() * 2 | 0);
        for (let i = 0; i < k; i++) this._fine(px + (Math.random() - 0.5) * TILE * 0.4, py + i * 4, (Math.random() - 0.5) * TILE * 0.12, TILE * (0.05 + Math.random() * 0.08), 1.8 + Math.random() * 1.4);
      }
      return;
    }
  }

  update(dt) {
    for (const p of this.parts) {
      p.life += dt;
      if (p.kind === 'fine') {                                          // лёгкое оседание (терминалка) + боковой дрейф
        p.vy = Math.min(p.vy + DUST_FINE_GRAV * dt, DUST_FINE_VT);
        p.px += (p.vx + Math.sin(p.life * 2.4 + p.seed) * DUST_FINE_SWAY) * dt;
        p.py += p.vy * dt;
      } else {                                                          // крошка — обычная гравитация + затухание гориз. скорости
        p.px += p.vx * dt; p.py += p.vy * dt; p.vy += DUST_GRAV * dt; p.vx *= (1 - Math.min(1, dt * 1.6));
      }
    }
    this.parts = this.parts.filter((p) => p.life < p.ttl);
  }
  clear() { this.parts.length = 0; }
}
