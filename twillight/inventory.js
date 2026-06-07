'use strict';

// ============================================================
// Inventory — сборка юнита перед забегом: слева ЖИВОЙ рендер собранного юнита
// (тот же риг со спрайтами деталей, что в игре и tools/rig_editor), справа список
// модулей по категориям. По умолчанию юнит СОБРАН (все слоты заняты). Гнёзда-кольца
// наложены на реальные детали; драг карточки на гнездо своей категории МЕНЯЕТ
// установленный модуль (полезно, когда в категории >1 варианта).
//
// Никаких гексов/реактора/энергии/подложки-схемы. Груз — счётчики ресурсов;
// ёмкость — модуль «Трюм».
// ============================================================

// Подпись гнезда + направление выноски (экранно). Гнездо садится на деталь рига
// категории (`kind`); позиция берётся из resolveUnitRig — всегда совпадает с тем,
// как деталь нарисована.
const SLOT_META = {
  drill:   { kind: 'drill',  label: 'БУР',       lx:  1, ly: -1 },
  engine:  { kind: 'engine', label: 'ДВИГАТЕЛЬ', lx:  0, ly:  1 },
  scanner: { kind: 'sensor', label: 'СКАНЕР',    lx: -1, ly: -1 },
  cargo:   { kind: 'hold',   label: 'ТРЮМ',      lx: -1, ly:  1 },
};

class Inventory {
  constructor() {
    this.hull = 'core';   // дефолтный юнит — кольцевой (старый scout пока не используется)
    this.modules = {};          // category → moduleType (пусто = слот не занят)
    this.cargo = { iron: 0, organic: 0, crystal: 0 };
    this.unit = null;           // юнит забега — ЕДИНЫЙ источник эффективных статов (с апгрейдами); null = экран сборки

    this.drag = null;           // { type, category } — перетаскиваемый шаблон
    this.mouse = { x: 0, y: 0 };
    this.layout = null;
    this.hoverCard = null;
    this.hoverSlot = null;
    this.scrollY = 0;           // вертикальный скролл списка модулей
    this.maxScroll = 0;
    this.onStart = null;
    this.preGame = true;

    this.defaultBuild();
  }

  // По умолчанию юнит СОБРАН — каждый слот корпуса получает первый модуль своей
  // категории (как риг в тулзе). Менять можно при наличии других вариантов.
  defaultBuild() {
    this.modules = {};
    for (const slot of HULL_DEFS[this.hull].slots)
      for (const key in MODULE_DEFS) if (MODULE_DEFS[key].category === slot) { this.modules[slot] = key; break; }
  }
  reset() { this.defaultBuild(); this.resetCargo(); this.unit = null; this.drag = null; this.scrollY = 0; }
  resetCargo() { for (const k in this.cargo) this.cargo[k] = 0; }

  // Производные статы по установленным модулям. HP — из корпуса.
  getStats() {
    const hull = HULL_DEFS[this.hull];
    const s = { maxHp: hull.hp, moveSpeed: 0, digMult: 0, scanR: 0, capacity: 0,
                canDig: false, canMove: false };
    for (const cat in this.modules) {
      const t = this.modules[cat]; if (!t) continue;
      const m = MODULE_DEFS[t]; if (!m) continue;
      if (m.digMult)  { s.digMult += m.digMult;  s.canDig = true; }
      if (m.speed)    { s.moveSpeed = Math.max(s.moveSpeed, m.speed); s.canMove = true; }
      if (m.scanR)    s.scanR = Math.max(s.scanR, m.scanR);
      if (m.capacity) s.capacity += m.capacity;
    }
    // Готов к старту, когда все слоты корпуса заняты.
    s.valid = HULL_DEFS[this.hull].slots.every((cat) => !!this.modules[cat]);
    s.missing = HULL_DEFS[this.hull].slots.filter((cat) => !this.modules[cat]);
    return s;
  }

  // ---- Груз ----
  cargoUsed()    { return this.cargo.iron + this.cargo.organic + this.cargo.crystal; }
  cargoCapacity(){ return this.unit ? this.unit.stats.capacity : this.getStats().capacity; }  // в забеге — эффективная ёмкость юнита (с апгрейдами), иначе по сборке
  cargoFree()    { return Math.max(0, this.cargoCapacity() - this.cargoUsed()); }
  cargoCounts()  { return { ...this.cargo }; }
  addCargo(type) {
    if (this.cargoUsed() >= this.cargoCapacity()) return false;
    this.cargo[type] = (this.cargo[type] || 0) + 1;
    return true;
  }
  deliverOneCargo() {
    for (const t of Object.keys(this.cargo)) if (this.cargo[t] > 0) { this.cargo[t]--; return t; }
    return null;
  }

