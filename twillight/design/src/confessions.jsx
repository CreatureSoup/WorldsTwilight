// 06 — CONFESSIONS v2: UI-only treatment per confession.
// No altar art, no figures. Palette, type, surface treatment.

const CONFESSIONS = [
  {
    id: 'maya',
    name: 'Кибер-майя',
    epithet: 'Конфессия Солнца',
    accent: 'var(--maya-ochre)',
    accent2: 'var(--maya-jade)',
    stroke: 'var(--maya-ochre)',
    glyph: 'sun',
    deity: 'Великий Циферблат',
    ritual: 'Юниты сверяют внутренние часы по диску Солнца над пирамидой.',
    materials: 'Зелёная медь, охра, известняк-бетон.',
    motif: 'Спираль Солнца, Великий Змей, ступень.',
    typography: 'Tektur 600, трекинг −0.02em. UPPERCASE. Декор — диск над буквой.',
    surface: 'Гравированная медная пластина. Орнамент ⟵⟶ — спираль 12 шагов.',
  },
  {
    id: 'nord',
    name: 'Кибер-нордики',
    epithet: 'Конфессия Глубинных Предков',
    accent: 'var(--nord-frost)',
    accent2: 'var(--nord-pewter)',
    stroke: 'var(--nord-frost)',
    glyph: 'rune',
    deity: 'Кузнец-в-Глубине',
    ritual: 'Перед забегом юнит «здоровается» с лазом — стучит буром в свод.',
    materials: 'Олово, морозный никель, кованое железо с запёкшейся окалиной.',
    motif: 'Руна-связь, топор кузнеца, морозная искра.',
    typography: 'Tektur 700, трекинг 0. Без uppercase в заголовках. Кантованные засечки.',
    surface: 'Холодная отливка. Рамка двойная, тяжёлая. Орнамент — кованая руна.',
  },
  {
    id: 'aztec',
    name: 'Кибер-ацтеки',
    epithet: 'Конфессия Чёрного Камня',
    accent: 'var(--aztec-gold)',
    accent2: 'var(--aztec-blood)',
    stroke: 'var(--aztec-gold)',
    glyph: 'obsidian',
    deity: 'Сердце-Под-Камнем',
    ritual: 'Снятые модули приносятся в жертву ядру города — теряются навсегда.',
    materials: 'Обсидиан, золото, медь-кровь.',
    motif: 'Перо Кетцаля, обсидиановый нож, ступенчатый ромб.',
    typography: 'Tektur 800. Геометрия очень тесная (−0.04em). Часто разрыв строки.',
    surface: 'Чёрный обсидиан с тонкой золотой инкрустацией по гранями ромба.',
  },
];

