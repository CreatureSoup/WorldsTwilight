'use strict';

// Сохранение метрик в localStorage. Межсессионный прогресс: банк МЕТА-ТОКЕНОВ (`meta`),
// плюс лучшая проходка (прорытых тайлов) и число запусков.
const SAVE_KEY = 'twilight-of-the-world.save';

function loadSave() {
  try {
    return Object.assign({ bestDug: 0, runs: 0, meta: 0, metaUnlocks: {}, codex: null, storyMode: false },
      JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
  } catch { return { bestDug: 0, runs: 0, meta: 0, metaUnlocks: {}, codex: null, storyMode: false }; }
}
function writeSave(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
