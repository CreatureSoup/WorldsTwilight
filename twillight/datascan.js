'use strict';

// ИЗВЛЕЧЕНИЕ ДАННЫХ → КОДЕКС (домешан в Game.prototype, ПОСЛЕ game). Автоскан выкопанных СЕРВЕРОВ и вражеских
// ЮНИТОВ в радиусе сенсора, детект ПЕРВЫХ ВСТРЕЧ объектов (глоссарий+подсказки), объёмный скан ПЕЩЕР-сцен.
// Всё через `_scanT` (скорость накопления, узел `kart_hub`) и `_dataGain` (множитель + выдача в кодекс, узел
// `kart_data`); попап встаёт на месте HUD-кольца скана (`_codexAnchor`). Персист опознанных типов — `save.idTypes`
// (`_idKnown`/`_idMark`). ⚠️ НЕ путать со `scanners.js` (РАДАР/ЭХО-модули юнита) и `render_scan.js` (лучи/конусы).

// ── Ветвь МИР, тюнинг данных: `kart_hub` (−30% время скана) + `kart_data` (×фрагментов). Все источники
// проходят через _scanT (скорость накопления) и _dataGain (множитель + выдача в кодекс).
Game.prototype._scanT = function (base) { return base * ((typeof metaHas === 'function' && metaHas('kart_hub')) ? KART_SCAN_MULT : 1); };
Game.prototype._dataGain = function (n) { const m = (typeof metaHas === 'function' && metaHas('kart_data')) ? KART_DATA_MULT : 1; return (typeof codexGainData === 'function') ? codexGainData(Math.round(n * m)) : null; };

// Сканирование выкопанных серверов: ближайший в радиусе SCAN_RADIUS качает данные (dt/SCAN_TIME);
// уход прерывает (прогресс сохранён в server.data — вернулся, докачал). По концу — лог-событие.
Game.prototype.updateServers = function (dt) {
  if (!this.world || !this.unit) return;
  let active = null, best = Infinity;
  for (const s of this.world.servers) {
    if (!s.dug || s.done || !this.world.isSeen(s.tx, s.ty)) continue;   // только в радиусе И в раскрытом (не сквозь туман)
    const dx = wrapDeltaPx(this.unit.px, (s.tx + 0.5) * TILE), dy = this.unit.py - (s.ty + 0.5) * TILE;
    const d = Math.hypot(dx, dy);
    if (d <= SCAN_RADIUS * TILE && d < best) { best = d; active = s; }
  }
  if (active) {
    active.data = Math.min(1, active.data + dt / this._scanT(SCAN_TIME));
    if (active.data >= 1) {
      active.done = true; this.dataCount++; this.logEvent(STR.log.newData);
      // извлечённые данные → фрагмент(ы) текущего диска кодекса + попап на месте кольца скана.
      // Попап заменяет HUD-надпись «ДАННЫЕ ИЗВЛЕЧЕНЫ» (потому _scanDoneT=0); если диск уже полон
      // (попапа нет) — оставляем обычную HUD-надпись на 2.4с.
      let popped = false;
      { const r = this._dataGain(CODEX_DATA_PER_SCAN); if (r && typeof codexPopupShow === 'function') { codexPopupShow(r, this._codexAnchor()); popped = true; } }
      this._scanMsg = null; this._scanDoneT = popped ? 0 : 2.4;   // сервер всегда даёт данные (надпись «ДАННЫЕ ИЗВЛЕЧЕНЫ»)
      active = null;
    }
  }
  this.activeScan = active;
  if (this._scanDoneT > 0) this._scanDoneT -= dt;
};