  // =============================================================
  // UI: чертёж + галереи модулей + сводка
  // =============================================================
  computeLayout(W, H) {
    const headerH = 90;
    const bx = Math.round(W * 0.04), by = headerH, bw = Math.round(W * 0.54);
    const bh = Math.round(H - headerH - 200);
    const blueprint = { x: bx, y: by, w: bw, h: bh, cx: bx + bw / 2, cy: by + bh / 2 };
    const stats = { x: bx, y: by + bh + 8, w: bw, h: 84 };
    const lx = bx + bw + 18, ly = by;
    const lw = Math.max(280, W - lx - Math.round(W * 0.04));
    const lh = bh + 8 + 84;
    const list = { x: lx, y: ly, w: lw, h: lh };
    const start = { x: bx, y: H - 64, w: bw, h: 50 };
    this.layout = { blueprint, stats, list, start, W, H };
    return this.layout;
  }
  inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  // ---- чертёж: живой риг юнита + позиции гнёзд по деталям ----
  // Болванка-юнит для рендера/рига. `allOn`=true — все детали присутствуют (для
  // позиций гнёзд); иначе по факту установки (отсутствующий модуль = деталь скрыта).
  _dummyUnit(allOn) {
    return {
      hull: this.hull, dx: 1, dy: 0, faceX: 1, state: IDLE, crouchT: 0, noAnim: false, px: 0, py: 0,
      stats: {
        canDig:   allOn || !!this.modules.drill,
        canMove:  allOn || !!this.modules.engine,
        scanR:    (allOn || this.modules.scanner) ? 1 : 0,
        capacity: (allOn || this.modules.cargo)   ? 1 : 0,
      },
    };
  }
  // Масштаб «вписать риг в панель»: по габаритам деталей+ног (со спрайтами длинные),
  // крупно (множитель подобран, чтобы юнит занимал бо́льшую часть панели).
  blueprintScale(L) {
    const rig = resolveUnitRig(0, 0, this._dummyUnit(true), 0), def = UNIT_DEFS[this.hull] || {};
    let maxR = rig.R * 1.5;
    if (def.kind === 'ring') {   // кольцо: габарит по выносу модулей (rig.parts тут NaN), + ноги
      for (const p of def.parts) if (p.kind !== 'leg') maxR = Math.max(maxR, ((p.rad || def.ringR || 1) + 1.1) * rig.R);
    } else {
      for (const p of rig.parts) maxR = Math.max(maxR, Math.hypot(p.x, p.y) + rig.R);
    }
    for (const lg of rig.legs) for (const sg of lg.segs) maxR = Math.max(maxR, Math.hypot(sg.lx, sg.ly), Math.hypot(sg.jx, sg.jy));
    const b = L.blueprint, half = Math.min(b.w, b.h - 30) / 2;
    return Math.max(1, half * 1.55 / maxR);
  }
  // t — общее время для idle-анимации (чтобы кольца гнёзд следовали за деталями).
  _rigTime() { return performance.now() / 1000; }
  // IK-щупальца для превью (как в игре, а не FK-ноги), на ФЕЙКОВОМ полу. Юнит в (0, TILE*0.5),
  // пол снизу (ty>=1). Конфиги в ДИЗАЙН-px (scale 1 — внешний `S` масштабирует панель целиком).
  _previewLegRig() {
    if (typeof makeLegRig !== 'function' || typeof updateLegRig !== 'function' || typeof legConfigsFromUnit !== 'function') return null;
    const sig = this.hull + ':' + JSON.stringify(this.modules);
    if (!this._plRig || this._plSig !== sig) {
      this._plRig = makeLegRig(legConfigsFromUnit(this._dummyUnit(false), 1), 1);
      this._plSig = sig;
      // Пол на ~60% ВЫЛЕТА ноги: ноги вытянуты к полу, но не поджаты и не у предела.
      let reach = 0; for (const L of this._plRig.legs) reach = Math.max(reach, L.reach || 0);
      this._plWy = TILE - reach * 0.6;
    }
    const world = { tileAt: (tx, ty) => ({ type: ty >= 1 ? ROCK : AIR }) };   // фейковый пол снизу (48px)
    this._plRig.supportAngle = 0;
    // ФИКС. dt (не из реального времени рендера): экспон-сглаживание ног (`smk=dt*30`) при «гуляющем»
    // dt давало мелкое дрожание стоп — а на крупном масштабе панели (×S) оно ВИДНО. idle-«дыхание»
    // внутри legik берёт реальное `performance.now()`, так что движение остаётся живым.
    updateLegRig(this._plRig, 1 / 60, 0, this._plWy, world, { x: 0, y: 0 });
    return this._plRig;
  }
  computeSlots() {
    const L = this.layout; if (!L) return [];
    const b = L.blueprint, S = this.blueprintScale(L);
    const rig = resolveUnitRig(0, 0, this._dummyUnit(true), this._rigTime());
    const out = [];
    for (const cat in SLOT_META) {
      const part = rig.parts.find((p) => p.kind === SLOT_META[cat].kind);
      if (!part) continue;
      out.push({ category: cat, label: SLOT_META[cat].label, lx: SLOT_META[cat].lx, ly: SLOT_META[cat].ly,
                 x: b.cx + part.x * S, y: b.cy + part.y * S });
    }
    return out;
  }
  slotAt(x, y) {
    for (const s of this.computeSlots()) if (Math.hypot(x - s.x, y - s.y) < 34) return s;
    return null;
  }

