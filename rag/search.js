// Embeddings y búsqueda semántica. Extraído de rag.js en la Etapa 8 de la
// reestructuración — sin cambios de lógica respecto a la versión anterior,
// solo movido de archivo. `buildContext` ahora arma `attachments` a partir
// de `files[]` (puede haber varias imágenes/PDFs por coincidencia) en vez
// de una sola imagen por entrada.
import { loadKB, saveKB, sanitize } from './store.js';
import { getFilePath } from './files.js';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMS = 768; // dimensión reducida: suficiente para RAG y aligera el JSON
const DEFAULT_TOP_K = 3;
// gemini-embedding-001 da similitudes con piso alto (~0.55 incluso para
// consultas sin relación); 0.65 separa bien relevante de irrelevante.
const DEFAULT_MIN_SCORE = 0.65;
// Umbral de "alta confianza": por encima de esto, el bot puede responder
// directo desde el catálogo sin pasar por la IA (modos hybrid/direct de
// bot.js). Más alto que DEFAULT_MIN_SCORE porque aquí la barra es
// "esto ES la respuesta", no solo "podría ser relevante".
export const HIGH_CONFIDENCE_SCORE = 0.80;

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

export async function embedText(text, taskType = 'RETRIEVAL_DOCUMENT', retriesLeft = 2) {
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

export async function search(query, { topK = DEFAULT_TOP_K, minScore = DEFAULT_MIN_SCORE } = {}) {
  const kbCache = await loadKB();
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
    .map(({ entry, score }) => ({ ...sanitize(entry), score: Number(score.toFixed(4)) }));
}

// Construye el bloque de contexto para inyectar en el prompt de la IA.
// Devuelve { context, images, attachments, results }:
// - context: solo texto (título+text de cada resultado)
// - images: compatibilidad con el consumo actual de bot.js (una imagen
//   por coincidencia, mismo shape que antes de la Etapa 8)
// - attachments: TODOS los archivos (imágenes y PDFs) de las coincidencias,
//   con su descripción real — lo que usará el envío enriquecido (Etapa 10)
export async function buildContext(query, opts = {}) {
  const results = await search(query, opts);
  if (results.length === 0) return { context: '', images: [], attachments: [], results: [] };

  const context = [
    'INFORMACIÓN DEL NEGOCIO (base de conocimiento interna — usa SOLO estos datos para responder sobre productos, precios, horarios o servicios; si la respuesta no está aquí, dilo honestamente):',
    ...results.map((r, i) => `[${i + 1}] ${r.title}\n${r.text}`)
  ].join('\n\n');

  const attachmentMinScore = opts.attachmentMinScore ?? 0.68;
  const relevant = results.filter(r => r.score >= attachmentMinScore);

  const attachments = relevant.flatMap(r => (r.files || []).map(f => ({
    title: r.title,
    description: f.description,
    filePath: getFilePath(r.id, f.filename),
    mime: f.mime,
    kind: f.kind,
    score: r.score
  })));

  const images = relevant
    .map(r => ({ id: r.id, title: r.title, file: (r.files || []).find(f => f.kind === 'image'), score: r.score }))
    .filter(r => r.file)
    .map(r => ({ title: r.title, imagePath: getFilePath(r.id, r.file.filename), score: r.score }));

  return { context, images, attachments, results };
}

// Reembeder todas las entradas (útil si se agregó la API key después)
export async function reindexAll() {
  const kbCache = await loadKB();
  let ok = 0, failed = 0;
  for (const entry of kbCache.entries) {
    const emb = await embedText(`${entry.title}\n${entry.text}\n${(entry.tags || []).join(' ')}`);
    if (emb) { entry.embedding = emb; ok++; } else { failed++; }
  }
  await saveKB();
  return { ok, failed, total: kbCache.entries.length };
}
