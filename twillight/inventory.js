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
  drill:   { kind: 'drill',  label: 'БУР',     lx:  1,    ly: -0.9 },   // вправо-вверх
  scanner: { kind: 'sensor', label: 'СКАНЕР',  lx:  0.5,  ly: -1.1 },   // вверх-ВПРАВО: не лезет на пустой круг доп-слота (тот вверху-слева)
  cargo:   { kind: 'hold',   label: 'ТРЮМ',    lx: -1,    ly:  0   },   // влево
  aux:     { kind: 'aux',    label: 'ДОП-СЛОТ', lx: -1.3, ly: -0.6 },   // доп-слот (экран помех) — влево-ВВЕРХ (не лезть на трюм); показ гейтнут _categoryActive
  // engine НЕ показываем на сборке: двигатель — параметр КОРПУСА (стат остаётся, слот/галерея/выноска скрыты).
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
    this.onBack = null;   // «← назад» из сборки (game ставит: в меню до забега / в игру на лету)
    this.preGame = true;

    this.defaultBuild();
  }

  // По умолчанию юнит СОБРАН — каждый слот корпуса получает первый модуль своей
  // категории (как риг в тулзе). Менять можно при наличии других вариантов.
  defaultBuild() {
    this.modules = {};
    const optional = HULL_DEFS[this.hull].optional || [];
    for (const slot of HULL_DEFS[this.hull].slots) {
      if (optional.includes(slot)) continue;   // доп-слот по умолчанию ПУСТ (опциональный)
      for (const key in MODULE_DEFS) if (MODULE_DEFS[key].category === slot
        && (!MODULE_DEFS[key].unlock || (typeof metaHas === 'function' && metaHas(MODULE_DEFS[key].unlock)))) { this.modules[slot] = key; break; }   // дефолт — первый НЕзагейченный вариант
    }
  }
  // Слот показывается на сборке? Обязательные — всегда; опциональные (доп-слот) — если установлен ИЛИ есть доступный модуль.
  _categoryActive(cat) {
    if (!(HULL_DEFS[this.hull].optional || []).includes(cat)) return true;
    if (this.modules[cat]) return true;
    return Object.keys(MODULE_DEFS).some((k) => MODULE_DEFS[k].category === cat && (!MODULE_DEFS[k].unlock || (typeof metaHas === 'function' && metaHas(MODULE_DEFS[k].unlock))));
  }
  reset() { this.defaultBuild(); this.resetCargo(); this.unit = null; this.drag = null; this.scrollY = 0; }
  resetCargo() { for (const k in this.cargo) this.cargo[k] = 0; }

  // Производные статы по установленным модулям. HP — из корпуса.
  getStats() {
    const hull = HULL_DEFS[this.hull], optional = hull.optional || [];
    const s = { maxHp: hull.hp, moveSpeed: 0, digMult: 0, scanR: 0, capacity: 0, healRate: 0, noiseResist: 0, printer: 0, printReach: 0,
                canDig: false, canMove: false };
    for (const cat in this.modules) {
      const t = this.modules[cat]; if (!t) continue;
      const m = MODULE_DEFS[t]; if (!m) continue;
      if (m.digMult)  { s.digMult += m.digMult;  s.canDig = true; }
      if (m.speed)    { s.moveSpeed = Math.max(s.moveSpeed, m.speed); s.canMove = true; }
      if (m.scanR)    s.scanR = Math.max(s.scanR, m.scanR);
      if (m.capacity) s.capacity += m.capacity;
      if (m.healRate) s.healRate += m.healRate;          // ремонтный трюм
      if (m.noiseResist) s.noiseResist += m.noiseResist; // экран помех (доп-слот)
      if (m.printer) s.printer += m.printer;             // модуль печати (доп-слот)
      if (m.printReach) s.printReach = Math.max(s.printReach, m.printReach);   // базовый радиус печати
    }
    // Готов к старту, когда заняты все ОБЯЗАТЕЛЬНЫЕ слоты (опциональные — доп-слот — можно пустыми).
    const req = hull.slots.filter((cat) => !optional.includes(cat));
    s.valid = req.every((cat) => !!this.modules[cat]);
    s.missing = req.filter((cat) => !this.modules[cat]);
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
    // центр рига чуть НИЖЕ середины панели: модули/бур торчат вверх сильнее, чем ноги вниз
    const blueprint = { x: bx, y: by, w: bw, h: bh, cx: bx + bw / 2, cy: by + bh / 2 + Math.round(bh * 0.06) };
    const stats = { x: bx, y: by + bh + 8, w: bw, h: 84 };
    const back = { x: bx, y: 20, w: 40, h: 36 };   // «← назад» — лаконичная стрелка, как в мете/кодексе
    const lx = bx + bw + 18, ly = by;
    const lw = Math.max(280, W - lx - Math.round(W * 0.04));
    const lh = bh + 8 + 84;
    const list = { x: lx, y: ly, w: lw, h: lh };
    const start = { x: bx, y: H - 64, w: bw, h: 50 };
    this.layout = { blueprint, stats, list, start, back, W, H };
    return this.layout;
  }
  inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  // ---- чертёж: живой риг юнита + позиции гнёзд по деталям ----
  // Болванка-юнит для рендера/рига. `allOn`=true — все детали присутствуют (для
  // позиций гнёзд); иначе по факту установки (отсутствующий модуль = деталь скрыта).
  _dummyUnit(allOn) {
    return {
      hull: this.hull, dx: 1, dy: 0, faceX: 1, state: IDLE, crouchT: 0, noAnim: false, px: 0, py: 0,
      modules: this.modules,   // слот→модуль: превью показывает спрайт конкретного варианта
      stats: {
        canDig:   allOn || !!this.modules.drill,
        canMove:  allOn || !!this.modules.engine,
        scanR:    (allOn || this.modules.scanner) ? 1 : 0,
        capacity: (allOn || this.modules.cargo)   ? 1 : 0,
        noiseResist: (allOn || this.modules.aux)  ? 1 : 0,   // доп-слот: деталь видна при установленном модуле
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
    return Math.max(1, half * 1.22 / maxR);   // 1.22: крупно, но модули/бур не режутся кромкой панели (1.55 обрезал верх)
  }
  // t — общее время для idle-анимации (чтобы кольца гнёзд следовали за деталями).
  _rigTime() { return performance.now() / 1000; }
  // IK-щупальца для превью (как в игре, а не FK-ноги), на ФЕЙКОВОМ полу. Юнит в (0, TILE*0.5),
  // пол снизу (ty>=1). Конфиги в ДИЗАЙН-px (scale 1 — внешний `S` масштабирует панель целиком).
  _previewLegRig() {
    if (typeof makeLegRig !== 'function' || typeof updateLegRig !== 'function' || typeof legConfigsFromUnit !== 'function') return null;
    const sig = this.hull;   // ноги зависят ТОЛЬКО от корпуса (не от модулей) — не пересобираем нога-риг при смене модуля → нет дёрганья к полу
    if (!this._plRig || this._plSig !== sig) {
      this._plRig = makeLegRig(legConfigsFromUnit(this._dummyUnit(false), 1), 1);
      this._plSig = sig;
      // Пол на ~72% ВЫЛЕТА ноги: вытянуты, не у предела (плант-порог 0.99, отрыв ≥0.84). НЕ ближе:
      // при сложенных ногах (пол ~0.6) средние СУСТАВЫ висят у линии породы — волна позы загоняет
      // колено в камень, _ikAvoidRock каждый кадр выталкивает его на ≥16px → мелкая дрожь одной ноги.
      let reach = 0; for (const L of this._plRig.legs) reach = Math.max(reach, L.reach || 0);
      this._plWy = TILE - reach * 0.72;
      // Стопы ЧУТЬ ВЫШЕ поверхности (sink < 0). В превью нет окклюзии (в игре утопленный сустав скрыт):
      // голеностоп самой КОРОТКОЙ ноги случайно утыкался в породу (запас непредсказуем — куда воткнётся
      // стопа, туда и сустав), `_ikAvoidRock` выталкивал его каждый кадр → дрожь ОДНОЙ ноги. Подъём уводит
      // ВСЕ внутренние суставы над линией породы с запасом на «дыхание» корпуса (худший запас ~7px на 10 осадок).
      this._plRig._footSink = -12;
      // СТАБИЛЬНЫЙ вылет ног вниз (низшая точка относительно центра корпуса) — для привязки НИЗА
      // композиции к кромке панели. Считаем ОДИН раз детерминированной осадкой: мгновенный max по
      // кадрам «гуляет» (дыхание/шаги), и если кормить им b.cy каждый кадр — юнит подпрыгивает.
      const fw = { tileAt: (tx, ty) => ({ type: ty >= 1 ? ROCK : AIR }) };
      let drop = 0;
      for (let i = 0; i < 360; i++) {
        this._plRig.supportAngle = 0; updateLegRig(this._plRig, 1 / 120, 0, this._plWy, fw, { x: 0, y: 0 });
        if (i >= 300) for (const Lg of this._plRig.legs) for (const p of (Lg.draw || Lg.pts)) drop = Math.max(drop, p.y - this._plWy);
      }
      this._plLegDrop = drop;
    }
    const world = { tileAt: (tx, ty) => ({ type: ty >= 1 ? ROCK : AIR }) };   // фейковый пол снизу (48px)
    this._plRig.supportAngle = 0;
    // ФИКС. dt (не из реального времени рендера): экспон-сглаживание ног (`smk=dt*30`) при «гуляющем»
    // dt давало мелкое дрожание стоп — а на крупном масштабе панели (×S) оно ВИДНО. idle-«дыхание»
    // внутри legik берёт реальное `performance.now()`, так что движение остаётся живым.
    // dt=1/120 (а не 1/60): меньше `smk` → мягче лерп draw-точек, остаточное дрожание длинных
    // (правых) ног при bursty-рендере панели гасится; фаза/спринг идут спокойнее, дыхание — как было.
    updateLegRig(this._plRig, 1 / 120, 0, this._plWy, world, { x: 0, y: 0 });
    return this._plRig;
  }
  // Экранные позиции гнёзд по деталям юнита. КОЛЬЦО раскладывает модули по ang/rad
  // (как drawRingUnit) — у кольца resolveUnitRig().parts даёт NaN, отсюда отдельная ветка;
  // иначе slotAt всегда возвращал null → дроп карточки на юнит не срабатывал.
  computeSlots() {
    const L = this.layout; if (!L) return [];
    const b = L.blueprint, S = this.blueprintScale(L), def = UNIT_DEFS[this.hull];
    const out = [];
    const push = (cat, x, y) => out.push({ category: cat, label: SLOT_META[cat].label, lx: SLOT_META[cat].lx, ly: SLOT_META[cat].ly, x, y });
    if (def && def.kind === 'ring') {
      const R = (TILE - 8) / 2, bo = (this._plRig && this._plRig.bodyOff) || { x: 0, y: 0 };   // тот же сдвиг корпуса на щупальцах, что в превью
      for (const cat in SLOT_META) {
        if (!this._categoryActive(cat)) continue;   // доп-слот скрыт, пока нет модуля
        const p = def.parts.find((pp) => pp.kind === SLOT_META[cat].kind); if (!p) continue;
        const a = (p.ang || 0) * Math.PI / 180;   // aim=0, flip=1 в превью
        push(cat, b.cx + (bo.x + Math.cos(a) * (p.rad || 0) * R) * S, b.cy + (bo.y + Math.sin(a) * (p.rad || 0) * R) * S);
      }
      return out;
    }
    const rig = resolveUnitRig(0, 0, this._dummyUnit(true), this._rigTime());
    for (const cat in SLOT_META) {
      if (!this._categoryActive(cat)) continue;   // доп-слот скрыт, пока нет модуля
      const part = rig.parts.find((p) => p.kind === SLOT_META[cat].kind); if (!part) continue;
      push(cat, b.cx + part.x * S, b.cy + part.y * S);
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
    const labels = { drill: 'БУРЫ', engine: 'ДВИГАТЕЛИ', scanner: 'СКАНЕРЫ', cargo: 'ТРЮМЫ', aux: 'ДОП-СЛОТ' };
    const cw = this.CARD_W(), ch = this.CARD_H(), cgap = 10, hdrH = 22, rowGap = 18;
    const x0 = L.list.x + 14, y0 = L.list.y + 38 - this.scrollY;
    const cards = [], headers = [];
    let cy = y0;
    for (const cat of HULL_DEFS[this.hull].slots) {
      if (cat === 'engine') continue;          // двигатель — параметр корпуса, в галерее не показываем
      if (!this._categoryActive(cat)) continue; // доп-слот скрыт, пока нет доступного модуля
      headers.push({ label: labels[cat] || cat.toUpperCase(), x: x0, y: cy, w: L.list.w - 28 });
      cy += hdrH;
      // варианты слота; гейтнутые (`unlock`) показываются только при открытом узле СЕТИ ПАМЯТИ
      const mods = Object.keys(MODULE_DEFS).filter((k) => MODULE_DEFS[k].category === cat
        && (!MODULE_DEFS[k].unlock || (typeof metaHas === 'function' && metaHas(MODULE_DEFS[k].unlock))));
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
    if (this.inRect(x, y, L.back)) { if (this.onBack) this.onBack(); return; }
    if (this.inRect(x, y, L.start)) { if (this.getStats().valid && this.onStart) this.onStart(); return; }
    const card = this.cardAt(x, y);
    // ВЫБОР карточки в галерее = установка модуля в слот (перетаскивание отключено).
    if (card) {
      const optional = (HULL_DEFS[this.hull].optional || []).includes(card.category);
      if (optional && this.modules[card.category] === card.type) delete this.modules[card.category];   // повторный клик по опц. слоту (доп-слот) — снять
      else this.modules[card.category] = card.type;
    }
    // if (card) this.drag = { type: card.type, category: card.category };   // перетаскивание (отключено)
  }
  pointerMove(x, y) {
    this.mouse = { x, y };
    this.hoverCard = this.cardAt(x, y);   // подсветка карточки под курсором
    // this.hoverSlot = this.drag ? this.slotAt(x, y) : null;   // перетаскивание (отключено)
  }
  pointerUp() {
    // перетаскивание отключено — установка идёт по клику (см. pointerDown)
    // if (!this.drag) return;
    // const slot = this.slotAt(x, y);
    // if (slot && slot.category === this.drag.category) this.modules[slot.category] = this.drag.type;
    // this.drag = null;
  }

  // =============================================================
  // Рендер
  // =============================================================
  draw(ctx, W, H) {
    const L = this.computeLayout(W, H);
    this.hoverCard = this.cardAt(this.mouse.x, this.mouse.y);   // подсветка карточки (перетаскивание отключено)

    drawStaticBg(ctx, W, H);
    hazardTape(ctx, 0, 0, W, 5, PAL.amberDim);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    pulseDot(ctx, W / 2 - 110, 23, 3, PAL.gold);
    ctx.fillStyle = PAL.gold; ctx.font = `9px ${FONT_MONO}`;
    ctx.fillText('// СБОРКА ЮНИТА · АКТИВНА', W / 2, 26);
    ctx.fillStyle = PAL.chalk; ctx.font = `700 28px ${FONT_DISPLAY}`;
    ctx.fillText('ЧЕРТЁЖ', W / 2, 54);
    ctx.fillStyle = PAL.pewter; ctx.font = `11px ${FONT_MONO}`;
    ctx.fillText('ВЫБЕРИ МОДУЛЬ В ГАЛЕРЕЕ — ОН ВСТАНЕТ В СЛОТ · ENTER · В ШАХТУ', W / 2, 74);

    this._drawBack(ctx, L.back);
    this._drawBlueprint(ctx, L);
    this._drawStats(ctx, L);
    this._drawList(ctx, L);
    this._drawStart(ctx, L);

    // if (this.drag) this._drawDragGhost(ctx);   // карточка-призрак при перетаскивании (отключено)
  }

  // «← назад» — лаконичная стрелка в рамке со скошенным углом (как `.mt-back`/`.cx-back` в DOM-разделах)
  _drawBack(ctx, r) {
    const hov = !this.drag && this.inRect(this.mouse.x, this.mouse.y, r);
    const cut = 9;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(r.x + 0.5, r.y + 0.5);
    ctx.lineTo(r.x + r.w - 0.5, r.y + 0.5);
    ctx.lineTo(r.x + r.w - 0.5, r.y + r.h - 0.5);
    ctx.lineTo(r.x + cut + 0.5, r.y + r.h - 0.5);
    ctx.lineTo(r.x + 0.5, r.y + r.h - cut - 0.5);
    ctx.closePath();
    if (hov) { ctx.fillStyle = 'rgba(212,160,66,0.10)'; ctx.fill(); }
    ctx.strokeStyle = hov ? PAL.gold : PAL.ash; ctx.lineWidth = 1; ctx.stroke();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    ctx.strokeStyle = hov ? PAL.goldBright : PAL.bone; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx - 1, cy - 5); ctx.lineTo(cx - 6, cy); ctx.lineTo(cx - 1, cy + 5);
    ctx.stroke();
    ctx.restore();
  }

  _drawBlueprint(ctx, L) {
    const b = L.blueprint;
    techPanel(ctx, b.x, b.y, b.w, b.h, { accent: PAL.cobalt, label: '// ЮНИТ · СКИТАЛЕЦ', serial: 'RIG' });

    ctx.save();
    ctx.beginPath(); ctx.rect(b.x + 6, b.y + 22, b.w - 12, b.h - 28); ctx.clip();

    // лёгкая сетка-«пол» (атмосфера, не подложка-схема)
    ctx.strokeStyle = 'rgba(58,126,200,0.06)'; ctx.lineWidth = 1;
    for (let gy = b.y + 24; gy < b.y + b.h - 6; gy += 32) { ctx.beginPath(); ctx.moveTo(b.x + 6, gy + 0.5); ctx.lineTo(b.x + b.w - 6, gy + 0.5); ctx.stroke(); }

    // ЖИВОЙ риг юнита со спрайтами (по фактической сборке: нет модуля → деталь скрыта)
    const S = this.blueprintScale(L);
    const fakeCam = { x: 0, y: 0, screenX: (px) => px };
    const dum = this._dummyUnit(false), ringDef = UNIT_DEFS[this.hull] && UNIT_DEFS[this.hull].kind === 'ring';
    const lr = ringDef ? this._previewLegRig() : null;
    // НИЗ композиции привязан к нижней кромке: кончики ног уходят чуть ЗА кадр (вся сцена едет
    // вместе — уровень пола относительно юнита НЕ меняется). Фикс. доля от высоты не годилась:
    // в высоком окне масштаб лимитируется ШИРИНОЙ панели → юнит мельче высоты → снизу пустота.
    // `_plLegDrop` — СТАБИЛЬНЫЙ (кэш), а не мгновенный max по кадрам (тот «гуляет» → юнит подпрыгивал).
    if (lr) b.cy = (b.y + b.h - 6) + TILE * 0.5 - this._plLegDrop * S;   // +TILE*0.5 — насколько кончики за кромкой

    const slots = this.computeSlots();

    ctx.save(); ctx.translate(b.cx, b.cy); ctx.scale(S, S);
    if (ringDef) {   // КОЛЬЦО: ноги-ЩУПАЛЬЦА (IK, как в игре) ПОД + кольцо-реактор/модули
      if (typeof partsHull === 'function') partsHull(dum.hull);
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

    // гнёзда — тонкие кольца статуса слота (занят cobalt / пуст amber). Перетаскивание отключено —
    // ветки драга/радар-пинга закомментированы (`_drawSlotPing`/`_drawDragGhost` — для будущего ре-энейбла).
    for (const s of slots) {
      const filled = !!this.modules[s.category];
      // const matchable = this.drag && this.drag.category === s.category;
      // if (matchable) { this._drawSlotPing(ctx, s, this.hoverSlot && this.hoverSlot.category === s.category, performance.now() / 1000); continue; }
      const r = 24;
      let col, lw, dash, alpha;
      // if (this.drag)    { col = PAL.bronze; lw = 1;   dash = [3, 5]; alpha = 0.3; }   // чужая категория при драге
      if (filled)          { col = PAL.cobalt; lw = 1;   dash = [];     alpha = 0.5; }
      else                 { col = PAL.amber;  lw = 1.5; dash = [4, 4]; alpha = 1; }
      ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(dash);
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // выноски ПОВЕРХ юнита: название установленного модуля (чип клампится внутрь панели)
    for (const s of slots) this._drawCallout(ctx, s, b);

    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // Радар-пинг цели для дропа: прицел-кольцо + центральная точка + 2 расходящихся кольца
  // БЕЗ заливки с фейд-аутом (в противофазе). hovering — курсор над целью: ярче/быстрее/крупнее.
  _drawSlotPing(ctx, s, hovering, t) {
    const col = hovering ? PAL.goldBright : PAL.gold;
    const period = hovering ? 0.8 : 1.15, rMin = 11, rMax = hovering ? 50 : 42;
    ctx.save();
    ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) {                                  // расходящиеся кольца с фейд-аутом
      const ph = ((t / period) + k * 0.5) % 1;
      ctx.globalAlpha = (1 - ph) * (hovering ? 0.9 : 0.6);
      ctx.strokeStyle = col; ctx.lineWidth = 2.4 * (1 - ph) + 0.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, rMin + (rMax - rMin) * ph, 0, 6.283); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = hovering ? 2.6 : 1.8;   // прицел-кольцо
    ctx.beginPath(); ctx.arc(s.x, s.y, rMin, 0, 6.283); ctx.stroke();
    ctx.lineWidth = 1.6;                                           // прицельные риски по 4 сторонам
    for (const d of [0, 90, 180, 270]) {
      const a = d * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(s.x + c * (rMin + 4), s.y + sn * (rMin + 4)); ctx.lineTo(s.x + c * (rMin + 9), s.y + sn * (rMin + 9)); ctx.stroke();
    }
    const pulse = 0.55 + 0.45 * Math.sin(t * 12.566 / period);     // центральная точка пульсирует
    ctx.globalAlpha = 0.6 + 0.4 * pulse; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(s.x, s.y, 3.6, 0, 6.283); ctx.fill();
    ctx.restore();
  }

  // Выноска ПОВЕРХ юнита: тёмный чип с НАЗВАНИЕМ установленного модуля + линия от гнезда к чипу.
  // `b` — рект панели: чип клампится внутрь, чтобы длинные имена не обрезались кромкой.
  _drawCallout(ctx, s, b) {
    const r = 22, gap = 30, dx = s.lx, dy = s.ly, n = Math.hypot(dx, dy) || 1;
    const type = this.modules[s.category], def = type && MODULE_DEFS[type];
    const name = def ? def.name.toUpperCase() : 'МОДУЛЬ НЕ УСТАНОВЛЕН', accent = def ? def.color : PAL.bronze;
    ctx.font = `bold 9px ${FONT_MONO}`;
    const pad = 6, chipW = ctx.measureText(name).width + pad * 2, chipH = 17;
    // желаемое место чипа в сторону (dx,dy), затем КЛАМП внутрь панели
    let cx = s.x + (dx / n) * (r + gap) + (dx >= 0 ? 0 : -chipW);
    let cy = s.y + (dy / n) * (r + gap) - chipH / 2;
    cx = Math.max(b.x + 7, Math.min(cx, b.x + b.w - 7 - chipW));
    cy = Math.max(b.y + 24, Math.min(cy, b.y + b.h - 7 - chipH));
    // СГИБ: диагональ от кромки гнезда → колено → горизонталь к ближней стороне чипа
    const chipLeft = (cx + chipW / 2) < s.x, nearX = chipLeft ? cx + chipW : cx, kneeY = cy + chipH / 2;
    const kneeX = nearX + (chipLeft ? 14 : -14);
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.85; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x + (dx / n) * r, s.y + (dy / n) * r);
    ctx.lineTo(kneeX, kneeY); ctx.lineTo(nearX, kneeY);
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(7,5,10,0.82)'; ctx.fillRect(cx, cy, chipW, chipH);   // тёмная плашка — читаемо поверх юнита
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.55; ctx.strokeRect(cx + 0.5, cy + 0.5, chipW - 1, chipH - 1); ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = def ? PAL.chalk : PAL.ash; ctx.fillText(name, cx + pad, cy + chipH / 2 + 0.5);
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
      this._drawCard(ctx, c.x, c.y, c.w, c.h, c.def, installed, hover, c.type);
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
  _drawCard(ctx, x, y, w, h, def, installed, hover, type) {
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
    // спрайт КОНКРЕТНОГО варианта модуля (`mod:<id>`) → откат на спрайт детали категории → проц-иконка
    const CAT2SPRITE = { drill: 'drill', engine: 'engine', cargo: 'hold', scanner: 'sensor' };
    const sp = (typeof spriteFor === 'function') ? (spriteFor('mod:' + type) || spriteFor(CAT2SPRITE[def.category])) : PART_SPRITES[CAT2SPRITE[def.category]];
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
    this._drawCard(ctx, this.mouse.x - w / 2, this.mouse.y - h / 2, w, h, m, false, false, this.drag.type);
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
