'use strict';

// Экранные меню по кодексу дизайн-системы: статичный фон + техно-рамки/штампы,
// заголовки Tektur, hazard-ленты, PCB-пальцы, нумерованный список пунктов.

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = '', yy = y;
  for (const wd of words) {
    const t = line ? line + ' ' + wd : wd;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = wd; yy += lh; }
    else line = t;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;   // baseline последней строки
}

// Директивы сессии — крупные «дизайнерские» буллеты с мигающим квадратом (один пигмент на цель).
function drawDirectives(ctx, x, y, big) {
  if (typeof SESSION_GOALS === 'undefined') return;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.gold;
  ctx.fillText(STR.menu.directivesHdr, x, y);
  let yy = y + (big ? 19 : 15);
  SESSION_GOALS.forEach((g, i) => {
    const c = PAL[g.accent] || PAL.gold, sq = big ? 9 : 7, rowH = big ? 22 : 17;
    pulseSquare(ctx, x + sq / 2, yy + (big ? 7 : 5), sq, c);                 // мигающий квадрат-буллет
    ctx.font = `bold ${big ? 10 : 8}px ${FONT_MONO}`; ctx.fillStyle = PAL.ash; ctx.textAlign = 'left';
    ctx.fillText(('0' + (i + 1)).slice(-2), x + sq + 8, yy + (big ? 2 : 1));  // индекс директивы
    ctx.font = `${big ? 11 : 9}px ${FONT_MONO}`; ctx.fillStyle = PAL.chalk;
    ctx.fillText(g.text, x + sq + 28, yy + (big ? 2 : 1));
    yy += rowH;
  });
  ctx.textBaseline = 'alphabetic';
}

