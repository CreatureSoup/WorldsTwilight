// 05 — COMPONENTS v2: full UI surface — buttons, bars, tags, panels, forms,
// sliders, toggles, dropdowns, tabs, KPIs, lists, log lines, notifications.

const componentStyles = `
.btn {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: var(--bronze);
  color: var(--bone);
  border: 1px solid var(--carbon);
  padding: 11px 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: all var(--d-1) var(--ease);
  user-select: none;
  position: relative;
}
.btn:hover {
  background: var(--carbon);
  color: var(--chalk);
  border-color: var(--ash);
}
.btn.primary {
  background: transparent;
  color: var(--gold);
  border-color: var(--gold);
}
.btn.primary:hover {
  background: var(--gold);
  color: var(--void);
}
.btn.data {
  background: transparent;
  color: var(--cobalt);
  border-color: var(--cobalt);
}
.btn.data:hover {
  background: var(--cobalt);
  color: var(--void);
}
.btn.danger {
  background: transparent;
  color: var(--blood-bright);
  border-color: var(--blood);
}
.btn.danger:hover {
  background: var(--blood);
  color: var(--chalk);
}
.btn.toxic {
  background: transparent;
  color: var(--toxic);
  border-color: var(--toxic);
}
.btn.toxic:hover {
  background: var(--toxic);
  color: var(--void);
}
.btn.ghost {
  background: transparent;
  color: var(--pewter);
  border-color: var(--bronze);
}
.btn.ghost:hover {
  color: var(--bone);
  border-color: var(--ash);
}
.btn.lg { padding: 16px 24px; font-size: 12px; }
.btn.sm { padding: 7px 12px; font-size: 10px; }
.btn:disabled { color: var(--ash); border-color: var(--bronze); background: var(--earth); cursor: not-allowed; }

.bar {
  position: relative;
  height: 14px;
  background: var(--earth);
  border: 1px solid var(--bronze);
  overflow: hidden;
}
.bar > .fill { height: 100%; transition: width var(--d-3) var(--ease); }
.bar.thin { height: 6px; }
.bar.fat  { height: 22px; }
.bar.hp      .fill { background: linear-gradient(to right, #5a1a14, var(--blood-bright)); }
.bar.energy  .fill { background: linear-gradient(to right, #4a2810, var(--amber)); }
.bar.skverna .fill { background: linear-gradient(to right, #6a8020, var(--toxic-bright)); }
.bar.data    .fill { background: linear-gradient(to right, #1f3a48, var(--cobalt)); }
.bar.gold    .fill { background: linear-gradient(to right, #4a3618, var(--gold-bright)); }
.bar .notch { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--void); opacity: 0.6; }

input[type=text].field, input[type=number].field, textarea.field, select.field {
  font-family: var(--font-mono);
  font-size: 13px;
  background: var(--earth);
  color: var(--chalk);
  border: 1px solid var(--bronze);
  padding: 10px 12px;
  width: 100%;
  outline: none;
  letter-spacing: 0.04em;
  transition: border-color var(--d-1);
}
input[type=text].field:focus, textarea.field:focus {
  border-color: var(--gold);
}
textarea.field { min-height: 80px; resize: vertical; }

.range-track {
  position: relative; height: 6px;
  background: var(--earth);
  border: 1px solid var(--bronze);
}
.range-fill { position: absolute; left: 0; top: 0; bottom: 0; background: var(--gold); }
.range-thumb {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  width: 14px; height: 14px;
  background: var(--gold);
  border: 1px solid var(--void);
  cursor: pointer;
}
`;

const Button = ({ variant = 'default', size, children, icon, ...rest }) => (
  <button className={`btn ${variant} ${size || ''}`} {...rest}>
    {icon}
    <span>{children}</span>
  </button>
);

