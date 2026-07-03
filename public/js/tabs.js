// Navegación por pestañas: Panel / Configuración / Conocimiento.

import { qs, qsa } from './dom.js';

export function initTabs() {
  const tabs = qsa('.tab');
  const panels = qsa('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      panels.forEach((panel) => { panel.hidden = true; });

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      const target = qs(`[data-panel="${tab.dataset.tab}"]`);
      if (target) target.hidden = false;
    });
  });
}
