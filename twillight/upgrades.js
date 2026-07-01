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
// (напр. трек ПРИВОД ← `print_speed`, ПРОЖЕКТОР ← `mast_sens`, городские ← `amb_*`).
const UPG_TRACKS = [
  { id: 'drill',   cat: 'unit', label: STR.upgrades.tracks.drill.label,  sub: STR.upgrades.tracks.drill.sub, accent: PAL.amber, icon: 'drill', cap: 3, metaCap: { node: 'mast_drill', cap: UPG_MAX },
    need: (s) => s.canDig && !s.altDrill, step: 0.2, base: (s) => s.digMult, fmt: (v) => '×' + v.toFixed(1) },
  // СИЛА УДАРА — для ИМПУЛЬСНОГО бура (вместо СИЛЫ БУРА): бюджет пробоя волны (Σ твёрдости) + пропорц. урон врагам.
  { id: 'impforce', cat: 'unit', label: STR.upgrades.tracks.impforce.label, sub: STR.upgrades.tracks.impforce.sub, accent: PAL.amber, icon: 'drill', cap: 3,
    need: (s) => !!s.impulse, step: 2, base: () => IMPULSE_FORCE, fmt: STR.upgrades.tracks.impforce.fmt },
  // КИНЕТИКА — для КИНЕТИЧЕСКОГО бура (вместо СИЛЫ БУРА): +общая сила (сдвигает всю кривую разгона вверх).
  { id: 'kinpower', cat: 'unit', label: STR.upgrades.tracks.kinpower.label, sub: STR.upgrades.tracks.kinpower.sub, accent: PAL.amber, icon: 'drill', cap: 2, metaCap: { node: 'mast_dk_max', cap: 3 },
    need: (s) => !!s.kinetic, step: KIN_POWER_STEP, base: () => KIN_BASE_MULT, fmt: STR.upgrades.tracks.kinpower.fmt },
  // РАЗГОН ПРОБОЯ — шанс взрывного пробоя кинетики; ДОСТУПЕН при узле `mast_dk_burst` (+10%/ур, cap 2 → +20% к базовым 10%).
  { id: 'kinburst', cat: 'unit', label: STR.upgrades.tracks.kinburst.label, sub: STR.upgrades.tracks.kinburst.sub, accent: PAL.amber, icon: 'drill', metaNeed: 'mast_dk_burst', cap: 2,
    need: (s) => !!s.kinetic, step: KIN_BURST_STEP, base: () => KIN_BURST_CHANCE, fmt: STR.upgrades.tracks.kinburst.fmt },
  // СКОРОСТЬ ПРОХОДКИ — для ВИНТОВОГО бура: быстрее автономные щиты прокапывают породу (3 ур.).
  { id: 'screwspeed', cat: 'unit', label: STR.upgrades.tracks.screwspeed.label, sub: STR.upgrades.tracks.screwspeed.sub, accent: PAL.amber, icon: 'drill', cap: 3,
    need: (s) => !!s.screw, step: SCREW_SPEED_STEP, base: () => SCREW_DIG_BASE, fmt: STR.upgrades.tracks.screwspeed.fmt },
  // (апгрейд «ВРЕМЯ РАБОТЫ» щита — НЕ трек, а узел меты `mast_ds_life` на ветке бура; см. borers.js `borerLife()`)
  // ОХЛАЖДЕНИЕ РАДАРА — для РАДАР-сканера: короче кулдаун между развёртками. step ОТРИЦАТЕЛЬНЫЙ (кулдаун падает).
  { id: 'radarcd', cat: 'unit', label: STR.upgrades.tracks.radarcd.label, sub: STR.upgrades.tracks.radarcd.sub, accent: PAL.cobalt, icon: 'scanner', cap: 3,
    need: (s) => !!s.radar, step: -RADAR_CD_STEP, base: () => RADAR_CD_BASE, fmt: STR.upgrades.tracks.radarcd.fmt },
  // ВСПЫШКА ЭХО — для ЭХО-сканера: короче кулдаун волны. step ОТРИЦАТЕЛЬНЫЙ.
  { id: 'echocd', cat: 'unit', label: STR.upgrades.tracks.echocd.label, sub: STR.upgrades.tracks.echocd.sub, accent: PAL.cobalt, icon: 'scanner', cap: 3,
    need: (s) => !!s.echoScan, step: -ECHO_CD_STEP, base: () => ECHO_CD_BASE, fmt: STR.upgrades.tracks.echocd.fmt },
  // ПРИВОД — скорость хода; открывается КРАСНЫМ узлом `print_speed` «Оптимизация привода» (узел сам скорость не даёт — пускает тюнинг ресурсом).
  { id: 'engine',  cat: 'unit', label: STR.upgrades.tracks.engine.label,     sub: STR.upgrades.tracks.engine.sub,          accent: PAL.cobalt, icon: 'engine', metaNeed: 'print_speed', cap: 3,
    need: (s) => s.canMove, step: 0.4, base: (s) => s.moveSpeed, fmt: STR.upgrades.tracks.engine.fmt },
  { id: 'scanner', cat: 'unit', label: STR.upgrades.tracks.scanner.label,     sub: STR.upgrades.tracks.scanner.sub,  accent: PAL.cobalt, icon: 'scanner', cap: 2, costMul: 1.6,
    need: (s) => s.scanR > 0 && !s.radar && !s.echoScan, step: 1, base: (s) => s.scanR, fmt: STR.upgrades.tracks.scanner.fmt },   // только СТАНДАРТНЫЙ сканер (радар/эхо — фикс. радиус 1, у них трек кулдауна)
  { id: 'cargo',   cat: 'unit', label: STR.upgrades.tracks.cargo.label,    sub: STR.upgrades.tracks.cargo.sub,      accent: PAL.toxic, icon: 'cargo', cap: 2, metaCap: { node: 'mast_cargo', cap: 4 },
    need: (s) => s.capacity > 0, step: 2, base: (s) => s.capacity, fmt: (v) => v + '' },   // груз больше не несёт healRate → исключение по healRate снято (трек работает и для вместительного трюма)
  // РЕМОНТ — трек РЕМОНТНОГО МОДУЛЯ (доп-слот, когда установлен `s.healRate>0`): +1 HP/10с за уровень.
  // База от модуля (1 HP/10с), 4 уровня → 5 HP/10с. Ёмкости не касается (модуль груз не хранит) → применяется через UPG_STAT_MAP (repair→healRate), без apply.
  { id: 'repair',  cat: 'unit', label: STR.upgrades.tracks.repair.label, sub: STR.upgrades.tracks.repair.sub, accent: PAL.toxic, icon: null, cap: 4,
    need: (s) => s.healRate > 0, step: 1, base: (s) => s.healRate, fmt: STR.upgrades.tracks.repair.fmt },
  { id: 'hull',    cat: 'unit', label: STR.upgrades.tracks.hull.label,  sub: STR.upgrades.tracks.hull.sub,    accent: PAL.gold, icon: null, cap: 2, metaCap: { node: 'mast_hull', cap: 4 },
    need: () => true, step: 20, base: (s) => s.maxHp, fmt: (v) => v + ' HP' },
  // ПРОЖЕКТОР — дальность луча; открывается узлом «Сенсорный цех» (`mast_sens`). Эффект — render_light.
  { id: 'proj',    cat: 'unit', label: STR.upgrades.tracks.proj.label,  sub: STR.upgrades.tracks.proj.sub,   accent: PAL.cobalt, icon: null, metaNeed: 'mast_sens', cap: 3,
    need: () => true, step: 1, base: () => 0, fmt: STR.upgrades.tracks.proj.fmt },
  // ЭКРАН ПОМЕХ — докручивает гашение помех; трек ДОСТУПЕН, когда установлен МОДУЛЬ «Экран помех»
  // (доп-слот, `s.noiseResist>0`) — как ремонтный трюм. База — от модуля, эффект — game.drawScene.
  { id: 'noise',   cat: 'unit', label: STR.upgrades.tracks.noise.label, sub: STR.upgrades.tracks.noise.sub, accent: PAL.cobalt, icon: null, cap: 3,
    need: (s) => (s.noiseResist || 0) > 0, step: 0.15, base: (s) => s.noiseResist || 0, fmt: (v) => Math.round(v * 100) + '%' },
  // РАДИУС ПЕЧАТИ — на каком расстоянии можно ставить структуры; трек доступен при установленном МОДУЛЕ ПЕЧАТИ.
  { id: 'printreach', cat: 'unit', label: STR.upgrades.tracks.printreach.label, sub: STR.upgrades.tracks.printreach.sub, accent: PAL.amber, icon: null, cap: 2,
    need: (s) => (s.printer || 0) > 0, step: 1, base: (s) => s.printReach || 0, fmt: STR.upgrades.tracks.printreach.fmt },
  // ── ГОРОД (жёлтая ветка `amb`): батареи/контуры — ранние узлы; чарджер/нанорой/док — глубже.
  { id: 'battery', cat: 'city', label: STR.upgrades.tracks.battery.label, sub: STR.upgrades.tracks.battery.sub, accent: PAL.amber, icon: null, metaNeed: 'amb_batt',
    need: () => true, step: 15, base: () => CITY_TIMER_MAX, fmt: STR.upgrades.tracks.battery.fmt },
  // СУПЕР-ЧАРДЖЕР — `amb_charge`: быстрее дозарядка таймера на базе (эффект — city.recharge).
  { id: 'charge', cat: 'city', label: STR.upgrades.tracks.charge.label, sub: STR.upgrades.tracks.charge.sub, accent: PAL.amber, icon: null, metaNeed: 'amb_charge',
    need: () => true, cap: 3, step: 8, base: () => CITY_TIMER_RECHARGE, fmt: STR.upgrades.tracks.charge.fmt },
  // КОНТУРЫ 3-в-1 — `amb_cont`: ОДИН трек усиливает кольца ПО ОЧЕРЕДИ внеш→внутр→ядро (+CITY_CONTOUR_HP
  // тому кольцу, чья очередь на этом уровне). Распределение по кольцам — `cityRingBonuses`.
  { id: 'contours', cat: 'city', label: STR.upgrades.tracks.contours.label, sub: STR.upgrades.tracks.contours.sub, accent: PAL.gold, icon: null, metaNeed: 'amb_cont',
    need: () => true, cap: 3, step: 1, base: () => 0, fmt: STR.upgrades.tracks.contours.fmt },
  // АВТО-ПОЧИНКА — `amb_regen`: уровень = ОХВАТ колец (ядро→+внутр→+внешний), эффект — city.repairLvl.
  { id: 'cityrepair', cat: 'city', label: STR.upgrades.tracks.cityrepair.label, sub: STR.upgrades.tracks.cityrepair.sub, accent: PAL.toxic, icon: null, metaNeed: 'amb_regen',
    need: () => true, cap: 3, step: 1, base: () => 0, fmt: STR.upgrades.tracks.cityrepair.fmt },
  // РЕМОНТНЫЙ ДОК — `amb_dock`: на базе юнит лечит HP (эффект — game playing-цикл, `cityDockRate`).
  { id: 'dock', cat: 'city', label: STR.upgrades.tracks.dock.label, sub: STR.upgrades.tracks.dock.sub, accent: PAL.toxic, icon: null, metaNeed: 'amb_dock',
    need: () => true, cap: 4, step: CITY_DOCK_HP, base: () => 0, fmt: STR.upgrades.tracks.dock.fmt },
  // ДЛИНА ШЛЕЙФА — `print_cable` (КРАСНАЯ ветка): длина физического энергошлейфа в тайлах ПУТИ (эффект — game._cableUpdate / cableLen).
  { id: 'cable', cat: 'city', label: STR.upgrades.tracks.cable.label, sub: STR.upgrades.tracks.cable.sub, accent: PAL.amber, icon: null, metaNeed: 'print_cable', cap: 3, metaCap: { node: 'print_cable2', cap: 5 },
    need: () => true, step: CABLE_LEN_STEP, base: () => CABLE_LEN_BASE, fmt: STR.upgrades.tracks.cable.fmt },
];
// потолок уровней трека: БЕЗ узла «Верстак ИИ» (`mast_hub`) каждый трек капается 1 уровнем; с ним — штатные
// потолки (базовый `cap`/UPG_MAX — бур 3, сканер/груз/прочность 2 …), узлы `metaCap` поднимают дальше.
// Апгрейды РЕЛИКТОВ (Батч 6): формат значения по виду стата + акцент. cap/step/base — из ARTIFACT_UP (constants.js, единый источник).
// Трек добавляется ДИНАМИЧЕСКИ при установке артефакта (syncArtifactTracks), т.к. реликты находят СЕРЕДИ забега (init фиксирует только модульные треки).
const ART_UPG_FMT = {
  pct:   (v) => Math.round(v * 100) + '%',
  num:   (v) => '' + Math.round(v),
  tiles: (v) => Math.round(v) + STR.upgrades.artUnit.tiles,
  sec:   (v) => (Math.round(v * 10) / 10) + STR.upgrades.artUnit.sec,
};
const ART_UPG_META = {
  armor:        { fmt: 'pct',   accent: PAL.gold },
  overshield:   { fmt: 'num',   accent: PAL.gold },
  absorb:       { fmt: 'num',   accent: PAL.gold },
  thorns:       { fmt: 'num',   accent: PAL.gold },
  echo_drill:   { fmt: 'pct',   accent: PAL.amber },
  combat_drill: { fmt: 'num',   accent: PAL.amber },
  jets:         { fmt: 'sec',   accent: PAL.cobalt },
  city_shield:  { fmt: 'num',   accent: PAL.gold },
  stun_pulse:   { fmt: 'tiles', accent: PAL.cobalt },
  blast_charge: { fmt: 'num',   accent: PAL.amber },
  nano_repair:  { fmt: 'num',   accent: PAL.toxic },
  drill_overdrive: { fmt: 'pct', accent: PAL.amber },
  drive_dash:   { fmt: 'tiles', accent: PAL.cobalt },
  harpoon:      { fmt: 'tiles', accent: PAL.cobalt },
  xray:         { fmt: 'sec',   accent: PAL.cobalt },
  data_detector:{ fmt: 'tiles', accent: PAL.cobalt },
  drone_collector: { fmt: 'tiles', accent: PAL.cobalt },
  drone_courier:   { fmt: 'num', accent: PAL.cobalt },
  drone_battery:   { fmt: 'sec', accent: PAL.amber },
  drone_scout:     { fmt: 'tiles', accent: PAL.cobalt },
  drone_hacker:    { fmt: 'sec', accent: PAL.cobalt },
};

