'use strict';

// БАЗА ДАННЫХ (КОДЕКС) — DOM-оверлей. Вёрстка/логика 1:1 портированы из
// database/project/src/codex.jsx. Две вкладки:
//   • ГЛОССАРИЙ — журнал находок ИИ (серверы/города/юниты/пещеры/останки) с
//     интерпретацией; данные находки всегда целые (неоткрытое просто отсутствует).
//   • ВОССТАНОВЛЕНИЕ — мандала-диск кодекса (ацтекский «камень солнца» × киберпанк):
//     радиальные секторы заполняются фрагментами данных; при 100% диск «запечатывается»
//     и открывает видео-расшифровку + следующий, более сложный кодекс.
// Данные ПОКА статичны (демо как в исходнике; драйверы «скан»/«запечатать» — демо).
// Подключение к игре (реальные находки/прогресс восстановления) — следующий этап.

/* ---------- палитра (= C из codex.jsx) ---------- */
const CX = {
  gold:'#d4a042', goldB:'#f2c878', goldD:'#4a3618',
  blood:'#a8281c', bloodB:'#ff3a22', amber:'#f08a2a',
  jade:'#6a8a52', crystal:'#8a7ed4', cobalt:'#3a7ec8', toxic:'#c8e25a', turq:'#3f9e96',
  pit:'#0d0a0e', night:'#14100c', earth:'#1a140e', bronze:'#2a2018',
  carbon:'#3a302a', ash:'#5a5046', pewter:'#7a705e', bone:'#b8a896', chalk:'#e8dcc4',
};