const ButtonsBlock = () => (
  <Row label="01 · КНОПКИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Контур + uppercase mono. Заливка только на hover. Primary — золото (главное действие). Data — кобальт (системное). Danger — кровь (деструктив). Toxic — скверна (рискованное «нырнуть»). Ghost — отмена.
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" size="lg">В ШАХТУ</Button>
        <Button variant="data">Сканировать</Button>
        <Button variant="toxic">Нырнуть в скверну</Button>
        <Button variant="danger">Сбросить корпус</Button>
        <Button>Пауза</Button>
        <Button variant="ghost">Отмена</Button>
        <Button variant="primary" disabled>Связь утеряна</Button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" size="sm">DEPLOY</Button>
        <Button variant="data" size="sm">SYNC</Button>
        <Button variant="ghost" size="sm">CANCEL</Button>
        <Button variant="danger" size="sm">PURGE</Button>
      </div>
    </div>
  </Row>
);

const Bar = ({ value, max = 100, kind = 'hp', size, notches, label, unit }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && (
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="mono-sm" style={{ color: 'var(--bone)' }}>{label}</span>
        <span className="mono-sm" style={{ color:
          kind === 'hp' ? 'var(--blood-bright)' :
          kind === 'energy' ? 'var(--amber)' :
          kind === 'skverna' ? 'var(--toxic)' :
          kind === 'gold' ? 'var(--gold)' :
          'var(--cobalt)' }}>
          {value}/{max} {unit}
        </span>
      </div>
    )}
    <div className={`bar ${size || ''} ${kind}`}>
      <div className="fill" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      {notches && [...Array(notches - 1)].map((_, i) => (
        <div key={i} className="notch" style={{ left: `${((i + 1) / notches) * 100}%` }} />
      ))}
    </div>
  </div>
);

const BarsBlock = () => (
  <Row label="02 · ШКАЛЫ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Шкала — единственный элемент UI без скруглений и без рамки сильнее 1 px. Всегда с подписью моно слева и значением справа. Цвет fill кодирует ресурс.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28, marginTop: 28, padding: 24, background: 'var(--night)', border: '1px solid var(--bronze)' }}>
      <Bar label="HP / КОРПУС"        value={62}  max={100} kind="hp" />
      <Bar label="ENERGY / ЭНЕРГИЯ"   value={42}  max={100} kind="energy" />
      <Bar label="SKVERNA / СКВЕРНА"  value={78}  max={100} kind="skverna" />
      <Bar label="LINK / СВЯЗЬ"       value={94}  max={100} kind="data" />
      <Bar label="HONOR / ЧЕСТЬ"      value={3}   max={5}   kind="gold"   unit="ранг" size="thin" notches={5} />
      <Bar label="CITY / РЕАКТОР"     value={2}   max={3}   kind="energy" unit="контур" size="fat"  notches={3} />
    </div>
  </Row>
);

const Tag = ({ kind, children }) => <span className={`tag ${kind || ''}`}>{children}</span>;

const TagsBlock = () => (
  <Row label="03 · ТЕГИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Тег описывает <b>состояние</b>, не действие. Максимум два слова. Один цвет — одна семантика.
    </p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 28 }}>
      <Tag>STAND-BY</Tag>
      <Tag kind="gold">ELDER · TIER 3</Tag>
      <Tag kind="toxic">СКВЕРНА · HOT</Tag>
      <Tag kind="data">SCAN ACTIVE</Tag>
      <Tag kind="blood">HULL CRIT</Tag>
      <Tag kind="amber">ТЕПЛО · 6.2°</Tag>
      <Tag>СПЯТ</Tag>
      <Tag kind="blood">СВЯЗЬ ОБОРВАНА</Tag>
      <Tag kind="data">QUEST [3/5]</Tag>
      <Tag kind="gold">RELIC FOUND</Tag>
    </div>
  </Row>
);

/* ===== FORMS =========================================================== */