const trCap = (tr) => {
  if (tr.cat === 'artifact') return tr.cap || 3;   // апгрейды реликтов — независимы от «Верстака ИИ» (mast_hub), свой потолок ≤3
  if (typeof metaHas === 'function' && !metaHas('mast_hub')) return 1;
  let c = tr.cap || UPG_MAX;
  if (tr.metaCap && typeof metaHas === 'function' && metaHas(tr.metaCap.node)) c = tr.metaCap.cap;
  return c;
};
// Соответствие трека → поле stats юнита (для applyToStats).
const UPG_STAT_MAP = { drill: 'digMult', impforce: 'impForce', kinpower: 'kinPower', kinburst: 'kinBurstBonus', screwspeed: 'screwSpeed', radarcd: 'radarCdD', echocd: 'echoCdD', engine: 'moveSpeed', scanner: 'scanR', cargo: 'capacity', repair: 'healRate', hull: 'maxHp', proj: 'projLvl', noise: 'noiseResist', printreach: 'printReach' };

const UPG_GADGETS = [
  { id: 'magnet', label: STR.upgrades.gadgets.magnet.label, sub: STR.upgrades.gadgets.magnet.sub, accent: PAL.gold, cost: { iron: 18, organic: 8 } },
  { id: 'repair', label: STR.upgrades.gadgets.repair.label,  sub: STR.upgrades.gadgets.repair.sub, accent: PAL.toxic, cost: { iron: 20, organic: 12 } },
  { id: 'ping',   label: STR.upgrades.gadgets.ping.label,   sub: STR.upgrades.gadgets.ping.sub, accent: PAL.cobalt, cost: { crystal: 8 } },
];

