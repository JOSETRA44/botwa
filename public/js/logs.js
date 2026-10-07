// Logs en tiempo real: refresco periódico, auto-scroll y limpieza.

import { api } from './api.js';
import { qs } from './dom.js';
import { showAlert } from './alerts.js';

let autoScroll = true;

const LOG_CLASS = {
  warning: 'log-warning',
  success: 'log-success',
  error: 'log-error'
};

async function refreshLogs() {
  try {
    const data = await api.getLogs();
    const container = qs('#logsContainer');
    const logs = data.logs || [];

    if (logs.length === 0) {
      container.innerHTML = '<div class="log-muted">No hay logs disponibles</div>';
      return;
    }

    container.innerHTML = logs.map((log) => {
      const colorClass = LOG_CLASS[log.type] || 'log-info';
      return `<div class="log-entry ${colorClass}">[${log.timestamp}] ${log.message}</div>`;
    }).join('');

    if (autoScroll) container.scrollTop = container.scrollHeight;
  } catch (error) {
    console.error('Error al obtener logs:', error);
  }
}

export function initLogs() {
  qs('#btnClearLogs').addEventListener('click', async () => {
    try {
      await api.clearLogs();
      refreshLogs();
      showAlert('🗑️ Logs limpiados', 'success');
    } catch (error) {
      showAlert(`❌ ${error.message}`, 'danger');
    }
  });

  const btnAutoScroll = qs('#btnToggleAutoScroll');
  btnAutoScroll.addEventListener('click', () => {
    autoScroll = !autoScroll;
    btnAutoScroll.innerHTML = `<svg class="icon"><use href="#icon-scroll-text"></use></svg> Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`;
  });

  refreshLogs();
  setInterval(refreshLogs, 5000);
}
