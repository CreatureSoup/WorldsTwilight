'use strict';

// Сохранение метрик в localStorage. Межсессионный прогресс: банк МЕТА-ТОКЕНОВ (`meta`),
// плюс лучшая проходка (прорытых тайлов) и число запусков.
const SAVE_KEY = 'twilight-of-the-world.save';

function loadSave() {
  const ep = (typeof EPOCH_START !== 'undefined') ? EPOCH_START : 48217;   // глобальный цикл существования ИИ (тикает, не сбрасывается)
  try {
    return Object.assign({ bestDug: 0, runs: 0, meta: 0, metaUnlocks: {}, codex: null, storyMode: false, epoch: ep },
      JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch { return { bestDug: 0, runs: 0, meta: 0, metaUnlocks: {}, codex: null, storyMode: false, epoch: ep }; }
}
// ⚠️ ТЕСТОВЫЙ ПОЛИГОН (sandbox.js) НИЧЕГО не персистит: в сэндбоксе запись сейва заглушена (единая точка защиты).
function writeSave(s) { if (typeof window !== 'undefined' && window.game && window.game.sandbox) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
