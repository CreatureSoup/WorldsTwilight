'use strict';

// Сохранение метрик в localStorage. Межсессионного прогресса в MVP нет —
// храним только лучшую глубину и число запусков.
const SAVE_KEY = 'twilight-of-the-world.save';

function loadSave() {
  try {
    return Object.assign({ bestDepth: 0, runs: 0, rep: {} },
      JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch { return { bestDepth: 0, runs: 0, rep: {} }; }
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
