'use strict';

// Печать структур — поток геймплея (домешан в Game.prototype, как ai.js; грузится ПОСЛЕ game).
// Состояние на game: printSel (выбранный чертёж) · printMode (null|place|build) · printGhost · printFace
// · printStruct. Признак «принтер в доп-слоте» — unit.modules.aux==='print'. Ресурс ТРЮМА (inventory.cargo)
// тратится ТОЛЬКО при завершении печати; отмена по Esc (place или build) — без траты. Юнит залочен
// (unit.frozenPrint) в place и build. Размещение — на тайл-воздух с твёрдой поверхностью, в радиусе PRINT_REACH.

const PRINT_TYPES = ['wall', 'spike', 'turret_mg', 'turret_rail', 'turret_mw', 'emp', 'repulsor', 'jammer', 'repair_drone', 'battery'];   // полный ростер; видимость чертежа — гейт по узлам меты (STRUCT_UNLOCK)

Object.assign(Game.prototype, {
  printActive() { return !!(this.unit && this.unit.modules && this.unit.modules.aux === 'print'); },
  // Доступные чертежи = ростер ∩ открытые узлы СЕТИ ПАМЯТИ (ветка vault). Узел не куплен → чертёж скрыт.
  printTypes() { return PRINT_TYPES.filter((t) => STRUCT_DEFS[t] && metaHas(STRUCT_UNLOCK[t])); },
  // Цена структуры с учётом узла удешевления (vault_cost). Единый источник для HUD/проверки/списания.
  structCost(type) {
    const def = STRUCT_DEFS[type]; if (!def) return {};
    if (!metaHas('vault_cost')) return def.cost;
    const out = {}; for (const k in def.cost) out[k] = Math.max(1, Math.round(def.cost[k] * PRINT_COST_FACTOR)); return out;
  },
  printCanAfford(type) {
    const def = STRUCT_DEFS[type], c = this.inventory && this.inventory.cargo;
    if (!def || !c) return false;
    const cost = this.structCost(type);
    return Object.keys(cost).every((k) => (c[k] || 0) >= cost[k]);
  },

  resetPrint() {
    if (this.printStruct && this.structures) { const i = this.structures.list.indexOf(this.printStruct); if (i >= 0) this.structures.list.splice(i, 1); }
    this.printMode = null; this.printStruct = null; this.printGhost = null;
    if (this.unit) this.unit.frozenPrint = false;
  },

  // HUD-клик панели печати: выбор чертежа / кнопка ПЕЧАТЬ. true = клик поглощён.
  printClick(x, y) {
    if (!this.printActive() || this.printMode || typeof printPanelLayout !== 'function') return false;
    const L = printPanelLayout(this.designW, this.designH, this.printTypes());
    if (L.toggle && x >= L.toggle.x && x <= L.toggle.x + L.toggle.w && y >= L.toggle.y && y <= L.toggle.y + L.toggle.h) { this.hoardCargo = !this.hoardCargo; return true; }   // тумблер копить/сдавать — флип
    for (const c of L.cards) if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) { this.printSel = c.type; return true; }
    if (this.printSel && this.printCanAfford(this.printSel) && x >= L.btn.x && x <= L.btn.x + L.btn.w && y >= L.btn.y && y <= L.btn.y + L.btn.h) { this.printBegin(); return true; }
    return false;
  },

  printBegin() {   // вход в режим размещения (юнит лочится)
    if (!this.printSel || !this.printCanAfford(this.printSel)) return;
    this.printMode = 'place'; this.printFace = 0; this.printGhost = null;
    if (this.unit) this.unit.frozenPrint = true;
  },

  printConfirm() {   // place → build: ставим структуру (строится); ресурс спишется при завершении
    if (this.printMode !== 'place') return;
    const g = this.printGhost = this._printGhost();
    if (!g || !g.valid) return;
    const s = this.structures.add(this.printSel, g.tileX, g.tileY, g.face);
    if (!s) return;   // потолок структур
    if (metaHas('vault_speed')) s.buildTime *= PRINT_SPEED_FACTOR;   // узел ускорения печати
    this.printStruct = s; this.printMode = 'build';
  },

  printCancel() { this.resetPrint(); },   // Esc — без траты ресурса

  updatePrint(dt) {
    this._printEsc = false;
    if (!this.printActive()) { if (this.printMode) this.resetPrint(); return; }
    if (this.printSel && !this.printTypes().includes(this.printSel)) this.printSel = null;
    if (!this.printMode) return;

    if (this.input.pressed('Escape')) { this.printCancel(); this._printEsc = true; return; }   // поглощаем Esc (не в паузу)
    if (this.unit) this.unit.frozenPrint = true;

    if (this.printMode === 'place') {
      this.printGhost = this._printGhost();
      if (this.input.pressed('KeyR')) this._printRotate();
      if (this.input.pressed(KEY_PRIMARY)) this.printConfirm();   // подтверждение печати — ГЛАВНОЕ действие (Пробел)
      return;
    }
    if (this.printMode === 'build') {
      if (!this.printStruct || this.printStruct.dying) { this.resetPrint(); return; }   // структуру снесли во время печати
      if (this.printStruct.state === 'active') {                                         // печать завершена → списать ресурс (с учётом удешевления)
        const cost = this.structCost(this.printStruct.type);
        for (const k in cost) this.inventory.cargo[k] = Math.max(0, (this.inventory.cargo[k] || 0) - cost[k]);
        if (this.fx) this.fx.burst(this.printStruct.px, this.printStruct.py, Object.keys(cost));
        if (this.logEvent) this.logEvent('СТРУКТУРА НАПЕЧАТАНА · ' + STRUCT_DEFS[this.printStruct.type].name.toUpperCase());
        this.printStruct = null; this.printMode = null;
        if (this.unit) this.unit.frozenPrint = false;
      }
    }
  },

  _printRotate() { const f = this.printGhost && this.printGhost.faces; if (f && f.length > 1) this.printFace = (this.printFace + 1) % f.length; },

  // Призрак из позиции мыши: тайл под курсором, кламп по PRINT_REACH вокруг юнита, поверхность, валидность.
  _printGhost() {
    const m = this.menuMouse || { x: this.designW / 2, y: this.designH / 2 }, U = this.unit, W = this.world;
    const wpx = wrapPx(this.camera.x + m.x), wpy = this.camera.y + m.y;
    let tx = Math.floor(wpx / TILE), ty = Math.floor(wpy / TILE);
    const reach = (U.stats && U.stats.printReach) || PRINT_REACH;
    const dx = wrapDeltaPx(tx * TILE, U.tileX * TILE) / TILE, dy = ty - U.tileY, d = Math.hypot(dx, dy);   // tx−ux
    if (d > reach) { tx = Math.round(U.tileX + dx / d * reach); ty = Math.round(U.tileY + dy / d * reach); }
    tx = wrapX(tx);
    const faces = [];
    if (isSolid(W.tileAt(tx, ty + 1))) faces.push('floor');
    if (isSolid(W.tileAt(tx, ty - 1))) faces.push('ceil');
    if (isSolid(W.tileAt(tx - 1, ty))) faces.push('wallL');
    if (isSolid(W.tileAt(tx + 1, ty))) faces.push('wallR');
    const face = faces.length ? faces[this.printFace % faces.length] : 'floor';
    const valid = W.tileAt(tx, ty).type === AIR && faces.length > 0 && !(tx === U.tileX && ty === U.tileY)
      && !this.structures.occupied(tx, ty) && this.structures.canAdd() && this.printCanAfford(this.printSel);
    return { tileX: tx, tileY: ty, face, faces, valid };
  },
});
