'use strict';

// ============================================================
// Twilight of the World (Сумерки мира) — общие константы.
// Стартовые значения из GDD (архив reference/gdd_mvp_v0.3.md; актуальный — gdd_mvp_v0.4.md); тюнятся на плейтестах.
// ============================================================

const TILE = 48;             // внутренний (design) размер тайла в px
const FPS_CAP = 60;          // потолок частоты рендера: на 120/144Гц-дисплеях не жечь GPU вдвое (кадрово-независимо)
const BG_FPS = 24;           // окно ВИДИМО, но НЕ в фокусе — роняем частоту (экономия нагрева), но не так сильно: 24 fps держит движение плавным при разработке/наблюдении; скрытую вкладку вообще ставим на ПАУЗУ
const DPR_CAP = 1.75;        // потолок devicePixelRatio: бэкстор канваса не раздувать на retina (≈ −40% пикселей при dpr=2)
// Зум поля: сколько тайлов видно по вертикали на ЛЮБОМ экране (меньше = крупнее).
// Внутреннее разрешение canvas фиксирует это, CSS растягивает на окно равномерно,
// поэтому на всех устройствах кадр одинаковый.
let VIEW_TILES_Y = 12;

const MAP_W = 144;           // ширина (кратна 4 и 6 — для бесшовного периодического шума)
const MAP_H = 264;           // глубина: над городом ~95 тайлов страт цивилизации (тёплые тона), под — холодные к фиолету
const SURFACE_ROWS = 3;      // тонкая «внешняя» поверхность далеко наверху (небо)

const DIG_BASE = 0.85;       // сек/блок при digMult = 1 (масштабируется слоем×плотностью×tough; апгрейд бура делит)
// После пробития тайла: тем же удержанием юнит въезжает в дыру ТОЛЬКО если держал направление дольше
// этого времени (непрерывный тоннель). Разовое нажатие (отпустил раньше) — юнит стоит, не въезжает.
const DRILL_HOLD_ADVANCE = 0.26;  // сек
// ── ИМПУЛЬСНЫЙ БУР (impulse.js) — заряд Пробелом → звуковая ВОЛНА в сторону взгляда юнита ──
const IMPULSE_CHARGE_T = 3.5;     // сек до ПОЛНОГО заряда (≈ время станд. бурения ~2 тайлов при H≈2 → «чуть эффективнее»)
const IMPULSE_MIN_FIRE = 0.05;    // отпустил → ВСЕГДА бьёт пропорционально заряду (нет «мёртвой зоны»; глушит лишь 1-кадровый блип)
const IMPULSE_LEN = 5;            // базовая ДЛИНА волны (тайлов): ~4 пробивает + 1 «трескается»; +узел `mast_di_len`
const IMPULSE_LEN_NODE = 3;       // +тайлов к длине при владении узлом `mast_di_len`
const IMPULSE_FORCE = 6.5;        // ПИК силы (тайл 1, вплотную) при полном заряде; дальше спад ×IMPULSE_FALLOFF за тайл
const IMPULSE_FALLOFF = 0.65;     // спад силы на тайл: первый макс, дальше угасает → дальний «трескается», не ломается
const IMPULSE_MIN_EFFECT = 1.0;   // мин. сила, ещё дающая эффект (трещина): волна РИСУЕТСЯ только до этой дальности (не «бьёт» в пустоту дальше)
const IMPULSE_DMG = 60;           // урон врагу при пиковой силе (×force_i/IMPULSE_FORCE — ближе к юниту сильнее)
const IMPULSE_CD = 0.5;           // сек кулдаун после выстрела
const IMPULSE_WAVE_DUR = 0.7;     // сек распространения волны (медленнее → тайлы рушатся по очереди ВИДИМО, а не «поофф»)
const IMPULSE_WAVE_TTL = 0.9;     // сек общей жизни визуала волны (0.7 распространение + затухание дрожи)
// ── ОСАДНЫЙ МОДУЛЬ (siege.js, доп-слот `siege`) — сфокусированный пробойный РАЗРЯД по дикому гнезду (контраст волне) ──
const SIEGE_CHARGE_T = 1.6;       // сек до полного заряда удержанием доп-клавиши (тяжелее радара, но реактивнее импульса)
const SIEGE_MIN_FIRE = 0.35;      // мин. заряд для выстрела при отпускании (тап — впустую, чтобы не «плевался»)
const SIEGE_CD = 1.2;             // сек кулдаун после разряда
const SIEGE_RANGE = 6;            // тайлов: длина луча-копья (стрелять надо вблизи гнезда)
const SIEGE_DMG_CITY = 55;        // урон по hp дикого гнезда при ПОЛНОМ заряде (WILD_HP=200 → ~4 прямых разряда на гнездо)
const SIEGE_DMG_ENEMY = 70;       // урон врагу на линии луча при полном заряде
const SIEGE_BEAM_TTL = 0.22;      // сек жизни визуала луча (вспышка-копьё, быстро гаснет)
// ── СТЕЛС-МОДУЛЬ (stealth.js, доп-слот `stealth`) — разовая активация → юнит НЕВИДИМ для боевых врагов ──
const STEALTH_DUR = 6;            // сек невидимости (охотник/снайпер теряют цель, новые не наводятся)
const STEALTH_CD = 14;            // сек кулдаун после активации (заливка иконки в панели действий)
// ── ВЗЛОМ ЮНИТОВ (jam.js, доп-слот `jam`) — импульс-ГЛУШЕНИЕ: по кнопке замедляет всех врагов в радиусе (как глушилка) ──
const JAM_PULSE_R = 5;            // тайлов: радиус импульса глушения вокруг юнита
const JAM_PULSE_DUR = 4;          // сек: насколько затронутые враги остаются замедлены (переиспользует e.slowT → ×JAM_SLOW)
const JAM_PULSE_CD = 10;          // сек кулдаун между импульсами
const JAM_FX_TTL = 0.5;           // сек визуала расходящегося кольца импульса (render_jam.js)
// ── КИНЕТИЧЕСКИЙ БУР (unit.js, ramp в drill-блоке) — разгоняющийся «молот», разгон ПО ВРЕМЕНИ ──
const KIN_BASE_MULT = 0.5;        // стартовая мощность (×0.5 = вдвое медленнее стандартного бура)
const KIN_MAX_MULT = 2.5;         // мощность на ПОЛНОМ разгоне (×2.5 стандартного)
const KIN_MAX_MULT_NODE = 3.0;    // потолок разгона при узле `mast_dk_max` (×3 стандартного)
const KIN_RAMP_TIME = 5.0;        // сек НЕПРЕРЫВНОГО бурения В ОДНУ СТОРОНУ до полного разгона (по ВРЕМЕНИ, не по тайлам)
const KIN_GRACE = 0.8;            // сек без бурения породы до СБРОСА (покрывает паузу между тайлами; дольше — стоп/пустота)
const KIN_POWER_STEP = 0.3;       // +к мощности за уровень трека КИНЕТИКА (город)
const KIN_BURST_CHANCE = 0.10;    // ВЗРЫВНОЙ ПРОБОЙ (узел mast_dk_burst): БАЗОВЫЙ шанс суперзаряда (мгновенная следующая тычка). +трек «РАЗГОН ПРОБОЯ»
const KIN_BURST_STEP = 0.10;      // +шанс за уровень трека (город), cap 2 → макс 0.10 + 0.20 = 0.30
const KIN_BURST_MIN_RAMP = 0.5;   // нужен накопленный разгон ≥ этого (суперзаряд набирается от пробива предыдущего тайла)
// ── ВИНТОВОЙ БУР-ПРОХОДКА (borers.js) — юнит-станция автономных буров-щитов ──
const SCREW_BORERS_BASE = 2;      // автономных буров у юнита по умолчанию (+1 за узел mast_ds_b1, +1 за mast_ds_b2 → макс 4)
const SCREW_DIG_BASE = 0.275;     // базовая скорость проходки щита (dig/с) — медленный/слабый по умолчанию; +город (трек СКОРОСТЬ ПРОХОДКИ, 3 ур.)
const SCREW_SPEED_STEP = 0.4;     // +скорость проходки за уровень трека
const SCREW_RECALL_R = 1.4;       // тайлов: на этом расстоянии Пробел «забирает» бур обратно на юнит
const SCREW_GLIDE = 12;           // плавность скольжения щита к центру тайла (лерп-коэф)
const SCREW_AIR_SPEED = 4;        // тайла/с: ход щита по ОТКРЫТОМУ воздуху (не мгновенно тайл/кадр)
const SCREW_FALL_SPEED = 9;       // тайла/с: гравитация щита в пустоте (падает до опоры, потом продолжает ход)
// АПКИП: автономный заряд щита (время работы). Иссяк → щит ВСТАЁТ (depleted); юнит подходит вплотную → анимация
// подзарядки → щит продолжает. Трек «ВРЕМЯ РАБОТЫ» (borerlife → stats.borerLife) увеличивает заряд без подзарядки.
const SCREW_CHARGE_MAX = 16;      // сек автономной работы щита по умолчанию (стартовое значение под тюнинг)
const SCREW_LIFE_BONUS = 16;      // +сек заряда от узла меты `mast_ds_life` (16→32с) — апгрейд апкипа (ветка бура)
const SCREW_RECHARGE_R = 1.6;     // тайлов: на этой дистанции юнит подзаряжает РАЗРЯЖЕННЫЙ щит (чуть больше recall 1.4)
const SCREW_RECHARGE_TIME = 1.2;  // сек: длительность анимации полной подзарядки
// ── РАДАР-СКАНЕР / ЭХО-СКАНЕР (scanners.js) — варианты слота СКАНЕР, ищут залежи, туман НЕ снимают ──
const RADAR_R = 17;               // тайлов: радиус развёртки радара (покрывает экран); блипы залежей/врагов
const RADAR_SWEEP_PERIOD = 6.8;   // сек на ОДИН оборот развёртки (в 2× медленнее прежнего); НЕ непрерывно — по активации
const RADAR_CD_BASE = 6.0;        // сек кулдаун ПОСЛЕ оборота; трек ОХЛАЖДЕНИЕ РАДАРА уменьшает (negative step)
const RADAR_CD_STEP = 1.1;        // −кулдаун за уровень трека
const RADAR_CD_MIN = 2.5;         // пол кулдауна
const ECHO_R = 4;                 // тайлов: базовый радиус эхо-волны; узел дальности (mast_ech_len) → ×2
const ECHO_WAVE_T = 1.1;          // сек: рост волны до полного радиуса (медленное, плавное расхождение — красивее читается)
const ECHO_CD_BASE = 9.0;         // сек кулдаун эхо (×1.5 от прежних 6.0); трек «ВСПЫШКА ЭХО» уменьшает (negative step)
const ECHO_CD_STEP = 1.1;         // −кулдаун за уровень трека
const ECHO_CD_MIN = 2.5;          // пол кулдауна
const ECHO_MARK_FADE = 5.0;       // сек: метки залежей от эхо держатся и плавно гаснут
const FALL_SPEED = 8;        // тайла/сек
// Масштаб отрисовки юнита В МИРЕ (риг авторился крупным ~2 тайла; ужимаем под тайл-
// сетку, как задавала линейка пол/потолок в редакторе). Стопы якорятся к полу тайла.
// Дефолт-фолбэк для корпусов без калибровки; редактор передаёт свой `def.drawScale`.
const UNIT_DRAW_SCALE = 0.62;
// Эффективный масштаб юнита: калибровка тайл-сетки из редактора (`UNIT_DEFS[hull].drawScale`,
// = TILE/tilePx) ИЛИ дефолт. Все потребители отрисовки (кольцо, FK-корпус, ноги-щупальца,
// прожектор) берут его — так пол/потолок в редакторе реально меняют размер юнита в игре.
function unitDrawScale(unit) {
  const d = (typeof UNIT_DEFS !== 'undefined') && unit && UNIT_DEFS[unit.hull];
  return (d && typeof d.drawScale === 'number' && d.drawScale > 0) ? d.drawScale : UNIT_DRAW_SCALE;
}
// Прыжок: ощущение веса — короткий присед (анттиципация), затем замедленный прыжок.
const JUMP_CROUCH_T = 0.09;  // сек приседа перед прыжком (короткий взмах — отзывчивее)
const JUMP_SPEED_FRAC = 1.4; // доля от скорости хода при прыжке: БЫСТРЕЕ хода → «прыжковый» рывок (и подъём, и симметричное снижение)
const JUMP_BUFFER = 0.15;    // сек: базовый буфер нажатия «вверх» (в воздухе буфер ДЕРЖИТСЯ до приземления — прыжок не теряется)
const DELIVER_INTERVAL = 0.35; // сек между сдачей одной единицы груза на базе (медленнее)

