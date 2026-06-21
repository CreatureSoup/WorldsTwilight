/* =========================================================================
   CREATURESOUP — portfolio logic
   - i18n (RU / EN) via data-attributes and html[lang]
   - Project data + render + filters
   - Header scroll state, smooth scroll
   ========================================================================= */

/* ---------- I18N ---------- */
const I18N_KEY = 'cs_lang';
const supportedLangs = ['ru', 'en'];

function getLang() {
  const saved = localStorage.getItem(I18N_KEY);
  if (saved && supportedLangs.includes(saved)) return saved;
  const nav = (navigator.language || 'ru').slice(0, 2).toLowerCase();
  return supportedLangs.includes(nav) ? nav : 'ru';
}

function setLang(lang) {
  if (!supportedLangs.includes(lang)) return;
  document.documentElement.setAttribute('lang', lang);
  localStorage.setItem(I18N_KEY, lang);
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.langBtn === lang);
  });
  // re-render projects with the new language strings
  renderProjects(currentFilter);
}

/* ---------- PROJECT DATA ----------
   Единая точка правды. Чтобы добавить проект, просто скопируйте одну запись.
   tags:
     - направление: "offline" | "digital" | "gamification"
     - featured: true — попадает в топ-секцию
   color: amber | magenta | indigo | teal | gold | crimson | forest
*/
const projects = [
  /* ----- FEATURED ----- */
  {
    id: 'run-and-change',
    title: { ru: 'Run&Change', en: 'Run&Change' },
    client: { ru: 'ОАО «РЖД»', en: 'Russian Railways' },
    role: { ru: 'Директор игры · команда 16 чел.', en: 'Game Director · 16-person team' },
    summary: {
      ru: 'Бизнес-симуляция на Unity для топ-менеджеров: управление эффективностью в период изменений.',
      en: 'Unity business simulation for top-managers: efficiency management during change.'
    },
    result: { ru: '~20 проведений/год · 9,6/10', en: '~20 runs/year · 9.6/10' },
    tags: ['digital'],
    color: 'amber',
    featured: true,
    size: 'featured',
    href: 'case-run-and-change.html',
    cover: 'images/Run&Change/Cover.webp'
  },
  {
    id: 'avito-digital-lesson',
    title: { ru: 'Урок Цифры × Авито', en: 'Digital Lesson × Avito' },
    client: { ru: 'Авито · Урок Цифры', en: 'Avito · Digital Lesson' },
    role: { ru: 'Геймдизайнер, арт-лид', en: 'Game designer, art-lead' },
    summary: {
      ru: 'Веб-тренажёр по рекомендательным алгоритмам: 5 мини-игр × 3 возрастные группы = 15 геймплеев.',
      en: 'Web trainer on recommender systems: 5 mini-games × 3 age groups = 15 gameplays.'
    },
    result: { ru: 'Охват — миллионы школьников', en: 'Reach: millions of students' },
    tags: ['digital'],
    color: 'magenta',
    featured: true,
    size: 'featured',
    href: 'case-avito.html',
    cover: 'images/Урок Цифры/cover.webp'
  },
  {
    id: 'teplocentral',
    title: { ru: 'Теплоцентраль', en: 'Teplocentral' },
    client: { ru: 'Т Плюс', en: 'T Plus' },
    role: { ru: 'Геймдизайн, визуальный дизайн', en: 'Game & visual design' },
    summary: {
      ru: 'Командная игра (онлайн + офлайн) по инженерной инфраструктуре. Эволюция продукта с 2016.',
      en: 'Team game (online + offline) on engineering infrastructure. Product evolved since 2016.'
    },
    result: { ru: '1 место · 473 участника · 13 регионов', en: '1st place · 473 players · 13 regions' },
    tags: ['digital', 'offline'],
    color: 'teal',
    featured: true,
    size: 'wide',
    href: 'case-teplocentral.html',
    cover: 'images/Теплоцентраль/cover.webp'
  },
  {
    id: 'endowment',
    title: { ru: 'Endowment', en: 'Endowment' },
    client: { ru: 'Фонд целевого капитала МФТИ', en: 'MIPT Endowment Fund' },
    role: { ru: 'Полный цикл — геймдизайн и визуал', en: 'Full cycle — game & visual design' },
    summary: {
      ru: 'Настольная стратегия 2–6 игроков об управлении эндаумент-фондом, инвестициях и кризисах.',
      en: 'Board strategy 2–6 players about endowment management, investments, and shocks.'
    },
    result: { ru: 'Грант Потанина · Endowment Game Tour', en: 'Potanin Grant · Endowment Game Tour' },
    tags: ['offline'],
    color: 'gold',
    featured: true,
    size: 'featured',
    href: 'case-endowment.html',
    cover: 'images/МФТИ Endowment/cover.webp'
  },

  /* ----- STRONG NAMED CLIENTS WITH METRICS ----- */
  {
    id: 'dnk-lidera',
    title: { ru: 'ДНК Лидера', en: 'Leader DNA' },
    client: { ru: 'ANCOR', en: 'ANCOR' },
    role: { ru: 'Концепт-дизайнер, генеративная графика', en: 'Concept designer, generative graphics' },
    summary: {
      ru: 'Геймифицированный веб-портал корпоративной программы развития лидерства. 6+ месяцев.',
      en: 'Gamified web portal for a 6-month corporate leadership program.'
    },
    result: { ru: '300 участников · 80% доходимость · в 2026 заказчик вернулся за упаковкой 2-го года', en: '300 players · 80% completion · in 2026 the client came back for year-2 packaging' },
    tags: ['gamification'],
    color: 'indigo',
    size: 'wide',
    href: 'case-ancor.html',
    cover: 'images/ДНК Лидера/cover.webp'
  },
  {
    id: 'project-confession',
    title: { ru: 'Проектная Исповедь', en: 'Project Confession' },
    client: { ru: 'Ростелеком', en: 'Rostelecom' },
    role: { ru: 'Визуальный концепт, видео интро/аутро', en: 'Visual concept, intro/outro video' },
    summary: {
      ru: 'Лендинг и портал онлайн-конференции IT-сообщества. Концепция по мотивам Severance.',
      en: 'Landing + portal for an internal IT conference. Severance-inspired visual concept.'
    },
    result: { ru: '~2000 участников', en: '~2,000 participants' },
    tags: ['digital'],
    color: 'crimson',
    size: 'featured',
    href: 'case-project-confession.html',
    cover: 'images/Проектная Исповедь/cover.webp'
  },

  /* ----- NAMED CLIENTS, NO STRONG NUMBER ----- */
  {
    id: 'forty-islands',
    title: { ru: 'Сорок островов', en: 'Forty Islands' },
    client: { ru: 'НЛМК', en: 'NLMK' },
    role: { ru: 'Геймдизайн настолки, визуал', en: 'Board game design, visuals' },
    summary: {
      ru: 'Настолка для кросс-функциональных команд: соперничество ↔ общий результат.',
      en: 'Board game for cross-functional teams: rivalry ↔ shared outcome.'
    },
    result: { ru: 'Серия из 4 проектов для НЛМК', en: 'Series of 4 projects for NLMK' },
    tags: ['offline'],
    color: 'forest',
    size: 'featured',
    href: 'case-forty-islands.html',
    cover: 'images/Сорок островов/cover.webp'
  },
  {
    id: 'city-of-systems',
    title: { ru: 'Город систем', en: 'City of Systems' },
    client: { ru: 'НЛМК', en: 'NLMK' },
    role: { ru: 'Геймдизайн системной симуляции', en: 'Systems simulation design' },
    summary: {
      ru: 'Очная игра 7 ч — 1-я ступень программы системного мышления. Архитектура: производство → сеть → город.',
      en: '7-hour offline game — the first step of a systems-thinking program. Architecture: production → network → city.'
    },
    result: { ru: '3-й проект для НЛМК · 1-я ступень модуля программы', en: '3rd project for NLMK · first step of the module' },
    tags: ['offline'],
    color: 'teal',
    size: 'default',
    href: 'case-city-of-systems.html',
    cover: 'images/Город систем/cover.webp'
  },
  {
    id: 'apocalypse-now',
    title: { ru: 'Апокалипсис сегодня', en: 'Apocalypse Now' },
    client: { ru: 'Ростелеком', en: 'Rostelecom' },
    role: { ru: 'Геймдизайн живой игры', en: 'Live game design' },
    summary: {
      ru: 'Живая игра: управление ресурсами бункера в постапокалипсисе.',
      en: 'Live game: managing bunker resources in a post-apocalyptic setting.'
    },
    result: { ru: '100+ участников · 2 поколения дизайна', en: '100+ players · 2 design generations' },
    tags: ['offline'],
    color: 'crimson',
    size: 'wide',
    href: 'case-apocalypse-now.html',
    cover: 'images/Апокалипсис сегодня/cover.webp'
  },
  {
    id: 'fighting-disaster',
    title: { ru: 'Борьба со стихией', en: 'Fighting the Element' },
    client: { ru: 'РАНХиГС', en: 'RANEPA' },
    role: { ru: 'Геймдизайн кооп-настолки', en: 'Co-op board game design' },
    summary: {
      ru: 'Кооп-настолка для госслужащих: координация тушения пожаров на карте региона.',
      en: 'Co-op board game for civil servants: coordinating regional firefighting.'
    },
    result: { ru: '4 уровня программ — от бакалавриата до Pre-MBA', en: '4 program levels — from BSc to Pre-MBA' },
    tags: ['offline'],
    color: 'forest',
    size: 'default',
    href: 'case-fighting-disaster.html',
    cover: 'images/Борьба со стихией/cover.webp'
  },
  {
    id: 'last-order',
    title: { ru: 'Последний приказ', en: 'The Last Order' },
    client: { ru: 'РАНХиГС', en: 'RANEPA' },
    role: { ru: 'Полный цикл — геймдизайн, нарратив, графика', en: 'Full cycle — game design, narrative, graphics' },
    summary: {
      ru: 'Настолка для госслужащих на тренировку результативности. Сеттинг — Гражданская война, игроки — адъютанты с маршрутами и поручениями.',
      en: 'A board game for civil servants training the "deliver-vs-report" muscle. Setting — the Russian Civil War; players — adjutants with routes and missions.'
    },
    result: { ru: 'Часть серии для РАНХиГС', en: 'Part of a RANEPA series' },
    tags: ['offline'],
    color: 'crimson',
    size: 'default',
    href: 'case-last-order.html',
    cover: 'images/Последний приказ/cover.webp'
  },
  {
    id: 'space-business',
    title: { ru: 'Космический бизнес', en: 'Space Business' },
    client: { ru: 'РосБанк', en: 'Rosbank' },
    role: { ru: 'Геймдизайн живой игры на 3 потока', en: 'Live game design · 3 parallel streams' },
    summary: {
      ru: 'Живая игра, 3 параллельных потока команд — выявление скрытых проблем в процессах.',
      en: 'Live game, 3 parallel team streams — surfacing hidden process issues.'
    },
    result: { ru: '60+ участников · 10 команд', en: '60+ players · 10 teams' },
    tags: ['offline'],
    color: 'indigo',
    size: 'default',
    href: 'case-space-business.html',
    cover: 'images/Космический бизнес/cover.webp'
  },
  {
    id: 'knights-medieval',
    title: { ru: 'Рыцари Средневековья', en: 'Medieval Knights' },
    client: { ru: 'НЛМК', en: 'NLMK' },
    role: { ru: 'Геймдизайн командной настолки', en: 'Team board game design' },
    summary: {
      ru: 'Командная настолка: ресурсы, королевства, прокачка персонажей, ценности компании.',
      en: 'Team board game: resources, kingdoms, character progression, company values.'
    },
    result: { ru: 'Повторный заказ · «коробка» регулярного обучения', en: 'Repeat order · recurring-training "box"' },
    tags: ['offline'],
    color: 'crimson',
    size: 'default',
    href: 'case-knights-medieval.html',
    cover: 'images/Рыцари Средневековья/cover.webp'
  },
  {
    id: 'cruiser-federation',
    title: { ru: 'Крейсер «Федерация»', en: 'Cruiser Federation' },
    client: { ru: 'НЛМК', en: 'NLMK' },
    role: { ru: 'Геймдизайн живой игры', en: 'Live game design' },
    summary: {
      ru: 'Живая игра: решения по безопасности в условиях дефицита ресурсов и давления.',
      en: 'Live game: safety decisions under resource scarcity and pressure.'
    },
    result: { ru: 'Регулярное обучение · серия заказов', en: 'Recurring training · series of orders' },
    tags: ['offline'],
    color: 'magenta',
    size: 'default',
    href: 'case-cruiser-federation.html',
    cover: 'images/Крейсер Федерация/cover.webp'
  },
  {
    id: 'allies',
    title: { ru: 'Союзники', en: 'Allies' },
    client: { ru: 'РосБанк', en: 'Rosbank' },
    role: { ru: 'Геймдизайн онлайн-игры в Miro', en: 'Miro online game design' },
    summary: {
      ru: 'Онлайн-игра в Miro: от соперничества подразделений к совместному преодолению кризиса.',
      en: 'Miro online game: from departmental rivalry to collaborative crisis response.'
    },
    result: { ru: '100+ участников', en: '100+ players' },
    tags: ['digital'],
    color: 'amber',
    size: 'default',
    href: 'case-allies.html',
    cover: 'images/Союзники/cover.webp'
  },
  {
    id: 'future-supply-chain',
    title: { ru: 'Future Supply Chain', en: 'Future Supply Chain' },
    client: { ru: 'Danone · X5 Group', en: 'Danone · X5 Group' },
    role: { ru: 'Графика и визуальный дизайн', en: 'Graphics and visual design' },
    summary: {
      ru: 'Командная бизнес-симуляция цепочки поставок в космической метафоре: производители, логисты, ретейлеры между Землёй и колониями.',
      en: 'Team supply-chain business simulation in a space metaphor: producers, logists, and retailers between Earth and the colonies.'
    },
    result: { ru: '', en: '' },
    tags: ['offline'],
    color: 'teal',
    size: 'default',
    href: 'case-future-supply-chain.html',
    cover: 'images/Future Supply Chain/cover.webp'
  },
  {
    id: 'guardians',
    title: { ru: 'Хранители', en: 'Guardians' },
    client: { ru: 'Финансовый холдинг · NDA', en: 'Financial holding · NDA' },
    role: { ru: 'Директор игры, механики, генеративная графика', en: 'Game Director, mechanics, generative graphics' },
    summary: {
      ru: 'Командная настольная игра-знакомство с банкингом и страхованием через три эпохи: античность, настоящее, будущее. Подростковая аудитория.',
      en: 'A team board game introducing banking and insurance through three eras: Antiquity, Present, Future. Teen audience.'
    },
    result: { ru: 'В ежегодной программе клиента · 49 участников', en: "In client's annual program · 49 players" },
    tags: ['offline'],
    color: 'indigo',
    size: 'default',
    href: 'case-guardians.html',
    cover: 'images/Хранители/cover.webp'
  },
  {
    id: 'onboarding-platform',
    title: { ru: 'Платформа онбординга', en: 'Onboarding Platform' },
    client: { ru: 'RDP', en: 'RDP' },
    role: { ru: 'Геймдизайн, графика', en: 'Game design, graphics' },
    summary: {
      ru: 'Метафора города-компании, диалоговый квест, 20+ сценариев, глубинные интервью ЦА.',
      en: 'Company-as-city metaphor, dialogue quest, 20+ scenarios, user interviews.'
    },
    result: { ru: 'Автоматизация онбординга · ×2 рост компании', en: 'Onboarding automation · ×2 company growth' },
    tags: ['gamification', 'digital'],
    color: 'forest',
    size: 'default',
    href: 'case-onboarding-platform.html',
    cover: 'images/RDP/cover.webp'
  },

  /* ----- NDA / UNNAMED CLIENTS ----- */
  {
    id: 'mobile-minigames',
    title: { ru: '«Начальник Гавани»', en: '"Harbormaster"' },
    client: { ru: 'Крупная инвесткомпания · NDA', en: 'Major investment firm · NDA' },
    role: { ru: 'Геймдизайн, генеративная графика, иллюстрации', en: 'Game design, generative graphics, illustrations' },
    summary: {
      ru: 'Серия мобильных мини-игр для инвестприложения. Альтернатива «крути колесо» — управление мариной через цепочку дилемм.',
      en: 'A series of mobile mini-games for an investment app. An alternative to "spin the wheel" — running a marina through a chain of dilemmas.'
    },
    result: { ru: 'Первая игра в релизе · 5 гаваней', en: 'First title released · 5 harbors' },
    tags: ['digital', 'gamification'],
    color: 'gold',
    size: 'wide',
    href: 'case-mobile-minigames.html',
    cover: 'images/Начальник Гавани/cover.webp'
  },
  {
    id: 'network-telecom',
    title: { ru: '«Сеть»', en: '"Network"' },
    client: { ru: 'Крупная телеком-компания · NDA', en: 'Major telecom · NDA' },
    role: { ru: 'Геймдизайнер, разработчик онлайн-формата', en: 'Game designer, online-format developer' },
    summary: {
      ru: 'Стратегическая бизнес-симуляция: 7 ролей, распространение экосистемы, онлайн + офлайн.',
      en: 'Strategic business sim: 7 roles, ecosystem rollout, online + offline formats.'
    },
    result: { ru: 'Дополнительный заказ от клиента', en: 'Follow-up order from the client' },
    tags: ['digital', 'offline'],
    color: 'indigo',
    size: 'default',
    href: 'case-network-telecom.html',
    cover: 'images/Сеть/cover.webp'
  },
  {
    id: 'off-grid',
    title: { ru: '«Вне Сети»', en: '"Off the Grid"' },
    client: { ru: 'Крупная телеком-компания · NDA', en: 'Major telecom · NDA' },
    role: { ru: 'Директор игры, геймдизайн', en: 'Game Director, game design' },
    summary: {
      ru: 'Командная детектив-игра в карточном формате — продолжение мира «Сети». Лайт-формат для пост-стратсессионного использования с зашитым элементом личной ответственности.',
      en: 'A team detective card game — a continuation of the "Network" universe. A light post-strategy-session format with personal responsibility baked into the turn structure.'
    },
    result: { ru: 'Вторая игра серии для одного заказчика', en: 'Second game in a series for the same client' },
    tags: ['digital', 'offline'],
    color: 'magenta',
    size: 'default',
    href: 'case-off-grid.html',
    cover: 'images/Вне Сети/cover.webp'
  },
  {
    id: 'city-sim',
    title: { ru: 'Симулятор управления городом', en: 'City Management Simulator' },
    client: { ru: 'Госуниверситет · NDA', en: 'Leading university · NDA' },
    role: { ru: 'Директор игры, ведущий геймдизайнер', en: 'Game Director, lead designer' },
    summary: {
      ru: 'Цифровой симулятор для мэров: матмодель, кейсовая система, дашборд, гибрид онлайн+офлайн.',
      en: 'Digital simulator for mayors: math model, branching cases, dashboard, hybrid format.'
    },
    result: { ru: '', en: '' },
    tags: ['digital'],
    color: 'magenta',
    size: 'default',
    href: 'case-city-sim.html',
    cover: 'images/Симулятор управления городом/cover.webp'
  },
  {
    id: 'netone-lean',
    title: { ru: 'NetOne — Lean Management', en: 'NetOne — Lean Management' },
    client: { ru: 'Международная FMCG · NDA', en: 'International FMCG · NDA' },
    role: { ru: 'Директор игры, геймдизайнер', en: 'Game Director, designer' },
    summary: {
      ru: 'Кооп-онлайн-игра в Miro (15 чел., ~3 ч): производство контента стримингового сервиса, Lean-методология.',
      en: 'Co-op Miro online game (15 players, ~3h): streaming-service content production, Lean methodology.'
    },
    result: { ru: '', en: '' },
    tags: ['digital'],
    color: 'amber',
    size: 'default',
    href: 'case-netone-lean.html',
    cover: 'images/NetOne/cover.webp'
  },
  {
    id: 'seekers',
    title: { ru: 'Искатели', en: 'Seekers' },
    client: { ru: 'NDA', en: 'NDA' },
    role: { ru: 'Геймдизайн, визуал', en: 'Game design, visuals' },
    summary: {
      ru: 'Короткая онлайн-игра про работу команды в условиях изменений: правила переписываются каждый раунд.',
      en: 'A short online game about team work under change: rules rewrite every round.'
    },
    result: { ru: '', en: '' },
    tags: ['digital'],
    color: 'gold',
    size: 'default',
    href: 'case-seekers.html',
    cover: 'images/Искатели/cover.webp'
  },
  {
    id: 'corporate-legends',
    title: { ru: 'Корпоративные Легенды', en: 'Corporate Legends' },
    client: { ru: 'NDA', en: 'NDA' },
    role: { ru: 'Графика, геймдизайн', en: 'Graphics, game design' },
    summary: {
      ru: 'Бизнес-игра для тренинга методологии Stage Gate в сеттинге офисного фэнтези. От настолки до Unity-приложения, далее — к автономной многопользовательской версии.',
      en: 'A business game training the Stage Gate methodology in an office-fantasy setting. From board game to Unity app; next — an autonomous multiplayer version.'
    },
    result: { ru: '2024–2026 · в развитии', en: '2024–2026 · in development' },
    tags: ['offline', 'digital'],
    color: 'forest',
    size: 'featured',
    href: 'case-corporate-legends.html',
    cover: 'images/Корпоративные Легенды/cover.webp'
  }
];

