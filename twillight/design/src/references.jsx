// 09 — REFERENCES v2: text-only list. Five categories.

const REFERENCES = [
  {
    cat: 'ИНДАСТРИАЛ · ГРЯЗЬ',
    catColor: 'var(--blood-bright)',
    note: 'Зона, корка хлама, индустриальный декай. Палитра, плотность UI.',
    items: [
      { t: 'S.T.A.L.K.E.R. · Серия',     y: '2007+', n: 'Кириллический моно-HUD, физические артефакты в карманах, дозиметр-щёлкает-всегда.' },
      { t: 'Metro Exodus',                y: '2019',  n: 'Свет фонаря как единственный источник в кадре. Каркас тех-обвески.' },
      { t: 'Death Stranding',             y: '2019',  n: 'Без неона. UI как технический прибор. Кобальт + пустота вокруг.' },
      { t: 'Signalis',                    y: '2022',  n: 'CRT-эстетика. Скобки-уголки, моно-теги, кириллица-вкрапления.' },
    ],
  },
  {
    cat: 'РИТУАЛ · МАШИНА',
    catColor: 'var(--gold)',
    note: 'Машины с ритуальной орнаментикой. Гравировка, ткань поверх стали.',
    items: [
      { t: 'Horizon Zero Dawn',           y: '2017',  n: 'Племенные накладки на машинах. Маски, узоры, ритуальная инкрустация.' },
      { t: 'NieR: Automata',              y: '2017',  n: 'UI как голос ИИ. Моно-плотность, уголки скобками, тишина в кадре.' },
      { t: 'Returnal',                    y: '2021',  n: 'Биолюминесцентные глифы на чёрном камне. Чужая археология.' },
      { t: 'Jason Scarecrow · art',       y: '2024',  n: 'Мехи с тканевыми плащами и каллиграфией на корпусе.' },
    ],
  },
  {
    cat: 'ПОДЗЕМЕЛЬЕ · ГИГАНТИЗМ',
    catColor: 'var(--amber)',
    note: 'Подземный мир с массивными инженерными мегаструктурами.',
    items: [
      { t: 'Caves of Qud',                y: '2015+', n: 'Терминал, мутация, странный научный сленг. Голос ИИ — «измерение, не оценка».' },
      { t: 'Rain World · Subterranean',   y: '2017',  n: 'Тёплая темнота, точечные свечения, отсутствие безопасности.' },
      { t: 'Dome Keeper',                 y: '2022',  n: 'Жилы-кластеры, циклы волн. Прямой геймплей-источник.' },
      { t: 'Stoneshard',                  y: '2020',  n: 'Брутальная типографика инвентаря. Цветовое кодирование редкости.' },
    ],
  },
  {
    cat: 'ТИПОГРАФИКА · UI',
    catColor: 'var(--cobalt)',
    note: 'Где взять моно-плотность и квадратную машинную типографику.',
    items: [
      { t: 'Frostpunk UI',                y: '2018',  n: 'Брутальный циферблат-индастриал. Радиальная диаграмма как герой кадра.' },
      { t: 'Into the Breach',             y: '2018',  n: 'Минимум UI. Всё через цвет и положение.' },
      { t: 'Foundation · Apple TV',       y: '2021+', n: 'Огромные холодные титры. Tektur-подобная геометрия.' },
      { t: 'Tektur · Andrew Footit',      y: '—',     n: 'Шрифт-донор. Машинная квадратная кириллица.' },
    ],
  },
  {
    cat: 'ПРОТИВО-РЕФЕРЕНС',
    catColor: 'var(--blood-bright)',
    note: 'Куда мы НЕ идём. Учитываем, чтобы не сваливаться.',
    items: [
      { t: 'Cyberpunk 2077 UI',           y: '2020',  n: 'Жёлто-розовый glitch и панели-стикеры. Перенасыщенность. NO.' },
      { t: 'Borderlands UI',              y: '2009+', n: 'Кислотный комикс. Контур-вектор. NO.' },
      { t: 'Generic SaaS dashboards',     y: '—',     n: 'Inter / SF / Roboto, мягкие тени, голубые кнопки. NO.' },
      { t: 'Material You',                y: '—',     n: 'Гладкие пилюли, гумано-цветовые токены. NO.' },
    ],
  },
];