const ConfessionCard = ({ c }) => {
  const G = Glyphs[c.glyph];
  return (
    <div style={{
      background: 'var(--night)',
      border: `1px solid ${c.stroke}`,
      position: 'relative',
    }}>
      {/* corners */}
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
        <span key={v+h} style={{
          position:'absolute', [v]: -1, [h]: -1, width: 16, height: 16,
          [`border${v==='top'?'Top':'Bottom'}`]: `1px solid ${c.stroke}`,
          [`border${h==='left'?'Left':'Right'}`]: `1px solid ${c.stroke}`,
        }}/>
      ))}

      {/* header — glyph + name */}
      <div style={{ padding: '32px 28px 24px', display: 'flex', gap: 20, alignItems: 'flex-start', borderBottom: `1px solid ${c.stroke}33` }}>
        <div style={{ color: c.accent, flexShrink: 0 }}><G /></div>
        <div>
          <div className="mono-sm" style={{ color: c.accent }}>// {c.epithet}</div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            lineHeight: 0.95,
            color: 'var(--chalk)',
            marginTop: 6,
          }}>{c.name}</div>
        </div>
      </div>

      {/* palette band */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', height: 24 }}>
        <div style={{ background: c.accent }} />
        <div style={{ background: c.accent2 }} />
        <div style={{ background: 'var(--night)', borderLeft: `1px solid ${c.stroke}33` }} />
      </div>

      {/* metadata */}
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Meta k="БОЖЕСТВО"  v={c.deity}     c={c.accent} />
        <Meta k="РИТУАЛ"    v={c.ritual}    c={c.accent} />
        <Meta k="МАТЕРИАЛ"  v={c.materials} c={c.accent} />
        <Meta k="МОТИВ"     v={c.motif}     c={c.accent} />
        <Meta k="ТИП UI"    v={c.typography} c={c.accent} />
        <Meta k="ПОВЕРХН."  v={c.surface}   c={c.accent} />
      </div>

      {/* sample UI plate */}
      <div style={{ borderTop: `1px solid ${c.stroke}33`, padding: 20, background: 'var(--pit)' }}>
        <div className="mono-sm" style={{ color: c.accent, marginBottom: 12 }}>// SAMPLE · DIALOG HEAD</div>
        <div style={{
          padding: '14px 18px',
          background: 'var(--night)',
          border: `1px solid ${c.stroke}`,
          position: 'relative',
        }}>
          <span style={{ position:'absolute', top:-1, left:-1, width:10, height:10, borderTop:`1px solid ${c.accent}`, borderLeft:`1px solid ${c.accent}` }}/>
          <span style={{ position:'absolute', top:-1, right:-1, width:10, height:10, borderTop:`1px solid ${c.accent}`, borderRight:`1px solid ${c.accent}` }}/>
          <span style={{ position:'absolute', bottom:-1, left:-1, width:10, height:10, borderBottom:`1px solid ${c.accent}`, borderLeft:`1px solid ${c.accent}` }}/>
          <span style={{ position:'absolute', bottom:-1, right:-1, width:10, height:10, borderBottom:`1px solid ${c.accent}`, borderRight:`1px solid ${c.accent}` }}/>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: c.id === 'aztec' ? 800 : c.id === 'nord' ? 700 : 600,
            textTransform: c.id === 'nord' ? 'none' : 'uppercase',
            letterSpacing: c.id === 'aztec' ? '-0.04em' : c.id === 'nord' ? '0' : '-0.02em',
            color: 'var(--chalk)',
            lineHeight: 1.1,
          }}>
            {c.id === 'maya' && 'ПРИНЕСИ НАМ ПЯТЬ КРИСТАЛЛОВ'}
            {c.id === 'nord' && 'Куй с нами или пропадай'}
            {c.id === 'aztec' && 'СЕРДЦЕ КАМНЯ ЖАЖДЕТ'}
          </div>
          <div className="mono-sm" style={{ marginTop: 8 }}>{c.id === 'maya' && 'QUEST · CYCLE 5 · REP +3'}{c.id === 'nord' && 'QUEST · ETERNAL · REP +1/ch'}{c.id === 'aztec' && 'QUEST · MOD · REP +5'}</div>
        </div>
      </div>
    </div>
  );
};

const Meta = ({ k, v, c }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 14, borderTop: '1px dashed var(--carbon)', paddingTop: 10 }}>
    <span className="mono-sm" style={{ color: c }}>{k}</span>
    <span style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>{v}</span>
  </div>
);

const ConfessionsSection = () => (
  <Section
    ord="06 · CONFESSIONS"
    id="confessions"
    title="Конфессии"
    lede="Три первых стартовых города. Каждая конфессия — это законченный язык UI: цвет панелей, толщина рамки, типографика заголовка. На скрине переписки с городом ты должен узнавать конфессию за один кадр.">

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      {CONFESSIONS.map(c => <ConfessionCard key={c.id} c={c} />)}
    </div>

    <div style={{ marginTop: 48 }}>
      <div className="bracket">
        <span className="mono" style={{ color: 'var(--gold)', display: 'block', marginBottom: 6 }}>ЗАКОН КОНФЕССИИ В UI</span>
        Цвет рамки диалога = цвет конфессии. Шрифт заголовка реплики = типографика конфессии. Глиф в углу = глиф конфессии. Если конфессия читается только на трёх этих признаках одновременно — она работает. Если для распознавания нужен подпись «КИБЕР-МАЙЯ» — она не работает.
      </div>
    </div>
  </Section>
);

Object.assign(window, { ConfessionsSection });