// Скан вражеского юнита (копателя и др.): враг в радиусе сканера накапливает прогресс →
// по завершении даёт фрагмент данных в кодекс (разово на юнит) + лог + глоссарий. Цель движется —
// вне радиуса прогресс паузится (как у серверов). Конус/луч рисует render_scan.drawEnemyScanFx.
Game.prototype.updateEnemyScan = function (dt) {
  if (!this.world || !this.unit || !this.enemies) return;
  let active = null, best = Infinity;
  for (const e of this.enemies) {
    if (e.friendly || e.scanned || e.dying || e.dead || !this.world.isSeen(e.tileX, e.tileY)) continue;   // дружественных не сканируем как врагов; только видимые (не сквозь туман)
    const dx = wrapDeltaPx(this.unit.px, (e.tileX + 0.5) * TILE), dy = this.unit.py - (e.tileY + 0.5) * TILE;
    const d = Math.hypot(dx, dy);
    if (d <= SCAN_RADIUS * TILE && d < best) { best = d; active = e; }
  }
  if (active) {
    active.scan = Math.min(1, active.scan + dt / this._scanT(SCAN_TIME));
    if (active.scan >= 1) {
      active.scanned = true;
      const nm = ENEMY_RU[active.type] || STR.enemy.fallback;
      if (this._idKnown('unit:' + active.type)) {           // тип УЖЕ опознан: только лог, без данных/глоссария/попапа
        this.logEvent(STR.log.identified(nm)); this._scanMsg = STR.log.scanMsgIdentified; this._scanDoneT = 2.0;
      } else {                                              // ПЕРВЫЙ скан типа: данные + глоссарий + лог
        this._idMark('unit:' + active.type); this.dataCount++; this.logEvent(STR.log.scannedEnemy(nm));
        this.discover('unit');
        { const r = this._dataGain(CODEX_DATA_PER_SCAN); if (r && typeof codexPopupShow === 'function') codexPopupShow(r, this._codexAnchor()); }
      }
      active = null;
    }
  }
  this.scanEnemy = active;
};

// CSS-якорь попапа кодекса = центр HUD-кольца скана (SCAN_RING в design → CSS через coordScale),
// чтобы диск появился РОВНО на месте кольца и того же размера.
Game.prototype._codexAnchor = function () {
  const cs = this.coordScale || 1;
  return { right: SCAN_RING.dx / cs, bottom: SCAN_RING.dy / cs, size: (SCAN_RING.r * 2 + 14) / cs };
};

