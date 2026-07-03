import 'dotenv/config';
import { DisconnectReason, downloadMediaMessage, jidNormalizedUser } from '@whiskeysockets/baileys';
import { loginWithQR } from './auth/loginQR.js';
import { loginWithPhone } from './auth/loginPhone.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import sharp from 'sharp';
import * as rag from './rag.js';
import { appLogger } from './logger.js';
import {
  DEFAULT_CONFIG,
  loadConfig as loadConfigFile,
  loadBotState as loadBotStateFile,
  saveBotState as saveBotStateFile,
  loadPanelLogs as loadPanelLogsFile,
  addPanelLog
} from './shared/store.js';
import { GeminiRateLimitError, makeGeminiLimiter } from './providers/geminiLimiter.js';
import * as geminiProvider from './providers/gemini.js';
import { callGrok as callGrokProvider } from './providers/grok.js';
import { callChatGPT as callChatGPTProvider } from './providers/chatgpt.js';

// Re-exportados para que test/geminiLimiter.test.js siga importando desde
// bot.js sin cambios (la lógica en sí vive en providers/geminiLimiter.js).
export { GeminiRateLimitError, makeGeminiLimiter };

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
const lastStateSaveRef = { value: Date.now() };
const SAVE_INTERVAL = 300000; // Guardar cada 5 minutos

// Sistema de logs para el panel
let panelLogs = [];
const MAX_LOGS = 100; // Máximo 100 logs en memoria
const LOGS_PATH = path.join(__dirname, 'panel-logs.json');

async function addLog(message, type = 'info') {
  panelLogs = await addPanelLog(LOGS_PATH, panelLogs, message, type, MAX_LOGS);
  // También mostrar en consola
  console.log(`[${new Date().toLocaleTimeString('es-ES')}] ${message}`);
}

