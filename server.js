import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as rag from './rag.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'bot-state.json');
const ENV_PATH = path.join(__dirname, '.env');

// Inyecta las API keys desde variables de entorno (.env) en el objeto de configuración.
// Las claves nunca viven en config.json para evitar que se filtren en el repositorio.
function applyEnvSecrets(cfg) {
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

// Función para leer config.json
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    return applyEnvSecrets(JSON.parse(data));
  } catch (error) {
    console.error('Error al leer config.json:', error.message);
    return applyEnvSecrets({
      promptGlobal: "Eres un asistente útil y educado.",
      apiKeyGemini: "",
      gruposPermitidos: [],
      comandos: {}
    });
  }
}

// Función para guardar config.json
// Las API keys nunca se persisten aquí: se escriben en .env mediante setEnvVar().
async function saveConfig(config) {
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
    await fs.writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar config.json:', error.message);
    return false;
  }
}

// Función para leer estado del bot
async function loadBotState() {
  try {
    const data = await fs.readFile(STATE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {
      active: true,
      logsEnabled: false,
      messagesSentLastHour: 0,
      lastHourReset: Date.now()
    };
  }
}

// Función para guardar estado del bot
async function saveBotState(state) {
  try {
    await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error al guardar estado:', error.message);
    return false;
  }
}

// GET /config - Devuelve la configuración actual
app.get('/config', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar configuración' });
  }
});

// POST /config - Actualiza la configuración
app.post('/config', async (req, res) => {
  try {
    const { promptGlobal, apiKeyGemini, apiKeyGrok, gruposPermitidos, gruposExcluidos, comandos, delayMin, delayMax } = req.body;

    // Cargar config existente para preservar otras configuraciones
    const existingConfig = await loadConfig();

    // Las API keys se guardan en .env, nunca en config.json
    if (apiKeyGemini) await setEnvVar('GEMINI_API_KEY', apiKeyGemini);
    if (apiKeyGrok) await setEnvVar('GROK_API_KEY', apiKeyGrok);

    // Validar y procesar datos
    const config = {
      ...existingConfig,
      promptGlobal: promptGlobal || "Eres un asistente útil y educado.",
      apiKeyGemini: apiKeyGemini || existingConfig.apiKeyGemini || "",
      gruposPermitidos: [],
      gruposExcluidos: [],
      comandos: {},
      delayMin: parseInt(delayMin) || 2000,
      delayMax: parseInt(delayMax) || 5000
    };

    // Actualizar Grok si se proporcionó
    if (apiKeyGrok) {
      config.grok = {
        ...existingConfig.grok,
        apiKey: apiKeyGrok,
        enabled: true
      };
    }

    // Procesar grupos permitidos (separados por comas o saltos de línea)
    if (gruposPermitidos) {
      const grupos = gruposPermitidos
        .split(/[\n,]/)
        .map(g => g.trim())
        .filter(g => g.length > 0);
      config.gruposPermitidos = grupos;
    }

    // Procesar grupos excluidos
    if (gruposExcluidos) {
      const grupos = gruposExcluidos
        .split(/[\n,]/)
        .map(g => g.trim())
        .filter(g => g.length > 0);
      config.gruposExcluidos = grupos;
    }

    // Procesar comandos (formato: /comando=descripción, uno por línea)
    if (comandos) {
      const lineas = comandos.split('\n').filter(l => l.trim().length > 0);
      lineas.forEach(linea => {
        const [cmd, desc] = linea.split('=').map(s => s.trim());
        if (cmd && cmd.startsWith('/') && desc) {
          config.comandos[cmd] = desc;
        }
      });
    }

    // Guardar configuración
    const saved = await saveConfig(config);
    
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
    const state = await loadBotState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar estado' });
  }
});

// GET /logs - Obtener logs del bot
app.get('/logs', (req, res) => {
  try {
    // Los logs se comparten desde bot.js mediante un archivo temporal
    const logsPath = path.join(__dirname, 'panel-logs.json');
    fs.readFile(logsPath, 'utf8')
      .then(data => {
        const logs = JSON.parse(data);
        res.json({ logs });
      })
      .catch(() => {
        res.json({ logs: [] });
      });
  } catch (error) {
    res.json({ logs: [] });
  }
});

// POST /logs/clear - Limpiar logs
app.post('/logs/clear', async (req, res) => {
  try {
    const logsPath = path.join(__dirname, 'panel-logs.json');
    await fs.writeFile(logsPath, JSON.stringify([]), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al limpiar logs' });
  }
});

// POST /control - Controlar el bot (pausar/reanudar/logs)
app.post('/control', async (req, res) => {
  try {
    const { action } = req.body;
    const state = await loadBotState();
    
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
    await saveBotState(state);
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
    res.json({ results });
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
