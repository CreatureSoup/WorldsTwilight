// 03 — ICONOGRAPHY: UI schematic icons + abstract glyph language.
// No creatures, no portraits, no figures.

const SCH = ({ children, size = 40, color = 'var(--bone)', strokeWidth = 1.4 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter">
    {children}
  </svg>
);

const SchemaIcons = {
  drill:    () => <SCH><path d="M16 4 V20 M10 8 L16 4 L22 8 M12 20 L20 20 L18 28 L14 28 Z" /></SCH>,
  reactor:  () => <SCH><rect x="6" y="6" width="20" height="20" /><circle cx="16" cy="16" r="5" /><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30" /></SCH>,
  hull:     () => <SCH><path d="M6 12 L16 4 L26 12 V24 L16 28 L6 24 Z" /></SCH>,
  engine:   () => <SCH><rect x="4" y="10" width="16" height="12" /><path d="M20 14 H26 V18 H20 M16 10 V6 M10 22 V26 M10 10 V6 M16 22 V26" /></SCH>,
  battery:  () => <SCH><rect x="4" y="8" width="22" height="16" /><rect x="26" y="13" width="2" height="6" /><path d="M9 13 V19 M14 13 V19 M19 13 V19" /></SCH>,
  cargo:    () => <SCH><rect x="6" y="10" width="20" height="16" /><path d="M6 16 H26 M16 10 V26 M10 6 H22 V10" /></SCH>,
  sensor:   () => <SCH><circle cx="16" cy="16" r="4" /><circle cx="16" cy="16" r="9" strokeDasharray="2 2" /><circle cx="16" cy="16" r="14" strokeDasharray="1 3" /></SCH>,
  casing:   () => <SCH><path d="M16 4 L26 9 V19 L16 28 L6 19 V9 Z" /><path d="M16 10 L21 13 V19 L16 24 L11 19 V13 Z" /></SCH>,
  hp:       () => <SCH strokeWidth={1.8}><path d="M4 16 H10 L13 8 L17 24 L20 16 H28" /></SCH>,
  energy:   () => <SCH strokeWidth={1.8}><path d="M18 4 L8 18 H16 L14 28 L24 14 H16 Z" /></SCH>,
  depth:    () => <SCH><path d="M16 4 V24 M10 18 L16 24 L22 18 M6 28 H26" /></SCH>,
  printer:  () => <SCH><path d="M4 22 H28 L28 14 H4 Z" /><path d="M9 14 V8 H23 V14" /><path d="M9 22 V28 H23 V22" /><circle cx="25" cy="18" r="1" fill="var(--amber)" stroke="none"/></SCH>,
  base:     () => <SCH><path d="M2 22 H30" /><path d="M6 22 V14 L10 10 H22 L26 14 V22" /><path d="M11 22 V16 H15 V22 M17 22 V16 H21 V22" /></SCH>,
  scanner:  () => <SCH><circle cx="16" cy="16" r="3" /><path d="M16 16 L28 8" /><circle cx="16" cy="16" r="13" strokeDasharray="3 3" /></SCH>,
  map:      () => <SCH><path d="M4 8 L12 6 L20 8 L28 6 V24 L20 26 L12 24 L4 26 Z" /><path d="M12 6 V24 M20 8 V26" /></SCH>,
  quest:    () => <SCH><path d="M6 6 H26 V20 L20 26 H6 Z" /><path d="M20 20 H26 M20 20 V26" /><path d="M11 12 H21 M11 16 H17" /></SCH>,
  city:     () => <SCH><path d="M4 26 H28" /><path d="M8 26 V18 H12 V26 M14 26 V14 H18 V26 M20 26 V10 H24 V26" /></SCH>,
  warning:  () => <SCH stroke="var(--toxic)"><path d="M16 4 L28 26 H4 Z" /><path d="M16 12 V18 M16 21 V22.5" strokeWidth={2} strokeLinecap="round" /></SCH>,
  link:     () => <SCH><circle cx="9" cy="16" r="4" /><circle cx="23" cy="16" r="4" /><path d="M13 16 H19" /></SCH>,
  pause:    () => <SCH><rect x="8" y="6" width="5" height="20" /><rect x="19" y="6" width="5" height="20" /></SCH>,
  play:     () => <SCH><path d="M9 5 L26 16 L9 27 Z" /></SCH>,
  settings: () => <SCH><circle cx="16" cy="16" r="4" /><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30 M5 5 L8 8 M24 24 L27 27 M5 27 L8 24 M24 8 L27 5" /></SCH>,
  archive:  () => <SCH><rect x="4" y="6" width="24" height="6" /><rect x="6" y="12" width="20" height="16" /><path d="M13 18 H19" /></SCH>,
  scroll:   () => <SCH><path d="M8 4 H28 V26 H8 Z M8 4 Q4 4 4 8 V24 Q4 28 8 28 H6 Q4 26 4 24 V8 Q4 4 8 4" /><path d="M12 10 H22 M12 14 H22 M12 18 H18" /></SCH>,
};

const Glyphs = {
  sun: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="currentColor"><circle cx="24" cy="24" r="8"/>{[...Array(8)].map((_,i)=>{const a=i*Math.PI/4;return <line key={i} x1={24+13*Math.cos(a)} y1={24+13*Math.sin(a)} x2={24+21*Math.cos(a)} y2={24+21*Math.sin(a)} stroke="currentColor" strokeWidth="3"/>})}</svg>,
  serpent: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="none"><path d="M6 14 Q14 6 22 14 T38 14 M6 24 Q14 16 22 24 T38 24 M6 34 Q14 26 22 34 T38 34" stroke="currentColor" strokeWidth="3"/></svg>,
  rune: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="none"><path d="M14 6 V42 M14 6 L34 18 M14 24 L30 14 M14 30 L34 42" stroke="currentColor" strokeWidth="3.5"/></svg>,
  axe: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="currentColor"><path d="M22 6 V42" stroke="currentColor" strokeWidth="3.5"/><path d="M22 8 Q34 8 38 20 Q34 22 22 22 Z M22 8 Q10 8 6 20 Q10 22 22 22 Z"/></svg>,
  obsidian: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="currentColor"><polygon points="24,4 38,16 38,32 24,44 10,32 10,16"/></svg>,
  feather: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="none"><path d="M24 6 V42 M16 12 L24 18 M32 12 L24 18 M14 20 L24 26 M34 20 L24 26 M12 28 L24 34 M36 28 L24 34" stroke="currentColor" strokeWidth="2.5"/></svg>,
  eye: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="none"><path d="M6 24 Q24 8 42 24 Q24 40 6 24 Z" stroke="currentColor" strokeWidth="3"/><circle cx="24" cy="24" r="6" fill="currentColor"/></svg>,
  triskelion: () => <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="24" cy="24" r="20"/><path d="M24 24 Q24 12 14 12 Q4 12 8 24"/><path d="M24 24 Q34 24 38 14 Q42 4 30 4"/><path d="M24 24 Q22 36 32 42"/></svg>,
};

const IconCard = ({ name, label, children, sub, color = 'var(--bone)' }) => (
  <div style={{ padding: 16, background: 'var(--night)', border: '1px solid var(--bronze)', display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ height: 56, display: 'flex', alignItems: 'center', color }}>{children}</div>
    <div className="mono-sm" style={{ color: 'var(--bone)' }}>{name}</div>
    {label && <div className="mono-sm">{label}</div>}
    {sub && <div style={{ fontSize: 11, color: 'var(--pewter)', lineHeight: 1.4, fontFamily: 'var(--font-body)' }}>{sub}</div>}
  </div>
);

const IconographySection = () => (
  <Section
    ord="03 · ICONS · GLYPHS"
    id="iconography"
    title="Иконы и глифы"
    lede="Два языка знаков. Иконы — тонкая инженерная линия, 32×32, для UI. Глифы — жирные ритуальные формы, маркер мира и конфессий. Они никогда не смешиваются в одной плоскости.">

    <Row label="01 · SCHEMATIC · UI">
      <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
        Stroke 1.4 px, square caps, square joins. Никаких заливок. Каждая иконка читается с 16 px и держится до 64 px без потерь. Шаг сетки 4 px — клетка совпадает с базовым шагом системы.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginTop: 32 }}>
        {Object.entries(SchemaIcons).map(([k, Comp]) => (
          <IconCard key={k} name={k}><Comp /></IconCard>
        ))}
      </div>
    </Row>

    <Row label="02 · GLYPHS · WORLD">
      <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
        Жирные «вырезанные» знаки. Применяются только в мире: на стенах городов, корпусах юнитов, маркерах. В UI глиф появляется только один раз — на иконке конфессии в верхней панели. Цвет диктуется конфессией.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 32 }}>
        <IconCard name="sun"        label="конфессия майя"   color="var(--maya-ochre)"   sub="Алтарь Солнца. Маркер города."><Glyphs.sun /></IconCard>
        <IconCard name="serpent"    label="конфессия майя"   color="var(--maya-jade)"    sub="Великий Змей. Символ глубинных вод."><Glyphs.serpent /></IconCard>
        <IconCard name="rune"       label="конфессия нордов" color="var(--nord-frost)"   sub="Руна Связи. На корпусе разведчика."><Glyphs.rune /></IconCard>
        <IconCard name="axe"        label="конфессия нордов" color="var(--nord-pewter)"  sub="Топор Кузнеца. Маркер города."><Glyphs.axe /></IconCard>
        <IconCard name="obsidian"   label="конфессия ацтеков" color="var(--aztec-gold)"   sub="Чёрный камень. Геометрия города."><Glyphs.obsidian /></IconCard>
        <IconCard name="feather"    label="конфессия ацтеков" color="var(--aztec-gold)"   sub="Перо Кетцаля. Знак активного реактора."><Glyphs.feather /></IconCard>
        <IconCard name="eye"        label="общий"              color="var(--gold)"         sub="Глаз ИИ. На принтере, на корпусе юнита."><Glyphs.eye /></IconCard>
        <IconCard name="triskelion" label="общий"              color="var(--gold)"         sub="Трискелион. Цикл, печать ИИ."><Glyphs.triskelion /></IconCard>
      </div>
    </Row>

    <div style={{ marginTop: 48 }}>
      <div className="bracket">
        <span className="mono" style={{ color: 'var(--gold)', display: 'block', marginBottom: 6 }}>ЗАКОН РАЗДЕЛЕНИЯ</span>
        Иконка не может содержать «руну». Глиф не может быть кнопкой. Если хочется поставить пиктограмму солнца на UI-кнопке — это нарушение. Используйте иконку <span className="mono-md">/ scroll /</span> или <span className="mono-md">/ scanner /</span>.
      </div>
    </div>
  </Section>
);

Object.assign(window, { IconographySection, SchemaIcons, Glyphs, SCH });
