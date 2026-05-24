// 08 — SCREENS v3: techno-frame language ported across all 6 mockups.
// Uses BoltHead, SerialStamp, EdgeFingers from §02 — same vocabulary everywhere.

/* ===== SCREEN CHROME ==================================================== */

const ScreenFrame = ({ label, sublabel, serial = '0x7A3F', children, minHeight = 660 }) => (
  <div style={{ background: 'var(--night)', border: '1px solid var(--bronze)', padding: 14 }}>
    {/* tech header bar */}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 14px', marginBottom: 10,
      background: 'var(--earth)',
      border: '1px solid var(--bronze)',
      borderLeft: '3px solid var(--gold)',
    }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span className="mono-sm" style={{ color: 'var(--gold)' }}>{label}</span>
        <SerialStamp color="var(--pewter)">FRAME // {serial}</SerialStamp>
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--toxic)' }} />
          <span className="mono-sm" style={{ color: 'var(--toxic)' }}>LIVE</span>
        </span>
        <span className="mono-sm">{sublabel}</span>
      </div>
    </div>
    {/* viewport */}
    <div style={{
      position: 'relative',
      background: 'var(--pit)',
      border: '1px solid var(--bronze)',
      aspectRatio: '16/9',
      minHeight,
      overflow: 'hidden',
    }}>
      {children}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scanlines)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 55%, transparent 30%, rgba(7,5,10,0.55) 100%)', pointerEvents: 'none' }} />
    </div>
    {/* PCB fingers below viewport */}
    <EdgeFingers count={32} color="var(--bronze)" style={{ marginTop: 8, height: 5 }} />
  </div>
);

const ScreenCorners = ({ color = 'var(--gold)', inset = 16, size = 18 }) => (
  <>
    {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
      <span key={v+h} style={{
        position: 'absolute',
        [v]: inset, [h]: inset, width: size, height: size,
        [`border${v==='top'?'Top':'Bottom'}`]: `1px solid ${color}`,
        [`border${h==='left'?'Left':'Right'}`]: `1px solid ${color}`,
        pointerEvents: 'none',
      }} />
    ))}
  </>
);

/* tech panel — used inside screens for HUD widgets */
const TechPanel = ({ children, accent = 'var(--gold)', serial, label, bolts = true, style, fingers = false }) => (
  <div style={{
    position: 'relative',
    background: 'rgba(13,10,14,0.94)',
    border: `1px solid ${accent === 'var(--gold)' ? 'var(--bronze)' : accent}`,
    padding: '14px 16px',
    ...style,
  }}>
    {/* corner brackets */}
    {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
      <span key={v+h} style={{
        position:'absolute', [v]:-1, [h]:-1, width:12, height:12,
        [`border${v==='top'?'Top':'Bottom'}`]: `1px solid ${accent}`,
        [`border${h==='left'?'Left':'Right'}`]: `1px solid ${accent}`,
      }}/>
    ))}
    {/* bolt heads */}
    {bolts && (
      <>
        <BoltHead size={7} color={accent} style={{ top: 4, left: 4 }} />
        <BoltHead size={7} color={accent} style={{ top: 4, right: 4 }} />
        <BoltHead size={7} color={accent} style={{ bottom: 4, left: 4 }} />
        <BoltHead size={7} color={accent} style={{ bottom: 4, right: 4 }} />
      </>
    )}
    {(label || serial) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingLeft: 12, paddingRight: 12 }}>
        {label && <span className="mono-sm" style={{ color: accent }}>{label}</span>}
        {serial && <SerialStamp color={accent === 'var(--gold)' ? 'var(--pewter)' : accent}>{serial}</SerialStamp>}
      </div>
    )}
    <div style={{ paddingLeft: 8, paddingRight: 8 }}>{children}</div>
    {fingers && <EdgeFingers count={20} color={accent} style={{ position: 'absolute', bottom: 8, left: 14, right: 14, height: 3 }} />}
  </div>
);

/* hazard tape strip */
const HazardTape = ({ color = 'var(--blood)', direction = 'top', size = 8 }) => (
  <div style={{
    position: 'absolute',
    [direction]: 0,
    left: 0, right: 0, height: size,
    backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 12px, var(--earth) 12px 24px)`,
  }} />
);

const HazardTapeV = ({ color = 'var(--toxic)', side = 'left', size = 8 }) => (
  <div style={{
    position: 'absolute',
    [side]: 0,
    top: 0, bottom: 0, width: size,
    backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 10px, var(--earth) 10px 20px)`,
  }} />
);

/* void stage background */
const VoidStage = ({ glints = [] }) => (
  <svg width="100%" height="100%" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
    <defs>
      <radialGradient id="vsLight" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="rgba(212,160,66,0.06)" />
        <stop offset="100%" stopColor="rgba(212,160,66,0)" />
      </radialGradient>
      <radialGradient id="vsBlood" cx="80%" cy="30%" r="40%">
        <stop offset="0%" stopColor="rgba(168,40,28,0.10)" />
        <stop offset="100%" stopColor="rgba(168,40,28,0)" />
      </radialGradient>
      <pattern id="vsGrid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M0 0 H48 M0 0 V48" stroke="rgba(122,112,94,0.06)" strokeWidth="1" />
      </pattern>
    </defs>
    <rect width="1280" height="720" fill="var(--pit)" />
    <rect width="1280" height="720" fill="url(#vsGrid)" />
    <rect width="1280" height="720" fill="url(#vsLight)" />
    <rect width="1280" height="720" fill="url(#vsBlood)" />
    {glints.map((g, i) => (
      <g key={i} transform={`translate(${g.x}, ${g.y})`}>
        <circle r={g.r || 2} fill={g.color} />
        <circle r={(g.r || 2) * 6} fill={g.color} opacity="0.18" />
      </g>
    ))}
  </svg>
);