const FormsBlock = () => {
  const [sliderVal, setSliderVal] = React.useState(0.4);
  const [toggleA, setToggleA] = React.useState(true);
  const [toggleB, setToggleB] = React.useState(false);
  const [radio, setRadio] = React.useState('a');
  const [tab, setTab] = React.useState('drill');

  return (
    <Row label="04 · ФОРМЫ">
      <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
        Поля ввода, переключатели, ползунки, чекбоксы. Никакого «iOS-toggle» — переключатель здесь это <b>железный рычаг</b>: квадратный, тяжёлый, либо ВКЛ, либо ВЫКЛ.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 28 }}>
        {/* left column — inputs */}
        <div style={{ padding: 20, background: 'var(--night)', border: '1px solid var(--bronze)' }}>
          <div className="mono" style={{ color: 'var(--gold)', marginBottom: 16 }}>// ПОЛЯ ВВОДА</div>

          <Field label="ИМЯ ЯДРА">
            <input className="field" type="text" defaultValue="ЮНИТ-014 · НОРД" />
          </Field>
          <Field label="СИДДЫ ЗАБЕГА">
            <input className="field" type="text" defaultValue="0x7A3F" />
          </Field>
          <Field label="ЗАМЕТКА">
            <textarea className="field" defaultValue="кожух v.2 не выдержал в гнезде R−12. Усилить керамикой." />
          </Field>
          <Field label="ВЫБОР МОДУЛЯ">
            <select className="field">
              <option>DRILL · V.2</option>
              <option>DRILL · V.3 — обсидиан</option>
              <option>ENGINE · L</option>
              <option>CASING · CERAMIC</option>
            </select>
          </Field>
        </div>

        {/* right — controls */}
        <div style={{ padding: 20, background: 'var(--night)', border: '1px solid var(--bronze)' }}>
          <div className="mono" style={{ color: 'var(--gold)', marginBottom: 16 }}>// КОНТРОЛЫ</div>

          <Field label="ОБЪЁМ СКАНЕРА">
            <Slider value={sliderVal} onChange={setSliderVal} />
          </Field>

          <Field label="АВТО-ОБРАЩЕНИЕ">
            <Toggle on={toggleA} onClick={() => setToggleA(!toggleA)} />
          </Field>

          <Field label="СБРОС ПРИ ПЕРЕГРЕВЕ">
            <Toggle on={toggleB} onClick={() => setToggleB(!toggleB)} />
          </Field>

          <Field label="ПРОФИЛЬ ПОВЕДЕНИЯ">
            <Segmented options={[['a','осторожный'],['b','стандарт'],['c','рискованный']]} value={radio} onChange={setRadio} />
          </Field>

          <Field label="МОДУЛЬ / ВКЛАДКА">
            <Tabs options={[['drill','бур'],['eng','двигатель'],['hull','корпус'],['sensor','сенсор']]} value={tab} onChange={setTab} />
          </Field>
        </div>
      </div>
    </Row>
  );
};

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
    <span className="mono-sm" style={{ color: 'var(--pewter)' }}>{label}</span>
    {children}
  </div>
);

const Slider = ({ value, onChange }) => {
  const ref = React.useRef(null);
  const handle = (e) => {
    const r = ref.current.getBoundingClientRect();
    const v = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onChange(v);
  };
  return (
    <div ref={ref} className="range-track" onMouseDown={handle} onClick={handle} style={{ height: 8 }}>
      <div className="range-fill" style={{ width: `${value * 100}%` }} />
      <div className="range-thumb" style={{ left: `${value * 100}%`, width: 4, height: 16, background: 'var(--gold)' }} />
      <span className="mono-sm" style={{ position: 'absolute', right: -36, top: -3, color: 'var(--gold)' }}>{Math.round(value * 100)}%</span>
    </div>
  );
};

const Toggle = ({ on, onClick }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 12,
    padding: '6px 10px 6px 6px',
    background: on ? 'var(--gold-dim)' : 'var(--earth)',
    border: `1px solid ${on ? 'var(--gold)' : 'var(--carbon)'}`,
    color: on ? 'var(--gold)' : 'var(--pewter)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'all var(--d-1)',
  }}>
    <div style={{
      width: 22, height: 14,
      background: on ? 'var(--gold)' : 'var(--carbon)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        left: on ? 12 : 1, top: 1,
        width: 9, height: 12,
        background: on ? 'var(--void)' : 'var(--ash)',
        transition: 'left var(--d-1)',
      }} />
    </div>
    {on ? 'ВКЛ' : 'ВЫКЛ'}
  </button>
);

