'use strict';

// СЕТЬ ПАМЯТИ — DOM-оверлей. Вёрстка/логика 1:1 портированы из meta/project/src/tech_web.jsx
// (PCB-сеть: октилинейные медные дорожки-ленты, ромб-чип узлы, 4 состояния, pan/zoom, инфо-карта).
// Данные/граф/состояние — meta.js. Валюта — save.meta, открытия — save.metaUnlocks.

/* ---------- иконки (порт G из tech_web; currentColor наследует цвет узла) ---------- */
const _ti = (inner, s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter">${inner}</svg>`;
const _sun = () => { let l = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; l += `<line x1="${16 + 8 * Math.cos(a)}" y1="${16 + 8 * Math.sin(a)}" x2="${16 + 12 * Math.cos(a)}" y2="${16 + 12 * Math.sin(a)}"/>`; } return l; };
const MICON = {
  core: _ti('<rect x="6" y="6" width="20" height="20"/><circle cx="16" cy="16" r="5"/><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30 M6 6 L9 9 M26 6 L23 9 M6 26 L9 23 M26 26 L23 23"/>', 42),
  wrench: _ti('<path d="M20 6 A6 6 0 1 0 26 12 L21 17 L15 11 Z"/><path d="M15 11 L5 21 L9 25 L19 15"/>', 30),
  drill: _ti('<path d="M16 4 V19 M11 8 L16 4 L21 8 M12 19 L20 19 L18 27 L14 27 Z"/>'),
  slot: _ti('<path d="M16 4 L26 9 V19 L16 28 L6 19 V9 Z"/><path d="M16 13 V19 M13 16 H19"/>'),
  blades: _ti('<path d="M16 4 V19 M11 8 L16 4 L21 8 M12 19 L20 19 L18 27 L14 27 Z"/><path d="M4 12 L8 14 M28 12 L24 14"/>'),
  bomb: _ti('<circle cx="15" cy="19" r="9"/><path d="M21 13 L25 9 M25 9 H22 M25 9 V12"/>'),
  printer: _ti('<path d="M4 22 H28 V14 H4 Z"/><path d="M9 14 V8 H23 V14 M9 22 V28 H23 V22"/>', 30),
  body: _ti('<path d="M16 5 L24 9 V18 L16 28 L8 18 V9 Z"/><path d="M16 12 V18 M13 15 H19"/>'),
  fast: _ti('<path d="M18 4 L8 17 H16 L14 28 L24 13 H16 Z"/>'),
  coin: _ti('<circle cx="16" cy="16" r="11"/><path d="M16 10 V22 M13 13 H18 a2 2 0 0 1 0 4 H13 H18"/>'),
  salvage: _ti('<path d="M6 12 L16 6 L26 12 V22 L16 28 L6 22 Z"/><path d="M11 15 L15 19 L22 12"/>'),
  queue: _ti('<rect x="4" y="7" width="8" height="18"/><rect x="14" y="7" width="6" height="18"/><rect x="22" y="7" width="6" height="18"/>'),
  contact: _ti('<circle cx="9" cy="16" r="4"/><circle cx="23" cy="16" r="4"/><path d="M13 16 H19"/>', 30),
  sun: _ti('<circle cx="16" cy="16" r="5"/>' + _sun()),
  rune: _ti('<path d="M10 4 V28 M10 4 L24 13 M10 16 L22 7 M10 20 L24 28"/>'),
  obsidian: _ti('<polygon points="16,3 26,11 26,22 16,29 6,22 6,11"/>'),
  gift: _ti('<rect x="5" y="13" width="22" height="14"/><path d="M5 13 H27 M16 13 V27 M16 13 C12 5 6 9 16 13 C20 5 26 9 16 13"/>'),
  ally2: _ti('<circle cx="11" cy="13" r="4"/><circle cx="21" cy="13" r="4"/><path d="M5 26 a6 6 0 0 1 12 0 M15 26 a6 6 0 0 1 12 0"/>'),
  map: _ti('<path d="M4 8 L12 6 L20 8 L28 6 V24 L20 26 L12 24 L4 26 Z"/><path d="M12 6 V24 M20 8 V26"/>', 30),
  quiet: _ti('<path d="M16 4 L28 26 H4 Z"/><path d="M16 12 V18 M16 21 V22"/><line x1="6" y1="6" x2="26" y2="26" stroke="var(--blood-bright)"/>'),
  vein: _ti('<polygon points="16,4 22,10 16,16 10,10"/><polygon points="10,16 16,22 10,28 4,22"/><polygon points="22,16 28,22 22,28 16,22"/>'),
  deep: _ti('<path d="M16 3 V22 M9 16 L16 23 L23 16 M5 28 H27"/>'),
  detector: _ti('<circle cx="16" cy="16" r="3"/><path d="M16 16 L27 7"/><circle cx="16" cy="16" r="12" stroke-dasharray="3 3"/>'),
  stab: _ti('<circle cx="16" cy="16" r="10"/><path d="M16 6 V16 L23 20"/>'),
  relic: _ti('<path d="M8 4 H24 V26 H8 Z"/><path d="M12 9 H20 M12 13 H20 M12 17 H17"/>', 30),
  decode: _ti('<circle cx="16" cy="16" r="11"/><path d="M16 16 L16 9 M16 16 L22 19 M16 5 V8 M16 24 V27 M5 16 H8 M24 16 H27"/>'),
  resonance: _ti('<circle cx="16" cy="16" r="3"/><circle cx="16" cy="16" r="8" stroke-dasharray="2 2"/><circle cx="16" cy="16" r="13" stroke-dasharray="1 3"/>'),
  archive: _ti('<rect x="4" y="6" width="24" height="6"/><rect x="6" y="12" width="20" height="16"/><path d="M13 18 H19"/>'),
  ascend: _ti('<path d="M16 3 L27 22 H5 Z"/><path d="M16 11 L21 20 H11 Z"/><path d="M5 27 H27"/>', 36),
};
const _mtLock = '<svg width="22" height="22" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="7" y="14" width="18" height="13"/><path d="M11 14 V10 a5 5 0 0 1 10 0 V14"/><circle cx="16" cy="20" r="1.6" fill="currentColor"/></svg>';
const _mtToken = (s = 24, dim = false) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none"><polygon points="16,3 27,9.5 27,22.5 16,29 5,22.5 5,9.5" fill="${dim ? 'var(--gold-dim)' : 'rgba(212,160,66,0.18)'}" stroke="var(--gold)" stroke-width="1.6"/><rect x="11" y="11" width="10" height="10" fill="none" stroke="var(--gold)" stroke-width="1.4"/><circle cx="16" cy="16" r="2" fill="var(--gold)"/><path d="M16 3 V7 M16 25 V29 M5 9.5 L8.5 11.5 M23.5 11.5 L27 9.5 M5 22.5 L8.5 20.5 M23.5 20.5 L27 22.5" stroke="var(--gold)" stroke-width="1.2"/></svg>`;
const _mtBracket = (c) => `<span style="position:absolute;top:-1px;left:-1px;width:11px;height:11px;border-top:1px solid ${c};border-left:1px solid ${c}"></span><span style="position:absolute;bottom:-1px;right:-1px;width:11px;height:11px;border-bottom:1px solid ${c};border-right:1px solid ${c}"></span>`;

