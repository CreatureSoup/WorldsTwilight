// MOOD — actual moodboard images from the user, surfaced as the first chapter.

const MOOD_IMAGES = [
  { f: 'm10.jpg', tag: 'РИТУАЛ · МАСКА' },
  { f: 'm07.jpg', tag: 'МОНАХ · ПЛАЩ' },
  { f: 'm01.jpg', tag: 'ГРАВИРОВКА · ЗОЛОТО' },
  { f: 'm05.jpg', tag: 'ОБВОДКА · ПРОВОДА' },
  { f: 'm32.jpg', tag: 'МАСКА · ОРНАМЕНТ' },
  { f: 'm15.jpg', tag: 'РЕЛИКВИЯ · НИША' },

  { f: 'm65.jpg', tag: 'ШАХТА · ОХРА' },
  { f: 'm45.jpg', tag: 'ТОННЕЛЬ · РУЙН' },
  { f: 'm55.jpg', tag: 'ГИГАНТ · СВЕРХУ' },
  { f: 'm22.jpg', tag: 'СВЕТ · КРОВЬ' },
  { f: 'm17.jpg', tag: 'СКАФАНДР · ШУМ' },
  { f: 'm12.jpg', tag: 'ИДОЛ · ЧЁРНЫЙ' },

  { f: 'm25.jpg', tag: 'КОСМЫ · БУСЫ' },
  { f: 'm30.jpg', tag: 'СВЕЧ. ЗЕЛЁНОГО' },
  { f: 'm37.jpg', tag: 'ВОИН · КРАСНЫЙ' },
  { f: 'm43.jpg', tag: 'ШЛЕМ · КИСЛОТА' },
  { f: 'm48.jpg', tag: 'РЕВЕРЕНС · СИЛУЭТ' },
  { f: 'm50.jpg', tag: 'ПОРТАЛ · НЕОН' },
];