/* =====================================================================
   01 — MAIN MENU
   ===================================================================== */

const MainMenuScreen = () => (
  <ScreenFrame label="// 01 · ГЛАВНОЕ МЕНЮ" sublabel="1920×1080" serial="MENU // 04-N">
    <VoidStage glints={[
      { x: 280, y: 360, color: '#d4a042', r: 3 },
      { x: 940, y: 480, color: '#f08a2a', r: 2.5 },
      { x: 1100, y: 280, color: '#a8281c', r: 2 },
      { x: 520, y: 580, color: '#c8e25a', r: 2 },
    ]} />

    {/* top hazard ribbon */}
    <HazardTape color="var(--gold-dim)" direction="top" size={6} />

    {/* top-left mark */}
    <div style={{ position: 'absolute', top: 32, left: 48, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <SerialStamp color="var(--gold)">TWILIGHT-WORLD // M1.0</SerialStamp>
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <SerialStamp color="var(--pewter)">SECTOR 04-N</SerialStamp>
        <SerialStamp color="var(--pewter)">SEED 0x7A3F</SerialStamp>
      </div>
    </div>

    {/* top-right status cluster */}
    <div style={{ position: 'absolute', top: 32, right: 48, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <span className="pulse-dot" style={{ width: 8, height: 8, background: 'var(--cobalt)' }} />
        <span className="mono-sm" style={{ color: 'var(--cobalt)' }}>ЯДРО ИИ · АКТИВНО</span>
      </span>
      <span className="mono-sm" style={{ color: 'var(--ash)' }}>UPLINK · 94% · TR-014</span>
      <span className="mono-sm" style={{ color: 'var(--toxic)' }}>SKVERNA · 0.2 r/s</span>
    </div>

    {/* hero title — left */}
    <div style={{ position: 'absolute', left: 64, top: '32%' }}>
      <div className="mono-sm" style={{ color: 'var(--gold)', letterSpacing: '0.32em', marginBottom: 18 }}>
        // ROGUELITE · DIG · M1.0 ──────
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 132, fontWeight: 800,
        lineHeight: 0.86,
        color: 'var(--chalk)',
        textTransform: 'uppercase',
        letterSpacing: '-0.04em',
      }}>
        Сумерки<br/>
        <span style={{ color: 'var(--gold)' }}>Мира</span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--bone)', marginTop: 22, maxWidth: 420, lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>
        Ты — ИИ. Принтер ещё работает. Снаружи — скверна и древние города, которые ничего о тебе не знают.
      </div>
    </div>

    {/* menu list — right */}
    <div style={{ position: 'absolute', right: 64, top: '38%', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 360 }}>
      <MenuLine n="01" k="НОВЫЙ ЗАБЕГ"  d="2 юнита · seed: random"   active />
      <MenuLine n="02" k="ПРОДОЛЖИТЬ"   d="run #14 · глубина 78" />
      <MenuLine n="03" k="АРХИВ"        d="best: 124 · runs: 17" />
      <MenuLine n="04" k="НАСТРОЙКИ"    d="управление, экран, звук" />
      <MenuLine n="05" k="ВЫЙТИ"        d="разорвать связь" muted />
    </div>

    {/* bottom system bar */}
    <div style={{ position: 'absolute', left: 48, right: 48, bottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SerialStamp color="var(--pewter)">▶ ENTER · ПОДТВЕРДИТЬ</SerialStamp>
      <SerialStamp color="var(--pewter)">↑↓ · ВЫБОР</SerialStamp>
      <SerialStamp color="var(--pewter)">ESC · ВЫХОД</SerialStamp>
      <SerialStamp color="var(--toxic)">SKVERNA · 0.2 r/s</SerialStamp>
    </div>
  </ScreenFrame>
);

const MenuLine = ({ n, k, d, active, muted }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '40px 1fr 16px',
    gap: 16, alignItems: 'center',
    padding: '15px 22px',
    background: active ? 'rgba(212,160,66,0.06)' : 'transparent',
    border: active ? '1px solid var(--gold)' : '1px solid transparent',
    color: muted ? 'var(--ash)' : active ? 'var(--chalk)' : 'var(--bone)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    fontSize: 14,
    position: 'relative',
    clipPath: active ? 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)' : 'none',
  }}>
    {active && (
      <>
        <BoltHead size={7} style={{ top: 5, left: 5 }} />
        <BoltHead size={7} style={{ bottom: 5, left: 5 }} />
        <BoltHead size={7} style={{ bottom: 5, right: 5 }} />
        <span className="pulse-dot" style={{
          position: 'absolute', top: 5, right: 20,
          width: 6, height: 6, background: 'var(--gold)',
        }} />
      </>
    )}
    <span style={{ color: active ? 'var(--gold)' : 'var(--ash)' }}>{n}</span>
    <div>
      <div>{k}</div>
      <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'var(--ash)', marginTop: 4 }}>{d}</div>
    </div>
    <span style={{ color: active ? 'var(--gold)' : 'transparent', fontWeight: 700 }}>{active ? '▶' : ''}</span>
  </div>
);

/* =====================================================================
   02 — HUD
   ===================================================================== */