const Segmented = ({ options, value, onChange }) => (
  <div style={{ display: 'inline-flex', border: '1px solid var(--bronze)' }}>
    {options.map(([v, label]) => (
      <button key={v} onClick={() => onChange(v)} style={{
        background: v === value ? 'var(--gold)' : 'transparent',
        color: v === value ? 'var(--void)' : 'var(--bone)',
        border: 'none',
        borderRight: '1px solid var(--bronze)',
        padding: '8px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all var(--d-1)',
      }}>
        {label}
      </button>
    ))}
  </div>
);

const Tabs = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', borderBottom: '1px solid var(--bronze)' }}>
    {options.map(([v, label]) => (
      <button key={v} onClick={() => onChange(v)} style={{
        background: 'none',
        border: 'none',
        borderBottom: v === value ? '2px solid var(--gold)' : '2px solid transparent',
        color: v === value ? 'var(--gold)' : 'var(--pewter)',
        padding: '10px 16px 10px 0',
        marginRight: 18,
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}>{label}</button>
    ))}
  </div>
);

/* ===== KPI / DATA ====================================================== */

const KPI = ({ k, v, unit, kind = 'default', delta }) => (
  <div style={{ padding: '16px 18px', background: 'var(--night)', border: '1px solid var(--bronze)', position: 'relative' }}>
    {[['top','left'],['top','right']].map(([vp,h]) => (
      <span key={vp+h} style={{
        position: 'absolute', [vp]: -1, [h]: -1, width: 10, height: 10,
        [`border${vp==='top'?'Top':'Bottom'}`]: '1px solid var(--gold-dim)',
        [`border${h==='left'?'Left':'Right'}`]: '1px solid var(--gold-dim)',
      }} />
    ))}
    <div className="mono-sm" style={{ color: 'var(--pewter)' }}>{k}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 36,
        color: kind === 'gold' ? 'var(--gold)' : kind === 'blood' ? 'var(--blood-bright)' : kind === 'toxic' ? 'var(--toxic)' : kind === 'amber' ? 'var(--amber)' : 'var(--chalk)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>{v}</span>
      {unit && <span className="mono-sm">{unit}</span>}
    </div>
    {delta && (
      <div className="mono-sm" style={{ color: delta.startsWith('+') ? 'var(--toxic)' : 'var(--blood-bright)', marginTop: 4 }}>
        {delta}
      </div>
    )}
  </div>
);

const KPIBlock = () => (
  <Row label="05 · ПОКАЗАТЕЛИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Карточка ключевого показателя. Tektur тяжёлым весом — большое число; мономер сверху — название. Дельта снизу — только если важна динамика.
    </p>
    <div className="grid-4" style={{ marginTop: 28 }}>
      <KPI k="// ГЛУБИНА"   v="−124" unit="м"   kind="chalk" delta="+12 / цикл" />
      <KPI k="// ДОБЫЧА"    v="84"   unit="бл"  kind="gold"  delta="+22 / цикл" />
      <KPI k="// ПОТЕРИ"    v="3"    unit="тел" kind="blood" delta="+1 / цикл" />
      <KPI k="// СКВЕРНА"   v="6.4"  unit="r/s" kind="toxic" delta="+0.8 / цикл" />
    </div>
  </Row>
);

/* ===== LIST / LOG ====================================================== */