/* ---------- RENDER ---------- */
const filterLabels = {
  all: { ru: 'Все', en: 'All' },
  offline: { ru: 'Офлайн-игры', en: 'Offline games' },
  digital: { ru: 'Цифровые продукты', en: 'Digital products' },
  gamification: { ru: 'Геймификация', en: 'Gamification' },
  featured: { ru: '★ Топ-кейсы', en: '★ Featured' }
};

let currentFilter = 'all';

function renderFilters() {
  const root = document.getElementById('filters');
  if (!root) return;
  const counts = {
    all: projects.length,
    offline: projects.filter((p) => p.tags.includes('offline')).length,
    digital: projects.filter((p) => p.tags.includes('digital')).length,
    gamification: projects.filter((p) => p.tags.includes('gamification')).length,
    featured: projects.filter((p) => p.featured).length
  };
  const lang = document.documentElement.lang;
  root.innerHTML = Object.keys(filterLabels).map((key) => `
    <button class="filter${key === currentFilter ? ' is-active' : ''}" data-filter="${key}">
      ${filterLabels[key][lang] || filterLabels[key].ru}
      <span class="filter__count">${counts[key]}</span>
    </button>
  `).join('');
  root.querySelectorAll('.filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      renderFilters();
      renderProjects(currentFilter);
    });
  });
}