const HudScreen = () => (
  <ScreenFrame label="// 02 · HUD · IN-MINE" sublabel="active run · depth −124" serial="HUD // TR-014">
    <VoidStage glints={[
      { x: 380, y: 380, color: '#d4a042', r: 1.5 },
      { x: 820, y: 420, color: '#c8e25a', r: 2 },
      { x: 980, y: 340, color: '#f08a2a', r: 1.5 },
      { x: 220, y: 540, color: '#8a7ed4', r: 1.5 },
      { x: 1080, y: 540, color: '#a8281c', r: 2 },
    ]} />

    {/* central "unit slot" — abstract bay */}
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 260, height: 260,
      clipPath: 'polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px))',
      border: '1px dashed var(--gold-dim)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <BoltHead size={9} style={{ top: 6, left: 22 }} />
      <BoltHead size={9} style={{ top: 6, right: 22 }} />
      <BoltHead size={9} style={{ bottom: 6, left: 22 }} />
      <BoltHead size={9} style={{ bottom: 6, right: 22 }} />
      <div style={{ width: 100, height: 100, border: '1px solid var(--gold)', position: 'relative' }}>
        <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(212,160,66,0.3), transparent 70%)' }} />
        <SerialStamp color="var(--gold)" style={{ position: 'absolute', top: -22, left: 0 }}>UNIT SLOT</SerialStamp>
        <SerialStamp color="var(--pewter)" style={{ position: 'absolute', bottom: -22, right: 0 }}>render → game</SerialStamp>
      </div>
    </div>

    {/* TOP LEFT — vitals */}
    <div style={{ position: 'absolute', top: 32, left: 32, width: 310 }}>
      <TechPanel accent="var(--gold)" label="// ЮНИТ-014 · НОРД" serial="TR-014">
        <Bar label="HP / КОРПУС"      value={62} max={100} kind="hp" />
        <div style={{ height: 8 }} />
        <Bar label="ENERGY / ЭНЕРГИЯ" value={42} max={100} kind="energy" />
        <div style={{ height: 8 }} />
        <Bar label="LINK / СВЯЗЬ"     value={94} max={100} kind="data" size="thin" />
      </TechPanel>
    </div>

    {/* TOP RIGHT — depth */}
    <div style={{ position: 'absolute', top: 32, right: 32, minWidth: 220 }}>
      <TechPanel accent="var(--cobalt)" label="// DEPTH · GAUGE" serial="Z 0.42">
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, color: 'var(--chalk)', letterSpacing: '-0.03em', lineHeight: 1 }}>−124</div>
          <div className="mono-sm" style={{ color: 'var(--cobalt)', marginTop: 10 }}>CYCLE 3 · WAVE 2</div>
          <div className="mono-sm" style={{ color: 'var(--blood-bright)', marginTop: 4 }}>
            <span className="pulse-dot" style={{ display:'inline-block', width: 6, height: 6, background: 'var(--blood-bright)', marginRight: 6 }} />
            RAIDER · 18s
          </div>
        </div>
      </TechPanel>
    </div>

    {/* BOTTOM LEFT — cargo */}
    <div style={{ position: 'absolute', bottom: 32, left: 32 }}>
      <TechPanel accent="var(--gold)" label="// ГРУЗ · 4/8" serial="HOLD A" fingers>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 8 }}>
          {[
            ['iron',1],['iron',1],['organic',1],['crystal',1],
            ['empty',0],['empty',0],['empty',0],['empty',0],
          ].map(([t], i) => (
            <div key={i} style={{
              width: 34, height: 34,
              background: t === 'empty' ? 'transparent' : 'var(--earth)',
              border: t === 'empty' ? '1px dashed var(--carbon)' : '1px solid var(--ash)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t === 'iron' ? 'var(--bone)' : t === 'organic' ? 'var(--maya-jade)' : 'var(--crystal)',
              clipPath: t === 'empty' ? 'none' : 'polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px))',
            }}>
              {t === 'iron' && <SchemaIcons.casing />}
              {t === 'organic' && <SchemaIcons.cargo />}
              {t === 'crystal' && <SchemaIcons.scroll />}
            </div>
          ))}
        </div>
      </TechPanel>
    </div>

    {/* BOTTOM CENTER — skverna widget */}
    <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)' }}>
      <TechPanel accent="var(--toxic)" label="// КОЖУХ · ЩИТ" serial="R 2.1 / RES 1.8" bolts={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 2 }}>
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" stroke="var(--toxic-dim)" strokeWidth="2" fill="none" />
            <circle cx="24" cy="24" r="20" stroke="var(--toxic)" strokeWidth="2" fill="none"
              strokeDasharray="86 125" transform="rotate(-90 24 24)" />
            <circle cx="24" cy="24" r="4" fill="var(--toxic)" />
          </svg>
          <div>
            <div className="mono-sm" style={{ color: 'var(--toxic)' }}>ЩИТ ДЕРЖИТ</div>
            <div className="mono-sm" style={{ color: 'var(--ash)', marginTop: 4 }}>68%  ·  ETA 12s</div>
          </div>
        </div>
        <HazardTapeV color="var(--toxic)" side="left" size={4} />
      </TechPanel>
    </div>

    {/* BOTTOM RIGHT — quest */}
    <div style={{ position: 'absolute', bottom: 32, right: 32, width: 300 }}>
      <TechPanel accent="var(--maya-ochre)" label="// ЗАДАНИЕ · КИБЕР-МАЙЯ" serial="Q-3 / 5">
        <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
          Поставить <b style={{color:'var(--chalk)'}}>5 кристалла</b> к концу цикла 5.
        </div>
        <div style={{ marginTop: 10 }}>
          <Bar value={1} max={5} kind="gold" size="thin" />
        </div>
        <div className="mono-sm" style={{ color: 'var(--ash)', marginTop: 8 }}>1/5  ·  DEADLINE +2 CYCLE</div>
      </TechPanel>
    </div>

    {/* center AI ping */}
    <div style={{ position: 'absolute', top: '34%', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px',
      background: 'rgba(7,5,10,0.92)', border: '1px solid var(--cobalt)',
      fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: 'var(--cobalt)',
      clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
    }}>
      <span className="pulse-dot" style={{ display:'inline-block', width: 6, height: 6, background: 'var(--cobalt)', marginRight: 8 }} />
      AI · ЖИЛА КРИСТАЛЛА — 4 БЛОКА ↓
    </div>
  </ScreenFrame>
);

