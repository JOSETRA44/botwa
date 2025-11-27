import { DisconnectReason, downloadMediaMessage } from '@whiskeysockets/baileys';
import { loginWithQR } from './auth/loginQR.js';
import { loginWithPhone } from './auth/loginPhone.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Método de autenticación (QR o PHONE)
const LOGIN_METHOD = process.env.LOGIN_METHOD || 'QR';

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'bot-state.json');
let config = {};
let botState = {
  active: true,
  logsEnabled: false,
  messagesSentLastHour: 0,
  lastHourReset: Date.now()
};
let lastStateSave = Date.now();
const SAVE_INTERVAL = 300000; // Guardar cada 5 minutos

// Sistema de logs para el panel
let panelLogs = [];
const MAX_LOGS = 100; // Máximo 100 logs en memoria
const LOGS_PATH = path.join(__dirname, 'panel-logs.json');

async function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('es-ES');
  const logEntry = { timestamp, message, type };
  
  panelLogs.push(logEntry);
  
  // Mantener solo los últimos 100 logs
  if (panelLogs.length > MAX_LOGS) {
    panelLogs.shift();
  }
  
  // Guardar en archivo para que el panel pueda leerlos
  try {
    await fs.writeFile(LOGS_PATH, JSON.stringify(panelLogs, null, 2));
  } catch (error) {
    // Ignorar errores de escritura
  }
  
  // También mostrar en consola
  console.log(`[${timestamp}] ${message}`);
}

// Cargar logs existentes al iniciar
async function loadPanelLogs() {
  try {
    const data = await fs.readFile(LOGS_PATH, 'utf8');
    panelLogs = JSON.parse(data);
  } catch (error) {
    panelLogs = [];
  }
}

// Contador de mensajes por usuario (anti-spam)
const messageCount = new Map();
const MESSAGE_LIMIT = 10;
const TIME_WINDOW = 1000; // 1 segundo
const MAX_MESSAGES_PER_HOUR = 100; // Límite de seguridad

// Sistema de cola de mensajes por usuario (evita pérdida de mensajes)
const userQueues = new Map();
const GROUPING_DELAY = 3000; // 3 segundos para agrupar mensajes
const MAX_MESSAGES_IN_GROUP = 5; // Máximo 5 mensajes agrupados
const MAX_QUEUE_SIZE = 10; // Máximo 10 mensajes en cola

// Cargar configuración desde config.json
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf8');
    config = JSON.parse(data);
    if (botState.logsEnabled) console.log('✅ Configuración cargada correctamente');
    return config;
  } catch (error) {
    console.error('❌ Error al cargar config.json:', error.message);
    config = {
      promptGlobal: "Eres un asistente útil y educado.",
      apiKeyGemini: "",
      gruposPermitidos: [],
      gruposExcluidos: [],
      comandos: {},
      delayMin: 2000,
      delayMax: 5000
    };
    return config;
  }
}

// Cargar estado del bot
async function loadBotState() {
  try {
    const data = await fs.readFile(STATE_PATH, 'utf8');
    botState = { ...botState, ...JSON.parse(data) };
  } catch (error) {
    // Si no existe, usar valores por defecto
  }
}

// Guardar estado del bot
async function saveBotState(force = false) {
  try {
    const now = Date.now();
    // Guardar solo si han pasado 5 minutos O si es forzado (cambio manual)
    if (force || now - lastStateSave > SAVE_INTERVAL) {
      await fs.writeFile(STATE_PATH, JSON.stringify(botState, null, 2));
      lastStateSave = now;
      if (botState.logsEnabled) console.log('💾 Estado guardado');
    }
  } catch (error) {
    console.error('Error al guardar estado:', error.message);
  }
}

// Delay aleatorio para simular escritura humana
function randomDelay(min, max) {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
}

// Simular estado de "escribiendo..." en WhatsApp
async function simulateTyping(sock, remoteJid, durationMs = 3000) {
  try {
    // Enviar presencia de "escribiendo"
    await sock.sendPresenceUpdate('composing', remoteJid);
    
    // Mantener el estado por la duración especificada
    if (durationMs > 0) {
      await new Promise(resolve => setTimeout(resolve, durationMs));
    }
    
    // Volver a estado "disponible"
    await sock.sendPresenceUpdate('paused', remoteJid);
  } catch (error) {
    // Ignorar errores de presencia (no críticos)
    console.log('⚠️ No se pudo actualizar presencia:', error.message);
  }
}

// Detectar fórmulas LaTeX en el texto
function detectLatexFormulas(text) {
  const formulas = [];
  
  // Detectar fórmulas en bloque: $$...$$
  const blockRegex = /\$\$([\s\S]*?)\$\$/g;
  let match;
  
  while ((match = blockRegex.exec(text)) !== null) {
    formulas.push({
      type: 'block',
      latex: match[1].trim(),
      original: match[0],
      index: match.index
    });
  }
  
  // Detectar fórmulas inline: $...$
  const inlineRegex = /\$([^\$\n]+?)\$/g;
  
  while ((match = inlineRegex.exec(text)) !== null) {
    // Evitar detectar las ya encontradas en bloques
    const isInBlock = formulas.some(f => 
      match.index >= f.index && match.index < f.index + f.original.length
    );
    
    if (!isInBlock) {
      formulas.push({
        type: 'inline',
        latex: match[1].trim(),
        original: match[0],
        index: match.index
      });
    }
  }
  
  return formulas;
}

