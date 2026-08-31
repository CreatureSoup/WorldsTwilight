'use strict';

// RadarCompass — состояние ДЕТЕКТОРА ЗАГРЯЗНЕНИЯ (свойство сканера, узел меты `mast_sr`).
// Дизайн-метафора — «Гейгер-ветер» (потомок старого КОЖУХА): радиационная морось влетает в линзу
// СО СТОРОНЫ очага (арка по пеленгу) и стягивается в центральное ядро-сенсор (вспышка на попадании).
// Направление читается по тому, ОТКУДА сыпет; намеренно НЕ точно/«живо»: пеленг медленно рыщет,
// а частицы приходят ВЕЕРОМ — широким при слабом сигнале (далеко), узким у самого очага.
// Частицы — в НОРМАЛИЗОВАННЫХ коорд. (линза радиуса 1), рендер масштабирует. Логика отдельно (render_radar.js).
// ⚠️ ТЮНИНГ (RADAR_*) — в constants.js, секция «ТЮНИНГ ПОДСИСТЕМ» (audit_2026-08).

class RadarCompass {
  constructor() { this.dir = -Math.PI / 2; this.signal = 0; this.has = false; this.t = 0; this.parts = []; this.acc = 0; this.flash = 0; }
  reset() { this.signal = 0; this.has = false; this.parts.length = 0; this.acc = 0; this.flash = 0; }

  update(dt, world, unit) {
    if (!world || !unit) return;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    // сильнейший очаг, в зоне которого СЕЙЧАС юнит (d < s.r) — и направление к нему
    let bestAng = 0, bestS = 0, found = false;
    for (const s of world.radSources) {
      let dx = s.x - unit.tileX;
      if (dx > MAP_W / 2) dx -= MAP_W; else if (dx < -MAP_W / 2) dx += MAP_W;   // кратчайший путь по тору
      const dy = s.y - unit.tileY, d = Math.hypot(dx, dy);
      if (d < s.r) { const st = 1 - d / s.r; if (st > bestS) { bestS = st; bestAng = Math.atan2(dy, dx); found = true; } }
    }
    this.has = found;
    this.signal += ((found ? bestS : 0) - this.signal) * Math.min(1, dt * RADAR_SIG_SMOOTH);
    if (found) {
      // пеленг медленно рыщет (две несинхронные синусоиды; шире при слабом сигнале)
      const jit = RADAR_JIT_NEAR + (RADAR_JIT_FAR - RADAR_JIT_NEAR) * (1 - bestS);
      const wob = (Math.sin(this.t * 2.3) * 0.6 + Math.sin(this.t * 5.1 + 1.7) * 0.4) * jit;
      let d2 = (bestAng + wob) - this.dir;
      d2 = Math.atan2(Math.sin(d2), Math.cos(d2));
      this.dir += d2 * Math.min(1, dt * RADAR_SMOOTH);
    } else {
      this.dir += dt * 0.6;   // нет сигнала — медленный «поисковый» дрейф
    }

    // частицы-ветер: спавн ∝ сигналу, приход со стороны очага (веер dir±spread), полёт в ядро
    if (found) {
      this.acc += this.signal * RADAR_SPAWN * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        const spread = RADAR_SPREAD * (1 - this.signal);              // далеко — широкий веер, вблизи — узкий
        const a = this.dir + (Math.random() - 0.5) * 2 * spread;
        const sp = RADAR_PSPEED * (0.7 + 0.5 * this.signal) * (0.85 + Math.random() * 0.3);
        this.parts.push({ x: Math.cos(a) * 1.18, y: Math.sin(a) * 1.18, vx: -Math.cos(a) * sp, vy: -Math.sin(a) * sp, life: RADAR_PLIFE });
      }
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.x * p.x + p.y * p.y < 0.02) { this.flash = 1; this.parts.splice(i, 1); continue; }   // дошла до ядра → вспышка
      else if (p.life <= 0) this.parts.splice(i, 1);
    }
  }
}
