# spec_i18n.md — Локализация (i18n)

> Архитектура локализации. Сейчас ОДИН язык (`ru`), переключения нет — это задел на будущее.
> Ядро — `i18n.js`; словарь — `lang_ru.js`. Ссылка из `CLAUDE.md`.

## 1. Принцип и оптимизация

Игра — Canvas2D, текст рисуется КАЖДЫЙ кадр. Поэтому i18n спроектирован под нулевой рантайм-оверхед:

- Язык фиксируется на ЗАГРУЗКЕ. Активный словарь — глобал **`STR`** (вложенные неймспейсы).
- **Горячий путь (текст в кадре) читает строку ПРЯМО:** `STR.menu.title1` — обычный доступ к свойству,
  БЕЗ парсинга ключа и без вызова функции (быстрее любого `t('menu.title')` со `split('.')`).
- **Параметризованные строки — ФУНКЦИИ в словаре:** `STR.menu.stats(best, runs, mt)` → строка.
  Интерполяция без шаблон-движка в рантайме; ветвление (по `reason`, фазе и т.п.) ОСТАЁТСЯ В КОДЕ,
  словарь хранит только тексты/форматтеры.
- **Динамические ключи** (ключ вычислен в рантайме) — таблицы с доступом по ключу: `STR.enemy.name[type]`,
  `STR.gameover.title[k]`. Либо `tr('a.b.c', …args)` — резолвит dot-путь, вызывает значение-функцию;
  ключ не найден → возвращает САМ ключ (видно недостающий перевод, рендер не падает). `tr` — НЕ для
  горячего пути (там `STR.x.y`).

## 2. API (`i18n.js`)

| Символ | Что |
|---|---|
| `STR` | АКТИВНЫЙ словарь (глобал). Render-код: `STR.<ns>.<key>` / `STR.<ns>.<key>(args)`. |
| `i18nRegister(lang, dict)` | Регистрация/дополнение словаря языка (можно по частям из нескольких `lang_*.js`); активный язык сразу попадает в `STR`. Слияние — рекурсия только по обычным объектам; строки/функции/массивы — листы. |
| `i18nUse(lang)` | Сменить активный язык (для будущего переключателя; сейчас не вызывается — `ru` ставится регистрацией). |
| `i18nLang()` | Текущий код языка. |
| `tr(key, …args)` | Резолв dot-ключа по `STR` для ДИНАМИЧЕСКИХ ключей/фолбэка; функция → вызывается с args. |

**Загрузка:** `i18n` + `lang_ru` идут В НАЧАЛЕ загрузчика (`index.html`, сразу после `constants`) — `STR`
заполнен ДО первого кадра. Новый язык = новый `lang_<code>.js` (`i18nRegister('en', {...})`) + при появлении
переключателя `i18nUse('en')`. ⚠️ Декоративная чрома (серийники `TWILIGHT-WORLD`/`SEED`/`SKVERNA`, hex-коды,
ASCII-рамки `──────`, глифы `✔/⚠/«»`, латиница `WASD/ENTER/HP`) — НЕ локализуется; текст хранится без неё.

## 3. Состояние — ✅ ЛОКАЛИЗАЦИЯ ЗАВЕРШЕНА

Весь пользовательский UI вынесен в словарь `STR` (один язык `ru`). Хардкодом остаётся ТОЛЬКО
декоративная чрома (раздел 2), комментарии, dev/debug-строки (под `game.debug`, `console.*`),
имена собственные `CITY_NAMES` и неиспользуемый задел `STR.common` (единицы инлайнены в fmt).

**Словарь — пер-доменные файлы** (сливаются через `i18nDeepMerge`, грузятся ДО потребителей):

| Файл | Неймспейсы |
|---|---|
| `lang_ru.js` | `menu` (+`buttons`), `gameover` (+`rows`), `hud` (+`strata`, `cityUpgradeHint`) — эталон |
| `lang_ru_constants.js` | `enemy`/`resource`/`structure`/`module`/`hull`/`tech`/`goal`/`hint`/`input` (DATA из constants.js; грузится ПЕРЕД `constants`) |
| `lang_ru_widgets.js` | `hud.city`/`firewall`/`predict`/`alert`/`contam`/`toggle` |
| `lang_ru_scanaux.js` | `hud.scan` (радар/эхо/кулдауны) |
| `lang_ru_inventory.js` / `lang_ru_invdata.js` | `inventory.*` (экран сборки: хром + DATA-метки) |
| `lang_ru_upgrades.js` / `lang_ru_upgdata.js` | `upgrades.*` (хром render_upgrades + треки/гаджеты/enum-массивы) |
| `lang_ru_meta.js` / `lang_ru_metadom.js` | `meta.sector`/`meta.node` (68 узлов) + `meta.ui` (DOM-экран) |
| `lang_ru_codex.js` | `codex.ui`/`cat`/`entry`/`disc` (DOM + нарратив) |
| `lang_ru_fx.js` / `lang_ru_worldmisc.js` | `intro`/`fx`/`world` (рендер-эффекты) |
| `lang_ru_log.js` | `log.*` (события logEvent/_scanMsg/hints из 8 файлов; параметризованные — функции) |

⚠️ **Реордер загрузчика:** `constants.js` грузится ПОСЛЕ `i18n`+`lang_ru_constants` (а не первым) —
его DATA-таблицы читают `STR` на момент загрузки. Порядок головы: `i18n → lang_ru_constants →
constants → lang_ru → [прочие lang_ru_*] → save → …` (см. `index.html`).

## 4. Неймспейс-дерево `STR` (карта на будущее)

Домены — по системам (как «один тип сущности — один файл»). ~580 строк всего; ★ — параметризованные/
ключ-таблицы. `menu`/`gameover` — РЕАЛИЗОВАНЫ, прочее — план.