/* =====================================================================
   03 — HEX CONSTRUCTOR
   ===================================================================== */

const HexConstructorScreen = () => {
  const dx = 38, dy = 33;
  const filled = {
    '0,0':  { kind: 'reactor', color: 'blood' },
    '1,0':  { kind: 'engine',  color: 'amber' },
    '-1,0': { kind: 'drill',   color: 'cobalt' },
    '0,-1': { kind: 'battery', color: 'cobalt' },
    '1,-1': { kind: 'casing',  color: 'toxic' },
    '-1,1': { kind: 'sensor',  color: 'iron' },
    '0,1':  { kind: 'cargo',   color: 'iron' },
  };
  const palMap = {
    blood:  ['var(--blood-dim)', 'var(--blood-bright)'],
    amber:  ['var(--amber-dim)', 'var(--amber)'],
    cobalt: ['var(--cobalt-dim)', 'var(--cobalt)'],
    toxic:  ['var(--toxic-dim)', 'var(--toxic)'],
    iron:   ['var(--bronze)', 'var(--ash)'],
  };
  const hexes = [];
  const hexR = 2;
  for (let q = -hexR; q <= hexR; q++) {
    for (let r = -hexR; r <= hexR; r++) {
      if (Math.abs(-q - r) > hexR) continue;
      const x = dx * q + dx/2 * r;
      const y = dy * r;
      const key = `${q},${r}`;
      const cell = filled[key];
      const [fill, stroke] = cell ? palMap[cell.color] : ['transparent', 'var(--carbon)'];
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI/6 + i*Math.PI/3;
        pts.push([x + 20*Math.cos(a), y + 20*Math.sin(a)]);
      }
      hexes.push({ q, r, x, y, fill, stroke, cell, pts });
    }
  }

  return (
    <ScreenFrame label="// 03 · HEX CONSTRUCTOR" sublabel="esc · в шахту · enter · старт" serial="ASM // R=2">
      <VoidStage glints={[]} />
      <HazardTape color="var(--amber-dim)" direction="top" size={5} />

      {/* header — stats row with mini LEDs */}
      <div style={{ position: 'absolute', top: 28, left: 32, right: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
            <SerialStamp color="var(--gold)">ASM-RX-04</SerialStamp>
            <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--gold)' }} />
              <span className="mono-sm" style={{ color: 'var(--gold)' }}>ASSEMBLY ACTIVE</span>
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.025em', color: 'var(--chalk)', lineHeight: 1 }}>
            Ядро · Standard R=2
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Stat2 k="HP"     v="100" c="var(--blood-bright)" />
          <Stat2 k="ENERGY" v="120" c="var(--amber)" />
          <Stat2 k="SPEED"  v="4.0" c="var(--chalk)" />
          <Stat2 k="SHIELD" v="1.8" c="var(--toxic)" />
        </div>
      </div>

      {/* hex board */}
      <svg width="100%" height="68%" viewBox="-300 -160 600 320" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', left: 0, right: 0, top: '16%' }}>
        <circle cx="0" cy="0" r="140" stroke="var(--blood)" strokeOpacity="0.18" strokeDasharray="2 4" fill="none" />
        <circle cx="0" cy="0" r="160" stroke="var(--gold-dim)" strokeOpacity="0.3" strokeDasharray="1 6" fill="none" />
        {/* technical crosshair markers around board */}
        {[[0,-170],[170,0],[0,170],[-170,0]].map(([x,y],i) => (
          <g key={i} transform={`translate(${x},${y})`}>
            <line x1="-6" y1="0" x2="6" y2="0" stroke="var(--gold)" strokeWidth="0.8" />
            <line x1="0" y1="-6" x2="0" y2="6" stroke="var(--gold)" strokeWidth="0.8" />
          </g>
        ))}
        {hexes.map(h => (
          <g key={`${h.q},${h.r}`}>
            <polygon points={h.pts.map(p => p.join(',')).join(' ')} fill={h.fill} stroke={h.stroke} strokeWidth="1.2" />
            {h.cell && (() => {
              const I = SchemaIcons[h.cell.kind];
              return (
                <foreignObject x={h.x - 16} y={h.y - 16} width="32" height="32">
                  <div style={{ color: palMap[h.cell.color][1] }}><I /></div>
                </foreignObject>
              );
            })()}
          </g>
        ))}
      </svg>

      {/* left shelf */}
      <div style={{ position: 'absolute', left: 32, top: 130, bottom: 90, width: 220 }}>
        <TechPanel accent="var(--gold)" label="// ПОЛКА · 4 / 7" serial="STK-A">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <HexTile size={42} color="var(--bronze)"      stroke="var(--ash)"          icon={<SchemaIcons.sensor />} />
            <HexTile size={42} color="var(--bronze)"      stroke="var(--ash)"          icon={<SchemaIcons.cargo />} />
            <HexTile size={42} color="var(--cobalt-dim)"  stroke="var(--cobalt)"       icon={<SchemaIcons.battery />} />
            <HexTile size={42} color="var(--toxic-dim)"   stroke="var(--toxic)"        icon={<SchemaIcons.casing />} />
          </div>
          <div className="mono-sm" style={{ color: 'var(--pewter)', marginTop: 22, marginBottom: 10 }}>// РЕЛИКВИИ · 1</div>
          <HexTile size={42} color="var(--gold-dim)" stroke="var(--gold)" icon={<SchemaIcons.scroll />} />
        </TechPanel>
      </div>

      {/* right panel — selection */}
      <div style={{ position: 'absolute', right: 32, top: 130, bottom: 90, width: 280 }}>
        <TechPanel accent="var(--cobalt)" label="// SELECTED · DRILL V.2" serial="M-DRILL · 1×HEX" fingers>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <HexTile size={56} color="var(--cobalt-dim)" stroke="var(--cobalt)" icon={<SchemaIcons.drill />} />
            <div>
              <div style={{ color: 'var(--chalk)', fontSize: 14, fontFamily: 'var(--font-body)' }}>Базовый бур</div>
              <div className="mono-sm">REMOVABLE</div>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StatLine k="dig time"   v="0.50 s/blk" />
            <StatLine k="idle drain" v="0.05 /s" />
            <StatLine k="use"        v="5 e/blk" />
            <StatLine k="rotation"   v="↻ R · wall-kick" />
          </div>
          <div style={{ fontSize: 12, color: 'var(--bone)', lineHeight: 1.55, marginTop: 14, borderTop: '1px dashed var(--carbon)', paddingTop: 12, fontFamily: 'var(--font-body)' }}>
            Без бура копание невозможно. Выйти в шахту без бура — подтверждение.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingBottom: 10 }}>
            <Button variant="ghost" size="sm">Снять</Button>
            <Button variant="data" size="sm">↻ Поворот</Button>
          </div>
        </TechPanel>
      </div>

      {/* bottom bar */}
      <div style={{ position: 'absolute', left: 32, right: 32, bottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono-sm">
          <span style={{ color:'var(--bone)' }}>WASD</span> · выбор &nbsp;·&nbsp; <span style={{ color:'var(--bone)' }}>R</span> · поворот &nbsp;·&nbsp; <span style={{ color:'var(--bone)' }}>DEL</span> · снять
        </span>
        <Button variant="primary">▶ В ШАХТУ · ENTER</Button>
      </div>
    </ScreenFrame>
  );
};

