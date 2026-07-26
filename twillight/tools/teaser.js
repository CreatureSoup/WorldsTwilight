'use strict';

// ════════════════════════ ТИЗЕР-ДИРЕКТОР (window.Teaser) — DEV, убрать перед релизом ════════════════════════
// Делает рекламные ролики из РЕАЛЬНЫХ игровых сцен. Каждая сцена (SHOTS[]) сама ЗАСЕВАЕТ свежую породу/мир вокруг
// юнита (анкер → ноги-щупальца, бурение, без падения), сбрасывает модули (бур+сканер) и гоняет ПОЛНЫЙ playing-цикл
// (`stepFull`: ноги/туман/пыль/шлейф/физика/бой) → детерминированный захват в webp-кадры → webm (муксер tools/webm.js).
//
// ── ГЕЙМПЛЕЙ-РОЛИК (canvas → webm, авто из консоли; rAF не нужен) ──
//   Teaser.makeInit({clip:'main'|'clip2', w:1920, h:1080, fps:30, q:0.92})  // 'main' — основной рил; 'clip2' — доп-сцены
//   for(;;) Teaser.makeStep(150)  // пока .done; рисует кадры в _tr.frames
//   Teaser.makeMux()              // склейка → window._teaserBlob (+ ВОЗВРАТ сейва, см. ниже)
//   // сохранить: a=createElement('a'); a.href=URL.createObjectURL(_teaserBlob); a.download='x.webm'; a.click()
//   //   → файл падает в ~/Downloads с задержкой (∝ размеру) → перенести в teaser/. webm.js НЕ в авто-лоадере
//   //   index.html — после reload подгрузи tools/webm.js вручную перед makeMux (кадры живут в _tr.frames).
//   КАЧЕСТВО: игра рендерит нативно 2240×1260 → захват в 1920×1080 = крошится (`tctx.imageSmoothingQuality='high'`),
//   НЕ форсить ресайз canvas (буферы тумана/света). Кап radLevel ≤0.7 (0.85+ = белый шум).
//
// ── ЖИВАЯ ЗАПИСЬ DOM-ЭКРАНОВ (мета/диск — НЕ ловятся canvas: foreignObject таинтит) — юзер снимает экран ──
//   Хоткеи (index.html): Shift+M — мета (настоящая СЕТЬ ПАМЯТИ, зум-аут/разрастание), Shift+J — диск данных
//   (настоящая мандала codex, заполняется сектор-за-сектором), Shift+X — стоп. Окно В ФОКУСЕ, QuickTime ⌘⇧5.
//   recMeta/recDisk манипулируют game.save В ПАМЯТИ → recStop ВОЗВРАЩАЕТ сейв И НА ДИСКЕ (_restoreSave): игра
//   авто-сохраняется, поэтому любую правку save надо откатывать, иначе тестовое значение персистнётся (мета/анлоки).
//
// СЦЕНЫ: main = build·descent·data·impulse·screw·radar·combat·jets·shield·win·title; clip2 = radglitch·cable·caveruins;
// clip3 «ОБНОВЛЕНИЕ» (~29.5с) = swarm·lurker·blight·siege·hackcity·firewall·courier·drones·relics·title2 — у сцен
// clip3 есть `cap` (заголовок-плашка поверх кадра, `_drawCap`). Запись: Teaser.makeInit({clip:'clip3',...}) как обычно.
// Добавить сцену = запись в SHOTS/CLIP2/CLIP3 ({name,dur,cap?,setup(g),input(g,lt),cam(g),tick(g,dt,lt),overlay,screen}).
window.Teaser = (function () {
  const G = () => window.game;
  const keyOf = (g, stat) => { const k = g.actionKeys ? g.actionKeys(stat) : []; return k[0]; };
  function resetDrill(g, drill, scanner) { g.inventory.modules.drill = drill || 'drill'; g.inventory.modules.scanner = scanner || 'scanner'; g.unit.setStats(g.inventory.getStats()); if (g._applyArtifacts) g._applyArtifacts(); g.unit.stats.jets = false; }
  function place(g, tx, ty) { g.unit.tileX = tx; g.unit.tileY = ty; g.unit.px = (tx + 0.5) * TILE; g.unit.py = (ty + 0.5) * TILE; g.unit.state = 0; g.unit.flying = false; g.world.setAir(tx, ty, true); }
  function solidify(g, cx, cy, rx, ry) { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { if (y < 0 || y >= MAP_H) continue; const t = g.world.tileAt(x, y); if (!t || t.server || t.artifact || t.robot || t.mine) continue; t.type = ROCK; t.hardness = g.world.hardnessForY ? g.world.hardnessForY(y) : 1; t.dig = 0; t.dug = false; t.unstable = false; t.boulder = false; } }
  function placeRock(g, tx, ty) { solidify(g, tx, ty, 9, 9); place(g, tx, ty); }   // юнит в СВЕЖЕЙ породе → анкер, ноги, бурит, не падает

  function stepFull(g, dt) {
    g.unit.hp = g.unit.stats.maxHp;
    g.updatePrint && g.updatePrint(dt); g.updateImpulse && g.updateImpulse(dt); g.updateBorers && g.updateBorers(dt); g.updateHack && g.updateHack(dt); g.updateSiege && g.updateSiege(dt); g.updateStealth && g.updateStealth(dt); g.updateJam && g.updateJam(dt); g.updateJets && g.updateJets(dt);
    g.unit.update(dt, g.input, g.world);
    if (typeof updateTentacles === 'function') updateTentacles(dt, g.unit, g.world);   // ← НОГИ-ЩУПАЛЬЦА (нужен debugTentacles=true + этот вызов каждый кадр)
    if (typeof updateRingAim === 'function' && UNIT_DEFS[g.unit.hull] && UNIT_DEFS[g.unit.hull].kind === 'ring') updateRingAim(dt, g.unit);
    if (g.unit.dug) { g.loot.spawn(wrapX(g.unit.dug.x), g.unit.dug.y, g.unit.dug.type); g.unit.dug = null; }
    if (g.unit.broke) { g.dugTiles++; g.unit.broke = false; }
    g.updateServers && g.updateServers(dt); g.updateEnemyScan && g.updateEnemyScan(dt); g.updateScanners && g.updateScanners(dt); g.updateHazards && g.updateHazards(dt);
    g.falling.update(dt, g.world, g.unit);
    g.checkDiscoveries && g.checkDiscoveries(dt); g.updateBackdrops && g.updateBackdrops(dt);
    g.loot.update(dt, g.world, g.unit, g.inventory, (g.unit.stats && g.unit.stats.lootMagnet) || 0);
    g.fx.update(dt); g.camera.follow(g.unit, dt);
    g.dust.drill(dt, g.unit); if (g.borers) for (const b of g.borers) g.dust.borerDrill(dt, b); g.dust.ambient(dt, g.world, g.camera); g.dust.update(dt);
    g.world.reveal(g.unit.tileX, g.unit.tileY, Math.max(1, Math.round(g.unit.stats.scanR || SCANNER_R)));
    g._cableUpdate && g._cableUpdate();
    g.city.update(dt, g.atBase(), false, !!(g.cable && g.cable.powered));
    g.cycle.update(dt); g.updateEnemies(dt); g.updateWilds && g.updateWilds(dt); g._combatDrillTick && g._combatDrillTick(dt); g.structures.update(dt, g); g.updateCouriers && g.updateCouriers(dt);
    // системы КЛИПА 3 (реликты-активки/дроны/скверна/турели города/файрволл/удар-искры) — guarded, старым клипам не мешают
    g.updateArtifactsActive && g.updateArtifactsActive(dt); g.updateDash && g.updateDash(dt); g.updateHarpoon && g.updateHarpoon(dt); g.updateDrillOverdrive && g.updateDrillOverdrive(dt); g.updateXray && g.updateXray(dt);
    g.updateDrones && g.updateDrones(dt); g.updateBlight && g.updateBlight(dt); g._updateCityTurrets && g._updateCityTurrets(dt);
    if (g.firewall) { const hk = g.enemies.reduce((n, e) => n + (e.hacking ? 1 : 0), 0); g.firewall.update(dt, hk, typeof metaHas === 'function' && metaHas('amb_fw')); }
    g._hitFxPass && g._hitFxPass(dt);
  }

  // ── порядок «разрастания» меты (BFS от ядра) для ЖИВОЙ записи экрана ──
  const byId = (id) => META_NODES.find(n => n.id === id);
  function bfsOrder() { const adj = {}; for (const e of META_EDGES) { (adj[e[0]] = adj[e[0]] || []).push(e[1]); (adj[e[1]] = adj[e[1]] || []).push(e[0]); } const out = [], seen = new Set(), q = ['core']; while (q.length) { const id = q.shift(); if (seen.has(id) || !byId(id)) continue; seen.add(id); out.push(id); for (const k of (adj[id] || [])) if (!seen.has(k)) q.push(k); } return out; }

  // ══ ЖИВАЯ ЗАПИСЬ DOM-ОВЕРЛЕЕВ (мета/диск) ══ canvas НЕ может их захватить (foreignObject таинтит) → «второй
  // проход» под запись экрана QuickTime'ом: настоящий мета-экран и настоящая мандала диска (codex_dom). Сейв НЕ
  // трогаем (мета — снимок/восстановление в памяти; диск — синтетический r, без codexGainData/persist).
  let _recRAF = 0, _recSnap = null, _playSnap = null;
  const _ease = p => 1 - Math.pow(1 - p, 3);
  // защита сейва: вернуть meta/metaUnlocks к снимку И НА ДИСКЕ (авто-сейв игры мог записать тестовую правку)
  function _restoreSave(g, meta, unlocks) { g.save.meta = meta; g.save.metaUnlocks = unlocks; try { const K = 'twilight-of-the-world.save', raw = JSON.parse(localStorage.getItem(K) || '{}'); raw.meta = meta; raw.metaUnlocks = unlocks; localStorage.setItem(K, JSON.stringify(raw)); } catch (e) {} }
  function _recHint(txt) { let h = document.getElementById('_recHint'); if (!txt) { if (h) h.remove(); return; } if (!h) { h = document.createElement('div'); h.id = '_recHint'; h.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:100000;font-family:monospace;font-size:12px;letter-spacing:.16em;color:#9aa;background:rgba(8,6,10,.72);padding:6px 12px;border:1px solid #443;pointer-events:none'; document.body.appendChild(h); } h.textContent = txt; }
  function _snap(g) { if (!_recSnap) _recSnap = { unlocks: Object.assign({}, g.save.metaUnlocks), meta: g.save.meta }; }

  function recMeta(dur) {            // мета: зум-ин на ядро → плавный зум-аут с прогрессивным зажиганием узлов
    recStop(); dur = dur || 6.5;
    const g = G(); _snap(g);
    const order = bfsOrder();
    g.save.meta = 240; g.mode = 'progress'; g.save.metaUnlocks = { core: 1 };
    metaDomShow(g);
    const vp = _mt.vp, W = vp.clientWidth, H = vp.clientHeight, core = byId('core') || META_NODES[0];
    const sFit = Math.min(W / (META_CW * 0.62), H / (META_CH * 0.62), 1) * 0.62, sIn = Math.min(1.2, sFit * 3.4);
    const view = (s, wx, wy) => { _mtView = { s, tx: W / 2 - wx * s, ty: H / 2 - wy * s }; _mtApplyView(); };
    let lastN = -1; const t0 = performance.now();
    _recHint('● МЕТА · снимай экран · Shift+X — стоп');
    (function frame() {
      const t = (performance.now() - t0) / 1000, p = Math.min(1, t / dur), e = _ease(p);
      const n = Math.max(1, Math.round(e * order.length));
      if (n !== lastN) { lastN = n; const u = {}; for (let i = 0; i < n; i++) u[order[i]] = 1; g.save.metaUnlocks = u; mtRender(); }
      view(sIn + (sFit - sIn) * e, core.x + (META_CW / 2 - core.x) * e, core.y + (META_CH / 2 - core.y) * e);
      _recRAF = p < 1 ? requestAnimationFrame(frame) : 0;
    })();
  }

  function recDisk(dur) {            // диск: настоящая мандала codex_dom, ЗАПОЛНЯЕТСЯ СЕКТОР-ЗА-СЕКТОРОМ (cxSeqFracs)
    recStop(); dur = dur || 5;       // БЕЗ интро-скан-кольца/«100»/одиночного сектора — только диск + % снизу
    const g = G(); _snap(g);
    try { hold('data', 1); } catch (e) {}    // фон — настоящая сцена извлечения, один кадр
    g.mode = 'playing';
    let veil = document.getElementById('_recVeil');   // затемняющая вуаль → диск в фокусе, HUD сцены приглушён
    if (!veil) { veil = document.createElement('div'); veil.id = '_recVeil'; document.body.appendChild(veil); }
    veil.style.cssText = 'position:fixed;inset:0;z-index:99996;background:radial-gradient(ellipse at 50% 50%,rgba(6,4,9,0.6),rgba(6,4,9,0.88));pointer-events:none';
    const frags = [4, 3, 6, 2, 5, 3, 6, 2, 4, 5];   // целевой диск (frag=max) → заполняется до 100% по очереди
    const codex = { name: '', sub: '', sectors: frags.map((m, j) => ({ id: j, max: m, frag: m, density: (0.3 + ((j * 37) % 70) / 100).toFixed(2) })) };
    const totalMax = frags.reduce((a, b) => a + b, 0);
    const sz = Math.round(Math.min(innerWidth, innerHeight) * 0.46);
    let el = document.getElementById('_recDisk');
    if (!el) { el = document.createElement('div'); el.id = '_recDisk'; document.body.appendChild(el); }
    el.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:${sz}px;height:${sz}px;z-index:99998;pointer-events:none`;
    el.innerHTML = `<div id="_recDiscSvg" style="position:absolute;inset:0"></div><div id="_recDiscCap" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:${Math.round(sz * 0.05)}px;white-space:nowrap;text-align:center"></div>`;
    const svgWrap = el.querySelector('#_recDiscSvg'), cap = el.querySelector('#_recDiscCap');
    _recHint('● ДИСК ДАННЫХ · снимай экран · Shift+X — стоп');
    const t0 = performance.now();
    (function frame() {
      const p = Math.min(1, (performance.now() - t0) / 1000 / dur);
      const sq = (typeof cxSeqFracs === 'function') ? cxSeqFracs(codex, p) : { fr: codex.sectors.map(() => p), frag: totalMax * p };
      svgWrap.innerHTML = cxMandala(codex, 0, false, null, false, true, 120, { segFrac: sq.fr });
      const pct = Math.round(sq.frag / totalMax * 100);
      cap.innerHTML = `<span style="font-family:'JetBrains Mono',monospace;font-weight:800;font-size:${Math.round(sz * 0.12)}px;color:#eef0ea;letter-spacing:-1px">${pct}<span style="font-size:${Math.round(sz * 0.06)}px;color:#d4a042">%</span></span>`;
      _recRAF = p < 1 ? requestAnimationFrame(frame) : 0;
    })();
  }

  function recStop() {               // восстановить сейв и вернуть меню
    if (_recRAF) { cancelAnimationFrame(_recRAF); _recRAF = 0; }
    _recHint(null);
    const rd = document.getElementById('_recDisk'); if (rd) rd.remove();
    const vl = document.getElementById('_recVeil'); if (vl) vl.remove();
    const cp = document.getElementById('codexPopup'); if (cp) { cp.classList.remove('show'); cp.innerHTML = ''; }
    const g = G();
    if (_playSnap) { try { g.save = JSON.parse(_playSnap); if (typeof writeSave === 'function') writeSave(g.save); if (typeof metaBindSave === 'function') metaBindSave(g.save); } catch (e) {} _playSnap = null; }   // воспроизведение — ПОЛНЫЙ откат сейва (doInventoryStart бампает runs)
    if (_recSnap) { _restoreSave(g, _recSnap.meta, _recSnap.unlocks); _recSnap = null; }
    if (typeof metaDomHide === 'function') metaDomHide();
    g.mode = 'menu'; g._hidden = false; g._rafPending = false; g._schedule && g._schedule();
  }

  // ЖИВОЕ воспроизведение геймплей-рила ПРЯМО НА КАНВАСЕ (для экранной съёмки, как DOM-recMeta/recDisk) — свой rAF в
  // real-time (dt = фактический межкадровый), штатный цикл на паузе (`_hidden`). Клавиша Shift+U (index.html). Стоп — Shift+X
  // (`recStop` ловит `_playSnap` → полный откат сейва). Не мешает оффлайн-рендеру (makeInit/makeStep/makeMux) — отдельный путь.
  function playClip(clip) {
    recStop(); const g = G(); const list = CLIPS[clip] || SHOTS, total = list.reduce((a, s) => a + s.dur, 0);
    _playSnap = JSON.stringify(g.save);
    g.doInventoryStart(); g.mode = 'playing'; g.unit.reactorOn = true; g.enemies = []; g.radLevel = 0; g.debugTentacles = true; g._hidden = true; g._rafPending = true;
    let curShot = -1, last = performance.now(); const t0 = last;
    _recHint('▶ ВОСПРОИЗВЕДЕНИЕ · снимай экран · Shift+X — стоп');
    (function frame() {
      const now = performance.now(), t = (now - t0) / 1000; let dt = (now - last) / 1000; last = now; if (dt > 0.05) dt = 0.05;
      if (t >= total) { recStop(); return; }                       // рил доигран → откат сейва + меню
      const s = shotAt(t, list), shot = list[s.i];
      if (s.i !== curShot) { curShot = s.i; g._tPrev = new Set(); if (shot.setup) try { shot.setup(g); } catch (e) { console.warn('setup', shot.name, e); } }
      renderShotFrame(g, shot, s.lt, dt);
      _recRAF = requestAnimationFrame(frame);
    })();
  }

  const SHOTS = [
    { name: 'build', dur: 3, screen(g) { g.mode = 'inventory'; if (typeof drawInventory === 'function') drawInventory(g.ctx, g.inventory, g.designW, g.designH); } },
    { name: 'descent', dur: 4.5, setup(g) { resetDrill(g, 'drill', 'scanner'); g.unit.stats.digMult = 3.2; g.enemies = []; placeRock(g, 72, 90); }, input(g, lt) { return new Set(lt < 2 ? ['KeyD'] : lt < 3.3 ? ['KeyS'] : ['KeyD']); } },
    { name: 'data', dur: 4, setup(g) { resetDrill(g, 'drill', 'scanner'); g.enemies = []; placeRock(g, 40, 95); const tx = 42, ty = 95; g.world.setAir(tx, ty, true); g.world.setAir(tx + 1, ty, true); let sv = (g.world.servers && g.world.servers[0]); if (!sv) { sv = {}; (g.world.servers = g.world.servers || []).push(sv); } sv.tx = tx; sv.ty = ty; sv.dug = true; sv.done = false; sv.data = 0; const t = g.world.tileAt(tx, ty); if (t) { t.server = sv; t.type = AIR; t.dug = true; } g.world.reveal(40, 95, 5); }, input() { return new Set(); } },   // настоящий скан-луч извлечения; DOM-диск юзер пишет живьём отдельно
    { name: 'impulse', dur: 3.5, setup(g) { resetDrill(g, 'drill_impulse'); g.enemies = []; placeRock(g, 95, 95); }, input(g, lt) { const f = lt % 1.5; return new Set(f < 1 ? [KEY_PRIMARY] : []); } },
    { name: 'screw', dur: 4.5, setup(g) { resetDrill(g, 'drill_screw'); g.enemies = []; g.borers = []; placeRock(g, 115, 95); g.unit.faceX = 1; }, input(g, lt) { return new Set(lt > 0.25 && lt < 0.32 ? [KEY_PRIMARY] : []); } },
    { name: 'radar', dur: 3, setup(g) { resetDrill(g, 'drill', 'scanner_radar'); g.enemies = []; placeRock(g, 20, 100); g._k = keyOf(g, 'radar'); }, input(g, lt) { const f = lt % 1.5; return new Set(f < 0.06 && g._k ? [g._k] : []); } },
    { name: 'combat', dur: 4.5, setup(g) { resetDrill(g, 'drill'); const bx = PRINTER.x, by = CAVE_FLOOR_Y - 1; place(g, bx, by); try { g.structures.clear(); g.structures.add('turret_mg', bx - 3, by, 'floor').state = 'active'; g.structures.add('turret_rail', bx + 4, by, 'floor').state = 'active'; } catch (e) {} g.enemies = []; try { for (let i = 0; i < 5; i++) { const ex = bx - 6 + i * 3, ey = CAVE_FLOOR_Y - 8; g.enemies.push(new Enemy(ex, ey, i % 2 ? 'sniper' : 'hunter', ex, ey, 4)); } } catch (e) {} }, input() { return new Set(); }, cam(g) { return [(PRINTER.x + 0.5) * TILE, (CAVE_FLOOR_Y - 3) * TILE]; } },
    { name: 'jets', dur: 3.5, setup(g) { resetDrill(g, 'drill'); g.unit.stats.jets = true; const TX = 72, TY = 110; solidify(g, TX, TY, 16, 18); for (let d = 0; d <= 22; d++) g.world.setAir(TX, TY - d, true); for (let d = -3; d <= 3; d++) g.world.setAir(TX + d, TY - 22, true); place(g, TX, TY); g.jets = { fuel: JETS_FUEL_MAX, cd: 0, on: false }; g._jk = keyOf(g, 'jets'); }, input(g) { return new Set([g._jk, 'KeyW']); } },   // анкер внизу шахты → летит ВВЕРХ (не падает)
    { name: 'shield', dur: 4, setup(g) { resetDrill(g, 'drill'); g.city.shieldMax = CITY_SHIELD_HP; g.city.shield = CITY_SHIELD_HP; const bx = PRINTER.x, by = CAVE_FLOOR_Y - 1; place(g, bx, by); try { g.structures.clear(); g.structures.add('turret_mg', bx - 3, by, 'floor').state = 'active'; } catch (e) {} g.enemies = []; try { for (let i = 0; i < 5; i++) { const ex = bx - 6 + i * 3, ey = CAVE_FLOOR_Y - 8; g.enemies.push(new Enemy(ex, ey, i % 2 ? 'sniper' : 'hunter', ex, ey, 4)); } } catch (e) {} g._shT = 0; }, input() { return new Set(); }, cam(g) { return [(PRINTER.x + 0.5) * TILE, (CAVE_FLOOR_Y - 3) * TILE]; }, tick(g, dt) { g._shT = (g._shT || 0) + dt; if (g._shT > 0.55) { g._shT = 0; g.city.damage(16); } } },
    { name: 'win', dur: 4.5, setup(g) { resetDrill(g, 'drill'); const c = (g.world.caverns && g.world.caverns[0]); const cx = c ? c.cx : PRINTER.x, fy = c ? (c.floorY != null ? c.floorY : CAVE_FLOOR_Y) : CAVE_FLOOR_Y; g.enemies = []; place(g, cx + 7, fy - 1); g.world.reveal(cx, fy, 22); g._winCut = { city: { cx: cx, floorY: fy }, t: 0 }; g._winCx = cx; g._winFy = fy; }, input() { return new Set(); }, cam(g) { return [(g._winCx + 3.5) * TILE, (g._winFy - 3) * TILE]; }, tick(g, dt) { g._winCut.t += dt; }, overlay(g) { if (typeof drawWinCutscene === 'function') drawWinCutscene(g.ctx, g, g.camera, g.designW, g.designH); } },
    { name: 'title', dur: 3.5, screen(g) { const ctx = g.ctx, W = g.designW, H = g.designH; ctx.fillStyle = '#060409'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#f2f0ea'; ctx.font = `800 ${Math.round(H * 0.13)}px ${FONT_DISPLAY}`; ctx.fillText('СУМЕРКИ МИРА', W / 2, H * 0.47); ctx.fillStyle = '#d4a042'; ctx.font = `600 ${Math.round(H * 0.034)}px ${FONT_MONO}`; ctx.fillText('EXPLORE · UPGRADE · FIND THE TRUTH', W / 2, H * 0.57); } },
  ];

  // ═══ КЛИП 2: радиационные помехи · энергошлейф · пробой в пещеру-руины (робот на фоне) ═══
  const CLIP2 = [
    { name: 'radglitch', dur: 5,            // юнит идёт по коридору, экран всё сильнее в помехах радиации
      setup(g) {
        resetDrill(g, 'drill', 'scanner'); g.enemies = []; g.radLevel = 0;
        const ty = 92, x0 = 50, x1 = x0 + 26;
        solidify(g, (x0 + x1) >> 1, ty, 17, 7);
        for (let x = x0; x <= x1; x++) { g.world.setAir(x, ty, true); g.world.setAir(x, ty - 1, true); }
        place(g, x0, ty); g.unit.faceX = 1; g.world.reveal(x0, ty, 8);
      },
      input() { return new Set(['KeyD']); },
      tick(g, dt, lt) { g.radLevel = Math.min(0.7, lt * 0.145); }   // 0→0.7 за ~5с: сильные помехи, но сцена ещё читаема (0.85+ = белый шум); stepFull radLevel НЕ трогает
    },
    { name: 'cable', dur: 5.5,              // юнит уходит от розетки, физический энергошлейф вытравливается следом
      setup(g) {
        resetDrill(g, 'drill', 'scanner'); g.enemies = []; g.radLevel = 0;
        g.save.metaUnlocks = Object.assign({}, g.save.metaUnlocks, { print_cable: 1 });   // гейт видимости кабеля
        g.upgrades.cableLen = () => 34;                                                    // длинный шлейф на весь тоннель
        const rx = 52, ry = 98, x1 = rx + 26;
        g._cableRootTile = () => ({ x: rx, y: ry });                                       // корень = старт тоннеля (не база)
        solidify(g, (rx + x1) >> 1, ry, 18, 7);
        for (let x = rx; x <= x1; x++) { g.world.setAir(x, ry, true); g.world.setAir(x, ry - 1, true); }
        place(g, rx, ry); g.unit.faceX = 1;
        g.cable = null; g._cableUpdate && g._cableUpdate(); g.world.reveal(rx, ry, 9);
      },
      input() { return new Set(['KeyD']); },
      cam(g) { return [g.unit.px - 150, g.unit.py + 6]; }                                  // юнит правее центра → шлейф тянется слева
    },
    { name: 'caveruins', dur: 5,            // пробой в пещеру: гигантские руины-робот проявляются сканом
      setup(g) {
        resetDrill(g, 'drill', 'scanner'); g.enemies = []; g.radLevel = 0;
        const b = (g.world.backdrops || []).find(x => x.kind === 'machine') || (g.world.backdrops || [])[0];
        g._cr = b; if (!b) return;
        for (let y = b.cy - b.ry - 2; y <= b.floorY - 1; y++) for (let x = b.cx - b.rx - 2; x <= b.cx + b.rx + 2; x++) { const dxx = (x - b.cx) / (b.rx + 2), dyy = (y - b.cy) / (b.ry + 1.6); if (dxx * dxx + dyy * dyy <= 1) g.world.setAir(x, y, true); }
        for (let x = b.cx - b.rx - 7; x <= b.cx - b.rx; x++) g.world.setAir(x, b.floorY - 1, true);   // подводящий тоннель слева
        g.world.reveal(b.cx, b.cy, 19);
        place(g, b.cx - b.rx - 2, b.floorY - 1); g.unit.faceX = 1;
        b.scanned = false; b.scanning = false; b.reveal = 0;
      },
      input(g, lt) { return new Set(lt < 1.4 ? ['KeyD'] : []); },                          // входит в чертог, потом замирает
      tick(g, dt, lt) { const b = g._cr; if (b) { b.scanning = false; b.scanned = false; b.reveal = Math.max(0, Math.min(1, (lt - 0.7) / 3)); } },   // ручной проявляющий свип (перебивает авто-скан)
      cam(g) { const b = g._cr; return b ? [(b.cx + 0.5) * TILE, (b.cy + 0.8) * TILE] : [g.unit.px, g.unit.py]; }
    },
  ];
  // ═══ КЛИП 3 «ОБНОВЛЕНИЕ» (~29.5с, cap-заголовки поверх сцен): новые враги · скверна · осада · взлом города ·
  // файрволл+турели города · курьер · дроны · реликты · титр. Каждая сцена сама чистит враги/radLevel/слоты.
  const CLIP3 = [
    { name: 'swarm', dur: 3, cap: 'РОЙ МОШКАРЫ · ПОДРЫВ-ЗАРЯД',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; placeRock(g, 60, 96); g.unit.faceX = 1;
        g.artifactSlots = { city: [], unit: ['blast_charge'], drone: [] }; g._applyArtifacts && g._applyArtifacts();   // реликт-активка: AoE-взрыв
        for (let x = 61; x <= 70; x++) for (let y = 91; y <= 99; y++) g.world.setAir(x, y, true);   // карман роя справа
        for (const [ex, ey] of [[62, 95], [63, 97], [62, 98], [63, 93], [64, 96], [62, 93], [64, 98], [63, 95], [64, 93]]) { const e = new Enemy(ex, ey, 'swarm_midge', ex, ey, 6); e.scanned = true; g.enemies.push(e); }   // тесное кольцо (к подрыву все в эпицентре); scanned → без скан-попапов
        g._bk = keyOf(g, 'blastCharge'); g.blastCharge = { cd: 0 }; g.world.reveal(65, 95, 10);   // cd=0: заряд готов сразу (иначе стартовый кулдаун съедает сцену)
      },
      input(g, lt) { return new Set(lt >= 1.9 && lt < 2.04 && g._bk ? [g._bk] : []); } },   // рой стянулся вплотную → ПОДРЫВ (воронка + снос роя)
    { name: 'lurker', dur: 2.5, cap: 'ЗАЛЕЖЕНЬ · ЗАСАДА В ПОРОДЕ',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; placeRock(g, 80, 100); g.unit.faceX = 1;
        for (let x = 81; x <= 84; x++) g.world.setAir(x, 100, true);                                // ход к засаде
        const e = new Enemy(85, 100, 'lurker', 85, 100, 4); e.lurkState = 'buried'; e.draining = true; e.lurkOX = 85; e.lurkOY = 100; e.scanned = true; g.enemies.push(e);
        g.world.reveal(82, 100, 7);
      },
      input() { return new Set(['KeyD']); } },
    { name: 'blight', dur: 3, cap: 'СКВЕРНОСЕЙ · МАЯКИ ПОМЕХ',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0;
        const ty = 94, x0 = 50, x1 = 72; solidify(g, 61, ty, 14, 6);
        for (let x = x0; x <= x1; x++) { g.world.setAir(x, ty, true); g.world.setAir(x, ty - 1, true); }
        place(g, x0, ty); g.unit.faceX = 1;
        g.blightBeacons = []; g._rs0 = g.world.radSources ? g.world.radSources.slice() : null;      // снимок очагов → вернёт scene siege
        const mk = (bx) => { const src = { x: bx, y: ty, r: BLIGHT_BEACON_R, cap: BLIGHT_BEACON_CAP }; (g.world.radSources = g.world.radSources || []).push(src); g.blightBeacons.push({ x: bx, y: ty, px: bx * TILE + TILE / 2, py: ty * TILE + TILE / 2, hp: BLIGHT_BEACON_HP, maxHp: BLIGHT_BEACON_HP, src, hit: 0, t: 0, dead: false }); };
        mk(58); mk(64);
        const e = new Enemy(68, ty, 'blight_sower', 68, ty, 6); e.sowT = 1.0; e.scanned = true; g.enemies.push(e);   // сеятель уронит ещё один в кадре
        g.world.reveal(x0 + 8, ty, 10);
      },
      input(g, lt) { return new Set(lt < 2.2 ? ['KeyD'] : []); },
      tick(g, dt, lt) { g.radLevel = Math.min(0.38, lt * 0.16); } },   // помехи растут, но маяки/сеятель остаются читаемы
    { name: 'siege', dur: 3, cap: 'ОСАДНАЯ БАШНЯ',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; if (g._rs0) { g.world.radSources = g._rs0; g._rs0 = null; }
        const w = (g.world.wilds || [])[0]; g._sg = w; if (!w) return;
        if (w.hp == null || w.hp <= 0) { w.hp = WILD_HP; w.maxHp = WILD_HP; } w.disabled = false;
        const tx = wrapX(w.cx - 4), ty = w.floorY - 1;
        g.world.setAir(tx, ty, true); g.world.setAir(tx, ty - 1, true);
        g.structures.clear(); const s = g.structures.add('siege_tower', tx, ty, 'floor'); if (s) { s.state = 'active'; s.energy = s.energyMax; s.fireCd = 0.4; }
        place(g, wrapX(tx - 2), ty); g.world.reveal(w.cx, w.cy, Math.max(12, (w.rx || 4) + 8));
      },
      input() { return new Set(); },
      cam(g) { const w = g._sg; return w ? [(w.cx - 1) * TILE, (w.cy + 1) * TILE] : [g.unit.px, g.unit.py]; } },
    { name: 'hackcity', dur: 3.5, cap: 'ВЗЛОМ СПЯЩЕГО ГОРОДА',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0;
        g.inventory.modules.aux = 'mod_hack'; g.unit.setStats(g.inventory.getStats()); g._applyArtifacts && g._applyArtifacts();
        g.save.metaUnlocks = Object.assign({}, g.save.metaUnlocks, { kart_wake: 1 });               // гейт взлома городов (makeMux вернёт сейв)
        const c = (g.world.caverns || [])[0]; g._hc = c; if (!c) return; c.awoken = false;
        place(g, wrapX(c.cx + 1), c.floorY - 1); g.unit.faceX = -1; g.world.reveal(c.cx, c.cy, 14);
        g._hkk = keyOf(g, 'hack');
      },
      input(g) { return new Set(g._hkk ? [g._hkk] : []); },
      tick(g, dt) { const c = g._hc; if (c && !c.awoken && c.hackT > 0) c.hackT = Math.min(1, c.hackT + dt * 0.15); },   // буст канала (аккумулятор — cavern.hackT, 0..1) → пробуждение ~1.9с, дальше выходят дружественные
      cam(g) { const c = g._hc; return c ? [(c.cx + 0.5) * TILE, (c.cy + 1.5) * TILE] : [g.unit.px, g.unit.py]; } },
    { name: 'firewall', dur: 3, cap: 'ФАЙРВОЛЛ · ТУРЕЛИ ГОРОДА',
      setup(g) {
        resetDrill(g, 'drill'); g.radLevel = 0;
        g.save.metaUnlocks = Object.assign({}, g.save.metaUnlocks, { amb_turret: 1, amb_turret2: 1 });   // авто-турели базы
        const bx = PRINTER.x, by = CAVE_FLOOR_Y - 1; place(g, bx - 3, by); g.structures.clear(); g.firewall.reset();
        g.enemies = []; for (let i = 0; i < 3; i++) { const ex = bx - 5 + i * 5, ey = CAVE_FLOOR_Y - 9; const e = new Enemy(ex, ey, 'hacker', ex, ey, 4); e.scanned = true; g.enemies.push(e); }
      },
      input() { return new Set(); },
      tick(g, dt, lt) { g.firewall.hack = Math.max(g.firewall.hack, Math.min(FIREWALL_SEGMENTS * 0.86, lt * 0.8)); },   // гарантированный видимый прогресс виджета
      cam(g) { return [(PRINTER.x + 0.5) * TILE, (CAVE_FLOOR_Y - 4) * TILE]; } },
    { name: 'courier', dur: 3, cap: 'КУРЬЕР-ЛОГИСТИКА',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; g.couriers = [];
        const tx = wrapX(PRINTER.x + 24), ty = CAVE_FLOOR_Y - 3; g._ct = { tx, ty };
        solidify(g, tx, ty + 3, 7, 2);
        for (let x = tx - 3; x <= tx + 3; x++) for (let y = ty - 2; y <= ty; y++) g.world.setAir(x, y, true);
        g.structures.clear(); const s = g.structures.add('courier', tx, ty, 'floor');
        if (s) { s.state = 'active'; s.store = { iron: 3, organic: 2, crystal: 1 }; s.stored = 6; g._launchCourier && g._launchCourier(s); }
        place(g, wrapX(tx - 3), ty); g.world.reveal(tx, ty, 8);
      },
      input() { return new Set(); },
      cam(g) { const c = (g.couriers || [])[0]; return c ? [c.px + 60, c.py + 10] : [((g._ct && g._ct.tx) + 0.5) * TILE, ((g._ct && g._ct.ty) + 0.5) * TILE]; } },
    { name: 'drones', dur: 3, cap: 'ДРОНЫ-КОМПАНЬОНЫ',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; placeRock(g, 100, 92); g.unit.faceX = 1;
        g.save.metaUnlocks = Object.assign({}, g.save.metaUnlocks, { kart_slot_drone: 1 });         // кап дрон-слота 2
        g.artifactSlots = { city: [], unit: [], drone: ['drone_collector', 'drone_scout'] }; g._applyArtifacts && g._applyArtifacts();
        for (let x = 96; x <= 99; x++) g.world.setAir(x, 93, true);
        const RT = ['iron', 'organic', 'crystal', 'iron', 'organic'];
        for (let i = 0; i < RT.length; i++) g.loot.spawn(96 + (i % 4), 93, RT[i]);                  // еда для сборщика
        g.world.reveal(98, 93, 8);
      },
      input() { return new Set(['KeyD']); } },
    { name: 'relics', dur: 3.5, cap: 'РЕЛИКТЫ · ФОРСАЖ И РЕНТГЕН',
      setup(g) {
        resetDrill(g, 'drill'); g.enemies = []; g.radLevel = 0; placeRock(g, 120, 96); g.unit.faceX = 1;
        g.artifactSlots = { city: [], unit: ['drill_overdrive', 'xray'], drone: [] }; g._applyArtifacts && g._applyArtifacts();
        g.unit.stats.digMult = 2.2;                                                                 // форсаж читаем: бур грызёт бодро, нагрев растёт
        g._xk = keyOf(g, 'xray'); g.xray = { cd: 0, t: 0 };                                         // рентген готов сразу (без стартового кулдауна)
      },
      input(g, lt) { const ks = ['KeyD']; if (lt >= 1.5 && lt < 1.64 && g._xk) ks.push(g._xk); return new Set(ks); } },   // копает с разгоном → РЕНТГЕН вскрывает туман вокруг
    { name: 'title2', dur: 2, screen(g) { const ctx = g.ctx, W = g.designW, H = g.designH; ctx.fillStyle = '#060409'; ctx.fillRect(0, 0, W, H); ctx.textAlign = 'center'; ctx.fillStyle = '#f2f0ea'; ctx.font = `800 ${Math.round(H * 0.105)}px ${FONT_DISPLAY}`; ctx.fillText('СУМЕРКИ МИРА', W / 2, H * 0.44); ctx.fillStyle = '#d4a042'; ctx.font = `600 ${Math.round(H * 0.036)}px ${FONT_MONO}`; ctx.fillText('ОБНОВЛЕНИЕ · ВТОРАЯ ВОЛНА', W / 2, H * 0.55); ctx.fillStyle = '#8a8578'; ctx.font = `500 ${Math.round(H * 0.022)}px ${FONT_MONO}`; ctx.fillText('ВЗЛОМ ГОРОДОВ · ДРОНЫ · ЛОГИСТИКА · НОВЫЕ УГРОЗЫ', W / 2, H * 0.63); } },
  ];
  const CLIPS = { main: SHOTS, clip2: CLIP2, clip3: CLIP3 };

  function applyCam(g, shot) { if (shot.cam) { const c = shot.cam(g); g.camera.x = wrapPx(c[0] - g.designW / 2); g.camera.y = Math.max(0, Math.min(MAP_H * TILE - g.designH, c[1] - g.designH / 2)); } }
  // Заголовок сцены (cap) — плашка верх-центр в языке HUD: тёмная плита + золотая рамка + уголки; фейд по краям сцены.
  function _drawCap(g, txt, lt, dur) {
    const ctx = g.ctx, W = g.designW;
    const a = Math.max(0, Math.min(1, lt / 0.3, (dur - lt) / 0.35));
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `600 13px ${FONT_MONO}`;
    const tw = ctx.measureText(txt).width, pw = tw + 36, ph = 26, x = (W - pw) / 2, y = 128;   // ниже капсулы города И виджета файрволла (~110)
    ctx.fillStyle = 'rgba(8,6,10,0.78)'; ctx.fillRect(x, y, pw, ph);
    ctx.strokeStyle = 'rgba(212,160,66,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, pw - 1, ph - 1);
    ctx.strokeStyle = '#d4a042'; ctx.lineWidth = 1.4;                                   // уголки-тики
    const tk = 5; ctx.beginPath();
    ctx.moveTo(x, y + tk); ctx.lineTo(x, y); ctx.lineTo(x + tk, y);
    ctx.moveTo(x + pw - tk, y); ctx.lineTo(x + pw, y); ctx.lineTo(x + pw, y + tk);
    ctx.moveTo(x + pw, y + ph - tk); ctx.lineTo(x + pw, y + ph); ctx.lineTo(x + pw - tk, y + ph);
    ctx.moveTo(x + tk, y + ph); ctx.lineTo(x, y + ph); ctx.lineTo(x, y + ph - tk); ctx.stroke();
    ctx.fillStyle = '#f2c878'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, W / 2, y + ph / 2 + 0.5);
    ctx.restore();
  }
  function renderShotFrame(g, shot, lt, dt) {
    if (shot.screen) { g.ctx.setTransform(g.scale, 0, 0, g.scale, 0, 0); shot.screen(g, lt, shot.dur); return; }
    g.mode = 'playing';
    let keys = new Set(); try { keys = shot.input ? (shot.input(g, lt) || new Set()) : new Set(); } catch (e) {}
    const prev = g._tPrev || new Set(), jp = new Set(); keys.forEach(k => { if (!prev.has(k)) jp.add(k); });
    g.input.keys = keys; g.input.justPressed = jp; g._tPrev = keys;
    stepFull(g, dt);
    if (shot.tick) try { shot.tick(g, dt, lt); } catch (e) {}
    applyCam(g, shot);
    g.ctx.setTransform(g.scale, 0, 0, g.scale, 0, 0); g.drawScene();
    if (shot.overlay) try { shot.overlay(g, lt, shot.dur); } catch (e) {}
    if (shot.cap) try { _drawCap(g, shot.cap, lt, shot.dur); } catch (e) {}
  }
  function shotAt(t, list) { list = list || SHOTS; let acc = 0; for (let i = 0; i < list.length; i++) { if (t < acc + list[i].dur) return { i, lt: t - acc }; acc += list[i].dur; } return { i: list.length - 1, lt: list[list.length - 1].dur - 0.01 }; }

  function makeInit(opts) { opts = opts || {}; const g = G(); g.doInventoryStart(); g.mode = 'playing'; g.unit.reactorOn = true; g.enemies = []; g.radLevel = 0; g.debugTentacles = true; g._hidden = true; g._rafPending = true; const shots = CLIPS[opts.clip] || SHOTS; const fps = opts.fps || 14, tmp = document.createElement('canvas'); tmp.width = opts.w || 854; tmp.height = opts.h || 480; const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = 'high';   // качественный ресэмплинг при даунскейле с нативного 2240×1260 → крошится, а не мылит
    window._tr = { fps, ms: Math.round(1000 / fps), tmp, tctx, q: opts.q || 0.72, f: 0, shots, total: Math.ceil(shots.reduce((a, s) => a + s.dur, 0) * fps), frames: [], curShot: -1, saveSnap: { metaUnlocks: Object.assign({}, g.save.metaUnlocks), meta: g.save.meta } }; return JSON.stringify({ total: window._tr.total, dur: +shots.reduce((a, s) => a + s.dur, 0).toFixed(1), shots: shots.map(s => s.name) }); }
  function makeStep(maxN) { const tr = window._tr, g = G(); if (!tr) return '{"err":"init"}'; const list = tr.shots || SHOTS, end = Math.min(tr.total, tr.f + (maxN || 80)); for (; tr.f < end; tr.f++) { const t = tr.f / tr.fps, s = shotAt(t, list), shot = list[s.i]; if (s.i !== tr.curShot) { tr.curShot = s.i; g._tPrev = new Set(); if (shot.setup) { try { shot.setup(g); } catch (e) { console.warn('setup', shot.name, e); } } } renderShotFrame(g, shot, s.lt, 1 / tr.fps); const fl = Math.max(s.lt < 0.15 ? (1 - s.lt / 0.15) * 0.55 : 0, (shot.dur - s.lt) < 0.15 ? (1 - (shot.dur - s.lt) / 0.15) * 0.55 : 0); if (fl > 0) { const c = g.ctx, cv = c.canvas; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(220,242,255,' + fl + ')'; c.fillRect(0, 0, cv.width, cv.height); c.globalCompositeOperation = 'source-over'; } tr.tctx.drawImage(g.ctx.canvas, 0, 0, tr.tmp.width, tr.tmp.height); tr.frames.push({ image: tr.tmp.toDataURL('image/webp', tr.q), duration: tr.ms }); } return JSON.stringify({ rendered: tr.f, total: tr.total, done: tr.f >= tr.total }); }
  function makeMux() { const tr = window._tr, g = G(); if (!tr || !tr.frames.length) return '{"err":"noframes"}'; g._hidden = false; g._rafPending = false; g.mode = 'menu'; if (tr.saveSnap) _restoreSave(g, tr.saveSnap.meta, tr.saveSnap.metaUnlocks);   /* вернуть сейв И на диске (cable ставил print_cable) */ g._schedule && g._schedule(); const blob = window.WebM.fromImages(tr.frames); window._teaserBlob = blob; return JSON.stringify({ bytes: blob.size, frames: tr.frames.length }); }
  function hold(name, frames) { const g = G(); g.doInventoryStart(); g.mode = 'playing'; g.unit.reactorOn = true; g.enemies = []; g.radLevel = 0; g.debugTentacles = true; g._hidden = true; g._rafPending = true; const shot = SHOTS.find(s => s.name === name) || CLIP2.find(s => s.name === name) || CLIP3.find(s => s.name === name); if (!shot) return 'no shot'; g._tPrev = new Set(); if (shot.setup) shot.setup(g); const N = frames || 120; for (let i = 0; i < N; i++) renderShotFrame(g, shot, i / 30, 1 / 30); return JSON.stringify({ shot: name, tile: [g.unit.tileX, g.unit.tileY] }); }

  return { SHOTS, stepFull, makeInit, makeStep, makeMux, hold, recMeta, recDisk, recStop, playClip };
})();