/* ---------- октилинейная разводка дорожек (45°) ---------- */
function _elbow(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, adx = Math.abs(dx), ady = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy); return adx > ady ? [x1 + sx * ady, y2] : [x2, y1 + sy * adx]; }
function _routeOcti(x1, y1, x2, y2) { const [mx, my] = _elbow(x1, y1, x2, y2); return `M ${x1} ${y1} L ${mx} ${my} L ${x2} ${y2}`; }
function _bundle(na, nb, kind) { const dx = nb.x - na.x, dy = nb.y - na.y, len = Math.hypot(dx, dy) || 1, px = -dy / len, py = dx / len; const offs = kind === 'ring' ? [-4.5, 4.5] : [-6.5, 0, 6.5]; return offs.map((o) => _routeOcti(na.x + px * o, na.y + py * o, nb.x + px * o, nb.y + py * o)); }

let _mt = null, _mtGame = null, _mtView = { s: 0.62, tx: 0, ty: 0 }, _mtSel = null, _mtDrag = null;
let _mtHold = null;   // контроллер удержания-покупки выбранного узла ({start,cancel}) — общий для ЛКМ и Пробела
let _mtPending = null;   // id ТОЛЬКО ЧТО купленного узла на время анимации запитывания (граф рисует его ещё «доступным» + surge на ребре; см. _mtUnlock)

