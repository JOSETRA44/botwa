// Comandos que llaman directo a un proveedor de IA (sin pasar por el
// modo híbrido/RAG de answerQuery). Extraído de bot.js en la Etapa 6 de
// la reestructuración.
export function createAiCommands() {
  return {
    '/elon': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, callGrok, processAIResponseWithFormulas } = ctx;
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
    },

    '/sora': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, callChatGPT, processAIResponseWithFormulas } = ctx;
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
    },

    '/resumen': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, callGemini, processAIResponseWithFormulas } = ctx;
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
    },

    '/papear': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, callGeminiPapear } = ctx;
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
    }
  };
}