/* ---------- иконки (порт ICON; currentColor наследует цвет категории) ---------- */
const _cxIc = (inner, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter">${inner}</svg>`;
const CXICON = {
  server:  (s) => _cxIc('<rect x="6" y="5" width="20" height="8"/><rect x="6" y="17" width="20" height="8"/><circle cx="10" cy="9" r="1" fill="currentColor"/><circle cx="10" cy="21" r="1" fill="currentColor"/>', s),
  wild:    (s) => _cxIc('<path d="M4 26 L9 12 L13 20 L16 8 L19 20 L23 12 L28 26 Z"/>', s),
  sleep:   (s) => _cxIc('<path d="M5 26 H27 M9 26 V14 L16 8 L23 14 V26"/><path d="M13 26 V18 H19 V26"/>', s),
  unit:    (s) => _cxIc('<path d="M11 7 L21 7 L24 12 L24 19 L19 24 H13 L8 19 V12 Z"/><circle cx="16" cy="15" r="3" fill="var(--blood-bright)" stroke="none"/>', s),
  cave:    (s) => _cxIc('<path d="M4 27 Q5 11 16 9 Q27 11 28 27"/><path d="M12 27 Q13 18 16 17 Q19 18 20 27"/>', s),
  remains: (s) => _cxIc('<path d="M10 6 L22 6 L20 14 L12 14 Z"/><path d="M12 14 L9 27 M20 14 L23 27 M14 19 H18"/>', s),
  play:    (s) => _cxIc('<path d="M11 7 L25 16 L11 25 Z"/>', s),
  artifact:(s) => _cxIc('<path d="M16 4 L25 13 L16 28 L7 13 Z"/><path d="M7 13 H25 M16 4 V28"/>', s),
};

const CXCATS = [
  { id:'server',  name:STR.codex.cat.server,  icon:'server',  c:CX.cobalt },
  { id:'wild',    name:STR.codex.cat.wild,     icon:'wild',    c:CX.bloodB },
  { id:'sleep',   name:STR.codex.cat.sleep,    icon:'sleep',   c:CX.crystal },
  { id:'unit',    name:STR.codex.cat.unit,     icon:'unit',    c:CX.amber },
  { id:'cave',    name:STR.codex.cat.cave,     icon:'cave',    c:CX.gold },
  { id:'remains', name:STR.codex.cat.remains,  icon:'remains', c:CX.jade },
  { id:'trap',    name:STR.codex.cat.trap,     icon:'wild',    c:CX.bloodB },
  { id:'artifact',name:STR.codex.cat.artifact, icon:'artifact',c:CX.turq },
];

/* глоссарий — только ОТКРЫТЫЕ записи (неоткрытое игрок не видит, данные целые) */
const CXENTRIES = [
  { id:'e1', cat:'server',  name:STR.codex.entry.e1.name, cycle:1, scan:'0x1A0F', depth:-42,
    lore:STR.codex.entry.e1.lore },
  { id:'e2', cat:'server',  name:STR.codex.entry.e2.name, cycle:2, scan:'0x2C31', depth:-88,
    lore:STR.codex.entry.e2.lore },
  { id:'e3', cat:'wild',    name:STR.codex.entry.e3.name, cycle:1, scan:'0x1F77', depth:-61,
    lore:STR.codex.entry.e3.lore },
  { id:'e4', cat:'sleep',   name:STR.codex.entry.e4.name, cycle:3, scan:'0x3B12', depth:-130,
    lore:STR.codex.entry.e4.lore },
  { id:'e5', cat:'unit',    name:STR.codex.entry.e5.name, cycle:2, scan:'0x2D44', depth:-77,
    lore:STR.codex.entry.e5.lore },
  { id:'e6', cat:'cave',    name:STR.codex.entry.e6.name, cycle:3, scan:'0x3A09', depth:-115,
    lore:STR.codex.entry.e6.lore },
  { id:'e7', cat:'remains', name:STR.codex.entry.e7.name, cycle:2, scan:'0x2E55', depth:-94,
    lore:STR.codex.entry.e7.lore },
  { id:'a1', cat:'artifact', name:STR.codex.entry.a1.name, cycle:2, scan:'0x4C0D', depth:-105,
    lore:STR.codex.entry.a1.lore },
  { id:'a2', cat:'artifact', name:STR.codex.entry.a2.name, cycle:3, scan:'0x4F22', depth:-148,
    lore:STR.codex.entry.a2.lore },
  { id:'a3', cat:'artifact', name:STR.codex.entry.a3.name, cycle:3, scan:'0x52B8', depth:-176,
    lore:STR.codex.entry.a3.lore },
  { id:'a4', cat:'artifact', name:STR.codex.entry.a4.name, cycle:3, scan:'0x5631', depth:-118, lore:STR.codex.entry.a4.lore },
  { id:'a5', cat:'artifact', name:STR.codex.entry.a5.name, cycle:4, scan:'0x5A07', depth:-152, lore:STR.codex.entry.a5.lore },
  { id:'a6', cat:'artifact', name:STR.codex.entry.a6.name, cycle:4, scan:'0x5E9C', depth:-160, lore:STR.codex.entry.a6.lore },
  { id:'a7', cat:'artifact', name:STR.codex.entry.a7.name, cycle:3, scan:'0x612D', depth:-128, lore:STR.codex.entry.a7.lore },
  { id:'a8', cat:'artifact', name:STR.codex.entry.a8.name, cycle:2, scan:'0x4488', depth:-90,  lore:STR.codex.entry.a8.lore },
  { id:'a9',  cat:'artifact', name:STR.codex.entry.a9.name,  cycle:4, scan:'0x65F1', depth:-138, lore:STR.codex.entry.a9.lore },
  { id:'a10', cat:'artifact', name:STR.codex.entry.a10.name, cycle:4, scan:'0x69AD', depth:-166, lore:STR.codex.entry.a10.lore },
  { id:'a11', cat:'artifact', name:STR.codex.entry.a11.name, cycle:3, scan:'0x6C30', depth:-120, lore:STR.codex.entry.a11.lore },
  { id:'a12', cat:'artifact', name:STR.codex.entry.a12.name, cycle:4, scan:'0x70B4', depth:-172, lore:STR.codex.entry.a12.lore },
  { id:'a13', cat:'artifact', name:STR.codex.entry.a13.name, cycle:3, scan:'0x7402', depth:-110, lore:STR.codex.entry.a13.lore },
  { id:'a14', cat:'artifact', name:STR.codex.entry.a14.name, cycle:3, scan:'0x77C9', depth:-126, lore:STR.codex.entry.a14.lore },
  { id:'a15', cat:'artifact', name:STR.codex.entry.a15.name, cycle:4, scan:'0x7B55', depth:-158, lore:STR.codex.entry.a15.lore },
  { id:'a16', cat:'artifact', name:STR.codex.entry.a16.name, cycle:3, scan:'0x7F2A', depth:-100, lore:STR.codex.entry.a16.lore },
  { id:'a17', cat:'artifact', name:STR.codex.entry.a17.name, cycle:3, scan:'0x82C1', depth:-112, lore:STR.codex.entry.a17.lore },
  { id:'a18', cat:'artifact', name:STR.codex.entry.a18.name, cycle:3, scan:'0x8644', depth:-130, lore:STR.codex.entry.a18.lore },
  { id:'a19', cat:'artifact', name:STR.codex.entry.a19.name, cycle:4, scan:'0x89F0', depth:-148, lore:STR.codex.entry.a19.lore },
  { id:'a20', cat:'artifact', name:STR.codex.entry.a20.name, cycle:3, scan:'0x8D72', depth:-104, lore:STR.codex.entry.a20.lore },
  { id:'a21', cat:'artifact', name:STR.codex.entry.a21.name, cycle:5, scan:'0x9133', depth:-184, lore:STR.codex.entry.a21.lore },
  { id:'e8',  cat:'unit', name:STR.codex.entry.e8.name,  cycle:4, scan:'0x4A1C', depth:-110, lore:STR.codex.entry.e8.lore },
  { id:'e9',  cat:'unit', name:STR.codex.entry.e9.name,  cycle:3, scan:'0x3D6B', depth:-96,  lore:STR.codex.entry.e9.lore },
  { id:'e10', cat:'unit', name:STR.codex.entry.e10.name, cycle:3, scan:'0x2B05', depth:-70,  lore:STR.codex.entry.e10.lore },
  { id:'e11', cat:'unit', name:STR.codex.entry.e11.name, cycle:5, scan:'0x5C40', depth:-132, lore:STR.codex.entry.e11.lore },
  { id:'e12', cat:'unit', name:STR.codex.entry.e12.name, cycle:5, scan:'0x6122', depth:-150, lore:STR.codex.entry.e12.lore },
  { id:'e13', cat:'unit', name:STR.codex.entry.e13.name, cycle:7, scan:'0x6F18', depth:-188, lore:STR.codex.entry.e13.lore },
  { id:'e14', cat:'unit', name:STR.codex.entry.e14.name, cycle:5, scan:'0x58AE', depth:-140, lore:STR.codex.entry.e14.lore },
  // ЛОВУШКИ (открываются по факту срабатывания, traps.js _trapDiscover)
  { id:'e15', cat:'trap', name:STR.codex.entry.e15.name, cycle:3, scan:'0x7A1C', depth:-130, lore:STR.codex.entry.e15.lore },
  { id:'e16', cat:'trap', name:STR.codex.entry.e16.name, cycle:4, scan:'0x8B33', depth:-160, lore:STR.codex.entry.e16.lore },
  { id:'e17', cat:'trap', name:STR.codex.entry.e17.name, cycle:3, scan:'0x6C09', depth:-120, lore:STR.codex.entry.e17.lore },
  { id:'e18', cat:'trap', name:STR.codex.entry.e18.name, cycle:2, scan:'0x3E44', depth:-150, lore:STR.codex.entry.e18.lore },
  // ВАРИАНТЫ ОСТАНКОВ РОБОТОВ (открываются сканом мёртвого по kind, hazards.js)
  { id:'e19', cat:'remains', name:STR.codex.entry.e19.name, cycle:4, scan:'0x91A0', depth:-140, lore:STR.codex.entry.e19.lore },
  { id:'e20', cat:'remains', name:STR.codex.entry.e20.name, cycle:4, scan:'0x9D2B', depth:-155, lore:STR.codex.entry.e20.lore },
  { id:'e21', cat:'remains', name:STR.codex.entry.e21.name, cycle:5, scan:'0xA4F1', depth:-170, lore:STR.codex.entry.e21.lore },
  { id:'e22', cat:'remains', name:STR.codex.entry.e22.name, cycle:4, scan:'0x88C5', depth:-135, lore:STR.codex.entry.e22.lore },
];

/* ДАННЫЕ → ФРАГМЕНТЫ → % восстановления.
   Один полностью извлечённый сервер/объект = CODEX_DATA_PER_SCAN фрагмент(ов) данных.
   Диск = СЕГМЕНТЫ с РАЗНЫМ числом фрагментов (`frags[]`, неравномерно → «рваные» диски); % = набрано/всего.
   ЦЕПОЧКА из 10 дисков от простого к сложному (сегментов и фрагментов всё больше → данных нужно больше).
   Прогресс/запечатанность/найденный глоссарий ПЕРСИСТЯТСЯ в `save.codex`. Видео-расшифровка — заглушка. */
const CODEX_DATA_PER_SCAN = 1;
const CODEX_DEFS = [
  { id:'cdx1',  name:STR.codex.disc.cdx1.name,  sub:STR.codex.disc.cdx1.sub,  frags:[2,3,2,3,2],                          decrypt:STR.codex.disc.cdx1.decrypt },
  { id:'cdx2',  name:STR.codex.disc.cdx2.name,  sub:STR.codex.disc.cdx2.sub,  frags:[3,2,4,2,3,2],                        decrypt:STR.codex.disc.cdx2.decrypt },
  { id:'cdx3',  name:STR.codex.disc.cdx3.name,  sub:STR.codex.disc.cdx3.sub,  frags:[3,4,2,5,3,2,4],                      decrypt:STR.codex.disc.cdx3.decrypt },
  { id:'cdx4',  name:STR.codex.disc.cdx4.name,  sub:STR.codex.disc.cdx4.sub,  frags:[4,2,5,3,4,2,5,3],                    decrypt:STR.codex.disc.cdx4.decrypt },
  { id:'cdx5',  name:STR.codex.disc.cdx5.name,  sub:STR.codex.disc.cdx5.sub,  frags:[3,5,2,6,3,4,2,5,4],                  decrypt:STR.codex.disc.cdx5.decrypt },
  { id:'cdx6',  name:STR.codex.disc.cdx6.name,  sub:STR.codex.disc.cdx6.sub,  frags:[4,3,6,2,5,3,6,2,4,5],                decrypt:STR.codex.disc.cdx6.decrypt },
  { id:'cdx7',  name:STR.codex.disc.cdx7.name,  sub:STR.codex.disc.cdx7.sub,  frags:[5,3,6,4,2,6,3,5,4,3,6],              decrypt:STR.codex.disc.cdx7.decrypt },
  { id:'cdx8',  name:STR.codex.disc.cdx8.name,  sub:STR.codex.disc.cdx8.sub,  frags:[4,6,3,5,7,2,6,4,5,3,6,4],            decrypt:STR.codex.disc.cdx8.decrypt },
  { id:'cdx9',  name:STR.codex.disc.cdx9.name,  sub:STR.codex.disc.cdx9.sub,  frags:[5,4,7,3,6,4,7,2,6,5,4,7,3,6],        decrypt:STR.codex.disc.cdx9.decrypt },
  { id:'cdx10', name:STR.codex.disc.cdx10.name, sub:STR.codex.disc.cdx10.sub, frags:[6,4,7,5,8,3,7,5,6,4,8,3,7,5,6,4],    decrypt:STR.codex.disc.cdx10.decrypt },
];
let _cxSave = null, _cxFound = null;
function codexBindSave(save) { _cxSave = save; }                 // game зовёт в конструкторе ДО первого _cxState
function _cxFoundSet() { if (!_cxFound) _cxFound = new Set((_cxSave && _cxSave.codex && _cxSave.codex.found) || []); return _cxFound; }
function _cxRelock(cs) { for (let i = 0; i < cs.length; i++) cs[i].locked = i > 0 && !cs[i - 1].restored; }   // диск открыт, когда предыдущий запечатан
function cxInitCodices() {
  const sv = _cxSave && _cxSave.codex;
  const cs = CODEX_DEFS.map((d, i) => {
    const fr = (sv && sv.frags && sv.frags[i] && sv.frags[i].length === d.frags.length) ? sv.frags[i] : null;
    return {
      id: d.id, name: d.name, sub: d.sub, decrypt: d.decrypt, restored: !!(sv && sv.restored && sv.restored[i]),
      sectors: d.frags.map((m, j) => ({ id: j, max: m, frag: fr ? Math.min(m, fr[j] | 0) : 0, density: (0.3 + ((j * 37) % 70) / 100).toFixed(2) })),
    };
  });
  _cxRelock(cs);
  return cs;
}
// записать прогресс кодекса в save (фрагменты + запечатанные + найденный глоссарий)
function cxPersist() {
  if (!_cxSave) return;
  const st = _cxState();
  _cxSave.codex = { frags: st.codices.map((c) => c.sectors.map((s) => s.frag)), restored: st.codices.map((c) => c.restored), found: [...(_cxFoundSet())], pending: st.pendingData | 0, seen: st.seen.slice() };
  if (typeof writeSave === 'function') writeSave(_cxSave);
}
// Полный сброс кодекса (диски данных + глоссарий) — для тест-вайпа меты (клавиша K).
// Чистит save и кэши состояния → при следующем _cxState/_cxFoundSet всё перестроится пустым.
function codexResetSave() {
  if (_cxSave) { _cxSave.codex = null; if (typeof writeSave === 'function') writeSave(_cxSave); }
  _cxFound = null; _cxS = null;
  if (_cx && _cx.root.classList.contains('show')) cxRender();   // если открыт — перерисовать пустым
}

/* ---------- мелкие «кирпичи» (= Tag/Label/lnk/btnLine/btnSolid) ---------- */
const _cxTag = (c, t) => `<span style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:${c};text-transform:uppercase;border:1px solid ${c}55;padding:3px 8px">${t}</span>`;
const _cxLabel = (t) => `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.2em;color:${CX.ash};text-transform:uppercase">${t}</div>`;
const _cxBtnSolid = (c) => `display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;padding:11px 20px;cursor:pointer;background:${c};color:${CX.pit};border:1px solid ${c}`;
const _cxArrow = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M13 5 L6 12 L13 19 M6 12 H20"/></svg>`;

/* ---------- состояние ---------- */
let _cx = null, _cxGame = null, _cxS = null;
function _cxState() {
  if (!_cxS) {
    const codices = cxInitCodices();
    let cur = codices.findIndex((c) => !c.restored && !c.locked); if (cur < 0) cur = codices.length - 1;
    _cxS = { tab:'restore', codices, curIdx: cur, selSeg:null, viewDisc:null, selEntry:null, discPhase:'idle',
      seen: (_cxSave && _cxSave.codex && _cxSave.codex.seen) ? _cxSave.codex.seen.slice() : [],   // просмотренные диски — снимают маркер «новое», ПЕРСИСТ
      pendingData: (_cxSave && _cxSave.codex && _cxSave.codex.pending) | 0 };   // данные сверх полного диска (ждут распечатки) — копятся, не теряются
  }
  return _cxS;
}
// открыть запись глоссария при ПЕРВОЙ встрече (game зовёт). Возвращает запись (для лога/подсказки) или null.
function codexDiscover(id) {
  const s = _cxFoundSet(); if (s.has(id)) return null;
  const e = CXENTRIES.find((x) => x.id === id); if (!e) return null;
  s.add(id); cxPersist();
  if (_cx && _cx.root.classList.contains('show') && _cxState().tab === 'glossary') cxRender();
  return e;
}
// открыть ПЕРВУЮ ещё не найденную запись данной категории (для триггеров по типу объекта)
function codexDiscoverCat(cat) { const s = _cxFoundSet(); const e = CXENTRIES.find((x) => x.cat === cat && !s.has(x.id)); return e ? codexDiscover(e.id) : null; }
// все записи категории уже открыты? (game гасит опрос исчерпанных категорий)
function codexCatExhausted(cat) { const s = _cxFoundSet(); return !CXENTRIES.some((x) => x.cat === cat && !s.has(x.id)); }

/* ============================================================
   МАНДАЛА — ацтекский «камень солнца» (порт Mandala → строка SVG)
   ============================================================ */
// `anim` (необязательно): { segFrac } — массив долей заполнения по секторам (intro «по очереди»
// при открытии вкладки) ИЛИ { growSeg, growFrac } — рост ОДНОГО сектора (появление нового фрагмента).
function cxMandala(codex, pct, complete, selSeg, interactive, mini, size, anim) {
  const SZ = size || 720, cx = SZ / 2, cy = SZ / 2, k = SZ / 720;
  const N = codex.sectors.length;
  const GAP = N > 10 ? 1.1 : 1.8, step = 360 / N;
  const rHole = 120 * k, rGlyph = 130 * k, rGlyphO = 168 * k;
  const rMainA = 180 * k, rMainB = 276 * k;
  const rGrecaA = 282 * k, rGrecaB = 318 * k;
  const rTeethA = 322 * k, rTeethB = 348 * k;
  const pol = (r, a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const sector = (r0, r1, a0, a1) => { const la = (a1 - a0) > 180 ? 1 : 0; const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1), [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0);
    return `M ${x0} ${y0} A ${r1} ${r1} 0 ${la} 1 ${x1} ${y1} L ${x2} ${y2} A ${r0} ${r0} 0 ${la} 0 ${x3} ${y3} Z`; };
  const arc = (r, a0, a1) => { const la = (a1 - a0) > 180 ? 1 : 0; const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1); return `M ${x0} ${y0} A ${r} ${r} 0 ${la} 1 ${x1} ${y1}`; };
  const meander = (a0, a1, r0, r1, pts) => 'M ' + pts.map(([u, v]) => { const [x, y] = pol(r0 + (r1 - r0) * v, a0 + (a1 - a0) * u); return `${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' L ');
  const M_A = [[0.12,0.12],[0.12,0.88],[0.5,0.88],[0.5,0.4],[0.3,0.4],[0.3,0.62]];
  const M_B = [[0.88,0.12],[0.88,0.88],[0.5,0.88],[0.5,0.4],[0.7,0.4],[0.7,0.62]];
  const grecaCells = mini ? 0 : N * 2;
  const maxW = mini ? '100%' : 'min(74vh,720px)', maxH = mini ? '100%' : '74vh';
  let s = `<svg viewBox="0 0 ${SZ} ${SZ}" style="width:100%;height:100%;max-width:${maxW};max-height:${maxH};display:block">`;
  s += `<defs>`;
  s += `<radialGradient id="cxgf${SZ}" cx="50%" cy="44%" r="62%"><stop offset="0%" stop-color="${CX.goldB}"/><stop offset="100%" stop-color="${CX.gold}"/></radialGradient>`;
  s += `<radialGradient id="cxcg${SZ}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${complete ? 'rgba(242,200,120,0.4)' : 'rgba(212,160,66,0.12)'}"/><stop offset="100%" stop-color="rgba(212,160,66,0)"/></radialGradient>`;
  s += `<filter id="cxgl${SZ}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${4 * k}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  s += `</defs>`;

  s += `<circle cx="${cx}" cy="${cy}" r="${rTeethB}" fill="url(#cxcg${SZ})"/>`;

  // поэтапное проявление при запечатывании (anim.build={center,seg,ring} 0..1): группы с opacity+zoom от центра
  const B = anim && anim.build;
  const gO = (v) => { v = Math.max(0, Math.min(1, v)); return B ? `<g opacity="${v.toFixed(3)}" transform="translate(${cx} ${cy}) scale(${(0.55 + 0.45 * v).toFixed(3)}) translate(${-cx} ${-cy})">` : ''; };
  const gC = () => B ? '</g>' : '';

  /* зубчатый венец-«мерлоны» */
  s += gO(B ? B.ring : 1);
  s += `<g class="${mini ? '' : 'codex-rot spin-rev'}">`;
  { const m = mini ? 16 : 36;
    for (let i = 0; i < m; i++) { const a = i * 360 / m, w = (360 / m) * 0.42;
      const [o1x,o1y] = pol(rTeethA, a - w), [o2x,o2y] = pol(rTeethB, a - w * 0.5), [o3x,o3y] = pol(rTeethB, a + w * 0.5), [o4x,o4y] = pol(rTeethA, a + w);
      s += `<polygon points="${o1x},${o1y} ${o2x},${o2y} ${o3x},${o3y} ${o4x},${o4y}" fill="${i % 2 ? CX.bronze : CX.earth}" stroke="${CX.goldD}" stroke-width="${0.8 * k}"/>`; }
  }
  s += `<circle cx="${cx}" cy="${cy}" r="${rTeethA}" fill="none" stroke="${CX.gold}" stroke-width="${k}"/></g>`;

  /* кольцо-лабиринт греки */
  if (!mini) {
    s += `<g class="codex-rot spin-slow">`;
    s += `<circle cx="${cx}" cy="${cy}" r="${rGrecaA}" fill="none" stroke="${CX.goldD}" stroke-width="${k}"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${rGrecaB}" fill="none" stroke="${CX.goldD}" stroke-width="${k}"/>`;
    for (let i = 0; i < grecaCells; i++) { const a0 = i * 360 / grecaCells, a1 = (i + 1) * 360 / grecaCells;
      s += `<path d="${meander(a0 + 0.5, a1 - 0.5, rGrecaA + 3, rGrecaB - 3, i % 2 ? M_A : M_B)}" fill="none" stroke="${CX.gold}" stroke-width="${1.1 * k}" opacity="0.5"/>`; }
    s += `</g>`;
  }
  s += gC();   // конец группы внешнего кольца (зубцы + грека)

  /* ОСНОВНЫЕ секторы восстановления — границы всегда видны */
  s += gO(B ? B.seg : 1);
  for (let i = 0; i < N; i++) {
    const seg = codex.sectors[i];
    const a0 = i * step + GAP, a1 = (i + 1) * step - GAP;
    let dispFrag = seg.frag, active = false;
    if (anim) {
      if (anim.segFrac) { const sf = anim.segFrac[i] || 0; dispFrag = seg.frag * sf; active = seg.frag > 0 && sf > 0.001 && sf < 0.999; }   // посекторное заполнение (по очереди)
      else if (anim.growSeg === seg.id) dispFrag = (seg.frag - 1) + anim.growFrac;   // растим последнюю ячейку
    }
    const frac = dispFrag / seg.max;
    const rFill = rMainA + (rMainB - rMainA) * frac, mid = (a0 + a1) / 2, full = dispFrag >= seg.max - 1e-6;
    const isSel = selSeg === seg.id, isGrow = !!(anim && anim.growSeg === seg.id) || active;
    s += `<g data-seg="${seg.id}" style="cursor:${interactive ? 'pointer' : 'default'}">`;
    s += `<path d="${sector(rMainA, rMainB, a0, a1)}" fill="${CX.earth}" stroke="${CX.bronze}" stroke-width="${k}"/>`;
    if (frac > 0.001) s += `<path d="${sector(rMainA, rFill, a0, a1)}" fill="url(#cxgf${SZ})" filter="${(full || isGrow) ? `url(#cxgl${SZ})` : 'none'}" opacity="${full ? 1 : 0.92}"/>`;
    for (let j = 0; j < seg.max - 1; j++) { const rr = rMainA + (rMainB - rMainA) * (j + 1) / seg.max, filledCell = (j + 1) <= dispFrag + 1e-6;
      s += `<path d="${arc(rr, a0, a1)}" fill="none" stroke="${filledCell ? CX.goldD : CX.bronze}" stroke-width="${0.9 * k}" opacity="${filledCell ? 0.85 : 0.9}"/>`; }
    s += `<path d="${sector(rMainA, rMainB, a0, a1)}" fill="none" stroke="${isGrow ? CX.goldB : isSel ? CX.chalk : full ? CX.goldB : CX.carbon}" stroke-width="${(isGrow || isSel) ? 2 * k : 1 * k}" class="${(isSel && !full) || isGrow ? 'seg-pulse' : ''}"/>`;
    { const [dx, dy] = pol(rMainB - 7 * k, mid); s += `<rect x="${dx - 2 * k}" y="${dy - 2 * k}" width="${4 * k}" height="${4 * k}" fill="${full ? CX.goldB : CX.ash}" transform="rotate(45 ${dx} ${dy})"/>`; }
    s += `</g>`;
  }
  s += gC();   // конец группы секторов

  /* внутреннее кольцо-глиф + центр */
  s += gO(B ? B.center : 1);
  s += `<g class="${mini ? '' : 'codex-rot spin-slow'}">`;
  [[CX.gold,0],[CX.jade,90],[CX.amber,180],[CX.blood,270]].forEach(([col, a]) => {
    s += `<path d="${sector(rGlyph, rGlyphO, a + 3, a + 87)}" fill="none" stroke="${col}" stroke-width="${2.5 * k}" opacity="0.55"/>`; });
  // меандры внутреннего кольца — фикс. сетка КРАТНАЯ 4 (выравнивание по 4 цветным дугам-квадрантам
  // 0/90/180/270°, а НЕ по N секторам данных → не наползают на границы квадрантов), с полем gm.
  if (!mini) { const GLN = 16, gstep = 360 / GLN, gm = 2.5;
    for (let i = 0; i < GLN; i++) { const a0 = i * gstep + gm, a1 = (i + 1) * gstep - gm;
      s += `<path d="${meander(a0, a1, rGlyph + 3, rGlyphO - 3, i % 2 ? M_A : M_B)}" fill="none" stroke="${CX.goldD}" stroke-width="${0.9 * k}"/>`; } }
  s += `<circle cx="${cx}" cy="${cy}" r="${rGlyph}" fill="none" stroke="${CX.goldD}" stroke-width="${k}"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${rGlyphO}" fill="none" stroke="${CX.goldD}" stroke-width="${k}"/></g>`;

  /* центральное отверстие + Тонатиу (солнце) */
  s += `<circle cx="${cx}" cy="${cy}" r="${rHole}" fill="${CX.pit}" stroke="${CX.goldD}" stroke-width="${1.5 * k}"/>`;
  s += `<g filter="${complete ? `url(#cxgl${SZ})` : 'none'}">`;
  [0,90,180,270].forEach((a) => { const [x1,y1] = pol(rHole * 0.5, a - 6), [x2,y2] = pol(rHole * 0.86, a), [x3,y3] = pol(rHole * 0.5, a + 6);
    s += `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${complete ? CX.gold : CX.bronze}" opacity="${mini ? 1 : 0.7}"/>`; });
  [45,135,225,315].forEach((a) => { const [x1,y1] = pol(rHole * 0.36, a - 3.5), [x2,y2] = pol(rHole * 0.66, a), [x3,y3] = pol(rHole * 0.36, a + 3.5);
    s += `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="${complete ? CX.goldD : CX.carbon}" opacity="${mini ? 1 : 0.7}"/>`; });
  s += `</g>`;
  if (mini) s += `<rect x="${cx - 13 * k}" y="${cy - 13 * k}" width="${26 * k}" height="${26 * k}" transform="rotate(45 ${cx} ${cy})" fill="${complete ? `url(#cxgf${SZ})` : CX.earth}" stroke="${complete ? CX.goldB : CX.bronze}" stroke-width="${1.5 * k}"/>`;

  /* центральный счётчик процентов */
  if (!mini) {
    s += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--font-display);font-weight:800;font-size:${64 * k}px;fill:${complete ? CX.goldB : CX.chalk};letter-spacing:-3px">${pct}<tspan style="font-size:${26 * k}px;fill:${CX.pewter}">%</tspan></text>`;
    s += `<text x="${cx}" y="${cy - 44 * k}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--font-mono);font-size:11px;letter-spacing:3px;fill:${CX.pewter}">${STR.codex.ui.restored}</text>`;
    s += `<text x="${cx}" y="${cy + 44 * k}" text-anchor="middle" dominant-baseline="central" style="font-family:var(--font-mono);font-size:10px;letter-spacing:4px;fill:${CX.gold}">${codex.name}</text>`;
  }
  s += gC();   // конец группы центра
  s += `</svg>`;
  return s;
}

/* ============================================================
   ВКЛАДКА 1 — ГЛОССАРИЙ
   ============================================================ */
function cxGlossaryHTML(st) {
  const fs = _cxFoundSet();
  const found = CXENTRIES.filter((e) => fs.has(e.id));            // только ОТКРЫТЫЕ находки
  // пустое состояние — пока ничего не встречено
  if (!found.length) return `<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:10px;color:${CX.ash}"><div style="font-family:var(--font-display);font-size:22px;font-weight:700;color:${CX.pewter};text-transform:uppercase;letter-spacing:.04em">${STR.codex.ui.emptyTitle}</div><div style="font-family:var(--font-mono);font-size:11px;letter-spacing:.14em">${STR.codex.ui.emptySub}</div></div>`;
  const byCat = {}; CXCATS.forEach((c) => byCat[c.id] = []); found.forEach((e) => byCat[e.cat].push(e));
  const catsShown = CXCATS.filter((c) => byCat[c.id].length > 0);
  const e = found.find((x) => x.id === st.selEntry) || found[0];
  const cat = CXCATS.find((c) => c.id === e.cat);

  let list = `<div style="overflow-y:auto">`;
  list += `<div style="display:grid;grid-template-columns:1fr 180px;gap:12px;padding:10px 24px;position:sticky;top:0;background:${CX.pit};border-bottom:1px solid ${CX.bronze};font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:${CX.ash};text-transform:uppercase;z-index:2"><span>${STR.codex.ui.colObject}</span><span style="text-align:right">${STR.codex.ui.colScanCycle}</span></div>`;
  for (const c of catsShown) {
    list += `<div><div style="display:flex;align-items:center;gap:10px;padding:9px 24px;background:${CX.earth};border-bottom:1px solid ${CX.bronze}"><span style="color:${c.c}">${CXICON[c.icon](18)}</span><span style="font-family:var(--font-mono);font-size:10px;letter-spacing:.14em;color:${CX.bone}">${c.name}</span><span style="margin-left:auto;font-family:var(--font-mono);font-size:10px;color:${CX.ash}">${byCat[c.id].length}</span></div>`;
    for (const en of byCat[c.id]) {
      const active = st.selEntry === en.id;
      list += `<button data-entry="${en.id}" style="width:100%;display:grid;grid-template-columns:1fr 180px;gap:12px;align-items:center;text-align:left;padding:11px 24px;cursor:pointer;border:none;border-bottom:1px solid ${CX.bronze}55;background:${active ? `linear-gradient(to right, ${c.c}22, transparent)` : 'transparent'};border-left:2px solid ${active ? c.c : 'transparent'}"><span style="display:flex;align-items:center;gap:10px"><span style="width:6px;height:6px;flex-shrink:0;background:${c.c};border-radius:50%"></span><span style="font-family:var(--font-body);font-size:13.5px;color:${active ? CX.chalk : CX.bone}">${en.name}</span></span><span style="justify-self:end;font-family:var(--font-mono);font-size:10px;color:${CX.pewter};letter-spacing:.06em">${STR.codex.ui.entryCycleScan(String(en.cycle).padStart(2,'0'), en.scan)}</span></button>`;
    }
    list += `</div>`;
  }
  list += `</div>`;

  const stat = (k, v) => `<div style="padding:10px 16px;background:${CX.night}"><div style="font-family:var(--font-mono);font-size:9px;letter-spacing:.14em;color:${CX.ash};text-transform:uppercase">${k}</div><div style="font-family:var(--font-mono);font-size:13px;color:${CX.chalk};margin-top:3px">${v}</div></div>`;
  let aside = `<aside style="border-left:1px solid ${CX.bronze};background:linear-gradient(180deg, ${CX.night}, ${CX.pit});overflow-y:auto">`;
  aside += `<div style="height:3px;background:${cat.c}"></div>`;
  aside += `<div style="padding:18px 20px;border-bottom:1px solid ${cat.c}40"><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><span style="color:${cat.c}">${CXICON[cat.icon](22)}</span>${_cxTag(cat.c, cat.name)}</div><div style="font-family:var(--font-display);font-size:19px;font-weight:700;text-transform:uppercase;letter-spacing:-0.01em;color:${CX.chalk};line-height:1.05">${e.name}</div></div>`;
  aside += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:${CX.bronze};border-bottom:1px solid ${CX.bronze}">${stat(STR.codex.ui.statCycle, STR.codex.ui.cycleVal(String(e.cycle).padStart(2,'0')))}${stat(STR.codex.ui.statScanId, e.scan)}${stat(STR.codex.ui.statDepth, STR.codex.ui.depthVal(e.depth))}</div>`;
  aside += `<div style="padding:18px 20px">${_cxLabel(STR.codex.ui.interpAI)}<p style="margin:8px 0 0;font-family:var(--font-body);font-size:14px;color:${CX.bone};line-height:1.6">${e.lore}</p></div>`;
  aside += `</aside>`;

  return `<div style="display:grid;grid-template-columns:1fr 360px;height:100%;min-height:0">${list}${aside}</div>`;
}

/* ============================================================
   ВКЛАДКА 2 — ВОССТАНОВЛЕНИЕ
   ============================================================ */
function cxRestoreHTML(st) {
  const cur = st.codices[st.curIdx];
  const totalFrag = cur.sectors.reduce((s, x) => s + x.frag, 0);
  const totalMax = cur.sectors.reduce((s, x) => s + x.max, 0);
  const pct = Math.round(totalFrag / totalMax * 100);
  const complete = totalFrag >= totalMax;
  const restored = st.codices.filter((c) => c.restored);
  const seg = st.selSeg != null ? cur.sectors.find((s) => s.id === st.selSeg) : null;

  let main = `<main class="scanlines" style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:20px">`;
  main += `<div style="position:absolute;top:18px;left:24px;font-family:var(--font-mono);font-size:10px;letter-spacing:.18em;color:${CX.pewter};z-index:1"><span style="color:${CX.gold}">${STR.codex.ui.currentDisc}</span> · ${cur.name} «${cur.sub}»</div>`;
  // диск в обёртке — её одну перерисовывает intro-анимация заполнения (cxTickFill)
  main += `<div id="cxDisc" style="display:flex;align-items:center;justify-content:center;width:100%;flex:1;min-height:0">${cxMandalaForCur(st, _cxFill ? cxFillFrac() : 1)}</div>`;
  if (complete && !cur.restored) main += `<div style="position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:1"><button id="cxFinalize" style="${_cxBtnSolid(CX.gold)};box-shadow:0 0 26px -6px ${CX.gold}">${CXICON.play(16)} ${STR.codex.ui.sealDisc}</button></div>`;
  main += `</main>`;

  let aside = `<aside style="border-left:1px solid ${CX.bronze};background:linear-gradient(180deg, ${CX.night}, ${CX.pit});display:flex;flex-direction:column;overflow-y:auto">`;
  // прогресс
  aside += `<div style="padding:18px 20px;border-bottom:1px solid ${CX.bronze}">${_cxLabel(STR.codex.ui.restoreProgress)}<div style="display:flex;align-items:baseline;gap:8px;margin-top:8px"><span style="font-family:var(--font-display);font-weight:800;font-size:40px;color:${complete ? CX.goldB : CX.chalk};letter-spacing:-2px;line-height:1">${pct}<span style="font-size:18px;color:${CX.pewter}">%</span></span><span style="font-family:var(--font-mono);font-size:11px;color:${CX.pewter}">${STR.codex.ui.sectorsCount(cur.sectors.filter((s) => s.frag >= s.max).length, cur.sectors.length)}</span></div><div style="height:8px;background:${CX.earth};border:1px solid ${CX.bronze};margin-top:10px"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,${CX.goldD},${CX.goldB})"></div></div></div>`;
  // буфер данных: собрано сверх ёмкости текущего диска — войдёт в следующий после распечатки (не теряется)
  if ((st.pendingData | 0) > 0) aside += `<div style="padding:14px 20px;border-bottom:1px solid ${CX.bronze}">${_cxLabel(STR.codex.ui.dataBuffer)}<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px"><span style="font-family:var(--font-display);font-weight:800;font-size:26px;color:${CX.cobalt};line-height:1">+${st.pendingData}</span><span style="font-family:var(--font-mono);font-size:10px;color:${CX.pewter};letter-spacing:.08em">${STR.codex.ui.bufferNote}</span></div></div>`;
  // сектор
  aside += `<div style="padding:18px 20px;border-bottom:1px solid ${CX.bronze};flex-shrink:0">${_cxLabel(STR.codex.ui.sectorOfDisc)}`;
  if (seg) {
    let ticks = '';
    for (let i = 0; i < seg.max - 1; i++) ticks += `<span style="position:absolute;top:0;bottom:0;left:${(i + 1) / seg.max * 100}%;width:1px;background:${CX.pit}"></span>`;
    aside += `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-family:var(--font-display);font-size:18px;font-weight:700;color:${CX.chalk};text-transform:uppercase">${STR.codex.ui.blockN(String(seg.id + 1).padStart(2,'0'))}</span><span style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:${seg.frag >= seg.max ? CX.gold : CX.amber}">${seg.frag}/${seg.max}</span></div><div style="font-family:var(--font-mono);font-size:10px;color:${CX.pewter};letter-spacing:.1em;margin-top:4px">${STR.codex.ui.densityFlow(seg.density)}</div><div style="height:10px;background:${CX.earth};border:1px solid ${CX.bronze};margin-top:10px;position:relative"><div style="height:100%;width:${seg.frag / seg.max * 100}%;background:${seg.frag >= seg.max ? `linear-gradient(90deg,${CX.goldD},${CX.goldB})` : `linear-gradient(90deg,${CX.amber},${CX.gold})`}"></div>${ticks}</div></div>`;
  } else {
    aside += `<p style="margin:10px 0 0;font-family:var(--font-body);font-size:12.5px;color:${CX.pewter};line-height:1.5">${STR.codex.ui.sectorHint}</p>`;
  }
  aside += `</div>`;
  // восстановленные диски
  aside += `<div style="padding:18px 20px;flex:1">${_cxLabel(STR.codex.ui.restoredDiscs)}<div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">`;
  if (restored.length === 0) aside += `<div style="font-family:var(--font-mono);font-size:11px;color:${CX.ash}">${STR.codex.ui.nothingYet}</div>`;
  for (const cc of restored) {
    const isNew = !st.seen.includes(cc.id);
    aside += `<button data-disc="${cc.id}" style="position:relative;display:flex;align-items:center;gap:14px;padding:10px 12px;cursor:pointer;background:${CX.earth};border:1px solid ${isNew ? CX.amber : CX.gold + '55'};text-align:left">`;
    if (isNew) aside += `<span class="newdot" style="position:absolute;top:-5px;right:-5px;width:12px;height:12px;border-radius:50%;background:${CX.amber};border:2px solid ${CX.pit};box-shadow:0 0 8px ${CX.amber}"></span>`;
    aside += `<div style="width:54px;height:54px;flex-shrink:0">${cxMandala(cc, 100, true, null, false, true, 120)}</div>`;
    aside += `<div style="flex:1"><div style="font-family:var(--font-display);font-size:15px;font-weight:700;color:${CX.chalk};text-transform:uppercase;letter-spacing:-0.01em">${cc.name}</div><div style="font-family:var(--font-mono);font-size:9.5px;letter-spacing:.12em;color:${isNew ? CX.amber : CX.gold}">${isNew ? '◆ ' + STR.codex.ui.newRecord : '«' + cc.sub + '» · 100%'}</div></div>`;
    aside += `<span style="color:${isNew ? CX.amber : CX.gold}">${CXICON.play(18)}</span></button>`;
  }
  aside += `</div></div></aside>`;

  return `<div style="display:grid;grid-template-columns:1fr 320px;height:100%;min-height:0">${main}${aside}</div>`;
}

/* ============================================================
   ПРОСМОТР ДИСКА — модалка с видео-расшифровкой
   ============================================================ */
function cxViewerHTML(st) {
  const codex = st.viewDisc; if (!codex) return '';
  const corners = [['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v, h]) =>
    `<span style="position:absolute;${v}:-1px;${h}:-1px;width:16px;height:16px;border-${v === 'top' ? 'top' : 'bottom'}:1px solid ${CX.gold};border-${h === 'left' ? 'left' : 'right'}:1px solid ${CX.gold}"></span>`).join('');
  const playing = st.discPhase === 'play';
  const stage = playing
    ? `<div style="text-align:center;color:${CX.gold}"><div style="font-family:var(--font-mono);font-size:12px;letter-spacing:.3em">▶ ${STR.codex.ui.playing}</div><div style="margin:10px auto 0;width:220px;height:3px;background:${CX.earth}"><div style="height:100%;width:42%;background:${CX.gold}"></div></div></div>`
    : `<div style="text-align:center"><div style="width:64px;height:64px;margin:0 auto;border:1px solid ${CX.gold};border-radius:50%;display:flex;align-items:center;justify-content:center;color:${CX.gold};box-shadow:0 0 26px -6px ${CX.gold}">${CXICON.play(26)}</div><div style="margin-top:14px;font-family:var(--font-mono);font-size:10px;letter-spacing:.2em;color:${CX.pewter}">${STR.codex.ui.clipSlot}</div></div>`;

  return `<div id="cxModal" style="position:fixed;inset:0;background:rgba(7,5,10,0.88);display:flex;align-items:center;justify-content:center;z-index:50;backdrop-filter:blur(2px)">
    <div id="cxModalInner" class="scanlines" style="position:relative;width:min(820px,94vw);background:${CX.night};border:1px solid ${CX.gold};display:grid;grid-template-columns:240px 1fr">
      ${corners}
      <div style="border-right:1px solid ${CX.gold}40;padding:20px;display:flex;flex-direction:column;align-items:center;gap:12px;background:${CX.pit}">
        <div style="width:200px;height:200px;max-width:100%">${cxMandala(codex, 100, true, null, false, true, 200)}</div>
        <div style="text-align:center"><div style="font-family:var(--font-display);font-size:18px;font-weight:800;color:${CX.chalk};text-transform:uppercase">${codex.name}</div><div style="font-family:var(--font-mono);font-size:10px;letter-spacing:.16em;color:${CX.gold}">«${codex.sub}»</div></div>
      </div>
      <div style="display:flex;flex-direction:column">
        <div style="padding:12px 18px;border-bottom:1px solid ${CX.gold}40;display:flex;justify-content:space-between;align-items:center">${_cxTag(CX.gold, STR.codex.ui.videoDecrypt)}<button id="cxViewerClose" style="background:none;border:none;color:${CX.pewter};cursor:pointer;font-family:var(--font-mono);font-size:16px">✕</button></div>
        <div id="cxVideo" style="position:relative;aspect-ratio:16/9;background:${CX.pit};display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden"><div style="position:absolute;inset:0;background:repeating-linear-gradient(to bottom, transparent 0 3px, rgba(212,160,66,0.05) 3px 4px)"></div>${stage}</div>
        <div style="padding:16px 18px">${_cxLabel(STR.codex.ui.content)}<p style="margin:8px 0 0;font-family:var(--font-body);font-size:13.5px;color:${CX.bone};line-height:1.6">${codex.decrypt}</p></div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   КАРКАС + РЕНДЕР + СОБЫТИЯ
   ============================================================ */
function codexDomEnsure() {
  if (_cx) return _cx;
  const root = document.createElement('div'); root.id = 'codexScreen';
  root.style.background = 'var(--pit)';
  root.style.backgroundImage = 'radial-gradient(ellipse at 50% 38%, rgba(212,160,66,0.05), transparent 62%)';
  document.body.appendChild(root);
  _cx = { root };
  // делегирование кликов (содержимое перерисовывается целиком)
  root.addEventListener('click', cxClick);
  return _cx;
}

function cxRender() {
  const st = _cxState();
  const restored = st.codices.filter((c) => c.restored);
  const lockedNotRestored = st.codices.filter((c) => c.locked && !c.restored).length;
  const unseen = restored.filter((c) => !st.seen.includes(c.id)).length;
  const cur = st.codices[st.curIdx];
  const complete = cur.sectors.reduce((s, x) => s + x.frag, 0) >= cur.sectors.reduce((s, x) => s + x.max, 0);
  const hasNew = unseen > 0 || complete;

  const tabBtn = (id, labelTxt, metaTxt, flag) => {
    const on = st.tab === id;
    return `<button data-tab="${id}" style="font-family:var(--font-mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;padding:12px 20px;cursor:pointer;background:${on ? CX.night : 'transparent'};color:${on ? CX.gold : CX.pewter};border:1px solid ${on ? CX.gold : 'transparent'};border-bottom:1px solid ${on ? CX.night : 'transparent'};margin-bottom:-1px;display:flex;gap:9px;align-items:center">${labelTxt}<span style="color:${CX.ash};font-size:9px">${metaTxt}</span>${flag ? `<span style="display:inline-flex;align-items:center;gap:5px;color:${CX.amber};font-size:9px"><span class="newdot" style="width:7px;height:7px;border-radius:50%;background:${CX.amber};box-shadow:0 0 8px ${CX.amber}"></span>${on ? STR.codex.ui.tabNew : ''}</span>` : ''}</button>`;
  };

  let html = `<header style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:14px;padding:14px 24px 0;border-bottom:1px solid ${CX.bronze};position:relative">`;
  html += `<span style="position:absolute;left:0;top:-1px;width:80px;height:1px;background:${CX.gold}"></span>`;
  html += `<div style="display:flex;align-items:center;gap:14px;padding-bottom:14px"><button id="cxBack" class="cx-back" title="${STR.codex.ui.backTitle}" aria-label="${STR.codex.ui.backAria}">${_cxArrow()}</button><div><div style="margin-bottom:6px">${_cxTag(CX.gold, STR.codex.ui.archiveTag)}</div><h1 style="font-family:var(--font-display);font-size:26px;font-weight:800;text-transform:uppercase;letter-spacing:-0.03em;color:${CX.chalk};line-height:0.92;margin:0">${STR.codex.ui.title}</h1></div></div>`;
  html += `<div style="display:flex;gap:4px">${tabBtn('glossary', STR.codex.ui.tabGlossary, _cxFoundSet().size + '/' + CXENTRIES.length, false)}${tabBtn('restore', STR.codex.ui.tabRestore, restored.length + '/' + (st.codices.length - lockedNotRestored), hasNew)}</div>`;
  html += `</header>`;

  html += `<div style="flex:1;min-height:0">${st.tab === 'glossary' ? cxGlossaryHTML(st) : cxRestoreHTML(st)}</div>`;
  html += cxViewerHTML(st);

  _cx.root.innerHTML = html;
}

function cxClick(ev) {
  const st = _cxState();
  const t = ev.target;
  const within = (sel) => t.closest && t.closest(sel);

  if (within('#cxBack')) { codexDomBack(); return; }

  // модалка просмотра диска
  if (st.viewDisc) {
    if (within('#cxViewerClose') || t.id === 'cxModal') { st.viewDisc = null; st.discPhase = 'idle'; cxRender(); return; }
    if (within('#cxVideo')) { st.discPhase = 'play'; cxRender(); return; }
    return;   // клик внутри модалки — без действий
  }

  const tab = within('[data-tab]'); if (tab) { st.tab = tab.getAttribute('data-tab'); st.selSeg = null; if (st.tab === 'restore') cxStartFill(); cxRender(); return; }
  const entry = within('[data-entry]'); if (entry) { st.selEntry = entry.getAttribute('data-entry'); cxRender(); return; }
  const seg = within('[data-seg]'); if (seg) { st.selSeg = parseInt(seg.getAttribute('data-seg'), 10); cxRender(); return; }
  const disc = within('[data-disc]'); if (disc) { cxOpenDisc(disc.getAttribute('data-disc')); return; }
  if (within('#cxFinalize')) { cxFinalize(); return; }
}

/* ============================================================
   ПРОГРЕСС-ХЕЛПЕРЫ + АНИМАЦИЯ ЗАПОЛНЕНИЯ ДИСКА (intro при открытии вкладки)
   ============================================================ */
function cxPct(cc) { const f = cc.sectors.reduce((s, x) => s + x.frag, 0), m = cc.sectors.reduce((s, x) => s + x.max, 0); return Math.round(f / m * 100); }
function cxComplete(cc) { return cc.sectors.reduce((s, x) => s + x.frag, 0) >= cc.sectors.reduce((s, x) => s + x.max, 0); }
function _cxEaseOut(t) { return 1 - Math.pow(1 - t, 3); }

// доли заполнения по секторам для intro «по очереди»: непустые секторы (по порядку id)
// заполняются последовательно, каждый в своём окне глобального прогресса g.
function cxSeqFracs(cur, g) {
  const fr = new Array(cur.sectors.length).fill(0);
  const order = []; for (let i = 0; i < cur.sectors.length; i++) if (cur.sectors[i].frag > 0) order.push(i);
  const M = order.length; let frag = 0;
  for (let k = 0; k < M; k++) { const i = order[k]; const local = Math.max(0, Math.min(1, (g - k / M) * M)); fr[i] = _cxEaseOut(local); frag += cur.sectors[i].frag * fr[i]; }
  return { fr, frag };
}
// мандала текущего диска с учётом intro-заполнения (fillF 0..1, секторы по очереди)
function cxMandalaForCur(st, fillF) {
  const cur = st.codices[st.curIdx];
  if (fillF == null || fillF >= 1) return cxMandala(cur, cxPct(cur), cxComplete(cur), st.selSeg, true, false, 720);
  const { fr, frag } = cxSeqFracs(cur, fillF);
  const totalMax = cur.sectors.reduce((s, x) => s + x.max, 0);
  return cxMandala(cur, Math.round(frag / totalMax * 100), false, st.selSeg, true, false, 720, { segFrac: fr });
}

let _cxFill = null, _cxFillRAF = false;
function cxFillFrac() { return _cxFill ? Math.max(0, Math.min(1, (performance.now() - _cxFill.start) / _cxFill.dur)) : 1; }
function cxStartFill() {
  const cur = _cxState().codices[_cxState().curIdx];
  const M = cur.sectors.filter((s) => s.frag > 0).length;   // длительность ∝ числу заполняемых секторов
  _cxFill = { start: performance.now(), dur: Math.min(2200, 500 + M * 180) };
  if (!_cxFillRAF) { _cxFillRAF = true; requestAnimationFrame(cxTickFill); }
}
function cxTickFill() {
  if (!_cxFill) { _cxFillRAF = false; return; }
  const el = document.getElementById('cxDisc');
  if (!el) { _cxFill = null; _cxFillRAF = false; return; }   // ушли с вкладки/закрыли — стоп
  const f = cxFillFrac();
  el.innerHTML = cxMandalaForCur(_cxState(), f);
  if (f >= 1) { _cxFill = null; _cxFillRAF = false; el.innerHTML = cxMandalaForCur(_cxState(), 1); return; }   // финал → вращение колец возобновляется
  requestAnimationFrame(cxTickFill);
}

/* ============================================================
   ИНТЕГРАЦИЯ С ИГРОЙ — получение данных (сервер/останки → фрагмент кодекса)
   ============================================================ */
// текущий восстанавливаемый диск = первый не запечатанный и не заблокированный
function cxCurrentIdx() { const st = _cxState(); for (let i = 0; i < st.codices.length; i++) { const c = st.codices[i]; if (!c.restored && !c.locked) return i; } return st.codices.length - 1; }

// Залить до `amount` фрагментов в диск `cc` по секторам. → {added, leftover, seg(первый затронутый)}.
function _cxFillDisk(cc, amount) {
  let budget = amount, seg = null;
  for (const s of cc.sectors) { while (budget > 0 && s.frag < s.max) { s.frag++; budget--; if (seg === null) seg = s.id; } if (budget <= 0) break; }
  return { added: amount - budget, leftover: budget, seg };
}
// game зовёт при извлечении данных: +n фрагментов в текущий диск. Возвращает результат для попапа, либо null,
// если диск полон (тогда данные НЕ ТЕРЯЮТСЯ — копятся в `pendingData` до распечатки, см. _cxDrainPending).
function codexGainData(n) {
  const st = _cxState(), idx = cxCurrentIdx(), cc = st.codices[idx];
  const before = cxPct(cc);
  const { added, leftover, seg } = _cxFillDisk(cc, n || 1);
  if (leftover > 0) st.pendingData = (st.pendingData | 0) + leftover;   // сверх ёмкости диска → в буфер (не теряем)
  if (added === 0) {                                      // диск полон, фрагмент не лёг — данные в буфере, попапа нет
    cxPersist();
    if (_cx && _cx.root.classList.contains('show') && st.tab === 'restore' && !_cxFill && !_cxSeal) cxRender();   // обновить счётчик буфера
    return null;
  }
  st.curIdx = idx; cxPersist();
  if (_cx && _cx.root.classList.contains('show') && st.tab === 'restore' && !_cxFill) cxRender();   // экран открыт — обновить
  return { idx, codex: cc, segId: seg, before, after: cxPct(cc), complete: cxComplete(cc) };
}
// Слить буфер `pendingData` в ТЕКУЩИЙ диск (зовётся, когда после распечатки появился новый диск). Остаток
// (если новый диск тоже переполнился) остаётся в буфере для следующего. Возвращает число влитых фрагментов.
function _cxDrainPending() {
  const st = _cxState();
  if (!st.pendingData || st.pendingData <= 0) return 0;
  const { added, leftover } = _cxFillDisk(st.codices[st.curIdx], st.pendingData);
  st.pendingData = leftover;
  if (added > 0) cxPersist();
  return added;
}

/* ---------- внутриигровой попап (НЕ модалка, БЕЗ рамки): РОВНО на месте кольца скана,
   того же размера. Фазы: мигание кольца (данные на 100%) → схлопывание → проявление диска
   с появлением фрагмента и ростом счётчика % (старое→новое). anchor={right,bottom,size} (CSS px). ---------- */
let _cxPop = null, _cxPopA = null;
function cxLoaderRing() {   // завершённое кольцо скана (cobalt, 100%) — мигает в фазе 1
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%;display:block"><circle cx="50" cy="50" r="40" fill="none" stroke="${CX.earth}" stroke-width="10"/><circle cx="50" cy="50" r="40" fill="none" stroke="${CX.cobalt}" stroke-width="10" stroke-linecap="round"/><text x="50" y="53" text-anchor="middle" dominant-baseline="central" style="font-family:var(--font-display);font-weight:800;font-size:30px;fill:${CX.chalk}">100</text></svg>`;
}
function codexPopupShow(r, anchor) {
  if (!r) return;
  if (!_cxPop) { const el = document.createElement('div'); el.id = 'codexPopup'; document.body.appendChild(el); _cxPop = { el }; }
  const el = _cxPop.el, sz = (anchor && anchor.size) || 90;
  el.style.width = sz + 'px'; el.style.height = sz + 'px';
  el.style.right = ((anchor ? anchor.right : 70) - sz / 2) + 'px';
  el.style.bottom = ((anchor ? anchor.bottom : 168) - sz / 2) + 'px';
  _cxPopA = { r, start: performance.now(), blink: 560, collapse: 200, reveal: 1500, hold: 2200, fade: 560, appear: 200, _lastPct: r.before, _popT: -9999 };
  el.innerHTML = `<div id="cxPopDisc" style="position:absolute;inset:0;transform-origin:center"></div>
    <div id="cxPopCap" style="position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:7px;white-space:nowrap;text-align:center;line-height:1"></div>`;
  el.classList.add('show');
  requestAnimationFrame(cxPopTick);
}
function cxPopTick() {
  if (!_cxPopA) return;
  const a = _cxPopA, el = _cxPop.el, disc = el.querySelector('#cxPopDisc'), cap = el.querySelector('#cxPopCap');
  const t = performance.now() - a.start;
  const tBlink = a.blink, tColl = tBlink + a.collapse, total = tColl + a.reveal + a.hold + a.fade;
  const tFade = total - a.fade, F = a.fade;
  el.style.opacity = t < 140 ? t / 140 : 1;
  // выключение ПОСЛЕДОВАТЕЛЬНО детьми: сперва гаснет диск (первая половина fade), потом % (вторая)
  const discFadeOp = t < tFade ? 1 : Math.max(0, 1 - (t - tFade) / (F * 0.5));
  const capFadeOp = t < tFade + F * 0.5 ? 1 : Math.max(0, 1 - (t - (tFade + F * 0.5)) / (F * 0.5));

  let discOp = 1;
  if (t < tColl) {                                      // фазы 1-2: завершённое КОЛЬЦО скана (мигает → схлопывается)
    if (disc._mode !== 'ring') { disc._mode = 'ring'; disc.innerHTML = cxLoaderRing(); }   // содержимое гарантировано в любой фазе (фикс «пустого диска»)
    if (t < tBlink) { discOp = 0.5 + 0.5 * Math.abs(Math.sin(t / 110)); disc.style.transform = 'scale(1)'; }
    else { const k = (t - tBlink) / a.collapse; discOp = 1 - k; disc.style.transform = `scale(${1 - 0.45 * k})`; }
    if (cap) cap.innerHTML = `<span style="font-family:var(--font-mono);font-size:9px;letter-spacing:.18em;color:${CX.cobalt};text-transform:uppercase">${STR.codex.ui.dataFull}</span>`;
  } else {                                              // фаза 3: ДИСК. проявление, потом линейный рост фрагмента + счётчик с отбивками на тиках
    const pt = t - tColl;
    const appear = Math.min(1, pt / a.appear);
    discOp = appear; disc.style.transform = `scale(${0.6 + 0.4 * appear})`;
    const prog = Math.max(0, Math.min(1, (pt - a.appear) / (a.reveal - a.appear))), fin = prog >= 1;
    if (disc._mode !== 'mand' || !fin || !disc._fin) { disc._mode = 'mand'; if (fin) disc._fin = true; disc.innerHTML = cxMandala(a.r.codex, 0, false, null, false, true, 120, { growSeg: a.r.segId, growFrac: fin ? 1 : prog }); }
    const pct = Math.round(a.r.before + (a.r.after - a.r.before) * prog);
    if (pct !== a._lastPct) { a._lastPct = pct; a._popT = t; }                          // смена % → отбивка
    const pop = 1 + 0.34 * Math.max(0, 1 - (t - a._popT) / 150);                        // цифра увеличивается и возвращается
    if (cap) cap.innerHTML = `<span style="display:inline-block;transform:scale(${pop.toFixed(3)});transform-origin:center;font-family:var(--font-display);font-weight:800;font-size:20px;color:${CX.chalk};letter-spacing:-.5px">${pct}<span style="font-size:11px;color:${CX.gold}">%</span></span>`;
  }
  disc.style.opacity = discOp * discFadeOp;
  if (cap) cap.style.opacity = capFadeOp;

  if (t >= total) { el.classList.remove('show'); el.innerHTML = ''; _cxPopA = null; return; }
  requestAnimationFrame(cxPopTick);
}

// Запечатывание диска — с анимацией: (A) запечатанный диск «уезжает в слот» восстановленных
// (scale↓ + сдвиг к сайдбару + fade), мини-диск появляется в списке; (B) НОВЫЙ диск собирается
// ПО ЧАСТЯМ (центр → секторы → внешнее кольцо) с фейдом и зумом до нормального размера.
let _cxSeal = null, _cxSealRAF = false;
function cxFinalize() {
  const st = _cxState(); const idx = st.curIdx;
  st.codices[idx].restored = true; _cxRelock(st.codices);
  st.selSeg = null; cxPersist();
  _cxSeal = { start: performance.now(), sealIdx: idx, nextIdx: Math.min(idx + 1, st.codices.length - 1), advanced: false, A: 620, B: 1300 };
  cxRender();   // список восстановленных обновился (мини-диск с маркером ◆ НОВАЯ ЗАПИСЬ)
  if (!_cxSealRAF) { _cxSealRAF = true; requestAnimationFrame(cxSealTick); }
}
function cxSealTick() {
  if (!_cxSeal) { _cxSealRAF = false; return; }
  const st = _cxState();
  const live = _cx && _cx.root.classList.contains('show') && st.tab === 'restore' && !st.viewDisc;
  const el = document.getElementById('cxDisc');
  if (!el || !live) {   // ушли с вкладки/закрыли — завершить мгновенно
    if (_cxSeal && !_cxSeal.advanced) { st.curIdx = _cxSeal.nextIdx; _cxDrainPending(); }   // новый диск получает накопленные данные
    _cxSeal = null; _cxSealRAF = false; if (live) cxRender(); return;
  }
  const a = _cxSeal, t = performance.now() - a.start;
  if (t < a.A) {   // фаза A — запечатанный диск уезжает к сайдбару
    const e = _cxEaseOut(t / a.A);
    el.innerHTML = cxMandala(st.codices[a.sealIdx], 100, true, null, false, false, 720);
    el.style.transformOrigin = 'center';
    el.style.transform = `translate(${Math.round(e * 240)}px, ${Math.round(-e * 130)}px) scale(${(1 - 0.6 * e).toFixed(3)})`;
    el.style.opacity = (1 - e).toFixed(3);
  } else {   // фаза B — новый диск собирается по частям
    if (!a.advanced) { a.advanced = true; st.curIdx = a.nextIdx; _cxDrainPending(); el.style.transform = ''; el.style.opacity = ''; }   // новый диск сразу заполняется накопленными данными
    const p = Math.min(1, (t - a.A) / a.B);
    const stg = (s0, s1) => _cxEaseOut(Math.max(0, Math.min(1, (p - s0) / (s1 - s0))));
    const cur = st.codices[st.curIdx];
    el.innerHTML = cxMandala(cur, cxPct(cur), cxComplete(cur), st.selSeg, true, false, 720,
      { build: { center: stg(0, 0.42), seg: stg(0.26, 0.72), ring: stg(0.55, 1) } });
    if (p >= 1) { _cxSeal = null; _cxSealRAF = false; cxRender(); return; }
  }
  requestAnimationFrame(cxSealTick);
}
function cxOpenDisc(id) {
  const st = _cxState(); const cc = st.codices.find((c) => c.id === id); if (!cc) return;
  st.viewDisc = cc; st.discPhase = 'idle';
  if (!st.seen.includes(id)) { st.seen.push(id); cxPersist(); }   // просмотрел → маркер «новое» снят НАВСЕГДА (персист)
  cxRender();
}

/* ---------- показ/скрытие/выход ---------- */
function _cxKey(e) {
  if (e.key !== 'Escape') return;
  const st = _cxState();
  if (st.viewDisc) { st.viewDisc = null; st.discPhase = 'idle'; cxRender(); return; }   // ESC сперва закрывает модалку
  codexDomBack();
}
function codexDomBack() { if (_cxGame) _cxGame.mode = 'menu'; codexDomHide(); }
function codexDomShow(game) { _cxGame = game; const m = codexDomEnsure(); if (_cxState().tab === 'restore') cxStartFill(); cxRender(); m.root.classList.add('show'); addEventListener('keydown', _cxKey); }
function codexDomHide() { if (_cx) _cx.root.classList.remove('show'); removeEventListener('keydown', _cxKey); }
