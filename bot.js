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
import { createUserQueueStore } from './whatsapp/queue.js';
import { sendRagImages } from './whatsapp/send.js';
import { processUserQueue as processUserQueueImpl } from './whatsapp/messageHandler.js';
import { createHelpCommands } from './commands/help.js';
import { createImageCommands } from './commands/images.js';
import { createMediaCommands } from './commands/media.js';
import { createAiCommands } from './commands/ai.js';
import { createBusinessCommands } from './commands/business.js';

// Re-exportados para que test/geminiLimiter.test.js siga importando desde
// bot.js sin cambios (la lógica en sí vive en providers/geminiLimiter.js).
export { GeminiRateLimitError, makeGeminiLimiter };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Método de autenticación (QR o PHONE)
const LOGIN_METHOD = process.env.LOGIN_METHOD || 'QR';

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'bot-state.json');
export let config = {};
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
const GROUPING_DELAY = 3000; // 3 segundos para agrupar mensajes
const MAX_MESSAGES_IN_GROUP = 5; // Máximo 5 mensajes agrupados
const MAX_QUEUE_SIZE = 10; // Máximo 10 mensajes en cola
const userQueueStore = createUserQueueStore({ maxQueueSize: MAX_QUEUE_SIZE });

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

// Obtener o crear cola de usuario / agregar mensaje a la cola — delegado a
// whatsapp/queue.js (Etapa 3 de la reestructuración), mismo contrato de
// siempre: el objeto devuelto por getUserQueue se sigue mutando directamente
// (queue.timeout, queue.processing) en el resto de este archivo.
function getUserQueue(userId) {
  return userQueueStore.getOrCreate(userId);
}

function addMessageToQueue(userId, messageData) {
  return userQueueStore.add(userId, messageData);
}

// Deps frescas para whatsapp/messageHandler.js — se reconstruyen en cada
// llamada (ver comentario en ese archivo sobre por qué getDeps es una
// función y no un objeto cacheado).
function messageProcessorDeps() {
  return {
    queueStore: userQueueStore,
    canSendMessage, incrementMessageCount,
    config, botState, addLog, appLogger,
    randomDelay, simulateTyping,
    answerQuery: (query) => answerQuery(query, answerQueryDeps()),
    processAIResponseWithFormulas, sendRagImages,
    maxMessagesInGroup: MAX_MESSAGES_IN_GROUP,
    groupingDelayMs: GROUPING_DELAY,
    maxMessagesPerHour: MAX_MESSAGES_PER_HOUR
  };
}

// Procesar cola de mensajes del usuario — delegado a whatsapp/messageHandler.js
async function processUserQueue(userId, sock) {
  return processUserQueueImpl(userId, sock, messageProcessorDeps);
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
// ============================================================
// Registro de comandos (Etapa 5: Map<comando, handler>; Etapa 6: cada
// handler vive en su propio archivo por tema bajo commands/)
// ============================================================
// commandContext() arma un objeto fresco con todo lo que un handler podría
// necesitar (config/botState se reconstruyen en cada llamada — mismo motivo
// que getDeps() en whatsapp/messageHandler.js: son bindings que se
// REEMPLAZAN por objetos nuevos, no solo se mutan, así que cachearlos una
// sola vez en el registro se volvería obsoleto).
function commandContext() {
  return {
    config, botState, addLog, appLogger,
    simulateTyping, randomDelay,
    downloadMediaMessage, sharp,
    callGrok, callChatGPT, callGemini, callGeminiPapear, analyzeImageWithGemini,
    processAIResponseWithFormulas, sendRagImages,
    answerQuery: (query) => answerQuery(query, answerQueryDeps()),
    rag, formatKbAnswer, kbResultsToImages, KB_ANSWER_INTRO_COMMAND,
    searchGoogleImage, searchUnsplashImage
  };
}

const commandHandlers = new Map(Object.entries({
  ...createHelpCommands(),
  ...createImageCommands(),
  ...createMediaCommands(),
  ...createAiCommands(),
  ...createBusinessCommands()
}));

// Despachador: busca el comando en el registro; si no está, revisa los
// comandos dinámicos configurables desde el panel (comandosSimples/comandos)
// antes de responder "no reconocido" — mismo orden de resolución de antes.
// Exportado para poder probar el mecanismo de despacho (test/commands.test.js).
export async function processCommand(command, message, sock, remoteJid, msg = null) {
  const cmd = command.toLowerCase();

  const handler = commandHandlers.get(cmd);
  if (handler) {
    await handler(message, sock, remoteJid, msg, commandContext());
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