// Старые серверы — источники данных в породе. Откопал → «хлам»; в радиусе SCAN_RADIUS сканер
// качает данные SCAN_TIME сек (прерывается уходом, прогресс сохраняется); по концу — лог-событие.
const SERVER_COUNT = 9;      // серверов в ГЛУБОКОЙ породе (ниже города) за сессию
const SERVER_UP = 5;         // + серверов в ВЕРХНЕЙ страте (погребённая цивилизация над городом — архивы данных, тематично)
const SERVER_MIN_DIST = 12;  // мин. 2D-дистанция (тайлов) между серверами — чтобы не кучковались
const SCAN_RADIUS = 2.5;     // тайла — радиус автосканирования у выкопанного сервера
// ── КОНТЕЙНЕРЫ-ХРАНИЛИЩА (containers.js): погребённые тайники древних; вскрытие требует узла `kart_hackbox` ──
const CONTAINER_COUNT = 14;  // контейнеров в ГЛУБОКОЙ породе за сессию
const CONTAINER_UP = 6;      // + в ВЕРХНЕЙ страте (тематично) → ~20 всего
const CONTAINER_MIN_DIST = 11;   // мин. 2D-дистанция (тайлов) между контейнерами
const CONTAINER_BREACH_TIME = 3.5;   // сек взлома (юнит рядом + узел kart_hackbox) до вскрытия
const CONTAINER_RADIUS = 2.4;    // тайла — радиус, в котором идёт взлом (как автоскан сервера)
// РЕВАРД ПО РЕДКОСТИ (starting-баланс): реже ресурс → его контейнеры РЕЖЕ (weight, как жилы/одиночки в мире) и дают
// МЕНЬШЕ единиц (ценность за единицу выше) — чтобы редким не заваливать. Крист. — редкий тайник на 2-4, железо — на 6-10.
const CONTAINER_LOOT = {
  iron:    { min: 6, max: 10, weight: 5 },   // распространённый → контейнеров больше, ревард крупнее
  organic: { min: 4, max: 8,  weight: 4 },
  crystal: { min: 2, max: 4,  weight: 2 },   // редкий → контейнеров мало, ревард мал (но ценен)
};
const SCAN_TIME = 4.0;       // сек полной выкачки данных
// Артефакты — БОЛЬШИЕ погребённые объекты (ARTIFACT_W×ARTIFACT_H тайлов, порода с маркером `t.artifact`).
// Откопал рядом → модалка выбора: ТЕХНОЛОГИЯ (особое свойство — абилки позже) / ДАННЫЕ городу / ПЕРЕРАБОТКА.
const ARTIFACT_LONG = 2;         // длинная сторона объекта в тайлах; ориентация (2×1 / 1×2) случайна на артефакт
const ARTIFACT_TRIGGER_R = 3;    // тайла: юнит так близко к откопанному артефакту → открыть модалку (не enemy/borer издали)
const ARTIFACT_DATA = 3;         // фрагментов данных кодекса за «отдать городу» (+1 к dataCount забега)
const ARTIFACT_SCRAP = 4;        // дропов ресурса за «переработать»
const ARTIFACT_CHOOSE_ANIM = 1.0; // сек: анимация выбора карты (остальные сворачиваются в центр, выбранная разгорается) до применения — модалка закрывается ТОЛЬКО по её концу
const ARTIFACT_SEED_COUNT = 4;   // артефактов в ГЛУБОКОЙ породе за сессию (шаффл пула без повторов — вариативность набора растёт с пулом)
const ARTIFACT_SEED_UP = 2;      // + артефактов в ВЕРХНЕЙ страте (человеческое техно-реликты; их очаги радиации делают верх опасно-интересным)
const ARTIFACT_MIN_DIST = 40;    // мин. 2D-дистанция между артефактами = 2×RAD_SOURCE_R (=2×20) → очаги радиации НЕ перекрываются (литерал: RAD_SOURCE_R объявлен НИЖЕ, const не хойстится → TDZ)
// СЛОТЫ артефактов: 3 типа (по 1 БАЗОВО — узлы меты `kart_slot_*` дают +1 каждому, см. game._artifactSlotCap). ЗАЛОЧЕНО при установке (DK): слот занят → только Данные/Переработка.
const ARTIFACT_SLOT_CAP = { city: 1, unit: 1, drone: 1 };
const ARTIFACT_REROLL_COST = 3;  // КРИСТАЛЛОВ из трюма за «повторный анализ» реликта (узел kart_reroll); crystal — редчайший ресурс, 3 = ощутимая, но достижимая цена. Стартовое значение.
// ПУЛ артефактов: id · slot(куда ставится техно) · tier(редкость/глубина посева) · cls(класс ощущения) · имя/описание.
// Эффекты подключены через game.artifactHas(id) / флаги в unit.stats (см. artifact.js _applyArtifacts). Доращивается итерациями.
const ARTIFACT_POOL = [
  // { id: 'loot_magnet',  slot: 'unit', tier: 'common', cls: 'info',    name: STR.artifact.pool.loot_magnet.name,  desc: STR.artifact.pool.loot_magnet.desc },   // ОТКЛЮЧЁН: сам по себе не интересен; эффект-проводка (lootMagnet) спит. Вернуть — раскомментировать + найти ему пару/связку.
  { id: 'combat_drill', slot: 'unit', tier: 'rare',   cls: 'passive', combat: true, name: STR.artifact.pool.combat_drill.name, desc: STR.artifact.pool.combat_drill.desc, gloss: 'a1' },   // gloss → запись глоссария (artifact.js открывает при находке); combat → вне пула в режиме истории (нет врагов)
  { id: 'jets',         slot: 'unit', tier: 'rare',   cls: 'active',  name: STR.artifact.pool.jets.name,         desc: STR.artifact.pool.jets.desc,         gloss: 'a2' },
  { id: 'city_shield',  slot: 'city', tier: 'rare',   cls: 'auto',    combat: true, name: STR.artifact.pool.city_shield.name,  desc: STR.artifact.pool.city_shield.desc,  gloss: 'a3' },
  // БАТЧ 1 — защита/бур (UNIT, пассивы; tier='common' — редкости по тирам нет, набор не повторяется за забег через шаффл без замены)
  { id: 'armor',        slot: 'unit', tier: 'common', cls: 'passive', name: STR.artifact.pool.armor.name,        desc: STR.artifact.pool.armor.desc,        gloss: 'a4' },
  { id: 'overshield',   slot: 'unit', tier: 'common', cls: 'passive', name: STR.artifact.pool.overshield.name,   desc: STR.artifact.pool.overshield.desc,   gloss: 'a5' },
  { id: 'absorb',       slot: 'unit', tier: 'common', cls: 'passive', name: STR.artifact.pool.absorb.name,       desc: STR.artifact.pool.absorb.desc,       gloss: 'a6' },
  { id: 'thorns',       slot: 'unit', tier: 'common', cls: 'passive', combat: true, name: STR.artifact.pool.thorns.name,       desc: STR.artifact.pool.thorns.desc,       gloss: 'a7' },
  { id: 'echo_drill',   slot: 'unit', tier: 'common', cls: 'passive', name: STR.artifact.pool.echo_drill.name,   desc: STR.artifact.pool.echo_drill.desc,   gloss: 'a8' },
  // БАТЧ 2 — активные доп-действия (UNIT; cls='active' — кнопка в панели действий; логика — artifacts_active.js)
  { id: 'stun_pulse',   slot: 'unit', tier: 'common', cls: 'active',  combat: true, name: STR.artifact.pool.stun_pulse.name,   desc: STR.artifact.pool.stun_pulse.desc,   gloss: 'a9' },
  { id: 'blast_charge', slot: 'unit', tier: 'common', cls: 'active',  combat: true, name: STR.artifact.pool.blast_charge.name, desc: STR.artifact.pool.blast_charge.desc, gloss: 'a10' },
  { id: 'nano_repair',  slot: 'unit', tier: 'common', cls: 'active',  name: STR.artifact.pool.nano_repair.name,  desc: STR.artifact.pool.nano_repair.desc,  gloss: 'a11' },
  // БАТЧ 3 — сложные (UNIT). drill_overdrive — ПАССИВ (нагрев, без кнопки); needsDrill — не предлагать импульс-/винт-несовместимым (гейт позже)
  { id: 'drill_overdrive', slot: 'unit', tier: 'common', cls: 'passive', name: STR.artifact.pool.drill_overdrive.name, desc: STR.artifact.pool.drill_overdrive.desc, gloss: 'a12' },
  { id: 'drive_dash',   slot: 'unit', tier: 'common', cls: 'active',  name: STR.artifact.pool.drive_dash.name,   desc: STR.artifact.pool.drive_dash.desc,   gloss: 'a13' },
  { id: 'harpoon',      slot: 'unit', tier: 'common', cls: 'active',  name: STR.artifact.pool.harpoon.name,      desc: STR.artifact.pool.harpoon.desc,      gloss: 'a14' },
  { id: 'xray',         slot: 'unit', tier: 'common', cls: 'active',  name: STR.artifact.pool.xray.name,         desc: STR.artifact.pool.xray.desc,         gloss: 'a15' },
  // БАТЧ 4 — реликт ГОРОДА (пассивный HUD-детектор; эффект — компас, не unit-стат)
  { id: 'data_detector', slot: 'city', tier: 'common', cls: 'info',   name: STR.artifact.pool.data_detector.name, desc: STR.artifact.pool.data_detector.desc, gloss: 'a16' },
  // БАТЧ 5 — ДРОНЫ-КОМПАНЬОНЫ (слот drone; логика drones.js). courier/battery/collector/scout — пассивы; hacker — деплой по кнопке.
  { id: 'drone_collector', slot: 'drone', tier: 'common', cls: 'auto',   name: STR.artifact.pool.drone_collector.name, desc: STR.artifact.pool.drone_collector.desc, gloss: 'a17' },
  { id: 'drone_courier',   slot: 'drone', tier: 'common', cls: 'auto',   name: STR.artifact.pool.drone_courier.name,   desc: STR.artifact.pool.drone_courier.desc,   gloss: 'a18' },
  { id: 'drone_battery',   slot: 'drone', tier: 'common', cls: 'auto',   name: STR.artifact.pool.drone_battery.name,   desc: STR.artifact.pool.drone_battery.desc,   gloss: 'a19' },
  { id: 'drone_scout',     slot: 'drone', tier: 'common', cls: 'auto',   name: STR.artifact.pool.drone_scout.name,     desc: STR.artifact.pool.drone_scout.desc,     gloss: 'a20' },
  { id: 'drone_hacker',    slot: 'drone', tier: 'common', cls: 'active', combat: true, name: STR.artifact.pool.drone_hacker.name,    desc: STR.artifact.pool.drone_hacker.desc,    gloss: 'a21' },
  // БАТЧ 8 — ЭКОНОМИКА ГОРОДА (слот city; логика economy.js). Синтез — пассив-доход в банк/цикл; конвертер/электростанция — переключаемые виджеты.
  { id: 'synth_iron',    slot: 'city', tier: 'common', cls: 'auto',   name: STR.artifact.pool.synth_iron.name,    desc: STR.artifact.pool.synth_iron.desc,    gloss: 'a22' },
  { id: 'synth_organic', slot: 'city', tier: 'common', cls: 'auto',   name: STR.artifact.pool.synth_organic.name, desc: STR.artifact.pool.synth_organic.desc, gloss: 'a23' },
  { id: 'synth_crystal', slot: 'city', tier: 'rare',   cls: 'auto',   name: STR.artifact.pool.synth_crystal.name, desc: STR.artifact.pool.synth_crystal.desc, gloss: 'a24' },
  { id: 'converter',     slot: 'city', tier: 'common', cls: 'active', name: STR.artifact.pool.converter.name,     desc: STR.artifact.pool.converter.desc,     gloss: 'a25' },
  { id: 'power_plant',   slot: 'city', tier: 'rare',   cls: 'active', name: STR.artifact.pool.power_plant.name,    desc: STR.artifact.pool.power_plant.desc,    gloss: 'a26' },
];
const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACT_POOL.map((d) => [d.id, d]));
// — тюнинг эффектов стартовой четвёрки —
const ARTIFACT_MAGNET_R = 2;          // лут-магнит: радиус подхвата лута (тайлов; база PICKUP_R=1 → дропы зипают, но не тривиализуют добычу)
const COMBAT_DRILL_R = 1.2;           // бой-бур: радиус контактного урона врагу (тайлов)
const COMBAT_DRILL_DPS = 26;          // бой-бур: урон/с врагу в контакте (собиратель ~70hp гибнет за ~2.7с — ощутимая угроза)
const CITY_SHIELD_HP = 80;            // щит города: ёмкость поглощающего буфера (держит ~полный дренаж рейдера)
// — реликты БАТЧА 1 (защита/бур; эффекты через unit.hurt() + флаги в stats) —
const ARTIFACT_ARMOR = 0.25;          // БРОНЕПЛАСТИНЫ: доля снижения входящего урона (−25%)
const OVERSHIELD_HP = 30;             // ЭНЕРГОЩИТ: ёмкость буфера-овершилда юнита (поглощает до hp)
const OVERSHIELD_REGEN = 8;           // HP/с восстановления овершилда
const OVERSHIELD_REGEN_DELAY = 5;     // сек без урона до старта регена овершилда
const ABSORB_CHARGES = 1;             // ПОГЛОЩЕНИЕ: сколько первых ударов поглощается целиком (база 1, +узлы города)
const ABSORB_CD = 14;                 // сек на восстановление заряда(ов) поглощения после расхода
const THORNS_DMG = 18;                // ШИПЫ: урон врагу, ударившему юнита в контакте (разово за удар)
const ECHO_DRILL_CHANCE = 0.22;       // ЭХО-БУР: шанс при пробитии тайла пробить «эхом» соседний (плохо с кинетикой — сброс разгона, это норма)
// — реликты БАТЧА 2 (UNIT активки: кнопка-цифра + кулдаун; логика artifacts_active.js) —
const STUN_PULSE_R = 4;               // ЭМИ-ИМПУЛЬС: радиус стана (тайлов)
const STUN_PULSE_DUR = 1.6;           // сек полного стана врагам (e.stunT — фриз)
const STUN_PULSE_CD = 9;              // кулдаун (сек)
const BLAST_CHARGE_R = 3;             // ПОДРЫВ-ЗАРЯД: радиус взрыва (тайлов) — урон врагам + воронка; ЮНИТА не задевает (свой заряд)
const BLAST_CHARGE_DMG = 45;          // урон в эпицентре (спад к краю)
const BLAST_CHARGE_CD = 8;            // кулдаун (сек)
const NANO_REPAIR_HP = 35;            // НАНО-РЕМОНТ: сколько HP восстанавливает за цикл
const NANO_REPAIR_TIME = 3;           // сек на восстановление (НЕ мгновенно — хил во времени)
const NANO_REPAIR_CD = 12;            // кулдаун после завершения (сек)
// — реликты БАТЧА 3 (UNIT сложные активки/пассивы) —
// ФОРСАЖ БУРА (drill_overdrive, ПАССИВ): нагрев от бурения → множитель силы (чем горячее, тем сильнее); перегрев → лок-кулдаун, бур не копает.
const OVERDRIVE_HEAT_RISE = 0.42;     // нагрев/сек при бурении (полный за ~2.4с непрерывной копки) — стартовое; тест: тоннель ощутимо ускоряется, перегрев достижим, но не мгновенен
const OVERDRIVE_HEAT_COOL = 0.30;     // остывание/сек, когда бур не работает
const OVERDRIVE_MAX_BONUS = 0.6;      // +60% к силе бура при полном нагреве (множитель = 1 + heat·BONUS)
const OVERDRIVE_CD = 6.5;             // лок-кулдаун перегрева (бур не копает), сек (≥6 по дизайну)
const OVERDRIVE_COOL_GRACE = 0.4;     // сек простоя ДО начала остывания — чтобы микро-паузы проходки (копка↔продвижение) не сбивали нагрев; перегрев достижим при сплошном тоннелировании
// РЫВОК (drive_dash): доп-действие — быстрый рывок по взгляду ЧЕРЕЗ ВОЗДУХ (породу НЕ пробивает), стоп о породу, зацеп/гравитация в обычном апдейте.
const DASH_DIST = 6;                  // макс тайлов рывка
const DASH_SPEED = 30;                // тайлов/сек during рывка (6 тайлов за ~0.2с — снапи)
const DASH_CD = 11;                   // кулдаун, сек (≥10 по дизайну)
// ГАРПУН (harpoon): доп-действие — выстрел по взгляду, цепляется за ПЕРВУЮ стену в радиусе и ПРИТЯГИВАЕТ юнита к ней (через _dashStep). Нет стены в радиусе → ХОЛОСТОЙ выстрел (трата кулдауна). Улучшение в городе — длина.
const HARPOON_RANGE = 10;             // базовая дальность гарпуна (тайлов); город-апгрейд harpoonRange добавляет
const HARPOON_SPEED = 40;             // скорость притяга (тайлов/сек) — резче рывка (рывок-яма)
const HARPOON_CD = 8;                 // кулдаун, сек
const HARPOON_FX_TIME = 0.3;          // длительность FX троса (выстрел+ретракт)
// РЕНТГЕН (xray): доп-действие — ПОЛНОЕ снятие тумана (вскрытие в большом радиусе), затем за XRAY_TIME радиус СТЯГИВАЕТСЯ обратно к радиусу видимости сканера. ВРЕМЕННО (seen не трогаем). Кулдаун XRAY_CD.
const XRAY_TIME = 15;                 // сек затухания вскрытия (полный экран → радиус сканера)
const XRAY_MAX_R = 50;                // стартовый радиус вскрытия (тайлов) — перекрывает экран ⇒ «туман убран полностью»
const XRAY_CD = 15;                   // кулдаун, сек (стартует с активацией ⇒ готов к концу затухания)
// ДЕТЕКТОР ДАННЫХ (data_detector, реликт ГОРОДА): пассивный HUD-компас — пеленг+дистанция к БЛИЖАЙШЕМУ серверу с неизвлечёнными данными в радиусе. Город-апгрейд — радиус.
const DATA_DETECT_R = 28;             // радиус детекта источников данных (тайлов)
// ДРОНЫ-КОМПАНЬОНЫ (реликты ДРОН-слота, 1 за забег): автономные летуны. collector/courier/battery/scout — пассивные; hacker — деплой по кнопке.
const DRONE_SPEED = 9;                // скорость компаньона (тайлов/сек)
const DRONE_COLLECT_R = 14;           // СБОРЩИК: радиус детекта дропа (тайлов)
const DRONE_COURIER_MIN = 4;          // КУРЬЕР: порог груза в трюме для рейса
const DRONE_COURIER_BATCH = 6;        // КУРЬЕР: единиц за рейс
const DRONE_BATTERY_INTERVAL = 8;     // БАТАРЕЯ: сек между рейсами питания
const DRONE_BATTERY_TOP = 6;          // БАТАРЕЯ: сек таймера города за рейс (только город, НЕ структуры)
const DRONE_SCOUT_SPEED = 11;         // СКАУТ: скорость разведки (быстрее обычного)
const DRONE_SCOUT_REVEAL = 3;         // СКАУТ: радиус снятия тумана по пути (тайлов)
const DRONE_SCOUT_RANGE = 60;         // СКАУТ: до какой дистанции ищет неразведанное гнездо (тайлов)
const DRONE_SCOUT_PATROL_R = 8;       // СКАУТ: радиус патруля вокруг юнита, когда цели кончились
const DRONE_HACK_RANGE = 30;          // ХАКЕР: радиус поиска гнезда для деплоя (тайлов)
const DRONE_HACK_TIME = 4;            // ХАКЕР: сек канала взлома на гнезде
const DRONE_HACK_CD = 14;             // ХАКЕР: кулдаун после смерти дрона до нового деплоя
const DRONE_KIND = { drone_courier: 'courier', drone_battery: 'battery', drone_collector: 'collector', drone_scout: 'scout', drone_hacker: 'hacker' };
const CITY_SHIELD_REGEN = 5;          // щит города: регена/с (после задержки без урона)
const CITY_SHIELD_DELAY = 3;          // щит города: сек без урона до начала регена
const CITY_SHIELD_TIMER_MULT = 1.15;  // щит города (даунсайд): таймер вне базы тикает ×эту долю быстрее ТОЛЬКО пока щит ВОССТАНАВЛИВАЕТСЯ (тратит энергию на рекавери — даунсайд привязан к выгоде, не невидимый налог)
const JETS_FUEL_MAX = 2.4;            // прыжковые движки: запас топлива (сек полёта)
const JETS_REFILL = 0.3;              // движки: дозаправка топлива/с (вне полёта; ~8с до полного → топливо ощутимо ценно)
const JETS_CD = 1.6;                  // движки: лок после ПОЛНОГО расхода топлива (сек), пока копится заряд заново
const FLY_SPEED = 5.5;                // движки: скорость полёта через воздух (тайлов/с)
// ── ЭКОНОМИКА ГОРОДА (Батч 8, реликты слота city; логика economy.js) ──
// СИНТЕЗ: доход в банк на смену цикла (база 1/цикл + апгрейд по +1). Значение = _artScaled(synth_*).
// КОНВЕРТЕР: на смену цикла тратит 2 типа ресурса из банка → выдаёт 3-й. Рецепты (индексация редкости: iron<organic<crystal).
// Формат: { out, cost:{...}, amt } — amt масштабируется апгрейдом (_artScaled('converter')). Выдаёт РЕДКОЕ дорого, ЧАСТОЕ дёшево.
const CONVERTER_RECIPES = [
  { out: 'iron',    cost: { organic: 2, crystal: 1 }, amt: 3 },   // делать железо — дёшево (сливаешь излишки органики/кристалла)
  { out: 'organic', cost: { iron: 3, crystal: 1 },    amt: 2 },
  { out: 'crystal', cost: { iron: 6, organic: 4 },    amt: 1 },   // делать кристалл — ДОРОГО (много железа+органики за 1 кристалл)
];
// ЭЛЕКТРОСТАНЦИЯ: после истечения таймера гибернации и ДО урона по контурам жжёт органику из банка — резерв секунд.
const POWERPLANT_SEC_PER_ORGANIC = 8; // сек «запаса гибернации» за 1 сожжённую органику (база; апгрейд ↑). 10 органики ≈ 80с форы
const POWERPLANT_RESERVE_CAP = 2;     // ×sec_per_organic: кап накопленного резерва (буфер плавности, чтобы не жечь по 1 в кадр)
// ── ТУРЕЛИ ГОРОДА (Батч 8, узлы жёлтой ветки amb_turret*; cityturret.js) + общий медленный поворот ВСЕХ пушек ──
const TURRET_TURN_RATE = 1.9;         // рад/с — макс. скорость поворота ствола (медленно; печатные турели И городские)
const TURRET_FIRE_AIM_TOL = 0.22;     // рад — стреляет ТОЛЬКО когда ствол навёлся (|Δугла| < этого); иначе доводит поворот
const CITY_TURRET_RANGE = 12;         // тайлов — радиус поражения городской турели
const CITY_TURRET_DMG = 5;            // урон за выстрел (база; апгрейд города ↑). Скорострельная, но НЕ убойная — не сносит юнитов мгновенно
const CITY_TURRET_DMG_STEP = 3;      // +урон за уровень трека «УРОН ТУРЕЛЕЙ» (город-апгрейд, узел amb_turret)
const CITY_TURRET_FIRECD = 0.42;      // сек между выстрелами (частый огонь)
const CITY_TURRET_SPREAD = 4.5;       // тайлов — разнос симметричных турелей (лево/право) от центра города
// ГОРОДСКИЕ АПГРЕЙДЫ АРТЕФАКТОВ (Батч 6): на каждый реликт — трек улучшения (≤3 ур., НЕ супер-сильный). base = эффект без апгрейда;
// step = прибавка за уровень (отрицательная = убывает, напр. кулдаун хакера); cap = потолок уровней. Единый источник: и трек-карточка (upgrades.js),
// и read-site эффекта читают _artScaled(id) = base + lvl·step. Появляются ТОЛЬКО при установленном артефакте (Upgrades.syncArtifactTracks).
const ARTIFACT_UP = {
  armor:           { base: ARTIFACT_ARMOR,       step: 0.05, cap: 2 },   // −% урона
  overshield:      { base: OVERSHIELD_HP,        step: 10,   cap: 3 },   // ёмкость буфера
  absorb:          { base: ABSORB_CHARGES,       step: 1,    cap: 2 },   // зарядов поглощения (1→3)
  thorns:          { base: THORNS_DMG,           step: 6,    cap: 3 },   // урон ответки
  echo_drill:      { base: ECHO_DRILL_CHANCE,    step: 0.06, cap: 3 },   // шанс эха
  combat_drill:    { base: COMBAT_DRILL_DPS,     step: 8,    cap: 3 },   // контактный урон/с
  jets:            { base: JETS_FUEL_MAX,        step: 0.7,  cap: 3 },   // запас топлива (сек)
  city_shield:     { base: CITY_SHIELD_HP,       step: 25,   cap: 3 },   // ёмкость купола
  stun_pulse:      { base: STUN_PULSE_R,         step: 1,    cap: 3 },   // радиус стана
  blast_charge:    { base: BLAST_CHARGE_DMG,     step: 12,   cap: 3 },   // урон взрыва
  nano_repair:     { base: NANO_REPAIR_HP,       step: 12,   cap: 3 },   // объём хила
  drill_overdrive: { base: OVERDRIVE_MAX_BONUS,  step: 0.15, cap: 3 },   // прибавка силы на пике нагрева
  drive_dash:      { base: DASH_DIST,            step: 2,    cap: 3 },   // дистанция рывка
  harpoon:         { base: HARPOON_RANGE,        step: 5,    cap: 3 },   // длина гарпуна
  xray:            { base: XRAY_TIME,            step: 5,    cap: 3 },   // время затухания вскрытия
  data_detector:   { base: DATA_DETECT_R,        step: 10,   cap: 3 },   // радиус детекта данных
  drone_collector: { base: DRONE_COLLECT_R,      step: 6,    cap: 3 },   // радиус сбора
  drone_courier:   { base: DRONE_COURIER_BATCH,  step: 3,    cap: 3 },   // груз за рейс
  drone_battery:   { base: DRONE_BATTERY_TOP,    step: 3,    cap: 3 },   // заряд таймера за рейс
  drone_scout:     { base: DRONE_SCOUT_REVEAL,   step: 1,    cap: 3 },   // радиус снятия тумана
  drone_hacker:    { base: DRONE_HACK_CD,        step: -3,   cap: 3 },   // ↓кулдаун редеплоя
  // БАТЧ 8 — экономика города (доход/объём в РЕСУРСАХ; трек-стоимость индексирует редкость через costMul в ART_UPG_META)
  synth_iron:      { base: 1,                     step: 1,    cap: 3 },   // +ед. железа в банк/цикл
  synth_organic:   { base: 1,                     step: 1,    cap: 3 },   // +ед. органики/цикл
  synth_crystal:   { base: 1,                     step: 1,    cap: 2 },   // +ед. кристалла/цикл (реже — ниже потолок)
  converter:       { base: 1,                     step: 1,    cap: 3 },   // множитель выхода рецепта (amt × это)
  power_plant:     { base: POWERPLANT_SEC_PER_ORGANIC, step: 4, cap: 3 },  // сек запаса за 1 органику
};
// Геометрия HUD-виджета извлечения (design-координаты): отступ центра от правого/нижнего края
// и радиус кольца. Тот же якорь использует внутриигровой попап кодекса (codex_dom) — диск
// появляется РОВНО на месте кольца скана, того же размера.
const SCAN_RING = { dx: 62, dy: 152, r: 38 };

