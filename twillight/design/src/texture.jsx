// 02 — АТМОСФЕРА: surface treatments for UI panels. No world textures, no figures.
// This is where dark-unknown mood is engineered: frames, scanlines, vignette,
// grain, dividers, engraving styles, single-source glows.

const Demo = ({ label, sub, height = 200, children, style }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{
      position: 'relative',
      height,
      background: 'var(--night)',
      border: '1px solid var(--bronze)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
      <span className="mono-sm" style={{ color: 'var(--gold)' }}>{label}</span>
      {sub && <span className="mono-sm">{sub}</span>}
    </div>
  </div>
);

/* ===== FRAMES — техно-машинный язык рамок ============================== */

/* Cut-corner clip path. Cuts top-right + bottom-left to feel like an
   inserted PCB / armour panel. Sizes: small/med/large/asym. */
const CLIP = {
  smallTR_BL: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
  bothSides:  'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))',
  notchTL:    'polygon(0 0, calc(100% - 0px) 0, 100% 0, 100% 100%, 0 100%, 0 18px, 18px 18px, 18px 0)',
};

// hex bolt head — drawn small at corners of panels
const BoltHead = ({ size = 8, color = 'var(--gold)', style }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" style={{ position: 'absolute', ...style }}>
    <polygon points="2.5,0.7 7.5,0.7 9.5,5 7.5,9.3 2.5,9.3 0.5,5"
      fill="var(--earth)" stroke={color} strokeWidth="0.8" />
    <line x1="3.5" y1="3.5" x2="6.5" y2="6.5" stroke={color} strokeWidth="0.8" />
  </svg>
);

// Tiny stamped serial chip
const SerialStamp = ({ children, color = 'var(--gold)', style }) => (
  <span style={{
    fontFamily: 'var(--font-mono)',
    fontSize: 9,
    letterSpacing: '0.18em',
    color,
    background: 'var(--earth)',
    border: `1px solid ${color === 'var(--gold)' ? 'var(--gold-dim)' : color}`,
    padding: '2px 6px',
    textTransform: 'uppercase',
    ...style,
  }}>
    {children}
  </span>
);

// PCB-style edge connector "fingers" (small parallel pads)
const EdgeFingers = ({ count = 12, color = 'var(--gold)', style }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, 1fr)`,
    gap: 2,
    ...style,
  }}>
    {[...Array(count)].map((_, i) => (
      <span key={i} style={{ background: color, height: 4 }} />
    ))}
  </div>
);

/* 1 — BRACKET · TAGGED ----------------------------------------------------- */
const Frame_BasicBracket = () => (
  <Demo label="bracket · tagged" sub="базовая · с тех-меткой">
    {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
      <span key={v+h} style={{
        position: 'absolute', [v]: -1, [h]: -1, width: 14, height: 14,
        [`border${v==='top'?'Top':'Bottom'}`]: '1px solid var(--gold)',
        [`border${h==='left'?'Left':'Right'}`]: '1px solid var(--gold)',
      }} />
    ))}
    {/* corner notch fill */}
    <span style={{ position:'absolute', top:0, right:0, width: 30, height: 14, background: 'var(--gold)',
      clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 0)' }} />
    <span style={{ position:'absolute', top:0, right:8, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--void)', fontWeight: 700, lineHeight: '14px' }}>
      M-04
    </span>
    {/* status dot */}
    <span style={{ position:'absolute', top: 22, left: 14, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <span style={{ width: 6, height: 6, background: 'var(--toxic)', boxShadow: '0 0 6px var(--toxic)' }} />
      <span className="mono-sm" style={{ color: 'var(--toxic)' }}>RDY</span>
    </span>
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="mono" style={{ color: 'var(--bone)' }}>PANEL · CONTENT</span>
    </div>
    <SerialStamp style={{ position: 'absolute', bottom: 10, left: 10 }} color="var(--pewter)">0x7A3F · 04-N</SerialStamp>
  </Demo>
);

/* 2 — CORE · BOLTED -------------------------------------------------------- */
const Frame_Engraved = () => (
  <Demo label="core · bolted" sub="бронепластина · скос угла">
    {/* outer chamfered plate */}
    <div style={{
      position: 'absolute', inset: 8,
      background: 'linear-gradient(180deg, rgba(212,160,66,0.06), transparent 40%)',
      border: '1px solid var(--gold-dim)',
      clipPath: CLIP.bothSides,
    }} />
    {/* inner hairline frame */}
    <div style={{
      position: 'absolute', inset: 14,
      border: '1px solid var(--gold)',
      clipPath: CLIP.bothSides,
    }} />
    {/* technical band top */}
    <div style={{
      position: 'absolute', top: 16, left: 20, right: 20,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      borderBottom: '1px solid var(--gold-dim)', paddingBottom: 6,
    }}>
      <SerialStamp color="var(--gold)">RX-04 // 0xA3F</SerialStamp>
      <span className="mono-sm" style={{ color: 'var(--gold)' }}>// CORE · 1.2</span>
    </div>
    {/* hex bolts at four inner corners */}
    <BoltHead size={9} style={{ top: 32, left: 24 }} />
    <BoltHead size={9} style={{ top: 32, right: 24 }} />
    <BoltHead size={9} style={{ bottom: 24, left: 24 }} />
    <BoltHead size={9} style={{ bottom: 24, right: 24 }} />
    {/* central content */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'var(--gold)' }}>
        ЯДРО · ЗАКРЕПЛЕНО
      </span>
      <span className="mono-sm">torque · 14.6 nm</span>
    </div>
    {/* edge fingers bottom */}
    <EdgeFingers count={16} color="var(--gold-dim)" style={{ position: 'absolute', bottom: 16, left: 28, right: 28 }} />
  </Demo>
);

/* 3 — DATA · COBALT (scanner panel) ---------------------------------------- */
const Frame_DataCold = () => (
  <Demo label="data · cobalt" sub="системный сканер · live">
    <div style={{ position: 'absolute', inset: 0, border: '1px solid var(--cobalt)' }} />
    {/* top serial bar */}
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 18,
      borderBottom: '1px solid var(--cobalt-dim)',
      background: 'rgba(58,126,200,0.08)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px',
    }}>
      <span className="mono-sm" style={{ color: 'var(--cobalt)' }}>// SYS · 0x7A3F</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <span style={{ width: 6, height: 6, background: 'var(--cobalt)' }} className="pulse-dot" />
        <span className="mono-sm" style={{ color: 'var(--cobalt)' }}>SCAN</span>
      </span>
    </div>
    {/* bottom thin pad */}
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 12, background: 'rgba(58,126,200,0.08)', borderTop: '1px solid var(--cobalt-dim)' }} />
    <EdgeFingers count={20} color="var(--cobalt)" style={{ position: 'absolute', bottom: 2, left: 8, right: 8 }} />

    {/* corner crosshair targets */}
    {['nw','ne','sw','se'].map(c => (
      <svg key={c} width="18" height="18" viewBox="0 0 18 18" style={{
        position: 'absolute',
        top:  c[0] === 'n' ? 22 : 'auto',
        bottom: c[0] === 's' ? 16 : 'auto',
        left: c[1] === 'w' ? 8 : 'auto',
        right: c[1] === 'e' ? 8 : 'auto',
      }}>
        <line x1="9" y1="0" x2="9" y2="6" stroke="var(--cobalt)" strokeWidth="1" />
        <line x1="9" y1="12" x2="9" y2="18" stroke="var(--cobalt)" strokeWidth="1" />
        <line x1="0" y1="9" x2="6" y2="9" stroke="var(--cobalt)" strokeWidth="1" />
        <line x1="12" y1="9" x2="18" y2="9" stroke="var(--cobalt)" strokeWidth="1" />
        <circle cx="9" cy="9" r="2" fill="none" stroke="var(--cobalt)" strokeWidth="0.8" />
      </svg>
    ))}

    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
      <span className="mono" style={{ color: 'var(--cobalt)' }}>DATA · LOCK</span>
      <span className="mono-sm">res 0.42 · drift −0.02</span>
    </div>
  </Demo>
);

/* 4 — WARNING · BLOOD (critical) ------------------------------------------ */
const Frame_Blood = () => (
  <Demo label="warning · blood" sub="критический отказ · halt">
    <div style={{ position: 'absolute', inset: 0, border: '1px solid var(--blood)', boxShadow: 'inset 0 0 28px -8px rgba(168,40,28,0.35)' }} />
    {/* hazard tape: top + bottom diagonal */}
    {['top','bottom'].map(v => (
      <div key={v} style={{
        position: 'absolute', [v]: -1, left: 0, right: 0, height: 8,
        backgroundImage: 'repeating-linear-gradient(135deg, var(--blood) 0 10px, var(--earth) 10px 20px)',
      }} />
    ))}
    {/* corner hex bolts */}
    <BoltHead size={10} color="var(--blood-bright)" style={{ top: 12, left: 12 }} />
    <BoltHead size={10} color="var(--blood-bright)" style={{ top: 12, right: 12 }} />
    <BoltHead size={10} color="var(--blood-bright)" style={{ bottom: 12, left: 12 }} />
    <BoltHead size={10} color="var(--blood-bright)" style={{ bottom: 12, right: 12 }} />
    {/* center bracket frame */}
    <div style={{
      position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      padding: '14px 28px',
      borderTop: '1px solid var(--blood-bright)',
      borderBottom: '1px solid var(--blood-bright)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em',
        color: 'var(--blood-bright)', textTransform: 'uppercase',
      }}>HULL · CRITICAL</span>
      <span className="mono-sm" style={{ color: 'var(--blood-bright)' }}>FAULT · 0xE204</span>
    </div>
    <SerialStamp color="var(--blood-bright)" style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)' }}>
      ⚠ ABORT · TR-014
    </SerialStamp>
  </Demo>
);

/* 5 — SKVERNA · TOXIC ------------------------------------------------------ */
const Frame_Toxic = () => (
  <Demo label="skverna · toxic" sub="опасный фон · радиация">
    {/* outer toxic border (chamfered) */}
    <div style={{
      position: 'absolute', inset: 0, border: '1px solid var(--toxic)',
      clipPath: CLIP.smallTR_BL,
    }} />
    {/* dashed inner */}
    <div style={{
      position: 'absolute', inset: 10, border: '1px dashed var(--toxic-dim)',
      clipPath: CLIP.smallTR_BL,
    }} />
    {/* hazard tape — left vertical */}
    <div style={{
      position: 'absolute', top: 18, bottom: 18, left: 18, width: 6,
      backgroundImage: 'repeating-linear-gradient(45deg, var(--toxic) 0 6px, var(--earth) 6px 12px)',
    }} />
    {/* stencil number top-right */}
    <SerialStamp color="var(--toxic)" style={{ position: 'absolute', top: 12, right: 26 }}>
      R-04 · HOT
    </SerialStamp>
    {/* bolts on corners except TR */}
    <BoltHead size={9} color="var(--toxic)" style={{ top: 12, left: 30 }} />
    <BoltHead size={9} color="var(--toxic)" style={{ bottom: 12, left: 30 }} />
    <BoltHead size={9} color="var(--toxic)" style={{ bottom: 12, right: 12 }} />
    {/* live radial meter */}
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ position: 'absolute', right: 16, bottom: 16 }}>
      <circle cx="24" cy="24" r="20" stroke="var(--toxic-dim)" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="20" stroke="var(--toxic)" strokeWidth="2" fill="none"
        strokeDasharray="80 125" strokeDashoffset="0" transform="rotate(-90 24 24)" />
      <text x="24" y="28" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fontWeight="700" fill="var(--toxic)">6.4</text>
    </svg>
    <div style={{ position: 'absolute', left: 38, top: '50%', transform: 'translateY(-50%)' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--toxic)', textTransform: 'uppercase', letterSpacing: '-0.02em', lineHeight: 1 }}>
        SKVERNA<br/>ZONE
      </div>
      <div className="mono-sm" style={{ color: 'var(--toxic)', marginTop: 6 }}>RAD 6.4 r/s</div>
    </div>
  </Demo>
);

/* 6 — MODULE · LOCKED (PCB insert) ---------------------------------------- */
const Frame_Found = () => (
  <Demo label="module · slotted" sub="PCB · вставленный модуль">
    {/* outer plate (chamfered both corners) */}
    <div style={{
      position: 'absolute', inset: 0,
      background: 'linear-gradient(180deg, var(--earth), var(--night))',
      border: '1px solid var(--ash)',
      clipPath: CLIP.bothSides,
    }} />
    {/* inner inset PCB */}
    <div style={{
      position: 'absolute', inset: 22,
      border: '1px solid var(--gold-dim)',
      background: 'rgba(212,160,66,0.04)',
      clipPath: CLIP.bothSides,
    }} />
    {/* top label band */}
    <div style={{
      position: 'absolute', top: 8, left: 30, right: 30,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <SerialStamp color="var(--gold)">M-DRILL · V.2</SerialStamp>
      <span className="mono-sm" style={{ color: 'var(--gold)' }}>SLOT · 04 / 19</span>
    </div>
    {/* edge connectors top + bottom */}
    <EdgeFingers count={18} color="var(--gold)" style={{ position: 'absolute', top: 16, left: 34, right: 34, height: 3 }} />
    <EdgeFingers count={18} color="var(--gold)" style={{ position: 'absolute', bottom: 12, left: 34, right: 34, height: 3 }} />

    {/* IC chips inside */}
    <div style={{ position: 'absolute', left: 36, top: 50, width: 30, height: 18, background: 'var(--night)', border: '1px solid var(--gold-dim)' }}>
      <span style={{ position:'absolute', top:1, left:1, width:2, height:2, background:'var(--gold-bright)' }} />
    </div>
    <div style={{ position: 'absolute', right: 36, top: 50, width: 22, height: 18, background: 'var(--night)', border: '1px solid var(--gold-dim)' }} />
    {/* trace lines */}
    <svg width="100%" height="100%" viewBox="0 0 220 200" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <path d="M30 110 H 90 L 100 120 H 130 L 140 110 H 190" stroke="var(--gold)" strokeWidth="0.7" fill="none" />
      <path d="M30 130 H 80 L 90 140 H 200" stroke="var(--gold-dim)" strokeWidth="0.7" fill="none" />
      <circle cx="90" cy="120" r="1.5" fill="var(--gold)" />
      <circle cx="140" cy="110" r="1.5" fill="var(--gold)" />
      <circle cx="90" cy="140" r="1.5" fill="var(--gold-dim)" />
    </svg>
    {/* bolts at the four locked points */}
    <BoltHead size={8} style={{ top: 25, left: 25 }} />
    <BoltHead size={8} style={{ top: 25, right: 25 }} />
    <BoltHead size={8} style={{ bottom: 18, left: 25 }} />
    <BoltHead size={8} style={{ bottom: 18, right: 25 }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30, display: 'flex', justifyContent: 'center' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
        МОДУЛЬ · ЗАКРЕПЛЁН
      </span>
    </div>
  </Demo>
);

const FramesBlock = () => (
  <Row label="01 · РАМКИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Шесть техно-рамок. Никаких скруглений и filigree-винтажа: словарь — <b>скошенные углы (clip-path)</b>, <b>стенд-маркировка</b>, <b>гексагональные болты</b>, <b>PCB-«пальцы»</b> по краям, <b>опасные ленты</b>, <b>точечные LED-индикаторы</b>. Каждая рамка живёт ровно в одной из четырёх семантик: <b className="gold-c">золото</b> (важно/закреплено), <b className="data-c">кобальт</b> (data live), <b className="blood-c">кровь</b> (отказ/угроза), <b className="signal">скверна</b> (опасный фон).
    </p>
    <div className="grid-3" style={{ marginTop: 32 }}>
      <Frame_BasicBracket />
      <Frame_Engraved />
      <Frame_DataCold />
      <Frame_Blood />
      <Frame_Toxic />
      <Frame_Found />
    </div>
    <div className="bracket" style={{ marginTop: 28 }}>
      <span className="mono" style={{ color: 'var(--gold)', display: 'block', marginBottom: 6 }}>ПРАВИЛО ТЕХНО-РАМКИ</span>
      В рамке всегда есть <b>хотя бы один</b> технический атрибут кроме контура: серийник, болт, индикатор, PCB-пальцы или клипнутый угол. Голый прямоугольник без атрибутов — это не рамка системы, это div.
    </div>
  </Row>
);

/* ===== OVERLAYS ========================================================= */

const OverlaysBlock = () => (
  <Row label="02 · ОБРАБОТКА">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Поверх любой панели наслаиваются четыре эффекта: <b className="chalk-c">сканлайны</b> (всегда),
      <b className="chalk-c"> зерно</b> (везде, mix-blend overlay), <b className="chalk-c">сетка</b> (только на data-панелях),
      <b className="chalk-c"> виньетка</b> (драматические экраны). Никаких других «текстур».
    </p>

    <div className="grid-4" style={{ marginTop: 32 }}>
      <Demo label="scanlines" sub="2/3 px · always on" height={160}>
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scanlines)' }} />
      </Demo>
      <Demo label="grain" sub="3px noise" height={160}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain)', mixBlendMode: 'overlay', opacity: 0.6 }} />
      </Demo>
      <Demo label="grid · 12" sub="data overlay" height={160}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grid-fine)' }} />
      </Demo>
      <Demo label="vignette" sub="drama only" height={160}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 30%, rgba(7,5,10,0.85) 100%)' }} />
      </Demo>
      <Demo label="grid · 48" sub="map / world" height={160}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grid-coarse)' }} />
      </Demo>
      <Demo label="hatch · gold" sub="ритуальная штриховка" height={160}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--filigree)', opacity: 1 }} />
      </Demo>
      <Demo label="dim wash" sub="отключённое состояние" height={160}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(7,5,10,0.65)' }} />
      </Demo>
      <Demo label="layered" sub="всё вместе → mood" height={160}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grid-coarse)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain)', mixBlendMode: 'overlay', opacity: 0.7 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'var(--scanlines)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(7,5,10,0.7) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="mono" style={{ color: 'var(--gold)' }}>// VOID</span>
        </div>
      </Demo>
    </div>
  </Row>
);

/* ===== GLOWS ============================================================ */

const GlowDemo = ({ kind, label, ring }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{
      height: 160, background: 'var(--night)',
      border: '1px solid var(--bronze)',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 64, height: 64,
        background: kind === 'toxic' ? 'var(--toxic)' : kind === 'blood' ? 'var(--blood-bright)' : kind === 'gold' ? 'var(--gold)' : kind === 'amber' ? 'var(--amber)' : 'var(--cobalt)',
        boxShadow:
          kind === 'toxic' ? 'var(--glow-toxic)' :
          kind === 'blood' ? 'var(--glow-blood)' :
          kind === 'gold'  ? 'var(--glow-gold)' :
          kind === 'amber' ? 'var(--glow-amber)' :
          '0 0 0 1px rgba(58,126,200,0.6), 0 0 24px -4px rgba(58,126,200,0.5)',
        clipPath: 'polygon(0 12%, 12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%)',
      }} />
      {ring && (
        <div style={{
          position: 'absolute',
          width: 110, height: 110,
          border: `1px solid var(--${kind})`,
          opacity: 0.5,
          borderRadius: '50%',
          animation: 'pulse 1.8s linear infinite',
        }} />
      )}
    </div>
    <div className="mono-sm" style={{ color: `var(--${kind === 'toxic' ? 'toxic' : kind === 'blood' ? 'blood-bright' : kind})` }}>{label}</div>
  </div>
);

const GlowsBlock = () => (
  <Row label="03 · СВЕТ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Свет — только точечный, только односторонний. Никакого халo, никаких градиентов-сияний на весь экран. Свечение всегда привязано к источнику, который виден в кадре: лампа, глаз, осколок скверны.
    </p>
    <div className="grid-4" style={{ marginTop: 32 }}>
      <GlowDemo kind="gold"   label="// GOLD · РИТУАЛ" />
      <GlowDemo kind="blood"  label="// BLOOD · УГРОЗА" />
      <GlowDemo kind="toxic"  label="// TOXIC · СКВЕРНА" ring />
      <GlowDemo kind="amber"  label="// AMBER · ТЕПЛО" />
      <GlowDemo kind="cobalt" label="// COBALT · ДАННЫЕ" ring />
      <div style={{
        height: 160, background: 'var(--night)',
        border: '1px solid var(--bronze)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6,
        padding: 16,
      }}>
        <span className="mono-sm" style={{ color: 'var(--blood-bright)' }}>// БЕЗ</span>
        <span style={{ fontSize: 12, color: 'var(--pewter)', textAlign: 'center', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>
          Не используйте text-shadow, soft-glow и blur ≥ 16 px. Они убивают плотность.
        </span>
      </div>
    </div>
  </Row>
);

/* ===== DIVIDERS ========================================================= */

const DividersBlock = () => (
  <Row label="04 · РАЗДЕЛИТЕЛИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Восемь способов разорвать кадр. Дашед-линия — мягкое отделение. Двойная — заголовок. Золотая — что-то началось. Точки — пауза. Тяжёлая блочная — конец раздела.
    </p>

    <div style={{ marginTop: 32, padding: '32px 28px', background: 'var(--night)', border: '1px solid var(--bronze)' }}>

      <DividerRow name="hairline · default" demo={<hr style={{ height: 1, background: 'var(--bronze)', border: 'none' }} />} />
      <DividerRow name="hairline · dashed"  demo={<hr style={{ height: 1, background: 'none', borderTop: '1px dashed var(--ash)', border: 'none', borderBottom: 0, borderLeft: 0, borderRight: 0 }} />} />
      <DividerRow name="gold · 80px"        demo={<div style={{ height: 1, width: 80, background: 'var(--gold)' }} />} />
      <DividerRow name="gold · gradient"    demo={<div style={{ height: 1, background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />} />
      <DividerRow name="inscription"        demo={
        <div className="inscription"><span>// ВПИСАНО В МЕТАЛЛ</span></div>
      } />
      <DividerRow name="bracket · marker"   demo={
        <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
          <span className="mono" style={{ color: 'var(--gold)' }}>⟨ ОТДЕЛ 04 ⟩</span>
          <span style={{ flex: 1, height: 1, background: 'var(--bronze)' }} />
        </div>
      } />
      <DividerRow name="dotted · pause"     demo={
        <div style={{ display:'flex', gap: 6 }}>
          {[...Array(60)].map((_, i) => <span key={i} style={{ width: 2, height: 2, background: 'var(--ash)' }} />)}
        </div>
      } />
      <DividerRow name="hazard · end"       demo={
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(32, 1fr)', height: 6 }}>
          {[...Array(32)].map((_, i) => <span key={i} style={{ background: i % 2 ? 'var(--gold)' : 'var(--bronze)' }} />)}
        </div>
      } />
    </div>
  </Row>
);

const DividerRow = ({ name, demo }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 24, alignItems: 'center', padding: '14px 0', borderTop: '1px dashed var(--carbon)' }}>
    <span className="mono-sm" style={{ color: 'var(--bone)' }}>{name}</span>
    <div>{demo}</div>
  </div>
);

/* ===== ENGRAVED ORNAMENT ================================================ */

const EngraveBlock = () => (
  <Row label="05 · ГРАВИРОВКА">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Каждая важная панель несёт «гравировку» — хайрлайновую орнаментику. Её рисуют SVG или CSS-маски, никаких растровых изображений. Орнамент <b>читается, но не отвлекает</b>: stroke-width не больше 1 px, цвет — <span className="gold-c">--gold-dim</span>.
    </p>

    <div className="grid-3" style={{ marginTop: 32 }}>
      <EngravedPlate>
        <EngraveSun />
      </EngravedPlate>
      <EngravedPlate>
        <EngraveSpiral />
      </EngravedPlate>
      <EngravedPlate>
        <EngraveGrid />
      </EngravedPlate>
      <EngravedPlate>
        <EngraveRunes />
      </EngravedPlate>
      <EngravedPlate>
        <EngraveCircuit />
      </EngravedPlate>
      <EngravedPlate>
        <EngraveBars />
      </EngravedPlate>
    </div>
  </Row>
);

const EngravedPlate = ({ children }) => (
  <div style={{
    aspectRatio: '1 / 1',
    background: 'var(--night)',
    border: '1px solid var(--gold-dim)',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', inset: 8, border: '1px solid var(--gold-dim)' }} />
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
    {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
      <span key={v+h} style={{
        position: 'absolute', [v]: -1, [h]: -1, width: 12, height: 12,
        [`border${v==='top'?'Top':'Bottom'}`]: '1px solid var(--gold)',
        [`border${h==='left'?'Left':'Right'}`]: '1px solid var(--gold)',
      }} />
    ))}
  </div>
);

const EngraveSun = () => (
  <svg width="80%" height="80%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.6" fill="none">
    <circle cx="0" cy="0" r="14" />
    <circle cx="0" cy="0" r="10" />
    {[...Array(24)].map((_, i) => {
      const a = i * Math.PI / 12;
      const r1 = 18, r2 = i % 2 ? 30 : 24;
      return <line key={i} x1={r1 * Math.cos(a)} y1={r1 * Math.sin(a)} x2={r2 * Math.cos(a)} y2={r2 * Math.sin(a)} />;
    })}
    <circle cx="0" cy="0" r="34" strokeDasharray="2 4" />
    <circle cx="0" cy="0" r="40" strokeDasharray="1 6" opacity="0.7" />
  </svg>
);

const EngraveSpiral = () => (
  <svg width="80%" height="80%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.6" fill="none">
    {[...Array(8)].map((_, i) => (
      <circle key={i} cx="0" cy="0" r={4 + i * 5} strokeDasharray={`${1 + i} ${2 + i}`} />
    ))}
    <line x1="-44" y1="0" x2="44" y2="0" />
    <line x1="0" y1="-44" x2="0" y2="44" />
    <line x1="-32" y1="-32" x2="32" y2="32" strokeDasharray="1 3" />
    <line x1="-32" y1="32" x2="32" y2="-32" strokeDasharray="1 3" />
  </svg>
);

const EngraveGrid = () => (
  <svg width="86%" height="86%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.6" fill="none">
    <rect x="-40" y="-40" width="80" height="80" />
    <rect x="-30" y="-30" width="60" height="60" />
    {[...Array(7)].map((_, i) => {
      const o = -30 + i * 10;
      return <g key={i}>
        <line x1={o} y1="-40" x2={o} y2="-30" />
        <line x1={o} y1="30" x2={o} y2="40" />
        <line x1="-40" y1={o} x2="-30" y2={o} />
        <line x1="30" y1={o} x2="40" y2={o} />
      </g>;
    })}
    <circle cx="0" cy="0" r="6" fill="var(--gold)" />
    <circle cx="0" cy="0" r="14" />
    {[[30,30],[30,-30],[-30,30],[-30,-30]].map(([x,y]) => (
      <rect key={x+','+y} x={x-3} y={y-3} width="6" height="6" fill="var(--gold-dim)" />
    ))}
  </svg>
);

const EngraveRunes = () => (
  <svg width="86%" height="86%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.8" fill="none">
    <path d="M-30 -40 V40 M-30 -40 L-10 -20 M-30 -10 L-15 -25 M-30 10 L-12 -2 M-30 30 L-12 40" />
    <path d="M0 -40 V40 M0 -40 L20 -20 M0 0 L20 -20 M0 0 L18 18 M0 20 L20 40" />
    <path d="M30 -40 V40 M30 -40 L40 -28 M30 -28 L40 -16 M30 -16 L40 -4 M30 -4 L40 8 M30 8 L40 20 M30 20 L40 32" />
  </svg>
);

const EngraveCircuit = () => (
  <svg width="86%" height="86%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.6" fill="none">
    <path d="M-40 -20 H-20 V-40 H0 V-20 H20 V0 H40" />
    <path d="M-40 20 H-20 V40 H0 V20 H20 V0" />
    <path d="M-40 0 H-30 V-10 H-20" />
    {[[-40,-20],[-20,-40],[0,-20],[20,0],[40,0],[-40,20],[-20,40],[0,20]].map(([x,y]) => (
      <circle key={x+','+y} cx={x} cy={y} r="1.5" fill="var(--gold)" />
    ))}
    <rect x="-6" y="-6" width="12" height="12" fill="var(--gold-dim)" stroke="var(--gold)" />
    <line x1="6" y1="0" x2="20" y2="0" />
    <line x1="0" y1="-6" x2="0" y2="-20" />
  </svg>
);

const EngraveBars = () => (
  <svg width="86%" height="86%" viewBox="-50 -50 100 100" stroke="var(--gold)" strokeWidth="0.6" fill="none">
    {[...Array(12)].map((_, i) => {
      const y = -36 + i * 6;
      const w = 60 - Math.abs(i - 6) * 4 - (i % 3) * 3;
      return <line key={i} x1={-w/2} y1={y} x2={w/2} y2={y} strokeWidth={i === 6 ? 1.2 : 0.6} />;
    })}
    <line x1="0" y1="-40" x2="0" y2="40" strokeDasharray="1 2" />
    <circle cx="0" cy="0" r="3" fill="var(--gold)" />
  </svg>
);

const TextureSection = () => (
  <Section
    ord="02 · ATMOSPHERE"
    id="texture"
    title="Атмосфера"
    lede="Как делается «мрачная неизведанность» в плоскости UI. Рамки, обработка, свет, разделители, гравированный орнамент. Каждый из этих приёмов работает поодиночке, но сила — в наслоении.">
    <FramesBlock />
    <OverlaysBlock />
    <GlowsBlock />
    <DividersBlock />
    <EngraveBlock />
  </Section>
);

Object.assign(window, { TextureSection, BoltHead, SerialStamp, EdgeFingers, CLIP });
