const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs').promises;
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {};

// Contador de mensajes por usuario (anti-spam)
const messageCount = new Map();
const MESSAGE_LIMIT = 10;
const TIME_WINDOW = 1000; // 1 segundo

// Cargar configuración desde config.json
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    config = JSON.parse(data);
    console.log('✅ Configuración cargada correctamente');
    return config;
  } catch (error) {
    console.error('❌ Error al cargar config.json:', error.message);
    config = {
      promptGlobal: "Eres un asistente útil y educado.",
      apiKeyGemini: "",
      gruposPermitidos: [],
      comandos: {}
    };
    return config;
  }
}

// Verificar anti-spam
function isSpam(userId) {
  const now = Date.now();
  const userMessages = messageCount.get(userId) || [];
  
  // Filtrar mensajes dentro de la ventana de tiempo
  const recentMessages = userMessages.filter(timestamp => now - timestamp < TIME_WINDOW);
  
  if (recentMessages.length >= MESSAGE_LIMIT) {
    return true;
  }
  
  recentMessages.push(now);
  messageCount.set(userId, recentMessages);
  return false;
}

// Llamar a la API de Gemini
async function callGemini(userMessage) {
  if (!config.apiKeyGemini || config.apiKeyGemini.trim() === '') {
    return 'La API Key de Gemini no está configurada. Por favor, configúrala en el panel web.';
  }

  try {
    const prompt = `${config.promptGlobal}\n\nUsuario: ${userMessage}`;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.apiKeyGemini}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a Gemini:', error.message);
    return 'Error al conectar con Gemini. Verifica tu API Key.';
  }
}

// Procesar comandos
async function processCommand(command, message, sock, remoteJid) {
  const cmd = command.toLowerCase();
  
  if (config.comandos && config.comandos[cmd]) {
    const description = config.comandos[cmd];
    
    // Comandos especiales
    if (cmd === '/ayuda') {
      const comandosLista = Object.entries(config.comandos)
        .map(([c, d]) => `${c} - ${d}`)
        .join('\n');
      
      const respuesta = `🤖 *Comandos disponibles:*\n\n${comandosLista}\n\n_Configurado desde el panel web_`;
      await sock.sendMessage(remoteJid, { text: respuesta });
      return;
    }
    
    if (cmd === '/resumen') {
      const texto = message.replace('/resumen', '').trim();
      if (!texto) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Envía un texto después del comando /resumen' });
        return;
      }
      
      const respuesta = await callGemini(`Resume el siguiente texto de forma concisa: ${texto}`);
      await sock.sendMessage(remoteJid, { text: respuesta });
      return;
    }
    
    // Comando genérico
    await sock.sendMessage(remoteJid, { text: `ℹ️ ${description}` });
  } else {
    await sock.sendMessage(remoteJid, { text: '❌ Comando no reconocido. Usa /ayuda para ver los comandos disponibles.' });
  }
}

// Iniciar bot de WhatsApp
async function startBot() {
  await loadConfig();
  
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;
      
      console.log('❌ Conexión cerrada. Reconectando:', shouldReconnect);
      
      if (shouldReconnect) {
        setTimeout(() => startBot(), 3000);
      }
    } else if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      
      if (!msg.message || msg.key.fromMe) return;
      
      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const messageText = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || '';
      
      if (!messageText.trim()) return;
      
      // Verificar si es grupo y si está permitido
      if (isGroup) {
        if (!config.gruposPermitidos || !config.gruposPermitidos.includes(remoteJid)) {
          console.log(`⚠️ Mensaje ignorado de grupo no permitido: ${remoteJid}`);
          return;
        }
      }
      
      // Anti-spam
      const userId = msg.key.participant || remoteJid;
      if (isSpam(userId)) {
        console.log(`⚠️ Usuario bloqueado por spam: ${userId}`);
        return;
      }
      
      console.log(`📩 Mensaje recibido: ${messageText}`);
      
      // Procesar comandos
      if (messageText.startsWith('/')) {
        await processCommand(messageText.split(' ')[0], messageText, sock, remoteJid);
        return;
      }
      
      // Respuesta con Gemini
      const respuesta = await callGemini(messageText);
      await sock.sendMessage(remoteJid, { text: respuesta });
      
    } catch (error) {
      console.error('❌ Error al procesar mensaje:', error.message);
    }
  });
}

// Manejo de errores globales
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada:', error.message);
});

// Iniciar el bot
console.log('🚀 Iniciando WhatsApp Bot...');
startBot();
