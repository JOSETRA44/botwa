// Orquestador CRUD de entradas del catálogo. Extraído de rag.js en la
// Etapa 8 de la reestructuración — coordina rag/files.js (guardar/borrar
// bytes en disco) + rag/store.js (persistir metadata) + rag/search.js
// (re-embeder cuando cambia texto).
import crypto from 'crypto';
import { loadKB, saveKB, sanitize } from './store.js';
import { saveFiles, deleteFile, deleteEntryFiles } from './files.js';
import { embedText } from './search.js';

export async function addEntry({ title, text, tags = [], files = [] }) {
  if (!title || !text) throw new Error('title y text son obligatorios');
  const kbCache = await loadKB();

  const id = crypto.randomBytes(8).toString('hex');
  const savedFiles = await saveFiles(id, files);

  const embedding = await embedText(`${title}\n${text}\n${tags.join(' ')}`);

  const entry = {
    id,
    title: String(title).slice(0, 200),
    text: String(text).slice(0, 8000),
    tags: (Array.isArray(tags) ? tags : []).map(t => String(t).trim()).filter(Boolean),
    files: savedFiles,
    embedding,
    updatedAt: new Date().toISOString()
  };

  kbCache.entries.push(entry);
  await saveKB();
  return sanitize(entry);
}

// `removeImage` (booleano) es compatibilidad con el panel anterior a la
// Etapa 8, que solo conocía una imagen por entrada — se interpreta como
// "borrar todos los archivos de tipo imagen". `removeFileIds` es la forma
// nueva y precisa (borrar archivos puntuales por id).
export async function updateEntry(id, { title, text, tags, files, removeFileIds, removeImage }) {
  const kbCache = await loadKB();
  const entry = kbCache.entries.find(e => e.id === id);
  if (!entry) throw new Error('Entrada no encontrada');
  if (!Array.isArray(entry.files)) entry.files = [];

  let needsReembed = false;
  if (title !== undefined && title !== entry.title) { entry.title = String(title).slice(0, 200); needsReembed = true; }
  if (text !== undefined && text !== entry.text) { entry.text = String(text).slice(0, 8000); needsReembed = true; }
  if (tags !== undefined) { entry.tags = (Array.isArray(tags) ? tags : []).map(t => String(t).trim()).filter(Boolean); needsReembed = true; }

  const idsToRemove = new Set(removeFileIds || []);
  if (removeImage) {
    for (const f of entry.files) if (f.kind === 'image') idsToRemove.add(f.id);
  }
  for (const fileId of idsToRemove) {
    const idx = entry.files.findIndex(f => f.id === fileId);
    if (idx !== -1) {
      await deleteFile(entry.id, entry.files[idx]);
      entry.files.splice(idx, 1);
    }
  }

  if (Array.isArray(files) && files.length > 0) {
    const newFiles = await saveFiles(entry.id, files, entry.files.length);
    entry.files.push(...newFiles);
  }

  if (needsReembed) {
    entry.embedding = await embedText(`${entry.title}\n${entry.text}\n${entry.tags.join(' ')}`);
  }
  entry.updatedAt = new Date().toISOString();
  await saveKB();
  return sanitize(entry);
}

export async function deleteEntry(id) {
  const kbCache = await loadKB();
  const idx = kbCache.entries.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Entrada no encontrada');
  const [removed] = kbCache.entries.splice(idx, 1);
  await deleteEntryFiles(removed.id);
  await saveKB();
  return true;
}

export async function listEntries() {
  const kbCache = await loadKB();
  return kbCache.entries.map(sanitize);
}