// Renderizar fórmula LaTeX como imagen usando CodeCogs API
async function renderLatexToImage(latex) {
  try {
    // Limpiar y codificar la fórmula
    const cleanLatex = latex.trim();
    const encodedLatex = encodeURIComponent(cleanLatex);
    
    // URL de CodeCogs (API gratuita, sin key necesaria)
    // Formato: png, tamaño: grande (300 DPI), color: negro
    const imageUrl = `https://latex.codecogs.com/png.latex?\\dpi{300}\\bg_white\\large ${encodedLatex}`;
    
    // Descargar la imagen
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Error al renderizar: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
    
  } catch (error) {
    console.error('❌ Error al renderizar LaTeX:', error.message);
    return null;
  }
}

// Procesar respuesta de IA con fórmulas LaTeX
async function processAIResponseWithFormulas(text, sock, remoteJid, quotedMsg) {
  try {
    // Detectar fórmulas en el texto
    const formulas = detectLatexFormulas(text);
    
    if (formulas.length === 0) {
      // No hay fórmulas, enviar texto normal
      await sock.sendMessage(remoteJid, { text }, { quoted: quotedMsg });
      return;
    }
    
    // Hay fórmulas, procesarlas
    console.log(`📐 Detectadas ${formulas.length} fórmula(s) LaTeX`);
    
    // Separar texto y fórmulas
    let currentIndex = 0;
    const parts = [];
    
    // Ordenar fórmulas por índice
    formulas.sort((a, b) => a.index - b.index);
    
    for (const formula of formulas) {
      // Agregar texto antes de la fórmula
      if (formula.index > currentIndex) {
        const textBefore = text.substring(currentIndex, formula.index);
        if (textBefore.trim()) {
          parts.push({ type: 'text', content: textBefore });
        }
      }
      
      // Agregar la fórmula
      parts.push({ type: 'formula', content: formula });
      
      currentIndex = formula.index + formula.original.length;
    }
    
    // Agregar texto después de la última fórmula
    if (currentIndex < text.length) {
      const textAfter = text.substring(currentIndex);
      if (textAfter.trim()) {
        parts.push({ type: 'text', content: textAfter });
      }
    }
    
    // Enviar partes en orden
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part.type === 'text') {
        // Enviar texto
        await sock.sendMessage(remoteJid, { 
          text: part.content.trim() 
        }, { quoted: quotedMsg });
        
      } else if (part.type === 'formula') {
        // Renderizar y enviar fórmula como imagen
        const imageBuffer = await renderLatexToImage(part.content.latex);
        
        if (imageBuffer) {
          await sock.sendMessage(remoteJid, {
            image: imageBuffer,
            caption: `📐 Fórmula: ${part.content.type === 'block' ? 'Ecuación' : 'Expresión'}`
          }, { quoted: quotedMsg });
        } else {
          // Si falla el renderizado, enviar como texto
          await sock.sendMessage(remoteJid, { 
            text: `📐 Fórmula:\n\`\`\`\n${part.content.latex}\n\`\`\`` 
          }, { quoted: quotedMsg });
        }
      }
      
      // Pequeño delay entre mensajes para mantener el orden
      if (i < parts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
  } catch (error) {
    console.error('❌ Error al procesar fórmulas:', error.message);
    // Si falla todo, enviar texto original
    await sock.sendMessage(remoteJid, { text }, { quoted: quotedMsg });
  }
}

// Resetear contador de mensajes por hora
function resetHourlyCounter() {
  const now = Date.now();
  if (now - botState.lastHourReset > 3600000) { // 1 hora
    botState.messagesSentLastHour = 0;
    botState.lastHourReset = now;
    saveBotState();
  }
}

// Verificar límite de mensajes por hora
function canSendMessage() {
  resetHourlyCounter();
  return botState.messagesSentLastHour < MAX_MESSAGES_PER_HOUR;
}