```
STR
├── common      shared-атомы: secondsSuffix 'с' · tilesPerSec 'т/с' · mt 'МТ' (=META_ABBR) · maxSuffix
├── menu ✅      ui_menu.js: epochLabel · tagline · title1/title2 · subtitle · directivesHdr · story1/2 ·
│               ★stats(b,r,m) · controls · pauseTag · pauseTitle      [buttons.* — тексты в game.js]
├── gameover ✅  ui_menu.drawGameOver, ★ключ k: tag[k] · title[k] · sub[k] · status[k] · ★recalc(name) · total · ★inBank(n,abbr)
├── upgrades    ~85  upgrades.js (★tracks.<id>.{label,sub,fmt} ×22 + enum-массивы) + render_upgrades (хром)
├── inventory   ~40  inventory/render_inventory (★category.<cat>.{slot,gallery,short} — свести 3 дубля)
├── hud  ✅(hud.js) ~40  hud.js СДЕЛАН (★unit.depthLine ГОРЯЧИЙ); виджеты render_city/firewall/predict/alert/radar/scanners — TODO (★city.phase[8])
├── meta        ~155 meta.js (★node.<id>.{name,sub,desc} ×~45 = DATA) + meta_dom.js (DOM-хром)
├── codex       ~80  codex_dom.js (хром + нарратив entry/disc/cat — DATA)
├── log         ~33  ai/game/hazards/datascan/artifact/borers/hack/print — ★logEvent('...') разбросаны
├── hint/intro/fx/world  ~45  чистый рендер (render_intro/alert/radar/hack/artifact …)
└── constants-домены  ~60  enemy.name[type] · structure.name[id] · module.name[id]/tech[id] · unit.hull[id] ·
                            resource.name[id] · goal.<id> · hint.depth[id]  (один источник, DATA)
```

## 5. Дорожная карта миграции — ✅ ВСЕ ЭТАПЫ ВЫПОЛНЕНЫ

Велась тремя «волнами» (self-contained рендер → хром с форматтерами → DATA-таблицы → DOM →
разбросанный `logEvent`). Финальный аудит полноты прошёл по всей базе и закрыл 27 пропусков
(тексты кнопок меню/паузы/финала, label-строки пересчёта `computeMeta`, имена страт `world.layerName`,
HUD-подсказка у базы).

| Этап | Что | Статус |
|---|---|---|
| 0 | Каркас `i18n.js`+`lang_ru.js` | ✅ |
| ✅ | Меню + пауза + gameover (`ui_menu`→`STR.menu`/`gameover`; gameover-ключ `k`) + `menu.buttons.*` + `gameover.rows.*` | ✅ |
| 1 | Статичные рендер-модули (`render_intro`/`alert`/`radar`/`inventory`/`upgrades`) | ✅ |
| 2 | Параметр-форматтеры хрома (`depthLine`, `city.phase`, `firewall.attackers(n)`, scan-кулдауны) | ✅ |
| 3 | `constants.js` DATA-домены + **реордер загрузчика** (constants после i18n+lang_ru_constants) | ✅ |
| 4 | Inventory категории + DATA-метки | ✅ |
| 5 | `ui_menu` целиком (+ кнопки из game.js) | ✅ |
| 6 | `upgrades.js` DATA-треки (★fmt + enum-массивы) | ✅ |
| 7 | `meta.js` DATA-узлы (68) + `meta_dom` DOM-хром | ✅ |
| 8 | `codex_dom.js` хром + нарратив | ✅ |
| 9 | `log.*`: `logEvent`/`_scanMsg`/`hints` по 8 файлам → `STR.log.*` (форматтеры) | ✅ |
| 10 | Имена страт `world.layerName` → `STR.hud.strata.*` (горячий путь depthLine) | ✅ |

**Добавление нового языка:** новый `lang_<code>.js` (или набор пер-доменных файлов) с
`i18nRegister('<code>', {...})`, при появлении переключателя — `i18nUse('<code>')`. Структура
ключей — 1:1 с `ru` (см. раздел 4 и таблицу файлов в разделе 3).

## 6. Особые случаи

- **Параметризация → функции, НЕ конкатенация.** `'ПРЕФИКС · ' + value` ломает порядок при переводе —
  делать `STR.log.x(value)`. Единицы (`' с'`/`' т/с'`/`' тайл'`) — разделяемые в `common.*`, специфичные — в `fmt`.
- **Динамические ключи** — таблицы: `STR.enemy.name[type]` с фолбэком (`enemy.fallback.unit='ЮНИТ'`).
- **Плюрализация** — заложить в API форматтера (число → форма), даже если RU-форма пока одна
  (`firewall.attackers(n)`, `mast_di_len(n)` «тайла»), иначе будущие языки потребуют переписать call-site.
- **`.toUpperCase()` остаётся в рендере**, словарь хранит исходный регистр (для RU верно; техдолг для языков без upper-case).
- **DOM vs Canvas:** Canvas — заменить литерал на `STR.…`; `meta_dom`/`codex_dom` — строки в `template-literal`
  `innerHTML`, выковыривать аккуратно (split-span'ы, `<br>`, `title`/`aria-label` — отдельно).
- **НЕ локализовать:** декоративная чрома (раздел 2), `CITY_NAMES` (имена собственные), дебаг-маркеры (латиница `A/R/M`),
  глиф-иконка `'Р'`. **НЕ мигрировать мёртвое:** `META_CONTENT` (legacy), `UPG_GADGETS` (если UI мёртв).
- **Терминологический рассинхрон** (свести при локализации): `ai.js` логирует `'РЕЙДЕР'`, а `ENEMY_RU.raider='РАЗВЕДЧИК'`.
