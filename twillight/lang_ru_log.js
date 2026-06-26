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
    findHint: { server: 'СИГНАЛ', wild: 'РОЙ', sleep: 'СПЯЩИЙ ГОРОД', unit: 'ЧУЖОЙ', cave: 'КУЛЬТ. СЛОЙ', remains: 'ОСТОВ' },
    findFallback: 'НАХОДКА',
    // artifact.js
    artifactDug: 'АРТЕФАКТ ОТКОПАН',
    techExtracted: (name) => 'ТЕХНОЛОГИЯ ИЗВЛЕЧЕНА: ' + name,
    artifactDataGiven: 'ДАННЫЕ АРТЕФАКТА ПЕРЕДАНЫ ГОРОДУ',
    artifactRecycled: 'АРТЕФАКТ ПЕРЕРАБОТАН В РЕСУРС',
    // borers.js
    borerReturned: 'БУР-ЩИТ ВОЗВРАЩЁН',
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
  },
});
