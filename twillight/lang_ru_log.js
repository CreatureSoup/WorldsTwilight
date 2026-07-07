'use strict';

// СЛОВАРЬ RU — события ЛОГА и подсказки скана (logEvent/_scanMsg/hints) из ai/game/hazards/
// datascan/artifact/borers/hack/print. Параметризованные — ФУНКЦИИ (ветвление остаётся в коде).
// Строки — вербатим. Имена врагов в логах НЕ дублируются — берутся из STR.enemy.name
// (один источник: raiderDrain(name) и т.п. получают имя аргументом, не впечатывают копию).

i18nRegister('ru', {
  log: {
    // ai.js
    diggerSpotBase: 'КОПАТЕЛЬ ЗАСЁК БАЗУ',
    tunnelBreached: 'МАГИСТРАЛЬ К БАЗЕ ПРОБИТА',
    breachHint: 'ПРОРЫВ К БАЗЕ',
    raiderDrain: (name) => name + ' ВЫСОСАЛ ЭНЕРГИЮ',   // имя — из STR.enemy.name (один источник, не копия)
    hunterStruct: 'ОХОТНИК ПРОБИЛ СТРУКТУРУ',
    hunterRam: 'ОХОТНИК ТАРАНИЛ ЮНИТ',
    forecast: (name) => 'ПРОГНОЗ · НАДВИГАЕТСЯ: ' + name,
    // game.js
    reserveBody: 'РЕЗЕРВНОЕ ТЕЛО РАСПЕЧАТАНО',
    fwSegment: (done, total) => 'ВЗЛОМАН СЕГМЕНТ ФАЙРВОЛЛА ' + done + '/' + total,
    // hazards.js
    remnantsDefused: 'ОСТАНКИ ОБЕЗВРЕЖЕНЫ',
    protocolWoke: 'БОЕВОЙ ПРОТОКОЛ ОЖИЛ',
    protocolDrained: 'БОЕВОЙ ПРОТОКОЛ ИССЯК',
    remnantsData: 'ДАННЫЕ ИЗ ОСТАНКОВ ИЗВЛЕЧЕНЫ',
    mineDefused: 'МИНА ОБЕЗВРЕЖЕНА',
    mineBlast: 'ВЗРЫВ СТАРОЙ МИНЫ',
    // hazards.js — варианты останков роботов (дебаффы)
    robotWeb: 'ОСТАНОК ОПУТАЛ ПАУТИНОЙ · ДВИЖЕНИЕ ЗАМЕДЛЕНО',
    robotLatch: 'ПРЫГУН ВЦЕПИЛСЯ В БУР · БУРЕНИЕ ОСЛАБЛЕНО',
    robotLatchOff: 'ПРЫГУН СТРЯХНУТ',
    robotJam: 'ДЖАММЕР-ИМПУЛЬС · СКАНЕР ЗАГЛУШЕН',
    robotJamOff: 'СКАНЕР ВОССТАНОВЛЕН',
    // blight.js — маяки скверны (скверносей)
    blightBeacon: 'УСТАНОВЛЕН МАЯК СКВЕРНЫ · ПОМЕХИ РАСТУТ',
    blightBeaconDown: 'МАЯК СКВЕРНЫ УНИЧТОЖЕН · ЭФИР ЧИСТ',
    // traps.js — ловушки
    trapAcid: 'ВЫПУЩЕНЫ КИСЛОТНЫЕ НАНОРОБОТЫ · УЙДИ ИЗ ОБЛАКА',
    trapSeismic: 'СЕЙСМО-ТОЛЧОК · ПОРОДА ДЕСТАБИЛИЗИРОВАНА',
    trapBrood: 'ВСКРЫТА КЛАДКА · РОЙ РАЗЛЕТАЕТСЯ',
    trapCaveIn: 'ОБВАЛ · ПРОХОД ЗАМУРОВАН',
    // datascan.js
    newData: 'НАЙДЕНЫ НОВЫЕ ДАННЫЕ',
    identified: (name) => 'ОБЪЕКТ ОПОЗНАН · ' + name,
    scanMsgIdentified: 'ОБЪЕКТ ОПОЗНАН',                       // _scanMsg (короткий статус у кольца)
    scannedEnemy: (name) => 'СКАНИРОВАН ВРАЖЕСКИЙ ЮНИТ · ' + name,
    detected: (name) => 'ОБНАРУЖЕНО · ' + name,
    neutralCity: (name) => 'НЕЙТРАЛЬНЫЙ ГОРОД ОБНАРУЖЕН · ' + name,
    caveScan: 'ОБЪЁМНЫЙ СКАН ПЕЩЕРЫ',
    ruinsNoMethod: 'РУИНЫ: НЕТ МЕТОДОВ ИЗВЛЕЧЕНИЯ ДАННЫХ',
    identifiedCave: 'ОБЪЕКТ ОПОЗНАН · ПЕЩЕРА',
    caveData: 'ДАННЫЕ ИЗ ПЕЩЕРЫ ИЗВЛЕЧЕНЫ',
    findHint: { server: 'ОБНАРУЖЕНЫ ДАННЫЕ', wild: 'РОЙ', sleep: 'СПЯЩИЙ ГОРОД', unit: 'ЧУЖОЙ', cave: 'КУЛЬТ. СЛОЙ', remains: 'ОСТОВ' },
    findFallback: 'НАХОДКА',
    // artifact.js
    artifactDug: 'АРТЕФАКТ ОТКОПАН',
    techExtracted: (name) => 'ТЕХНОЛОГИЯ ИЗВЛЕЧЕНА: ' + name,
    artifactDataGiven: 'ДАННЫЕ АРТЕФАКТА ПЕРЕДАНЫ ГОРОДУ',
    artifactRecycled: 'АРТЕФАКТ ПЕРЕРАБОТАН В РЕСУРС',
    containerOpened: (n, res) => 'КОНТЕЙНЕР ВСКРЫТ: +' + n + ' ' + res,
    artifactReroll: 'РЕЛИКТ ПЕРЕ-АНАЛИЗИРОВАН — НОВЫЕ ТЕХНОЛОГИИ',
    // economy.js (реликт power_plant / узел amb_split)
    powerBurn: 'ЭЛЕКТРОСТАНЦИЯ · ЖЖЁТ ОРГАНИКУ ДЛЯ ФОРЫ',
    crystalSplit: (s) => 'РАСЩЕПЛЕНИЕ КРИСТАЛЛА · +' + s + 'С ТАЙМЕРА',
    // borers.js
    borerReturned: 'БУР-ЩИТ ВОЗВРАЩЁН',
    borerDepleted: 'БУР-ЩИТ РАЗРЯЖЕН · НУЖНА ПОДЗАРЯДКА',
    borerRecharged: 'БУР-ЩИТ ПОДЗАРЯЖЕН',
    // cable.js (энергорелеи — якоря шлейфа)
    cableAnchor: 'ШЛЕЙФ ЗАЯКОРЕН НА БАТАРЕЮ · ЦЕПЬ ПРОДЛЕНА',
    cableUnanchor: 'ШЛЕЙФ ОТКРЕПЛЁН ОТ БАТАРЕИ',
    // stealth.js
    stealthOn: 'МАСКИРОВКА · НЕВИДИМ',
    // jam.js
    jamPulse: 'ГЛУШЕНИЕ · ВРАГИ ЗАМЕДЛЕНЫ',
    // artifacts_active.js (активные реликты)
    artStun: 'ЭМИ-ИМПУЛЬС · ВРАГИ ОГЛУШЕНЫ',
    artBlast: 'ПОДРЫВ-ЗАРЯД · ДЕТОНАЦИЯ',
    artNano: 'НАНО-РЕМОНТ · РЕГЕНЕРАЦИЯ КОРПУСА',
    overdriveOverheat: 'ФОРСАЖ · ПЕРЕГРЕВ · БУР ОСТАНОВЛЕН',
    overdriveReady: 'ФОРСАЖ · ОХЛАЖДЁН · БУР ГОТОВ',
    artDash: 'ПРИВОД-РЫВОК · РАЗГОН',
    artHarpoon: 'ГАРПУН · ЗАЦЕП · ПРИТЯГ',
    artHarpoonDry: 'ГАРПУН · ХОЛОСТОЙ ВЫСТРЕЛ',
    artXray: 'РЕНТГЕН · ТУМАН СНЯТ',
    artXrayEnd: 'РЕНТГЕН · ОБЗОР СВЁРНУТ',
    droneScout: 'ДРОН-СКАУТ · ГНЕЗДО РАЗВЕДАНО',
    droneHackGo: 'ДРОН-ХАКЕР · ВЫХОД НА ЦЕЛЬ',
    droneHackDone: 'ДРОН-ХАКЕР · ГНЕЗДО САБОТИРОВАНО',
    // wildcity.js (директива «устрани угрозу»)
    wildSaboted: 'ГНЕЗДО САБОТИРОВАНО · ВОЛНЫ ЗАМЕДЛЕНЫ',
    wildDown: 'ГНЕЗДО ПОДАВЛЕНО',
    threatCleared: 'УГРОЗА УСТРАНЕНА · ДИРЕКТИВА ВЫПОЛНЕНА',
    // hack.js
    cityHacked: (name) => 'ГОРОД ВЗЛОМАН · ' + name,
    reactorTimerStart: 'ПЕРЕХВАТ РЕАКТОРА · ТАЙМЕР ЗАПУЩЕН',
    reactorIntercepted: 'РЕАКТОР ПЕРЕХВАЧЕН · ПЕРЕДАЧА ЯДРА',
    // print.js
    structPrinted: (name) => 'СТРУКТУРА НАПЕЧАТАНА · ' + name,
    // courier.js (vault_courier — логистика)
    courierLaunch: 'КУРЬЕР ВЫЛЕТЕЛ · КОНТЕЙНЕР В ПУТИ',
    courierArrived: 'КОНТЕЙНЕР ДОСТАВЛЕН В ГОРОД',
    courierLost: 'КУРЬЕР СБИТ · РЕСУРС ПОТЕРЯН',
  },
});
