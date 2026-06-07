'use strict';

// ============================================================
// Upgrades — внутрисессионные апгрейды (структура Dome Keeper). Открываются на базе
// по Пробелу. Валюта — БАНК сданных ресурсов (`bank`), копится при сдаче груза,
// обнуляется в конце забега. Доступный набор определяется на СТАРТЕ сессии:
//   • ЮНИТ — трек на каждый установленный модуль (+ корпус): бур/привод/сенсор/трюм/HP.
//   • ГОРОД — его собственные системы: «ёмкость батарей» (время до гибернации),
//     «контуры» (прочность колец). Город задаёт свои объекты апгрейда.
//   • ГАДЖЕТЫ — разовые устройства (эффект на весь забег).
// Покупка пересчитывает эффективные статы юнита (game) и/или апгрейды города.
// ============================================================

// step — прибавка стата за уровень; base(s) — базовое значение (для отображения).
const UPG_TRACKS = [
  { id: 'drill',   cat: 'unit', label: 'СИЛА БУРА',  sub: 'Скорость прохода породы', accent: '#f08a2a', icon: 'drill',
    need: (s) => s.canDig, step: 0.2, base: (s) => s.digMult, fmt: (v) => '×' + v.toFixed(1) },
  { id: 'engine',  cat: 'unit', label: 'ПРИВОД',     sub: 'Скорость хода',          accent: '#3a7ec8', icon: 'engine',
    need: (s) => s.canMove, step: 0.4, base: (s) => s.moveSpeed, fmt: (v) => v.toFixed(1) + ' т/с' },
  { id: 'scanner', cat: 'unit', label: 'СЕНСОР',     sub: 'Радиус сканера',         accent: '#d4a042', icon: 'scanner',
    need: (s) => s.scanR > 0, step: 0.5, base: (s) => s.scanR, fmt: (v) => 'R ' + v.toFixed(1) },
  { id: 'cargo',   cat: 'unit', label: 'ЁМКОСТЬ',    sub: 'Слотов под ресурс',      accent: '#c8e25a', icon: 'cargo',
    need: (s) => s.capacity > 0, step: 2, base: (s) => s.capacity, fmt: (v) => v + '' },
  { id: 'hull',    cat: 'unit', label: 'ПРОЧНОСТЬ',  sub: 'Максимум HP корпуса',    accent: '#ff3a22', icon: null,
    need: () => true, step: 20, base: (s) => s.maxHp, fmt: (v) => v + ' HP' },
  { id: 'battery', cat: 'city', label: 'ЁМКОСТЬ БАТАРЕЙ', sub: 'Время до гибернации', accent: '#f08a2a', icon: null,
    need: () => true, step: 15, base: () => CITY_TIMER_MAX, fmt: (v) => Math.round(v) + ' с' },
  // Контуры — 3 отдельных трека по кольцам (ring index: 0=ядро, последнее=внешний).
  { id: 'ring_outer', cat: 'city', label: 'ВНЕШНИЙ КОНТУР', sub: 'Прочность внешнего кольца', accent: '#ff3a22', icon: null,
    need: () => true, step: 40, base: () => CITY_RING_HP, fmt: (v) => Math.round(v) + ' HP', ring: CITY_RINGS - 1 },
  { id: 'ring_inner', cat: 'city', label: 'ВНУТР. КОНТУР', sub: 'Прочность внутреннего кольца', accent: '#ff3a22', icon: null,
    need: () => true, step: 40, base: () => CITY_RING_HP, fmt: (v) => Math.round(v) + ' HP', ring: 1 },
  { id: 'ring_core', cat: 'city', label: 'ЯДРО', sub: 'Прочность ядра города', accent: '#ff3a22', icon: null,
    need: () => true, step: 40, base: () => CITY_RING_HP, fmt: (v) => Math.round(v) + ' HP', ring: 0 },
];
// Соответствие трека → поле stats юнита (для applyToStats).
const UPG_STAT_MAP = { drill: 'digMult', engine: 'moveSpeed', scanner: 'scanR', cargo: 'capacity', hull: 'maxHp' };