const LogLine = ({ t, k, v, color }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '60px 110px 1fr', gap: 16, padding: '8px 0', borderTop: '1px dashed var(--carbon)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
    <span style={{ color: 'var(--ash)' }}>{t}</span>
    <span style={{ color: color || 'var(--gold)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>{k}</span>
    <span style={{ color: 'var(--bone)' }}>{v}</span>
  </div>
);

const LogBlock = () => (
  <Row label="06 · ЖУРНАЛ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Журнал событий — главный поток текста в UI. Колонки: время, источник, сообщение. Источник кодируется цветом — голос ИИ, ядро юнита, голос города, помехи.
    </p>
    <div style={{ marginTop: 28, padding: '8px 20px 20px', background: 'var(--night)', border: '1px solid var(--bronze)' }}>
      <div className="panel-head" style={{ margin: '0 -20px 12px', padding: '12px 20px' }}>
        <span className="mono-sm" style={{ color: 'var(--gold)' }}>// JOURNAL · CYCLE 3</span>
        <span className="mono-sm">VOICES · 4 · ENTRIES · 247</span>
      </div>
      <LogLine t="00:12" k="AI · SCAN"   v="жила органики в радиусе 4 блока вниз-влево" color="var(--cobalt)" />
      <LogLine t="00:18" k="HULL"        v="HP −12 / порода 2.5 / частичный пробой" color="var(--blood-bright)" />
      <LogLine t="00:24" k="AI · WARN"   v="уровень помех 6.4 — кожух v.2 не выдержит" color="var(--toxic)" />
      <LogLine t="00:32" k="МАЙЯ"        v="«диск тускнеет. принеси нам пять кристаллов»" color="var(--gold)" />
      <LogLine t="00:41" k="ПРИНТЕР"     v="новое тело в очереди. слотов: 1" color="var(--amber)" />
      <LogLine t="00:47" k="//helix//"   v="//я слышу// тебя //плюс// четыре" color="var(--pewter)" />
      <LogLine t="01:02" k="AI · RAID"   v="контур базы пробит. резерв 1/3. возврат критичен" color="var(--blood-bright)" />
    </div>
  </Row>
);

/* ===== NOTIFICATIONS / DIALOGS ========================================= */

const Notification = ({ kind, title, body }) => {
  const c = kind === 'gold' ? 'var(--gold)'
        : kind === 'blood' ? 'var(--blood-bright)'
        : kind === 'toxic' ? 'var(--toxic)'
        : kind === 'amber' ? 'var(--amber)'
        : 'var(--cobalt)';
  return (
    <div style={{ padding: '14px 16px', background: 'var(--night)', border: `1px solid ${c}`, maxWidth: 380, position: 'relative' }}>
      <span style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: `1px solid ${c}`, borderLeft: `1px solid ${c}` }} />
      <span style={{ position: 'absolute', top: -1, right: -1, width: 12, height: 12, borderTop: `1px solid ${c}`, borderRight: `1px solid ${c}` }} />
      <div className="mono-sm" style={{ color: c, marginBottom: 6 }}>// {title}</div>
      <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.55, fontFamily: 'var(--font-body)' }}>{body}</div>
    </div>
  );
};

const NotificationsBlock = () => (
  <Row label="07 · ПОДСКАЗКИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Подсказка — короткое технически точное сообщение от ИИ. Без восклицаний, без «attention», без «warning!». ИИ <b>измеряет</b>, не оценивает.
    </p>
    <div className="grid-2" style={{ marginTop: 28 }}>
      <Notification kind="cobalt" title="AI · SCAN PING" body="Жила органики в радиусе 4 блока вниз-влево. Рекомендую отклонение маршрута." />
      <Notification kind="toxic"  title="AI · SKVERNA WARN" body="Уровень помех 6.4. Кожух v.2 не выдержит. Точка обращения через 12 сек." />
      <Notification kind="blood"  title="AI · CITY RAID"    body="Контур базы пробит. Реактор-резерв 1 из 3. Возврат критичен." />
      <Notification kind="amber"  title="PRINTER · BODY READY" body="Новое тело в очереди. Слотов: 1. Сборка по последнему профилю." />
      <Notification kind="gold"   title="RELIC // FOUND"    body="В породе обнаружен артефакт неизвестной конфессии. Передайте на ближайшую базу." />
      <Notification kind="cobalt" title="LINK · DROPOUT"    body="Помехи 7.1. Связь с юнитом-014 потеряна на 4.2 сек. Восстановлено." />
    </div>
  </Row>
);

/* ===== HEX TILES (kept — they're abstract UI atoms) =================== */