const RefRow = ({ item }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 16, padding: '14px 0', borderTop: '1px dashed var(--carbon)', alignItems: 'baseline' }}>
    <div>
      <div style={{ fontSize: 15, color: 'var(--chalk)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>{item.t}</div>
      <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.55, marginTop: 6, fontFamily: 'var(--font-body)' }}>{item.n}</div>
    </div>
    <div className="mono-sm" style={{ textAlign: 'right' }}>{item.y}</div>
  </div>
);

const ReferencesSection = () => (
  <Section
    ord="09 · REFERENCES"
    id="references"
    title="Референсы"
    lede="Каждая ссылка отвечает за конкретный аспект кодекса. Контр-примеры — тоже референс: они объясняют, куда мы не идём.">

    {REFERENCES.map(g => (
      <div key={g.cat} style={{ marginBottom: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, background: g.catColor }} />
          <span className="mono" style={{ color: g.catColor }}>// {g.cat}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--pewter)', maxWidth: 720, lineHeight: 1.55, fontFamily: 'var(--font-body)', marginBottom: 18 }}>{g.note}</div>
        <div className="grid-2" style={{ gap: 0 }}>
          <div style={{ paddingRight: 24, borderRight: '1px solid var(--bronze)' }}>
            {g.items.slice(0, 2).map(it => <RefRow key={it.t} item={it} />)}
          </div>
          <div style={{ paddingLeft: 24 }}>
            {g.items.slice(2, 4).map(it => <RefRow key={it.t} item={it} />)}
          </div>
        </div>
      </div>
    ))}

    {/* closing note */}
    <div style={{ marginTop: 32, padding: 32, background: 'var(--night)', border: '1px solid var(--gold)', position: 'relative' }}>
      {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h]) => (
        <span key={v+h} style={{
          position:'absolute', [v]: -1, [h]: -1, width: 16, height: 16,
          [`border${v==='top'?'Top':'Bottom'}`]: '1px solid var(--gold)',
          [`border${h==='left'?'Left':'Right'}`]: '1px solid var(--gold)',
        }}/>
      ))}
      <div className="mono" style={{ color: 'var(--gold)', marginBottom: 14 }}>// CLOSING NOTE · ЛИНИЯ СБОРКИ</div>
      <div style={{ fontSize: 15, color: 'var(--bone)', lineHeight: 1.65, maxWidth: 880, fontFamily: 'var(--font-body)' }}>
        Если будете спорить о цвете — открывайте <b className="chalk-c">§01 Основания</b>.
        Если о рамке или эффекте — <b className="chalk-c">§02 Атмосфера</b>.
        Если о значке — <b className="chalk-c">§03 Иконы и глифы</b>.
        Если кто-то предлагает поставить пиктограмму солнца на UI-кнопку — это нарушение §03. Глифы живут в мире, схемы — в интерфейсе. Скверна всегда жёлто-зелёная. ИИ всегда говорит мономером. Игроку никогда не показывают слово «радиация» — только «помехи», «скверна», «фон».
      </div>
      <div style={{ marginTop: 22, display: 'flex', gap: 32, alignItems: 'center' }}>
        <span className="mono-sm">// DESIGN CODEX · v0.2</span>
        <span className="mono-sm" style={{ color: 'var(--gold)' }}>// STATUS · READY FOR M1</span>
        <span className="mono-sm">// UPDATED · 2026 · 05 · 24</span>
      </div>
    </div>
  </Section>
);

Object.assign(window, { ReferencesSection });
