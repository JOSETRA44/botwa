// Sistema de notificaciones tipo toast, apiladas en la esquina superior.

import { qs } from './dom.js';

export function showAlert(message, type = 'success') {
  const container = qs('#alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.innerHTML = `
    <span>${message}</span>
    <button class="alert-close" aria-label="Cerrar">×</button>
  `;
  alert.querySelector('.alert-close').addEventListener('click', () => alert.remove());
  container.appendChild(alert);
  setTimeout(() => alert.remove(), 5000);
}
