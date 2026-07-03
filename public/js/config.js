// Formulario de configuración del bot (prompt, keys, grupos, comandos, delays).

import { api } from './api.js';
import { qs, qsa } from './dom.js';
import { showAlert } from './alerts.js';

function parseLines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseKeyValueLines(value) {
  const result = {};
  value.split('\n').forEach((line) => {
    const [key, ...rest] = line.split('=');
    const val = rest.join('=');
    if (key && val) result[key.trim()] = val.trim();
  });
  return result;
}

function formatKeyValue(obj = {}) {
  return Object.entries(obj).map(([key, val]) => `${key}=${val}`).join('\n');
}

// Refleja en las tarjetas de modo cuál radio está seleccionado (borde +
// fondo), ya que el estado visual no viene gratis con <input type="radio">.
function syncChoiceCardStyles() {
  qsa('.choice-card').forEach((card) => {
    card.classList.toggle('is-selected', card.querySelector('input').checked);
  });
}

async function loadConfig() {
  try {
    const config = await api.getConfig();

    qs('#promptGlobal').value = config.promptGlobal || '';
    qs('#apiKeyGemini').value = config.apiKeyGemini || '';
    qs('#apiKeyGrok').value = config.grok?.apiKey || '';

    const mode = config.responseMode || 'hybrid';
    const modeRadio = qs(`input[name="responseMode"][value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;
    syncChoiceCardStyles();
    qs('#gruposPermitidos').value = (config.gruposPermitidos || []).join('\n');
    qs('#gruposExcluidos').value = (config.gruposExcluidos || []).join('\n');
    qs('#delayMin').value = config.delayMin || 2000;
    qs('#delayMax').value = config.delayMax || 5000;
    qs('#comandos').value = formatKeyValue(config.comandos);
    qs('#comandosSimples').value = formatKeyValue(config.comandosSimples);
  } catch (error) {
    showAlert(`❌ Error al cargar la configuración: ${error.message}`, 'danger');
  }
}

async function saveConfig(event) {
  event.preventDefault();

  const payload = {
    promptGlobal: qs('#promptGlobal').value,
    apiKeyGemini: qs('#apiKeyGemini').value,
    apiKeyGrok: qs('#apiKeyGrok').value,
    responseMode: qs('input[name="responseMode"]:checked')?.value || 'hybrid',
    gruposPermitidos: parseLines(qs('#gruposPermitidos').value),
    gruposExcluidos: parseLines(qs('#gruposExcluidos').value),
    comandos: parseKeyValueLines(qs('#comandos').value),
    comandosSimples: parseKeyValueLines(qs('#comandosSimples').value),
    delayMin: parseInt(qs('#delayMin').value, 10),
    delayMax: parseInt(qs('#delayMax').value, 10)
  };

  try {
    const result = await api.saveConfig(payload);
    if (result.success) {
      showAlert('✅ Configuración guardada. Reinicia el bot para aplicar cambios.', 'success');
    } else {
      showAlert(`❌ Error al guardar: ${result.message || 'desconocido'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  }
}

export function initConfig() {
  qs('#configForm').addEventListener('submit', saveConfig);
  qsa('input[name="responseMode"]').forEach((radio) => {
    radio.addEventListener('change', syncChoiceCardStyles);
  });
  loadConfig();
}
