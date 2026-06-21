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
// cap — потолок уровней БАЗОВОГО набора (выше — анлоки меты, слоты рисуются «ЗАКРЫТО»).
// metaNeed — id узла СЕТИ ПАМЯТИ, без которого трек вообще не появляется в забеге
// ('core' = стартовый велком-узел открывает раздел ГОРОДА; 'u_drill'/'u_engine' — будущие
// узлы синей ветки ЮНИТ, id назначим при её проработке — до тех пор треки скрыты).
const UPG_TRACKS = [
  { id: 'drill',   cat: 'unit', label: 'СИЛА БУРА',  sub: 'Скорость прохода породы', accent: '#f08a2a', icon: 'drill', cap: 3, metaCap: { node: 'mast_drill', cap: UPG_MAX },
    need: (s) => s.canDig && !s.altDrill, step: 0.2, base: (s) => s.digMult, fmt: (v) => '×' + v.toFixed(1) },
  // СИЛА УДАРА — для ИМПУЛЬСНОГО бура (вместо СИЛЫ БУРА): бюджет пробоя волны (Σ твёрдости) + пропорц. урон врагам.
  { id: 'impforce', cat: 'unit', label: 'СИЛА УДАРА', sub: 'Пик силы импульс-волны (пробой+урон)', accent: '#ff8f3a', icon: 'drill', cap: 3,
    need: (s) => !!s.impulse, step: 2, base: () => IMPULSE_FORCE, fmt: (v) => 'пик ' + v.toFixed(1) },
  // КИНЕТИКА — для КИНЕТИЧЕСКОГО бура (вместо СИЛЫ БУРА): +общая сила (сдвигает всю кривую разгона вверх).
  { id: 'kinpower', cat: 'unit', label: 'КИНЕТИКА', sub: 'Общая сила разгон-бура', accent: '#c8924a', icon: 'drill', cap: 2, metaCap: { node: 'mast_dk_max', cap: 3 },
    need: (s) => !!s.kinetic, step: KIN_POWER_STEP, base: () => KIN_BASE_MULT, fmt: (v) => '×' + v.toFixed(2) + ' старт' },
  // СКОРОСТЬ ПРОХОДКИ — для ВИНТОВОГО бура: быстрее автономные щиты прокапывают породу (3 ур.).
  { id: 'screwspeed', cat: 'unit', label: 'СКОРОСТЬ ПРОХОДКИ', sub: 'Темп автономных буров-щитов', accent: '#9ad0a0', icon: 'drill', cap: 3,
    need: (s) => !!s.screw, step: SCREW_SPEED_STEP, base: () => SCREW_DIG_BASE, fmt: (v) => v.toFixed(2) + ' /с' },
  // ОХЛАЖДЕНИЕ РАДАРА — для РАДАР-сканера: короче кулдаун между развёртками. step ОТРИЦАТЕЛЬНЫЙ (кулдаун падает).
  { id: 'radarcd', cat: 'unit', label: 'ОХЛАЖДЕНИЕ РАДАРА', sub: 'Кулдаун между развёртками', accent: '#7fb0e0', icon: 'scanner', cap: 3,
    need: (s) => !!s.radar, step: -RADAR_CD_STEP, base: () => RADAR_CD_BASE, fmt: (v) => Math.max(RADAR_CD_MIN, v).toFixed(1) + ' с' },
  // ВСПЫШКА ЭХО — для ЭХО-сканера: короче кулдаун волны. step ОТРИЦАТЕЛЬНЫЙ.
  { id: 'echocd', cat: 'unit', label: 'ВСПЫШКА ЭХО', sub: 'Кулдаун эхо-волны', accent: '#b58cf0', icon: 'scanner', cap: 3,
    need: (s) => !!s.echoScan, step: -ECHO_CD_STEP, base: () => ECHO_CD_BASE, fmt: (v) => Math.max(ECHO_CD_MIN, v).toFixed(1) + ' с' },
  { id: 'engine',  cat: 'unit', label: 'ПРИВОД',     sub: 'Скорость хода',          accent: '#3a7ec8', icon: 'engine', metaNeed: 'u_engine',
    need: (s) => s.canMove, step: 0.4, base: (s) => s.moveSpeed, fmt: (v) => v.toFixed(1) + ' т/с' },
  { id: 'scanner', cat: 'unit', label: 'СЕНСОР',     sub: 'Радиус обзора (тайлы)',  accent: '#d4a042', icon: 'scanner', cap: 2, costMul: 1.6,
    need: (s) => s.scanR > 0 && !s.radar && !s.echoScan, step: 1, base: (s) => s.scanR, fmt: (v) => Math.round(v) + ' тайл' },   // только СТАНДАРТНЫЙ сканер (радар/эхо — фикс. радиус 1, у них трек кулдауна)
  { id: 'cargo',   cat: 'unit', label: 'ЁМКОСТЬ',    sub: 'Слотов под ресурс',      accent: '#c8e25a', icon: 'cargo', cap: 2, metaCap: { node: 'mast_cargo', cap: 4 },
    need: (s) => s.capacity > 0 && !(s.healRate > 0), step: 2, base: (s) => s.capacity, fmt: (v) => v + '' },
  // РЕМОНТНЫЙ ТРЮМ — трек варианта-трюма (когда он установлен, `s.healRate>0`): каждый уровень
  // +1 HP/10с И +1 ёмкость. База от модуля (1 HP / 3 ёмк), 4 уровня → 5 HP / 7 ёмк. apply — два стата.
  { id: 'repair',  cat: 'unit', label: 'РЕМОНТНЫЙ ТРЮМ', sub: 'Реген HP И +1 ёмкость за ур.', accent: '#ff3a22', icon: 'cargo', cap: 4,
    need: (s) => s.healRate > 0, step: 1, base: (s) => s.healRate, fmt: (v) => v.toFixed(0) + ' HP/10с · +ёмкость',
    apply: (s, lvl) => { s.healRate = (s.healRate || 0) + lvl; s.capacity = (s.capacity || 0) + lvl; } },
  { id: 'hull',    cat: 'unit', label: 'ПРОЧНОСТЬ',  sub: 'Максимум HP корпуса',    accent: '#ff3a22', icon: null, cap: 2, metaCap: { node: 'mast_hull', cap: 4 },
    need: () => true, step: 20, base: (s) => s.maxHp, fmt: (v) => v + ' HP' },
  // ПРОЖЕКТОР — дальность луча; открывается узлом «Сенсорный цех» (`mast_sens`). Эффект — render_light.
  { id: 'proj',    cat: 'unit', label: 'ПРОЖЕКТОР',  sub: 'Ширина и яркость луча',   accent: '#f2c878', icon: null, metaNeed: 'mast_sens', cap: 3,
    need: () => true, step: 1, base: () => 0, fmt: (v) => ['узкий', 'шире', 'широкий', 'макс. охват'][Math.round(v)] || ('ур ' + v) },
  // ЭКРАН ПОМЕХ — докручивает гашение помех; трек ДОСТУПЕН, когда установлен МОДУЛЬ «Экран помех»
  // (доп-слот, `s.noiseResist>0`) — как ремонтный трюм. База — от модуля, эффект — game.drawScene.
  { id: 'noise',   cat: 'unit', label: 'ЭКРАН ПОМЕХ', sub: 'Гасит помехи интерфейса', accent: '#3a7ec8', icon: null, cap: 3,
    need: (s) => (s.noiseResist || 0) > 0, step: 0.15, base: (s) => s.noiseResist || 0, fmt: (v) => Math.round(v * 100) + '%' },
  // РАДИУС ПЕЧАТИ — на каком расстоянии можно ставить структуры; трек доступен при установленном МОДУЛЕ ПЕЧАТИ.
  { id: 'printreach', cat: 'unit', label: 'РАДИУС ПЕЧАТИ', sub: 'Дальность установки (тайлы)', accent: '#ff8f3a', icon: null, cap: 2,
    need: (s) => (s.printer || 0) > 0, step: 1, base: (s) => s.printReach || 0, fmt: (v) => Math.round(v) + ' тайл' },
  // ── ГОРОД (жёлтая ветка `amb`): батареи/контуры — ранние узлы; чарджер/нанорой/док — глубже.
  { id: 'battery', cat: 'city', label: 'ЁМКОСТЬ БАТАРЕЙ', sub: 'Время до гибернации', accent: '#f08a2a', icon: null, metaNeed: 'amb_batt',
    need: () => true, step: 15, base: () => CITY_TIMER_MAX, fmt: (v) => Math.round(v) + ' с' },
  // СУПЕР-ЧАРДЖЕР — `amb_charge`: быстрее дозарядка таймера на базе (эффект — city.recharge).
  { id: 'charge', cat: 'city', label: 'СУПЕР-ЧАРДЖЕР', sub: 'Скорость зарядки на базе', accent: '#f08a2a', icon: null, metaNeed: 'amb_charge',
    need: () => true, cap: 3, step: 8, base: () => CITY_TIMER_RECHARGE, fmt: (v) => Math.round(v) + ' с/с' },
  // КОНТУРЫ 3-в-1 — `amb_cont`: ОДИН трек усиливает кольца ПО ОЧЕРЕДИ внеш→внутр→ядро (+CITY_CONTOUR_HP
  // тому кольцу, чья очередь на этом уровне). Распределение по кольцам — `cityRingBonuses`.
  { id: 'contours', cat: 'city', label: 'КОНТУРЫ', sub: 'Запас контуров по очереди', accent: '#ff3a22', icon: null, metaNeed: 'amb_cont',
    need: () => true, cap: 3, step: 1, base: () => 0, fmt: (v) => v < 1 ? '—' : (['ВНЕШ.', 'ВНУТР.', 'ЯДРО'][(Math.round(v) - 1) % 3] + ' +' + CITY_CONTOUR_HP) },
  // АВТО-ПОЧИНКА — `amb_regen`: уровень = ОХВАТ колец (ядро→+внутр→+внешний), эффект — city.repairLvl.
  { id: 'cityrepair', cat: 'city', label: 'АВТО-ПОЧИНКА', sub: 'Контуры чинятся сами', accent: '#c8e25a', icon: null, metaNeed: 'amb_regen',
    need: () => true, cap: 3, step: 1, base: () => 0, fmt: (v) => ['—', 'ядро', 'ядро + внутр.', 'все контуры'][Math.round(v)] || ('ур ' + v) },
  // РЕМОНТНЫЙ ДОК — `amb_dock`: на базе юнит лечит HP (эффект — game playing-цикл, `cityDockRate`).
  { id: 'dock', cat: 'city', label: 'РЕМОНТНЫЙ ДОК', sub: 'Починка юнита на базе', accent: '#c8e25a', icon: null, metaNeed: 'amb_dock',
    need: () => true, cap: 4, step: CITY_DOCK_HP, base: () => 0, fmt: (v) => Math.round(v) + ' HP/с' },
];
// потолок уровней трека: БЕЗ узла «Верстак ИИ» (`mast_hub`) каждый трек капается 1 уровнем; с ним — штатные
// потолки (базовый `cap`/UPG_MAX — бур 3, сканер/груз/прочность 2 …), узлы `metaCap` поднимают дальше.
const trCap = (tr) => {
  if (typeof metaHas === 'function' && !metaHas('mast_hub')) return 1;
  let c = tr.cap || UPG_MAX;
  if (tr.metaCap && typeof metaHas === 'function' && metaHas(tr.metaCap.node)) c = tr.metaCap.cap;
  return c;
};
// Соответствие трека → поле stats юнита (для applyToStats).
const UPG_STAT_MAP = { drill: 'digMult', impforce: 'impForce', kinpower: 'kinPower', screwspeed: 'screwSpeed', radarcd: 'radarCdD', echocd: 'echoCdD', engine: 'moveSpeed', scanner: 'scanR', cargo: 'capacity', hull: 'maxHp', proj: 'projLvl', noise: 'noiseResist', printreach: 'printReach' };

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
    // набор треков: по модулям сборки (need) И по анлокам СЕТИ ПАМЯТИ (metaNeed);
    // мета применяется на СТАРТЕ сессии — купленный среди забега узел заработает со следующего
    this.tracks = UPG_TRACKS.filter((tr) => tr.need(this.base) && (!tr.metaNeed || (typeof metaHas === 'function' && metaHas(tr.metaNeed))));
    for (const tr of this.tracks) this.levels[tr.id] = 0;
    this.scrollY = 0; this.sel = 0; this.warnT = -1e9;
  }

  addBank(type, n) { this.bank[type] = (this.bank[type] || 0) + (n || 1); }
  tierCost(level, tr) {
    const base = UPG_TIER_COSTS[Math.min(level, UPG_TIER_COSTS.length - 1)];
    if (!tr || !tr.costMul) return base;
    const out = {}; for (const k in base) out[k] = Math.ceil(base[k] * tr.costMul); return out;   // дороже для трека (costMul)
  }
  canAfford(cost) { return Object.entries(cost).every(([k, v]) => (this.bank[k] || 0) >= v); }
  spend(cost) { for (const k in cost) this.bank[k] = Math.max(0, (this.bank[k] || 0) - cost[k]); }
  trackVal(tr, lvl) { return tr.base(this.base) + lvl * tr.step; }

  buyTrack(id) {
    const tr = this.tracks.find((t) => t.id === id); if (!tr) return;
    const lvl = this.levels[id] || 0; if (lvl >= trCap(tr)) return;
    const cost = this.tierCost(lvl, tr); if (!this.canAfford(cost)) return;
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
      const lvl = this.levels[tr.id] || 0; if (!lvl) continue;
      if (tr.apply) { tr.apply(s, lvl); continue; }        // трек с несколькими статами (напр. ремонтный трюм)
      const f = UPG_STAT_MAP[tr.id];
      if (f) s[f] = (s[f] || 0) + lvl * tr.step;            // (s[f]||0): новые статы не в базе
    }
    return s;
  }
  cityTimerBonus() { return (this.levels.battery || 0) * 15; }
  // Прибавки HP по кольцам из трека КОНТУРЫ (3-в-1): уровни идут ПО ОЧЕРЕДИ внеш(idx2)→внутр(1)→ядро(0),
  // +CITY_CONTOUR_HP за «свой» уровень. Для уровня L: внешний получает ур. 1,4,7…; внутр. 2,5,8…; ядро 3,6,9…
  cityRingBonuses() {
    const arr = new Array(CITY_RINGS).fill(0), L = this.levels.contours || 0;
    arr[CITY_RINGS - 1] = Math.floor((L + 2) / 3) * CITY_CONTOUR_HP;   // внешний
    arr[1] = Math.floor((L + 1) / 3) * CITY_CONTOUR_HP;                // внутренний
    arr[0] = Math.floor(L / 3) * CITY_CONTOUR_HP;                      // ядро
    return arr;
  }
  // СУПЕР-ЧАРДЖЕР: скорость дозарядки (с/с). АВТО-ПОЧИНКА: охват колец. РЕМОНТНЫЙ ДОК: HP/с лечения на базе.
  cityRecharge() { const tr = UPG_TRACKS.find((t) => t.id === 'charge'); return this.trackVal(tr, this.levels.charge || 0); }
  cityRepairLevel() { return this.levels.cityrepair || 0; }
  cityDockRate() { return (this.levels.dock || 0) * CITY_DOCK_HP; }
  pickupBonus() { return this.gadgets.magnet ? 1 : 0; }

  // ---- навигация WASD: выбор «крайнего» (следующего к покупке) слота трека ----
  moveSel(d) { if (!this.tracks.length) return; this.sel = Math.max(0, Math.min(this.tracks.length - 1, (this.sel || 0) + d)); this._followSel = true; this.endHold(); }
  selTrack() { return this.tracks[this.sel || 0]; }
  selNextCost() { const tr = this.selTrack(); if (!tr) return null; const lvl = this.levels[tr.id] || 0; return lvl >= trCap(tr) ? null : this.tierCost(lvl, tr); }
  selAffordable() { const c = this.selNextCost(); return c ? this.canAfford(c) : false; }
  // покупаемость трека: есть следующий уровень и хватает банка
  trackBuyable(id) { const tr = this.tracks.find((t) => t.id === id); if (!tr) return false; const lvl = this.levels[id] || 0; return lvl < trCap(tr) && this.canAfford(this.tierCost(lvl, tr)); }

  // ---- удержание для покупки: ПРОБЕЛ или зажатая ЛКМ заполняют карточку за UPG_HOLD_TIME ----
  beginHold(id, src) {
    if (!id) return;
    const tr = this.tracks.find((t) => t.id === id); if (!tr) return;
    if ((this.levels[id] || 0) >= trCap(tr)) return;             // уже максимум (потолок трека)
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
  onWheel(dy) { this._followSel = false; this.scrollY = Math.max(0, Math.min(this.maxScroll, this.scrollY + dy)); }   // ручной скролл отключает авто-доводку к выбранному ряду (иначе она возвращала экран назад)
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

  // Рендер экрана — свободные функции drawUpgrades/* в render_upgrades.js (§6: логика ≠ рендер).
}
