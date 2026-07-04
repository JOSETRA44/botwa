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
    qs('#geminiModel').value = config.geminiModel || '';
    qs('#apiKeyGrok').value = config.grok?.apiKey || '';
    qs('#grokModel').value = config.grok?.model || '';

    const threshold = config.ragConfidenceThreshold ?? 0.80;
    qs('#ragConfidenceThreshold').value = threshold;
    qs('#ragConfidenceThresholdValue').textContent = Number(threshold).toFixed(2);

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

    qs('#apiKeyOpenai').value = config.openai?.apiKey || '';
    qs('#openaiModel').value = config.openai?.model || '';
    qs('#apiKeyGeminiVision').value = config.geminiVision?.apiKey || '';
    qs('#geminiVisionModel').value = config.geminiVision?.model || '';
    qs('#apiKeyGeminiPapear').value = config.geminiPapear?.apiKey || '';
    qs('#geminiPapearModel').value = config.geminiPapear?.model || '';
    qs('#apiKeyUnsplashAccess').value = config.unsplash?.accessKey || '';
    qs('#apiKeyUnsplashSecret').value = config.unsplash?.secretKey || '';
    qs('#apiKeyGoogleSearch').value = config.googleSearch?.apiKey || '';
    qs('#googleSearchEngineId').value = config.googleSearch?.searchEngineId || '';
  } catch (error) {
    showAlert(`❌ Error al cargar la configuración: ${error.message}`, 'danger');
  }
}

async function saveConfig(event) {
  event.preventDefault();

  const payload = {
    promptGlobal: qs('#promptGlobal').value,
    apiKeyGemini: qs('#apiKeyGemini').value,
    geminiModel: qs('#geminiModel').value,
    apiKeyGrok: qs('#apiKeyGrok').value,
    grokModel: qs('#grokModel').value,
    ragConfidenceThreshold: qs('#ragConfidenceThreshold').value,
    responseMode: qs('input[name="responseMode"]:checked')?.value || 'hybrid',
    gruposPermitidos: parseLines(qs('#gruposPermitidos').value),
    gruposExcluidos: parseLines(qs('#gruposExcluidos').value),
    comandos: parseKeyValueLines(qs('#comandos').value),
    comandosSimples: parseKeyValueLines(qs('#comandosSimples').value),
    delayMin: parseInt(qs('#delayMin').value, 10),
    delayMax: parseInt(qs('#delayMax').value, 10),
    apiKeyOpenai: qs('#apiKeyOpenai').value,
    openaiModel: qs('#openaiModel').value,
    apiKeyGeminiVision: qs('#apiKeyGeminiVision').value,
    geminiVisionModel: qs('#geminiVisionModel').value,
    apiKeyGeminiPapear: qs('#apiKeyGeminiPapear').value,
    geminiPapearModel: qs('#geminiPapearModel').value,
    apiKeyUnsplashAccess: qs('#apiKeyUnsplashAccess').value,
    apiKeyUnsplashSecret: qs('#apiKeyUnsplashSecret').value,
    apiKeyGoogleSearch: qs('#apiKeyGoogleSearch').value,
    googleSearchEngineId: qs('#googleSearchEngineId').value
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
  qs('#ragConfidenceThreshold').addEventListener('input', (event) => {
    qs('#ragConfidenceThresholdValue').textContent = Number(event.target.value).toFixed(2);
  });
  qsa('input[name="responseMode"]').forEach((radio) => {
    radio.addEventListener('change', syncChoiceCardStyles);
  });
  loadConfig();
}
