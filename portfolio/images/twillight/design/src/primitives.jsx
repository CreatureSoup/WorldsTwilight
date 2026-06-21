// Primitives: reusable atoms shared across sections.

const Section = ({ ord, id, title, lede, children }) => (
  <section className="section" id={id}>
    <div className="section-head">
      <div className="ord">{ord}</div>
      <div>
        <h2>{title}</h2>
        {lede && <div className="lede">{lede}</div>}
      </div>
    </div>
    {children}
  </section>
);

const Row = ({ label, children }) => (
  <div className="row">
    <div className="label">{label}</div>
    <div>{children}</div>
  </div>
);

const Panel = ({ title, meta, corners, children, style }) => (
  <div className="panel" style={style}>
    {corners && <div className="corners"><i></i></div>}
    {(title || meta) && (
      <div className="panel-head">
        <div className="mono-sm">{title}</div>
        {meta && <div className="mono-sm" style={{ color: 'var(--skverna)' }}>{meta}</div>}
      </div>
    )}
    <div className="panel-body">{children}</div>
  </div>
);

const Bracket = ({ children }) => <div className="bracket">{children}</div>;

// inline corner-bracket frame for screen mocks
const CornerFrame = ({ children, height, width, color = 'var(--steel)' }) => (
  <div
    style={{
      position: 'relative',
      width: width || '100%',
      height,
      padding: 14,
      border: `1px solid ${color}`,
      background: 'var(--void)',
    }}
  >
    {[
      [0,0,'tl'],[0,1,'tr'],[1,0,'bl'],[1,1,'br'],
    ].map(([r,c,k]) => (
      <span key={k} style={{
        position: 'absolute',
        [r ? 'bottom' : 'top']: -1,
        [c ? 'right' : 'left']: -1,
        width: 8, height: 8,
        borderTop: r ? 'none' : `1px solid var(--skverna)`,
        borderBottom: r ? `1px solid var(--skverna)` : 'none',
        borderLeft: c ? 'none' : `1px solid var(--skverna)`,
        borderRight: c ? `1px solid var(--skverna)` : 'none',
      }} />
    ))}
    {children}
  </div>
);

Object.assign(window, { Section, Row, Panel, Bracket, CornerFrame });