const UPG_GADGETS = [
  { id: 'magnet', label: 'АВТО-СБОРЩИК', sub: 'Радиус подбора ресурса +1', accent: '#d4a042', cost: { iron: 18, organic: 8 } },
  { id: 'repair', label: 'РЕМОНТ-ДРОН',  sub: 'Восстанавливает HP вне базы', accent: '#ff3a22', cost: { iron: 20, organic: 12 } },
  { id: 'ping',   label: 'ОРБИТ-ПИНГ',   sub: 'Вскрывает участок карты вокруг (разово)', accent: '#3a7ec8', cost: { crystal: 8 } },
];

class Upgrades {
  constructor() {
    this.bank = { iron: 0, organic: 0, crystal: 0 };
    this.levels = {}; this.gadgets = {};
    this.base = null; this.tracks = []; this.cityName = 'База';
    this.scrollY = 0; this.maxScroll = 0;
    this.mouse = { x: 0, y: 0 };
    this.layout = null; this.buttons = [];   // hit-rects карточек
    this.onChange = null;                      // game: пересчитать статы/город
    this.holdId = null; this.holdSrc = null; this.holdT = 0;  // удержание покупки (ПРОБЕЛ/ЛКМ)
    this.buyFlash = null;                      // {id, level, t0}: вспышка-подтверждение покупки
  }

  // Старт сессии: снимок базовых статов + набор треков по модулям; банк/уровни сброшены.
  init(baseStats, cityName) {
    this.bank = { iron: 0, organic: 0, crystal: 0 };
    this.levels = {}; this.gadgets = {};
    this.base = { ...baseStats }; this.cityName = cityName || 'База';
    this.tracks = UPG_TRACKS.filter((tr) => tr.need(this.base));
    for (const tr of this.tracks) this.levels[tr.id] = 0;
    this.scrollY = 0; this.sel = 0; this.warnT = -1e9;
  }

  addBank(type, n) { this.bank[type] = (this.bank[type] || 0) + (n || 1); }
  tierCost(level) { return UPG_TIER_COSTS[Math.min(level, UPG_TIER_COSTS.length - 1)]; }
  canAfford(cost) { return Object.entries(cost).every(([k, v]) => (this.bank[k] || 0) >= v); }
  spend(cost) { for (const k in cost) this.bank[k] = Math.max(0, (this.bank[k] || 0) - cost[k]); }
  trackVal(tr, lvl) { return tr.base(this.base) + lvl * tr.step; }

  buyTrack(id) {
    const tr = this.tracks.find((t) => t.id === id); if (!tr) return;
    const lvl = this.levels[id] || 0; if (lvl >= UPG_MAX) return;
    const cost = this.tierCost(lvl); if (!this.canAfford(cost)) return;
    this.spend(cost); this.levels[id] = lvl + 1;
    this.buyFlash = { id, level: lvl + 1, t0: performance.now() };   // подтверждение: свечение купленной карточки
    if (this.onChange) this.onChange('track', id);
  }
  buyGadget(id) {
    if (this.gadgets[id]) return;
    const g = UPG_GADGETS.find((x) => x.id === id); if (!g || !this.canAfford(g.cost)) return;
    this.spend(g.cost); this.gadgets[id] = true;
    if (this.onChange) this.onChange('gadget', id);
  }

  // Эффективные статы юнита = база + прибавки уровней.
  applyToStats() {
    const s = { ...this.base };
    for (const tr of UPG_TRACKS) {
      if (tr.cat !== 'unit') continue;
      const lvl = this.levels[tr.id] || 0, f = UPG_STAT_MAP[tr.id];
      if (lvl && f) s[f] += lvl * tr.step;
    }
    return s;
  }
  cityTimerBonus() { return (this.levels.battery || 0) * 15; }
  // Прибавки HP по кольцам (индекс кольца → бонус), из 3 контур-треков.
  cityRingBonuses() {
    const arr = new Array(CITY_RINGS).fill(0);
    for (const tr of UPG_TRACKS) if (tr.ring != null) arr[tr.ring] = (this.levels[tr.id] || 0) * tr.step;
    return arr;
  }
  pickupBonus() { return this.gadgets.magnet ? 1 : 0; }

