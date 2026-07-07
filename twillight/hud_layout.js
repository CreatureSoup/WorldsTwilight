'use strict';

// ═══════════ HUD LAYOUT — единый аллокатор слотов HUD (дизайн-система «виджеты не наслаиваются») ═══════════
// ПРОБЛЕМА: ~27 HUD-виджетов хардкодили экранные координаты; в одной зоне (низ-лево: печать+бур-статус;
// верх-лево: алерт/эконом/радар-свитч/компасы) независимые y → НАЛОЖЕНИЯ при одновременной активности.
// РЕШЕНИЕ: виджеты в ОДНОЙ ЗОНЕ просят слот у HudLayout — он стекает их без наложения. Порядок в стеке =
// порядок вызова slot() = порядок отрисовки в game.drawScene. Условный виджет не рисуется → не занимает
// место (авто-рефлоу: сосед исчез → нижние поднялись). Новый виджет = один вызов slot(zone,w,h), а не поиск
// свободного пикселя вручную → НАЛОЖИТЬСЯ НЕВОЗМОЖНО ПО ПОСТРОЕНИЮ.
//
// ЖИЗНЕННЫЙ ЦИКЛ (game.drawScene, каждый кадр HUD-блока):
//   HudLayout.begin(W, H)                  — сброс курсоров зон на кадр
//   HudLayout.reserve('tl', w, h)          — застолбить фикс-мебель (юнит/груз/банк), чтобы стек шёл НИЖЕ неё
//   const r = HudLayout.slot('tl', w, h)   — виджет получает {x,y,w,h} без наложения (в зоне)
//   HudLayout.mark(x,y,w,h,'action-bar')   — «особый» виджет вне зон (центр/фуллскрин) → в валидатор
//   HudLayout.validate()                   — DEV (только debug): ворчит в консоль на ЛЮБЫЕ пересечения rect'ов
//
// ЗОНЫ. ax: якорь x (число = px от лево; '<N' = N px от право, x=W−N−w; 'c' = центр). ay: якорь y (число = px
// от верх; '<N' = N px от низа). dir: направление роста стека ('down' сверху-вниз / 'up' снизу-вверх).
const HUD_STACK_GAP = 6;                                 // зазор между виджетами в стеке зоны
const HUD_ZONES = {
  tl: { ax: 10,   ay: 8,     dir: 'down' },              // верх-лево: (reserve юнит/груз/банк) → алерт/эконом/радар-свитч/компасы
  bl: { ax: 12,   ay: '<26', dir: 'up' },                // низ-лево, ВВЕРХ от подсказки управления (H−10): печать (низ) → бур-статус (над ней)
  tc: { ax: 210,  ay: 8,     dir: 'down' },              // «коридор города» (x210, НЕ центр — чтобы не лезть на панель задания справа): капсула → файрволл → win-таймер
};

