'use strict';

// Сохранение метрик в localStorage. Межсессионного прогресса в MVP нет —
// храним только лучшую проходку (прорытых тайлов) и число запусков.
const SAVE_KEY = 'twilight-of-the-world.save';

function loadSave() {
  try {
    return Object.assign({ bestDug: 0, runs: 0 },
      JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch { return { bestDug: 0, runs: 0 }; }
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