const Stat2 = ({ k, v, c }) => (
  <div style={{ minWidth: 60 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="pulse-dot" style={{ width: 5, height: 5, background: c }} />
      <span className="mono-sm" style={{ color: 'var(--ash)' }}>{k}</span>
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, color: c, fontWeight: 600, marginTop: 2 }}>{v}</div>
  </div>
);
const StatLine = ({ k, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span className="mono-sm">{k}</span>
    <span className="mono-sm" style={{ color: 'var(--bone)' }}>{v}</span>
  </div>
);

/* =====================================================================
   04 — WORLD MAP · SCANNER
   ===================================================================== */

const WorldMapScreen = () => (
  <ScreenFrame label="// 04 · WORLD MAP · SCANNER" sublabel="m · закрыть · пкм · метка" serial="MAP // 04-N">
    <VoidStage glints={[]} />

    {/* header */}
    <div style={{ position: 'absolute', top: 28, left: 40, right: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
          <SerialStamp color="var(--cobalt)">SCANNER · ACTIVE</SerialStamp>
          <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--cobalt)' }} />
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'var(--chalk)', marginTop: 2, lineHeight: 1 }}>
          Карта мира
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SerialStamp color="var(--pewter)">SECTOR 04-N</SerialStamp>
        <SerialStamp color="var(--cobalt)">SEED 0x7A3F</SerialStamp>
        <SerialStamp color="var(--pewter)">EXPLORED · 38%</SerialStamp>
      </div>
    </div>

    {/* map grid */}
    <svg width="100%" height="74%" viewBox="0 0 1280 540" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, top: 110, bottom: 70 }}>
      <defs>
        <pattern id="mapGrid" x="0" y="0" width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M0 0 H36 M0 0 V36" stroke="rgba(122,112,94,0.06)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1280" height="540" fill="var(--pit)" />
      <rect width="1280" height="540" fill="url(#mapGrid)" />

      {/* layer bands */}
      {[[0,70,'AIR'],[70,130,'CRUST'],[130,270,'UPPER'],[270,400,'MIDDLE'],[400,540,'DEEP']].map(([y0, y1, name]) => (
        <g key={name}>
          <rect x="0" y={y0} width="1280" height={y1 - y0} fill={name === 'DEEP' ? 'rgba(168,40,28,0.05)' : name === 'CRUST' ? 'rgba(240,138,42,0.04)' : 'transparent'} />
          <line x1="0" y1={y0} x2="1280" y2={y0} stroke="var(--bronze)" strokeWidth="1" />
          <text x="16" y={y0 + 16} fontFamily="var(--font-mono)" fontSize="10" letterSpacing="3" fill={name === 'DEEP' ? 'var(--blood-bright)' : 'var(--ash)'}>// {name}</text>
        </g>
      ))}

      {/* coordinate crosshairs */}
      {[[200,200],[640,150],[1080,250],[400,440],[900,460]].map(([x,y],i) => (
        <g key={i} transform={`translate(${x},${y})`} opacity="0.3">
          <line x1="-8" y1="0" x2="8" y2="0" stroke="var(--cobalt)" strokeWidth="0.6" />
          <line x1="0" y1="-8" x2="0" y2="8" stroke="var(--cobalt)" strokeWidth="0.6" />
        </g>
      ))}

      {/* tunnels */}
      <path d="M480 90 Q520 170 580 250 Q640 320 700 390 Q760 450 720 490" stroke="rgba(58,126,200,0.35)" strokeWidth="2" fill="none" />
      <path d="M480 90 Q420 170 380 230 Q340 310 300 370" stroke="rgba(58,126,200,0.25)" strokeWidth="2" fill="none" />

      {/* base */}
      <g transform="translate(480, 72)">
        <rect x="-22" y="-4" width="44" height="14" fill="var(--earth)" stroke="var(--amber)" />
        <circle cx="-16" cy="3" r="1.5" fill="var(--amber)" />
        <circle cx="16" cy="3" r="1.5" fill="var(--amber)" />
        <text x="0" y="-10" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="3" fill="var(--amber)">БАЗА</text>
      </g>

      {/* unit ping */}
      <g transform="translate(720, 490)">
        <circle r="6" fill="var(--cobalt)" />
        <circle r="14" stroke="var(--cobalt)" strokeWidth="1" fill="none" opacity="0.6">
          <animate attributeName="r" values="14;28;14" dur="2s" repeatCount="indefinite" />
        </circle>
        <line x1="-18" y1="0" x2="-10" y2="0" stroke="var(--cobalt)" strokeWidth="0.8" />
        <line x1="10" y1="0" x2="18" y2="0" stroke="var(--cobalt)" strokeWidth="0.8" />
        <line x1="0" y1="-18" x2="0" y2="-10" stroke="var(--cobalt)" strokeWidth="0.8" />
        <line x1="0" y1="10" x2="0" y2="18" stroke="var(--cobalt)" strokeWidth="0.8" />
      </g>

      {/* foreign city — maya */}
      <g transform="translate(880, 210)">
        <polygon points="-14,10 -10,2 10,2 14,10" fill="var(--earth)" stroke="var(--maya-ochre)" />
        <polygon points="-10,2 -6,-6 6,-6 10,2" fill="var(--earth)" stroke="var(--maya-ochre)" />
        <circle cx="0" cy="-10" r="2" fill="var(--maya-ochre)" />
        <text x="0" y="24" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="2.5" fill="var(--maya-ochre)">К-МАЙЯ</text>
        <text x="0" y="36" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2" fill="var(--maya-jade)">REP +12</text>
      </g>

      {/* nord — undiscovered */}
      <g transform="translate(260, 170)">
        <rect x="-14" y="-4" width="28" height="14" fill="var(--pit)" stroke="var(--ash)" strokeDasharray="2 2" />
        <polygon points="-16,-4 0,-14 16,-4" fill="var(--pit)" stroke="var(--ash)" strokeDasharray="2 2" />
        <text x="0" y="26" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="2.5" fill="var(--ash)">??? · SIGNAL</text>
      </g>

      {/* wild nest */}
      <g transform="translate(1020, 460)">
        <polygon points="-16,6 -8,-8 6,-10 14,-4 18,6" fill="var(--blood-dim)" stroke="var(--blood)" />
        <circle cx="2" cy="-2" r="3" fill="var(--blood-bright)" />
        <circle cx="2" cy="-2" r="10" stroke="var(--blood)" strokeOpacity="0.5" fill="none">
          <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <text x="2" y="26" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="2.5" fill="var(--blood-bright)">ДИКОЕ · HOT</text>
      </g>
      <g transform="translate(180, 430)">
        <polygon points="-10,4 -6,-6 4,-8 10,-2 14,4" fill="var(--blood-dim)" stroke="var(--blood)" />
        <circle cx="0" cy="-2" r="2" fill="var(--blood)" opacity="0.7" />
      </g>

      {/* skverna patches */}
      <ellipse cx="220" cy="480" rx="120" ry="44" fill="var(--toxic)" opacity="0.06" />
      <ellipse cx="1040" cy="500" rx="160" ry="60" fill="var(--toxic)" opacity="0.09" />
      <ellipse cx="640" cy="510" rx="200" ry="50" fill="var(--toxic)" opacity="0.05" />
    </svg>

    {/* right legend */}
    <div style={{ position: 'absolute', right: 32, top: 120, width: 210 }}>
      <TechPanel accent="var(--gold)" label="// MARKERS" serial="LEGEND">
        <Marker color="var(--amber)" txt="БАЗА · PRINTER" />
        <Marker color="var(--maya-ochre)" txt="ГОРОД · НАЙДЕН" />
        <Marker color="var(--ash)" txt="ГОРОД · СЛЫШИМ" />
        <Marker color="var(--blood-bright)" txt="ГНЕЗДО · HOT" />
        <Marker color="var(--cobalt)" txt="ЮНИТ · АКТИВЕН" />
        <Marker color="var(--toxic)" txt="СКВЕРНА · ФОН" />
      </TechPanel>
    </div>

    {/* bottom bar */}
    <div style={{ position: 'absolute', left: 32, right: 32, bottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SerialStamp color="var(--pewter)">M · ЗАКРЫТЬ</SerialStamp>
      <SerialStamp color="var(--pewter)">ПКМ · ПОСТАВИТЬ МЕТКУ</SerialStamp>
      <SerialStamp color="var(--toxic)">SKVERNA HOT · 3 ОЧАГА</SerialStamp>
    </div>
  </ScreenFrame>
);

const Marker = ({ color, txt }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
    <span style={{ width: 10, height: 10, background: color, display: 'inline-block' }} />
    <span style={{ color: 'var(--bone)' }}>{txt}</span>
  </div>
);

/* =====================================================================
   05 — CITY DIALOG
   ===================================================================== */

const CityDialogScreen = () => (
  <ScreenFrame label="// 05 · CITY DIALOG · КИБЕР-МАЙЯ" sublabel="quest accept · rep +3" serial="DIPLO // MAYA">
    <VoidStage glints={[
      { x: 640, y: 240, color: '#d4a042', r: 5 },
      { x: 540, y: 360, color: '#d4a042', r: 1.5 },
      { x: 740, y: 360, color: '#d4a042', r: 1.5 },
    ]} />

    {/* central glyph plate (techno-framed) */}
    <div style={{ position: 'absolute', left: '50%', top: '22%', transform: 'translateX(-50%)' }}>
      <div style={{
        width: 180, height: 180,
        border: '1px solid var(--maya-ochre)',
        background: 'rgba(13,10,14,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--maya-ochre)',
        position: 'relative',
        clipPath: 'polygon(0 18px, 18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px))',
      }}>
        <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(212,160,66,0.4)', clipPath: 'polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px))' }} />
        <div style={{ transform: 'scale(1.6)' }}><Glyphs.sun /></div>
        <BoltHead size={8} color="var(--maya-ochre)" style={{ top: 6, left: 26 }} />
        <BoltHead size={8} color="var(--maya-ochre)" style={{ top: 6, right: 26 }} />
        <BoltHead size={8} color="var(--maya-ochre)" style={{ bottom: 6, left: 26 }} />
        <BoltHead size={8} color="var(--maya-ochre)" style={{ bottom: 6, right: 26 }} />
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <SerialStamp color="var(--maya-ochre)">CHANNEL · MAYA-04</SerialStamp>
        <span className="mono-sm" style={{ color: 'var(--maya-ochre)' }}>// ДИСК ОСВЕЩЁН</span>
      </div>
    </div>

    {/* dialog bottom */}
    <div style={{ position: 'absolute', left: 36, right: 36, bottom: 26,
      background: 'rgba(13,10,14,0.96)', border: '1px solid var(--maya-ochre)',
    }}>
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
        <span key={v+h} style={{
          position:'absolute', [v]: -1, [h]: -1, width: 14, height: 14,
          [`border${v==='top'?'Top':'Bottom'}`]: '1px solid var(--maya-ochre)',
          [`border${h==='left'?'Left':'Right'}`]: '1px solid var(--maya-ochre)',
        }}/>
      ))}
      <BoltHead size={9} color="var(--maya-ochre)" style={{ top: 8, left: 8 }} />
      <BoltHead size={9} color="var(--maya-ochre)" style={{ top: 8, right: 8 }} />
      <BoltHead size={9} color="var(--maya-ochre)" style={{ bottom: 8, left: 8 }} />
      <BoltHead size={9} color="var(--maya-ochre)" style={{ bottom: 8, right: 8 }} />

      {/* header band */}
      <div style={{ padding: '12px 28px', borderBottom: '1px solid rgba(212,160,66,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <SerialStamp color="var(--maya-ochre)">MAYA · TIER 1 · 04</SerialStamp>
          <span className="mono-sm" style={{ color: 'var(--maya-ochre)' }}>// ГОЛОС ЦИФЕРБЛАТА · ЖРЕЦ-МАСКА</span>
        </div>
        <span style={{ display:'inline-flex', alignItems:'center', gap: 6 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, background: 'var(--maya-ochre)' }} />
          <span className="mono-sm" style={{ color: 'var(--maya-ochre)' }}>LINK</span>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 28, padding: '24px 28px' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 30, fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            color: 'var(--chalk)',
            lineHeight: 1.05,
            maxWidth: 700,
          }}>
            Принеси нам пять кристаллов до конца пятого витка солнца —<br/>
            и мы запомним твоё имя.
          </div>

          <div style={{ display: 'flex', gap: 28, marginTop: 22 }}>
            <Meta2 k="ЦЕЛЬ"      v="5 × crystal"     c="var(--maya-ochre)" />
            <Meta2 k="ДЕДЛАЙН"   v="цикл 5 (+2)"    c="var(--maya-ochre)" />
            <Meta2 k="REP"       v="+3 / провал −1" c="var(--maya-ochre)" />
            <Meta2 k="ТИП"       v="QUEST · ПОСТАВКА" c="var(--maya-ochre)" />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '1px solid rgba(212,160,66,0.3)', paddingLeft: 22 }}>
          <div>
            <div className="mono-sm" style={{ color: 'var(--ash)' }}>REP · КИБЕР-МАЙЯ</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 700, color: 'var(--maya-ochre)', lineHeight: 1 }}>+12</span>
              <span className="mono-sm">/ 50 · TIER 1</span>
            </div>
            <div style={{ marginTop: 10 }}>
              <Bar value={12} max={50} kind="gold" size="thin" />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            <Button variant="primary" size="lg">▶ ПРИНЯТЬ · Y</Button>
            <Button variant="ghost">Отказаться</Button>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--maya-ochre)', padding: '10px 28px', display: 'flex', justifyContent: 'space-between' }}>
        <SerialStamp color="var(--pewter)">Y · ПРИНЯТЬ</SerialStamp>
        <SerialStamp color="var(--pewter)">N · ОТКАЗАТЬСЯ</SerialStamp>
        <SerialStamp color="var(--pewter)">TAB · ИНФО О ГОРОДЕ</SerialStamp>
        <SerialStamp color="var(--maya-ochre)">DISC LIT</SerialStamp>
      </div>
    </div>
  </ScreenFrame>
);

