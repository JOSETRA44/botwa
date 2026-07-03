// Comandos de búsqueda de imágenes (Unsplash / Google Images). Extraído
// de bot.js en la Etapa 6 de la reestructuración.
export function createImageCommands() {
  return {
    '/gg': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, searchUnsplashImage } = ctx;
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
    },

    '/go': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, searchGoogleImage } = ctx;
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
    }
  };
}