const HudLayout = (function () {
  let _W = 0, _H = 0;
  const _cur = {};                                        // текущий «курсор» по зоне (следующая позиция стека)
  const _rects = [];                                      // все выданные/помеченные rect'ы за кадр (для валидатора)
  // ── СВЁРТЫВАНИЕ ЛЕВЫХ ВИДЖЕТОВ (дёшево, для ЛЮБОГО слот-виджета левой зоны) ──
  const _dock = {};                                       // id → { c: свёрнут?, a: 0..1 анимация }
  const _dockTabs = [];                                   // за кадр: язычки {x,y,h,accent,c,id} (рисуем/кликаем)
  const DOCK_TAB = 11, DOCK_SPEED = 6;                    // ширина язычка; скорость слайда (ед a/с)
  let _dockPrevT = 0, _dockDt = 0;
  function begin(W, H) {
    _W = W; _H = H; _rects.length = 0; _dockTabs.length = 0;
    for (const z in HUD_ZONES) _cur[z] = null;
    const now = (typeof performance !== 'undefined') ? performance.now() : 0;   // dt для слайда — один на кадр
    _dockDt = _dockPrevT ? Math.min(0.05, (now - _dockPrevT) / 1000) : 0; _dockPrevT = now;
  }
  // Ядро сворачивания: анимирует, регистрирует язычок, возвращает slid-x. Общее для слот-виджетов и фикс-панелей.
  function _dockApply(id, baseX, baseY, w, h, accent) {
    let d = _dock[id]; if (!d) d = _dock[id] = { c: false, a: 0 };
    const tgt = d.c ? 1 : 0;
    if (d.a < tgt) d.a = Math.min(tgt, d.a + _dockDt * DOCK_SPEED); else if (d.a > tgt) d.a = Math.max(tgt, d.a - _dockDt * DOCK_SPEED);
    const wx = Math.round(baseX - d.a * (baseX + w));     // a=1 → уехал влево на (baseX+w): правый край у 0 (полностью за экраном)
    _dockTabs.push({ x: Math.max(0, wx - DOCK_TAB), y: baseY, h: h, accent: accent || '#c8b48c', c: d.c, id: id });
    return wx;
  }
  // Виджет левой зоны зовёт ВМЕСТО slot: получает slid-x (уезжает влево при сворачивании) + регистрирует язычок.
  function slotDock(zone, w, h, id, accent) {
    const base = slot(zone, w, h), z = HUD_ZONES[zone];
    if (!z || typeof z.ax !== 'number') return base;      // только левые зоны (числовой якорь слева)
    return { x: _dockApply(id, base.x, base.y, w, h, accent), y: base.y, w: w, h: h, zone: base.zone };
  }
  // Для ФИКС-панелей (рисуются по своим координатам, не через slot — груз/банк): вернуть slid-x по своему (baseX,baseY,w,h) + язычок.
  function dockShift(id, baseX, baseY, w, h, accent) { return _dockApply(id, baseX, baseY, w, h, accent); }
  // Рисуем все язычки ПОВЕРХ виджетов (после отрисовки левых виджетов): полоска цвета рамки + стрелка (← развёрнут / → свёрнут).
  function drawDockTabs(ctx) {
    for (const t of _dockTabs) {
      ctx.fillStyle = 'rgba(10,12,14,0.9)'; ctx.fillRect(t.x, t.y, DOCK_TAB, t.h);
      ctx.fillStyle = t.accent; ctx.fillRect(t.x, t.y, 2, t.h);                          // полоска цвета рамки виджета
      const cx = t.x + 7, cy = t.y + t.h / 2, w = 2.2, hh = 2.9;                          // аккуратный МАЛЫЙ треугольник с отступом от полоски
      ctx.fillStyle = t.accent; ctx.beginPath();
      if (!t.c) { ctx.moveTo(cx - w, cy); ctx.lineTo(cx + w, cy - hh); ctx.lineTo(cx + w, cy + hh); }   // ◄ развёрнут (кликни — свернётся)
      else { ctx.moveTo(cx + w, cy); ctx.lineTo(cx - w, cy - hh); ctx.lineTo(cx - w, cy + hh); }         // ► свёрнут (кликни — развернётся)
      ctx.closePath(); ctx.fill();
    }
  }
  function dockClick(x, y) {
    for (const t of _dockTabs) if (x >= t.x && x <= t.x + DOCK_TAB && y >= t.y && y <= t.y + t.h) { _dock[t.id].c = !_dock[t.id].c; return true; }
    return false;
  }
  function _ax(z, w) { const a = z.ax; if (a === 'c') return Math.round((_W - w) / 2); if (typeof a === 'string' && a.charCodeAt(0) === 60) return _W - parseInt(a.slice(1), 10) - w; return a; }
  function _ay0(z) { const a = z.ay; return (typeof a === 'string' && a.charCodeAt(0) === 60) ? _H - parseInt(a.slice(1), 10) : a; }
  function slot(zone, w, h, gap) {
    const z = HUD_ZONES[zone]; if (!z) return { x: 0, y: 0, w: w || 0, h: h || 0, zone: zone };
    gap = (gap == null) ? HUD_STACK_GAP : gap;
    const x = _ax(z, w);
    let y;
    if (z.dir === 'up') { const b = (_cur[zone] == null) ? _ay0(z) : _cur[zone]; y = b - h; _cur[zone] = y - gap; }
    else { y = (_cur[zone] == null) ? _ay0(z) : _cur[zone]; _cur[zone] = y + h + gap; }
    const r = { x: x, y: y, w: w, h: h, zone: zone }; _rects.push(r); return r;
  }
  function reserve(zone, w, h, gap) { return slot(zone, w, h, gap); }                 // застолбить место (без рисунка) — сдвигает курсор зоны
  function mark(x, y, w, h, tag) { _rects.push({ x: x, y: y, w: w, h: h, zone: tag || 'ext' }); }   // фикс/особый виджет вне зон → в валидатор
  // DEV-сеть: зовётся каждый кадр HUD-блока, но ВОРЧИТ ТОЛЬКО при СМЕНЕ набора наложений (дедуп _lastSig) — без спама.
  // Зоны tl/bl/tc по построению не наслаиваются; ловит наезд ЗОНЫ на marked-виджет (напр. bl-печать ↔ action-bar) и забытый хардкод.
  let _lastSig = '';
  function validate() {
    const bad = [];
    for (let i = 0; i < _rects.length; i++) for (let j = i + 1; j < _rects.length; j++) {
      const a = _rects[i], b = _rects[j];
      if (a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0 && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        bad.push(a.zone + '~' + b.zone + ' @(' + (a.x | 0) + ',' + (a.y | 0) + ')');
    }
    const sig = bad.join('|');
    if (sig !== _lastSig) { _lastSig = sig; if (bad.length) console.warn('[HUD раскладка] наложений: ' + bad.length + ' — ' + bad.join(' · ')); }
    return bad;
  }
  return { begin: begin, slot: slot, slotDock: slotDock, dockShift: dockShift, drawDockTabs: drawDockTabs, dockClick: dockClick, reserve: reserve, mark: mark, validate: validate, rects: function () { return _rects; } };
})();