const MENU_GLINTS = [[0.22, 0.34, 'gold', 3], [0.78, 0.62, 'amber', 2.5], [0.86, 0.28, 'blood', 2], [0.40, 0.74, 'toxic', 2], [0.62, 0.20, 'cobalt', 1.6]];
function drawMenuGlints(ctx, W, H) {
  for (const [fx, fy, key, r] of MENU_GLINTS) {
    const x = W * fx, y = H * fy, c = PAL[key];
    ctx.globalAlpha = 0.16; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 6, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}

// строка нумерованного списка меню (как MenuLine кодекса). primary → активна (золото).
function menuLine(ctx, b, n) {
  const active = b.primary, hot = b.hover;
  if (hot) { ctx.fillStyle = PAL.gold; ctx.fillRect(b.x, b.y, b.w, b.h); }
  else if (active) { ctx.fillStyle = 'rgba(212,160,66,0.06)'; ctx.fillRect(b.x, b.y, b.w, b.h); }
  if (active || hot) {
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    const s = 8; ctx.strokeStyle = hot ? PAL.goldBright : PAL.gold; ctx.beginPath();
    ctx.moveTo(b.x + 0.5, b.y + s); ctx.lineTo(b.x + 0.5, b.y + 0.5); ctx.lineTo(b.x + s, b.y + 0.5);
    ctx.moveTo(b.x + b.w - s, b.y + b.h - 0.5); ctx.lineTo(b.x + b.w - 0.5, b.y + b.h - 0.5); ctx.lineTo(b.x + b.w - 0.5, b.y + b.h - s);
    ctx.stroke();
  }
  const numC = hot ? PAL.void : (active ? PAL.gold : PAL.ash);
  const fg = hot ? PAL.void : (active ? PAL.chalk : PAL.bone);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.font = `bold 13px ${FONT_MONO}`; ctx.fillStyle = numC;
  ctx.fillText(('0' + n).slice(-2), b.x + 18, b.y + b.h / 2);
  ctx.fillStyle = fg; ctx.font = `13px ${FONT_MONO}`;
  ctx.fillText(b.label.toUpperCase(), b.x + 50, b.y + b.h / 2 - (b.desc ? 6 : 0));
  if (b.desc) { ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = hot ? 'rgba(7,5,10,0.7)' : PAL.ash; ctx.fillText(b.desc.toUpperCase(), b.x + 50, b.y + b.h / 2 + 9); }
  ctx.textBaseline = 'alphabetic';
}

// Встроенный тумблер «режим истории» в ПРАВОЙ зоне кнопки забега (`b.storyRect`): вертикальный разделитель
// (две зоны — запуск | тумблер), квадрат-галочка, двухстрочный лейбл. Один пигмент — кобальт когда вкл.
// Контраст подстраивается под hover кнопки (на золотой заливке — тёмная тушь PAL.void). Рисуется ПОВЕРХ menuLine.
function drawStartStoryToggle(ctx, b, on) {
  const r = b.storyRect, hot = b.hover;
  // разделитель зон: «запуск» слева | «тумблер истории» справа
  ctx.strokeStyle = hot ? 'rgba(7,5,10,0.4)' : 'rgba(120,110,95,0.3)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(r.x + 0.5, b.y + 9); ctx.lineTo(r.x + 0.5, b.y + b.h - 9); ctx.stroke();
  // квадрат-галочка
  const sz = 14, sx = r.x + 14, sy = b.y + b.h / 2 - sz / 2;
  ctx.strokeStyle = hot ? PAL.void : (on ? PAL.cobalt : PAL.ash); ctx.lineWidth = 1.4;
  ctx.strokeRect(sx + 0.5, sy + 0.5, sz, sz);
  if (on) {
    if (!hot) { ctx.fillStyle = 'rgba(58,126,200,0.20)'; ctx.fillRect(sx + 1.5, sy + 1.5, sz - 2, sz - 2); }
    ctx.strokeStyle = hot ? PAL.void : PAL.cobalt; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(sx + 3, sy + 7.5); ctx.lineTo(sx + 6, sy + 11); ctx.lineTo(sx + 11.5, sy + 3.5); ctx.stroke();
    ctx.lineCap = 'butt';
  }
  // двухстрочный лейбл
  const tx = sx + sz + 9, txtC = hot ? PAL.void : (on ? PAL.cobalt : PAL.bone);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = txtC;
  ctx.fillText(STR.menu.story1, tx, b.y + b.h / 2 - 6);
  ctx.fillText(STR.menu.story2, tx, b.y + b.h / 2 + 6);
  ctx.textBaseline = 'alphabetic';
}

// техно-кнопка (контур + uppercase mono, primary=золото, заливка на hover)
function drawButtons(ctx, buttons) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const b of buttons) {
    if (b.desc !== undefined) { menuLine(ctx, b, 1); continue; }  // строка-список рисуется отдельно
    const hot = b.hover, accent = b.primary ? PAL.gold : PAL.ash;
    ctx.fillStyle = hot && b.primary ? PAL.gold : 'rgba(13,10,14,0.92)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = accent; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    const s = 7; ctx.strokeStyle = b.primary ? PAL.gold : PAL.bronze;
    ctx.beginPath();
    ctx.moveTo(b.x + 0.5, b.y + s); ctx.lineTo(b.x + 0.5, b.y + 0.5); ctx.lineTo(b.x + s, b.y + 0.5);
    ctx.moveTo(b.x + b.w - s, b.y + b.h - 0.5); ctx.lineTo(b.x + b.w - 0.5, b.y + b.h - 0.5); ctx.lineTo(b.x + b.w - 0.5, b.y + b.h - s);
    ctx.stroke();
    ctx.fillStyle = hot && b.primary ? PAL.void : (b.primary ? PAL.gold : PAL.bone);
    ctx.font = `12px ${FONT_MONO}`;
    ctx.fillText(b.label.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 1);
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// Виджет ГЛОБАЛЬНОГО ЦИКЛА существования ИИ (top-center): большой тикающий номер `save.epoch` + центи-доля (·NN,
// тикает ~раз в 0.75с) → ощущение течения глобального времени. Сам счётчик тикает в game.loop (mode menu), не сбрасывается.
function drawEpochClock(ctx, save, W) {
  const ep = (save && save.epoch) || EPOCH_START;   // constants.js гарантирован загрузчиком (литерал-дубль 48217 снят — audit_2026-08)
  const whole = Math.floor(ep), centi = String(Math.floor((ep - whole) * 100)).padStart(2, '0');
  const cx = Math.round(W / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.gold;
  ctx.fillText(STR.menu.epochLabel, cx, 20);
  const big = (typeof numGroup === 'function' ? numGroup(whole) : String(whole)), dotc = '·' + centi;
  ctx.font = `800 30px ${FONT_DISPLAY}`;   // центи-доля — ТЕМ ЖЕ шрифтом/размером, что и номер (только акцентный цвет)
  const bw = ctx.measureText(big).width, cw = ctx.measureText(dotc).width, gap = 3;
  const total = bw + gap + cw, x0 = cx - total / 2;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.chalk; ctx.fillText(big, x0, 60);
  ctx.fillStyle = PAL.gold;  ctx.fillText(dotc, x0 + bw + gap, 60);
  ctx.strokeStyle = PAL.goldDim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, 68); ctx.lineTo(x0 + total, 68); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawMainMenu(ctx, save, buttons, W, H) {
  drawStaticBg(ctx, W, H);
  hazardTape(ctx, 0, 0, W, 6, PAL.goldDim);
  drawMenuGlints(ctx, W, H);
  // serial-штампы по углам
  serialChip(ctx, 14, 14, 'TWILIGHT-WORLD // M0', PAL.gold, 'left');
  serialChip(ctx, W - 14, 14, 'SEED 0x7A3F · 04-N', PAL.toxic, 'right');
  drawEpochClock(ctx, save, W);   // тикающий глобальный цикл существования ИИ (top-center)
  // герой — слева
  const hx = Math.max(48, W * 0.07), hy = H * 0.40;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`;
  ctx.fillText(STR.menu.tagline, hx, hy - 86);
  ctx.font = `800 72px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.chalk; ctx.fillText(STR.menu.title1, hx, hy - 16);
  ctx.fillStyle = PAL.gold; ctx.fillText(STR.menu.title2, hx, hy + 54);
  ctx.fillStyle = PAL.bone; ctx.font = `12px ${FONT_BODY}`;
  const storyEndY = wrapText(ctx, STR.menu.subtitle, hx, hy + 84, 360, 17);
  // директивы сессии — крупные буллеты под сюжетным текстом
  drawDirectives(ctx, hx, storyEndY + 28, true);
  // нумерованный вертикальный список — внизу справа; в кнопке забега — встроенный тумблер «режим истории» (правая зона)
  buttons.forEach((b, i) => { menuLine(ctx, b, i + 1); if (b.story) drawStartStoryToggle(ctx, b, save.storyMode); });
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter;
  ctx.fillText(STR.menu.stats(save.bestDug, save.runs, save.meta || 0), W - 48, 96);
  // низ: PCB-пальцы + serial-полоса
  edgeFingers(ctx, W / 2 - 120, H - 12, 240, 24, PAL.goldDim);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter;
  ctx.fillText(STR.menu.controls, 16, H - 14);
  ctx.textAlign = 'right'; ctx.fillStyle = PAL.toxic; ctx.fillText('SKVERNA · 0.2 r/s', W - 16, H - 14);
  ctx.textAlign = 'left';
}

function drawPauseMenu(ctx, buttons, W, H) {
  ctx.fillStyle = 'rgba(7,5,10,0.8)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`; ctx.fillText(STR.menu.pauseTag, W / 2, H / 2 - 132);
  ctx.fillStyle = PAL.chalk; ctx.font = `700 44px ${FONT_DISPLAY}`; ctx.fillText(STR.menu.pauseTitle, W / 2, H / 2 - 92);
  drawButtons(ctx, buttons);
  ctx.textAlign = 'left';
}

// KPI-карточка итогов: болты + уголки + моно-метка + крупное Tektur-значение + дельта.
// kpiCard УДАЛЕНА (audit_2026-08: мёртвая рендер-функция без вызовов — восстановима из истории при нужде)

// L-уголки рамки панели (как у кнопок) — 4 угла.
function _panelCorners(ctx, x, y, w, h, col, s) {
  s = s || 9; ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.beginPath();
  ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y);
  ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s);
  ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h);
  ctx.moveTo(x + s, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - s);
  ctx.stroke();
}

