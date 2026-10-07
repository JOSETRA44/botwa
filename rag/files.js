// Almacenamiento de archivos adjuntos del catálogo (imágenes y PDFs).
// Módulo sin estado: no sabe qué es una "entrada" del catálogo, solo
// guarda/borra/valida bytes bajo knowledge/files/{entryId}/{fileId}.{ext}.
// Extraído de rag.js en la Etapa 8 de la reestructuración — antes cada
// entrada tenía como máximo UNA imagen (imageFile, un string) guardada
// en una carpeta plana knowledge/images/; ahora cada entrada puede tener
// varios archivos (imágenes y PDFs), cada uno en su propia carpeta por
// entrada, lo que hace que borrar una entrada sea borrar una carpeta en
// vez de rastrear N archivos sueltos.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, '..', 'knowledge');
const FILES_DIR = path.join(KNOWLEDGE_DIR, 'files');
// Carpeta vieja (formato anterior a la Etapa 8) — solo se lee para migrar,
// nunca se escribe aquí de nuevo.
const LEGACY_IMAGES_DIR = path.join(KNOWLEDGE_DIR, 'images');

export const MAX_FILES_PER_ENTRY = 5;
export const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB por archivo
export const MAX_TOTAL_SIZE_BYTES = 20 * 1024 * 1024; // 20MB por entrada

// Whitelist de mimes aceptados. `magic` son los primeros bytes reales del
// archivo — validar contra esto (no solo el mime que declara el cliente)
// evita que alguien suba un ejecutable disfrazado de imagen.
const MIME_INFO = {
  'image/png': { ext: 'png', kind: 'image', magic: [0x89, 0x50, 0x4e, 0x47] },
  'image/jpeg': { ext: 'jpg', kind: 'image', magic: [0xff, 0xd8, 0xff] },
  'image/webp': { ext: 'webp', kind: 'image', magic: null }, // se valida por RIFF/WEBP, ver checkMagicBytes
  'application/pdf': { ext: 'pdf', kind: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] } // %PDF
};

function entryDir(entryId) {
  // path.basename evita path traversal (../../etc)
  return path.join(FILES_DIR, path.basename(entryId));
}

function checkMagicBytes(buffer, mime) {
  const info = MIME_INFO[mime];
  if (!info) return false;
  if (mime === 'image/webp') {
    return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return info.magic.every((byte, i) => buffer[i] === byte);
}

// Valida y guarda uno o más archivos nuevos para una entrada. `existingCount`
// es cuántos archivos ya tiene la entrada (para no superar MAX_FILES_PER_ENTRY
// al agregar más desde updateEntry).
export async function saveFiles(entryId, files, existingCount = 0) {
  if (!Array.isArray(files) || files.length === 0) return [];

  if (existingCount + files.length > MAX_FILES_PER_ENTRY) {
    throw new Error(`Máximo ${MAX_FILES_PER_ENTRY} archivos por entrada (ya hay ${existingCount}, se intentaron agregar ${files.length})`);
  }

  let totalSize = 0;
  const prepared = [];
  for (const file of files) {
    const info = MIME_INFO[file.mime];
    if (!info) throw new Error(`Tipo de archivo no permitido: ${file.mime}`);

    const buffer = Buffer.from(file.base64, 'base64');
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`"${file.filename || 'archivo'}" supera el máximo de ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB por archivo`);
    }
    if (!checkMagicBytes(buffer, file.mime)) {
      throw new Error(`"${file.filename || 'archivo'}" no coincide con el tipo declarado (${file.mime})`);
    }

    totalSize += buffer.length;
    prepared.push({ buffer, mime: file.mime, info, description: String(file.description || '').slice(0, 300) });
  }

  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    throw new Error(`El total de archivos supera ${MAX_TOTAL_SIZE_BYTES / 1024 / 1024}MB por entrada`);
  }

  const dir = entryDir(entryId);
  await fs.mkdir(dir, { recursive: true });

  const saved = [];
  for (const { buffer, mime, info, description } of prepared) {
    const fileId = crypto.randomBytes(6).toString('hex');
    const filename = `${fileId}.${info.ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);
    saved.push({ id: fileId, filename, mime, kind: info.kind, description });
  }
  return saved;
}

export async function deleteFile(entryId, file) {
  await fs.unlink(path.join(entryDir(entryId), file.filename)).catch(() => {});
}

export async function deleteEntryFiles(entryId) {
  await fs.rm(entryDir(entryId), { recursive: true, force: true }).catch(() => {});
}

export function getFilePath(entryId, filename) {
  const safeEntryId = path.basename(entryId);
  const safeFilename = path.basename(filename);
  return path.join(FILES_DIR, safeEntryId, safeFilename);
}

// Migra una imagen del formato viejo (knowledge/images/{archivo}, un solo
// archivo plano por entrada) al nuevo layout por carpeta. Se usa una sola
// vez por entrada, desde rag/store.js, la primera vez que se carga un
// knowledge.json con el formato anterior a la Etapa 8.
export async function migrateLegacyImage(entryId, legacyFilename) {
  const legacyPath = path.join(LEGACY_IMAGES_DIR, path.basename(legacyFilename));
  try {
    const buffer = await fs.readFile(legacyPath);
    const ext = path.extname(legacyFilename).slice(1).toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const dir = entryDir(entryId);
    await fs.mkdir(dir, { recursive: true });
    const fileId = crypto.randomBytes(6).toString('hex');
    const filename = `${fileId}.${ext}`;
    await fs.writeFile(path.join(dir, filename), buffer);
    await fs.unlink(legacyPath).catch(() => {});

    return { id: fileId, filename, mime, kind: 'image', description: '' };
  } catch (error) {
    console.error(`⚠️ No se pudo migrar imagen legacy de la entrada ${entryId} (${legacyFilename}):`, error.message);
    return null;
  }
}