function renderProjects(filter = 'all') {
  const root = document.getElementById('projects-grid');
  if (!root) return;
  const lang = document.documentElement.lang;
  const filtered = projects.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'featured') return p.featured;
    return p.tags.includes(filter);
  });

  root.innerHTML = filtered.map((p) => {
    const sizeCls = (p.size === 'featured' ? ' project--featured' : p.size === 'wide' ? ' project--wide' : p.size === 'small' ? ' project--small' : '') + (p.featured ? ' project--has-badge' : '');
    const hrefAttr = p.href && p.href !== '#' ? `href="${p.href}"` : 'href="#" aria-disabled="true"';
    const isCasePage = p.href && p.href !== '#';
    const Tag = isCasePage ? 'a' : 'div';
    // Обложка — для backdrop'а на hover. Локальный путь URL-кодируем сегментно
    // (имена папок с пробелами, кириллицей и & нужно экранировать). Picsum — fallback.
    const coverUrl = p.cover
      ? p.cover.split('/').map(encodeURIComponent).join('/')
      : `https://picsum.photos/seed/cs-${p.id}/1600/1000`;
    return `
      <${Tag} class="project${sizeCls}" data-color="${p.color}" data-cover="${coverUrl}" data-metric="${(p.result[lang] || '').replace(/"/g, '&quot;')}" ${isCasePage ? hrefAttr : ''}>
        <div class="project__cover">
          <div class="cover-gradient"></div>
          <span class="project__typo">${p.title[lang]}</span>
        </div>
        ${p.featured ? `<span class="project__badge">${lang === 'ru' ? 'Топ-кейс' : 'Featured'}</span>` : ''}
        <span class="project__link" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
        </span>
        <div class="project__meta">
          <span class="project__client">${p.client[lang]}</span>
          <span class="project__result">${p.result[lang]}</span>
          <span class="project__tags">
            ${p.tags.map((t) => `<span class="tag">${filterLabels[t] ? filterLabels[t][lang] : t}</span>`).join('')}
          </span>
        </div>
      </${Tag}>
    `;
  }).join('');

  // (Re)wire backdrop interactions после каждого рендера
  wireHoverBackdrop();
}