const HexTile = ({ size = 60, color = 'var(--bronze)', stroke = 'var(--ash)', icon, label, locked, glow }) => {
  const r = size / 2;
  const cx = r, cy = (size * Math.sqrt(3)/2)/2;
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI/6 + i * Math.PI / 3;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const W = size + 2, H = size * Math.sqrt(3)/2 + 2;
  return (
    <div style={{ width: W, height: H, position: 'relative', filter: glow ? `drop-shadow(0 0 8px ${glow})` : 'none' }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polygon points={pts.map(([x,y]) => `${x+1},${y+1}`).join(' ')} fill={color} stroke={stroke} strokeWidth={1.2} />
        {locked && (
          <polygon points={pts.map(([x,y]) => `${x+1},${y+1}`).join(' ')} fill="none" stroke="var(--blood)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>
      {icon && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stroke }}>
          {icon}
        </div>
      )}
      {label && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -14, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--pewter)' }}>{label}</div>
      )}
    </div>
  );
};

const HexBlock = () => (
  <Row label="08 · ГЕКС-МОДУЛЬ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Базовый кирпич конструктора. Pointy-top гекс, hairline 1.2 px. Цвет заливки кодирует роль; иконка внутри — тип. Locked — пунктир кровь.
    </p>
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 28, padding: 32, background: 'var(--night)', border: '1px solid var(--bronze)', alignItems: 'flex-start' }}>
      <HexTile color="var(--blood-dim)"  stroke="var(--blood-bright)" icon={<SchemaIcons.reactor />} label="ядро" />
      <HexTile color="var(--amber-dim)"  stroke="var(--amber)"        icon={<SchemaIcons.engine />}  label="двигатель" />
      <HexTile color="var(--cobalt-dim)" stroke="var(--cobalt)"       icon={<SchemaIcons.drill />}   label="бур" />
      <HexTile color="var(--cobalt-dim)" stroke="var(--cobalt)"       icon={<SchemaIcons.battery />} label="батарея" />
      <HexTile color="var(--toxic-dim)"  stroke="var(--toxic)"        icon={<SchemaIcons.casing />}  label="кожух" />
      <HexTile color="var(--bronze)"     stroke="var(--ash)"          icon={<SchemaIcons.cargo />}   label="груз" />
      <HexTile color="var(--bronze)"     stroke="var(--ash)"          icon={<SchemaIcons.sensor />}  label="сенсор" />
      <HexTile color="var(--gold-dim)"   stroke="var(--gold)"         icon={<SchemaIcons.scroll />}  label="реликвия" />
      <HexTile color="var(--bronze)"     stroke="var(--ash)"          locked />
    </div>
  </Row>
);

/* ===== EMPTY / ERROR STATES ============================================ */

const StateCard = ({ title, body, action, kind }) => {
  const c = kind === 'blood' ? 'var(--blood-bright)' : kind === 'gold' ? 'var(--gold)' : 'var(--pewter)';
  return (
    <div style={{ padding: 28, background: 'var(--night)', border: '1px solid var(--bronze)', position: 'relative', height: '100%' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, fontFamily: 'var(--font-mono)', fontSize: 28, color: c, opacity: 0.5 }}>—</div>
      <div className="mono" style={{ color: c, marginBottom: 12 }}>// {title}</div>
      <div style={{ fontSize: 13, color: 'var(--bone)', lineHeight: 1.6, maxWidth: 320 }}>{body}</div>
      <div style={{ marginTop: 16 }}>{action}</div>
    </div>
  );
};

const StatesBlock = () => (
  <Row label="09 · ПУСТО · ОШИБКА">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Пустое состояние — это <b>не дефект, а голос ИИ</b>: «здесь ничего нет, ещё». Ошибка — конкретная техническая правда, без «упс», без эмодзи, без виноватой улыбки.
    </p>
    <div className="grid-3" style={{ marginTop: 28 }}>
      <StateCard kind="ghost" title="ЖУРНАЛ ПУСТ"
        body="За последние циклы юнит не передал ни одного события. Сканер активен, связь стабильна. Просто тихо."
        action={<Button variant="data" size="sm">Запросить пинг</Button>} />
      <StateCard kind="gold" title="АРХИВ НЕ ОТКРЫТ"
        body="Реликвия требует ключа. Принесите в город своей конфессии для расшифровки. Тёплый ход в течение цикла 5."
        action={<Button variant="primary" size="sm">К городу</Button>} />
      <StateCard kind="blood" title="СВЯЗЬ ПОТЕРЯНА"
        body="Юнит вне зоны принтера 18 сек. Авто-возврат провален. Корпус будет утрачен через 12 сек."
        action={<Button variant="danger" size="sm">Принять потерю</Button>} />
    </div>
  </Row>
);

