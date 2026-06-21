// 01 — FOUNDATIONS v2: palette, type (Tektur + JBMono + Plex), spacing, motion.

const SWATCHES_NEUTRAL = [
  ['--void',   '#07050a', 'абсолют, под слоем мира'],
  ['--pit',    '#0d0a0e', 'фон страницы / шахты'],
  ['--night',  '#14100c', 'кованая поверхность'],
  ['--earth',  '#1a140e', 'тёплая порода'],
  ['--bronze', '#2a2018', 'окисленная медь'],
  ['--carbon', '#3a302a', 'муть, тень'],
  ['--ash',    '#5a5046', 'муть-2'],
  ['--pewter', '#7a705e', 'meta-текст'],
  ['--bone',   '#b8a896', 'основной текст'],
  ['--chalk',  '#e8dcc4', 'выжженный кремень'],
];

const SWATCHES_ACCENT = [
  { t: '--gold',   h: '#d4a042', role: 'ЗОЛОТО',  use: 'Гравировка, ритуал, иерархия. Любой акт «здесь важно».' },
  { t: '--blood',  h: '#a8281c', role: 'КРОВЬ',   use: 'Ядро машины, рейдер, критический урон. Тёплая угроза.' },
  { t: '--toxic',  h: '#c8e25a', role: 'СКВЕРНА', use: 'Жёстко зарезервировано. Радиация, дикие гнёзда, фон.' },
  { t: '--amber',  h: '#f08a2a', role: 'ЯНТАРЬ',  use: 'Энергия, тепло реактора, лампа над дверью базы.' },
  { t: '--cobalt', h: '#3a7ec8', role: 'КОБАЛЬТ', use: 'Редкое холодное «data». Только в системных оверлеях.' },
];

const Swatch = ({ token, hex, note, large, role }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{
      background: hex,
      height: large ? 110 : 72,
      border: '1px solid var(--bronze)',
      position: 'relative',
      backgroundImage: large ? 'linear-gradient(135deg, transparent 60%, rgba(0,0,0,0.25))' : 'none',
    }}>
      {role && (
        <div style={{
          position: 'absolute', left: 10, top: 8,
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.22em',
          color: ['#c8e25a','#f08a2a','#d4a042','#b8a896','#e8dcc4'].includes(hex) ? 'var(--void)' : 'var(--chalk)',
          opacity: 0.85, fontWeight: 700,
        }}>{role}</div>
      )}
      {large && (
        <span className="mono-sm" style={{
          position: 'absolute', left: 10, bottom: 8,
          color: ['#c8e25a','#f08a2a','#d4a042','#b8a896','#e8dcc4'].includes(hex) ? 'var(--void)' : 'var(--chalk)',
          opacity: 0.9,
        }}>{hex}</span>
      )}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span className="mono-sm" style={{ color: 'var(--bone)' }}>{token}</span>
      {!large && <span className="mono-sm">{hex}</span>}
    </div>
    {note && <div style={{ fontSize: 12, color: 'var(--pewter)', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>{note}</div>}
  </div>
);

const PaletteBlock = () => (
  <Row label="01 · ПАЛИТРА">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Десять ступеней тёплой темноты — от <span className="gold-c">void</span> до <span className="chalk-c">chalk</span>. Не серая, а <b>тёплая</b>: примесь жжёного дерева и потускневшей меди. Пять акцентов — единственный источник цвета. Один раз в кадре, не больше.
    </p>

    <div style={{ marginTop: 32 }}>
      <div className="inscription" style={{ marginBottom: 16 }}><span>NEUTRAL · 10 СТУПЕНЕЙ</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
        {SWATCHES_NEUTRAL.map(([t,h,n]) => <Swatch key={t} token={t} hex={h} note={n} />)}
      </div>
    </div>

    <div style={{ marginTop: 48 }}>
      <div className="inscription" style={{ marginBottom: 16 }}><span>RITUAL ACCENT · 5 ПИГМЕНТОВ</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {SWATCHES_ACCENT.map(s => <Swatch key={s.t} token={s.t} hex={s.h} role={s.role} note={s.use} large />)}
      </div>
    </div>

    <div className="bracket" style={{ marginTop: 32 }}>
      <span className="mono" style={{ color: 'var(--gold)', display: 'block', marginBottom: 6 }}>ЗАКОН ОДНОГО ПИГМЕНТА</span>
      В одном элементе используется ровно один акцентный цвет. Кровь не смешивается с золотом. Скверна никогда не дополняется янтарём — это разные состояния мира. Кобальт — редкий гость, только для системных голосов ИИ.
    </div>
  </Row>
);

/* ===== TYPE ============================================================ */

const TypeSpec = ({ font, size, weight = 500, sample, name, role, italic = false, cyr = true }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '200px 1fr',
    gap: 40,
    padding: '24px 0',
    borderTop: '1px solid var(--bronze)',
    alignItems: 'baseline',
  }}>
    <div>
      <div className="mono-sm" style={{ color: 'var(--gold)', marginBottom: 6 }}>{name}</div>
      <div className="mono-sm" style={{ color: 'var(--bone)' }}>{font}</div>
      <div className="mono-sm">{size}px · {weight} {italic ? '· italic' : ''}</div>
      {cyr && <div className="mono-sm" style={{ color: 'var(--toxic)', marginTop: 4 }}>// КИРИЛЛИЦА OK</div>}
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--pewter)', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>{role}</div>
    </div>
    <div style={{
      fontFamily: font,
      fontSize: size,
      fontWeight: weight,
      fontStyle: italic ? 'italic' : 'normal',
      letterSpacing: font === "'Tektur', sans-serif" && size > 36 ? '-0.025em' : font.includes('Mono') ? '0.06em' : '-0.005em',
      lineHeight: size > 60 ? 0.9 : size > 30 ? 1.05 : 1.4,
      textTransform: font === "'Tektur', sans-serif" && size > 40 ? 'uppercase' : font.includes('Mono') ? 'uppercase' : 'none',
      color: 'var(--chalk)',
      wordBreak: 'break-word',
    }}>
      {sample}
    </div>
  </div>
);

