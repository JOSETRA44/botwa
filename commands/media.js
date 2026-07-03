// Comandos de manejo de media (análisis de imagen, View Once, stickers).
// Extraído de bot.js en la Etapa 6 de la reestructuración.
export function createMediaCommands() {
  return {
    '/analizar': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, downloadMediaMessage, analyzeImageWithGemini } = ctx;
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
    },

    '/guardar': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, downloadMediaMessage } = ctx;
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
    },

    '/s': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, downloadMediaMessage, imageToSticker } = ctx;
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
          stickerBuffer = await imageToSticker(buffer);
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
    },

    '/r': async (message, sock, remoteJid, msg, ctx) => {
      const { botState, addLog, simulateTyping, downloadMediaMessage, stickerToImage } = ctx;
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
        const imageBuffer = await stickerToImage(buffer);

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
    }
  };
}