  // ---- навигация WASD: выбор «крайнего» (следующего к покупке) слота трека ----
  moveSel(d) { if (!this.tracks.length) return; this.sel = Math.max(0, Math.min(this.tracks.length - 1, (this.sel || 0) + d)); this.endHold(); }
  selTrack() { return this.tracks[this.sel || 0]; }
  selNextCost() { const tr = this.selTrack(); if (!tr) return null; const lvl = this.levels[tr.id] || 0; return lvl >= UPG_MAX ? null : this.tierCost(lvl); }
  selAffordable() { const c = this.selNextCost(); return c ? this.canAfford(c) : false; }
  // покупаемость трека: есть следующий уровень и хватает банка
  trackBuyable(id) { const tr = this.tracks.find((t) => t.id === id); if (!tr) return false; const lvl = this.levels[id] || 0; return lvl < UPG_MAX && this.canAfford(this.tierCost(lvl)); }

  // ---- удержание для покупки: ПРОБЕЛ или зажатая ЛКМ заполняют карточку за UPG_HOLD_TIME ----
  beginHold(id, src) {
    if (!id) return;
    const tr = this.tracks.find((t) => t.id === id); if (!tr) return;
    if ((this.levels[id] || 0) >= UPG_MAX) return;               // уже максимум
    if (!this.trackBuyable(id)) { this.warnT = performance.now(); return; }  // не хватает — вспышка
    this.holdId = id; this.holdSrc = src; this.holdT = 0;
  }
  endHold() { this.holdId = null; this.holdSrc = null; this.holdT = 0; }
  // тик удержания (game зовёт каждый кадр); при достижении порога — покупка
  tickHold(dt) {
    if (!this.holdId) return;
    if (!this.trackBuyable(this.holdId)) { this.endHold(); return; }   // банк иссяк по ходу — отмена
    this.holdT += dt;
    if (this.holdT >= UPG_HOLD_TIME) { const id = this.holdId; this.endHold(); this.buyTrack(id); }
  }
  holdFrac() { return this.holdId ? Math.min(1, this.holdT / UPG_HOLD_TIME) : 0; }

