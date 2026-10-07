// Cliente del API del panel — único lugar que conoce las rutas del backend.
// Todos los módulos hablan con el servidor a través de este objeto.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function asJson(response) {
  if (!response.ok) {
    let error = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.error || body?.message) error = body.error || body.message;
    } catch { /* respuesta sin cuerpo JSON */ }
    throw new Error(error);
  }
  return response.json();
}

export const api = {
  // Estado y control del bot
  getState: () => fetch('/state').then(asJson),
  control: (action) => fetch('/control', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ action })
  }).then(asJson),

  // Logs
  getLogs: () => fetch('/logs').then(asJson),
  clearLogs: () => fetch('/logs/clear', { method: 'POST' }).then(asJson),

  // Configuración
  getConfig: () => fetch('/config').then(asJson),
  saveConfig: (data) => fetch('/config', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data)
  }).then(asJson),

  // Base de conocimiento (RAG)
  listKnowledge: () => fetch('/knowledge').then(asJson),
  addKnowledge: (entry) => fetch('/knowledge', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(entry)
  }).then(asJson),
  updateKnowledge: (id, changes) => fetch(`/knowledge/${id}`, {
    method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(changes)
  }).then(asJson),
  deleteKnowledge: (id) => fetch(`/knowledge/${id}`, { method: 'DELETE' }).then(asJson),
  deleteKnowledgeFile: (entryId, fileId) => fetch(`/knowledge/${entryId}/file/${fileId}`, { method: 'DELETE' }).then(asJson),
  searchKnowledge: (query) => fetch('/knowledge/search', {
    method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ query })
  }).then(asJson),
  reindexKnowledge: () => fetch('/knowledge/reindex', { method: 'POST' }).then(asJson)
};
