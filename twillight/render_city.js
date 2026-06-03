'use strict';

// Hibernation Widget (язык дизайна из `design/handoff` Hibernation Widget,
// без иероглифов): ВЕСЬ статус города — в ОДНОЙ капсуле со скошенными углами:
// слева эмблема (3 кольца контуров + общее HP в центре), посередине меняющаяся
// надпись фазы + сегментный бар обратного отсчёта, справа крупный «секунды.МС»
// на дисплейном шрифте. Рамка/glow меняются по степени опасности.

// Фаза и тексты — общий контракт. Стадии гибели разделены, чтобы анимация смены
// надписи срабатывала при потере каждого контура.
function _cityPhase(city) {
  if (city.dying) {
    const ai = city.activeRing(), last = city.rings.length - 1;
    return ai === last ? 'dying-outer' : ai <= 0 ? 'dying-core' : 'dying-inner';
  }
  if (city.charging) return 'charging';   // на базе: реактор подпитывает город
  if (city.full)     return 'full';       // на базе: запитан полностью
  if (city.timer <= 15) return 'urgent';
  if (city.timer <= 30) return 'caution';
  return 'calm';
}
function _cityPhaseText(phase) {
  if (phase === 'dying-outer') return 'ОТКЛЮЧЕНИЕ ВНЕШНЕГО КОНТУРА';
  if (phase === 'dying-inner') return 'ОТКЛЮЧЕНИЕ ВНУТРЕННЕГО КОНТУРА';
  if (phase === 'dying-core')  return 'ГИБЕРНАЦИЯ ЯДРА';
  if (phase === 'charging')    return 'ПОДПИТКА ГОРОДА';
  if (phase === 'full')        return 'ГОРОД ЗАПИТАН';
  if (phase === 'urgent')      return 'СРОЧНО НА БАЗУ';
  if (phase === 'caution')     return 'ВЕРНИСЬ К ПРИНТЕРУ';
  return 'ДО ГИБЕРНАЦИИ';
}
function _phaseColor(phase, blink) {
  if (phase.startsWith('dying')) return blink ? PAL.bloodBright : PAL.bloodDim;
  if (phase === 'urgent')  return PAL.bloodBright;
  if (phase === 'caution') return PAL.gold;
  if (phase === 'charging') return PAL.toxic;   // подпитка — токсик (как энергия/жизнь города)
  if (phase === 'full')     return PAL.toxic;
  return PAL.amber;
}
// Содержательное число справа: до гибернации — секунды таймера; в гибернации —
// до потери активного контура (`hp / CITY_DMG`).
function _phaseNumber(city, phase) {
  if (phase.startsWith('dying')) {
    const ai = city.activeRing();
    return ai >= 0 ? Math.max(0, city.rings[ai].hp / CITY_DMG) : 0;
  }
  return Math.max(0, city.timer);
}
// Заполнение бара: до гибернации — таймер/максимум; в гибернации — HP активного кольца.
function _phaseFrac(city, phase) {
  if (phase.startsWith('dying')) {
    const ai = city.activeRing();
    return ai >= 0 ? Math.max(0, Math.min(1, city.rings[ai].hp / city.rings[ai].max)) : 0;
  }
  return Math.max(0, Math.min(1, city.timer / city.timerMax));
}

// Плавная смена надписи: старая уезжает вверх и гаснет, новая выезжает снизу и
// проявляется. Мягкое easeInOutCubic, ~420мс, аккуратный слайд (≤ высоты буквы) —
// чтобы движение читалось как «вздох», а не «прыжок». Скретч на city.
function _drawBarText(ctx, city, x, y, slide) {
  const phase = _cityPhase(city);
  if (city._barPhase !== phase) {
    if (city._barPhase != null) city._barPrev = city._barText;
    city._barPhase = phase;
    city._barT0 = performance.now();
  }
  city._barText = _cityPhaseText(phase);
  const DUR = 420;
  const animating = city._barPrev != null;
  const t = animating ? Math.min(1, (performance.now() - city._barT0) / DUR) : 1;
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (animating && t < 1) {
    ctx.globalAlpha = 1 - e;
    ctx.fillText(city._barPrev, x, y - slide * e);
    ctx.globalAlpha = e;
    ctx.fillText(city._barText, x, y + slide * (1 - e));
    ctx.globalAlpha = 1;
  } else {
    if (animating) city._barPrev = null;
    ctx.fillText(city._barText, x, y);
  }
}