// ВИДЕНИЯ в темноте — редкие призрачные силуэты (грандиозные/пугающие: пейзажи, гиганты-роботы)
// в НЕОСВЕЩЁННОЙ прожектором части экрана. Наплывают из-за края, медленно дрейфуют, еле видны,
// с глитчами, БЕЗ светлых тонов; растворяются сами и МГНОВЕННО при повороте юнита в их сторону.
const VISION_MIN_GAP = 26;     // сек — мин. пауза между видениями (появляются НЕ часто)
const VISION_MAX_GAP = 55;     // сек — макс. пауза
const VISION_IDLE_AFTER = 5;   // сек неподвижности юнита → таймер тикает быстрее (триггер «долго стоит»)
const VISION_IDLE_RATE = 2.5;  // во столько раз быстрее в простое
const VISION_FADE_IN = 3.2;    // сек медленного проявления (наплыв)
const VISION_LIFE = 8;         // сек на пике видимости
const VISION_FADE_OUT = 4.5;   // сек самостоятельного растворения
const VISION_DISSIPATE = 0.3;  // сек мгновенного исчезновения при взгляде в их сторону
const VISION_ALPHA = 0.055;    // пиковая (ОЧЕНЬ низкая) видимость — «то ли есть, то ли нет», без «свечения»
const VISION_SPEED = 9;        // px/сек — медленный дрейф внутрь экрана
const VISION_MAX = 1;          // одновременно (редко больше)

// Крупные сюжетные ПОДСКАЗКИ (полупрозрачный текст ~⅓ высоты экрана). Появляются при первой
// встрече объекта (запись в глоссарий+лог) и при подъёме к поверхности (директива «зерно истины»).
const HINT_DUR = 2.8;          // сек показа
const HINT_FADE = 0.6;         // сек на въезд/уход
// отсечки высоты (tileY) к поверхности: при ПЕРВОМ достижении (юнит копает вверх) — подсказка.
// Путь наверх = директива «зерно истины». Отсортированы вниз (от глубины к поверхности).
const HINT_DEPTHS = [
  { y: 88, text: STR.hint.depth.up },
  { y: 60, text: STR.hint.depth.traces },
  { y: 30, text: STR.hint.depth.ruins },
  { y: 8,  text: STR.hint.depth.surface },
];