/* ===== PANEL DEMO ====================================================== */

const PanelsBlock = () => (
  <Row label="10 · ПАНЕЛИ">
    <p style={{ marginTop: 0, color: 'var(--bone)', maxWidth: 720, fontSize: 15, lineHeight: 1.6 }}>
      Базовая панель — голова с моно-meta и тело. Уголки — золото (важное), кобальт (data) или скверна (опасное). Тело никогда не пустое: моно-метки слева, значения справа.
    </p>
    <div className="grid-2" style={{ marginTop: 28 }}>
      <div className="panel">
        <div className="corners"><i className="tl" /><i className="tr" /><b className="bl" /><b className="br" /></div>
        <div className="panel-head">
          <span className="mono-sm" style={{ color: 'var(--gold)' }}>// МОДУЛЬ · ДВИГАТЕЛЬ L</span>
          <span className="mono-sm">V.3 · 1×HEX</span>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 16 }}>
          <HexTile size={56} color="var(--amber-dim)" stroke="var(--amber)" icon={<SchemaIcons.engine />} />
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--chalk)', fontSize: 14, marginBottom: 4 }}>Большой двигатель</div>
            <div style={{ fontSize: 12, color: 'var(--bone)', lineHeight: 1.55 }}>Несёт тяжёлый корпус R=3. Шумит басом — может привлечь дикий выводок.</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <Stat k="THRUST" v="6.5" />
              <Stat k="DRAIN" v="0.4/s" />
              <Stat k="NOISE" v="HIGH" color="var(--blood-bright)" />
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="corners"><i className="tl" style={{ borderColor: 'var(--cobalt)' }} /><i className="tr" style={{ borderColor: 'var(--cobalt)' }} /><b className="bl" style={{ borderColor: 'var(--cobalt)' }} /><b className="br" style={{ borderColor: 'var(--cobalt)' }} /></div>
        <div className="panel-head">
          <span className="mono-sm" style={{ color: 'var(--cobalt)' }}>// ДИАГНОСТИКА КОРПУСА</span>
          <span className="mono-sm">REAL-TIME</span>
        </div>
        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Bar label="HP / КОРПУС"     value={62} max={100} kind="hp" />
          <Bar label="ENERGY"          value={42} max={100} kind="energy" />
          <Bar label="SKVERNA · фон"   value={78} max={100} kind="skverna" />
          <Bar label="LINK"            value={94} max={100} kind="data" size="thin" />
        </div>
      </div>
    </div>
  </Row>
);

const Stat = ({ k, v, color }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <span className="mono-sm" style={{ color: 'var(--pewter)' }}>{k}</span>
    <span className="mono-sm" style={{ color: color || 'var(--bone)' }}>{v}</span>
  </div>
);

const ComponentsSection = () => (
  <Section
    ord="04 · COMPONENTS"
    id="components"
    title="Компоненты"
    lede="UI-кирпичи системы. Минимальный набор, жёстко регламентированный. Если кажется, что нужен новый компонент — сначала проверьте, точно ли его нельзя собрать из этих.">
    <style>{componentStyles}</style>
    <ButtonsBlock />
    <BarsBlock />
    <TagsBlock />
    <FormsBlock />
    <KPIBlock />
    <LogBlock />
    <NotificationsBlock />
    <HexBlock />
    <StatesBlock />
    <PanelsBlock />
  </Section>
);

Object.assign(window, { ComponentsSection, Button, Bar, Tag, HexTile });
