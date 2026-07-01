'use strict';

// Рендер РАДАР-развёртки + ЭХО-волны (scanners.js). Рисуется ПОВЕРХ тумана: блипы видны сквозь тьму — радар
// «видит» сквозь породу, но НЕ раскрывает её. ПРИГЛУШЁННО (низкая альфа, мягкие точки) — глаз не устаёт.
// Кибер-кобальт радара / лиловая волна эхо. Перф: arc/fillRect/линии + 'lighter', без filter/shadowBlur/офскринов.

function drawRadarSweep(ctx, game, camera) {
  const u = game.unit; if (!u || !u.stats || !u.stats.radar) return;
  const rs = game.radarSweep; if (!rs) return;
  const ux = camera.screenX(u.px), uy = u.py - camera.y, R = RADAR_R * TILE, a = rs.ang;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (rs.sweeping) {   // развёртка видна ТОЛЬКО во время оборота (по активации); потом — только дотухающие блипы
    ctx.strokeStyle = 'rgba(127,176,224,0.055)'; ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.arc(ux, uy, R * k / 3, 0, 6.283); ctx.stroke(); }
    const trail = 0.6, steps = 7;
    for (let i = 0; i < steps; i++) {
      ctx.beginPath(); ctx.moveTo(ux, uy);
      ctx.arc(ux, uy, R, a - trail * (i + 1) / steps, a - trail * i / steps); ctx.closePath();
      ctx.fillStyle = 'rgba(127,176,224,' + (0.05 * (1 - i / steps)).toFixed(3) + ')'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(170,205,240,0.24)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux + Math.cos(a) * R, uy + Math.sin(a) * R); ctx.stroke();
  }
  // блипы залежей/врагов
  for (const b of rs.blips) {
    const al = Math.max(0, 1 - b.age / (rs.fade || 1));
    if (al <= 0.01) continue;
    const bx = camera.screenX(b.wx), by = b.wy - camera.y;
    ctx.globalAlpha = al * 0.16; ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(bx, by, b.enemy ? 6.5 : 5, 0, 6.283); ctx.fill();           // гало
    ctx.globalAlpha = al * (b.enemy ? 0.85 : 0.72);
    ctx.beginPath(); ctx.arc(bx, by, b.enemy ? 2.4 : 2.6, 0, 6.283); ctx.fill();          // ядро
    if (b.enemy) {                                                                         // крестик-метка врага
      ctx.globalAlpha = al * 0.8; ctx.strokeStyle = b.color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1; ctx.restore();
}

function drawEchoWave(ctx, game, camera) {
  const u = game.unit; if (!u || !u.stats || !u.stats.echoScan) return;
  const ec = game.echo; if (!ec) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (ec.wave) {                                                                           // прозрачная волна-искажение (дрожащие кольца)
    const ox = camera.screenX(ec.wave.ox), oy = ec.wave.oy - camera.y, r = ec.wave.r, f = Math.min(1, ec.wave.t / ECHO_WAVE_T);
    for (let k = 0; k < 3; k++) {
      const rr = r * (1 - k * 0.07); if (rr <= 1) continue;
      ctx.strokeStyle = 'rgba(181,140,240,' + (0.2 * (1 - f) * (1 - k * 0.28)).toFixed(3) + ')'; ctx.lineWidth = 2 - k * 0.5;
      ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 6.283); ctx.stroke();
    }
    // внутренний градиент: мягкое лиловое ядро + светящаяся оболочка у фронта волны (затухает к концу)
    if (r > 2) {
      const a = 1 - f, g = ctx.createRadialGradient(ox, oy, r * 0.15, ox, oy, r);
      g.addColorStop(0, `rgba(150,110,230,${(0.06 * a).toFixed(3)})`);
      g.addColorStop(0.6, `rgba(165,120,240,${(0.05 * a).toFixed(3)})`);
      g.addColorStop(0.9, `rgba(205,165,255,${(0.17 * a).toFixed(3)})`);   // светящийся фронт
      g.addColorStop(1, 'rgba(181,140,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r, 0, 6.283); ctx.fill();
    }
  }
  for (const m of ec.marks) {                                                              // метки залежей (держатся и гаснут)
    const al = Math.max(0, 1 - m.age / ECHO_MARK_FADE); if (al <= 0.01) continue;
    const bx = camera.screenX(m.wx), by = m.wy - camera.y;
    ctx.globalAlpha = al * 0.16; ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(bx, by, 5, 0, 6.283); ctx.fill();
    ctx.globalAlpha = al * 0.72; ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.restore();
}

// HUD-чип переключателя типа ресурса радара (клик/клавиша C). Скрыт при полном спектре или без радара.
function radarSwitchRect() { return { x: 10, y: 150, w: 154, h: 24 }; }
function radarSwitchVisible(game) { const u = game.unit; return game.mode === 'playing' && !game.debug && u && u.stats && u.stats.radar && !u.stats.radarSpectrum; }
function drawRadarSwitch(ctx, game) {
  if (!radarSwitchVisible(game)) return;
  const r = radarSwitchRect(), rs = game.radarSweep, def = RESOURCE_DEFS[rs.resType];
  ctx.save();
  ctx.fillStyle = 'rgba(13,12,16,0.82)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(127,176,224,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = def.color; ctx.fillRect(r.x + 8, r.y + r.h / 2 - 5, 10, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(r.x + 8.5, r.y + r.h / 2 - 4.5, 9, 9);
  ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#cfe0f0';
  ctx.fillText(STR.hud.scan.radarChip(def.name.toUpperCase()), r.x + 24, r.y + r.h / 2 + 0.5);
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(127,176,224,0.7)'; ctx.fillText('C ⟳', r.x + r.w - 8, r.y + r.h / 2 + 0.5);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
}

// ⚠️ НЕ УДАЛЯТЬ ПОКА: scanCdInfo + drawScanCooldown — виджет кулдауна сканера. Вызов в game.drawScene ОТКЛЮЧЁН
// (кулдаун теперь показывает заливка иконок в drawActionBar). Код оставлен на случай возврата виджета.
// Активный сканер с кулдауном (радар ИЛИ эхо — взаимоисключающие) для виджета кулдауна.
function scanCdInfo(game) {
  const u = game.unit; if (!u || !u.stats) return null;
  if (u.stats.radar) { const rs = game.radarSweep; return { label: STR.hud.scan.radarLabel, col: '#7fb0e0', cd: rs.cd, cdMax: rs.cdMax || RADAR_CD_BASE, busy: rs.sweeping }; }
  if (u.stats.echoScan) { const ec = game.echo; return { label: STR.hud.scan.echoLabel, col: '#b58cf0', cd: ec.cd, cdMax: ec.cdMax || ECHO_CD_BASE, busy: !!ec.wave }; }
  return null;
}
// Виджет кулдауна сканера — ПРАВЫЙ ВЕРХ, ПОД HUD-тумблером ПУТЬ (`navHudRect` y11-26 → этот с y32, не наложатся).
function drawScanCooldown(ctx, game, W) {
  if (game.mode !== 'playing' || game.debug) return;
  const info = scanCdInfo(game); if (!info) return;
  // сканер — ДОПОЛНИТЕЛЬНОЕ действие: метку клавиши берём у МЕНЕДЖЕРА действий (цифра назначена динамически)
  const sk = game.unit && game.unit.stats;
  const keyHint = keyLabel(game.actionKeys(sk && sk.radar ? 'radar' : 'echoScan')[0]) || '1';
  const w = 138, h = 20, x = W - 12 - w, y = 32;
  ctx.save();
  ctx.fillStyle = 'rgba(13,12,16,0.82)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = info.col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = info.col; ctx.fillText(info.label, x + 8, y + h / 2);
  const bx = x + 46, bw = w - 46 - 8, by = y + 5, bh = h - 10, t = performance.now();
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(bx, by, bw, bh);
  if (info.busy) {                                   // идёт скан
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(t / 120)); ctx.fillStyle = info.col; ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1; ctx.fillStyle = '#0a0a0e'; ctx.textAlign = 'center'; ctx.fillText(STR.hud.scan.scanning, bx + bw / 2, y + h / 2);
  } else if (info.cd > 0) {                           // перезарядка
    ctx.fillStyle = info.col; ctx.globalAlpha = 0.6; ctx.fillRect(bx, by, bw * (1 - info.cd / info.cdMax), bh);
    ctx.globalAlpha = 1; ctx.fillStyle = '#cfe0f0'; ctx.textAlign = 'right'; ctx.fillText(STR.hud.scan.cdSeconds(info.cd.toFixed(1)), x + w - 8, y + h / 2);
  } else {                                            // готов
    ctx.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(t / 350)); ctx.fillStyle = info.col; ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1; ctx.fillStyle = '#0a0a0e'; ctx.textAlign = 'center'; ctx.fillText(STR.hud.scan.ready(keyHint), bx + bw / 2, y + h / 2);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
}
