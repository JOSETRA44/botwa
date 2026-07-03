// Cola de mensajes por usuario (evita pérdida de mensajes cuando alguien
// escribe varias líneas seguidas antes de que el bot alcance a responder).
// Extraído de bot.js en la Etapa 3 de la reestructuración — pura estructura
// de datos en memoria, sin I/O ni dependencia de WhatsApp/IA, por eso es
// fácil de probar de forma aislada.
export function createUserQueueStore({ maxQueueSize = 10 } = {}) {
  const queues = new Map();

  // Devuelve la cola del usuario, creándola si no existe. El objeto
  // devuelto se sigue mutando directamente por el llamador (messages,
  // processing, timeout) — mismo contrato que la implementación original.
  function getOrCreate(userId) {
    if (!queues.has(userId)) {
      queues.set(userId, {
        messages: [],
        processing: false,
        timeout: null,
        lastMessage: Date.now()
      });
    }
    return queues.get(userId);
  }

  // Agrega un mensaje al buffer del usuario. Devuelve false si la cola
  // está llena (el llamador decide qué avisarle al usuario en ese caso).
  function add(userId, messageData) {
    const queue = getOrCreate(userId);
    if (queue.messages.length >= maxQueueSize) {
      return false;
    }
    queue.messages.push(messageData);
    queue.lastMessage = Date.now();
    return true;
  }

  return { getOrCreate, add };
}
