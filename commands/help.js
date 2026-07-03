// Comandos de ayuda/menú. Extraído de bot.js en la Etapa 6 de la
// reestructuración (separar los comandos en archivos por tema).
// Cada handler recibe (message, sock, remoteJid, msg, ctx) — ctx se arma
// de nuevo en cada despacho (ver bot.js:commandContext()) para siempre
// reflejar el config/botState más reciente, igual que el código original.
export function createHelpCommands() {
  return {
    '/menu': async (message, sock, remoteJid, msg, ctx) => {
      const { config } = ctx;
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
    },

    '/ayuda': async (message, sock, remoteJid, msg, ctx) => {
      const { config } = ctx;
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
    }
  };
}
