import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as rag from './rag.js';
import {
  DEFAULT_CONFIG,
  DEFAULT_BOT_STATE,
  loadConfig,
  saveConfig,
  loadBotState,
  saveBotState,
  loadPanelLogs,
  clearPanelLogs
} from './shared/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'bot-state.json');
const LOGS_PATH = path.join(__dirname, 'panel-logs.json');
const ENV_PATH = path.join(__dirname, '.env');

// Actualiza (o agrega) una variable en el archivo .env sin tocar las demás líneas.
async function setEnvVar(key, value) {
  let lines = [];
  try {
    const data = await fs.readFile(ENV_PATH, 'utf8');
    lines = data.split('\n');
  } catch (error) {
    lines = [];
  }

  const escaped = String(value).replace(/\r?\n/g, '');
  const pattern = new RegExp(`^${key}=`);
  const idx = lines.findIndex(line => pattern.test(line));

  if (idx >= 0) {
    lines[idx] = `${key}=${escaped}`;
  } else {
    if (lines.length && lines[lines.length - 1].trim() !== '') lines.push('');
    lines[lines.length - 1] = `${key}=${escaped}`;
  }

  await fs.writeFile(ENV_PATH, lines.join('\n'), 'utf8');
  process.env[key] = escaped;
}

// Middleware
// Límite de 15mb: las entradas de conocimiento pueden traer imágenes en base64
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static('public'));

// GET /config - Devuelve la configuración actual
app.get('/config', async (req, res) => {
  try {
    const config = await loadConfig(CONFIG_PATH, DEFAULT_CONFIG);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar configuración' });
  }
});

// El panel (public/js/config.js) ya envía los grupos como array y los
// comandos como objeto {comando: texto} — pero se acepta también el
// formato de texto plano (líneas "a\nb" / "/cmd=texto") por si alguna
// otra integración sigue mandando strings crudas.
function toStringArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
  return [];
}

function toCommandObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const result = {};
    value.split('\n').filter(l => l.trim().length > 0).forEach(linea => {
      const [cmd, ...resto] = linea.split('=');
      const desc = resto.join('=').trim();
      if (cmd && cmd.trim().startsWith('/') && desc) result[cmd.trim()] = desc;
    });
    return result;
  }
  return {};
}

// POST /config - Actualiza la configuración
app.post('/config', async (req, res) => {
  try {
    const {
      promptGlobal, apiKeyGemini, apiKeyGrok, gruposPermitidos, gruposExcluidos,
      comandos, comandosSimples, delayMin, delayMax, responseMode, ragConfidenceThreshold,
      geminiModel,
      apiKeyOpenai, openaiModel,
      apiKeyGeminiVision, geminiVisionModel,
      apiKeyGeminiPapear, geminiPapearModel,
      apiKeyUnsplashAccess, apiKeyUnsplashSecret,
      apiKeyGoogleSearch, googleSearchEngineId,
      grokModel
    } = req.body;

    // Cargar config existente para preservar otras configuraciones
    const existingConfig = await loadConfig(CONFIG_PATH, DEFAULT_CONFIG);

    // Las API keys se guardan en .env, nunca en config.json
    if (apiKeyGemini) await setEnvVar('GEMINI_API_KEY', apiKeyGemini);
    if (apiKeyGrok) await setEnvVar('GROK_API_KEY', apiKeyGrok);
    if (apiKeyOpenai) await setEnvVar('OPENAI_API_KEY', apiKeyOpenai);
    if (apiKeyGeminiVision) await setEnvVar('GEMINI_VISION_API_KEY', apiKeyGeminiVision);
    if (apiKeyGeminiPapear) await setEnvVar('GEMINI_PAPEAR_API_KEY', apiKeyGeminiPapear);
    if (apiKeyUnsplashAccess) await setEnvVar('UNSPLASH_ACCESS_KEY', apiKeyUnsplashAccess);
    if (apiKeyUnsplashSecret) await setEnvVar('UNSPLASH_SECRET_KEY', apiKeyUnsplashSecret);
    if (apiKeyGoogleSearch) await setEnvVar('GOOGLE_SEARCH_API_KEY', apiKeyGoogleSearch);

    // Validar y procesar datos
    const config = {
      ...existingConfig,
      promptGlobal: promptGlobal || "Eres un asistente útil y educado.",
      apiKeyGemini: apiKeyGemini || existingConfig.apiKeyGemini || "",
      geminiModel: geminiModel || existingConfig.geminiModel || "gemini-2.5-flash",
      responseMode: ['ai', 'hybrid', 'direct'].includes(responseMode) ? responseMode : (existingConfig.responseMode || 'hybrid'),
      // Umbral (0-1) de similitud del catálogo a partir del cual el modo
      // "hybrid" responde directo sin gastar cuota de IA — antes era un
      // número fijo en el código (rag.HIGH_CONFIDENCE_SCORE = 0.80).
      ragConfidenceThreshold: Number.isFinite(parseFloat(ragConfidenceThreshold))
        ? Math.min(1, Math.max(0, parseFloat(ragConfidenceThreshold)))
        : (existingConfig.ragConfidenceThreshold ?? 0.80),
      gruposPermitidos: toStringArray(gruposPermitidos),
      gruposExcluidos: toStringArray(gruposExcluidos),
      comandos: toCommandObject(comandos),
      comandosSimples: toCommandObject(comandosSimples),
      delayMin: parseInt(delayMin) || 2000,
      delayMax: parseInt(delayMax) || 5000,
      grok: {
        ...existingConfig.grok,
        apiKey: apiKeyGrok || existingConfig.grok?.apiKey || '',
        model: grokModel || existingConfig.grok?.model || 'grok-4-fast-non-reasoning',
        enabled: true
      },
      openai: {
        ...existingConfig.openai,
        apiKey: apiKeyOpenai || existingConfig.openai?.apiKey || '',
        model: openaiModel || existingConfig.openai?.model || 'gpt-4o-mini',
        enabled: true
      },
      geminiVision: {
        ...existingConfig.geminiVision,
        apiKey: apiKeyGeminiVision || existingConfig.geminiVision?.apiKey || '',
        model: geminiVisionModel || existingConfig.geminiVision?.model || 'gemini-2.5-flash',
        enabled: true
      },
      geminiPapear: {
        ...existingConfig.geminiPapear,
        apiKey: apiKeyGeminiPapear || existingConfig.geminiPapear?.apiKey || '',
        model: geminiPapearModel || existingConfig.geminiPapear?.model || 'gemini-2.5-flash',
        enabled: true
      },
      unsplash: {
        ...existingConfig.unsplash,
        accessKey: apiKeyUnsplashAccess || existingConfig.unsplash?.accessKey || '',
        secretKey: apiKeyUnsplashSecret || existingConfig.unsplash?.secretKey || ''
      },
      googleSearch: {
        ...existingConfig.googleSearch,
        apiKey: apiKeyGoogleSearch || existingConfig.googleSearch?.apiKey || '',
        searchEngineId: googleSearchEngineId || existingConfig.googleSearch?.searchEngineId || ''
      }
    };

    // Guardar configuración
    const saved = await saveConfig(CONFIG_PATH, config);

    if (saved) {
      res.json({ success: true, message: 'Configuración guardada correctamente' });
    } else {
      res.status(500).json({ success: false, message: 'Error al guardar configuración' });
    }
  } catch (error) {
    console.error('Error en POST /config:', error);
    res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
  }
});