/* ---------- HOVER BACKDROP ----------
   Отслеживаем что под курсором через document.elementFromPoint.
   - pointermove → пересчёт активной карточки на каждом движении
   - scroll      → пересчёт по последним координатам (карточка могла уехать)
   - focus       → активация по клавиатурной навигации
   Это надёжнее чем mouseenter/mouseleave: ловит уход в gap между карточками
   и корректно переключается при скролле. */
let _hoverWired = false;
let _activeCard = null;
let _ptrX = -1, _ptrY = -1;

function wireHoverBackdrop() {
  const backdrop = document.getElementById('hover-backdrop');
  const grid = document.getElementById('projects-grid');
  if (!backdrop || !grid) return;

  // preload всех обложек, чтобы backdrop появлялся без задержки
  grid.querySelectorAll('.project').forEach((card) => {
    const url = card.dataset.cover;
    if (url) { const i = new Image(); i.src = url; }
  });

  const activate = (card) => {
    if (_activeCard === card) return;
    if (_activeCard) _activeCard.classList.remove('is-focused');
    _activeCard = card;
    card.classList.add('is-focused');
    const url = card.dataset.cover;
    if (url) backdrop.style.backgroundImage = `url("${url}")`;
    backdrop.classList.add('is-active');
    document.body.classList.add('is-card-focused');
  };
  const deactivate = () => {
    if (!_activeCard && !document.body.classList.contains('is-card-focused')) return;
    if (_activeCard) _activeCard.classList.remove('is-focused');
    _activeCard = null;
    backdrop.classList.remove('is-active');
    document.body.classList.remove('is-card-focused');
  };

  // Что под курсором прямо сейчас? Учитываем pointer-events: none у потушенных карточек —
  // elementFromPoint их и так пропускает.
  const evaluatePointer = () => {
    if (_ptrX < 0) return;
    const el = document.elementFromPoint(_ptrX, _ptrY);
    if (!el) { deactivate(); return; }
    const card = el.closest('.project');
    if (card && grid.contains(card)) {
      activate(card);
    } else {
      deactivate();
    }
  };

  if (!_hoverWired) {
    document.addEventListener('pointermove', (e) => {
      _ptrX = e.clientX;
      _ptrY = e.clientY;
      evaluatePointer();
    }, { passive: true });

    // Курсор уехал за окно — гасим
    document.addEventListener('pointerleave', () => {
      _ptrX = _ptrY = -1;
      deactivate();
    });

    // Скролл — пересчитываем по последним координатам, чтобы хвост не висел
    let _scrollRaf = 0;
    window.addEventListener('scroll', () => {
      if (_scrollRaf) return;
      _scrollRaf = requestAnimationFrame(() => {
        _scrollRaf = 0;
        evaluatePointer();
      });
    }, { passive: true });

    // Клавиатурный фокус
    grid.addEventListener('focusin', (e) => {
      const card = e.target.closest('.project');
      if (card) activate(card);
    });
    grid.addEventListener('focusout', (e) => {
      if (!grid.contains(e.relatedTarget)) deactivate();
    });

    // Esc — мгновенно гасим
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _activeCard) deactivate();
    });
    _hoverWired = true;
  }

  // После перерендера — если активная карточка ушла из DOM, гасим
  if (_activeCard && !document.contains(_activeCard)) deactivate();
}

