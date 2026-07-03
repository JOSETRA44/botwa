// Comandos orientados al negocio: catálogo (RAG) y preguntas en modo
// híbrido. Extraído de bot.js en la Etapa 6 de la reestructuración.
export function createBusinessCommands() {
  return {
    '/pregunta': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, answerQuery, processAIResponseWithFormulas, sendRagImages } = ctx;
      const texto = message.replace('/pregunta', '').trim();
      if (!texto) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Envía tu pregunta después del comando /pregunta\n\nEjemplo: /pregunta ¿Cómo estás?' }, { quoted: msg });
        return;
      }

      // Mostrar estado "escribiendo..." mientras se decide/consulta la respuesta
      const typingPromise = simulateTyping(sock, remoteJid, 0);

      // Igual que las respuestas automáticas: según config.responseMode,
      // responde directo del catálogo, con IA, o una mezcla (ver answerQuery())
      const { text: respuesta, images: preguntaImages } = await answerQuery(texto);

      await typingPromise;

      // Procesar respuesta con soporte para fórmulas LaTeX
      await processAIResponseWithFormulas(respuesta, sock, remoteJid, msg);

      if (preguntaImages.length > 0) {
        await sendRagImages(sock, remoteJid, preguntaImages, msg);
      }
    },

    '/catalogo': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, rag, formatKbAnswer, kbResultsToImages, KB_ANSWER_INTRO_COMMAND, sendRagImages } = ctx;
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
    }
  };
}