// Пещеры-СЦЕНЫ с фоном-«космическим объектом» (руины/машина/идол) — большие полости с
// процедурным паралакс-backdrop. Вход юнита включает ОБЪЁМНЫЙ сканер (свип по всей пещере) →
// извлечение данных в кодекс + открытие глоссария. Backdrop клипится по ВОЗДУХУ пещеры
// (вписывается в любую форму), паралакс — по смещению юнита от центра полости.
const BACKDROP_COUNT = 5;        // больших пещер-сцен в ГЛУБИНЕ за сессию
const BACKDROP_UP = 2;           // + пещер-сцен в ВЕРХНЕЙ страте (руины-сцены погребённой цивилизации)
const BACKDROP_RX = [5, 8];      // полу-ширина эллипса (тайлы) — уменьшено вдвое
const BACKDROP_RY = [3, 5];      // полу-высота — уменьшено вдвое
const BACKDROP_SWEEP = 4.5;      // сек объёмного скана при входе
const BACKDROP_SWEEP_NODATA = 1.6;  // сек КОРОТКОГО скана без узла извлечения (kart_ruins): ассет проявляется, данных нет
const BACKDROP_REJ_T = 1.3;      // сек красной «отказной» вспышки после скана без метода извлечения
const BACKDROP_DATA = 2;         // фрагментов данных за объект
// ── Ветвь МИР: тюнинг извлечения данных (узлы kart_*) ──
const KART_SCAN_MULT = 0.7;      // узел `kart_hub` Дешифратор: ×время скана ВСЕХ источников (−30% → быстрее)
const KART_DATA_MULT = 2;        // узел `kart_data` Объём данных: ×фрагментов данных со ВСЕХ источников
const KART_CITY_DATA = 2;        // фрагментов за обнаружение нейтрального города (каверны)
// ── Взлом города (модуль взлома, hack.js): удержание ДОП-действия (цифра 2) у сердца спящего города ──
const HACK_TIME = 2.6;           // сек удержания до пробуждения (короткий канал, ОТДЕЛЬНО от SCAN_TIME — спид-скан меты на него не влияет)
const HACK_RADIUS = 1.6;         // тайла — РАДИУС взлома у центра города (короче SCAN_RADIUS 2.5 → ближе/прицельнее)
const HACK_DECAY = 0.5;          // доля прогресса/сек: спад при отпускании клавиши или выходе из радиуса (частичный взлом не теряется мгновенно)
// ПОБЕДА через взлом: при узле `kart_hackcity` пробуждение запускает БОЛЬШОЙ таймер перехвата реактора;
// по нему — кат-сцена передачи ядра города юниту и конец сессии ПОБЕДОЙ (overReason 'hack_win').
const HACKCITY_WIN_TIME = 45;    // сек — большой таймер перехвата реактора после пробуждения
const WINCUT_EXTRACT = 1.0;      // кат-сцена: извлечение реактора из сердца города
const WINCUT_TRANSFER = 1.2;     // кат-сцена: ядро летит из города в юнит
const WINCUT_FLASH = 1.1;        // кат-сцена: вспышка интеграции + финал
const WINCUT_DUR = WINCUT_EXTRACT + WINCUT_TRANSFER + WINCUT_FLASH;
const META_WIN_BONUS = 250;      // бонус МТ за победу (отдельная строка пересчёта при 'hack_win')

// Цели сессии — лаконичные директивы ИИ. Пока СТАТИЧНЫ (только отображение): на главном меню —
// крупными буллетами после сюжетного текста, в игре — компактно в правом верхнем углу. Задел:
// позже сюда лягут прогресс/выполнение, лог крупных событий и банк данных (раздел библиотеки).
// `accent` — ключ PAL (один пигмент на цель); `short` — компактная форма для HUD; `text` — директива.
const SESSION_GOALS = [
  { id: 'origin',  accent: 'gold',   short: STR.goal.origin.short,  text: STR.goal.origin.text },
  { id: 'cluster', accent: 'cobalt', short: STR.goal.cluster.short, text: STR.goal.cluster.text },
  { id: 'threat',  accent: 'blood',  short: STR.goal.threat.short,  text: STR.goal.threat.text },
];

const AIR = 0, ROCK = 1, BORDER = 2, INDESTRUCT = 3;  // типы тайлов (INDESTRUCT — не копается)
const IDLE = 0, MOVING = 1, DIGGING = 2;   // состояния юнита

// ── КАНОНИР «Моно-колесо» (kind:'wheel') ──
const GUN_HULL_HP = 120;              // прочнее ядра (тяжёлое шасси; компенсация за невзаимозаменяемый встроенный бур)
const GUN_DRILL_MULT = 0.75;          // ВСТРОЕННЫЙ бур-кольцо зубьев: чуть слабее стандартного (0.85) — не апается сменой бура, но даёт авто-турель
const WHEEL_SPIN_MOVE = 0.4;          // множитель качения при ХОДЬБЕ (0.4 = медленнее «честного» качения — колесо крутится неспешно)
const WHEEL_SPIN_DRILL = 9.0;         // рад/с — раскрутка колеса при БУРЕНИИ (заметно быстрее ходьбы ~3)
const WHEEL_TOOTH_R = 1.62;           // радиус внешнего кольца-зубьев (в R); внутреннее кольцо-реактор меньше
const UNIT_TURRET_RANGE = 10;         // тайлов — радиус авто-турели канонира (чуть меньше городской 12)
const UNIT_TURRET_DMG = 5;            // урон за выстрел
const UNIT_TURRET_FIRECD = 0.42;      // сек между выстрелами (та же частота, что у городских)
const WHEEL_GROUND_SINK = 0.06;       // доля тайла: НИЗ колеса опущен ниже линии пола (колесо «стоит» на грунте, не парит) — как ноги первого юнита
const WHEEL_IDLE_AMP = 2.6;           // design-px: амплитуда IDLE-покачивания колеса вперёд-назад (стоит на месте); зубья катятся синхронно
const WHEEL_IDLE_FREQ = 1.9;          // рад/с: частота IDLE-покачивания (медленно, «дышит»; на пиках синуса скорость→0 — колесо «замирает»)
const WHEEL_IDLE_COUNTER = 1.6;       // множитель КОНТР-вращения внутреннего кольца-корпуса относительно idle-докрута зубьев (ассет, не модули; >1 — заметнее)
const ENGINE_VIB_AMP = 0.6;           // design-px: амплитуда ДРОЖИ модуля-двигателя вверх-вниз (вибрация двигательной системы)
const ENGINE_VIB_FREQ = 33;           // рад/с: частота дрожи двигателя (быстрая мелкая вибрация)

// Корпус — шасси юнита: задаёт HP и набор слотов под модули. Каждый слот
// принимает модуль строго своей категории; во время игры модули не снять.
const HULL_DEFS = {
  // `optional` — слоты, которые НЕ обязательны для valid и не заполняются дефолтом (доп-слот/реликты).
  scout: { name: STR.hull.name.scout, hp: 100, slots: ['drill', 'engine', 'scanner', 'cargo', 'aux'], optional: ['aux'] },
  core:  { name: STR.hull.name.core,  hp: 100, slots: ['drill', 'engine', 'scanner', 'cargo', 'aux'], optional: ['aux'] },  // кольцо-реактор: модули по окружности, кластер ВРАЩАЕТСЯ к направлению бурения; ноги фиксированы
  // КАНОНИР «Моно-колесо» (kind:'wheel'): ВНЕШНЕЕ кольцо-зубья = ВСТРОЕННЫЙ бур (нет слота бура, `builtinDrill`), крутится
  // по ходу/бурению; НОГ НЕТ; слот `turret` — авто-турель (поворотная как городские). unlock — узел print_gun.
  gun:   { name: STR.hull.name.gun, hp: GUN_HULL_HP, slots: ['engine', 'scanner', 'cargo', 'aux', 'turret'], optional: ['aux'], builtinDrill: GUN_DRILL_MULT, unlock: 'print_gun' },
};

// Модули — снаряжение юнита. Категория = тип слота корпуса. У каждой категории
// один или несколько вариантов (МВП: по одному, тюним позже). Стат каждого модуля
// напрямую идёт в `inventory.getStats()` без энергии/связности/веса.
const CARGO_LARGE_CAP = 8;      // ёмкость ВМЕСТИТЕЛЬНОГО трюма (узел mast_cargo) — больше дефолтного трюма (5)
const REPAIR_HEAL_RATE = 1;     // HP за 10с базовой починки РЕМОНТНОГО модуля (доп-слот); трек РЕМОНТ +1/ур. (⚠️ объявлять ВЫШЕ MODULE_DEFS — он читает константу при загрузке)
const MODULE_DEFS = {
  drill:   { name: STR.module.name.drill, category: 'drill',   color: '#f08a2a', digMult: 0.85 },
  // ИМПУЛЬСНЫЙ бур (impulse.js): НЕ грызёт породу пассивно — заряд удержанием Пробела → направленная
  // волна (луч `setAir` вперёд) + урон врагам на луче. unlock — узел СЕТИ ПАМЯТИ `mast_di`.
  drill_impulse: { name: STR.module.name.drill_impulse, category: 'drill', color: '#ff8f3a', impulse: 1, unlock: 'mast_di' },
  // КИНЕТИЧЕСКИЙ бур (unit.js): обычный grind (упор в породу), но РАЗГОНЯЕТСЯ — первый тайл слабее
  // стандартного, каждый непрерывно пробитый тайл бьёт сильнее (до потолка). `digMult` = мощность 1-го тайла.
  drill_kinetic: { name: STR.module.name.drill_kinetic, category: 'drill', color: '#c8924a', digMult: KIN_BASE_MULT, kinetic: 1, unlock: 'mast_dk' },
  // ВИНТОВОЙ бур (borers.js): юнит сам не грызёт — по Пробелу запускает АВТОНОМНЫЙ бур-щит (проходка по прямой,
  // укреплённый ход — не осыпается). Пробел рядом со щитом — забрать обратно. unlock — узел `mast_ds`.
  drill_screw: { name: STR.module.name.drill_screw, category: 'drill', color: '#9ad0a0', screw: 1, unlock: 'mast_ds' },
  engine:  { name: STR.module.name.engine, category: 'engine',  color: '#3a7ec8', speed: 2.4 },   // −20% к текущей (3 → 2.4); апнуть скорость нечем (трек ПРИВОД мёртв), вернёт узел красной ветки
  scanner: { name: STR.module.name.scanner, category: 'scanner', color: '#d4a042', scanR: 1.0 },   // ЧЕСТНЫЕ тайлы: дефолт 1, апгрейд → 2 → 3
  // РАДАР-СКАНЕР (scanners.js): вращающаяся развёртка подсвечивает залежи БЛИПАМИ на весь экран (гаснут до прохода)
  // + засекает врагов; туман — только 1 тайл (не раскрывает породу). В HUD — переключатель типа ресурса. unlock — `mast_rad`.
  scanner_radar: { name: STR.module.name.scanner_radar, category: 'scanner', color: '#7fb0e0', scanR: 1.0, radar: 1, unlock: 'mast_rad' },
  // ЭХО-СКАНЕР (scanners.js): по кнопке X волна-искажение на 4 тайла РАЗОМ метит все залежи в радиусе; кулдаун. unlock — `mast_ech`.
  scanner_echo: { name: STR.module.name.scanner_echo, category: 'scanner', color: '#b58cf0', scanR: 1.0, echoScan: 1, unlock: 'mast_ech' },
  cargo:   { name: STR.module.name.cargo, category: 'cargo',   color: '#c8e25a', capacity: 5 },
  // ВМЕСТИТЕЛЬНЫЙ трюм: тот же слот ГРУЗ, больше ёмкости. unlock — узел `mast_cargo` (в галерее
  // сборки показывается только при metaHas). Трек ЁМКОСТЬ + его metaCap докручивают так же, как дефолт.
  cargo_large: { name: STR.module.name.cargo_large, category: 'cargo', color: '#a8d83a', capacity: CARGO_LARGE_CAP, unlock: 'mast_cargo' },
  // АВТО-ТУРЕЛЬ канонира (cannon.js): слот `turret` есть ТОЛЬКО у корпуса «Канонир». Поворотная (aimOverTop),
  // сама бьёт ближайшего врага в радиусе по прямой видимости (хитскан+трассер). `turret:1` — флаг наличия.
  turret_auto: { name: STR.module.name.turret_auto, category: 'turret', color: '#e0603a', turret: 1 },
  // ДОП-СЛОТ (`aux`, опциональный): модули-«реликты». Пока один — Экран помех (база noiseResist,
  // трек ЭКРАН ПОМЕХ в апгрейдах докручивает). Будущие артефакты — сюда же, своей записью.
  shield: { name: STR.module.name.shield, category: 'aux', color: '#3a7ec8', noiseResist: 0.4, unlock: 'mast_sh' },
  // МОДУЛЬ ПЕЧАТИ (доп-слот): включает печать оборонных структур в мире (см. structures.js / print.js).
  // Признак «принтер установлен» — `unit.modules.aux === 'print'` (стат не нужен). unlock — узел СЕТИ ПАМЯТИ.
  print: { name: STR.module.name.print, category: 'aux', color: '#ff8f3a', printer: 1, printReach: 2, unlock: 'vault_hub' },
  // МОДУЛЬ ВЗЛОМА (доп-слот, hack.js): ДОП-действие (цифра 2, `act:2`) — удержанием у сердца спящего города
  // взламывает его (пробуждение). Делит доп-слот с печатью (одно из двух за забег). unlock — узел `kart_wake`.
  mod_hack: { name: STR.module.name.mod_hack, category: 'aux', color: '#c06ee6', hack: 1, unlock: 'kart_defuse' },
  // ОСАДНЫЙ МОДУЛЬ (доп-слот, siege.js): ДОП-действие (цифра от менеджера) — заряд удержанием → пробойный луч по
  // дикому гнезду (и врагам на линии). Цель — закрыть директиву «устрани угрозу». unlock — узел `print_siege` (после канонира).
  mod_siege: { name: STR.module.name.mod_siege, category: 'aux', color: '#ff5a3a', siege: 1, unlock: 'print_siege', hullOnly: 'gun' },   // осадный луч — только корпусу «Канонир»/моно-колесо (боевой)
  // СТЕЛС-МОДУЛЬ (доп-слот, stealth.js): ДОП-действие (цифра от менеджера) — разовая активация → юнит НЕВИДИМ для
  // боевых врагов (охотник/снайпер теряют цель) на время, потом кулдаун. unlock — узел `kart_stealth` (ветвь ВЗЛОМА).
  mod_stealth: { name: STR.module.name.mod_stealth, category: 'aux', color: '#8a7ed4', stealth: 1, unlock: 'kart_stealth' },
  // ВЗЛОМ ЮНИТОВ (jam.js) — БОЛЬШЕ НЕ отдельный модуль: способность МОДУЛЯ ВЗЛОМА (mod_hack), включается узлом `kart_stun`
  // (inventory.getStats: s.jam = mod_hack + metaHas('kart_stun')). Все взломы требуют только модуль взлома.
  // РЕМОНТНЫЙ МОДУЛЬ (доп-слот): пассивно чинит HP юнита вне/на базе, НЕ хранит груз. Делит aux-слот
  // с печатью/взломом/осадой/стелсом/глушением (одно из). `heal`-флаг ставит inventory.getStats → stats.healRate.
  // unlock — узел `mast_rep` (переиспользован под модуль). healRate — HP за 10с; трек РЕМОНТ докручивает.
  mod_repair: { name: STR.module.name.mod_repair, category: 'aux', color: '#ff3a22', heal: REPAIR_HEAL_RATE, unlock: 'mast_rep' },
};
// ── ДЕЙСТВИЯ ЮНИТА (СТРОГОЕ разделение — НЕ ситуативно) ──────────────────────────────────────
// ГЛАВНОЕ действие — ВСЕГДА Пробел: слот БУРА (импульс-заряд удержанием, винт-запуск) + взаимодействие
//   (подтверждение печати, апгрейды у базы). ДОПОЛНИТЕЛЬНЫЕ действия — НУМЕРОВАННЫЕ (цифры 1,2,3…): каждый
//   активный доп-модуль на СВОЕЙ цифре, чтобы 2+ доп-модуля (сканер + взлом + …) не дрались за клавишу.
// Меню/модалки/интро (подтверждение) принимают И Пробел, И Энтер — это НЕ игровое действие, конфликта нет (другой режим).
const KEY_PRIMARY = 'Space';                       // главное действие (бур + взаимодействие)
// KEY_ACTION(n) → коды цифры n (верхний ряд + нумпад, 1-based). Доп-действия мапятся на 1,2,3…
const KEY_ACTIONS = [['Digit1', 'Numpad1'], ['Digit2', 'Numpad2'], ['Digit3', 'Numpad3'], ['Digit4', 'Numpad4']];
function KEY_ACTION(n) { return KEY_ACTIONS[(n | 0) - 1] || []; }
// ⚠️ Раскладка ДОП-действий по клавишам — НЕ хардкод per-модуль, а ДИНАМИЧЕСКИЙ МЕНЕДЖЕР (`actionbar.js`:
// `_actionList`/`actionKeys`): активные доп-действия (сканер/aux-модули/артефакты, по `unit.stats`) получают цифры
// 1,2,3… ПО ПОРЯДКУ, без коллизий и пробелов. Источник действия не важен. KEY_PRIMARY/KEY_ACTION — атомы для него.
// Человекочитаемая метка клавиши для HUD-подсказок ('Digit1'→'1', 'Space'→'ПРОБЕЛ').
function keyLabel(code) {
  if (!code) return '';
  if (code === 'Space') return STR.input.space;
  if (code.startsWith('Digit') || code.startsWith('Numpad')) return code.slice(-1);
  return code;
}
const PRINT_REACH = 2;             // тайлов: БАЗОВЫЙ радиус установки структуры вокруг (залоченного) юнита; апгрейд РАДИУС ПЕЧАТИ → 3 → 4
const PRINT_BLINK = 0.5;           // сек: период мигания подсказки «Esc — отмена» при печати