// Финальный экран: пересчёт метрик забега в МЕГА-ТОКЕНЫ с АНИМИРОВАННЫМИ счётчиками в РАМКЕ-панели
// (строки набегают по очереди: значение × коэф = токены), итог в токен-бейдже + банк копятся.
// Значок МЕГА-ТОКЕНА на canvas — 1:1 как `_mtToken` в meta_dom (гекс + внутр.квадрат + ядро + спицы),
// чтобы иконка на gameover совпадала с экраном мета-прогресса. viewBox 32×32 (центр 16) → (cx,cy,r).
function drawMetaToken(ctx, cx, cy, r) {
  const f = r / 16, X = (v) => cx + (v - 16) * f, Y = (v) => cy + (v - 16) * f;
  ctx.save();
  ctx.beginPath();
  [[16, 3], [27, 9.5], [27, 22.5], [16, 29], [5, 22.5], [5, 9.5]].forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(212,160,66,0.18)'; ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = Math.max(1, 1.6 * f); ctx.stroke();
  ctx.lineWidth = Math.max(1, 1.4 * f); ctx.strokeRect(X(11), Y(11), 10 * f, 10 * f);
  ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(cx, cy, 2 * f, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(1, 1.2 * f); ctx.beginPath();
  const seg = (a, b, c, d) => { ctx.moveTo(X(a), Y(b)); ctx.lineTo(X(c), Y(d)); };
  seg(16, 3, 16, 7); seg(16, 25, 16, 29); seg(5, 9.5, 8.5, 11.5); seg(23.5, 11.5, 27, 9.5); seg(5, 22.5, 8.5, 20.5); seg(23.5, 20.5, 27, 22.5);
  ctx.stroke();
  ctx.restore();
}

// meta = { rows:[{label,accent,value,coef,tokens}], total }; overT — таймер; bank — банк ПОСЛЕ зачисления.
function drawGameOver(ctx, buttons, W, H, reason, meta, overT, bank) {
  meta = meta || { rows: [], total: 0 }; overT = overT || 0; bank = bank || 0;
  const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) * (1 - p));
  const unit = reason === 'unit', hack = reason === 'hack', win = reason === 'hack_win' || reason === 'threat_win';
  const k = reason === 'threat_win' ? 'threatwin' : win ? 'win' : unit ? 'unit' : hack ? 'hack' : 'city';   // ключ строки причины (STR.gameover.*[k])
  drawStaticBg(ctx, W, H);
  ctx.fillStyle = win ? 'rgba(6,12,8,0.82)' : 'rgba(10,4,5,0.82)'; ctx.fillRect(0, 0, W, H);
  hazardTape(ctx, 0, 0, W, 7, win ? PAL.gold : PAL.blood);
  hazardTape(ctx, 0, H - 7, W, 7, win ? PAL.gold : PAL.blood);

  // ── шапка ──
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = win ? PAL.gold : PAL.bloodBright;
  ctx.fillText(STR.gameover.tag[k], W / 2, 48);
  ctx.font = `800 44px ${FONT_DISPLAY}`; ctx.fillStyle = win ? PAL.toxic : PAL.chalk;
  ctx.fillText(STR.gameover.title[k], W / 2, 90);
  ctx.fillStyle = PAL.bone; ctx.font = `12px ${FONT_BODY}`;
  ctx.fillText(STR.gameover.sub[k], W / 2, 112);

  // ── панель пересчёта ──
  const px = 44, pw = W - 88, py = 142, ph = 304;
  ctx.fillStyle = 'rgba(16,12,14,0.92)'; ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = PAL.goldDim; ctx.lineWidth = 1; ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  _panelCorners(ctx, px, py, pw, ph, PAL.gold);
  ctx.fillStyle = 'rgba(34,25,10,0.7)'; ctx.fillRect(px, py, pw, 26);
  ctx.textAlign = 'left'; ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.gold;
  ctx.fillText(STR.gameover.recalc(META_NAME), px + 14, py + 17);
  ctx.textAlign = 'right'; ctx.fillStyle = win ? PAL.toxic : PAL.bloodBright;
  ctx.fillText(STR.gameover.status[k], px + pw - 14, py + 17);

  // ── строки ──
  const rx0 = px + 18, rx1 = px + pw - 18, rowY = py + 58, lineH = 30;
  let shownTotal = 0;
  meta.rows.forEach((r, i) => {
    const p = ease((overT - 0.3 - i * 0.38) / 0.7);
    const dval = Math.round(r.value * p), dtok = Math.round(r.tokens * p);
    shownTotal += dtok;
    const ry = rowY + i * lineH, ac = PAL[r.accent] || PAL.gold;
    ctx.globalAlpha = p > 0.001 ? 1 : 0.28;
    ctx.fillStyle = ac; ctx.fillRect(rx0, ry - 9, 7, 7);
    ctx.fillStyle = PAL.bone; ctx.font = `13px ${FONT_BODY}`; ctx.textAlign = 'left'; ctx.fillText(r.label, rx0 + 16, ry);
    ctx.font = `11px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter; ctx.textAlign = 'right'; ctx.fillText(`${dval} × ${r.coef}`, rx1 - 74, ry);
    ctx.font = `700 15px ${FONT_MONO}`; ctx.fillStyle = ac; ctx.textAlign = 'right'; ctx.fillText(`+${dtok}`, rx1, ry);
  });
  ctx.globalAlpha = 1;
  const divY = rowY + meta.rows.length * lineH - 4;
  ctx.strokeStyle = 'rgba(120,110,95,0.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rx0, divY); ctx.lineTo(rx1, divY); ctx.stroke();

  // ── итог-бейдж ──
  const bY = divY + 14, bH = py + ph - bY - 14;
  ctx.fillStyle = 'rgba(44,32,12,0.55)'; ctx.fillRect(px + 10, bY, pw - 20, bH);
  const tcx = px + 36, tcy = bY + bH / 2;
  drawMetaToken(ctx, tcx, tcy, 16);   // тот же значок МТ, что в мета-прогрессе
  ctx.textAlign = 'left'; ctx.font = `10px ${FONT_MONO}`; ctx.fillStyle = PAL.bone; ctx.fillText(STR.gameover.total, tcx + 26, bY + 22);
  const dispBank = (bank - meta.total) + shownTotal;
  ctx.font = `8px ${FONT_MONO}`; ctx.fillStyle = PAL.toxic; ctx.fillText(STR.gameover.inBank(dispBank, META_ABBR), tcx + 26, bY + bH - 12);
  ctx.textAlign = 'right'; ctx.font = `800 40px ${FONT_DISPLAY}`; ctx.fillStyle = PAL.goldBright; ctx.fillText(`+${shownTotal}`, rx1 - 40, tcy + 13);
  ctx.font = `10px ${FONT_MONO}`; ctx.fillStyle = PAL.gold; ctx.fillText(META_ABBR, rx1, tcy + 13);

  drawButtons(ctx, buttons);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
