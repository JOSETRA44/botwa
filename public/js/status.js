// Estado del bot (activo/pausado, contador de mensajes) y botones de control.

import { api } from './api.js';
import { qs } from './dom.js';
import { showAlert } from './alerts.js';

async function refreshStatus() {
  try {
    const state = await api.getState();

    const badge = qs('#botStatus');
    const btnToggleLogs = qs('#btnToggleLogs');
    const messageCount = qs('#messageCount');

    if (state.active) {
      badge.innerHTML = '<span class="status-dot"></span> Activo';
      badge.className = 'status-badge status-active';
    } else {
      badge.innerHTML = '<span class="status-dot"></span> Pausado';
      badge.className = 'status-badge status-paused';
    }

    btnToggleLogs.innerHTML = `<svg class="icon"><use href="#icon-clipboard"></use></svg> Logs: ${state.logsEnabled ? 'ON' : 'OFF'}`;
    messageCount.textContent = state.messagesSentLastHour || 0;
  } catch (error) {
    console.error('Error al obtener el estado del bot:', error);
  }
}

async function runControl(action) {
  try {
    const result = await api.control(action);
    if (result.success) {
      refreshStatus();
      showAlert('✅ Acción ejecutada correctamente', 'success');
    } else {
      showAlert('❌ Error al ejecutar acción', 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  }
}

export function initStatus() {
  qs('#btnPause').addEventListener('click', () => runControl('pause'));
  qs('#btnResume').addEventListener('click', () => runControl('resume'));
  qs('#btnToggleLogs').addEventListener('click', () => runControl('toggleLogs'));
  qs('#btnResetCounter').addEventListener('click', () => runControl('resetCounter'));

  refreshStatus();
  setInterval(refreshStatus, 30000);
}
