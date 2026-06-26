'use strict';

// i18n — ЛЁГКАЯ локализация под Canvas-игру. Сейчас ОДИН язык ('ru'), переключения нет — это архитектура на будущее.
// ОПТИМИЗАЦИЯ под рендер каждый кадр: язык фиксируется на ЗАГРУЗКЕ, активный словарь — глобал `STR` (вложенные
// неймспейсы). ГОРЯЧИЙ путь (текст в кадре) читает строку ПРЯМО: `STR.menu.title` — обычный доступ к свойству,
// БЕЗ парсинга ключа и без вызова функции (быстрее любого `t('menu.title')` со split). ПАРАМЕТРИЗОВАННЫЕ строки —
// ФУНКЦИИ в словаре: `STR.menu.stats(dug, runs)` → строка (интерполяция без шаблон-движка в рантайме).
// `tr('a.b.c', …args)` — ТОЛЬКО для ДИНАМИЧЕСКИХ ключей (ключ вычислен в рантайме, напр. тип врага) и как мягкий
// фолбэк; статичный текст — всегда `STR.x.y`. Новый язык = `i18nRegister('en', {...})` + (когда нужно) `i18nUse('en')`.

const I18N = {};        // lang → словарь (вложенные неймспейсы)
let I18N_LANG = 'ru';   // текущий язык (зафиксирован; смена — i18nUse)
let STR = {};           // АКТИВНЫЙ словарь (глобал; render-код читает STR.<ns>.<key> напрямую)

// слияние словарей: рекурсия ТОЛЬКО по обычным объектам; строки / ФУНКЦИИ (typeof 'function') / массивы — листы.
function i18nDeepMerge(dst, src) {
  for (const k in src) {
    const v = src[k];
    dst[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? i18nDeepMerge(dst[k] || {}, v) : v;
  }
  return dst;
}
// Регистрация словаря языка (язык можно дополнять по частям из нескольких lang_*.js). Активный язык — сразу в STR
// (готов ДО первого кадра, т.к. lang_ru.js грузится в начале загрузчика).
function i18nRegister(lang, dict) {
  I18N[lang] = i18nDeepMerge(I18N[lang] || {}, dict);
  if (lang === I18N_LANG) STR = I18N[lang];
}
function i18nUse(lang) { if (I18N[lang]) { I18N_LANG = lang; STR = I18N[lang]; } return STR; }
function i18nLang() { return I18N_LANG; }

// tr — для ДИНАМИЧЕСКИХ ключей/интерполяции. Резолвит dot-путь по STR; значение-функция → вызывается с args.
// Ключ не найден → возвращает САМ ключ (видно недостающий перевод, рендер не падает).
function tr(key, ...args) {
  const parts = key.split('.');
  let v = STR;
  for (let i = 0; i < parts.length && v != null; i++) v = v[parts[i]];
  if (v == null) return key;
  return typeof v === 'function' ? v(...args) : v;
}