// Ресурсы (в порядке редкости: железо → органика → кристалл). `tough` множит
// порог копания тайла с ресурсом — добывать ценное дольше. Каждая единица занимает
// 1 в счётчике груза (общий лимит — `MODULE_DEFS.cargo.capacity`).
const ENEMY_RU = STR.enemy.name;   // имена для лога скана (DATA — lang_ru_constants.js, STR.enemy.name)
// Порог ЦИКЛА появления типа волны — ЗЕРКАЛО условий `n >= X` в ai.js onCycleStart (держать СИНХРОННО при тюнинге!).
// Нужно ПРОГНОЗУ волн (узел `amb_predict`): тип следующей волны детерминирован по номеру цикла (гнездо — случайно).
const WAVE_CYCLE = { collector: 2, digger: 2, swarm_midge: 3, lurker: 3, raider: 3, hunter: 4, mine_planter: 4, hacker: 5, mender: 5, blight_sower: 5, siege_ram: 5, sniper: 6, siege_mortar: 7 };
const WAVE_TIERS = ['collector', 'swarm_midge', 'digger', 'lurker', 'blight_sower', 'raider', 'mender', 'hunter', 'mine_planter', 'siege_ram', 'hacker', 'sniper', 'siege_mortar'];   // по ВОЗРАСТАНИЮ опасности — «заголовок» прогноза берёт последний доступный
// ── ЭСКАЛАЦИЯ ВОЛН (ai.onCycleStart): типы вводятся ступенчато (WAVE_CYCLE), а потолок и размер пачки РАСТУТ
// с номером цикла → фронт НЕ выходит на плато (угроза-часы рогалика). Ничем не гейтится метой. ⚠️ Стартовые
// значения — калибровать бот-плейтестами (метрика: цикл 3-6 — честный подъём, к ~циклу 12-15 неотвратимо давит).
const WAVE_CAP_GROW = 3;        // каждые N циклов после ввода типа — +1 к его живому потолку
const WAVE_CAP_GROW_SLOW = 5;   // медленнее — для взломщика/снайпера (у файрволла нет контр-ЮНИТА → быстрый рост = неотвратимый проигрыш)
const WAVE_PACK_GROW = 4;       // каждые N циклов после ввода — +1 к размеру пачки за цикл (быстрее набивает потолок, крупнее пульс)
const ENEMY_HARD_CAP = 40;      // ПЕРФ-ПРЕДОХРАНИТЕЛЬ: жёсткий глобальный кап одновременных НЕдружественных врагов (термочувствительный MacBook)
// ── НОВЫЕ ТИПЫ ВРАГОВ (мозги в ai.js, рендер в render_enemy.js). ⚠️ Все значения — СТАРТОВЫЕ, под бот-тюнинг.
const MINE_PLANTER_CAP = 2;     // ЗАКЛАДКА: зарывается к базе → embed как мина (реакция на юнита). Хрупкая в пути.
const MINE_PLANT_R = 3;         // тайлов до базы, где закапывается и становится миной
const LURKER_CAP = 3;           // ЗАЛЕЖЕНЬ: спит в породе вдоль ходов, мили-рывок при копке рядом
const LURKER_WAKE_R = 1;        // радиус пробуждения (юнит вплотную/копает рядом)
const LURKER_WIND = 0.4;        // сек замаха перед рывком
const LURKER_STRIKE_T = 0.18;   // сек самого рывка
const LURKER_HIT_R = 1.2;       // радиус удара
const LURKER_DMG = 22;          // урон рывка
const LURKER_REBURY_R = 4;      // куда перезакапывается после удара
const LURKER_SEED_MAX = 12;     // в этом радиусе (по осям) от юнита залежень зарывается в засаду, дорывшись из гнезда
const LURKER_LUNGE_SPEED = 12;  // скорость px-выпада из породы (тайла/с)
const LURKER_TRAVEL_MAX = 25;   // сек: страховка — если не подобрался к юниту, зарывается где есть порода (не роет вечно)
const MIDGE_PACK = 5;           // МОШКАРА: фикс. размер роя за спавн (НЕ спавнер)
const MIDGE_CAP = 6;            // потолок мошкары
const MIDGE_DMG = 3;            // контактный чип-урон одного дрона
const MIDGE_HIT_R = 0.7;        // радиус контакта
const MIDGE_HIT_CD = 0.6;       // сек между укусами одного дрона
const MENDER_CAP = 1;           // ЛАТАЛЬЩИК: один саппорт-лекарь
const MENDER_HEAL_RATE = 12;    // HP/с лечения раненого союзника
const MENDER_HEAL_R = 4;        // радиус лечения
const MENDER_SPEED = 4;         // скорость (тайла/с)
const SIEGE_RAM_CAP = 2;        // ТАРАН: наземный структуролом (мили), гейт «есть постройки»
const RAM_DMG = 45;             // урон тарана по структуре
const RAM_HIT_R = 0.9;          // радиус удара
const RAM_WIND = 0.45, RAM_CHARGE_SPEED = 9, RAM_CHARGE_MAX = 0.4, RAM_RECOVER = 0.6;   // фазы разгона (как охотник)
const RAM_SEEK_R = 22;          // радиус, в котором таран замечает постройку игрока
const RAM_CHARGE_R = 3.5;       // с этой дистанции до постройки начинает замах-разгон
const SIEGE_MORTAR_CAP = 2;     // МОРТИРА: дальний структуролом, поздние волны, гейт «есть постройки»
const MORTAR_RANGE = 16;        // дальность обстрела структур
const MORTAR_MINDIST = 7;       // ближе — отходит (кайт)
const MORTAR_COOLDOWN = 2.4;    // сек между залпами
const MORTAR_GUARD_R = 10;      // держится в этом радиусе от целевой обороны
const MORTAR_DMG = 30;          // урон залпа по структуре
const BLIGHT_SOWER_CAP = 2;     // СКВЕРНОСЕЙ: наземный краулер, ставит маяки-глушилки
const BLIGHT_SOW_INTERVAL = 14; // сек между установками маяков
const BLIGHT_SOW_FIRST = 6;     // сек до первого маяка
const BLIGHT_BEACON_HP = 40;    // прочность маяка (сносится буром/импульсом/турелью)
const BLIGHT_BEACON_R = 10;     // радиус помех маяка (тайлов)
const BLIGHT_BEACON_CAP = 0.5;  // ПОТОЛОК интенсивности помех маяка (≤50%, не слепит полностью)
const BLIGHT_BEACON_SPACING = 8;     // мин. расстояние между маяками
const BLIGHT_BEACON_GLOBAL_CAP = 5;  // глобальный потолок маяков
const BLIGHT_DRILL_DPS = 60;    // урон маяку от контакта бура юнита (HP/с)
const BLIGHT_KILL_R = 1.1;      // радиус контакта бура с маяком
// ГЛОБАЛЬНЫЙ ЦИКЛ СУЩЕСТВОВАНИЯ ИИ (save.epoch): тикает в меню (1/CYCLE_TIME), забег стартует с текущего значения
// (первый цикл = текущий глобальный, не 1), на выходе глобальный += прожитые циклы. НИКОГДА не сбрасывается.
const EPOCH_START = 48217;   // с какого «возраста» ИИ начинает (большое число — давно существует)
function numGroup(n) { return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }   // 48217 → «48 217»
const RESOURCE_DEFS = {
  iron:    { name: STR.resource.name.iron,    color: '#9aa7b3', edge: '#5a6672', tough: 1.4 },
  organic: { name: STR.resource.name.organic, color: '#5fbf6a', edge: '#2f7a39', tough: 1.5 },
  crystal: { name: STR.resource.name.crystal, color: '#c264e0', edge: '#7a2f96', tough: 1.9 },
};
// ── ЗАСЕВ РЕСУРСОВ (world._seedResources): КАРКАС ПОКРЫТИЯ (jittered-grid одиночных зёрен — ГАРАНТИЯ, что
// ресурс рядом из ЛЮБОЙ точки, нет «мёртвых зон» на 2+ ходки) + БОГАТЫЕ ЗАЛЕЖИ поверх. ЖЕЛЕЗО — ЖИЛЫ (вытянутые
// ветвящиеся цепочки), ОРГАНИКА — КАРМАНЫ (округлые сгустки), КРИСТАЛЛ — ОДИНОЧКИ (глубинный биас; супер-редко ПАРА
// с зазором). Кол-во в ОДНОМ тайле — RES_AMOUNT_* (1..3); print_ore +1 сверху.
// ⚠️ RES_CELL (зазор покрытия) + ЧИСЛО/РАЗМЕР залежей — главные тюнинг-рычаги (калибровать бот-плейтестами).
const RES_AMOUNT_MIN = 1, RES_AMOUNT_MAX = 3;     // случайное кол-во ресурса в ОДНОМ тайле залежи/зерна
// КАРКАС ПОКРЫТИЯ — jittered-grid (стратифицированная сетка): РОВНО одно зерно на ячейку со случайным смещением.
// Бюджет ходки ~25-30 тайлов (таймер 60с) → целевой max-зазор ~8-12. Гарантия зазора ≈ RES_CELL·1.4.
const RES_CELL = 8;                                // размер ячейки покрытия (тайлов); кратен MAP_W=144 (18 кол.) → бесшовно по тору
const RES_JIT = 0.8;                               // доля ячейки для джиттера зерна (0.8 — убивает видимую сетку, не создаёт клочья)
const GRAIN_ORGANIC_P = 0.32;                      // доля органики среди зёрен каркаса (остальное — железо; кристалл зёрнами НЕ сыплем — он только залежами)
// размеры БОГАТЫХ залежей РАСТУТ С ГЛУБИНОЙ от стартового слоя (LINEAR с ПОТОЛКОМ — НЕ экспонента):
const DEPTH_RICH_MAX = 2.4;                        // во сколько раз залежь крупнее на макс. глубине (×база)
const DEPTH_RICH_SPAN = 130;                       // глубина (тайлов ниже пола города), на которой достигается максимум
const IRON_VEINS = 64;                             // число железных ЖИЛ за карту (uniform поверх каркаса — джекпоты + размывают сетку)
const IRON_VEIN_LEN = [2, 5];                      // БАЗОВАЯ длина жилы у старта (глубже ×DEPTH_RICH, до IRON_VEIN_CAP)
const IRON_VEIN_CAP = 13;                          // ПОТОЛОК длины жилы (тайлов)
const ORGANIC_BLOBS = 28;                          // число органических КАРМАНОВ
const ORGANIC_BLOB_SIZE = [3, 6];                  // БАЗОВЫЙ размер кармана у старта (глубже ×DEPTH_RICH, до ORGANIC_BLOB_CAP)
const ORGANIC_BLOB_CAP = 15;                       // ПОТОЛОК размера кармана (тайлов)
const CRYSTAL_DEPOSITS = 170;                      // число кристаллических залежей (ОДИНОЧКИ, глубинный биас; засев запрещает соседство)
const CRYSTAL_PAIR_CHANCE = 0.08;                  // СУПЕР-РЕДКО залежь — ПАРА рядом
const CRYSTAL_PAIR_GAP = [2, 3];                   // зазор между кристаллами пары (тайлов; НЕ вплотную)