function metaDomEnsure() {
  if (_mt) return _mt;
  const root = document.createElement('div'); root.id = 'metaScreen'; root.style.backgroundImage = 'var(--scanlines)'; root.style.background = 'var(--pit)';
  root.innerHTML = `
    <header style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;padding:16px 24px;border-bottom:1px solid var(--bronze);background:linear-gradient(180deg,var(--pit),rgba(13,10,14,0.55));z-index:30">
      <div style="display:flex;align-items:center;gap:14px">
        <button id="mtBack" class="mt-back" title="${STR.meta.ui.backTitle}" aria-label="${STR.meta.ui.backAria}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M13 5 L6 12 L13 19 M6 12 H20"/></svg></button>
        <div>
          <div style="margin-bottom:6px;white-space:nowrap"><span style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase">META · v5</span></div>
          <h1 style="font-family:var(--font-display);font-size:32px;font-weight:800;text-transform:uppercase;letter-spacing:-0.03em;color:var(--chalk);line-height:0.92;margin:0">${STR.meta.ui.titleA} <span style="color:var(--gold)">${STR.meta.ui.titleB}</span></h1>
        </div>
      </div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;display:flex;align-items:center;gap:12px;padding:10px 16px;background:var(--night);border:1px solid var(--gold)">
          ${_mtBracket('var(--gold)')}${_mtToken(30)}
          <div><div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:var(--ash);text-transform:uppercase">${STR.meta.ui.bankLabel}</div>
          <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--gold);line-height:1"><b id="mtTok">0</b><span style="font-size:11px;color:var(--ash);margin-left:4px">${STR.meta.ui.mt}</span></div></div>
        </div>
        <button id="mtReset" style="font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;padding:9px 13px;cursor:pointer;background:transparent;color:var(--blood-bright);border:1px solid var(--blood)">⟲ ${STR.meta.ui.reset}</button>
      </div>
    </header>
    <div style="position:relative;flex:1;display:flex;overflow:hidden">
      <div id="mtVp" class="vp" style="position:relative;flex:1;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,rgba(212,160,66,0.05),transparent 60%),#0b0807;touch-action:none">
        <div id="mtWorld" style="position:absolute;left:0;top:0;width:${META_CW}px;height:${META_CH}px;transform-origin:0 0"></div>
        <div style="position:absolute;right:18px;bottom:18px;display:flex;flex-direction:column;gap:6px;z-index:25">
          <button id="mtZin" style="width:38px;height:38px;font-size:18px;color:var(--gold);background:rgba(13,10,14,0.85);border:1px solid var(--gold-dim);cursor:pointer;line-height:1">+</button>
          <button id="mtZout" style="width:38px;height:38px;font-size:18px;color:var(--gold);background:rgba(13,10,14,0.85);border:1px solid var(--gold-dim);cursor:pointer;line-height:1">−</button>
          <button id="mtFit" style="width:38px;font-size:10px;color:var(--gold);background:rgba(13,10,14,0.85);border:1px solid var(--gold-dim);cursor:pointer;padding:8px 0">FIT</button>
        </div>
        <div style="position:absolute;left:18px;bottom:18px;z-index:25;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(13,10,14,0.85);border:1px solid var(--bronze)">
            <span id="mtProgL" style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:var(--pewter);text-transform:uppercase">${STR.meta.ui.progress(0, META_TOTAL)}</span>
            <div style="width:130px;height:5px;background:var(--earth);border:1px solid var(--bronze)"><div id="mtProgBar" style="height:100%;width:0;background:var(--gold)"></div></div>
          </div>
          <div style="display:flex;gap:14px;padding:7px 12px;background:rgba(13,10,14,0.85);border:1px solid var(--bronze)">
            ${_mtLegend('var(--gold)', STR.meta.ui.legPowered, 'fill')}${_mtLegend('var(--gold)', STR.meta.ui.legAvail)}${_mtLegend('var(--carbon)', STR.meta.ui.legVisible, 'dash')}${_mtLegend('var(--bronze)', STR.meta.ui.legHidden, 'ghost')}
          </div>
        </div>
      </div>
      <aside id="mtCard" style="width:340px;flex-shrink:0;border-left:1px solid var(--bronze);background:linear-gradient(180deg,var(--night),var(--pit));display:flex;flex-direction:column;position:relative;z-index:28;box-shadow:-12px 0 40px -20px rgba(0,0,0,0.8)"></aside>
    </div>
    <div id="mtModal" style="position:absolute;inset:0;z-index:50;display:none;align-items:center;justify-content:center;background:rgba(7,5,10,0.72)">
      <div style="width:380px;max-width:80%;position:relative;background:linear-gradient(180deg,var(--night),var(--pit));border:1px solid var(--blood);padding:26px;box-shadow:0 20px 60px -20px rgba(0,0,0,0.8)">
        ${_mtBracket('var(--blood)')}
        <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:var(--blood-bright);text-transform:uppercase;margin-bottom:10px">${STR.meta.ui.modalTag}</div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:700;text-transform:uppercase;color:var(--chalk);margin-bottom:10px">${STR.meta.ui.modalTitle}</div>
        <p style="font-family:var(--font-body);font-size:13.5px;color:var(--bone);line-height:1.55;margin:0 0 22px">${STR.meta.ui.modalBody}</p>
        <div style="display:flex;gap:12px">
          <button id="mtCancelReset" style="flex:1;padding:12px;font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;background:transparent;color:var(--bone);border:1px solid var(--bronze);cursor:pointer">${STR.meta.ui.cancel}</button>
          <button id="mtDoReset" style="flex:1;padding:12px;font-family:var(--font-mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;background:var(--blood);color:var(--chalk);border:1px solid var(--blood-bright);cursor:pointer">${STR.meta.ui.confirmReset}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  _mt = { root, world: root.querySelector('#mtWorld'), vp: root.querySelector('#mtVp'), tok: root.querySelector('#mtTok'), card: root.querySelector('#mtCard'), progL: root.querySelector('#mtProgL'), progBar: root.querySelector('#mtProgBar') };

  // ввод
  const vp = _mt.vp;
  vp.addEventListener('wheel', (e) => { e.preventDefault(); const r = vp.getBoundingClientRect(); _mtZoom(e.deltaY < 0 ? 1.12 : 0.89, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  vp.addEventListener('pointerdown', (e) => { _mtDrag = { x: e.clientX, y: e.clientY, tx: _mtView.tx, ty: _mtView.ty, moved: false }; vp.classList.add('drag'); });
  vp.addEventListener('pointermove', (e) => { if (!_mtDrag) return; const dx = e.clientX - _mtDrag.x, dy = e.clientY - _mtDrag.y; if (Math.abs(dx) + Math.abs(dy) > 4) _mtDrag.moved = true; _mtView.tx = _mtDrag.tx + dx; _mtView.ty = _mtDrag.ty + dy; _mtApplyView(); });
  const up = () => { vp.classList.remove('drag'); _mtDrag = null; };
  vp.addEventListener('pointerup', up); vp.addEventListener('pointerleave', up);
  vp.addEventListener('click', (e) => {
    if (_mtDrag && _mtDrag.moved) return;
    const nd = e.target.closest && e.target.closest('[data-node]');
    if (nd) { const n = META_BY_ID[nd.getAttribute('data-node')]; if (metaState(_mtGame.save, n) !== 'hidden') { _mtSel = n.id; mtRender(); } }
    else { _mtSel = null; mtRenderCard(); }
  });
  root.querySelector('#mtZin').addEventListener('click', () => { const r = vp.getBoundingClientRect(); _mtZoom(1.2, r.width / 2, r.height / 2); });
  root.querySelector('#mtZout').addEventListener('click', () => { const r = vp.getBoundingClientRect(); _mtZoom(0.83, r.width / 2, r.height / 2); });
  root.querySelector('#mtFit').addEventListener('click', mtFit);
  const modal = root.querySelector('#mtModal');
  root.querySelector('#mtReset').addEventListener('click', () => { modal.style.display = 'flex'; });
  root.querySelector('#mtCancelReset').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });   // клик по фону — закрыть
  root.querySelector('#mtDoReset').addEventListener('click', () => { metaReset(_mtGame.save); _mtSel = null; modal.style.display = 'none'; mtRender(); });
  root.querySelector('#mtBack').addEventListener('click', metaDomBack);
  return _mt;
}

function _mtLegend(c, t, mode) {
  const fill = mode === 'fill', dash = mode === 'dash', ghost = mode === 'ghost';
  return `<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:11px;height:11px;border-radius:50%;border:2px solid ${c};border-style:${dash ? 'dashed' : 'solid'};background:${fill ? c : 'transparent'};opacity:${ghost ? 0.4 : 1}"></span><span style="font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;color:var(--pewter);text-transform:uppercase">${t}</span></span>`;
}