  // =============================================================
  // UI
  // =============================================================
  computeLayout(W, H) {
    const headerH = 96;
    const list = { x: Math.round(W * 0.06), y: headerH, w: Math.round(W * 0.88), h: H - headerH - 40 };
    this.layout = { list, W, H };
    return this.layout;
  }
  inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  onWheel(dy) { this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy)); }
  pointerDown(x, y) {
    this.mouse = { x, y };
    for (const b of this.buttons) if (this.inRect(x, y, b)) {
      const idx = this.tracks.findIndex((t) => t.id === b.trackId);
      if (idx >= 0) this.sel = idx;             // клик по карточке = выбор трека (курсор для мыши)
      if (b.buyable) this.beginHold(b.trackId, 'mouse');  // зажать на покупаемой → заполняется
      else if (b.next) this.warnT = performance.now();    // следующий, но не по карману
      return;
    }
  }
  pointerMove(x, y) { this.mouse = { x, y }; }
  pointerUp() { if (this.holdSrc === 'mouse') this.endHold(); }   // отпустил ЛКМ — отмена недозаполненной

  draw(ctx, W, H) {
    const L = this.computeLayout(W, H);
    drawStaticBg(ctx, W, H);
    hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);

    // ===== шапка: заголовок + кошелёк =====
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    pulseDot(ctx, L.list.x + 4, 24, 3, PAL.amber);
    ctx.fillStyle = PAL.amber; ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('// НА БАЗЕ · ПРИНТЕР ОНЛАЙН', L.list.x + 16, 27);
    ctx.fillStyle = PAL.chalk; ctx.font = `700 26px ${FONT_DISPLAY}`;
    ctx.fillText('УЛУЧШЕНИЯ', L.list.x, 56);
    ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText(`ГОРОД «${this.cityName.toUpperCase()}» · WASD/КЛИК — ВЫБОР · ЗАЖМИ ПРОБЕЛ/ЛКМ — КУПИТЬ · ESC — ЗАКРЫТЬ`, L.list.x, 74);
    // надпись «не хватает ресурсов»: если выбранный апгрейд не по карману (или была
    // неудачная попытка покупки) — мигаем в шапке справа от заголовка.
    const lowOnRes = this.selNextCost() && !this.selAffordable();
    const flashing = performance.now() - (this.warnT || -1e9) < 1400;
    if (lowOnRes || flashing) {
      const a = flashing ? (0.6 + 0.4 * Math.sin(performance.now() / 120)) : 0.85;
      ctx.globalAlpha = a; ctx.fillStyle = PAL.bloodBright; ctx.font = `bold 12px ${FONT_MONO}`;
      ctx.fillText('⚠ НЕ ХВАТАЕТ РЕСУРСОВ', L.list.x + 220, 54); ctx.globalAlpha = 1;
    }
    this._drawWallet(ctx, L.list.x + L.list.w, 36);

    // ===== прокручиваемый список секций: каждый трек = РЯД карточек по уровням =====
    const innerY = L.list.y, innerH = L.list.h;
    this.buttons = [];
    ctx.save();
    ctx.beginPath(); ctx.rect(L.list.x - 4, innerY, L.list.w + 8, innerH); ctx.clip();
    let cy = innerY - this.scrollY;
    const rowH = 58, rowGap = 10;
    const drawSection = (title, accent, items) => {
      ctx.fillStyle = accent; ctx.font = `700 15px ${FONT_DISPLAY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (cy + 18 > innerY && cy < innerY + innerH) {
        ctx.fillText(title, L.list.x, cy + 13);
        ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
        const tw = ctx.measureText(title).width;
        ctx.beginPath(); ctx.moveTo(L.list.x + tw + 12, cy + 8); ctx.lineTo(L.list.x + L.list.w, cy + 8); ctx.stroke();
      }
      cy += 24;
      for (const tr of items) {
        const selected = tr === this.selTrack();
        if (selected) this._selScreenY = cy;   // запомнить для авто-скролла
        if (cy + rowH > innerY && cy < innerY + innerH) this._drawTrackRow(ctx, L.list.x, cy, L.list.w, rowH, tr, selected);
        cy += rowH + rowGap;
      }
      cy += 16;
    };

    this._selScreenY = null;
    drawSection('// ЮНИТ', PAL.cobalt, this.tracks.filter((t) => t.cat === 'unit'));
    drawSection('// ГОРОД · ' + this.cityName.toUpperCase(), PAL.amber, this.tracks.filter((t) => t.cat === 'city'));
    ctx.restore();

    const contentH = cy + this.scrollY - innerY;
    this.maxScroll = Math.max(0, contentH - innerH);
    if (this.scrollY > this.maxScroll) this.scrollY = this.maxScroll;
    // авто-скролл к выбранному ряду (следующий кадр)
    if (this._selScreenY != null) {
      if (this._selScreenY < innerY + 24) this.scrollY = Math.max(0, this.scrollY - (innerY + 24 - this._selScreenY));
      else if (this._selScreenY + rowH > innerY + innerH) this.scrollY = Math.min(this.maxScroll, this.scrollY + (this._selScreenY + rowH - (innerY + innerH)));
    }
    if (this.maxScroll > 0) {
      const tX = L.list.x + L.list.w + 4, tY = innerY, tH = innerH;
      ctx.fillStyle = PAL.bronze; ctx.fillRect(tX, tY, 3, tH);
      const thH = Math.max(24, tH * innerH / (innerH + this.maxScroll));
      ctx.fillStyle = PAL.gold; ctx.fillRect(tX, tY + (tH - thH) * (this.scrollY / this.maxScroll), 3, thH);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _drawWallet(ctx, rightX, y) {
    const keys = ['iron', 'organic', 'crystal'], cw = 96, gap = 8;
    let x = rightX - (cw * keys.length + gap * (keys.length - 1));
    for (const k of keys) {
      ctx.fillStyle = 'rgba(20,16,12,0.96)'; ctx.fillRect(x, y, cw, 38);
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, 37);
      paintResource(ctx, k, x + 16, y + 19, 8, (k.charCodeAt(0) * 99) | 0);
      ctx.fillStyle = PAL.pewter; ctx.font = `7px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(RESOURCE_DEFS[k].name.toUpperCase(), x + 30, y + 7);
      ctx.fillStyle = RESOURCE_DEFS[k].color; ctx.font = `700 16px ${FONT_MONO}`; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${this.bank[k] || 0}`, x + 30, y + 31);
      x += cw + gap;
    }
  }

  // Ряд трека: слева компактная подпись (иконка+имя+тек.значение), справа — ВСЕ
  // уровни карточками. Куплённые — залиты акцентом; следующий — активен (по клику
  // покупка, если хватает банка); дальние — заблокированы (видны, но не кликабельны).
  _drawTrackRow(ctx, x, y, w, h, tr, selected) {
    const lvl = this.levels[tr.id] || 0, accent = tr.accent;
    const labelW = 156;
    // подсветка выбранного ряда (WASD-курсор)
    if (selected) {
      ctx.fillStyle = 'rgba(212,160,66,0.06)'; ctx.fillRect(x - 4, y - 2, w + 8, h + 4);
      ctx.strokeStyle = PAL.gold; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 1.5, w + 7, h + 3);
    }
    // иконка
    if (tr.icon) { ctx.save(); ctx.translate(x + 16, y + h / 2); drawModuleIcon(ctx, tr.icon, 0, 0, 12, accent); ctx.restore(); }
    const tx = x + (tr.icon ? 34 : 8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PAL.chalk; ctx.font = `bold 11px ${FONT_MONO}`; ctx.fillText(tr.label, tx, y + 18);
    ctx.fillStyle = PAL.pewter; ctx.font = `8px ${FONT_MONO}`; ctx.fillText(tr.sub, tx, y + 32);
    ctx.fillStyle = lvl >= UPG_MAX ? accent : PAL.bone; ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('СЕЙЧАС: ' + tr.fmt(this.trackVal(tr, lvl)) + (lvl >= UPG_MAX ? ' · MAX' : ''), tx, y + 47);

    // карточки уровней
    const ca = x + labelW, gap = 6, cw = (x + w - ca - gap * (UPG_MAX - 1)) / UPG_MAX, ch = h;
    for (let k = 1; k <= UPG_MAX; k++) {
      const cx = ca + (k - 1) * (cw + gap);
      const owned = k <= lvl, next = k === lvl + 1, locked = k > lvl + 1;
      const cost = this.tierCost(k - 1), afford = next && this.canAfford(cost);
      const edge = next && selected;   // «крайний» слот выбранного трека (курсор WASD)
      // фон/рамка по состоянию
      if (owned) { ctx.fillStyle = 'rgba(20,16,12,0.96)'; }
      else if (next) { ctx.fillStyle = afford ? 'rgba(20,16,12,0.96)' : 'rgba(13,10,14,0.7)'; }
      else { ctx.fillStyle = 'rgba(10,8,12,0.55)'; }
      ctx.fillRect(cx, y, cw, ch);
      const bcol = edge ? PAL.goldBright : owned ? accent : next ? (afford ? accent : PAL.bronze) : PAL.carbon;
      ctx.strokeStyle = bcol; ctx.lineWidth = edge ? 2.4 : (next && afford) ? 1.6 : 1; ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, ch - 1);
      if (owned) { ctx.fillStyle = accent; ctx.globalAlpha = 0.12; ctx.fillRect(cx, y, cw, ch); ctx.globalAlpha = 1; }
      // «УР k»
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = owned ? accent : next ? PAL.bone : PAL.ash; ctx.font = `7px ${FONT_MONO}`;
      ctx.fillText('УР ' + k, cx + 6, y + 13);
      if (owned) { ctx.fillStyle = accent; ctx.font = `9px ${FONT_MONO}`; ctx.textAlign = 'right'; ctx.fillText('✓', cx + cw - 6, y + 13); }
      // значение уровня (результат)
      ctx.textAlign = 'left'; ctx.fillStyle = owned ? PAL.chalk : next ? PAL.chalk : PAL.ash; ctx.font = `bold 10px ${FONT_MONO}`;
      ctx.fillText(tr.fmt(this.trackVal(tr, k)), cx + 6, y + 30);
      // цена (для не-купленных)
      if (!owned) {
        ctx.font = `8px ${FONT_MONO}`; ctx.textBaseline = 'middle';
        let px = cx + 6; const cyc = y + ch - 12;
        for (const rk of Object.keys(cost)) {
          paintResource(ctx, rk, px + 4, cyc, 4, 7);
          ctx.fillStyle = locked ? PAL.ash : (this.bank[rk] || 0) >= cost[rk] ? RESOURCE_DEFS[rk].color : PAL.bloodBright;
          ctx.textAlign = 'left'; ctx.fillText(`${cost[rk]}`, px + 11, cyc + 1);
          px += 11 + ctx.measureText(`${cost[rk]}`).width + 6;
        }
        ctx.textBaseline = 'alphabetic';
      }
      // заполнение при удержании покупки (ПРОБЕЛ/ЛКМ) — растёт СЛЕВА НАПРАВО
      if (next && afford && this.holdId === tr.id) {
        const frac = this.holdFrac(), fw = cw * frac;
        ctx.save(); ctx.beginPath(); ctx.rect(cx, y, cw, ch); ctx.clip();
        const gfill = ctx.createLinearGradient(cx, y, cx + cw, y);
        gfill.addColorStop(0, accent); gfill.addColorStop(1, PAL.goldBright);
        ctx.globalAlpha = 0.5; ctx.fillStyle = gfill; ctx.fillRect(cx, y, fw, ch);
        ctx.globalAlpha = 1; ctx.strokeStyle = PAL.chalk; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx + fw, y); ctx.lineTo(cx + fw, y + ch); ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = PAL.goldBright; ctx.lineWidth = 2.4; ctx.strokeRect(cx + 0.5, y + 0.5, cw - 1, ch - 1);
      }
      // вспышка-подтверждение покупки: купленная карточка коротко вспыхивает свечением
      if (this.buyFlash && this.buyFlash.id === tr.id && this.buyFlash.level === k) {
        const p = (performance.now() - this.buyFlash.t0) / 420;   // длительность вспышки
        if (p >= 1) this.buyFlash = null;
        else {
          const a = 1 - p;
          ctx.save();
          ctx.globalAlpha = 0.5 * a; ctx.fillStyle = PAL.goldBright; ctx.fillRect(cx, y, cw, ch);
          ctx.globalAlpha = a; ctx.shadowColor = PAL.goldBright; ctx.shadowBlur = 16 * a;
          ctx.strokeStyle = PAL.goldBright; ctx.lineWidth = 2.5;
          const g = 3 * (1 - a);                                  // лёгкий «pop» наружу
          ctx.strokeRect(cx - g + 0.5, y - g + 0.5, cw + 2 * g - 1, ch + 2 * g - 1);
          ctx.restore();
        }
      }
      // hit-rect карточки (клик = выбор; покупаемая → удержание)
      this.buttons.push({ x: cx, y: y, w: cw, h: ch, trackId: tr.id, level: k, next, buyable: next && afford });
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
}