// Капсула со скошенными углами (top-right + bottom-left): язык кодекса.
function _capsulePath(x, y, w, h, notch) {
  const p = new Path2D();
  p.moveTo(x, y);
  p.lineTo(x + w - notch, y);
  p.lineTo(x + w, y + notch);
  p.lineTo(x + w, y + h);
  p.lineTo(x + notch, y + h);
  p.lineTo(x, y + h - notch);
  p.closePath();
  return p;
}

function drawCity(ctx, city, W) {
  // === Геометрия капсулы ===
  const cw = 360, ch = 44, notch = 9, padX = 10;
  const emR = 16, emD = emR * 2;             // эмблема компактнее (под капсулу)
  const rightW = 64;                          // зона «секунды.МС»
  const gap = 10;
  const midX = padX + emD + gap;
  const midW = cw - midX - rightW - padX;     // ширина под надпись + сегментный бар

  // Якорь — у левого края «коридора» (правее панели юнита), а не по центру,
  // чтобы капсула не лезла на панель задания справа.
  const x = 210;
  const y = 8;

  // === Фаза, мягкий пульс ===
  const phase = _cityPhase(city);
  const dying = phase.startsWith('dying');
  // Плавный синусоидальный пульс ~0.9с (вместо резкого 200мс blink): глаз
  // ловит «дыхание» света без эпилептического стробоскопа. `pulse` ∈ [0..1].
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * (2 * Math.PI) / 900);
  // Для urgent ОСТАВЛЯЕМ резкий blink (вне dying — это короткий период, и быстрый
  // ритм 200мс читается как «срочно», без раздражения); для dying — мягкий пульс.
  const blink = !dying && Math.floor(performance.now() / 200) % 2 === 1;
  const col = dying ? PAL.bloodBright : _phaseColor(phase, blink);
  const urgent = phase === 'urgent' || dying;

  // === Капсула: фон + glow + рамка ===
  const p = _capsulePath(x, y, cw, ch, notch);
  ctx.save();
  // Bloom-свечение при опасности. В dying — плавный пульс через `pulse`.
  if (urgent) {
    ctx.shadowColor = dying ? PAL.bloodBright : col;
    ctx.shadowBlur = dying ? 10 + 12 * pulse : (blink ? 22 : 10);
  }
  const bg = ctx.createLinearGradient(0, y, 0, y + ch);
  bg.addColorStop(0, 'rgba(20,16,12,0.96)');
  bg.addColorStop(1, 'rgba(13,10,14,0.96)');
  ctx.fillStyle = bg;
  ctx.fill(p);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.strokeStyle = urgent ? col : PAL.bronze; ctx.lineWidth = 1; ctx.stroke(p);

  // Угловые тики на «острых» углах (top-left + bottom-right): хват языка кодекса.
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(x + 0.5, y + 9); ctx.lineTo(x + 0.5, y + 0.5); ctx.lineTo(x + 9, y + 0.5);
  ctx.moveTo(x + cw - 9, y + ch - 0.5); ctx.lineTo(x + cw - 0.5, y + ch - 0.5); ctx.lineTo(x + cw - 0.5, y + ch - 9);
  ctx.stroke();

  // === Эмблема (3 кольца) ===
  const ecx = x + padX + emR, ecy = y + ch / 2;
  const lw = 4.5, rgap = 6;
  for (let i = city.rings.length - 1; i >= 0; i--) {
    const r = emR - (city.rings.length - 1 - i) * rgap;
    const ring = city.rings[i];
    ctx.beginPath(); ctx.arc(ecx, ecy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = lw; ctx.stroke();
    if (ring.lost) {
      ctx.beginPath(); ctx.arc(ecx, ecy, r, 0, Math.PI * 2);
      ctx.strokeStyle = PAL.bloodDim; ctx.setLineDash([2, 3]); ctx.lineWidth = lw; ctx.stroke(); ctx.setLineDash([]);
    } else {
      const f = ring.hp / ring.max, start = -Math.PI / 2;
      ctx.beginPath(); ctx.arc(ecx, ecy, r, start, start + Math.PI * 2 * f);
      ctx.strokeStyle = f > 0.5 ? PAL.amber : f > 0.25 ? PAL.gold : PAL.bloodBright;
      ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.lineCap = 'butt';
    }
  }
  // HP-число — тёмный контур + светлая заливка по центру эмблемы.
  const hp = `${Math.ceil(city.totalHp())}`;
  ctx.font = `bold 11px ${FONT_MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = 3.5; ctx.strokeStyle = PAL.void; ctx.strokeText(hp, ecx, ecy);
  ctx.fillStyle = PAL.chalk; ctx.fillText(hp, ecx, ecy);

  // === Середина: меняющаяся надпись (slide+fade) + сегментный бар ===
  const mx = x + midX, labelY = y + ch * 0.4;
  ctx.font = `9px ${FONT_MONO}`;
  ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, y + 5, midW, ch * 0.45); ctx.clip();
  _drawBarText(ctx, city, mx, labelY, 7);
  ctx.restore();

  // Сегментный бар — 28 сегментов, заполнение по фракции фазы.
  // В dying сегменты не моргают полностью, а мягко «дышат» (alpha 0.55..0.95).
  const SEGS = 28, segGap = 2, segH = 6;
  const segW = (midW - (SEGS - 1) * segGap) / SEGS;
  const frac = _phaseFrac(city, phase);
  const lit = Math.round(frac * SEGS);
  const barY = y + ch * 0.66;
  for (let i = 0; i < SEGS; i++) {
    const sx = mx + i * (segW + segGap);
    if (dying) { ctx.fillStyle = col; ctx.globalAlpha = 0.55 + 0.4 * pulse; }
    else { ctx.fillStyle = i < lit ? col : PAL.earth; }
    ctx.fillRect(sx, barY, segW, segH);
    ctx.globalAlpha = 1;
  }

  // === Справа: крупные секунды + сотые + подпись С·МС ===
  // Цифры выравниваем по ЛЕВОМУ краю с фиксированными слотами по символу — Tektur
  // не tabular, поэтому "00" шире "11"; при right-align большие цифры дёргались
  // при каждом тике. Фиксированный слот = стабильное место крупных цифр.
  const tNum = _phaseNumber(city, phase);
  const sec = Math.floor(tNum), cs = Math.floor((tNum - sec) * 100);
  const secStr = String(sec).padStart(2, '0');   // 2..3 знака (апгрейды батарей → до 135с)
  const csStr = String(cs).padStart(2, '0');
  const numX = x + cw - rightW + 2, numY = y + ch * 0.66;
  // апгрейды ёмкости поднимают таймер за 100с — тогда цифр три. При 3 знаках слот
  // ужимаем и убираем сотые (точность сотых на >100с не нужна, не лезет в зону).
  const big3 = sec >= 100;
  const slotBig = big3 ? 12 : 14;    // ширина слота крупной цифры (Tektur 800)
  const slotSm  = 6;                 // ширина слота сотой (Tektur 700 13px)

  // В dying glow «дышит» с тем же pulse, что бар.
  if (urgent) { ctx.shadowColor = col; ctx.shadowBlur = dying ? 6 + 8 * pulse : (blink ? 14 : 6); }
  ctx.font = `800 ${big3 ? 22 : 26}px ${FONT_DISPLAY}`;
  ctx.fillStyle = dying ? col : PAL.chalk;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < secStr.length; i++) ctx.fillText(secStr[i], numX + slotBig * (i + 0.5), numY);
  ctx.shadowBlur = 0;

  // Сотые — только когда секунд < 100 (иначе три крупные цифры занимают всю зону).
  if (!big3) {
    ctx.font = `700 13px ${FONT_DISPLAY}`;
    ctx.fillStyle = col;
    const dotX = numX + slotBig * 2 + 1;
    ctx.textAlign = 'left';
    ctx.fillText('.', dotX, numY);
    ctx.textAlign = 'center';
    const csX = dotX + 4;
    ctx.fillText(csStr[0], csX + slotSm * 0.5, numY);
    ctx.fillText(csStr[1], csX + slotSm * 1.5, numY);
  }

  // Мини-подпись «С·МС» под секундами.
  ctx.font = `7px ${FONT_MONO}`;
  ctx.fillStyle = PAL.ash;
  ctx.textAlign = 'right';
  ctx.fillText(big3 ? 'СЕК' : 'С·МС', x + cw - padX, y + ch - 5);

  ctx.restore();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
