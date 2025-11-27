import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'bot-state.json');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Función para leer config.json
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer config.json:', error.message);
    return {
      promptGlobal: "Eres un asistente útil y educado.",
      apiKeyGemini: "",
      gruposPermitidos: [],
      comandos: {}
    };
  }
}

// Función para guardar config.json
async function saveConfig(config) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
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

    // Validar y procesar datos
    const config = {
      ...existingConfig,
      promptGlobal: promptGlobal || "Eres un asistente útil y educado.",
      apiKeyGemini: apiKeyGemini || "",
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🌐 Panel web disponible en http://localhost:${PORT}`);
  console.log(`📝 Edita la configuración del bot desde el navegador`);
});
