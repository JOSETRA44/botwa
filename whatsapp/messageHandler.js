// Orquestador de la cola de mensajes: agrupa mensajes seguidos de un mismo
// usuario, decide la respuesta (vía answerQuery) y la envía. Extraído de
// bot.js en la Etapa 5 de la reestructuración.
//
// Recibe `getDeps()` (una función, no un objeto estático) porque esta
// función se reprograma a sí misma con setTimeout (una cola puede seguir
// recibiendo mensajes minutos después) y `config`/`botState` en bot.js son
// bindings que se REEMPLAZAN por objetos nuevos (loadConfig/loadBotState),
// no solo se mutan — pasar un objeto de deps ya armado se volvería
// obsoleto en la próxima ejecución programada. Llamar a getDeps() de
// nuevo en cada invocación (incluida cada reprogramación) replica
// exactamente el comportamiento de antes, cuando el código leía
// directamente las variables del módulo y siempre veía su valor más
// reciente.
export async function processUserQueue(userId, sock, getDeps) {
  const deps = getDeps();
  const {
    queueStore, canSendMessage, incrementMessageCount,
    config, botState, addLog, appLogger,
    randomDelay, simulateTyping,
    answerQuery, processAIResponseWithFormulas, sendRagImages,
    maxMessagesInGroup, groupingDelayMs, maxMessagesPerHour
  } = deps;

  const queue = queueStore.getOrCreate(userId);

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
    // Obtener mensajes del buffer (máximo maxMessagesInGroup)
    const messagesToProcess = queue.messages.splice(0, maxMessagesInGroup);

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
    const { text: respuesta, images: ragImages } = await answerQuery(combinedMessage);
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
      addLog(`✅ ${tipo} Respuesta enviada (${botState.messagesSentLastHour}/${maxMessagesPerHour} esta hora)`, 'success');
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
        processUserQueue(userId, sock, getDeps);
      }, groupingDelayMs);
    }
  }
}
