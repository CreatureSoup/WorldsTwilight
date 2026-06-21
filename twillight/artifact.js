'use strict';

// Артефакты (домешан в Game.prototype, ПОСЛЕ game). Большие погребённые объекты (world.genArtifacts):
// откопал тайл рядом с юнитом → `world.setAir` ставит `a.dug`; `_checkArtifacts` (в playing-цикле) ловит
// откопанный неразрешённый артефакт ВОЗЛЕ юнита и открывает модалку (mode 'artifact', мир заморожен как
// пауза). Выбор: 0 ТЕХНОЛОГИЯ (особое свойство — эффекты позже) · 1 ДАННЫЕ городу (кодекс) · 2 ПЕРЕРАБОТКА
// (ресурсы лутом). После выбора объект ПОТРЕБЛЁН (тайлы в воздух), мир размораживается. Рендер — render_artifact.
Object.assign(Game.prototype, {
  // ВСЕ тайлы артефакта откопаны (в воздухе)? — активация только когда объект ПОЛНОСТЬЮ освобождён от породы.
  artifactExcavated(a) {
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) if (this.world.tileAt(wrapX(a.tx + dx), a.ty + dy).type !== AIR) return false;
    return true;
  },
  _checkArtifacts() {
    if (this.mode !== 'playing' || this.pendingArtifact || !this.world || !this.unit) return;
    for (const a of this.world.artifacts) {
      if (a.resolved || !this.artifactExcavated(a)) continue;   // ждём ПОЛНОЙ откопки (не первый тайл)
      const acx = (a.tx + a.w / 2) * TILE, acy = (a.ty + a.h / 2) * TILE;
      if (Math.hypot(wrapDeltaPx(this.unit.px, acx), this.unit.py - acy) / TILE <= ARTIFACT_TRIGGER_R) { this.openArtifact(a); break; }
    }
  },
  openArtifact(a) {
    this.pendingArtifact = a; this.artifactSel = 0; this.mode = 'artifact';
    if (this.logEvent) this.logEvent('АРТЕФАКТ ОТКОПАН');
  },
  _artifactConsume(a) {   // потребить объект — все его тайлы в воздух (noTrigger: не сыпать породу сверху)
    for (let dy = 0; dy < a.h; dy++) for (let dx = 0; dx < a.w; dx++) this.world.setAir(wrapX(a.tx + dx), a.ty + dy, true);
    if (this.world.radSources) this.world.radSources = this.world.radSources.filter((s) => s.artifact !== a);   // извлечён артефакт → гаснет привязанный очаг радиации
  },
  artifactChoose(idx) {
    const a = this.pendingArtifact; if (!a) return;
    if (idx === 0) {                                   // ИЗВЛЕЧЬ ТЕХНОЛОГИЮ (эффект — позже)
      (this.artifactTechs || (this.artifactTechs = [])).push(a.tech.id);
      if (this.logEvent) this.logEvent('ТЕХНОЛОГИЯ ИЗВЛЕЧЕНА: ' + a.tech.name);
    } else if (idx === 1) {                            // ОТДАТЬ ГОРОДУ — ДАННЫЕ
      this.dataCount = (this.dataCount || 0) + 1;
      if (typeof codexGainData === 'function') { const r = codexGainData(ARTIFACT_DATA); if (r && typeof codexPopupShow === 'function') codexPopupShow(r, this._codexAnchor()); }
      if (this.logEvent) this.logEvent('ДАННЫЕ АРТЕФАКТА ПЕРЕДАНЫ ГОРОДУ');
    } else {                                           // ПЕРЕРАБОТАТЬ — РЕСУРСЫ (дроп лутом из центра)
      const keys = Object.keys(RESOURCE_DEFS), cx = a.tx + a.w / 2, cy = a.ty + a.h / 2;
      if (this.loot) for (let i = 0; i < ARTIFACT_SCRAP; i++) this.loot.spawn(wrapX(Math.round(cx + (Math.random() * 2 - 1))), Math.max(0, Math.round(cy + (Math.random() * 2 - 1))), keys[Math.floor(Math.random() * keys.length)]);
      if (this.logEvent) this.logEvent('АРТЕФАКТ ПЕРЕРАБОТАН В РЕСУРС');
    }
    a.resolved = true; this._artifactConsume(a);
    this.pendingArtifact = null; this.mode = 'playing';
  },
  // ЛКМ по карте выбора (rect'ы кладёт рендер в game._artifactRects).
  artifactClick(x, y) {
    const r = this._artifactRects; if (!r) return;
    for (let i = 0; i < r.length; i++) if (x >= r[i].x && x <= r[i].x + r[i].w && y >= r[i].y && y <= r[i].y + r[i].h) { this.artifactChoose(i); return; }
  },
});
