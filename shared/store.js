// ============================================================
// Almacenamiento compartido (config / estado del bot / logs del panel)
// ============================================================
// Antes de este módulo, bot.js y server.js tenían CADA UNO su propia
// implementación de leer/escribir config.json, bot-state.json y
// panel-logs.json — con comportamientos que ya habían empezado a
// divergir (guardado inmediato vs. con throttle, valores por defecto
// distintos). Este módulo es la única fuente de verdad para esos 3
// archivos; ambos procesos lo importan en vez de reimplementar su
// propia versión.
//
// No cambia ningún formato en disco ni ninguna ruta del panel — es una
// extracción de la misma lógica, no un cambio de comportamiento visible.
// ============================================================

import fs from 'fs/promises';

// ---------- Config ----------

export const DEFAULT_CONFIG = {
  promptGlobal: "Eres un asistente útil y educado.",
  apiKeyGemini: "",
  responseMode: "hybrid",
  gruposPermitidos: [],
  gruposExcluidos: [],
  comandos: {},
  delayMin: 2000,
  delayMax: 5000
};

// Inyecta las API keys desde variables de entorno (.env) en el objeto de
// configuración. Las claves nunca viven en config.json para evitar que se
// filtren en el repositorio.
export function applyEnvSecrets(cfg) {
  cfg.apiKeyGemini = process.env.GEMINI_API_KEY || cfg.apiKeyGemini || '';

  cfg.unsplash = cfg.unsplash || {};
  cfg.unsplash.accessKey = process.env.UNSPLASH_ACCESS_KEY || cfg.unsplash.accessKey || '';
  cfg.unsplash.secretKey = process.env.UNSPLASH_SECRET_KEY || cfg.unsplash.secretKey || '';

  cfg.googleSearch = cfg.googleSearch || {};
  cfg.googleSearch.apiKey = process.env.GOOGLE_SEARCH_API_KEY || cfg.googleSearch.apiKey || '';

  cfg.geminiVision = cfg.geminiVision || {};
  cfg.geminiVision.apiKey = process.env.GEMINI_VISION_API_KEY || cfg.geminiVision.apiKey || '';

  cfg.grok = cfg.grok || {};
  cfg.grok.apiKey = process.env.GROK_API_KEY || cfg.grok.apiKey || '';

  cfg.openai = cfg.openai || {};
  cfg.openai.apiKey = process.env.OPENAI_API_KEY || cfg.openai.apiKey || '';

  cfg.geminiPapear = cfg.geminiPapear || {};
  cfg.geminiPapear.apiKey = process.env.GEMINI_PAPEAR_API_KEY || cfg.geminiPapear.apiKey || '';

  return cfg;
}

export async function loadConfig(configPath, defaults = DEFAULT_CONFIG) {
  try {
    const data = await fs.readFile(configPath, 'utf8');
    return applyEnvSecrets(JSON.parse(data));
  } catch (error) {
    console.error('❌ Error al cargar config.json:', error.message);
    return applyEnvSecrets({ ...defaults });
  }
}

// Las API keys nunca se persisten en config.json: se escriben en .env
// mediante setEnvVar() (server.js), que sigue siendo responsabilidad del
// panel, no de este módulo.
export async function saveConfig(configPath, config) {
  try {
    const toSave = { ...config, apiKeyGemini: '' };
    for (const section of ['unsplash', 'googleSearch', 'geminiVision', 'grok', 'openai', 'geminiPapear']) {
      if (toSave[section]) {
        toSave[section] = { ...toSave[section] };
        if ('apiKey' in toSave[section]) toSave[section].apiKey = '';
        if ('accessKey' in toSave[section]) toSave[section].accessKey = '';
        if ('secretKey' in toSave[section]) toSave[section].secretKey = '';
      }
    }
    await fs.writeFile(configPath, JSON.stringify(toSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar config.json:', error.message);
    return false;
  }
}

// ---------- Estado del bot ----------

export const DEFAULT_BOT_STATE = {
  active: true,
  logsEnabled: false,
  messagesSentLastHour: 0,
  lastHourReset: Date.now()
};

export async function loadBotState(statePath, defaults = DEFAULT_BOT_STATE) {
  try {
    const data = await fs.readFile(statePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { ...defaults };
  }
}

// throttleMs = 0 (por defecto) → guarda siempre de inmediato. Pasar un
// throttleMs > 0 (junto con lastSaveRef, una caja mutable { value }) para
// limitar la frecuencia de escritura en un punto de llamada específico
// (ej. el contador horario de bot.js, que no necesita persistirse al
// instante en cada mensaje).
export async function saveBotState(statePath, state, { force = false, throttleMs = 0, lastSaveRef } = {}) {
  try {
    const now = Date.now();
    const last = lastSaveRef ? lastSaveRef.value : 0;
    if (force || throttleMs === 0 || now - last > throttleMs) {
      await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
      if (lastSaveRef) lastSaveRef.value = now;
    }
    return true;
  } catch (error) {
    console.error('Error al guardar estado:', error.message);
    return false;
  }
}

// ---------- Logs del panel ----------

export async function loadPanelLogs(logsPath) {
  try {
    const data = await fs.readFile(logsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Agrega una entrada al arreglo de logs (en memoria, pasado por el
// llamador) y persiste el resultado. Devuelve el arreglo actualizado para
// que el llamador mantenga su propia referencia en memoria.
export async function addPanelLog(logsPath, logs, message, type = 'info', maxLogs = 100) {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  const updated = [...logs, { timestamp, message, type }];
  if (updated.length > maxLogs) updated.shift();

  try {
    await fs.writeFile(logsPath, JSON.stringify(updated, null, 2));
  } catch (error) {
    // Ignorar errores de escritura, igual que el comportamiento anterior
  }

  return updated;
}

export async function clearPanelLogs(logsPath) {
  await fs.writeFile(logsPath, JSON.stringify([]), 'utf8');
  return [];
}
