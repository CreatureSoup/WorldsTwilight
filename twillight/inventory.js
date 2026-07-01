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
  drill:   { kind: 'drill',  label: STR.inventory.category.drill.slot,   lx:  1,    ly: -0.9 },   // вправо-вверх
  scanner: { kind: 'sensor', label: STR.inventory.category.scanner.slot, lx:  0.5,  ly: -1.1 },   // вверх-ВПРАВО: не лезет на пустой круг доп-слота (тот вверху-слева)
  cargo:   { kind: 'hold',   label: STR.inventory.category.cargo.slot,   lx: -1,    ly:  0   },   // влево
  aux:     { kind: 'aux',    label: STR.inventory.category.aux.slot,     lx: -1.3, ly: -0.6 },   // доп-слот (экран помех) — влево-ВВЕРХ (не лезть на трюм); показ гейтнут _categoryActive
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
  // Сохранить/восстановить ПОСЛЕДНЮЮ сборку между забегами (`save.build`): по умолчанию ставится то, что было
  // в прошлом забеге. game зовёт `bindSave` после loadSave+metaBindSave, `saveBuild` — на старте забега.
  bindSave(save) { this._save = save; this.loadBuild(); }
  saveBuild() { if (!this._save) return; this._save.build = { hull: this.hull, modules: Object.assign({}, this.modules) }; if (typeof writeSave === 'function') writeSave(this._save); }
  loadBuild() {
    this.defaultBuild();                                   // фундамент: валидные дефолты (опц. слоты пусты)
    const b = this._save && this._save.build; if (!b) return;
    if (b.hull && HULL_DEFS[b.hull] && b.hull !== this.hull) { this.hull = b.hull; this.defaultBuild(); }
    if (!b.modules) return;
    for (const slot in b.modules) {                        // переставляем сохранённый модуль, ЕСЛИ он валиден для слота и открыт
      const m = b.modules[slot], def = MODULE_DEFS[m];
      if (def && def.category === slot && (!def.unlock || (typeof metaHas === 'function' && metaHas(def.unlock))) && this._categoryActive(slot)) this.modules[slot] = m;   // доп-слот восстанавливаем только если он открыт (ядро core)
    }
  }
  // Слот показывается на сборке? Обязательные — всегда; опциональные (доп-слот) — если установлен ИЛИ есть доступный модуль.
  _categoryActive(cat) {
    if (!(HULL_DEFS[this.hull].optional || []).includes(cat)) return true;   // обязательные слоты — всегда
    if (!(typeof metaHas === 'function' && metaHas('core'))) return false;   // ДОП-СЛОТ открывает СТАРТОВЫЙ узел ЯДРО (core): нет ядра → слот скрыт, доп-модули ставить некуда
    if (this.modules[cat]) return true;
    return Object.keys(MODULE_DEFS).some((k) => MODULE_DEFS[k].category === cat && (!MODULE_DEFS[k].unlock || (typeof metaHas === 'function' && metaHas(MODULE_DEFS[k].unlock))));
  }
  reset() { this.loadBuild(); this.resetCargo(); this.unit = null; this.drag = null; this.scrollY = 0; }   // сборка ПЕРЕНОСИТСЯ между забегами (прошлый забег = дефолт)
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
      if (m.impulse)  { s.impulse = true; s.altDrill = true; s.canDig = true; }   // импульсный бур: пассивно не грызёт, но «умеет копать» (рендер бура + волна)
      if (m.kinetic)  { s.kinetic = true; s.altDrill = true; s.canDig = true;   // кинетический бур: обычный grind с разгоном (unit.js)
        s.kinMax = (typeof metaHas === 'function' && metaHas('mast_dk_max')) ? KIN_MAX_MULT_NODE : KIN_MAX_MULT; }   // потолок разгона (узел mast_dk_max → ×3)
      if (m.screw)    { s.screw = true; s.altDrill = true; s.canDig = true;   // винтовой бур: юнит не грызёт сам — запускает автономные щиты (borers.js)
        s.borerMax = SCREW_BORERS_BASE + ((typeof metaHas === 'function' && metaHas('mast_ds_b1')) ? 1 : 0) + ((typeof metaHas === 'function' && metaHas('mast_ds_b2')) ? 1 : 0); }   // +1 за узел
      if (m.speed)    { s.moveSpeed = Math.max(s.moveSpeed, m.speed); s.canMove = true; }
      if (m.scanR)    s.scanR = Math.max(s.scanR, m.scanR);
      if (m.radar)    { s.radar = true; s.radarSpectrum = (typeof metaHas === 'function' && metaHas('mast_rad_spec')); }   // радар-сканер: развёртка (узел полного спектра снимает фильтр типа)
      if (m.echoScan) { s.echoScan = true; s.echoLong = (typeof metaHas === 'function' && metaHas('mast_ech_len')); }   // эхо-сканер: волна-метка (узел дальности ×2)
      if (m.capacity) s.capacity += m.capacity;
      if (m.heal) s.healRate += m.heal;                  // ремонтный МОДУЛЬ (доп-слот): источник реген-стата healRate (как флаги hack/siege — только здесь)
      if (m.noiseResist) s.noiseResist += m.noiseResist; // экран помех (доп-слот)
      if (m.printer) s.printer += m.printer;             // модуль печати (доп-слот)
      if (m.printReach) s.printReach = Math.max(s.printReach, m.printReach);   // базовый радиус печати
      if (m.hack) s.hack = true;                         // модуль взлома (доп-слот): взлом/пробуждение города (hack.js)
      if (m.siege) s.siege = true;                       // осадный модуль (доп-слот): пробойный луч по гнезду (siege.js)
      if (m.stealth) s.stealth = true;                   // стелс-модуль (доп-слот): невидимость (stealth.js)
      if (m.jam) s.jam = true;                           // взлом юнитов (доп-слот): импульс-глушение врагов (jam.js)
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
    const labels = { drill: STR.inventory.category.drill.gallery, engine: STR.inventory.category.engine.gallery, scanner: STR.inventory.category.scanner.gallery, cargo: STR.inventory.category.cargo.gallery, aux: STR.inventory.category.aux.gallery };
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
      // ПЕРЕНОС по рядам: когда вариантов больше, чем влезает по ширине (напр. 4 бура) — крайние НЕ уезжают
      // за панель (и остаются кликабельны). Лишняя высота уходит в вертикальный скролл (maxScroll).
      const perRow = Math.max(1, Math.floor((L.list.w - 28 + cgap) / (cw + cgap)));
      mods.forEach((type, i) => {
        const col = i % perRow, row = (i / perRow) | 0;
        cards.push({ type, category: cat, def: MODULE_DEFS[type], x: x0 + col * (cw + cgap), y: cy + row * (ch + rowGap), w: cw, h: ch });
      });
      cy += Math.max(1, Math.ceil(mods.length / perRow)) * (ch + rowGap);
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

  // Рендер экрана — свободные функции drawInventory/* в render_inventory.js (§6: логика ≠ рендер).
}