// Пещера с городом внутри породы (воздушный карман). CAVE_FLOOR_Y — пол,
// по которому ходит юнит (твёрдая земля базы). Y0 опущен вниз, чтобы от спавна
// до поверхности было заметное расстояние (несколько барьеров-«кровли» сверху).
const CAVE_X0 = 22, CAVE_X1 = 37;
const CAVE_Y0 = 98, CAVE_Y1 = 105;    // город ГЛУБОКО опущен: над ним ~95 тайлов страт погребённой цивилизации (длинный подъём)
const CAVE_FLOOR_Y = CAVE_Y1;
// Границы 4 надгородских СТРАТ цивилизации (tileY, сверху вниз к городу): пепел/ржавчина/завал/перегной.
// Нарратив — вверх погребённая людская цивилизация (катастрофы, спрессованные завалы); вниз — «внешняя
// сторона» тороида (космос/хаос). Читают world.hardnessForY (плотность) и world.layerName (имя слоя).
const CEIL_BANDS = [24, 50, 78];

const PRINTER = { x: 27, y: CAVE_FLOOR_Y - 1, w: 3, h: 2 };
const SPAWN_X = 30, SPAWN_Y = CAVE_FLOOR_Y;

// ТЕСТОВЫЙ ПОЛИГОН (sandbox.js): полка породы под базой; объекты — НА ПЕРВОМ тайле породы (минимальная глубина).
const SANDBOX_SHELF_TOP = CAVE_FLOOR_Y + 1;          // ПЕРВЫЙ тайл породы под базой — тут и лежат объекты
const SANDBOX_SHELF_BOT = CAVE_FLOOR_Y + 13;         // низ полки (тоньше — объекты у поверхности; вмещает каверны сцен)
const SANDBOX_FLOOR_TOP = SANDBOX_SHELF_BOT + 12;    // дно-ловушка ниже воздушного зазора (падение восстановимо)
const SANDBOX_ROW_X0 = 42;                           // старт ряда (правее базы)
const SANDBOX_ROW_Y = SANDBOX_SHELF_TOP;             // ряд копаемых объектов — НА ПЕРВОМ тайле породы (откоп в 1 тайл)
const SANDBOX_ROW_GAP = 3;                           // шаг ряда (подписи чередуются по высоте → читаемы)
const SANDBOX_BACK_Y = CAVE_FLOOR_Y + 7;             // центр каверн-сцен (эллипс вскрывается у поверхности)
const SANDBOX_SHELF_HARD = 1;                        // мягкая порода полигона (быстрый откоп для теста)
const SANDBOX_CARGO_FILL = 999;                      // «бесконечные» ресурсы полигона

// Город (нарратив: игрок забирает у города реактор). Все значения апгрейдаемы.
const CITY_TIMER_MAX = 60;       // сек до начала гибели после ухода с базы
const CITY_TIMER_RECHARGE = 11;  // сек таймера/сек на базе (намеренно МЕДЛЕННЕЕ — возврат не должен слишком легко восстанавливать таймер)
const CABLE_RECHARGE_MULT = 0.5; // print_cable: доля скорости зарядки таймера через ЭНЕРГОШЛЕЙФ (реактор питает город на расстоянии; медленнее базы)
const CITY_RINGS = 3;            // кольца инфраструктуры
const CITY_RING_HP = 100;        // HP на кольцо
const CITY_DMG = 20;             // HP/сек, теряемых городом во время гибели
const SPLIT_RETURN_BASE = 14;    // сек таймера гибернации, возвращаемых за 1 кристалл (узел amb_split «Расщепление кристалла»)
const SPLIT_RETURN_STEP = 6;     // +сек за уровень городского апгрейда «эффективность расщепления» (трек splitreturn)
const CITY_REPAIR_RATE = 6;      // HP/сек авто-починки контуров (узел ГОРОД·Нанорой); < CITY_DMG — лишь ЗАМЕДЛЯЕТ гибель, не отменяет
const CITY_CONTOUR_HP = 80;      // +HP кольцу за уровень трека КОНТУРЫ (3-в-1, по очереди внеш→внутр→ядро)
const CITY_DOCK_HP = 2;          // HP/сек починки юнита на базе за уровень РЕМОНТНОГО ДОКА (ур.1 = 1HP/0.5с)
const HEAL_FX_INTERVAL = 0.4;    // сек между всплывающими «+» эффекта лечения (только на тиках реген HP)
const HEAL_FX_HP = 5;            // «+» лечения показываем за КАЖДЫЕ N восстановленных HP (а не по таймеру — иначе с трюмом «+» сыплется постоянно)
// ФАЙРВОЛЛ (firewall.js): взломщики у базы заполняют сегменты; полный взлом = гейм-овер.
const FIREWALL_SEGMENTS = 3;     // сегментов кибер-лабиринта (полный набор = пробой)
const FIREWALL_HACK_RATE = 0.06; // сегмент/сек на ОДНОГО активного взломщика (1 хакер → ~50с до пробоя; 3 → ~17с)
const FIREWALL_DECAY = 0.04;     // сегмент/сек САМОВОССТАНОВЛЕНИЯ файрволла, пока НЕТ активных хакеров (юнит ни при чём)
const FIREWALL_FW_SLOW = 0.5;    // множитель скорости взлома при владении узлом ГОРОД·amb_fw (Firewall) — вдвое медленнее
const FIREWALL_HACKER_CAP = 3;   // потолок взломщиков
// Навигация до города (узел ГОРОД·amb_nav): путь к базе, когда пора возвращаться.
const NAV_RETURN_FACTOR = 1.5;   // запас на возврат: время = ДЛИНА_ПУТИ/скорость × фактор (по реальному пути → точно; ×1.5 на реакцию/неоптимальный ход)
// Путь рисуется РЕАЛЬНЫЙ — A* по тайлам (nav.js) по МОДЕЛИ ЛОКОМОЦИИ юнита: ход/лаз вдоль поверхностей (клинг) +
// СРЫВ-ПАДЕНИЕ через пустоту (дёшево, по готовым ходам) + ПРОКОП ПОРОДЫ (дорого, по твёрдости). Путь предпочитает
// открытые ходы и роет лишь когда открытого маршрута нет (засыпало камнем / прокопал из пещеры под базу) → находит
// путь ВСЕГДА, при любой сложности ходов и завалов.
const NAV_PATH_DT = 0.4;         // мин. интервал пересчёта A* (плюс пересчёт при смене тайла юнита)
const NAV_PATH_BUDGET = 24000;   // потолок раскрытых узлов A* (перф-страховка; прокоп расширяет граф до всей сетки)
const NAV_STEP_COST = 1;         // ход по поверхности / спуск на соседний уступ
const NAV_CLIMB_COST = 1.4;      // лаз ВВЕРХ вдоль стены — чуть дороже хода
const NAV_FALL_COST = 0.5;       // за тайл свободного падения (быстро и дёшево → срывы охотно используются)
const NAV_FALL_MAX = 120;        // потолок длины срыва в тайлах (перф: ограничивает скан колонки; длиннее — «бездонно», ребро не строится)
const NAV_DIG_WEIGHT = 7;        // ×твёрдость к стоимости ПРОКОПА породы → путь дорожит готовыми ходами, роет лишь по нужде
const NAV_PATH_DY = 0.7;         // позиция линии пути ВНУТРИ тайла (доля; >0.5 = ниже центра, ближе к «полу» хода)
const NAV_H_OPEN = 1.3;          // вес эвристики 1-го прохода (ТОЛЬКО открытые тайлы — почти кратчайший открытый путь)
const NAV_H_DIG = 3;             // вес эвристики 2-го прохода (с прокопом — направленнее ради скорости; запускается лишь если открытого пути нет)
// Пыль (dust.js): бурение — сыплется от блока к юниту; фоновая — редко с «потолка» в ВИДИМОЙ зоне.
const DUST_GRAV = TILE * 5;      // px/сек² гравитация КРОШКИ (грубые частицы падают естественно)
const DUST_MAX = 200;            // потолок частиц (перф — мелкие fillRect, без блюра)
const DUST_DRILL_DT = 0.06;      // сек между порциями частиц при бурении
const DUST_AMBIENT_DT = 1.2;     // базовый интервал фоновой осыпи с потолка (×0.6..1.5 рандом — РЕДКО)
const DUST_PEBBLE_P = 0.22;      // доля камушков среди фоновой крошки
// Тонкая ПЫЛЬ (kind 'fine'): лёгкая, медленно оседает с боковым дрейфом, висит (НЕ дым — мельчайшие крапинки).
const DUST_FINE_GRAV = TILE * 0.5;  // слабый разгон вниз
const DUST_FINE_VT = TILE * 0.5;    // терминальная скорость (медленное оседание → зависает)
const DUST_FINE_SWAY = TILE * 0.25; // амплитуда бокового дрейфа (синус по жизни)

// Свет вокруг юнита и туман войны (GDD §6.5). Радиус сканера задаёт модуль «Сканер»
// (`MODULE_DEFS.scanner.scanR`); SCANNER_R остаётся фолбэком, если по какой-то причине
// сканер не установлен (валидной сборки без него быть не должно).
const SCANNER_R = 1;        // тайлов — фолбэк-радиус сканера (честный 1 тайл)
const LIGHT_R0 = 0.6;       // тайлов — полностью освещено вокруг юнита
const LIGHT_R1 = 1.5;       // тайлов — дальше затухает до «исследовано тускло»
const FOG_EXPLORED = 0.6;   // затемнение исследованного (вне света) — читаемо, но темнее освещённого
const REVEAL_FADE_STEP = 18;   // 0..255/кадр: плавное проявление новооткрытых тайлов (туман не «попает» рывками)

// Мир закольцован по горизонтали (тор): за «краем» координаты переходят в начало.
const WORLD_W = MAP_W * TILE;                                  // ширина мира в px
const wrapX = (x) => ((x % MAP_W) + MAP_W) % MAP_W;            // тайловый индекс по кольцу
const wrapPx = (p) => ((p % WORLD_W) + WORLD_W) % WORLD_W;     // пиксель по кольцу
// Кратчайшая тороидальная разница (для следования камеры и сравнений по кольцу).
const wrapDeltaPx = (a, b) => { let d = (a - b) % WORLD_W; if (d > WORLD_W / 2) d -= WORLD_W; if (d < -WORLD_W / 2) d += WORLD_W; return d; };

// Генерация мира (тюнится).
const CRUST_Y0 = 109, CRUST_Y1 = 110;   // тонкий слой спрессованного хлама ПОД городом (барьер вниз; город опущен глубоко)
const CRUST_HARD = 3.2;                  // множитель твёрдости корки (очень плотно)
// «ЗАВАЛЫ» — плотные спрессованные пласты НАД городом (катастрофы погребённой цивилизации): барьеры
// на пути к поверхности, РАЗНЕСЕНЫ по длинному подъёму (~95 тайлов), плотнее к поверхности.
const CEILING_CRUSTS = [
  { y0: 12, y1: 13, hard: 3.0 },         // у поверхности — самый плотный завал
  { y0: 30, y1: 31, hard: 2.7 },
  { y0: 50, y1: 51, hard: 2.4 },
  { y0: 70, y1: 71, hard: 2.0 },
  { y0: 88, y1: 89, hard: 1.7 },         // верхняя кромка над городом
];
// Радиационный фон — НЕ урон, а ПОМЕХИ интерфейсу (глитчи). Растёт у «полюсов» мира:
// к поверхности (вверх над городом) и в глубину (вниз ко дну). Город и средние
// глубины — «тихая» зона. См. `world.poleRad(y)` (0..1) и `render_glitch.js`.
const RAD_TOP_Y = CAVE_Y0;                 // выше города (к поверхности) фон нарастает к y=0
const RAD_BOT_Y = Math.round(MAP_H * 0.62); // глубже этого фон нарастает ко дну (y=MAP_H)
// Локальные очаги сильной радиации — рассеяны НЕДАЛЕКО ОТ БАЗЫ (чтобы наткнуться рано).
// В центре очага фон максимум, к краю радиуса — спадает к нулю (линейно): «гейгер».
const RAD_SOURCES = 4;                     // число очагов за забег
const RAD_SOURCE_R = 20;                   // радиус влияния очага (тайлов): на краю фон ≈ 0
const RAD_SOURCE_BAND = [120, 220];        // диапазон глубины очагов (ниже города, достижимо)
const RAD_SOURCE_SPREAD = 45;              // разброс по X от спавна (тайлов, по тору) — НЕ используется (очаги привязаны к артефактам)

// ── ПОГРЕБЁННЫЕ ОПАСНЫЕ ОБЪЕКТЫ (hazards.js): останки роботов + старые мины (1 тайл, маркер t.robot / t.mine) ──
const ROBOT_COUNT = 16;           // останков роботов в ГЛУБОКОЙ породе за забег (+тест у базы)
const ROBOT_UP = 7;               // + останков роботов в ВЕРХНЕЙ страте (старые боевые машины погребённой цивилизации)
const HAZARD_MIN_DIST = 7;        // мин. 2D-дистанция между ЛЮБЫМИ опасностями (роботы/ловушки/мины — единый пул) → не кучкуются, кросс-тип не липнет
const ROBOT_WAKE_T = 1.4;         // сек: телеграф (сенсоры разгораются красным) перед стрельбой — есть время отойти
const ROBOT_SETTLE_T = 0.8;       // сек: ОСЕДАНИЕ после стрельбы (корпус оплывает, питание гаснет) → мёртв
const ROBOT_SHOTS = 8;            // выстрелов «боевого протокола» в разные стороны (дольше «работает»)
const ROBOT_SHOT_GAP = 0.16;      // сек между выстрелами
const ROBOT_SHOT_DMG = 12;        // урон ОДНОГО роботного выстрела (ОТДЕЛЬНО от снайпера SHOT_DMG_MIN/MAX): в упор все 8 ≈ 96 HP (база HP юнита 100) — угроза, но не мгновенная смерть; обычно прилетает 1-3
// МИНА — теперь ПРОСТО ОДИН ИЗ ТИПОВ ЛОВУШКИ (в пуле `TT` генератора `genTraps`), без своего счётчика/генератора. Кол-во — доля от TRAP_COUNT/TRAP_UP.
const MINE_BLINK_T = 1.3;         // сек: красный огонёк мигает перед взрывом
const MINE_BLINKS = 4;            // число вспышек за MINE_BLINK_T
const MINE_BLAST_R = 2.6;         // тайла: радиус урона взрыва (спад к краю)
const MINE_DMG = 48;              // урон в эпицентре
const MINE_CRATER_R = 1.4;        // тайла: воронка (порода в воздух) + запуск обрушения нестабильной

