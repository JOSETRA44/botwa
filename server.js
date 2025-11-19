const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

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
    const { promptGlobal, apiKeyGemini, gruposPermitidos, comandos } = req.body;

    // Validar y procesar datos
    const config = {
      promptGlobal: promptGlobal || "Eres un asistente útil y educado.",
      apiKeyGemini: apiKeyGemini || "",
      gruposPermitidos: [],
      comandos: {}
    };

    // Procesar grupos permitidos (separados por comas o saltos de línea)
    if (gruposPermitidos) {
      const grupos = gruposPermitidos
        .split(/[\n,]/)
        .map(g => g.trim())
        .filter(g => g.length > 0);
      config.gruposPermitidos = grupos;
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🌐 Panel web disponible en http://localhost:${PORT}`);
  console.log(`📝 Edita la configuración del bot desde el navegador`);
});
