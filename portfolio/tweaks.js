/* ==========================================================================
   Tweak panel — временный инструмент для подбора шрифта.
   ?tweaks=0 — полностью убрать панель (для скриншотов и прод-рендера).
   Состояние — localStorage под ключом cs_tweaks.
   ========================================================================== */

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const hidePanel = params.get('tweaks') === '0';

  const STORAGE_KEY = 'cs_tweaks';
  const DEFAULTS = { font: 'unbounded', pill: 'outlined', faded: 'ghost', collapsed: false };
  // Миграция: старые шрифты, которых больше нет, мапим на Unbounded
  const LEGACY_FONTS = { play: 1, jura: 1, oswald: 1, syne: 1, 'red-hat': 1 };

  let state = Object.assign({}, DEFAULTS);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    state = Object.assign({}, DEFAULTS, saved);
    if (state.font in LEGACY_FONTS) state.font = DEFAULTS.font;
  } catch (e) { /* ignore */ }

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  };

  function applyState() {
    document.documentElement.dataset.twFont = state.font;
    document.documentElement.dataset.twPill = state.pill;
    document.documentElement.dataset.twFaded = state.faded;
    const panel = document.getElementById('tweaks');
    if (panel) {
      panel.classList.toggle('tweaks--collapsed', !!state.collapsed);
      const toggle = panel.querySelector('.tweaks__toggle');
      if (toggle) toggle.setAttribute('aria-expanded', String(!state.collapsed));
    }
    document.querySelectorAll('.tweaks__btns').forEach((group) => {
      const g = group.dataset.twGroup;
      const val = state[g];
      group.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.val === val);
      });
    });
  }

  function wirePanel() {
    const panel = document.getElementById('tweaks');
    if (!panel) return;
    panel.addEventListener('click', (e) => {
      const toggle = e.target.closest('.tweaks__toggle');
      if (toggle) {
        state.collapsed = !state.collapsed;
        save(); applyState();
        return;
      }
      const btn = e.target.closest('.tweaks__btns button');
      if (btn) {
        const group = btn.parentElement.dataset.twGroup;
        const val = btn.dataset.val;
        if (!group || !val) return;
        state[group] = val;
        save(); applyState();
      }
    });
  }

  function boot() {
    // ?tweaks=0 — удаляем панель, но шрифт всё равно применяем (чтобы выбор сохранялся на case-страницах)
    if (hidePanel) {
      const el = document.getElementById('tweaks');
      if (el) el.remove();
    }
    applyState();
    if (!hidePanel) wirePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
