// ============================================================
// RAG (Retrieval-Augmented Generation) - Base de Conocimiento
// ============================================================
// Permite que un negocio cargue información propia (productos,
// precios, horarios, catálogos con imágenes) y que el bot la use
// para responder con datos reales en vez de inventar.
//
// - Almacenamiento: knowledge/knowledge.json (local, gitignorado)
// - Imágenes de catálogo: knowledge/images/
// - Embeddings: Gemini text-embedding-004 (misma GEMINI_API_KEY)
// - Búsqueda: similitud coseno en memoria; fallback por palabras
//   clave si no hay API key o falla el embedding.
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
const IMAGES_DIR = path.join(KNOWLEDGE_DIR, 'images');
const KB_PATH = path.join(KNOWLEDGE_DIR, 'knowledge.json');

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMS = 768; // dimensión reducida: suficiente para RAG y aligera el JSON
const DEFAULT_TOP_K = 3;
// gemini-embedding-001 da similitudes con piso alto (~0.55 incluso para
// consultas sin relación); 0.65 separa bien relevante de irrelevante.
const DEFAULT_MIN_SCORE = 0.65;

let kbCache = null; // { entries: [...] }

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

async function ensureDirs() {
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

// ---------- Persistencia ----------

export async function loadKB(force = false) {
  if (kbCache && !force) return kbCache;
  try {
    const data = await fs.readFile(KB_PATH, 'utf8');
    kbCache = JSON.parse(data);
    if (!Array.isArray(kbCache.entries)) kbCache.entries = [];
  } catch {
    kbCache = { entries: [] };
  }
  return kbCache;
}

async function saveKB() {
  await ensureDirs();
  await fs.writeFile(KB_PATH, JSON.stringify(kbCache, null, 2), 'utf8');
}

// ---------- Embeddings ----------

async function embedText(text, taskType = 'RETRIEVAL_DOCUMENT', retriesLeft = 2) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMS
        })
      }
    );
    if (!response.ok) {
      // 429: cupo de embeddings agotado (cuota separada de generateContent,
      // normalmente más generosa) — reintenta con backoff antes de rendirse.
      if (response.status === 429 && retriesLeft > 0) {
        const retryAfter = response.headers.get('retry-after');
        const backoffMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1500 * 2 ** (2 - retriesLeft);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return embedText(text, taskType, retriesLeft - 1);
      }
      console.error('❌ Error embedding API:', response.status);
      return null;
    }
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (error) {
    console.error('❌ Error al generar embedding:', error.message);
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// Fallback sin embeddings: puntuación por solapamiento de palabras
function keywordScore(query, entry) {
  const tokenize = (s) => s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes
    .split(/[^a-z0-9ñ]+/).filter(w => w.length > 2);
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;
  const entryTokens = tokenize(`${entry.title} ${entry.text} ${(entry.tags || []).join(' ')}`);
  let hits = 0;
  for (const t of entryTokens) if (queryTokens.has(t)) hits++;
  return Math.min(1, hits / queryTokens.size);
}

// ---------- CRUD ----------

export async function addEntry({ title, text, tags = [], imageBase64 = null, imageMime = null }) {
  if (!title || !text) throw new Error('title y text son obligatorios');
  await loadKB();

  const id = crypto.randomBytes(8).toString('hex');
  let imageFile = null;

  if (imageBase64) {
    const ext = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
    imageFile = `${id}.${ext}`;
    await ensureDirs();
    await fs.writeFile(path.join(IMAGES_DIR, imageFile), Buffer.from(imageBase64, 'base64'));
  }

  const embedding = await embedText(`${title}\n${text}\n${tags.join(' ')}`);

  const entry = {
    id,
    title: String(title).slice(0, 200),
    text: String(text).slice(0, 8000),
    tags: (Array.isArray(tags) ? tags : []).map(t => String(t).trim()).filter(Boolean),
    imageFile,
    embedding,
    updatedAt: new Date().toISOString()
  };

  kbCache.entries.push(entry);
  await saveKB();
  return sanitize(entry);
}

export async function updateEntry(id, { title, text, tags, imageBase64, imageMime, removeImage }) {
  await loadKB();
  const entry = kbCache.entries.find(e => e.id === id);
  if (!entry) throw new Error('Entrada no encontrada');

  let needsReembed = false;
  if (title !== undefined && title !== entry.title) { entry.title = String(title).slice(0, 200); needsReembed = true; }
  if (text !== undefined && text !== entry.text) { entry.text = String(text).slice(0, 8000); needsReembed = true; }
  if (tags !== undefined) { entry.tags = (Array.isArray(tags) ? tags : []).map(t => String(t).trim()).filter(Boolean); needsReembed = true; }

  if (removeImage && entry.imageFile) {
    await fs.unlink(path.join(IMAGES_DIR, entry.imageFile)).catch(() => {});
    entry.imageFile = null;
  }
  if (imageBase64) {
    if (entry.imageFile) await fs.unlink(path.join(IMAGES_DIR, entry.imageFile)).catch(() => {});
    const ext = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
    entry.imageFile = `${entry.id}.${ext}`;
    await ensureDirs();
    await fs.writeFile(path.join(IMAGES_DIR, entry.imageFile), Buffer.from(imageBase64, 'base64'));
  }

  if (needsReembed) {
    entry.embedding = await embedText(`${entry.title}\n${entry.text}\n${entry.tags.join(' ')}`);
  }
  entry.updatedAt = new Date().toISOString();
  await saveKB();
  return sanitize(entry);
}

export async function deleteEntry(id) {
  await loadKB();
  const idx = kbCache.entries.findIndex(e => e.id === id);
  if (idx === -1) throw new Error('Entrada no encontrada');
  const [removed] = kbCache.entries.splice(idx, 1);
  if (removed.imageFile) {
    await fs.unlink(path.join(IMAGES_DIR, removed.imageFile)).catch(() => {});
  }
  await saveKB();
  return true;
}

export async function listEntries() {
  await loadKB();
  return kbCache.entries.map(sanitize);
}

function sanitize(entry) {
  // No exponer el embedding (pesado e irrelevante para el panel)
  const { embedding, ...rest } = entry;
  return { ...rest, hasEmbedding: Array.isArray(embedding) && embedding.length > 0 };
}

export function getImagePath(imageFile) {
  // Evitar path traversal: solo nombre de archivo plano
  const safe = path.basename(imageFile);
  return path.join(IMAGES_DIR, safe);
}

// ---------- Búsqueda ----------

export async function search(query, { topK = DEFAULT_TOP_K, minScore = DEFAULT_MIN_SCORE } = {}) {
  await loadKB();
  if (kbCache.entries.length === 0) return [];

  const queryEmbedding = await embedText(query, 'RETRIEVAL_QUERY');

  const scored = kbCache.entries.map(entry => {
    let score;
    if (queryEmbedding && entry.embedding) {
      score = cosineSimilarity(queryEmbedding, entry.embedding);
    } else {
      score = keywordScore(query, entry);
    }
    return { entry, score };
  });

  return scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ entry, score }) => ({ ...sanitize(entry), imageFile: entry.imageFile, score: Number(score.toFixed(4)) }));
}