class Upgrades {
  constructor() {
    this.bank = { iron: 0, organic: 0, crystal: 0 };
    this.levels = {}; this.gadgets = {};
    this.base = null; this.tracks = []; this.cityName = STR.upgrades.cityNameDefault;
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
    this.base = { ...baseStats }; this.cityName = cityName || STR.upgrades.cityNameDefault;
    // набор треков: по модулям сборки (need) И по анлокам СЕТИ ПАМЯТИ (metaNeed);
    // мета применяется на СТАРТЕ сессии — купленный среди забега узел заработает со следующего
    this.tracks = UPG_TRACKS.filter((tr) => tr.need(this.base) && (!tr.metaNeed || (typeof metaHas === 'function' && metaHas(tr.metaNeed))));
    for (const tr of this.tracks) this.levels[tr.id] = 0;
    this.scrollY = 0; this.sel = 0; this.warnT = -1e9;
  }

  // БАТЧ 6: синхронизация треков апгрейда РЕЛИКТОВ с установленными артефактами (зовётся из game._applyArtifacts).
  // Реликты находят СЕРЕДИ забега → трек добавляем ДИНАМИЧЕСКИ (init фиксирует только модульные). Уровни купленного сохраняются.
  syncArtifactTracks(ids) {
    ids = ids || [];
    this.tracks = this.tracks.filter((t) => t.cat !== 'artifact' || ids.includes(t.art));   // снят артефакт → убрать его трек
    for (const id of ids) {
      if (this.tracks.some((t) => t.art === id)) continue;                                   // уже есть
      const up = (typeof ARTIFACT_UP !== 'undefined') && ARTIFACT_UP[id];
      const meta = ART_UPG_META[id], def = (typeof ARTIFACT_BY_ID !== 'undefined') && ARTIFACT_BY_ID[id];
      if (!up || !meta || !def) continue;
      const fmt = ART_UPG_FMT[meta.fmt] || ART_UPG_FMT.num;
      const tr = { id: 'art_' + id, art: id, cat: 'artifact', label: def.name, sub: STR.upgrades.artSub[id] || '', accent: meta.accent, icon: null, cap: up.cap, step: up.step, base: () => up.base, fmt };
      this.tracks.push(tr);
      if (this.levels[tr.id] == null) this.levels[tr.id] = 0;
    }
  }

  addBank(type, n) { this.bank[type] = (this.bank[type] || 0) + (n || 1); }
  tierCost(level, tr) {
    const base = UPG_TIER_COSTS[Math.min(level, UPG_TIER_COSTS.length - 1)];
    // «Рационализация» (3 узла, прогрессивно) → −% к цене ВСЕХ треков (единый источник цены). Берём МАКС владомого.
    let discPct = 0;
    if (typeof metaHas === 'function') {
      if (metaHas('print_disc')) discPct = PRINT_DISC;
      if (metaHas('print_disc2')) discPct = PRINT_DISC2;
      if (metaHas('print_disc3')) discPct = PRINT_DISC3;
    }
    const disc = 1 - discPct;
    const mul = (tr && tr.costMul ? tr.costMul : 1) * disc;
    if (mul === 1) return base;
    const out = {}; for (const k in base) out[k] = Math.max(1, Math.ceil(base[k] * mul)); return out;
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
  cableLen() { return CABLE_LEN_BASE + (this.levels.cable || 0) * CABLE_LEN_STEP; }   // длина энергошлейфа (тайлы пути)
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