/* ---------- HEADER SCROLL STATE ---------- */
function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- NAV SMOOTH SCROLL ---------- */
function initSmoothNav() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------- IMG[data-src] AUTO-ENCODE + ORIENTATION ----------
   1. Чтобы писать <img data-src="images/Папка с пробелами/файл.webp"> без процентного кодирования.
   2. Чтобы вертикальные картинки в .gallery__item получали .gallery__item--tall (CSS делает их вытянутыми). */
function resolveImageSources() {
  document.querySelectorAll('img[data-src]').forEach((img) => {
    const raw = img.dataset.src;
    if (!raw) return;
    img.src = raw.split('/').map(encodeURIComponent).join('/');
    img.removeAttribute('data-src');
  });
  detectGalleryOrientation();
}

function detectGalleryOrientation() {
  document.querySelectorAll('.gallery__item > img').forEach((img) => {
    const apply = () => {
      if (!img.naturalWidth) return;
      const isPortrait = img.naturalHeight > img.naturalWidth * 1.1;
      if (isPortrait) {
        img.parentElement.classList.add('gallery__item--tall');
      }
    };
    if (img.complete) apply();
    else img.addEventListener('load', apply, { once: true });
  });
}

/* ---------- BOOT ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // init language buttons
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.langBtn));
  });
  setLang(getLang());
  renderFilters();
  initHeaderScroll();
  initSmoothNav();
  resolveImageSources();
});
