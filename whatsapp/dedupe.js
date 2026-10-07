// Deduplicación de mensajes por id. Extraído como módulo propio (en vez de
// un Set suelto en bot.js) para poder probarlo sin tocar Baileys.
//
// Por qué existe: Baileys emite `messages.upsert` con `type: 'notify'`
// para mensajes nuevos en vivo, y `type: 'append'` para reenvíos de
// sincronización de historial — comunes justo después de una reconexión
// (ver la ráfaga de "Reconectando" investigada en BOTWA-docs/Fixes/
// Diagnostico de Respuestas Duplicadas.md). El filtro por `type` en
// bot.js cubre el caso documentado; este deduplicador por `key.id` es la
// segunda capa de defensa, por si el mismo mensaje llegara duplicado por
// cualquier otro motivo (conexión inestable, reconexiones seguidas).
export function createMessageDeduper({ maxSize = 500 } = {}) {
  const seen = new Set();

  function shouldSkip(messageId) {
    if (!messageId) return false;
    return seen.has(messageId);
  }

  // FIFO: los Set de JS preservan el orden de inserción, así que el
  // primer valor de values() es siempre el más antiguo.
  function remember(messageId) {
    if (!messageId) return;
    seen.add(messageId);
    if (seen.size > maxSize) {
      seen.delete(seen.values().next().value);
    }
  }

  return { shouldSkip, remember };
}