function _mtApplyView() { _mt.world.style.transform = `translate(${_mtView.tx}px,${_mtView.ty}px) scale(${_mtView.s})`; }
function mtFit() { const vp = _mt.vp, W = vp.clientWidth, H = vp.clientHeight; const s = Math.min(W / (META_CW * 0.62), H / (META_CH * 0.62), 1) * 0.62; _mtView = { s, tx: (W - META_CW * s) / 2, ty: (H - META_CH * s) / 2 }; _mtApplyView(); }
function _mtZoom(f, cx, cy) { const ns = Math.max(0.28, Math.min(1.6, _mtView.s * f)), k = ns / _mtView.s; _mtView = { s: ns, tx: cx - (cx - _mtView.tx) * k, ty: cy - (cy - _mtView.ty) * k }; _mtApplyView(); }

/* ---------- рёбра + узлы (svg + div), как в дизайне ---------- */
function _mtWorldHTML(save) {
  const pending = _mtPending, dist = _metaDist(save);
  const own = (id) => metaUnlocked(save, id) && id !== pending;                       // pending рисуем ещё как «доступный»
  const st = (n) => (n.id === pending ? 'avail' : metaState(save, n, dist));
  let svg = `<svg width="${META_CW}" height="${META_CH}" style="position:absolute;inset:0">
    <defs><pattern id="mt-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0 H0 V60" fill="none" stroke="rgba(212,160,66,0.045)" stroke-width="1"/></pattern>
    <filter id="mt-gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <rect width="${META_CW}" height="${META_CH}" fill="url(#mt-grid)"/>`;
  [360, 640, 940].forEach((r) => { svg += `<circle cx="${MX}" cy="${MY}" r="${r}" fill="none" stroke="rgba(122,112,94,0.08)" stroke-width="1" stroke-dasharray="2 8"/>`; });
  let surgeHTML = '';
  for (const litPass of [false, true]) {
    for (const [a, b, kind] of META_EDGES) {
      const na = META_BY_ID[a], nb = META_BY_ID[b], sa = st(na), sb = st(nb);
      if (sa === 'hidden' && sb === 'hidden') continue;
      // SURGE: ребро к ТОЛЬКО ЧТО купленному узлу (другой конец реально запитан) — рисуем ВЕСЬ ПУЧОК запитанного
      // ребра (обводка + все дорожки + glow-центр), но «прорисовывающимся» родитель→узел (.mt-surge), чтобы по
      // завершении он БЕЗ скачка совпал с финальным `on`-ребром (доп-дорожки не «возникают»). См. _mtUnlock.
      const surge = pending && ((a === pending && metaUnlocked(save, b)) || (b === pending && metaUnlocked(save, a)));
      if (surge) {
        if (!litPass) {
          const par = (a === pending) ? nb : na, chi = (a === pending) ? na : nb, sp = _bundle(par, chi, kind), sci = (sp.length - 1) >> 1;
          sp.forEach((d) => { surgeHTML += `<path d="${d}" fill="none" stroke="#0b0807" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="mt-surge"/>`; });
          sp.forEach((d) => { surgeHTML += `<path d="${d}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" pathLength="1" class="mt-surge"/>`; });
          surgeHTML += `<path d="${sp[sci]}" fill="none" stroke="var(--gold)" stroke-width="6" opacity="0.12" filter="url(#mt-gl)" pathLength="1" class="mt-surge"/><path d="${sp[sci]}" fill="none" stroke="var(--gold-bright)" stroke-width="1.6" pathLength="1" class="mt-surge"/>`;
        }
        continue;
      }
      const ownA = own(a), ownB = own(b), on = ownA && ownB; if (on !== litPass) continue;
      const ghost = (sa === 'hidden' || sb === 'hidden');
      const potential = !on && (ownA || ownB) && !ghost;   // ребро-«потенциал»: один конец запитан, второй доступен — ток ещё не пошёл
      const paths = _bundle(na, nb, kind);
      const baseCol = on ? 'var(--gold)' : potential ? 'var(--gold-dim)' : (ghost ? '#1f1a12' : (kind === 'ring' ? '#2a2018' : '#3a302a'));
      const w = on ? 2 : potential ? 1.7 : 1.6, ci = (paths.length - 1) >> 1, [ex, ey] = _elbow(na.x, na.y, nb.x, nb.y);
      svg += `<g opacity="${on ? 1 : potential ? 0.9 : (ghost ? 0.42 : 0.8)}">`;
      if (!potential) paths.forEach((d) => { svg += `<path d="${d}" fill="none" stroke="#0b0807" stroke-width="${w + 3}" stroke-linejoin="round" stroke-linecap="round"/>`; });
      paths.forEach((d) => { svg += `<path d="${d}" fill="none" stroke="${baseCol}" stroke-width="${w}"${potential ? ' class="pcb-flow-slow"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`; });
      if (on) svg += `<path d="${paths[ci]}" fill="none" stroke="var(--gold)" stroke-width="6" opacity="0.12" filter="url(#mt-gl)"/><path d="${paths[ci]}" fill="none" stroke="var(--gold-bright)" stroke-width="1.4" class="pcb-flow"/><rect x="${ex - 2.5}" y="${ey - 2.5}" width="5" height="5" transform="rotate(45 ${ex} ${ey})" fill="#0b0807" stroke="var(--gold)" stroke-width="1"/>`;
      else if (potential) svg += `<rect x="${ex - 2}" y="${ey - 2}" width="4" height="4" transform="rotate(45 ${ex} ${ey})" fill="#0b0807" stroke="var(--gold-dim)" stroke-width="1"/>`;
      svg += `</g>`;
    }
  }
  svg += surgeHTML;   // surge поверх рёбер, под ромбами узлов
  for (const n of META_NODES) { if (st(n) === 'hidden') continue; svg += `<rect x="${n.x - 4.5}" y="${n.y - 4.5}" width="9" height="9" transform="rotate(45 ${n.x} ${n.y})" rx="1.5" fill="#0b0807" stroke="${own(n.id) ? 'var(--gold)' : 'var(--bronze)'}" stroke-width="1.4"/>`; }
  svg += `</svg>`;

  let html = '';
  for (const n of META_NODES) {
    const s = st(n), R = META_RADIUS[n.kind], acc = n.accent;
    const o = s === 'owned', av = s === 'avail', vis = s === 'visible', hid = s === 'hidden';
    const can = av && (save.meta || 0) >= n.cost, sel = _mtSel === n.id;
    const corner = n.kind === 'core' ? '26%' : n.kind === 'cap' ? '15%' : '22%';
    // ЗАПИТАН = ЗАЛИТ (плотное акцент-ядро + glow + яркие пины/иконка); ДОСТУПЕН = ПОЛАЯ РОЗЕТКА
    // (тёмный центр, обводка цвета ветки, но инсет/пины гаснут до карбона, иконка приглушена)
    const borderC = o || av ? acc : vis ? 'var(--carbon)' : 'var(--bronze)';
    const opacity = hid ? 0.16 : vis ? 0.7 : 1;
    const pinC = o ? acc : 'var(--carbon)';
    let inner = '';
    if (!hid) inner += `<div style="position:absolute;inset:${n.kind === 'core' ? 7 : 5}px;border:1px solid ${o ? acc : 'var(--carbon)'};border-radius:${corner};opacity:0.45"></div>`;
    if (!hid) for (const d of [0, 90, 180, 270]) inner += `<span style="position:absolute;width:5px;height:5px;background:${pinC};left:50%;top:50%;transform:rotate(${d}deg) translate(${R - 1}px,0) translate(-50%,-50%);transform-origin:0 0"></span>`;
    inner += `<div style="transform:rotate(-45deg);color:${o ? acc : av ? acc : vis ? 'var(--pewter)' : 'var(--ash)'};opacity:${av ? 0.5 : 1};display:flex">${vis ? _mtLock : (MICON[n.icon] || '')}</div>`;
    const fill = o ? `radial-gradient(circle at 50% 36%, ${acc}5e, rgba(13,10,8,0.92))` : 'rgba(13,10,8,0.92)';
    const glow = sel ? `0 0 30px -2px ${acc}` : o ? `0 0 22px -5px ${acc}, inset 0 0 20px -9px ${acc}` : 'none';
    const innerBox = `<div style="width:100%;height:100%;position:relative;transform:rotate(45deg);border-radius:${corner};border:2px solid ${borderC};border-style:${vis ? 'dashed' : 'solid'};background:${fill};box-shadow:${glow};display:flex;align-items:center;justify-content:center">${inner}</div>`;
    // ⚠️ ИНВАРИАНТ: подпись узла ВСЕГДА центрируется строго под узлом — `left:50%` (центр бокса узла = n.x) +
    // `transform:translateX(-50%)` (сдвиг на свою полуширину) + `text-align:center`. ОБЕ ветки ниже (обычный/ядро)
    // держат этот контракт; три свойства центровки — НЕ менять. ⚠️ Ширина — `width:max-content` (бокс ОБНИМАЕТ текст),
    // НЕ фиксированная: при фикс-ширине одиночное слово ШИРЕ бокса (напр. «РАЦИОНАЛИЗАЦИЯ» 132px > 124px) браузер
    // прижимает строку влево (overflow только вправо) → подпись съезжает. `max-width` даёт перенос многословным.
    let label = '';
    if (!hid && n.kind !== 'core') {
      label = `<div style="position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:6px;width:max-content;max-width:${Math.max(148, R * 3)}px;text-align:center;pointer-events:none">
        <div style="font-family:var(--font-display);font-size:${n.kind === 'cap' ? 20 : 16}px;font-weight:700;text-transform:uppercase;letter-spacing:-0.01em;color:${o ? 'var(--chalk)' : av ? 'var(--bone)' : 'var(--pewter)'};line-height:1.05">${vis ? '? ? ?' : n.name}</div>
        ${o ? `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.16em;color:${acc};margin-top:3px">● ${STR.meta.ui.nodePowered}</div>` : ''}
        ${av ? `<div style="display:inline-flex;align-items:center;gap:4px;margin-top:3px;font-family:var(--font-mono);font-size:11px;color:${can ? 'var(--gold)' : 'var(--blood-bright)'}">${_mtToken(11)}${n.cost}</div>` : ''}
        ${(o || av) && typeof metaUnlocksModule === 'function' && metaUnlocksModule(n.id) ? `<div style="display:block;margin:4px auto 0;width:fit-content;padding:1px 6px;border:1px solid var(--toxic);font-family:var(--font-mono);font-size:8px;letter-spacing:.1em;color:var(--toxic)">${STR.meta.ui.tagModule}</div>` : ''}
        ${(o || av) && typeof metaUnlocksStruct === 'function' && metaUnlocksStruct(n.id) ? `<div style="display:block;margin:4px auto 0;width:fit-content;padding:1px 6px;border:1px solid ${acc};font-family:var(--font-mono);font-size:8px;letter-spacing:.1em;color:${acc}">${STR.meta.ui.tagStruct}</div>` : ''}
        ${vis ? `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.16em;color:var(--ash);margin-top:3px">🔒 ${STR.meta.ui.nodeLocked}</div>` : ''}</div>`;
    } else if (!hid) {
      label = `<div style="position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:8px;text-align:center;pointer-events:none">
        <div style="font-family:var(--font-display);font-size:22px;font-weight:800;text-transform:uppercase;letter-spacing:-0.01em;color:var(--chalk)">${n.name}</div>
        <div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.2em;color:var(--gold);margin-top:2px">ROOT · 0x00</div></div>`;
    }
    const ring = sel ? `<div style="position:absolute;inset:-9px;border:1px solid ${acc};border-radius:${corner};transform:rotate(45deg)"></div>` : '';
    html += `<div class="mt-node${hid ? '' : ' clk'}${can ? ' can' : ''}" data-node="${n.id}" style="position:absolute;left:${n.x - R}px;top:${n.y - R}px;width:${R * 2}px;height:${R * 2}px;cursor:${hid ? 'default' : 'pointer'};opacity:${opacity};z-index:${sel ? 22 : 10};--nac:${acc}">${ring}${innerBox}${label}</div>`;
  }
  return svg + html;
}