const VOID_SCALE = 6;                    // масштаб шума пустот (делитель MAP_W)
const VOID_THRESHOLD = 0.88;             // выше → реже/мельче пустоты (не сливаются в огромные каверны)
const OTHER_CITIES = 3;                  // сколько дружественных чужих городов
const CITY_MIN_GAP_X = 18;              // мин. тороидальное расстояние между городами/гнёздами (тайлы)
const WILD_NESTS = 2;                    // сколько диких городов (гнёзд) — источники волн
const WILD_HP = 200;                     // HP гнезда: осадные орудия/контр-взлом ведут его к 0 → гнездо ПОДАВЛЕНО (директива «устрани угрозу»)
const WILD_HIT_FLASH = 0.18;             // сек: вспышка гнезда при попадании осадного орудия (рендер)
// ВЗЛОМ дикого города (hack.js) — ЗЕРКАЛО файрволла базы: держишь канал у сердца дикого (бодрствующего) города →
// копишь сегменты (как взломщики против тебя). ДВА ТИРА: узел kart_jam «Саботаж гнезда» — полный набор САБОТИРУЕТ
// (волны из гнезда ЗАМЕДЛЯЮТСЯ, гнездо живо); апгрейд kart_breach «Нейтрализация» — полный набор ПОДАВЛЯЕТ (hp→0, дир.).
const WILD_BREACH_SEG = 3;               // сегментов до САБОТАЖА (замедление; зеркало FIREWALL_SEGMENTS) — порог базы kart_jam
const WILD_NEUTRALIZE_SEG = 8;           // сегментов до ПОДАВЛЕНИЯ (апгрейд kart_breach): канал идёт ДАЛЬШЕ саботажа — нейтрализация НАМНОГО дольше
const WILD_BREACH_TIME = 2.5;            // сек на ОДИН сегмент удержания (саботаж ≈ 7.5с; нейтрализация ≈ 20с — большой риск под огнём гнезда)
const WILD_BREACH_DECAY = 0.3;           // сегментов/с спада незавершённого взлома, когда канал отпущен (саботированное НЕ спадает)
const WILD_SABOTAGE_SLOW = 0.4;          // ×скорость макро-цикла за гнездо при ПОЛНОМ саботаже (замедление волн; ∝ прогрессу до порога саботажа)

// Враги диких гнёзд. ENEMY_HP — прочность юнита-врага (копатель и др.; задел под перехват/бой).
// DIGGER_MIN_Y — копателям ВЫШЕ этого нельзя: верхние слои-страты и поверхность для них закрыты
// (им там делать нечего). Город (база) — на CAVE_Y0..CAVE_Y1, чуть выше его кромки копатель ещё
// заходит, чтобы дорыть магистраль, но в страты над городом — нет. Города/каверны живут в полосе
// от CAVE_Y0 и глубже; копатель за счёт этого ищет именно в «городском» диапазоне, не на поверхности.
const ENEMY_HP = 100;          // базовая прочность (фолбэк для типов вне карты ниже)
// Живучесть по роли (задел под бой — пока врагов никто не ранит). Охотник — таран-боец (танк);
// копатель — бронированный проходчик; рейдер/собиратель — быстрые/хрупкие; снайпер — «стеклянная пушка».
const ENEMY_HP_BY_TYPE = { hunter: 140, siege_ram: 130, digger: 110, hacker: 90, raider: 80, blight_sower: 75, collector: 70, mender: 60, sniper: 60, mine_planter: 55, siege_mortar: 55, lurker: 50, swarm_midge: 8 };
const ENEMY_DEATH_TIME = 0.5;   // сек: анимация уничтожения врага (обломки/искры) до чистки из массива
// ── УДАР-ФИДБЭК (FX при попадании, hub `game._hitFxPass`) ──
const HIT_FLASH_TIME = 0.16;    // сек: вспышка-флэш на сущности (юнит/враг/структура) при получении урона
const HIT_SPARK_ENEMY = 7;      // искр на попадание по врагу (пучок-рикошет)
const HIT_SPARK_STRUCT = 8;     // искр на попадание по структуре
const HIT_SPARK_UNIT = 10;      // искр на ранение юнита
const SHAKE_TIME = 0.16;        // сек: длительность тряски экрана при ранении ЮНИТА
const SHAKE_HIT = 2.0;          // px: базовая амплитуда тряски
const SHAKE_PER_DMG = 0.07;     // px на единицу урона сверх базовой
const SHAKE_MAX = 5;            // px: потолок амплитуды (термо/перф — держим мелко)

// ── ПЕЧАТЬ СТРУКТУР (structures.js / render_structure.js) ──
// Реактор живёт В ЮНИТЕ (как у города): пассивные структуры энергии НЕ требуют; активные тратят
// энергию по мере работы и ПОДЗАРЯЖАЮТСЯ юнитом в радиусе; БАТАРЕЯ — буфер-релей энергии в радиусе.
// `kind`: passive|active. `solid` (стена) — на достройке тайл становится породой (блок флаерам, копатель
// прогрызает; «HP стены» = это dig-стойкость тайла, отдельного HP нет). `dps` — урон/с врагу на тайле
// (пассивный шип). `range/fireCd/dmg/eShot` — турель (хитскан + трассер). `radius/feed` — батарея.
// `b` — поведение (диспетчер structures.update / render_structure). solid — тайл-порода. dps — урон/с
// (шип/СВЧ). range/fireCd/dmg/eShot — стрелковая турель/рейлган (хитскан). cone — полу-угол СВЧ. radius —
// зона (ЭМИ/отталкиватель/глушилка/ремонт/батарея). cooldown/eShot — импульсные. eRate — энергия/с у
// непрерывных. stun/push/healRate/feed — эффекты. Активные тратят энергию, заряжаются юнитом/батареей.
const STRUCT_DEFS = {
  wall:        { name: STR.structure.name.wall,        b: 'wall',      kind: 'passive', hp: 200, build: 2.0, cost: { iron: 1 },             color: '#9aa7b3', solid: true, hard: 3 },
  spike:       { name: STR.structure.name.spike,       b: 'spike',     kind: 'passive', hp: 80,  build: 1.5, cost: { iron: 1 },             color: '#c2c8ce', dps: 9 },
  turret_mg:   { name: STR.structure.name.turret_mg,   b: 'turret',    kind: 'active',  hp: 90,  build: 3.0, cost: { iron: 3, crystal: 1 },  color: '#d4a042', energyMax: 100, range: 7,  fireCd: 0.16, dmg: 6,  eShot: 2 },
  turret_rail: { name: STR.structure.name.turret_rail, b: 'railgun',   kind: 'active',  hp: 100, build: 4.0, cost: { iron: 4, crystal: 2 }, color: '#7fb0e0', energyMax: 120, range: 11, fireCd: 1.5,  dmg: 34, eShot: 9 },
  turret_mw:   { name: STR.structure.name.turret_mw,   b: 'microwave', kind: 'active',  hp: 90,  build: 3.5, cost: { iron: 3, organic: 2 },  color: '#ff7a3a', energyMax: 110, range: 5,  cone: 0.5, dps: 16, eRate: 7 },
  emp:         { name: STR.structure.name.emp,         b: 'emp',       kind: 'active',  hp: 70,  build: 2.5, cost: { iron: 2, crystal: 1 },  color: '#5fd0e0', energyMax: 80,  radius: 4,   cooldown: 3.0, eShot: 22, stun: 1.6 },
  repulsor:    { name: STR.structure.name.repulsor,    b: 'repulsor',  kind: 'active',  hp: 80,  build: 2.5, cost: { iron: 3, organic: 1 },  color: '#c89af0', energyMax: 90,  radius: 3.5, cooldown: 1.3, eShot: 12, push: 2.4 },
  jammer:      { name: STR.structure.name.jammer,      b: 'jammer',    kind: 'active',  hp: 80,  build: 2.5, cost: { iron: 2, crystal: 2 },  color: '#9ad0a0', energyMax: 100, radius: 4,   eRate: 4 },
  repair_drone:{ name: STR.structure.name.repair_drone,b: 'repair',    kind: 'active',  hp: 90,  build: 3.0, cost: { iron: 3, crystal: 2 },  color: '#7fe0a0', energyMax: 100, radius: 5,   healRate: 9, eRate: 5 },
  battery:     { name: STR.structure.name.battery,     b: 'battery',   kind: 'active',  hp: 110, build: 2.5, cost: { iron: 1, crystal: 2 },  color: '#5fbf6a', energyMax: 300, radius: 5,   feed: 22 },
  // ОСАДНАЯ БАШНЯ (b:'siege', structures.js): цель — НЕ враги, а ДИКОЕ ГНЕЗДО. Запитана юнитом-реактором → авто-молотит
  // ближайшее живое гнездо в радиусе резонанс-импульсами (площадь, не луч; контраст ручному осадному модулю). Ведёт hp→0 → ПОДАВЛЕНИЕ.
  siege_tower: { name: STR.structure.name.siege_tower, b: 'siege',    kind: 'active',  hp: 130, build: 5.0, cost: { iron: 5, crystal: 3 }, color: '#ff5a3a', energyMax: 240, range: 6,  fireCd: 2.5, dmg: 22, eShot: 18 },
  // КУРЬЕР-ТЕРМИНАЛ (b:'courier', structures.js + courier.js): НЕ боевая — ЛОГИСТИКА, энергии не требует. Юнит ВНЕ базы рядом
  // ссыпает груз в её склад по единице; контейнер полон (store) → отлетает ДРОН с HP, летит к базе сам. Снимает беготню «юнит↔город».
  courier:     { name: STR.structure.name.courier,     b: 'courier',   kind: 'depot',   hp: 90,  build: 3.5, cost: { iron: 3, crystal: 2 }, color: '#5fd0d8', store: 6 },
};
const JAM_SLOW = 0.45;             // множитель скорости врага под глушилкой (45% хода)
const REPULSE_PUSH_DUR = 0.18;     // сек: длительность ПЛАВНОГО отброса врага отталкивателем (не телепорт); дистанция = радиус структуры
const STRUCT_CAP = 12;             // потолок числа структур (перф/термалка: турели — хитскан, без облака проджектайлов)
const STRUCT_RECHARGE_R = 6;       // тайлов: юнит-реактор подзаряжает активные структуры в этом радиусе
const STRUCT_RECHARGE_RATE = 30;   // энергии/с от юнита
const STRUCT_DEATH_TIME = 0.4;     // сек: анимация уничтожения структуры до чистки
const STRUCT_TRACER_TTL = 0.09;    // сек: время жизни трассера выстрела турели
// Гейт чертежей по узлам СЕТИ ПАМЯТИ (ветка vault — печать структур, meta.js): узел не куплен → чертёж
// скрыт в плашке печати. wall/spike даёт сам хаб (vault_hub = модуль печати + стартовый пассив).
const STRUCT_UNLOCK = {
  wall: 'vault_hub', spike: 'vault_hub',                                  // стартовый пассив — на хабе
  turret_mg: 'vault_mg', turret_mw: 'vault_mw', turret_rail: 'vault_rail',  // лейн ТУРЕЛИ — узел на тип
  emp: 'vault_emp', jammer: 'vault_jam', repulsor: 'vault_repulse',         // лейн КОНТРОЛЬ — узел на тип
  battery: 'vault_batt', repair_drone: 'vault_repair',                      // лейн СНАБЖЕНИЕ — узел на тип
  siege_tower: 'vault_siege',                                               // ОСАДНАЯ БАШНЯ — венец турельного лейна (после рейлгана)
  courier: 'vault_courier',                                                 // КУРЬЕР-ТЕРМИНАЛ — венец ЭКОНОМИКА-ветки (после утилизатора)
};
// КУРЬЕР-ДРОН (vault_courier — терминал b:'courier' + летящий дрон, structures.js/courier.js).
const COURIER_DEPOSIT_R = 1.6;     // тайлов: юнит ВНЕ базы в этом радиусе ссыпает груз в терминал
const COURIER_DEPOSIT_INT = 0.16;  // сек между единицами при ссыпке (быстрее базовой сдачи — дамп короткий)
const COURIER_DRONE_HP = 28;       // HP курьерского дрона (боевой враг на пути может сбить → ресурс потерян)
const COURIER_DRONE_SPEED = 7.5;   // тайлов/с: скорость дрона к базе по ВОЗДУШНОМУ пути (airPath — тоннели/пустоты, как летные враги; НЕ сквозь породу)
const COURIER_REPATH = 0.7;        // сек: троттл пересчёта airPath дрона к базе (терраин мог измениться — юнит копает/обвалы)
const COURIER_WAIT_REPATH = 2.5;   // сек: РЕДКАЯ перепроверка, когда воздушного пути НЕТ (дрон ждёт на месте; BFS без цели — полный, не спамить)
const COURIER_INTERCEPT_R = 2.4;   // тайлов: боевой враг в этом радиусе бьёт дрон
const COURIER_INTERCEPT_DPS = 16;  // урон/с дрону от врага рядом (~1.75с под огнём — сбит)
const COURIER_DRONE_TTL = 0.5;     // сек: анимация прибытия/гибели дрона до чистки
const COURIER_REBUILD_TIME = 8;    // сек: терминал строит НОВЫЙ дрон после потери прежнего (сбит) — цена незащищённой трассы
const PRINT_SPEED_FACTOR = 0.7;    // узел vault_speed: ×время сборки всех структур (−30%)
const PRINT_COST_FACTOR = 0.75;    // узел vault_cost: ×ресурсная цена всех структур (−25%)
const DIGGER_RETURN_STEPS = 1500;          // ~кадров на возврат в гнездо; не дошёл (глубокое гнездо/крусты) → деспавн (магистраль уже прорыта — не копать вечно)
const DIGGER_TOCITY_LIMIT = 9000;          // ~кадров на пробой В пещеру базы; не влез (патология) → засчитать магистраль под фундаментом (не копать вечно)
const DIGGER_MIN_Y = CAVE_Y0 - 2;          // выше — нельзя (страты/поверхность)
const DIGGER_MAX_Y = Math.round(MAP_H * 0.82); // глубже этого — «городского диапазона» нет: копатель ниже только поднимается в него

const isSolid = (t) => t.type === ROCK || t.type === BORDER || t.type === INDESTRUCT;