  // ---- галерея карточек: вертикальный стек категорий, горизонтальный ряд карт ----
  CARD_W() { return 104; }
  CARD_H() { return 116; }
  computeCards() {
    const L = this.layout; if (!L) return { cards: [], headers: [], contentH: 0 };
    const labels = { drill: 'БУРЫ', engine: 'ДВИГАТЕЛИ', scanner: 'СКАНЕРЫ', cargo: 'ТРЮМЫ' };
    const cw = this.CARD_W(), ch = this.CARD_H(), cgap = 10, hdrH = 22, rowGap = 18;
    const x0 = L.list.x + 14, y0 = L.list.y + 38 - this.scrollY;
    const cards = [], headers = [];
    let cy = y0;
    for (const cat of HULL_DEFS[this.hull].slots) {
      headers.push({ label: labels[cat] || cat.toUpperCase(), x: x0, y: cy, w: L.list.w - 28 });
      cy += hdrH;
      const mods = Object.keys(MODULE_DEFS).filter((k) => MODULE_DEFS[k].category === cat);
      mods.forEach((type, i) => {
        cards.push({ type, category: cat, def: MODULE_DEFS[type], x: x0 + i * (cw + cgap), y: cy, w: cw, h: ch });
      });
      cy += ch + rowGap;
    }
    const contentH = (cy + this.scrollY) - (L.list.y + 38) + 12;
    return { cards, headers, contentH };
  }
  cardAt(x, y) {
    const L = this.layout; if (!L) return null;
    if (!this.inRect(x, y, { x: L.list.x, y: L.list.y + 30, w: L.list.w, h: L.list.h - 38 })) return null; // клип-зона списка
    for (const c of this.computeCards().cards) if (this.inRect(x, y, c)) return c;
    return null;
  }

