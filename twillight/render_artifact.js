'use strict';

// Рендер артефактов (artifact.js / world.genArtifacts): объект-реликт в породе + модалка выбора.
// ⚠️ перф: без ctx.filter/shadowBlur (радиальные градиенты/пути — ОК). Объект — ПОД туманом (часть мира).
const ART_ACCENT = '#4fd6d0';   // бирюза-реликт: отлично от ресурсов/структур/города/данных

// Объект в породе. ВИДИМОСТЬ зависит от ОТКОПКИ: погребённый (тайлы ещё порода) — тусклый «залегающий»
// корпус БЕЗ сияния (намёк, что в породе что-то есть); по мере откопки ярче; ПОЛНОСТЬЮ выкопан → активное
// бирюзовое сияние + пульс ядра (готов к решению). Виден, где раскрыт туман.
function drawArtifacts(ctx, world, camera) {
  if (!world.artifacts || !world.artifacts.length) return;
  const tt = performance.now() / 1000;
  for (const a of world.artifacts) {
    if (a.resolved) continue;
    let seen = false, air = 0, n = a.w * a.h;
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) {
      if (world.isSeen(a.tx + dx, a.ty + dy)) seen = true;
      if (world.tileAt(wrapX(a.tx + dx), a.ty + dy).type === AIR) air++;
    }
    if (!seen) continue;
    const exc = air / n;                                               // доля откопки 0..1 (1 = полностью выкопан = «активен»)
    const sx = camera.screenX((a.tx + a.w / 2) * TILE), sy = (a.ty + a.h / 2) * TILE - camera.y;
    const w = a.w * TILE, h = a.h * TILE, pad = 5, pulse = 0.5 + 0.5 * Math.sin(tt * 2);
    ctx.save();
    if (exc > 0.001) {                                                 // сияние ТОЛЬКО по мере откопки (погребённый не светит)
      const gi = exc * (0.10 + 0.12 * pulse), g = ctx.createRadialGradient(sx, sy, 2, sx, sy, w * 0.75);
      g.addColorStop(0, 'rgba(79,214,208,' + gi.toFixed(3) + ')'); g.addColorStop(1, 'rgba(79,214,208,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, w * 0.75, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 0.4 + 0.6 * exc;                                 // погребённый — тусклее, выкопанный — в полную силу
    const x0 = sx - w / 2 + pad, y0 = sy - h / 2 + pad, ww = w - pad * 2, hh = h - pad * 2, r = 6;
    _artRoundRect(ctx, x0, y0, ww, hh, r);
    ctx.fillStyle = '#15201f'; ctx.fill();
    ctx.strokeStyle = ART_ACCENT; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(79,214,208,0.32)'; ctx.lineWidth = 1;     // гравировка-рёбра
    for (let i = 1; i <= 2; i++) { const yy = y0 + hh * i / 3; ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + ww - 4, yy); ctx.stroke(); }
    const cr = Math.min(ww, hh) * 0.17, cp = exc >= 1 ? (0.5 + 0.4 * pulse) : 0.4;   // пульс ядра только когда выкопан
    ctx.fillStyle = 'rgba(170,247,242,' + cp.toFixed(3) + ')';
    ctx.beginPath(); ctx.moveTo(sx, sy - cr); ctx.lineTo(sx + cr, sy); ctx.lineTo(sx, sy + cr); ctx.lineTo(sx - cr, sy); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function _artRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// Простой перенос строки по словам.
function _artWrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// Модалка выбора (mode 'artifact'): затемнение + панель + 3 карты. Подсветка game.artifactSel.
// Hit-rect'ы кладём в game._artifactRects (для ЛКМ — artifact.js artifactClick).
function drawArtifactModal(ctx, game, W, H) {
  const a = game.pendingArtifact; if (!a) return;
  ctx.save();
  ctx.fillStyle = 'rgba(8,7,6,0.74)'; ctx.fillRect(0, 0, W, H);
  const pw = 760, ph = 380, px = (W - pw) / 2, py = (H - ph) / 2;
  const cy = (typeof techPanel === 'function') ? techPanel(ctx, px, py, pw, ph, { accent: ART_ACCENT, label: STR.world.artifact.tag, serial: 'RELIC' }) : py + 30;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.chalk; ctx.font = `700 26px ${FONT_DISPLAY}`;
  ctx.fillText(STR.world.artifact.prompt, W / 2, cy + 24);
  ctx.fillStyle = PAL.ash; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.world.artifact.hint, W / 2, cy + 42);

  const choices = [
    { label: STR.world.artifact.tech.label, sub: a.tech.name, desc: a.tech.desc, accent: ART_ACCENT, icon: 'tech' },
    { label: STR.world.artifact.data.label, sub: STR.world.artifact.data.sub, desc: STR.world.artifact.data.desc, accent: PAL.cobalt || '#5a8fd6', icon: 'data' },
    { label: STR.world.artifact.scrap.label, sub: STR.world.artifact.scrap.sub, desc: STR.world.artifact.scrap.desc, accent: PAL.toxic || '#c8e25a', icon: 'scrap' },
  ];
  const gap = 22, cardW = (pw - 44 - gap * 2) / 3, cardH = 210, cardY = cy + 62, x0 = px + 22;
  const rects = [];
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i], cx = x0 + i * (cardW + gap), sel = game.artifactSel === i;
    rects.push({ x: cx, y: cardY, w: cardW, h: cardH });
    _artRoundRect(ctx, cx, cardY, cardW, cardH, 8);
    ctx.fillStyle = sel ? 'rgba(255,255,255,0.05)' : 'rgba(13,12,10,0.6)'; ctx.fill();
    ctx.strokeStyle = sel ? c.accent : 'var(--bronze)'; ctx.strokeStyle = sel ? c.accent : 'rgba(122,112,94,0.6)'; ctx.lineWidth = sel ? 2.5 : 1.2; ctx.stroke();
    _artIcon(ctx, c.icon, cx + cardW / 2, cardY + 46, c.accent);
    ctx.textAlign = 'center';
    ctx.fillStyle = sel ? PAL.chalk : PAL.bone; ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillText(c.label, cx + cardW / 2, cardY + 96);
    ctx.fillStyle = c.accent; ctx.font = `bold 11px ${FONT_MONO}`;
    ctx.fillText(c.sub, cx + cardW / 2, cardY + 116);
    ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`; ctx.textAlign = 'left';
    const lines = _artWrap(ctx, c.desc, cardW - 26);
    lines.forEach((ln, k) => ctx.fillText(ln, cx + 13, cardY + 142 + k * 15));
    if (sel) { ctx.textAlign = 'center'; ctx.fillStyle = c.accent; ctx.font = `bold 10px ${FONT_MONO}`; ctx.fillText('▸ ' + STR.world.artifact.select, cx + cardW / 2, cardY + cardH - 14); }
  }
  game._artifactRects = rects;
  ctx.restore();
}

function _artIcon(ctx, kind, cx, cy, accent) {
  ctx.save(); ctx.strokeStyle = accent; ctx.fillStyle = accent; ctx.lineWidth = 2; ctx.lineCap = 'round';
  if (kind === 'tech') {                       // чип: квадрат + ножки
    ctx.strokeRect(cx - 11, cy - 11, 22, 22);
    ctx.fillRect(cx - 5, cy - 5, 10, 10);
    for (const s of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(cx + s, cy - 11); ctx.lineTo(cx + s, cy - 16); ctx.moveTo(cx + s, cy + 11); ctx.lineTo(cx + s, cy + 16); ctx.moveTo(cx - 11, cy + s); ctx.lineTo(cx - 16, cy + s); ctx.moveTo(cx + 11, cy + s); ctx.lineTo(cx + 16, cy + s); ctx.stroke(); }
  } else if (kind === 'data') {                 // диск данных: круг + дуга-сектор
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 9, -1.0, 0.6); ctx.stroke();
  } else {                                      // переработка: три стрелки по кругу
    for (let i = 0; i < 3; i++) { const a = i * 2.094 - 1.57; ctx.beginPath(); ctx.arc(cx, cy, 11, a + 0.25, a + 1.7); ctx.stroke(); const ex = cx + Math.cos(a + 1.7) * 11, ey = cy + Math.sin(a + 1.7) * 11; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 5, ey - 1); ctx.moveTo(ex, ey); ctx.lineTo(ex - 1, ey - 5); ctx.stroke(); }
  }
  ctx.restore();
}
