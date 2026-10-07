// ============================================================
// RAG (Retrieval-Augmented Generation) - Base de Conocimiento
// ============================================================
// Permite que un negocio cargue información propia (productos,
// precios, horarios, catálogos con imágenes y PDFs) y que el bot la use
// para responder con datos reales en vez de inventar.
//
// Dividido en la Etapa 8 de la reestructuración (antes era un solo
// rag.js de 277 líneas mezclando persistencia, archivos y búsqueda):
// - rag/files.js   — guardar/borrar/validar archivos en disco (sin estado)
// - rag/store.js   — persistencia de knowledge.json + migración de formato
// - rag/search.js  — embeddings + búsqueda semántica
// - rag/entries.js — orquestador CRUD (addEntry/updateEntry/deleteEntry)
//
// Este archivo es la fachada pública: bot.js/server.js/commands/business.js
// siguen haciendo `import * as rag from './rag/index.js'` exactamente
// igual que antes de la división.
// ============================================================

export { HIGH_CONFIDENCE_SCORE, embedText, search, buildContext, reindexAll } from './search.js';
export { addEntry, updateEntry, deleteEntry, listEntries } from './entries.js';
export { getFilePath, MAX_FILES_PER_ENTRY, MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES } from './files.js';