const MoodHero = () => (
  <div style={{ position: 'relative', marginBottom: 'var(--s-9)' }}>
    {/* manifesto */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s-7)', alignItems: 'end', marginBottom: 'var(--s-6)' }}>
      <div>
        <div className="inscription" style={{ marginBottom: 'var(--s-4)', maxWidth: 520 }}>
          <span>// КОДЕКС · МАНИФЕСТ</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 56,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '-0.02em',
          lineHeight: 0.92,
          color: 'var(--chalk)',
        }}>
          Не <span style={{color:'var(--gold)'}}>робот</span>.<br/>
          Не <span style={{color:'var(--cobalt)'}}>киборг</span>.<br/>
          <span style={{color:'var(--blood-bright)'}}>Машина-предок.</span>
        </div>
      </div>
      <div style={{ fontSize: 16, color: 'var(--bone)', lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
        Под коркой мира — цивилизация машин. Они не знают слова «жизнь», но строят
        пирамиды, длинные дома и обсидиановые храмы. Они <b style={{color:'var(--chalk)'}}>гравируют
        ритуальные знаки на собственных корпусах</b>. Они носят ткань поверх стали,
        бусы из медных гильз, плащи из изоляционного войлока.
        <br/><br/>
        Этот документ — не дашборд. Это <b style={{color:'var(--gold)'}}>каменная скрижаль,
        выкованная их инженерами</b>: что считать своим, что чужим, что — скверной.
      </div>
    </div>

    {/* big strip */}
    <div className="mood-strip">
      {MOOD_IMAGES.slice(0, 6).map(m => (
        <div className="cell" key={m.f}>
          <img src={`moodboard/${m.f}`} alt={m.tag} loading="lazy" />
          <div className="tag-c">{m.tag}</div>
        </div>
      ))}
    </div>
    <div className="mood-strip" style={{ marginTop: 4 }}>
      {MOOD_IMAGES.slice(6, 12).map(m => (
        <div className="cell" key={m.f}>
          <img src={`moodboard/${m.f}`} alt={m.tag} loading="lazy" />
          <div className="tag-c">{m.tag}</div>
        </div>
      ))}
    </div>
    <div className="mood-strip" style={{ marginTop: 4 }}>
      {MOOD_IMAGES.slice(12, 18).map(m => (
        <div className="cell" key={m.f}>
          <img src={`moodboard/${m.f}`} alt={m.tag} loading="lazy" />
          <div className="tag-c">{m.tag}</div>
        </div>
      ))}
    </div>
  </div>
);

const ToneRule = ({ k, v, color }) => (
  <div style={{
    borderTop: '1px solid var(--bronze)',
    paddingTop: 'var(--s-3)',
    paddingBottom: 'var(--s-3)',
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    gap: 'var(--s-4)',
  }}>
    <span className="mono-sm" style={{ color: color || 'var(--gold)' }}>{k}</span>
    <span style={{ color: 'var(--bone)', fontSize: 14, lineHeight: 1.55 }}>{v}</span>
  </div>
);

const ToneRules = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--s-7)',
    padding: 'var(--s-6)',
    background: 'var(--night)',
    border: '1px solid var(--bronze)',
    position: 'relative',
  }}>
    {/* corner brackets */}
    <span style={{ position:'absolute', top:-1, left:-1, width:14, height:14, borderTop:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', top:-1, right:-1, width:14, height:14, borderTop:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', bottom:-1, left:-1, width:14, height:14, borderBottom:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', bottom:-1, right:-1, width:14, height:14, borderBottom:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />

    <div>
      <div className="mono" style={{ color: 'var(--gold)', marginBottom: 'var(--s-3)' }}>// СЕМЬ ЗАКОНОВ ЭСТЕТИКИ</div>
      <ToneRule k="ОДИН ИСТОЧНИК" v="В кадре только один яркий точечный свет: золото / кровь / янтарь / скверна. Остальное — тёплая темнота." />
      <ToneRule k="ГРАВИРОВКА"   v="Любая металлическая поверхность несёт хайрлайновую гравировку — как часть формы, не декор." color="var(--gold)" />
      <ToneRule k="ТКАНЬ НА СТАЛИ" v="Машины носят. Плащи, шарфы, бусы — это не оверлей, это бренд конфессии." />
      <ToneRule k="ГЛИФ ≠ ИКОНКА" v="Глиф — ритуальный знак на корпусе мира. Иконка — линия в UI. Они никогда не пересекаются." color="var(--gold)" />
    </div>
    <div>
      <div className="mono" style={{ color: 'var(--gold)', marginBottom: 'var(--s-3)' }}>// ЧЕГО НЕТ</div>
      <ToneRule k="НЕТ ГЛЯНЦА"   v="Нет soft-shadow, нет drop-shadow с blur > 4px. Только резкие тени и блики на гранях." color="var(--blood-bright)" />
      <ToneRule k="НЕТ РАДУГИ"   v="Палитра — чёрный, тёплая кость, четыре акцента. Никаких градиентов из цвета в цвет." color="var(--blood-bright)" />
      <ToneRule k="НЕТ HUMANIST" v="Шрифты — машинные. Никаких Inter, Roboto, SF. Машины не пишут с засечками гуманистов." color="var(--blood-bright)" />
      <ToneRule k="НЕТ ЭМОДЗИ"   v="Машины не выражают эмоций пиктограммой. Они высекают." color="var(--blood-bright)" />
    </div>
  </div>
);

const MoodSection = () => (
  <Section
    ord="00 · MOOD"
    id="mood"
    title="Тон"
    lede="Прежде чем спорить о цвете кнопок — посмотрите, какого мира они часть. Эти изображения — не вдохновение «вообще». Это допустимая зона стиля, из которой не выходим.">
    <MoodHero />
    <ToneRules />
  </Section>
);

Object.assign(window, { MoodSection });