// Cargar logs existentes al iniciar
async function loadPanelLogs() {
  panelLogs = await loadPanelLogsFile(LOGS_PATH);
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

// Cargar configuración desde config.json (delega en shared/store.js)
async function loadConfig() {
  config = await loadConfigFile(CONFIG_PATH, DEFAULT_CONFIG);
  return config;
}

// Cargar estado del bot (mezcla con el estado en memoria, igual que antes)
async function loadBotState() {
  botState = { ...botState, ...(await loadBotStateFile(STATE_PATH, botState)) };
}

// Guardar estado del bot (con el mismo throttle de 5 min de siempre,
// ahora como parámetro explícito de shared/store.js en vez de lógica propia)
async function saveBotState(force = false) {
  await saveBotStateFile(STATE_PATH, botState, {
    force,
    throttleMs: SAVE_INTERVAL,
    lastSaveRef: lastStateSaveRef
  });
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
        // Renderizar y enviar fórmula como sticker (más compacto)
        const imageBuffer = await renderLatexToImage(part.content.latex);
        
        if (imageBuffer) {
          // Convertir a sticker (512x512, webp)
          const stickerBuffer = await sharp(imageBuffer)
            .resize(512, 512, {
              fit: 'contain',
              background: { r: 255, g: 255, b: 255, alpha: 1 } // Fondo blanco
            })
            .webp()
            .toBuffer();
          
          await sock.sendMessage(remoteJid, {
            sticker: stickerBuffer
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
    appLogger.error({ err: error }, 'Error al procesar fórmulas / enviar respuesta');
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
    
    // Mostrar estado "escribiendo..." mientras se decide/consulta la respuesta
    const typingPromise = simulateTyping(sock, remoteJid, 0);

    // Decide (según config.responseMode) si responde directo del catálogo,
    // con IA, o una mezcla — ver answerQuery()
    const { text: respuesta, images: ragImages } = await answerQuery(combinedMessage, answerQueryDeps());
    const lastMsg = messagesToProcess[messagesToProcess.length - 1].msg; // Último mensaje para citar

    await typingPromise;

    // Procesar respuesta con soporte para fórmulas LaTeX
    await processAIResponseWithFormulas(respuesta, sock, remoteJid, lastMsg);

    // Si alguna coincidencia del catálogo tiene imagen, enviarla también
    if (ragImages.length > 0) {
      await sendRagImages(sock, remoteJid, ragImages, lastMsg);
    }
    
    incrementMessageCount();
    if (botState.logsEnabled) {
      const tipo = isGroup ? '[GRUPO]' : '[CONTACTO]';
      addLog(`✅ ${tipo} Respuesta enviada (${botState.messagesSentLastHour}/${MAX_MESSAGES_PER_HOUR} esta hora)`, 'success');
    }
    
  } catch (error) {
    console.error('❌ Error al procesar cola:', error.message);
    appLogger.error({ err: error }, 'Error al procesar cola de usuario');
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

// ============================================================
// Límite de tasa para Gemini (generateContent)
// ============================================================
// El tier gratuito de gemini-2.5-flash permite solo ~10 solicitudes
// por minuto (Google lo recortó ~80% en diciembre de 2025) y ese cupo
// se comparte entre /pregunta, las respuestas automáticas, /analizar
// y /papear porque todas usan el mismo modelo. Sin este límite,
// varios usuarios escribiendo a la vez provocan errores 429 que antes
// se mostraban como "verifica tu API Key" (mensaje engañoso: el
// problema es de cupo, no de autenticación).
// Margen de seguridad bajo el límite real de 10 RPM del tier gratuito de
// gemini-2.5-flash (Google lo recortó ~80% en diciembre de 2025); ese cupo
// se comparte entre /pregunta, las respuestas automáticas, /analizar y
// /papear porque todas usan el mismo modelo.
const geminiLimiter = makeGeminiLimiter({
  rpmLimit: 8,
  addLog,
  isLogsEnabled: () => botState.logsEnabled,
  fetchImpl: fetch
});

// Analizar imagen con Gemini Vision
// ============================================================
// Clientes de IA (Etapa 2 de la reestructuración)
// ============================================================
// La lógica de cada proveedor vive en providers/*.js — estos wrappers
// conservan exactamente el mismo nombre/firma que antes (sin parámetros
// extra) para no tocar ningún punto de llamada ni los tests existentes;
// solo inyectan { config, geminiLimiter } en cada llamada.
async function analyzeImageWithGemini(imageBuffer, question = '') {
  return geminiProvider.analyzeImageWithGemini(imageBuffer, question, { config, geminiLimiter });
}

async function callGrok(userMessage) {
  return callGrokProvider(userMessage, { config });
}

async function callChatGPT(userMessage) {
  return callChatGPTProvider(userMessage, { config });
}

async function callGeminiRaw(userMessage, extraContext = '') {
  return geminiProvider.callGeminiRaw(userMessage, extraContext, { config, geminiLimiter });
}

async function callGemini(userMessage, extraContext = '') {
  return geminiProvider.callGemini(userMessage, extraContext, { config, geminiLimiter });
}

// Recupera contexto de la base de conocimiento (RAG) para una consulta.
// Nunca lanza: si el RAG falla, el bot responde igual que antes.
async function getRagContext(query) {
  try {
    return await rag.buildContext(query);
  } catch (error) {
    console.error('⚠️ RAG no disponible:', error.message);
    return { context: '', images: [], results: [] };
  }
}

// Envía las imágenes de catálogo que coincidieron con la consulta (máx. 2)
async function sendRagImages(sock, remoteJid, images, quotedMsg) {
  for (const img of images.slice(0, 2)) {
    try {
      const buffer = await fs.readFile(img.imagePath);
      await sock.sendMessage(remoteJid, {
        image: buffer,
        caption: `📦 ${img.title}`
      }, quotedMsg ? { quoted: quotedMsg } : {});
    } catch (error) {
      console.error('⚠️ No se pudo enviar imagen de catálogo:', error.message);
    }
  }
}

// ============================================================
// Respuesta directa desde el catálogo (sin IA)
// ============================================================
// Formatea resultados de rag.search()/rag.buildContext() como respuesta
// enviable sin pasar por Gemini. Usado por /catalogo y por answerQuery()
// en los modos "hybrid"/"direct".
const KB_ANSWER_INTRO_COMMAND = '📚 Esto encontré:';
const KB_ANSWER_INTRO_CHAT = '📋 Esto es lo que tengo sobre eso:';

function formatKbAnswer(results, intro = KB_ANSWER_INTRO_CHAT) {
  const texto = results.map(r => `*${r.title}*\n${r.text}`).join('\n\n');
  return `${intro}\n\n${texto}`;
}

function kbResultsToImages(results) {
  return results
    .filter(r => r.imageFile)
    .map(r => ({ title: r.title, imagePath: rag.getImagePath(r.imageFile) }));
}

// ============================================================
// Modo de respuesta (config.responseMode): "ai" | "hybrid" | "direct"
// ============================================================
// Punto único de decisión para respuestas automáticas y /pregunta: decide
// si contestar directo desde el catálogo, con IA, o una mezcla. Nunca
// lanza — siempre devuelve algo enviable al cliente, incluso sin ninguna
// API de IA configurada o si Gemini falla por cualquier motivo (incluido
// el límite de cuota 429).
const VALID_RESPONSE_MODES = new Set(['ai', 'hybrid', 'direct']);
const KB_NO_MATCH_FALLBACK =
  '🤔 No encontré información exacta sobre eso en mi catálogo.\n\n' +
  '💡 Prueba con */catalogo* para ver todo lo disponible, o escribe */menu* para ver las opciones.';

// Recibe sus dependencias como objeto en vez de leer los globals del módulo
// (config/botState/addLog/callGemini/callGeminiRaw/getRagContext) — así se
// puede probar con node:test sin tocar la sesión real de WhatsApp. El
// llamador de producción (más abajo) le pasa exactamente esos globals, así
// que el comportamiento no cambia una sola línea.
export async function answerQuery(query, deps) {
  const {
    config, botState, addLog,
    getRagContext, callGemini, callGeminiRaw,
    ragHighConfidenceScore, GeminiRateLimitError: RateLimitErrorClass
  } = deps;

  const mode = VALID_RESPONSE_MODES.has(config.responseMode) ? config.responseMode : 'hybrid';
  const ragResult = await getRagContext(query);
  const hasMatch = ragResult.results.length > 0;
  const isHighConfidence = hasMatch && ragResult.results[0].score >= ragHighConfidenceScore;

  if (hasMatch && botState.logsEnabled) {
    addLog(`📚 RAG: ${ragResult.results.length} coincidencia(s) (modo: ${mode}${isHighConfidence ? ', alta confianza' : ''})`, 'info');
  }

  // ---- modo "ai": comportamiento de siempre, sin cambios ----
  if (mode === 'ai') {
    return { text: await callGemini(query, ragResult.context), images: ragResult.images };
  }

  // ---- modo "direct": nunca llama a la IA ----
  if (mode === 'direct') {
    if (hasMatch) return { text: formatKbAnswer(ragResult.results), images: kbResultsToImages(ragResult.results) };
    return { text: KB_NO_MATCH_FALLBACK, images: [] };
  }

  // ---- modo "hybrid" (por defecto) ----
  if (isHighConfidence) {
    // Coincidencia exacta del catálogo: responder directo, sin gastar cuota de IA.
    return { text: formatKbAnswer(ragResult.results), images: kbResultsToImages(ragResult.results) };
  }

  // Sin coincidencia fuerte (charla general o coincidencia débil): intentar
  // IA solo si hay una key configurada, si no, ir directo al catálogo.
  if (!config.apiKeyGemini || config.apiKeyGemini.trim() === '') {
    if (hasMatch) return { text: formatKbAnswer(ragResult.results), images: kbResultsToImages(ragResult.results) };
    return { text: KB_NO_MATCH_FALLBACK, images: [] };
  }

  try {
    const aiText = await callGeminiRaw(query, ragResult.context);
    return { text: aiText, images: ragResult.images };
  } catch (error) {
    // Cualquier fallo de la IA cae al catálogo si hay algo que mostrar;
    // el cliente nunca debe ver un mensaje de error crudo.
    if (botState.logsEnabled) {
      addLog(error instanceof RateLimitErrorClass
        ? '⏳ Gemini con límite alcanzado, respondiendo con el catálogo directo'
        : `⚠️ Gemini no disponible (${error.message}), respondiendo con el catálogo directo`, 'warning');
    }
    if (hasMatch) return { text: formatKbAnswer(ragResult.results), images: kbResultsToImages(ragResult.results) };
    return { text: KB_NO_MATCH_FALLBACK, images: [] };
  }
}

// Dependencias reales de producción, pasadas una sola vez desde cada punto
// de llamada (processUserQueue y /pregunta) en vez de repetir el objeto.
function answerQueryDeps() {
  return {
    config, botState, addLog,
    getRagContext, callGemini, callGeminiRaw,
    ragHighConfidenceScore: rag.HIGH_CONFIDENCE_SCORE,
    GeminiRateLimitError
  };
}

// Llamar a Gemini para PAPEAR (sin censura, modo brutal)
async function callGeminiPapear(targetMessage, argumentos = '') {
  return geminiProvider.callGeminiPapear(targetMessage, argumentos, { config, geminiLimiter });
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
    menu += `• /papear [args] - Humilla brutalmente 🔥\n`;
    menu += `• /analizar - Analiza una imagen\n\n`;
    
    menu += `🎨 *Utilidades:*\n`;
    menu += `• /s - Imagen → Sticker\n`;
    menu += `• /r - Sticker → Imagen\n`;
    menu += `• /guardar - Guarda View Once\n\n`;

    menu += `📚 *Negocio:*\n`;
    menu += `• /catalogo - Ver base de conocimiento\n`;
    menu += `• /catalogo [búsqueda] - Consultar productos/info\n\n`;
    
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
  
  if (cmd === '/r') {
    // Mostrar estado "escribiendo..." mientras convierte el sticker
    await simulateTyping(sock, remoteJid, 1000); // 1 segundo
    
    try {
      // Intentar obtener el sticker
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
      
      // Verificar si hay sticker
      const hasSticker = targetMsg.message?.stickerMessage;
      
      if (!hasSticker) {
        await sock.sendMessage(remoteJid, { 
          text: '⚠️ No se detectó sticker.\n\n💡 Responde a un sticker con /r para convertirlo en imagen' 
        }, { quoted: msg });
        return;
      }
      
      // Descargar sticker
      const buffer = await downloadMediaMessage(targetMsg, 'buffer', {});
      
      // Convertir sticker (webp) a imagen PNG con calidad alta
      const imageBuffer = await sharp(buffer)
        .png({ quality: 100 })
        .toBuffer();
      
      // Enviar como imagen citando el mensaje original
      await sock.sendMessage(remoteJid, {
        image: imageBuffer,
        caption: '🖼️ Sticker convertido a imagen\n\n💡 Usa /s para convertir de vuelta a sticker'
      }, { quoted: msg });
      
      if (botState.logsEnabled) addLog(`🖼️ Sticker convertido a imagen`, 'success');
      
    } catch (error) {
      await sock.sendMessage(remoteJid, { 
        text: `❌ Error al convertir sticker: ${error.message}\n\n💡 Asegúrate de que sea un sticker válido` 
      }, { quoted: msg });
      if (botState.logsEnabled) addLog(`❌ Error convirtiendo sticker: ${error.message}`, 'error');
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
    
    // Mostrar estado "escribiendo..." mientras se decide/consulta la respuesta
    const typingPromise = simulateTyping(sock, remoteJid, 0);

    // Igual que las respuestas automáticas: según config.responseMode,
    // responde directo del catálogo, con IA, o una mezcla (ver answerQuery())
    const { text: respuesta, images: preguntaImages } = await answerQuery(texto, answerQueryDeps());

    await typingPromise;

    // Procesar respuesta con soporte para fórmulas LaTeX
    await processAIResponseWithFormulas(respuesta, sock, remoteJid, msg);

    if (preguntaImages.length > 0) {
      await sendRagImages(sock, remoteJid, preguntaImages, msg);
    }
    return;
  }

  if (cmd === '/catalogo') {
    const consulta = message.replace('/catalogo', '').trim();

    try {
      if (!consulta) {
        // Sin búsqueda: listar lo que hay en la base de conocimiento
        const entries = await rag.listEntries();
        if (entries.length === 0) {
          await sock.sendMessage(remoteJid, { text: '📚 La base de conocimiento está vacía.\n\nAgrega información del negocio desde el panel web (http://localhost:3000).' }, { quoted: msg });
          return;
        }
        const conImagen = entries.filter(e => e.imageFile);
        let lista = `📚 *BASE DE CONOCIMIENTO* (${entries.length} entradas)\n\n`;
        lista += entries.map(e => `• ${e.imageFile ? '🖼️ ' : ''}${e.title}`).join('\n');
        lista += `\n\n💡 Usa /catalogo [búsqueda] para consultar${conImagen.length ? ' y recibir fotos del catálogo' : ''}.`;
        await sock.sendMessage(remoteJid, { text: lista }, { quoted: msg });
        return;
      }

      await simulateTyping(sock, remoteJid, 1500);
      const resultados = await rag.search(consulta, { topK: 3 });

      if (resultados.length === 0) {
        await sock.sendMessage(remoteJid, { text: `❌ No encontré nada sobre "${consulta}" en el catálogo.\n\n💡 Usa /catalogo (sin texto) para ver todo lo disponible.` }, { quoted: msg });
        return;
      }

      // Responder con el texto de las coincidencias
      await sock.sendMessage(remoteJid, { text: formatKbAnswer(resultados, KB_ANSWER_INTRO_COMMAND) }, { quoted: msg });

      // Enviar imágenes de las coincidencias que tengan foto
      const imagenes = kbResultsToImages(resultados);
      if (imagenes.length > 0) {
        await sendRagImages(sock, remoteJid, imagenes, msg);
      }
    } catch (error) {
      console.error('❌ Error en /catalogo:', error.message);
      await sock.sendMessage(remoteJid, { text: '❌ Error al consultar el catálogo. Intenta de nuevo.' }, { quoted: msg });
    }
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
  
  if (cmd === '/papear') {
    // Extraer argumentos opcionales
    const argumentos = message.replace('/papear', '').trim();
    
    // Intentar obtener el mensaje citado
    const quotedMessage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let targetText = '';
    
    if (quotedMessage) {
      // Extraer texto del mensaje citado
      targetText = quotedMessage.conversation || 
                   quotedMessage.extendedTextMessage?.text || 
                   quotedMessage.imageMessage?.caption ||
                   '';
    }
    
    // Validar: necesita mensaje citado O argumentos
    if (!targetText && !argumentos) {
      // Auto-papeo: el usuario usó /papear sin nada
      await simulateTyping(sock, remoteJid, 0);
      const papeada = await callGeminiPapear('', '');
      await sock.sendMessage(remoteJid, { 
        text: `🔥 *AUTO-PAPEO ACTIVADO* 🔥\n\n${papeada}` 
      }, { quoted: msg });
      return;
    }
    
    // Mostrar estado "escribiendo..." mientras genera la papeada
    const typingPromise = simulateTyping(sock, remoteJid, 0);
    
    // Generar papeada brutal
    const papeada = await callGeminiPapear(targetText, argumentos);
    
    await typingPromise;
    
    // Enviar papeada citando el mensaje original (si existe)
    if (quotedMessage) {
      await sock.sendMessage(remoteJid, { 
        text: `🔥 *PAPEADA BRUTAL* 🔥\n\n${papeada}` 
      }, { quoted: msg });
    } else {
      // Si solo hay argumentos, enviar sin citar
      await sock.sendMessage(remoteJid, { 
        text: `🔥 *PAPEADA* 🔥\n\n${papeada}` 
      }, { quoted: msg });
    }
    
    if (botState.logsEnabled) addLog(`🔥 Papeada generada`, 'success');
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
      () => addLog('❌ Sesión cerrada', 'error'),
      (reason) => addLog(`♻️ Reconectando... (código: ${reason ?? 'desconocido'})`, 'warning')
    );
  } else {
    // Autenticación con QR (por defecto)
    await loginWithQR(
      (socket) => setupBotHandlers(socket),
      () => addLog('📱 QR generado - Escanea con WhatsApp', 'info'),
      () => addLog('❌ Sesión cerrada', 'error'),
      (reason) => addLog(`♻️ Reconectando... (código: ${reason ?? 'desconocido'})`, 'warning')
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
      // Tripwire barato (no una corrección): Baileys ya maneja @lid
      // internamente y aquí solo se deja evidencia si alguna vez el JID
      // normalizado difiere del original — el envío sigue yendo al JID
      // original exactamente igual que antes.
      const normalizedJid = jidNormalizedUser(remoteJid);
      if (normalizedJid !== remoteJid) {
        addLog(`⚠️ JID no normalizado: original=${remoteJid} normalizado=${normalizedJid}`, 'warning');
      }
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
      appLogger.error({ err: error }, 'Error al procesar mensaje entrante');
    }
  });

  // Visibilidad de entrega: sock.sendMessage() solo confirma que WhatsApp
  // aceptó el mensaje cifrado, nunca que el destinatario lo recibió o vio.
  // Sin esto, "el log dice enviado pero al cliente no le llegó nada" es
  // indiagnosticable. No se persiste historial: key.id solo se usa truncado
  // como etiqueta del log.
  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      if (!key.fromMe || update.status === undefined) continue;
      const preview = key.id ? key.id.slice(-8) : '???';
      if (update.status === 0 /* ERROR */) {
        addLog(`❌ Entrega fallida (msg ${preview} → ${key.remoteJid}): status ERROR`, 'error');
      } else if (update.status === 3 /* DELIVERY_ACK */ && botState.logsEnabled) {
        addLog(`📬 Entregado (msg ${preview} → ${key.remoteJid})`, 'info');
      } else if (update.status === 4 /* READ */ && botState.logsEnabled) {
        addLog(`👁️ Leído (msg ${preview} → ${key.remoteJid})`, 'info');
      }
    }
  });
}

// Manejo de errores globales
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error.message);
  appLogger.error({ err: error }, 'uncaughtException');
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Promesa rechazada:', error.message);
  appLogger.error({ err: error }, 'unhandledRejection');
});

// Iniciar el bot solo cuando bot.js se ejecuta directamente (node bot.js),
// no cuando otro módulo lo importa (ej. los tests de node:test) — así,
// importar answerQuery/makeGeminiLimiter para probarlos no dispara una
// conexión real a WhatsApp.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  console.log('🚀 Iniciando WhatsApp Bot...');
  startBot();
}