// Incrementar contador de mensajes
function incrementMessageCount() {
  botState.messagesSentLastHour++;
  // Guardar cada 10 mensajes o según intervalo de tiempo
  if (botState.messagesSentLastHour % 10 === 0) {
    saveBotState(true); // Forzar guardado cada 10 mensajes
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

// Obtener o crear cola de usuario
function getUserQueue(userId) {
  if (!userQueues.has(userId)) {
    userQueues.set(userId, {
      messages: [],        // Buffer temporal de mensajes
      processing: false,   // ¿Está procesando actualmente?
      timeout: null,       // Timer para agrupar mensajes
      lastMessage: Date.now()
    });
  }
  return userQueues.get(userId);
}

// Agregar mensaje a la cola del usuario
function addMessageToQueue(userId, messageData) {
  const queue = getUserQueue(userId);
  
  // Verificar límite de cola
  if (queue.messages.length >= MAX_QUEUE_SIZE) {
    return false; // Cola llena
  }
  
  // Agregar mensaje al buffer
  queue.messages.push(messageData);
  queue.lastMessage = Date.now();
  
  return true;
}

// Procesar cola de mensajes del usuario
async function processUserQueue(userId, sock) {
  const queue = getUserQueue(userId);
  
  // Si ya está procesando, no hacer nada
  if (queue.processing) {
    return;
  }
  
  // Si no hay mensajes, limpiar timeout y salir
  if (queue.messages.length === 0) {
    if (queue.timeout) {
      clearTimeout(queue.timeout);
      queue.timeout = null;
    }
    return;
  }
  
  // Marcar como procesando
  queue.processing = true;
  
  try {
    // Obtener mensajes del buffer (máximo MAX_MESSAGES_IN_GROUP)
    const messagesToProcess = queue.messages.splice(0, MAX_MESSAGES_IN_GROUP);
    
    if (messagesToProcess.length === 0) {
      queue.processing = false;
      return;
    }
    
    // Obtener datos del primer mensaje
    const firstMsg = messagesToProcess[0];
    const remoteJid = firstMsg.remoteJid;
    const isGroup = firstMsg.isGroup;
    
    // Verificar límite de mensajes por hora
    if (!canSendMessage()) {
      if (botState.logsEnabled) addLog('⚠️ Límite de mensajes por hora alcanzado', 'warning');
      queue.processing = false;
      return;
    }
    
    // Construir mensaje agrupado
    let combinedMessage = '';
    if (messagesToProcess.length === 1) {
      // Un solo mensaje
      combinedMessage = messagesToProcess[0].text;
    } else {
      // Múltiples mensajes - agrupar con contexto
      combinedMessage = messagesToProcess.map((msg, idx) => {
        return `Mensaje ${idx + 1}: ${msg.text}`;
      }).join('\n');
    }
    
    if (botState.logsEnabled) {
      const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
      addLog(`🔄 ${tipo} Procesando ${messagesToProcess.length} mensaje(s) agrupado(s)`, 'info');
    }
    
    // Delay aleatorio antes de responder (simular escritura humana)
    const delayMin = config.delayMin || 2000;
    const delayMax = config.delayMax || 5000;
    await randomDelay(delayMin, delayMax);
    
    // Mostrar estado "escribiendo..." mientras consulta Gemini
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    // Respuesta con Gemini citando el último mensaje
    const respuesta = await callGemini(combinedMessage);
    const lastMsg = messagesToProcess[messagesToProcess.length - 1].msg; // Último mensaje para citar
    
    await typingPromise;
    
    // Procesar respuesta con soporte para fórmulas LaTeX
    await processAIResponseWithFormulas(respuesta, sock, remoteJid, lastMsg);
    
    incrementMessageCount();
    if (botState.logsEnabled) {
      const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
      addLog(`✅ ${tipo} Respuesta enviada (${botState.messagesSentLastHour}/${MAX_MESSAGES_PER_HOUR} esta hora)`, 'success');
    }
    
  } catch (error) {
    console.error('❌ Error al procesar cola:', error.message);
  } finally {
    // Marcar como no procesando
    queue.processing = false;
    
    // Si hay más mensajes en la cola, programar siguiente procesamiento
    if (queue.messages.length > 0) {
      // Cancelar timeout anterior si existe
      if (queue.timeout) {
        clearTimeout(queue.timeout);
      }
      
      // Programar procesamiento de siguientes mensajes
      queue.timeout = setTimeout(() => {
        processUserQueue(userId, sock);
      }, GROUPING_DELAY);
    }
  }
}



// Buscar imagen en Google Custom Search
async function searchGoogleImage(query) {
  if (!config.googleSearch || !config.googleSearch.apiKey) {
    return { error: 'API de Google no configurada' };
  }

  try {
    const apiKey = config.googleSearch.apiKey;
    const searchEngineId = config.googleSearch.searchEngineId;
    // SafeSearch: false = sin censura, true = con censura
    const safeSearch = config.googleSearch.safeSearch !== false ? 'active' : 'off';
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&searchType=image&num=1&safe=${safeSearch}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      if (response.status === 429) {
        return { error: 'Límite de búsquedas de Google alcanzado (100/día). Intenta mañana o usa /gg' };
      }
      throw new Error(`Error de API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return { error: 'No se encontraron imágenes' };
    }
    
    const image = data.items[0];
    
    return {
      url: image.link,
      title: image.title,
      source: image.displayLink,
      thumbnail: image.image.thumbnailLink
    };
    
  } catch (error) {
    console.error('❌ Error al buscar en Google:', error.message);
    return { error: 'Error al buscar imagen. Intenta de nuevo.' };
  }
}

// Buscar imagen en Unsplash
async function searchUnsplashImage(query) {
  if (!config.unsplash || !config.unsplash.accessKey) {
    return { error: 'API de Unsplash no configurada' };
  }

  try {
    const accessKey = config.unsplash.accessKey;
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&client_id=${accessKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return { error: 'No se encontraron imágenes' };
    }
    
    const image = data.results[0];
    
    return {
      url: image.urls.regular,
      description: image.description || image.alt_description || query,
      author: image.user.name,
      authorUrl: image.user.links.html,
      downloadUrl: image.links.download_location
    };
    
  } catch (error) {
    console.error('❌ Error al buscar en Unsplash:', error.message);
    return { error: 'Error al buscar imagen. Intenta de nuevo.' };
  }
}

// Analizar imagen con Gemini Vision
async function analyzeImageWithGemini(imageBuffer, question = '') {
  if (!config.geminiVision || !config.geminiVision.apiKey) {
    return '⚠️ API de Gemini Vision no configurada.';
  }

  try {
    const apiKey = config.geminiVision.apiKey;
    const model = config.geminiVision.model || 'gemini-2.5-flash';
    
    // Convertir buffer a base64
    const base64Image = imageBuffer.toString('base64');
    
    // Prompt por defecto o personalizado
    const prompt = question || 'Describe esta imagen en detalle. Menciona objetos, colores, personas, texto visible, y cualquier detalle relevante.';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
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
    
    return 'No pude analizar la imagen. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al analizar imagen:', error.message);
    return '❌ Error al analizar la imagen. Verifica tu API Key de Gemini Vision.';
  }
}

// Llamar a la API de Grok (xAI)
async function callGrok(userMessage) {
  if (!config.grok || !config.grok.apiKey) {
    return '⚠️ API de Grok no configurada.';
  }

  try {
    const apiKey = config.grok.apiKey;
    const model = config.grok.model || 'grok-beta';
    
    const response = await fetch(
      'https://api.x.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: config.promptGlobal || 'Eres un asistente útil.'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: model,
          stream: false,
          temperature: 0.7
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    
    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a Grok:', error.message);
    return '❌ Error al conectar con Grok. Verifica tu API Key.';
  }
}

// Llamar a la API de ChatGPT (OpenAI)
async function callChatGPT(userMessage) {
  if (!config.openai || !config.openai.apiKey) {
    return '⚠️ API de ChatGPT no configurada.';
  }

  try {
    const apiKey = config.openai.apiKey;
    const model = config.openai.model || 'gpt-4o-mini';
    
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: config.promptGlobal || 'Eres un asistente útil.'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: model,
          temperature: 0.7,
          max_tokens: 1000
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error de API: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    
    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a ChatGPT:', error.message);
    return '❌ Error al conectar con ChatGPT. Verifica tu API Key.';
  }
}

// Llamar a la API de Gemini
async function callGemini(userMessage) {
  if (!config.apiKeyGemini || config.apiKeyGemini.trim() === '') {
    return 'La API Key de Gemini no está configurada. Por favor, configúrala en el panel web.';
  }

  try {
    const prompt = `${config.promptGlobal}\n\nUsuario: ${userMessage}`;
    
    // Usar gemini-1.5-flash (más rápido y económico) o gemini-1.5-pro
    const model = config.geminiModel || 'gemini-1.5-flash';
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKeyGemini}`,
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
async function processCommand(command, message, sock, remoteJid, msg = null) {
  const cmd = command.toLowerCase();
  
  // Comandos especiales con IA
  if (cmd === '/menu') {
    const isGroup = remoteJid.endsWith('@g.us');
    
    let menu = `🎯 *MENÚ DEL BOT* 🎯\n\n`;
    
    // Explicar cómo usar el bot
    if (isGroup) {
      menu += `💬 *En Grupos:*\n`;
      menu += `• Menciona @bot para usar IA\n`;
      menu += `• Usa / para comandos\n\n`;
    } else {
      menu += `💬 *En Chats Privados:*\n`;
      menu += `• Escribe normalmente (uso IA)\n`;
      menu += `• Usa / para comandos\n\n`;
    }
    
    menu += `🤖 *Comandos con IA:*\n`;
    menu += `• /pregunta [texto] - Gemini\n`;
    menu += `• /elon [texto] - Grok (xAI)\n`;
    menu += `• /sora [texto] - ChatGPT (OpenAI)\n`;
    menu += `• /resumen [texto] - Resume texto\n`;
    menu += `• /analizar - Analiza una imagen\n\n`;
    
    menu += `🎨 *Utilidades:*\n`;
    menu += `• /s - Convierte en sticker\n`;
    menu += `• /guardar - Guarda View Once\n\n`;
    
    menu += `🖼️ *Búsqueda de Imágenes:*\n`;
    menu += `• /gg [búsqueda] - Fotos profesionales\n`;
    menu += `• /go [búsqueda] - Buscar en Google\n\n`;
    
    // Comandos simples
    const comandosSimples = Object.entries(config.comandosSimples || {});
    if (comandosSimples.length > 0) {
      menu += `📝 *Comandos Rápidos:*\n`;
      comandosSimples.forEach(([cmd]) => {
        menu += `• ${cmd}\n`;
      });
      menu += `\n`;
    }
    
    menu += `❓ *Ayuda:*\n`;
    menu += `• /ayuda - Lista detallada\n\n`;
    menu += `✨ _¡Estoy aquí para ayudarte!_ ✨`;
    
    await sock.sendMessage(remoteJid, { text: menu }, { quoted: msg });
    return;
  }
  
  if (cmd === '/ayuda') {
    const comandosLista = Object.entries(config.comandos || {})
      .map(([c, d]) => `${c} - ${d}`)
      .join('\n');
    
    const comandosSimples = Object.entries(config.comandosSimples || {})
      .map(([c]) => `${c}`)
      .join('\n');
    
    let respuesta = `🤖 *Comandos disponibles:*\n\n`;
    if (comandosLista) respuesta += `${comandosLista}\n`;
    if (comandosSimples) respuesta += `\n📝 *Comandos simples:*\n${comandosSimples}\n`;
    respuesta += `\n_Configurado desde el panel web_`;
    
    await sock.sendMessage(remoteJid, { text: respuesta }, { quoted: msg });
    return;
  }
  
  if (cmd === '/gg') {
    const query = message.replace('/gg', '').trim();
    if (!query) {
      await sock.sendMessage(remoteJid, { 
        text: '⚠️ Uso: /gg [búsqueda]\n\n📝 Ejemplos:\n• /gg gato\n• /gg montaña\n• /gg playa\n• /gg café\n\n💡 Busca paisajes, animales, objetos, etc.' 
      }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras busca
    await simulateTyping(sock, remoteJid, 2000); // 2 segundos
    
    // Buscar imagen
    const result = await searchUnsplashImage(query);
    
    if (result.error) {
      await sock.sendMessage(remoteJid, { 
        text: `❌ ${result.error}\n\n💡 Intenta con:\n• Palabras más generales\n• En inglés (ej: "cat" en vez de "gato")\n• Conceptos simples: paisajes, animales, objetos` 
      }, { quoted: msg });
      return;
    }
    
    // Enviar imagen con validación
    try {
      await sock.sendMessage(remoteJid, {
        image: { url: result.url },
        caption: `📸 ${result.description}\n\n👤 Foto por: ${result.author}\n🔗 Unsplash.com\n\n💡 Usa /gg [búsqueda] para más imágenes`
      }, { quoted: msg });
      
      if (botState.logsEnabled) addLog(`📸 Imagen enviada: "${query}"`, 'success');
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: '❌ Error al enviar la imagen. La URL puede estar rota. Intenta de nuevo.' 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error enviando imagen: ${error.message}`, 'error');
    }
    
    return;
  }
  
  if (cmd === '/go') {
    const query = message.replace('/go', '').trim();
    if (!query) {
      await sock.sendMessage(remoteJid, { 
        text: '⚠️ Uso: /go [búsqueda]\n\n📝 Ejemplos:\n• /go logo python\n• /go meme gato\n• /go bandera peru\n• /go captura vscode\n\n💡 Busca cualquier cosa en Google Images\n\n🔄 Diferencia:\n• /gg → Fotos profesionales (Unsplash)\n• /go → Todo lo demás (Google)' 
      }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras busca
    await simulateTyping(sock, remoteJid, 2000); // 2 segundos
    
    // Buscar imagen en Google
    const result = await searchGoogleImage(query);
    
    if (result.error) {
      await sock.sendMessage(remoteJid, { 
        text: `❌ ${result.error}\n\n💡 Intenta con:\n• Palabras diferentes\n• En inglés\n• Usa /gg para fotos profesionales` 
      }, { quoted: msg });
      return;
    }
    
    // Enviar imagen con validación
    try {
      // Intentar con la URL principal
      try {
        await sock.sendMessage(remoteJid, {
          image: { url: result.url },
          caption: `🔍 ${result.title}\n\n🌐 Fuente: ${result.source}\n🔗 Google Images\n\n💡 Usa /go [búsqueda] para más imágenes`
        }, { quoted: msg });
        
        if (botState.logsEnabled) addLog(`🔍 Imagen de Google enviada: "${query}"`, 'success');
        
      } catch (imgError) {
        // Si falla, intentar con thumbnail
        if (result.thumbnail) {
          await sock.sendMessage(remoteJid, {
            image: { url: result.thumbnail },
            caption: `🔍 ${result.title}\n\n🌐 Fuente: ${result.source}\n🔗 Google Images (thumbnail)\n\n💡 Usa /go [búsqueda] para más imágenes`
          }, { quoted: msg });
          
          if (botState.logsEnabled) addLog(`🔍 Imagen thumbnail enviada: "${query}"`, 'success');
        } else {
          throw imgError;
        }
      }
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: '❌ Error al enviar la imagen. La URL puede estar rota. Intenta otra búsqueda.' 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error enviando imagen de Google: ${error.message}`, 'error');
    }
    
    return;
  }
  
  if (cmd === '/analizar') {
    // Extraer pregunta opcional
    const question = message.replace('/analizar', '').trim();
    
    // Buscar imagen en el mensaje actual o en el mensaje citado
    const imageMessage = msg.message?.imageMessage || 
                        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
    
    if (!imageMessage) {
      await sock.sendMessage(remoteJid, { 
        text: '⚠️ Envía una imagen con /analizar o responde a una imagen con /analizar\n\n📝 Ejemplos:\n• [Envía imagen] /analizar\n• [Responde a imagen] /analizar\n• [Envía imagen] /analizar ¿qué raza es?' 
      }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras analiza
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    try {
      // Descargar imagen
      const buffer = await downloadMediaMessage(msg, 'buffer', {});
      
      // Analizar con Gemini Vision
      const analysis = await analyzeImageWithGemini(buffer, question);
      
      await typingPromise;
      
      // Enviar análisis citando el mensaje original
      await sock.sendMessage(remoteJid, { 
        text: `🔍 *Análisis de Imagen:*\n\n${analysis}\n\n💡 Usa /analizar [pregunta] para análisis específico` 
      }, { quoted: msg });
      
      if (botState.logsEnabled) addLog(`🔍 Imagen analizada`, 'success');
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: '❌ Error al analizar la imagen. Intenta de nuevo.' 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error analizando imagen: ${error.message}`, 'error');
    }
    
    return;
  }
  
  if (cmd === '/guardar') {
    // Eliminado mensaje de estado "Buscando..."
    
    try {
      // Intentar obtener el mensaje citado completo
      let targetMsg = msg;
      
      // Si es una respuesta, obtener el mensaje citado
      if (msg.message?.extendedTextMessage?.contextInfo) {
        const contextInfo = msg.message.extendedTextMessage.contextInfo;
        
        // Buscar View Once en el mensaje citado
        const quotedMsg = contextInfo.quotedMessage;
        
        if (quotedMsg) {
          // Crear un mensaje temporal con el contenido citado
          targetMsg = {
            key: msg.key,
            message: quotedMsg
          };
        }
      }
      
      // Verificar si es View Once (puede venir como viewOnceMessage o como imageMessage con viewOnce: true)
      const isViewOnceWrapper = targetMsg.message?.viewOnceMessageV2 || 
                               targetMsg.message?.viewOnceMessage;
      
      const isViewOnceImage = targetMsg.message?.imageMessage?.viewOnce === true;
      
      const isViewOnce = isViewOnceWrapper || isViewOnceImage;
      
      if (!isViewOnce) {
        await sock.sendMessage(remoteJid, { 
          text: '⚠️ No se detectó imagen View Once.\n\n💡 Responde a una imagen View Once con /guardar\n\n🔍 Debug: Imagen normal detectada (no View Once)' 
        }, { quoted: msg });
        
        // Log para debug
        if (botState.logsEnabled) {
          const msgTypes = Object.keys(targetMsg.message || {});
          const hasViewOnce = targetMsg.message?.imageMessage?.viewOnce;
          addLog(`🔍 Tipos: ${msgTypes.join(', ')}, viewOnce: ${hasViewOnce}`, 'info');
        }
        return;
      }
      
      // Eliminado mensaje de estado "Descargando..."
      
      // Descargar la imagen View Once
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
      
      // Reenviar la imagen (ya no es View Once) citando el mensaje original
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: '💾 Imagen View Once guardada\n\n💡 Usa /analizar para analizarla con IA'
      }, { quoted: msg });
      
      if (botState.logsEnabled) addLog(`💾 Imagen View Once guardada y reenviada`, 'success');
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: `❌ Error: ${error.message}\n\n💡 La imagen puede haberse borrado o el formato no es compatible` 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error guardando View Once: ${error.message}`, 'error');
    }
    
    return;
  }
  
  if (cmd === '/s') {
    // Mostrar estado "escribiendo..." mientras crea el sticker
    await simulateTyping(sock, remoteJid, 1500); // 1.5 segundos
    
    try {
      // Intentar obtener el mensaje con imagen/video
      let targetMsg = msg;
      
      // Si es una respuesta, obtener el mensaje citado
      if (msg.message?.extendedTextMessage?.contextInfo) {
        const contextInfo = msg.message.extendedTextMessage.contextInfo;
        const quotedMsg = contextInfo.quotedMessage;
        
        if (quotedMsg) {
          targetMsg = {
            key: msg.key,
            message: quotedMsg
          };
        }
      }
      
      // Verificar si hay imagen o video
      const hasImage = targetMsg.message?.imageMessage;
      const hasVideo = targetMsg.message?.videoMessage;
      
      if (!hasImage && !hasVideo) {
        await sock.sendMessage(remoteJid, { 
          text: '⚠️ No se detectó imagen o video.\n\n💡 Responde a una imagen/video con /s' 
        });
        return;
      }
      
      // Descargar media
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
      
      // Procesar imagen para sticker (512x512, webp)
      let stickerBuffer;
      
      if (hasImage) {
        // Procesar imagen con sharp
        stickerBuffer = await sharp(buffer)
          .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .webp()
          .toBuffer();
      } else {
        // Para videos, usar el buffer directamente (Baileys lo maneja)
        stickerBuffer = buffer;
      }
      
      // Enviar como sticker citando el mensaje original
      await sock.sendMessage(remoteJid, {
        sticker: stickerBuffer
      }, { quoted: msg });
      
      if (botState.logsEnabled) addLog(`🎨 Sticker creado y enviado`, 'success');
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: `❌ Error al crear sticker: ${error.message}\n\n💡 Asegúrate de que sea una imagen o video corto` 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error creando sticker: ${error.message}`, 'error');
    }
    
    return;
  }
  
  if (cmd === '/elon') {
    const texto = message.replace('/elon', '').trim();
    if (!texto) {
      await sock.sendMessage(remoteJid, { text: '⚠️ Envía tu pregunta después del comando /elon\n\nEjemplo: /elon ¿Qué opinas de los coches eléctricos?' }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras consulta la IA
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    const respuesta = await callGrok(texto);
    
    await typingPromise;
    
    // Procesar respuesta con soporte para fórmulas LaTeX
    const respuestaConEncabezado = `🤖 *Grok (xAI):*\n\n${respuesta}`;
    await processAIResponseWithFormulas(respuestaConEncabezado, sock, remoteJid, msg);
    return;
  }
  
  if (cmd === '/sora') {
    const texto = message.replace('/sora', '').trim();
    if (!texto) {
      await sock.sendMessage(remoteJid, { text: '⚠️ Envía tu pregunta después del comando /sora\n\nEjemplo: /sora ¿Cómo funciona la inteligencia artificial?' }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras consulta la IA
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    const respuesta = await callChatGPT(texto);
    
    await typingPromise;
    
    // Procesar respuesta con soporte para fórmulas LaTeX
    const respuestaConEncabezado = `🤖 *ChatGPT (OpenAI):*\n\n${respuesta}`;
    await processAIResponseWithFormulas(respuestaConEncabezado, sock, remoteJid, msg);
    return;
  }
  
  if (cmd === '/pregunta') {
    const texto = message.replace('/pregunta', '').trim();
    if (!texto) {
      await sock.sendMessage(remoteJid, { text: '⚠️ Envía tu pregunta después del comando /pregunta\n\nEjemplo: /pregunta ¿Cómo estás?' }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras consulta la IA
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    const respuesta = await callGemini(texto);
    
    await typingPromise;
    
    // Procesar respuesta con soporte para fórmulas LaTeX
    await processAIResponseWithFormulas(respuesta, sock, remoteJid, msg);
    return;
  }
  
  if (cmd === '/resumen') {
    const texto = message.replace('/resumen', '').trim();
    if (!texto) {
      await sock.sendMessage(remoteJid, { text: '⚠️ Envía un texto después del comando /resumen' }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras procesa
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    const respuesta = await callGemini(`Resume el siguiente texto de forma concisa: ${texto}`);
    
    await typingPromise;
    
    // Procesar respuesta con soporte para fórmulas LaTeX
    await processAIResponseWithFormulas(respuesta, sock, remoteJid, msg);
    return;
  }
  
  // Comandos simples (sin IA)
  if (config.comandosSimples && config.comandosSimples[cmd]) {
    const respuesta = config.comandosSimples[cmd];
    await sock.sendMessage(remoteJid, { text: respuesta }, { quoted: msg });
    return;
  }
  
  // Comandos con IA (descripción)
  if (config.comandos && config.comandos[cmd]) {
    const description = config.comandos[cmd];
    await sock.sendMessage(remoteJid, { text: `ℹ️ ${description}` }, { quoted: msg });
    return;
  }
  
  // Comando no encontrado
  await sock.sendMessage(remoteJid, { text: '❌ Comando no reconocido. Usa /ayuda para ver los comandos disponibles.' }, { quoted: msg });
}

// Iniciar bot de WhatsApp
async function startBot() {
  await loadConfig();
  await loadBotState();
  await loadPanelLogs();
  
  console.log(`\n🔐 Método de autenticación: ${LOGIN_METHOD}`);
  console.log('═'.repeat(60));
  
  // Seleccionar método de autenticación
  if (LOGIN_METHOD === 'PHONE') {
    // Autenticación con Pairing Code
    await loginWithPhone(
      (socket) => setupBotHandlers(socket),
      (code) => addLog(`🔑 Código de emparejamiento: ${code}`, 'info'),
      () => addLog('❌ Sesión cerrada', 'error')
    );
  } else {
    // Autenticación con QR (por defecto)
    await loginWithQR(
      (socket) => setupBotHandlers(socket),
      () => addLog('📱 QR generado - Escanea con WhatsApp', 'info'),
      () => addLog('❌ Sesión cerrada', 'error')
    );
  }
}

// Configurar manejadores de eventos del bot
function setupBotHandlers(sock) {
  if (!sock || !sock.ev) {
    console.error('❌ Socket no válido');
    return;
  }
  
  console.log('✅ Configurando manejadores de eventos...');

  sock.ev.on('messages.upsert', async ({ messages }) => {
    try {
      const msg = messages[0];
      
      if (!msg.message || msg.key.fromMe) return;
      
      // Verificar si el bot está activo
      await loadBotState();
      if (!botState.active) {
        if (botState.logsEnabled) addLog('⏸️ Bot pausado, mensaje ignorado', 'info');
        return;
      }
      
      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid.endsWith('@g.us');
      const messageText = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || '';
      
      if (!messageText.trim()) return;
      
      // Detectar si es una respuesta a un mensaje (quoted message)
      const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let contextText = '';
      
      if (quotedMessage) {
        // Extraer texto del mensaje citado
        const quotedText = quotedMessage.conversation || 
                          quotedMessage.extendedTextMessage?.text || 
                          quotedMessage.imageMessage?.caption ||
                          '';
        
        if (quotedText) {
          contextText = `[Respondiendo a: "${quotedText.substring(0, 100)}${quotedText.length > 100 ? '...' : ''}"]`;
          if (botState.logsEnabled) addLog(`🔗 Mensaje con contexto detectado`, 'info');
        }
      }
      
      // Verificar si es grupo
      if (isGroup) {
        // Verificar lista negra (excluidos)
        if (config.gruposExcluidos && config.gruposExcluidos.includes(remoteJid)) {
          addLog(`🚫 [GRUPO] En lista negra: ${remoteJid}`, 'warning');
          return;
        }
        
        // Verificar lista blanca (permitidos)
        if (!config.gruposPermitidos || !config.gruposPermitidos.includes(remoteJid)) {
          addLog(`⚠️ [GRUPO] No permitido: ${remoteJid}`, 'warning');
          return;
        }
      } else {
        // Es un contacto individual
        if (botState.logsEnabled) addLog(`👤 [CONTACTO] Mensaje de: ${remoteJid}`, 'info');
      }
      
      // Anti-spam
      const userId = msg.key.participant || remoteJid;
      if (isSpam(userId)) {
        if (botState.logsEnabled) addLog(`⚠️ Usuario bloqueado por spam: ${userId}`, 'warning');
        return;
      }
      
      // Procesar comandos PRIMERO (siempre con /)
      // Los comandos funcionan en cualquier grupo/chat sin restricciones
      if (messageText.startsWith('/')) {
        if (botState.logsEnabled) {
          const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
          addLog(`⚡ ${tipo} Comando: ${messageText.split(' ')[0]}`, 'info');
        }
        await processCommand(messageText.split(' ')[0], messageText, sock, remoteJid, msg);
        incrementMessageCount();
        return;
      }
      
      // Verificar límite de mensajes por hora (solo para mensajes normales, no comandos)
      if (!canSendMessage()) {
        if (botState.logsEnabled) addLog('⚠️ Límite de mensajes por hora alcanzado', 'warning');
        return;
      }
      
      if (botState.logsEnabled) {
        const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
        addLog(`📩 ${tipo} Mensaje: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`, 'info');
      }
      
      // SISTEMA HÍBRIDO:
      // - En GRUPOS: Solo responde si mencionan @bot
      // - En CHATS PRIVADOS: Responde a todo
      
      let shouldRespond = false;
      let cleanMessage = messageText;
      
      if (isGroup) {
        // En grupos: Responder si mencionan @bot O si responden a un mensaje del bot
        const botMentions = ['@bot', 'bot:', 'bot,', 'bot '];
        const lowerMessage = messageText.toLowerCase();
        
        // Verificar menciones
        for (const mention of botMentions) {
          if (lowerMessage.includes(mention)) {
            shouldRespond = true;
            // Limpiar el mensaje quitando la mención
            cleanMessage = messageText.replace(new RegExp(mention, 'gi'), '').trim();
            if (botState.logsEnabled) addLog(`🤖 [GRUPO] Bot mencionado con: ${mention}`, 'info');
            break;
          }
        }
        
        // Si no mencionó @bot, verificar si está respondiendo al bot
        if (!shouldRespond && quotedMessage) {
          // En grupos, verificar si el mensaje citado es del bot (key.fromMe)
          const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
          const quotedKey = contextInfo?.stanzaId;
          
          // El mensaje es del bot si participant es undefined o si fromMe es true
          const isQuotingBot = contextInfo?.participant === undefined || 
                              contextInfo?.fromMe === true ||
                              !contextInfo?.participant; // En algunos casos participant no existe si es del bot
          
          if (isQuotingBot) {
            shouldRespond = true;
            if (botState.logsEnabled) addLog(`🔗 [GRUPO] Respondiendo a mensaje del bot (quoted)`, 'info');
          }
        }
        
        if (!shouldRespond) {
          if (botState.logsEnabled) addLog(`⏭️ [GRUPO] Mensaje ignorado (no mencionó @bot ni respondió al bot)`, 'info');
          return;
        }
      } else {
        // En chats privados: Responder a todo
        shouldRespond = true;
        if (botState.logsEnabled) addLog(`💬 [CONTACTO] Respondiendo automáticamente`, 'info');
      }
      
      // Si debe responder, agregar a cola de mensajes
      if (shouldRespond) {
        const userId = msg.key.participant || remoteJid;
        
        // Construir mensaje con contexto si existe
        const fullMessage = contextText ? `${contextText}\n\n${cleanMessage}` : cleanMessage;
        
        // Agregar mensaje a la cola del usuario
        const added = addMessageToQueue(userId, {
          text: fullMessage,
          remoteJid: remoteJid,
          isGroup: isGroup,
          timestamp: Date.now(),
          msg: msg  // Agregar el mensaje original para poder citarlo
        });
        
        if (!added) {
          // Cola llena - avisar al usuario
          await sock.sendMessage(remoteJid, { 
            text: '⚠️ Por favor espera a que responda tus mensajes anteriores antes de enviar más.' 
          });
          if (botState.logsEnabled) addLog(`⚠️ Cola llena para usuario: ${userId}`, 'warning');
          return;
        }
        
        const queue = getUserQueue(userId);
        
        // Si ya hay un timeout activo, cancelarlo
        if (queue.timeout) {
          clearTimeout(queue.timeout);
        }
        
        // Programar procesamiento después del delay de agrupación
        queue.timeout = setTimeout(() => {
          processUserQueue(userId, sock);
        }, GROUPING_DELAY);
        
        if (botState.logsEnabled) {
          const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
          addLog(`📝 ${tipo} Mensaje agregado a cola (${queue.messages.length} en buffer)`, 'info');
        }
      }
      
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
