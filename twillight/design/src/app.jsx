// App shell v2 — assembles sections, hero, sidenav.

const Sidenav = () => (
  <aside className="sidenav">
    <div className="brand">
      <span className="b1">Сумерки</span>
      <span className="b2">Мира</span>
      <small>Design Codex · v0.2</small>
    </div>
    <ol>
      <li><a href="#mood"><span className="n">00</span> Тон</a></li>
      <li><a href="#foundations"><span className="n">01</span> Основания</a></li>
      <li><a href="#texture"><span className="n">02</span> Поверхности</a></li>
      <li><a href="#iconography"><span className="n">03</span> Иконы / глифы</a></li>
      <li><a href="#components"><span className="n">04</span> Компоненты</a></li>
      <li><a href="#confessions"><span className="n">05</span> Конфессии</a></li>
      <li><a href="#screens"><span className="n">06</span> Экраны</a></li>
      <li><a href="#references"><span className="n">07</span> Референсы</a></li>
    </ol>
    <div className="meta">
      <div><span className="pulse"></span>LINK · STABLE</div>
      <div style={{ marginTop: 6 }}>SECTOR 04-N</div>
      <div>SEED 0x7A3F</div>
      <div>BUILD M1.0</div>
      <div style={{ marginTop: 12, color: 'var(--gold)' }}>// IRON, КРОВЬ, СКВЕРНА</div>
    </div>
  </aside>
);

const Hero = () => (
  <header className="hero">
    <div className="grain-bg" />

    {/* engraved corner frame */}
    <span style={{ position:'absolute', top:32, left:32, width:24, height:24, borderTop:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', top:32, right:32, width:24, height:24, borderTop:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', bottom:32, left:32, width:24, height:24, borderBottom:'1px solid var(--gold)', borderLeft:'1px solid var(--gold)' }} />
    <span style={{ position:'absolute', bottom:32, right:32, width:24, height:24, borderBottom:'1px solid var(--gold)', borderRight:'1px solid var(--gold)' }} />

    <div className="pre">
      <span>КОДЕКС ВИЗУАЛА · M1 · v0.2</span>
    </div>

    <h1>
      <span style={{ color: 'var(--chalk)' }}>СУМЕРКИ</span><br/>
      <span className="gold">МИРА</span>
      <small>// Roguelite. Машинная цивилизация. Подземелье. Скверна.</small>
    </h1>

    <div className="sub">
      Мир был. Мира больше нет. <b>Только машины,</b> зарывшиеся под корку хлама,
      хранят его осколки — в виде языка, ритуалов и форм. Они печатают новые тела,
      ходят в шахту, торгуются с дальними городами и боятся <span style={{color:'var(--toxic)'}}>дикую глубину</span>.
      <br/><br/>
      Этот документ диктует, как они выглядят, говорят и оставляют след в кадре.
    </div>

    <div className="meta-row">
      <div className="cell">
        <span className="k">// PROJECT</span>
        <span className="v">twilight-of-the-world</span>
      </div>
      <div className="cell">
        <span className="k">// ENGINE</span>
        <span className="v">HTML · Canvas 2D · Vanilla</span>
      </div>
      <div className="cell">
        <span className="k">// STAGE</span>
        <span className="v">M1 — playable loop</span>
      </div>
      <div className="cell">
        <span className="k">// UPDATED</span>
        <span className="v">2026 · 05 · 24</span>
      </div>
    </div>
  </header>
);

const App = () => (
  <div className="shell">
    <Sidenav />
    <main>
      <Hero />
      <div className="doc">
        {window.MoodSection && <MoodSection />}
        {window.FoundationsSection && <FoundationsSection />}
        {window.TextureSection && <TextureSection />}
        {window.IconographySection && <IconographySection />}
        {window.ComponentsSection && <ComponentsSection />}
        {window.WorldSection && <WorldSection />}
        {window.UnitsSection && <UnitsSection />}
        {window.ConfessionsSection && <ConfessionsSection />}
        {window.ScreensSection && <ScreensSection />}
        {window.ReferencesSection && <ReferencesSection />}
      </div>
    </main>
  </div>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
