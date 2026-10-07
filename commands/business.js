// Comandos orientados al negocio: catálogo (RAG) y preguntas en modo
// híbrido. Extraído de bot.js en la Etapa 6 de la reestructuración;
// /catalogo reescrito en la Etapa 10 con navegación por texto (Baileys ya
// no soporta de forma confiable botones/listas nativas de WhatsApp — ver
// BOTWA-docs/Sistema/Reestructuracion Etapa 5 y 6 - Comandos.md).
const PAGE_SIZE = 10;

// Orden global estable (por id, nunca cambia) — a propósito NO depende de
// qué le mostramos antes a cada usuario ni de sesión en memoria: así
// "/catalogo 3" siempre resuelve al mismo producto sin importar si el bot
// se reinició o qué página vio el cliente la última vez.
function stableEntryOrder(entries) {
  return [...entries].sort((a, b) => a.id.localeCompare(b.id));
}

function formatListPage(entries, requestedPage) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  let lista = `📚 *BASE DE CONOCIMIENTO* (${entries.length} entradas)\n\n`;
  lista += pageEntries.map((e, i) => {
    const hasImage = (e.files || []).some((f) => f.kind === 'image');
    return `${start + i + 1}. ${hasImage ? '🖼️ ' : ''}${e.title}`;
  }).join('\n');

  lista += `\n\n📄 Página ${page}/${totalPages}`;
  if (page < totalPages) lista += ` — escribe /catalogo p${page + 1} para ver más`;
  lista += `, o /catalogo [número] para ver el detalle de un producto.`;
  return lista;
}

export function createBusinessCommands() {
  return {
    '/pregunta': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, answerQuery, processAIResponseWithFormulas, sendEntryFiles } = ctx;
      const texto = message.replace('/pregunta', '').trim();
      if (!texto) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Envía tu pregunta después del comando /pregunta\n\nEjemplo: /pregunta ¿Cómo estás?' }, { quoted: msg });
        return;
      }

      // Mostrar estado "escribiendo..." mientras se decide/consulta la respuesta
      const typingPromise = simulateTyping(sock, remoteJid, 0);

      // Igual que las respuestas automáticas: según config.responseMode,
      // responde directo del catálogo, con IA, o una mezcla (ver answerQuery())
      const { text: respuesta, attachments } = await answerQuery(texto);

      await typingPromise;

      // Procesar respuesta con soporte para fórmulas LaTeX
      await processAIResponseWithFormulas(respuesta, sock, remoteJid, msg);

      if (attachments.length > 0) {
        await sendEntryFiles(sock, remoteJid, attachments, msg);
      }
    },

    '/catalogo': async (message, sock, remoteJid, msg, ctx) => {
      const { simulateTyping, rag, formatKbAnswer, KB_ANSWER_INTRO_COMMAND, sendEntryFiles, kbResultsToAttachments } = ctx;
      const consulta = message.replace('/catalogo', '').trim();

      try {
        const entries = await rag.listEntries();

        if (entries.length === 0) {
          await sock.sendMessage(remoteJid, { text: '📚 La base de conocimiento está vacía.\n\nAgrega información del negocio desde el panel web (http://localhost:3000).' }, { quoted: msg });
          return;
        }

        const ordered = stableEntryOrder(entries);

        // Sin argumento: primera página del listado
        if (!consulta) {
          await sock.sendMessage(remoteJid, { text: formatListPage(ordered, 1) }, { quoted: msg });
          return;
        }

        // /catalogo pN: página N
        const pageMatch = consulta.match(/^p(\d+)$/i);
        if (pageMatch) {
          await sock.sendMessage(remoteJid, { text: formatListPage(ordered, parseInt(pageMatch[1], 10)) }, { quoted: msg });
          return;
        }

        // /catalogo [número]: detalle de un producto por su posición en el orden global
        if (/^\d+$/.test(consulta)) {
          const entry = ordered[parseInt(consulta, 10) - 1];
          if (!entry) {
            await sock.sendMessage(remoteJid, { text: `❌ No hay ningún producto con el número ${consulta}.\n\n💡 Usa /catalogo para ver la lista numerada.` }, { quoted: msg });
            return;
          }
          await sock.sendMessage(remoteJid, { text: formatKbAnswer([entry], KB_ANSWER_INTRO_COMMAND) }, { quoted: msg });
          const attachments = kbResultsToAttachments([entry]);
          if (attachments.length > 0) {
            await sendEntryFiles(sock, remoteJid, attachments, msg);
          }
          return;
        }

        // Búsqueda semántica de texto libre (comportamiento de siempre)
        await simulateTyping(sock, remoteJid, 1500);
        const resultados = await rag.search(consulta, { topK: 3 });

        if (resultados.length === 0) {
          await sock.sendMessage(remoteJid, { text: `❌ No encontré nada sobre "${consulta}" en el catálogo.\n\n💡 Usa /catalogo (sin texto) para ver todo lo disponible.` }, { quoted: msg });
          return;
        }

        // Responder con el texto de las coincidencias
        await sock.sendMessage(remoteJid, { text: formatKbAnswer(resultados, KB_ANSWER_INTRO_COMMAND) }, { quoted: msg });

        // Enviar todos los archivos (imágenes y PDFs) de las coincidencias,
        // cada uno con su descripción real — sendEntryFiles ya limita el
        // total por respuesta (MAX_ATTACHMENTS_PER_RESPONSE).
        const attachments = kbResultsToAttachments(resultados);
        if (attachments.length > 0) {
          await sendEntryFiles(sock, remoteJid, attachments, msg);
        }
      } catch (error) {
        console.error('❌ Error en /catalogo:', error.message);
        await sock.sendMessage(remoteJid, { text: '❌ Error al consultar el catálogo. Intenta de nuevo.' }, { quoted: msg });
      }
    }
  };
}
