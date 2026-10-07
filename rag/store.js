// Persistencia de la base de conocimiento (knowledge/knowledge.json) +
// migración automática del formato viejo. Extraído de rag.js en la
// Etapa 8 de la reestructuración.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrateLegacyImage } from './files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const KB_PATH = path.join(KNOWLEDGE_DIR, 'knowledge.json');
const KB_TMP_PATH = path.join(KNOWLEDGE_DIR, 'knowledge.json.tmp');

let kbCache = null;

// Entradas de antes de la Etapa 8 tienen `imageFile` (string) en vez de
// `files` (arreglo). Se migra una sola vez, la primera vez que se carga
// un knowledge.json viejo — después de esto la entrada ya tiene `files`
// y no se vuelve a tocar.
async function migrateEntry(entry) {
  if (Array.isArray(entry.files)) return false; // ya migrada
  entry.files = [];
  if (entry.imageFile) {
    const migrated = await migrateLegacyImage(entry.id, entry.imageFile);
    if (migrated) entry.files.push(migrated);
  }
  delete entry.imageFile;
  return true;
}

export async function loadKB(force = false) {
  if (kbCache && !force) return kbCache;
  try {
    const data = await fs.readFile(KB_PATH, 'utf8');
    kbCache = JSON.parse(data);
    if (!Array.isArray(kbCache.entries)) kbCache.entries = [];
  } catch {
    kbCache = { entries: [] };
  }

  let migrated = false;
  for (const entry of kbCache.entries) {
    if (await migrateEntry(entry)) migrated = true;
  }
  if (migrated) await saveKB();

  return kbCache;
}

// Escritura atómica: escribe a un archivo temporal y renombra, en vez de
// sobreescribir knowledge.json directamente — así un proceso que se cae a
// mitad de la escritura no deja la base de conocimiento corrupta.
export async function saveKB() {
  await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  await fs.writeFile(KB_TMP_PATH, JSON.stringify(kbCache, null, 2), 'utf8');
  await fs.rename(KB_TMP_PATH, KB_PATH);
}

// No exponer el embedding (pesado e irrelevante para el panel/WhatsApp).
export function sanitize(entry) {
  const { embedding, ...rest } = entry;
  return { ...rest, hasEmbedding: Array.isArray(embedding) && embedding.length > 0 };
}