// Construye el bloque de contexto para inyectar en el prompt de la IA.
// Devuelve { context, images } donde images son coincidencias con foto.
export async function buildContext(query, opts = {}) {
  const results = await search(query, opts);
  if (results.length === 0) return { context: '', images: [], results: [] };

  const context = [
    'INFORMACIÓN DEL NEGOCIO (base de conocimiento interna — usa SOLO estos datos para responder sobre productos, precios, horarios o servicios; si la respuesta no está aquí, dilo honestamente):',
    ...results.map((r, i) => `[${i + 1}] ${r.title}\n${r.text}`)
  ].join('\n\n');

  const images = results
    .filter(r => r.imageFile && r.score >= (opts.imageMinScore ?? 0.68))
    .map(r => ({ title: r.title, imagePath: getImagePath(r.imageFile), score: r.score }));

  return { context, images, results };
}

// Reembeder todas las entradas (útil si se agregó la API key después)
export async function reindexAll() {
  await loadKB();
  let ok = 0, failed = 0;
  for (const entry of kbCache.entries) {
    const emb = await embedText(`${entry.title}\n${entry.text}\n${(entry.tags || []).join(' ')}`);
    if (emb) { entry.embedding = emb; ok++; } else { failed++; }
  }
  await saveKB();
  return { ok, failed, total: kbCache.entries.length };
}