// GET /state - Obtener estado del bot
app.get('/state', async (req, res) => {
  try {
    const state = await loadBotState(STATE_PATH, DEFAULT_BOT_STATE);
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar estado' });
  }
});

// GET /logs - Obtener logs del bot
app.get('/logs', async (req, res) => {
  try {
    const logs = await loadPanelLogs(LOGS_PATH);
    res.json({ logs });
  } catch (error) {
    res.json({ logs: [] });
  }
});

// POST /logs/clear - Limpiar logs
app.post('/logs/clear', async (req, res) => {
  try {
    await clearPanelLogs(LOGS_PATH);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al limpiar logs' });
  }
});

// POST /control - Controlar el bot (pausar/reanudar/logs)
app.post('/control', async (req, res) => {
  try {
    const { action } = req.body;
    const state = await loadBotState(STATE_PATH, DEFAULT_BOT_STATE);
    
    switch (action) {
      case 'pause':
        state.active = false;
        break;
      case 'resume':
        state.active = true;
        break;
      case 'toggleLogs':
        state.logsEnabled = !state.logsEnabled;
        break;
      case 'resetCounter':
        state.messagesSentLastHour = 0;
        state.lastHourReset = Date.now();
        break;
      default:
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    // Guardar inmediatamente cuando es un cambio manual del usuario
    await saveBotState(STATE_PATH, state);
    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({ error: 'Error al controlar el bot' });
  }
});

// ============================================================
// Base de Conocimiento (RAG) - API para el panel
// ============================================================

// GET /knowledge - Listar todas las entradas
app.get('/knowledge', async (req, res) => {
  try {
    const entries = await rag.listEntries();
    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /knowledge - Crear entrada { title, text, tags?, imageBase64?, imageMime? }
app.post('/knowledge', async (req, res) => {
  try {
    const { title, text, tags, imageBase64, imageMime } = req.body;
    if (!title || !text) {
      return res.status(400).json({ error: 'title y text son obligatorios' });
    }
    const tagList = typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : (tags || []);
    const entry = await rag.addEntry({ title, text, tags: tagList, imageBase64, imageMime });
    res.json({ success: true, entry });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /knowledge/:id - Actualizar entrada
app.put('/knowledge/:id', async (req, res) => {
  try {
    const { title, text, tags, imageBase64, imageMime, removeImage } = req.body;
    const tagList = typeof tags === 'string'
      ? tags.split(',').map(t => t.trim()).filter(Boolean)
      : tags;
    const entry = await rag.updateEntry(req.params.id, { title, text, tags: tagList, imageBase64, imageMime, removeImage });
    res.json({ success: true, entry });
  } catch (error) {
    const status = error.message.includes('no encontrada') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// DELETE /knowledge/:id - Eliminar entrada (y su imagen)
app.delete('/knowledge/:id', async (req, res) => {
  try {
    await rag.deleteEntry(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const status = error.message.includes('no encontrada') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

// GET /knowledge/image/:file - Servir imagen de catálogo
app.get('/knowledge/image/:file', async (req, res) => {
  try {
    const imagePath = rag.getImagePath(req.params.file);
    await fs.access(imagePath);
    res.sendFile(imagePath);
  } catch {
    res.status(404).json({ error: 'Imagen no encontrada' });
  }
});

// POST /knowledge/search - Probar búsqueda { query }
app.post('/knowledge/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query es obligatorio' });
    const results = await rag.search(query);
    // Marca las coincidencias que el modo "hybrid"/"direct" respondería
    // directo del catálogo sin pasar por la IA (ver rag.HIGH_CONFIDENCE_SCORE)
    res.json({ results: results.map(r => ({ ...r, highConfidence: r.score >= rag.HIGH_CONFIDENCE_SCORE })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /knowledge/reindex - Regenerar embeddings de todas las entradas
app.post('/knowledge/reindex', async (req, res) => {
  try {
    const result = await rag.reindexAll();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🌐 Panel web disponible en http://localhost:${PORT}`);
  console.log(`📝 Edita la configuración del bot desde el navegador`);
});