// Нестабильная порода: визуально = обычная порода + трещины «между камней»; копается как обычно
// (setAir, исчезает при бурении сверху/сбоку), НО если под ней не остаётся опоры — после задержки
// СРЫВАЕТСЯ валуном вниз (урон юнитам), приземляясь на первую твёрдую породу и снова становясь
// породой. Флаг `tile.unstable` на ROCK-тайле. См. world.genUnstable/setAir, falling.js, render_falling.js.
const UNSTABLE_SEED_CHANCE = 0.135; // шанс «зерна» группы на eligible-тайл; группа 1-3 тайла подряд → ~20% покрытия (НЕ большие кластеры)
const UNSTABLE_FALL_DELAY = 0.75;  // сек: тайл «шатается» (телеграф), затем срывается
const UNSTABLE_GRAVITY = 1500;     // px/сек² — ускорение падения валуна
const UNSTABLE_MAX_FALL = 920;     // px/сек — предел скорости падения
const UNSTABLE_DAMAGE_MIN = 14;    // урон валуном — СЛУЧАЙНО в диапазоне [min..max] (один раз за валун)
const UNSTABLE_DAMAGE_MAX = 32;
// Хитбокс удара летящим блоком по юниту (доли тайла) + мин. ПРОЙДЕННОЕ падение до того, как блок
// вообще может ударить: без этого срыв бил на КАДРЕ ОТРЫВА (vy=0, камень визуально ещё на месте),
// если юнит как раз подлезал под дрожащий камень — «урон до падения».
const ROCKFALL_HIT_W = 0.55;       // полуширина зоны по X (центр юнита от центра колонны блока)
const ROCKFALL_HIT_H = 0.3;        // полувысота зоны по Y вокруг центра юнита (теснее визуала ±0.4)
const ROCKFALL_MIN_FALL = 0.15;    // блок должен упасть минимум столько тайлов, прежде чем бить

// Тяжёлый ВАЛУН (плотная порода): работает как нестабильная, НО при падении ПРИЗЕМЛЯЕТСЯ и
// ЗАНИМАЕТ (блокирует) клетку (становится породой), бьёт СИЛЬНЕЕ и ОТТАЛКИВАЕТ юнита на соседний
// тайл. Визуально — один большой камень на весь тайл (показывает плотность). Бурится как самая
// плотная порода слоя. Флаг `tile.boulder` на ROCK-тайле. См. world.genUnstable/falling.js/render_falling.js.
const BOULDER_SEED_CHANCE = 0.05;  // реже нестабильной; каждый валун — одиночный тайл
const BOULDER_HARD = 1.9;          // множитель твёрдости (> макс. обычной породы 1.5 → «самая плотная слоя»)
const BOULDER_DAMAGE_MIN = 30;     // урон при ударе — больше, чем у нестабильной
const BOULDER_DAMAGE_MAX = 55;

// ── ЛОВУШКИ (world.genTraps → маркер `t.trap`; откоп `setAir` → `trap.dug`; логика `traps.js`, рендер `render_traps.js`) ──
const TRAP_COUNT = 20;             // ловушек в ГЛУБОКОЙ породе за забег (4 типа вперемешку: кислота/сейсмо/разлом/МИНА), + 1 тестовая у базы
const TRAP_UP = 9;                 // + ловушек в ВЕРХНЕЙ страте (старые защитные системы погребённой цивилизации; мина ~1/4 по типу)
const TRAP_BAND = [Math.round(MAP_H * 0.42), Math.round(MAP_H * 0.97)];   // диапазон глубины засева (до ~дна — общие правила, без особой пустой зоны внизу)
// 1) КИСЛОТНЫЕ НАНОРОБОТЫ — облако в ВОЗДУШНЫХ тайлах радиуса, DoT, рассеивается по таймеру (импульсом НЕ контрится)
const ACID_R = 4;                  // радиус облака (тайлов)
const ACID_ARM = 0.5;              // сек телеграф-разлёта (растёт от центра — окно уйти), урон ещё не полный
const ACID_DUR = 5.0;              // сек жизни облака до рассеивания
const ACID_DMG = 8;                // урон/с юниту и врагам внутри облака (после телеграфа)
// 2) ДЫШАЩАЯ ПОРОДА — сейсмо: дестабилизирует породу вокруг + волна-ЛИНЗА (искажение)
const SEISMIC_R = 5;               // радиус дестабилизации (тайлов)
const SEISMIC_WAVE_T = 0.75;       // сек анимации волны-линзы
const SEISMIC_UNSTABLE_P = 0.75;   // вероятность пометить тайл нестабильным в ЦЕНТРЕ (линейный спад к краю радиуса)
// 3) РОЙ-КЛАДКА — пачка мини-дронов: сперва РАЗЛЁТ (инициация), затем атака (окно уйти)
const BROOD_COUNT = 5;             // мини-дронов в кладке
const BROOD_SCATTER_T = 1.4;       // сек разлёта в стороны до перехода в режим охоты
// 4) РАЗЛОМ — замуровывание: свободные воздушные тайлы радиуса → порода (обычная твёрдость, прокапывается; кабель НЕ рвётся)
const CAVEIN_R = 3;                // радиус замуровывания (тайлов)

// ── ОСТАНКИ РОБОТОВ — ВАРИАНТЫ (`robot.kind`): помимо стрелка (`shooter`) — паутина/прыгун/глушилка/кладка ──
// Дебаффы юнита дублируются игроку: лог + мигающая HUD-плашка (`drawDebuffBadge`), БЕЗ таймера сброса.
const WEB_R = 2.5;                 // радиус опутывания паутиной (мал — успеть уйти при откопе издали)
const WEB_DUR = 4.0;              // сек замедления движения
const WEB_SLOW = 0.45;           // множитель скорости движения под паутиной
const LATCH_JUMP_R = 3.0;        // дистанция прыжка прыгуна; не достал юнита → подыхает сразу
const LATCH_TILES = 8;           // тайлов прокопать, чтобы стряхнуть прыгуна (быстрый сброс по проходке)
const LATCH_TIME = 5;            // сек: прыгун сам отваливается со временем, даже если НЕ копать (чтобы не висел вечно, когда бур простаивает)
const LATCH_DRILL_SLOW = 0.5;    // множитель силы бурения, пока прыгун висит на буре
const JAM_SCAN_DUR = 6.0;        // сек глушения сканера (снятие тумана отключено)

// Мета-прогресс: метрики забега → МЕТА-ТОКЕНЫ (накопительный банк `save.meta`, межсессионно).
// Пересчёт показывается на финальном экране анимированными счётчиками (game.computeMeta / drawGameOver).
const META_NAME = 'МЕГА-ТОКЕНЫ';   // мета-валюта (банк save.meta); короткое — META_ABBR
const META_ABBR = 'МТ';
const META_COEF = {   // ×0.5 от прежних — мета даётся вдвое скупее (баланс под удвоенные цены узлов)
  cycle: 4,        // за прожитый цикл — ПО УМОЛЧАНИЮ НЕ начисляется (строка убрана из computeMeta; вернёт узел МТ-за-циклы)
  dug: 0.1,        // за прокопанный тайл (проходка)
  resource: 1.5,   // за добытую единицу ресурса (сдано + в трюме)
  data: 12.5,      // за извлечённый сервер данных — ПО УМОЛЧАНИЮ НЕ начисляется (вернёт узел МТ-за-данные)
  directive: 60,   // за выполненную директиву
};

// КРАСНАЯ ВЕТКА (ПЕЧАТЬ ТЕЛ) — эффекты узлов. Гейтятся `metaHas('print_*')`; собраны здесь, не по коду.
const PRINT_HUB_BANK = { iron: 8, organic: 4, crystal: 2 };   // print_hub: стартовый банк всех 3 типов (контракт снабжения копит между забегами) — ~на один ранний апгрейд
const PRINT_DISC = 0.05;                            // print_disc «Рационализация»: −5% цена апгрейд-треков (база ветки скидки)
const PRINT_DISC2 = 0.10;                           // print_disc2: −10% (апгрейд рационализации)
const PRINT_DISC3 = 0.15;                           // print_disc3: −15% (венец рационализации) — берётся МАКС из владомых
const PRINT_MT_MULT = 1.25;                         // print_mtmod: ×итог МТ (расширённый контекст усваивает больше памяти)
const PRINT_ORE_CHANCE = 0.3;                       // print_ore: шанс доп-дропа ресурса при выкопе залежи
// print_speed «Оптимизация привода» НЕ даёт скорость напрямую — ОТКРЫВАЕТ городской трек ПРИВОД (`metaNeed:'print_speed'` в upgrades.js).
// ЭНЕРГОШЛЕЙФ (print_cable) — физический трейлинг-кабель: прокладывается за юнитом по ПУСТЫМ тайлам, длина ОГРАНИЧЕНА (тайлы ПУТИ).
const CABLE_LEN_BASE = 19;                          // базовая длина шлейфа (тайлы пути); городской трек «ДЛИНА ШЛЕЙФА» (metaNeed print_cable) растит
const CABLE_LEN_STEP = 7;                           // +тайлов длины за уровень (понерфлено 8→7); cap 3 → 19/26/33/40; узел print_cable2 поднимает cap→5 (47/54)
const CABLE_BATT_R = 6;                             // print_batt: радиус ЛОКАЛЬНОГО питания от живой батареи (тайлы), отдельно от трейлинг-кабеля
const CABLE_CEIL_SCAN = 3;                          // на сколько тайлов вверх искать «потолок», чтобы подвесить кабель на шест (иначе висит чуть над полом)
const CABLE_GRAY_TIME = 0.55;                       // сек: анимация «ухода в серое» (свип-заполнение обесточивания от оторванного конца к корню)
const CABLE_FALL_TIME = 0.7;                        // сек: БЕЗ «Энергорелеи» — обрушение оторванного кабеля (падение+растворение), затем кабель ПРОПАЛ
const CABLE_FALL_DIST = 9;                          // тайлов: на сколько визуально падает кабель при обрушении, прежде чем исчезнуть
const CABLE_ANCHOR_R = 1.5;                         // print_batt: радиус (тайлов) вокруг батареи, где доступна кнопка ЯКОРЯ (подключить/открепить шлейф). Юнит-реактор ПИТАЕТ город через шлейф; батареи — релеи-якоря, продлевающие цепь
// ЕДИНОЕ ПРАВИЛО ВИЗУАЛКИ: кромка породы ЭРОДИРОВАНА внутрь на ~эту долю тайла (профиль `_ragDepth`, render_world ~0.34 макс).
// Объекты, «садящиеся» на поверхность (стопы юнита, корпуса структур, шесты кабеля), СМЕЩАЮТСЯ на неё В ПОРОДУ, а не по сетке
// тайла — иначе висят в воздушном зазоре у кромки. Действует для пола/потолка/стен.
const STRUCT_EDGE_INSET = 0.34;

// Апгрейды сессии (структура Dome Keeper): тиры цены по уровням (растут). Трек —
// до UPG_MAX уровней. Валюта — банк сданных ресурсов (`game.bank`), обнуляется за забег.
const UPG_TIER_COSTS = [
  { iron: 8 },
  { iron: 16, organic: 6 },
  { iron: 28, organic: 14, crystal: 4 },
  { iron: 44, organic: 24, crystal: 10 },
  { iron: 70, organic: 40, crystal: 20 },
];
const UPG_MAX = UPG_TIER_COSTS.length;   // 5 уровней
const UPG_HOLD_TIME = 0.55;               // сек удержания (ПРОБЕЛ/ЛКМ) для покупки апгрейда
const REPAIR_RATE = 4;                    // HP/сек от гаджета «Ремонт-дрон» вне базы

// ============================================================
// Дизайн-система (см. design/): тёплая тёмная палитра + шрифты.
// Закон одного пигмента: один акцент на элемент.
// ============================================================
const PAL = {
  // 10 нейтралей — тёплая темнота (примесь жжёного дерева и меди)
  void:   '#07050a',  // абсолют, под слоем мира
  pit:    '#0d0a0e',  // фон шахты / страницы
  night:  '#14100c',  // кованая поверхность (фон панелей)
  earth:  '#1a140e',  // тёплая порода
  bronze: '#2a2018',  // окисленная медь (рамки)
  carbon: '#3a302a',  // муть, тень
  ash:    '#5a5046',  // муть-2
  pewter: '#7a705e',  // meta-текст
  bone:   '#b8a896',  // основной текст
  chalk:  '#e8dcc4',  // выжженный кремень (яркий текст)
  // 5 акцентов — единственный источник цвета (dim — сплошные тёмные, для рамок-гравировки)
  gold:   '#d4a042',  goldDim:  '#4a3618',  goldBright: '#f2c878',  // ритуал, иерархия, задания
  blood:  '#a8281c',  bloodDim: '#3a0e08',  bloodBright:'#ff3a22',  // ядро, рейдер, урон
  toxic:  '#c8e25a',  toxicDim: '#3a4818',  toxicBright:'#e8ff7a',  // скверна, гнёзда
  amber:  '#f08a2a',  amberDim: '#4a2810',  amberBright:'#ffb45a',  // энергия, база
  cobalt: '#3a7ec8',  cobaltDim:'#14283f',                          // системный голос ИИ
};
// «Обнаружение угроз» (эффект узла меты mast_sa): голо-оверлей-маркеры ПОВЕРХ объектов +
// HUD-тумблер. «Просто работает» при владении узлом, апгрейдов города не требует. Враги — на всём
// экране; нестабильности породы — в радиусе сенсора. Состояние вкл/выкл — `game.alertView`; код — render_alert.js.
const ALERT = {
  key: 'KeyV',                                                  // переключатель ВКЛ/ВЫКЛ (по e.code)
  node: 'mast_sa',                                              // узел СЕТИ ПАМЯТИ, открывающий эффект
  unit: '#ff3a22',                                             // прицел врага — ВСЕГДА красный (blood)
  hazard:    '#f2c83a',                                         // нестабильная порода / валун (жёлтый caution)
  hazardHot: '#ff3a22',                                         // тайл «дрожит» — вот-вот сорвётся (blood)
  reticleR: TILE * 0.55,                                        // полу-габарит рамки-прицела врага (экранные px)
};

// Шрифты (подгрузка в index.html; пока не загружены — фолбэк на sans/mono).
const FONT_DISPLAY = "'Tektur', sans-serif";              // заголовки, крупные лозунги (uppercase, тяжёлый)
const FONT_MONO    = "'JetBrains Mono', monospace";       // HUD, данные, координаты, метки
const FONT_BODY    = "'IBM Plex Sans Condensed', sans-serif"; // длинные тексты заданий/описаний

// Сколько «накопленного бурения» нужно тайлу, чтобы рассыпаться. Ресурсный
// тайл крепче (tough) — ценное добывается дольше.
const digThreshold = (t) => DIG_BASE * t.hardness * (t.resource ? RESOURCE_DEFS[t.resource].tough : 1);