const TypeBlock = () => (
  <Row label="02 · ТИПОГРАФИКА">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Три голоса. <b className="gold-c">Tektur</b> — машинный квадратный гротеск, голос подземной цивилизации. Высекает заголовки и большие лозунги, любит uppercase и негативный трекинг.{' '}
      <b className="chalk-c">JetBrains Mono</b> — данные, координаты, телеметрия, скобки `// SYS`. <b className="bone-c">IBM Plex Sans Condensed</b> — единственная уступка читаемости: длинные тексты заданий и описаний.{' '}
      <b className="gold-c">Syne Mono</b> — редкие глитч-моменты для голоса скверны.
    </p>

    {/* big specimen */}
    <div style={{ marginTop: 32, padding: '40px 32px', background: 'var(--night)', border: '1px solid var(--gold-dim)', position: 'relative' }}>
      <span style={{ position:'absolute', top:-1, left:-1, width:14, height:14, borderTop:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
      <span style={{ position:'absolute', top:-1, right:-1, width:14, height:14, borderTop:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />
      <span style={{ position:'absolute', bottom:-1, left:-1, width:14, height:14, borderBottom:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
      <span style={{ position:'absolute', bottom:-1, right:-1, width:14, height:14, borderBottom:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />

      <div style={{
        fontFamily: "'Tektur', sans-serif",
        fontWeight: 800,
        fontSize: 160,
        textTransform: 'uppercase',
        letterSpacing: '-0.04em',
        lineHeight: 0.85,
        color: 'var(--chalk)',
      }}>
        СУМЕРКИ<br/>
        <span style={{ color: 'var(--gold)' }}>МИРА</span>
      </div>
      <div className="mono" style={{ color: 'var(--gold)', marginTop: 12 }}>// TEKTUR 800 · 160px · −0.04em · UPPERCASE</div>
    </div>

    <div style={{ marginTop: 40 }}>
      <TypeSpec name="DISPLAY / XL"  font="'Tektur', sans-serif" size={88} weight={700} role="Главное меню. Один раз на экран. Тяжёлый, плотный, без воздуха." sample="ЯДРО ЮНИТА" />
      <TypeSpec name="DISPLAY / L"   font="'Tektur', sans-serif" size={48} weight={600} role="Заголовок экрана / раздела." sample="Дикие гнёзда" />
      <TypeSpec name="H1"            font="'Tektur', sans-serif" size={32} weight={500} role="Подраздел, карточка." sample="Кибер-майя · Конфессия Солнца" />
      <TypeSpec name="BODY"          font="'IBM Plex Sans Condensed', sans-serif" size={15} weight={400} role="Длинный читаемый текст, диалоги, описания заданий." sample="Снаружи безопасно только в радиусе принтера. Юнит обращается в скверне за 12 секунд." />
      <TypeSpec name="MONO / DATA"   font="'JetBrains Mono', monospace" size={13} weight={500} role="HUD, телеметрия, координаты. Tabular-nums по умолчанию." sample="DEPTH −124  HP 78/100  Z 0.42  RAD 6.4" />
      <TypeSpec name="MONO / META"   font="'JetBrains Mono', monospace" size={11} weight={500} role="Метка, label, system tag. Всегда uppercase + большой трекинг." sample="// СЕКТОР 04-N · ЦЕЛОСТНОСТЬ 62%" />
      <TypeSpec name="GLITCH / VOICE" font="'Syne Mono', monospace" size={16} weight={400} italic role="Голос скверны, помехи, аномалия. Редко." sample="//я слышу// тебя //плюс// четыре" />
    </div>
  </Row>
);

/* ===== SPACING ========================================================= */

const ScaleBox = ({ size, name, px }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
    <div style={{
      width: size, height: size,
      background: 'rgba(212,160,66,0.15)',
      border: '1px solid var(--gold-dim)',
      flexShrink: 0,
    }} />
    <div>
      <div className="mono-sm" style={{ color: 'var(--bone)' }}>{name}</div>
      <div className="mono-sm">{px}px</div>
    </div>
  </div>
);

const SpacingBlock = () => (
  <Row label="03 · ШАГ И УГЛЫ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Шаг 4px. Углы — резкие. r-1 (2px) — только для технических контролов. r-pill — только для статусных тегов. <b>Закруглённой кнопки в этой системе нет.</b>
    </p>
    <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 36 }}>
      {[[4,'s-1',4],[8,'s-2',8],[12,'s-3',12],[16,'s-4',16],[24,'s-5',24],[32,'s-6',32],[48,'s-7',48],[64,'s-8',64]].map(([s,n,p]) =>
        <ScaleBox key={n} size={s} name={n} px={p} />
      )}
    </div>
  </Row>
);

/* ===== MOTION ========================================================== */

const MotionLine = ({ name, ms, role, ease = 'linear' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', gap: 20, padding: '14px 0', borderTop: '1px solid var(--bronze)', alignItems: 'center' }}>
    <div>
      <div className="mono-sm" style={{ color: 'var(--gold)' }}>{name}</div>
      <div className="mono-sm">{ms}ms</div>
    </div>
    <div style={{ fontSize: 13, color: 'var(--bone)', fontFamily: 'var(--font-body)' }}>{role}</div>
    <div className="mono-sm" style={{ textAlign: 'right' }}>{ease}</div>
  </div>
);

const MotionBlock = () => (
  <Row label="04 · ДВИЖЕНИЕ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Машины не упругие. Никаких bounce, spring и overshoot. Только линейные и ease-out, всё короткое. Единственное «дыхание» — пульс скверны и сканера ИИ.
    </p>
    <div style={{ marginTop: 24, padding: '0 20px', background: 'var(--night)', border: '1px solid var(--bronze)' }}>
      <MotionLine name="d-1" ms={80}  ease="linear"   role="Hover, переключение микро-состояний" />
      <MotionLine name="d-2" ms={140} ease="ease-out" role="Подсветка элемента, открытие меню" />
      <MotionLine name="d-3" ms={240} ease="ease-out" role="Переход экрана, выезд панели" />
      <MotionLine name="d-4" ms={400} ease="ease-out" role="Драматический акцент (печать тела, потеря связи)" />
      <MotionLine name="pulse" ms={1600} ease="organic" role="Сканер ИИ ↔ юнит. Скверна. Дыхание породы." />
    </div>
  </Row>
);

const FoundationsSection = () => (
  <Section
    ord="01 · FOUNDATIONS"
    id="foundations"
    title="Основания"
    lede="Палитра, шрифты, шаг, движение. Если что-то противоречит этим четырём — оно проиграло.">
    <PaletteBlock />
    <TypeBlock />
    <SpacingBlock />
    <MotionBlock />
  </Section>
);

Object.assign(window, { FoundationsSection });