  // =============================================================
  // Ввод
  // =============================================================
  onWheel(dy) { this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy)); }
  pointerDown(x, y) {
    const L = this.layout; if (!L) return;
    this.mouse = { x, y };
    if (this.inRect(x, y, L.start)) { if (this.getStats().valid && this.onStart) this.onStart(); return; }
    const card = this.cardAt(x, y);
    if (card) this.drag = { type: card.type, category: card.category };
  }
  pointerMove(x, y) {
    this.mouse = { x, y };
    this.hoverCard = this.drag ? null : this.cardAt(x, y);
    this.hoverSlot = this.drag ? this.slotAt(x, y) : null;
  }
  pointerUp(x, y) {
    if (!this.drag) return;
    const slot = this.slotAt(x, y);
    if (slot && slot.category === this.drag.category) this.modules[slot.category] = this.drag.type;
    this.drag = null;
  }

  // =============================================================
  // Рендер
  // =============================================================
  draw(ctx, W, H) {
    const L = this.computeLayout(W, H);
    this.hoverCard = this.drag ? null : this.cardAt(this.mouse.x, this.mouse.y);
    this.hoverSlot = this.drag ? this.slotAt(this.mouse.x, this.mouse.y) : null;

    drawStaticBg(ctx, W, H);
    hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    pulseDot(ctx, W / 2 - 110, 23, 3, PAL.gold);
    ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('// СБОРКА ЮНИТА · АКТИВНА', W / 2, 26);
    ctx.fillStyle = PAL.chalk; ctx.font = `700 28px ${FONT_DISPLAY}`;
    ctx.fillText('ЧЕРТЁЖ', W / 2, 54);
    ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`;
    ctx.fillText('ТАЩИ КАРТОЧКУ МОДУЛЯ НА СВЕТЯЩИЙСЯ СЛОТ · ENTER · В ШАХТУ', W / 2, 74);

    this._drawBlueprint(ctx, L);
    this._drawStats(ctx, L);
    this._drawList(ctx, L);
    this._drawStart(ctx, L);

    if (this.drag) this._drawDragGhost(ctx);
  }

  _drawBlueprint(ctx, L) {
    const b = L.blueprint;
    techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.cobalt, label: '// ЮНИТ · СКИТАЛЕЦ', serial: 'RIG' });

    ctx.save();
    ctx.beginPath(); ctx.rect(b.x + 6, b.y + 22, b.w - 12, b.h - 28); ctx.clip();

    // лёгкая сетка-«пол» (атмосфера, не подложка-схема)
    ctx.strokeStyle = 'rgba(58,126,200,0.06)'; ctx.lineWidth = 1;
    for (let gy = b.y + 24; gy < b.y + b.h - 6; gy += 32) { ctx.beginPath(); ctx.moveTo(b.x + 6, gy + 0.5); ctx.lineTo(b.x + b.w - 6, gy + 0.5); ctx.stroke(); }

    const slots = this.computeSlots();
    // фоновые подписи-выноски (под юнитом)
    for (const s of slots) this._drawCallout(ctx, s);

    // ЖИВОЙ риг юнита со спрайтами (по фактической сборке: нет модуля → деталь скрыта)
    const S = this.blueprintScale(L);
    const fakeCam = { x: 0, y: 0, screenX: (px) => px };
    const dum = this._dummyUnit(false), ringDef = UNIT_DEFS[this.hull] && UNIT_DEFS[this.hull].kind === 'ring';
    ctx.save(); ctx.translate(b.cx, b.cy); ctx.scale(S, S);
    if (ringDef) {   // КОЛЬЦО: ноги-ЩУПАЛЬЦА (IK, как в игре) ПОД + кольцо-реактор/модули
      if (typeof partsHull === 'function') partsHull(dum.hull);
      const lr = this._previewLegRig();
      if (lr) {   // IK-щупальца на фейковом полу + корпус едет на их bodyOff (как в игре)
        drawLegRig(ctx, lr, { y: this._plWy, screenX: (px) => px });
        drawRingUnit(ctx, null, dum, fakeCam, { scale: 1, dx: lr.bodyOff.x, dy: lr.bodyOff.y });
      } else {    // фолбэк: FK-ноги
        const rig = resolveUnitRig(0, 0, this._dummyUnit(true), this._rigTime());
        for (const leg of rig.legs) drawLeg(ctx, leg, rig.R);
        drawRingUnit(ctx, null, dum, fakeCam, { scale: 1 });
      }
    } else {
      drawTachikoma(ctx, null, dum, fakeCam);
    }
    ctx.restore();

    // гнёзда — лёгкие кольца-цели поверх деталей: установленный — тонкое кольцо,
    // пустой — пунктир amber, при перетаскивании подходящей карточки — подсветка.
    for (const s of slots) {
      const filled = !!this.modules[s.category];
      const matchable = this.drag && this.drag.category === s.category;
      const hovering = matchable && this.hoverSlot && this.hoverSlot.category === s.category;
      const r = 24;
      let col, lw, dash, alpha;
      if (hovering)        { col = PAL.goldBright; lw = 2.5; dash = []; alpha = 1; }
      else if (matchable)  { col = PAL.gold;       lw = 2;   dash = [5, 4]; alpha = 1; }
      else if (filled)     { col = PAL.cobalt;     lw = 1;   dash = []; alpha = 0.5; }
      else                 { col = PAL.amber;      lw = 1.5; dash = [4, 4]; alpha = 1; }
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // Выноска: тонкая линия от кольца гнезда к фоновой подписи в сторону (lx,ly).
  _drawCallout(ctx, s) {
    const r = 24, len = 26, dx = s.lx, dy = s.ly;
    const n = Math.hypot(dx, dy) || 1;
    const ex = s.x + (dx / n) * (r + len), ey = s.y + (dy / n) * (r + len);
    ctx.strokeStyle = 'rgba(122,112,94,0.45)'; ctx.lineWidth = 1;   // pewter-dim, фоновая
    ctx.beginPath();
    ctx.moveTo(s.x + (dx / n) * r, s.y + (dy / n) * r);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + (dx >= 0 ? 14 : -14), ey);
    ctx.stroke();
    ctx.fillStyle = 'rgba(122,112,94,0.7)'; ctx.font = `8px ${FONT_MONO}`;
    ctx.textAlign = dx >= 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(s.label, ex + (dx >= 0 ? 16 : -16), ey);
  }

  _drawStats(ctx, L) {
    const s = this.getStats(), b = L.stats;
    techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.gold, label: '// СВОДКА', serial: 'STATS' });
    const items = [
      ['ХП',       `${s.maxHp}`,                          PAL.bloodBright],
      ['СКОРОСТЬ', s.canMove ? `${s.moveSpeed} т/с` : '—', PAL.cobalt],
      ['БУР',      s.canDig ? `×${s.digMult.toFixed(1)}` : '—', PAL.amber],
      ['СКАНЕР',   s.scanR ? `${s.scanR} т` : '—',        PAL.gold],
      ['ГРУЗ',     `${s.capacity}`,                       PAL.toxic],
    ];
    const cellW = (b.w - 24) / items.length;
    items.forEach(([k, v, c], i) => {
      const cx = b.x + 12 + cellW * (i + 0.5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = PAL.pewter; ctx.font = `9px ${FONT_MONO}`; ctx.fillText(k, cx, b.y + 28);
      ctx.fillStyle = v === '—' ? PAL.ash : c; ctx.font = `800 22px ${FONT_DISPLAY}`;
      ctx.fillText(v, cx, b.y + 46);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  _drawList(ctx, L) {
    techPanel(ctx, L.list.x, L.list.y, L.list.w, L.list.h, { accent: PAL.gold, label: '// МОДУЛИ', serial: 'CAT' });
    const { cards, headers, contentH } = this.computeCards();
    const innerY = L.list.y + 30, innerH = L.list.h - 38;
    this.maxScroll = Math.max(0, contentH - innerH);
    if (this.scrollY > this.maxScroll) this.scrollY = this.maxScroll;

    ctx.save();
    ctx.beginPath(); ctx.rect(L.list.x + 4, innerY, L.list.w - 8, innerH); ctx.clip();
    for (const h of headers) {
      if (h.y + 14 < innerY || h.y > innerY + innerH) continue;
      ctx.fillStyle = PAL.gold; ctx.font = `bold 10px ${FONT_MONO}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`// ${h.label}`, h.x, h.y + 12);
      const tw = ctx.measureText(`// ${h.label}`).width;
      ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(h.x + tw + 8, h.y + 8); ctx.lineTo(h.x + h.w, h.y + 8); ctx.stroke();
    }
    for (const c of cards) {
      if (c.y + c.h < innerY || c.y > innerY + innerH) continue;
      const installed = this.modules[c.category] === c.type;
      const hover = this.hoverCard && this.hoverCard.type === c.type;
      this._drawCard(ctx, c.x, c.y, c.w, c.h, c.def, installed, hover);
    }
    ctx.restore();

    // Скролл-индикатор справа от списка
    if (this.maxScroll > 0) {
      const trackX = L.list.x + L.list.w - 6, trackY = innerY + 2, trackH = innerH - 4;
      ctx.fillStyle = PAL.bronze; ctx.fillRect(trackX, trackY, 3, trackH);
      const thumbH = Math.max(20, trackH * innerH / (innerH + this.maxScroll));
      const thumbY = trackY + (trackH - thumbH) * (this.scrollY / this.maxScroll);
      ctx.fillStyle = PAL.gold; ctx.fillRect(trackX, thumbY, 3, thumbH);
    }
  }

  // Карточка модуля: высокая и узкая (видно, что в галерее есть ещё). Сверху —
  // область ассета (пока крупная иконка-плейсхолдер), ниже имя и стат.
  _drawCard(ctx, x, y, w, h, def, installed, hover) {
    const accent = def.color;
    ctx.fillStyle = installed ? 'rgba(20,16,12,0.96)' : 'rgba(13,10,14,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = installed ? accent : (hover ? PAL.bone : PAL.bronze);
    ctx.lineWidth = installed ? 1.5 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // область ассета: настоящий спрайт модуля (та же деталь, что на юните); если
    // спрайта нет (напр. сканер) — фолбэк на монохромную иконку.
    const imgH = Math.round(h * 0.52);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + 1, w - 2, imgH);
    const CAT2SPRITE = { drill: 'drill', engine: 'engine', cargo: 'hold', scanner: 'sensor' };
    const sp = PART_SPRITES[CAT2SPRITE[def.category]];
    ctx.save(); ctx.translate(x + w / 2, y + 1 + imgH / 2);
    if (sp && sp.img && sp.img.complete) {
      const boxW = (w - 8) * 0.92, boxH = imgH * 0.84;
      const k = Math.min(boxW / sp.img.width, boxH / sp.img.height);
      ctx.drawImage(sp.img, -sp.img.width * k / 2, -sp.img.height * k / 2, sp.img.width * k, sp.img.height * k);
    } else {
      drawModuleIcon(ctx, def.category, 0, 0, imgH * 0.42, accent);
    }
    ctx.restore();
    // тонкая линия-разделитель
    ctx.strokeStyle = PAL.bronze; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1, y + imgH + 1.5); ctx.lineTo(x + w - 1, y + imgH + 1.5); ctx.stroke();
    // полоска цвета категории сверху
    ctx.fillStyle = accent; ctx.fillRect(x, y, w, 3);

    // имя
    ctx.font = `bold 10px ${FONT_MONO}`; ctx.fillStyle = PAL.chalk; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(def.name.toUpperCase(), x + w / 2, y + imgH + 20);
    // стат
    let statStr = '';
    if (def.digMult)  statStr = `СИЛА ×${def.digMult.toFixed(1)}`;
    if (def.speed)    statStr = `${def.speed} Т/С`;
    if (def.scanR)    statStr = `РАДИУС ${def.scanR}`;
    if (def.capacity) statStr = `ГРУЗ ${def.capacity}`;
    ctx.font = `9px ${FONT_MONO}`; ctx.fillStyle = PAL.pewter;
    ctx.fillText(statStr, x + w / 2, y + imgH + 36);
    // бейдж «установлен» — галка в углу
    if (installed) {
      ctx.fillStyle = accent; ctx.font = `bold 8px ${FONT_MONO}`; ctx.textAlign = 'center';
      ctx.fillText('✓ УСТАНОВЛЕН', x + w / 2, y + h - 8);
    }
    ctx.textAlign = 'left';
  }

  _drawDragGhost(ctx) {
    const m = MODULE_DEFS[this.drag.type];
    const w = this.CARD_W(), h = this.CARD_H();
    ctx.save(); ctx.globalAlpha = 0.92;
    this._drawCard(ctx, this.mouse.x - w / 2, this.mouse.y - h / 2, w, h, m, false, false);
    ctx.restore();
  }

  _drawStart(ctx, L) {
    const s = this.getStats(), valid = s.valid, b = L.start;
    const hot = this.inRect(this.mouse.x, this.mouse.y, b);
    ctx.fillStyle = valid && hot ? PAL.gold : 'rgba(13,10,14,0.9)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = valid ? PAL.gold : PAL.ash; ctx.lineWidth = 1;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (valid) {
      ctx.fillStyle = hot ? PAL.void : PAL.gold; ctx.font = `14px ${FONT_MONO}`;
      ctx.fillText('В ШАХТУ ▶', b.x + b.w / 2, b.y + b.h / 2);
    } else {
      ctx.fillStyle = PAL.ash; ctx.font = `12px ${FONT_MONO}`;
      const cat2label = { drill: 'бур', engine: 'двигатель', scanner: 'сканер', cargo: 'трюм' };
      ctx.fillText('УСТАНОВИ: ' + s.missing.map((c) => cat2label[c]).join(', ').toUpperCase(), b.x + b.w / 2, b.y + b.h / 2);
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
}