// ОДНОРАЗОВО: открыть запись глоссария категории + лог + крупная подсказка. Возвращает false,
// если глоссарий категории УЖЕ исчерпан (нечего открывать) — чтобы caller перестал опрашивать.
Game.prototype.discover = function (cat) {
  if (typeof codexDiscoverCat !== 'function') return false;
  const e = codexDiscoverCat(cat); if (!e) return false;
  this.logEvent(STR.log.detected(e.name.toUpperCase()));
  // КРУПНАЯ подсказка-находка — РАЗОВО НА КАТЕГОРИЮ НАВСЕГДА (персист save.hintsSeen): не повторяем каждую сессию/доп. запись
  const HT = STR.log.findHint, seen = (this.save.hintsSeen || (this.save.hintsSeen = {}));
  if (this.hints && !seen[cat]) { this.hints.show(HT[cat] || STR.log.findFallback); seen[cat] = 1; if (typeof writeSave === 'function') writeSave(this.save); }
  return true;
};
// Персист «уже опознанных» типов объектов (скан): первый скан типа даёт данные/глоссарий, повтор — только лог.
Game.prototype._idKnown = function (key) { return !!(this.save.idTypes && this.save.idTypes.indexOf(key) >= 0); };
Game.prototype._idMark = function (key) { const s = this.save; if (!s.idTypes) s.idTypes = []; if (s.idTypes.indexOf(key) < 0) { s.idTypes.push(key); if (typeof writeSave === 'function') writeSave(s); } };
// Детект первых встреч + подсказки по высоте. ОПТИМИЗИРОВАНО: опрос ~5/сек (не каждый кадр),
// пропуск исчерпанных категорий (`_discEx`) и замеченных объектов (`o._noticed`); когда всё открыто
// и все отсечки пройдены — флаг `_discDone` отключает опрос совсем (нулевая фоновая цена).
Game.prototype.checkDiscoveries = function (dt) {
  if (this._discDone) return;
  if ((this._discT = (this._discT || 0) + dt) < 0.2) return; this._discT = 0;
  const w = this.world, u = this.unit; if (!w || !u) return;
  const exh = (typeof codexCatExhausted === 'function') ? codexCatExhausted : () => false;
  const scan = (cat, list, kx, ky) => { if (!list || exh(cat)) return; for (const o of list) if (!o._noticed && w.isSeen(o[kx], o[ky])) { o._noticed = true; this.discover(cat); } };
  scan('server', w.servers, 'tx', 'ty');
  scan('wild', w.wilds, 'cx', 'cy');
  // НЕЙТРАЛЬНЫЙ ГОРОД: первая встреча КАЖДОГО → данные + лог + глоссарий (категория — разово). Города «спят».
  if (w.caverns) for (const c of w.caverns) {
    if (c._noticed || !w.isSeen(c.cx, c.cy)) continue;
    c._noticed = true; this.discover('sleep'); this.dataCount++;
    const r = this._dataGain(KART_CITY_DATA); if (r && typeof codexPopupShow === 'function') codexPopupShow(r, this._codexAnchor());
    this.logEvent(STR.log.neutralCity((c.name || '').toUpperCase()));
  }
  // 'unit' — глоссарий вражеских юнитов теперь открывает СКАН (updateEnemyScan), не «увидел издалека»
  for (let i = 0; i < HINT_DEPTHS.length; i++) if (!this._depthFired.has(i) && u.tileY <= HINT_DEPTHS[i].y) { this._depthFired.add(i); if (this.hints) this.hints.show(HINT_DEPTHS[i].text); }
  const cavAll = !w.caverns || w.caverns.every((c) => c._noticed);
  if (exh('server') && exh('wild') && cavAll && this._depthFired.size >= HINT_DEPTHS.length) this._discDone = true;   // ждём все города (данные пер-город)
};
// вход в пещеру-сцену → объёмный сканер (свип) → извлечение данных в кодекс (разово)
Game.prototype.updateBackdrops = function (dt) {
  const w = this.world, u = this.unit; if (!w || !w.backdrops || !u) return;
  for (const b of w.backdrops) {
    if (b._rejT > 0) b._rejT = Math.max(0, b._rejT - dt);   // спад красной «отказной» вспышки (скан без метода извлечения)
    if (b.scanned) { b.reveal = 1; continue; }
    if (b.scanning) {
      b.sweepT = Math.min(1, b.sweepT + dt / this._scanT(b._hasMethod ? BACKDROP_SWEEP : BACKDROP_SWEEP_NODATA)); b.reveal = b.sweepT;
      if (b.sweepT >= 1) {
        b.scanning = false; b.reveal = 1;
        if (b._hasMethod) { b.scanned = true; this._backdropDone(b); }                                  // узел kart_ruins → проявлен + данные/глоссарий
        else { b._attempted = true; b._rejT = BACKDROP_REJ_T; this.logEvent(STR.log.ruinsNoMethod); }   // без узла → ассет ПРОЯВЛЕН (виден), но данных нет → красный «отказ»
      }
    } else if (w.inEllipseList(u.tileX, u.tileY, [b]) && !b._attempted) {
      // КОРОТКИЙ свип ВСЕГДА при входе (ассет проявляется — раньше без узла скан не запускался и руины были невидимы);
      // данные извлекаются только при узле kart_ruins (иначе — короткий проход + «отказ»).
      b.scanning = true; b.sweepT = 0; b._hasMethod = (typeof metaHas !== 'function') || metaHas('kart_ruins');
      this.logEvent(STR.log.caveScan);
    }
  }
};
Game.prototype._backdropDone = function (b) {
  const key = 'cave:' + (b.kind || 'scene');
  if (this._idKnown(key)) { this.logEvent(STR.log.identifiedCave); this._scanMsg = STR.log.scanMsgIdentified; this._scanDoneT = 2.0; return; }   // вид пещеры уже знаком — без данных/глоссария
  this._idMark(key);
  this.discover('cave');   // глоссарий: пещера · культ.слой (ПЕРВЫЙ раз для вида)
  { const r = this._dataGain(BACKDROP_DATA); if (r && typeof codexPopupShow === 'function') codexPopupShow(r, this._codexAnchor()); }
  this.logEvent(STR.log.caveData);
};