function mtRenderCard() {
  _mtHold = null;   // карточка перерисована — старый контроллер удержания невалиден (пере-привяжем ниже, если узел покупаем)
  const save = _mtGame.save, n = _mtSel ? META_BY_ID[_mtSel] : null, card = _mt.card;
  if (!n) { card.innerHTML = `<div style="padding:40px 26px;text-align:center;color:var(--ash);font-family:var(--font-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;line-height:1.8"><div style="opacity:0.4;margin-bottom:14px;display:flex;justify-content:center">${_mtToken(40)}</div>${STR.meta.ui.cardEmptyA}<br>${STR.meta.ui.cardEmptyB}</div>`; return; }
  const acc = n.accent, s = metaState(save, n), owned = metaUnlocked(save, n.id), can = metaCanBuy(save, n);
  const stTag = { owned: [STR.meta.ui.stOwned, acc], avail: [STR.meta.ui.stAvail, 'var(--gold)'], visible: [STR.meta.ui.stVisible, 'var(--pewter)'], hidden: [STR.meta.ui.stHidden, 'var(--ash)'] }[s];
  const hasMod = typeof metaUnlocksModule === 'function' && metaUnlocksModule(n.id);   // узел открывает новый модуль сборки
  const hasStruct = typeof metaUnlocksStruct === 'function' && metaUnlocksStruct(n.id);   // узел открывает новую структуру для печати
  const deps = metaDepIds(n);
  const lbl = (c) => `font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:${c};text-transform:uppercase`;
  // КРУПНЫЙ красный баннер для узлов БЕЗ функционала (n.wip) — виден когда описание расшифровано (не 'visible'). Убираем флаг по мере реализации.
  const wipBanner = (n.wip && s !== 'visible') ? `<div style="margin-bottom:14px;padding:10px 13px;border:1px solid var(--blood);border-left:3px solid var(--blood-bright);background:rgba(168,40,28,0.12)"><div style="font-family:var(--font-display);font-size:16px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--blood-bright);line-height:1">${STR.meta.ui.wipTitle}</div><div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.12em;color:var(--bone);margin-top:5px;text-transform:uppercase">${STR.meta.ui.wipSub}</div></div>` : '';
  let body = wipBanner + `<div><div style="${lbl('var(--ash)')}">${STR.meta.ui.hDesc}</div><p style="margin:8px 0 0;font-family:var(--font-body);font-size:13.5px;color:var(--bone);line-height:1.6">${s === 'visible' ? STR.meta.ui.descLocked : n.desc}</p></div>`;
  // ТРЕБУЕТ — блок виден ВСЕГДА, в т.ч. у НЕРАСШИФРОВАННЫХ узлов ('visible'): там плашки «?» — имя не спойлерим,
  // но КОЛИЧЕСТВО требований игрок видит. Имя раскрываем, если зависимость УЖЕ ЗАПИТАНА (её игрок и так знает —
  // плашка акцентом с «●») либо сам узел расшифрован. ⚠️ КОНВЕРГЕНЦИЯ (allDeps/cap) — бейдж «НУЖНЫ ВСЕ», иначе
  // перечисление читается как «любой из» (у обычных узлов родитель один, и любой запитанный сосед открывает узел).
  if (deps.length) {
    const chipBase = 'font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:4px 8px';
    const chips = deps.map((id) => {
      const d = META_BY_ID[id]; if (!d) return '';
      if (metaUnlocked(save, id)) return `<span style="${chipBase};color:${d.accent};background:var(--earth);border:1px solid ${d.accent}">● ${d.name}</span>`;
      if (s === 'owned' || s === 'avail') return `<span style="${chipBase};color:var(--bone);background:var(--earth);border:1px solid var(--bronze)">${d.name}</span>`;   // ⚠️ именно РАСШИФРОВАННЫЕ состояния (не `s!=='visible'`: у 'hidden' имена тоже нельзя раскрывать)
      return `<span style="${chipBase};color:var(--ash);border:1px dashed var(--bronze);min-width:30px;text-align:center">${STR.meta.ui.reqUnknown}</span>`;
    }).join('');
    const needAll = deps.length > 1 && !!(n.allDeps || n.kind === 'cap');
    body += `<div style="margin-top:16px"><div style="display:flex;align-items:center;gap:8px"><div style="${lbl('var(--ash)')}">${STR.meta.ui.hRequires}</div>${needAll ? `<span style="font-family:var(--font-mono);font-size:8px;letter-spacing:.1em;padding:1px 5px;color:var(--gold);border:1px solid var(--gold-dim)">${STR.meta.ui.reqAll}</span>` : ''}</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${chips}</div></div>`;
  }
  if (n.kind === 'cap') body += `<div style="margin-top:16px;padding:12px 14px;border:1px solid var(--gold-dim);background:rgba(212,160,66,0.05)"><div style="${lbl('var(--gold)')}">${STR.meta.ui.capTitle}</div><p style="margin:6px 0 0;font-family:var(--font-body);font-size:12.5px;color:var(--pewter);line-height:1.55">${STR.meta.ui.capDesc}</p></div>`;
  // ТЕГ «ограниченно в режиме истории» (боевые узлы) — КРУПНЫЙ, внизу тела (над статусом/футером), с ОТДЕЛЯЮЩЕЙ ЛИНИЕЙ; виден когда описание расшифровано (не 'visible'). Каутион-янтарь, НЕ красный (узел рабочий, просто не применим без врагов).
  if (n.storyLimited && s !== 'visible') body += `<div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--gold-dim)"><div style="display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border:1px solid var(--gold-dim);border-left:3px solid var(--gold);background:rgba(212,160,66,0.09)"><span style="font-size:17px;line-height:1;color:var(--gold)">⚠</span><div style="min-width:0"><div style="font-family:var(--font-display);font-size:15px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);line-height:1.05">${STR.meta.ui.storyTitle}</div><div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.1em;color:var(--bone);margin-top:6px;text-transform:uppercase;line-height:1.55">${STR.meta.ui.storySub}</div></div></div></div>`;
  let footer;
  if (owned) footer = `<div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:1px solid ${acc};color:${acc};font-family:var(--font-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase">● ${STR.meta.ui.nodePoweredFull}</div>`;
  else footer = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="${lbl('var(--ash)')}">${STR.meta.ui.hCost}</span><span style="display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:20px;font-weight:700;color:${can ? 'var(--gold)' : 'var(--blood-bright)'}">${_mtToken(20)}${n.cost}<span style="font-size:11px;color:var(--ash)">${STR.meta.ui.mt}</span></span></div>
    <button id="mtBuy" ${can ? '' : 'disabled'} style="position:relative;overflow:hidden;width:100%;padding:14px;cursor:${can ? 'pointer' : 'not-allowed'};font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;background:${can ? 'rgba(212,160,66,0.14)' : 'transparent'};color:${can ? 'var(--gold-bright)' : 'var(--ash)'};border:1px solid ${can ? 'var(--gold)' : 'var(--bronze)'};clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))"><span id="mtBuyFill" style="position:absolute;left:0;top:0;height:100%;width:0;background:var(--gold);opacity:.9;z-index:0"></span><span style="position:relative;z-index:1">${s === 'visible' ? '🔒 ' + STR.meta.ui.buyLocked : can ? '▸ ' + STR.meta.ui.buyHold : STR.meta.ui.buyShort(n.cost - (save.meta || 0))}</span></button>`;
  card.innerHTML = `${_mtBracket(acc)}
    <div style="padding:18px 22px 16px;border-bottom:1px solid ${acc}40;position:relative">
      <button id="mtClose" style="position:absolute;top:14px;right:16px;background:none;border:none;color:var(--pewter);cursor:pointer;font-family:var(--font-mono);font-size:16px;line-height:1">✕</button>
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="width:52px;height:52px;flex-shrink:0;border:1px solid ${acc};display:flex;align-items:center;justify-content:center;color:${acc};background:var(--earth);clip-path:polygon(0 8px,8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%)">${MICON[n.icon] || ''}</div>
        <div style="min-width:0"><div style="display:flex;gap:8px;align-items:center;margin-bottom:5px"><span style="width:8px;height:8px;background:${acc};display:inline-block"></span><span style="${lbl(acc)}">${n.sys || STR.meta.ui.sysCore}</span></div>
        <div style="font-family:var(--font-display);font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:-0.02em;color:var(--chalk);line-height:1.02">${s === 'visible' ? '? ? ?' : n.name}</div></div>
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border:1px solid ${stTag[1]};color:${stTag[1]};font-family:var(--font-mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase"><span style="width:6px;height:6px;border-radius:50%;background:${stTag[1]}"></span>${stTag[0]}</div>
        ${hasMod ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid var(--toxic);color:var(--toxic);font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase"><b style="font-weight:700">+</b>${STR.meta.ui.cardModule}</div>` : ''}
        ${hasStruct ? `<div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border:1px solid ${acc};color:${acc};font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase"><b style="font-weight:700">+</b>${STR.meta.ui.cardStruct}</div>` : ''}
      </div>
    </div>
    <div style="padding:18px 22px;display:flex;flex-direction:column;flex:1;overflow-y:auto">${body}</div>
    <div style="padding:16px 22px;border-top:1px solid ${acc}40">${footer}</div>`;
  const close = card.querySelector('#mtClose'); if (close) close.addEventListener('click', () => { _mtSel = null; mtRender(); });
  const buy = card.querySelector('#mtBuy');     // покупка — УДЕРЖАНИЕ (ЛКМ ИЛИ Пробел) с горизонтальной заливкой
  if (buy && can) {
    const fill = card.querySelector('#mtBuyFill'); let raf = null, t0 = 0; const DUR = 620;
    const tick = () => { const p = Math.min(1, (performance.now() - t0) / DUR); fill.style.width = (p * 100) + '%'; if (p >= 1) { raf = null; if (metaBuy(save, n)) _mtUnlock(save, n); return; } raf = requestAnimationFrame(tick); };
    const startHold = (e) => { if (e) e.preventDefault(); if (raf) return;   // уже идёт — НЕ перезапускаем (иначе авто-репит Пробела сбрасывал бы заливку в ноль)
      t0 = performance.now(); raf = requestAnimationFrame(tick); };
    const cancelHold = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } fill.style.width = '0'; };
    buy.addEventListener('pointerdown', startHold);
    buy.addEventListener('pointerup', cancelHold);
    buy.addEventListener('pointerleave', cancelHold);
    _mtHold = { start: startHold, cancel: cancelHold };   // Пробел при выбранном узле запитывает через этот же контроллер (см. _mtKey/_mtKeyUp)
  }
}

function mtRender() {
  const save = _mtGame.save;
  _mt.world.innerHTML = _mtWorldHTML(save);
  _mt.tok.textContent = save.meta || 0;
  const pc = metaPoweredCount(save);
  _mt.progL.textContent = STR.meta.ui.progress(pc, META_TOTAL);
  _mt.progBar.style.width = (100 * pc / META_TOTAL) + '%';
  mtRenderCard();
}

// Анимация ЗАПИТЫВАНИЯ узла: яркий ток бежит по ребру родитель→узел (~0.56с, CSS .mt-surge), затем узел
// загорается (mtRender) + вспышка-кольцо. Дёшево: один прорисовывающийся path + один CSS-кадр, без рекурсии rAF.
function _mtUnlock(save, n) {
  const hasParent = META_EDGES.some(([a, b]) => (a === n.id && metaUnlocked(save, b)) || (b === n.id && metaUnlocked(save, a)));
  if (!hasParent || !_mt) { mtRender(); return; }   // корень/без запитанного соседа — мгновенно
  _mtPending = n.id; mtRender();                     // граф: узел ещё «доступен» + surge на ребре
  setTimeout(() => { if (_mtPending !== n.id) return; _mtPending = null; mtRender(); _mtIgniteFlash(n); }, 560);
}
function _mtIgniteFlash(n) {
  if (!_mt || !_mt.world) return;
  const R = META_RADIUS[n.kind] || 30, el = document.createElement('div');
  el.className = 'mt-ignite';
  el.style.cssText = `position:absolute;left:${n.x}px;top:${n.y}px;width:${R * 2.6}px;height:${R * 2.6}px;margin:${-R * 1.3}px 0 0 ${-R * 1.3}px;border:2px solid var(--gold-bright);border-radius:28%;pointer-events:none;z-index:30`;
  el.addEventListener('animationend', () => el.remove());
  _mt.world.appendChild(el);
}

function _mtKey(e) {
  if (e.code === 'Escape') { metaDomBack(); return; }
  // ПРОБЕЛ при выбранном покупаемом узле = удержание-запитывание (как зажатая ЛКМ на кнопке).
  // keydown авто-репитится — startHold идемпотентен (не сбрасывает заливку); отпускание ловит _mtKeyUp.
  if (e.code === 'Space') { e.preventDefault(); if (_mtHold) _mtHold.start(); return; }
  // ВРЕМЕННО (для тестов): K — полное обнуление меты: все узлы + банк МТ в ноль + кодекс
  // (диски данных + глоссарий). НЕ как «СБРОС» mtReset (тот ВОЗВРАЩАЕТ потраченные МТ). Убрать перед релизом.
  if (e.code === 'KeyK' && _mtGame) {
    _mtGame.save.meta = 0; _mtGame.save.metaUnlocks = {};
    if (typeof codexResetSave === 'function') codexResetSave();   // глоссарий + диски данных тоже в ноль
    if (typeof writeSave === 'function') writeSave(_mtGame.save);
    _mtSel = null; mtRender();
  }
  // ВРЕМЕННО (для тестов): M — +10 МЕГА-ТОКЕНОВ (быстро тестировать покупки узлов). Убрать перед релизом.
  if (e.code === 'KeyM' && _mtGame) {
    _mtGame.save.meta = (_mtGame.save.meta || 0) + 10;
    if (typeof writeSave === 'function') writeSave(_mtGame.save);
    mtRender();
  }
}
function _mtKeyUp(e) { if (e.code === 'Space' && _mtHold) _mtHold.cancel(); }   // отпустил Пробел — отмена недозаполненной покупки
function metaDomBack() { if (_mtGame) _mtGame.mode = 'menu'; metaDomHide(); }
function metaDomShow(game) { _mtGame = game; _mtSel = null; const m = metaDomEnsure(); m.root.classList.add('show'); mtFit(); mtRender(); addEventListener('keydown', _mtKey); addEventListener('keyup', _mtKeyUp); }
function metaDomHide() { if (_mt) _mt.root.classList.remove('show'); removeEventListener('keydown', _mtKey); removeEventListener('keyup', _mtKeyUp); _mtHold = null; }