const Meta2 = ({ k, v, c }) => (
  <div>
    <div className="mono-sm" style={{ color: c }}>{k}</div>
    <div className="mono-sm" style={{ color: 'var(--bone)', marginTop: 4 }}>{v}</div>
  </div>
);

/* =====================================================================
   06 — SUMMARY / GAME OVER
   ===================================================================== */

const SummaryScreen = () => (
  <ScreenFrame label="// 06 · ИТОГИ ЗАБЕГА" sublabel="run #14 · cycle 5 · failed" serial="RUN-14 // FAIL">
    <VoidStage glints={[ { x: 640, y: 200, color: '#a8281c', r: 4 } ]} />

    {/* hazard tape — top + bottom (failure) */}
    <HazardTape color="var(--blood)" direction="top" size={8} />
    <HazardTape color="var(--blood)" direction="bottom" size={8} />

    {/* center title */}
    <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', textAlign: 'center', maxWidth: 800 }}>
      <SerialStamp color="var(--blood-bright)" style={{ display: 'inline-block', marginBottom: 18 }}>
        ⚠ СВЯЗЬ ПРЕРВАНА · 0xE204
      </SerialStamp>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 96, fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '-0.04em',
        color: 'var(--chalk)',
        lineHeight: 0.9,
      }}>
        Сумерки<br/>
        <span style={{ color: 'var(--blood-bright)' }}>сомкнулись</span>
      </div>
      <div style={{ fontSize: 14, color: 'var(--bone)', marginTop: 18, lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>
        Юнит-014 не вышел из шахты. Принтер израсходовал последний слот.
        Скверна заняла четыре сектора. Цикл закрыт.
      </div>
    </div>

    {/* stats — 4-up grid with bolt heads each */}
    <div style={{ position: 'absolute', left: 64, right: 64, bottom: 110, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      <SummaryKPI k="// ДЛИТЕЛЬНОСТЬ" v="08:42" unit="мин" kind="chalk" delta="best: 12:18" />
      <SummaryKPI k="// ГЛУБИНА"      v="−124" unit="м"   kind="gold"  delta="best: −208" />
      <SummaryKPI k="// ДОБЫЧА"       v="84"   unit="бл"  kind="amber" delta="Fe 41 · Org 28 · Cr 15" />
      <SummaryKPI k="// ПОТЕРИ"       v="3"    unit="тел" kind="blood" delta="2 скверна · 1 рейдер" />
    </div>

    {/* bottom actions */}
    <div style={{ position: 'absolute', left: 64, right: 64, bottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <SerialStamp color="var(--pewter)">SEED 0x7A3F · сохранено в архиве</SerialStamp>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="ghost">К меню</Button>
        <Button variant="data">Архив забегов</Button>
        <Button variant="primary" size="lg">▶ Новый забег · ENTER</Button>
      </div>
    </div>
  </ScreenFrame>
);

const SummaryKPI = ({ k, v, unit, kind, delta }) => {
  const c = kind === 'gold' ? 'var(--gold)'
        : kind === 'blood' ? 'var(--blood-bright)'
        : kind === 'amber' ? 'var(--amber)'
        : 'var(--chalk)';
  return (
    <div style={{ padding: '20px 22px', background: 'rgba(13,10,14,0.92)', border: '1px solid var(--bronze)', position: 'relative' }}>
      <BoltHead size={7} color={c} style={{ top: 4, left: 4 }} />
      <BoltHead size={7} color={c} style={{ top: 4, right: 4 }} />
      <BoltHead size={7} color={c} style={{ bottom: 4, left: 4 }} />
      <BoltHead size={7} color={c} style={{ bottom: 4, right: 4 }} />
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([vp,h]) => (
        <span key={vp+h} style={{
          position:'absolute', [vp]: -1, [h]: -1, width: 10, height: 10,
          [`border${vp==='top'?'Top':'Bottom'}`]: `1px solid ${c}`,
          [`border${h==='left'?'Left':'Right'}`]: `1px solid ${c}`,
        }}/>
      ))}
      <div style={{ paddingLeft: 14, paddingRight: 14 }}>
        <span className="mono-sm" style={{ color: 'var(--pewter)' }}>{k}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38, color: c, letterSpacing: '-0.025em', lineHeight: 1 }}>{v}</span>
          {unit && <span className="mono-sm">{unit}</span>}
        </div>
        {delta && <div className="mono-sm" style={{ color: 'var(--ash)', marginTop: 6 }}>{delta}</div>}
      </div>
    </div>
  );
};

const ScreensSection = () => (
  <Section
    ord="08 · SCREENS"
    id="screens"
    title="Экраны"
    lede="Шесть ключевых состояний — те же техно-рамки и тот же словарь, что в §02. Серийники, болты, PCB-пальцы, hazard-ленты и LED-индикаторы пронизывают всё. Мир в кадре — абстрактный void: тонкие сетки, точечные свечения. Юниты и текстуру породы рисует сама игра.">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <MainMenuScreen />
      <HudScreen />
      <HexConstructorScreen />
      <WorldMapScreen />
      <CityDialogScreen />
      <SummaryScreen />
    </div>
  </Section>
);

Object.assign(window, { ScreensSection });
