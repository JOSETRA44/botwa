// Pruebas del sistema RAG dividido en la Etapa 8 de la reestructuración
// (rag/files.js, rag/store.js, rag/search.js, rag/entries.js, rag/index.js).
// Corre contra una carpeta de conocimiento aislada (nunca la real) — cada
// test usa su propio directorio temporal para no interferir entre sí ni
// con los datos reales del negocio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// PNG válido de 1x1 (bytes reales, no basura) — usado para probar
// validación de magic bytes con un archivo que sí es lo que dice ser.
const VALID_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const VALID_PDF_B64 = Buffer.from('%PDF-1.4\n%mock pdf for testing\n%%EOF').toString('base64');

// Cada prueba obtiene su propia copia del módulo rag/ en un directorio
// temporal aislado (import con cache-busting vía query string), para que
// el `kbCache` en memoria de un test no contamine a otro y para nunca
// tocar knowledge/ del proyecto real.
async function freshRagInstance() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'botwa-rag-test-'));
  // rag/*.js resuelve knowledge/ como `path.join(__dirname, '..', 'knowledge')`
  // — para que eso apunte a un directorio temporal aislado, rag/ debe
  // quedar como hermano directo de knowledge/ dentro de tmpRoot.
  await fs.mkdir(path.join(tmpRoot, 'rag'), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, 'knowledge'), { recursive: true });

  const ragDir = path.join(process.cwd(), 'rag');
  for (const file of ['files.js', 'store.js', 'search.js', 'entries.js', 'index.js']) {
    await fs.copyFile(path.join(ragDir, file), path.join(tmpRoot, 'rag', file));
  }

  const modUrl = `file:///${path.join(tmpRoot, 'rag', 'index.js').replace(/\\/g, '/')}`;
  const rag = await import(modUrl);
  return { rag, knowledgeDir: path.join(tmpRoot, 'knowledge'), tmpRoot };
}

test('addEntry sin archivos: files queda como arreglo vacío', async () => {
  const { rag } = await freshRagInstance();
  const entry = await rag.addEntry({ title: 'Solo texto', text: 'Sin adjuntos' });
  assert.deepEqual(entry.files, []);
});

test('addEntry con imagen y PDF: guarda ambos con su descripción', async () => {
  const { rag } = await freshRagInstance();
  const entry = await rag.addEntry({
    title: 'Producto', text: 'Descripción',
    files: [
      { base64: VALID_PNG_B64, mime: 'image/png', filename: 'foto.png', description: 'Foto del producto' },
      { base64: VALID_PDF_B64, mime: 'application/pdf', filename: 'ficha.pdf', description: 'Ficha técnica' }
    ]
  });
  assert.equal(entry.files.length, 2);
  assert.equal(entry.files[0].kind, 'image');
  assert.equal(entry.files[0].description, 'Foto del producto');
  assert.equal(entry.files[1].kind, 'pdf');
});

test('rechaza un mime fuera de la whitelist', async () => {
  const { rag } = await freshRagInstance();
  await assert.rejects(
    () => rag.addEntry({ title: 'x', text: 'y', files: [{ base64: 'AAAA', mime: 'application/exe', filename: 'virus.exe' }] }),
    /no permitido/
  );
});

test('rechaza un archivo cuyo contenido no coincide con el mime declarado (magic bytes)', async () => {
  const { rag } = await freshRagInstance();
  const fakeB64 = Buffer.from('esto no es un pdf real').toString('base64');
  await assert.rejects(
    () => rag.addEntry({ title: 'x', text: 'y', files: [{ base64: fakeB64, mime: 'application/pdf', filename: 'falso.pdf' }] }),
    /no coincide con el tipo declarado/
  );
});

test('respeta MAX_FILES_PER_ENTRY', async () => {
  const { rag } = await freshRagInstance();
  const files = Array.from({ length: rag.MAX_FILES_PER_ENTRY + 1 }, (_, i) => ({
    base64: VALID_PNG_B64, mime: 'image/png', filename: `f${i}.png`, description: ''
  }));
  await assert.rejects(() => rag.addEntry({ title: 'x', text: 'y', files }), /Máximo/);
});

test('updateEntry agrega archivos sin borrar los existentes', async () => {
  const { rag } = await freshRagInstance();
  const entry = await rag.addEntry({
    title: 'x', text: 'y',
    files: [{ base64: VALID_PNG_B64, mime: 'image/png', filename: 'a.png', description: 'A' }]
  });
  const updated = await rag.updateEntry(entry.id, {
    files: [{ base64: VALID_PNG_B64, mime: 'image/png', filename: 'b.png', description: 'B' }]
  });
  assert.equal(updated.files.length, 2);
});

test('updateEntry con removeFileIds borra solo el archivo indicado', async () => {
  const { rag } = await freshRagInstance();
  const entry = await rag.addEntry({
    title: 'x', text: 'y',
    files: [
      { base64: VALID_PNG_B64, mime: 'image/png', filename: 'a.png', description: 'A' },
      { base64: VALID_PDF_B64, mime: 'application/pdf', filename: 'b.pdf', description: 'B' }
    ]
  });
  const targetId = entry.files[0].id;
  const updated = await rag.updateEntry(entry.id, { removeFileIds: [targetId] });
  assert.equal(updated.files.length, 1);
  assert.notEqual(updated.files[0].id, targetId);
});

test('updateEntry con removeImage (compat) borra todas las imágenes pero no los PDF', async () => {
  const { rag } = await freshRagInstance();
  const entry = await rag.addEntry({
    title: 'x', text: 'y',
    files: [
      { base64: VALID_PNG_B64, mime: 'image/png', filename: 'a.png', description: '' },
      { base64: VALID_PDF_B64, mime: 'application/pdf', filename: 'b.pdf', description: '' }
    ]
  });
  const updated = await rag.updateEntry(entry.id, { removeImage: true });
  assert.equal(updated.files.length, 1);
  assert.equal(updated.files[0].kind, 'pdf');
});

test('deleteEntry borra la carpeta completa de archivos de esa entrada', async () => {
  const { rag, knowledgeDir } = await freshRagInstance();
  const entry = await rag.addEntry({
    title: 'x', text: 'y',
    files: [{ base64: VALID_PNG_B64, mime: 'image/png', filename: 'a.png', description: '' }]
  });
  await rag.deleteEntry(entry.id);
  const entryDir = path.join(knowledgeDir, 'files', entry.id);
  await assert.rejects(() => fs.access(entryDir));
});

test('invariante: knowledge.json nunca contiene bytes/base64, solo metadata', async () => {
  const { rag, knowledgeDir } = await freshRagInstance();
  await rag.addEntry({
    title: 'x', text: 'y',
    files: [{ base64: VALID_PNG_B64, mime: 'image/png', filename: 'a.png', description: 'desc' }]
  });
  const raw = await fs.readFile(path.join(knowledgeDir, 'knowledge.json'), 'utf8');
  assert.doesNotMatch(raw, /base64/i);
  assert.ok(!raw.includes(VALID_PNG_B64.slice(0, 20)), 'no debe contener los bytes reales del archivo');
});

test('migración: una entrada con el formato viejo (imageFile string) se convierte a files[]', async () => {
  const { rag, knowledgeDir } = await freshRagInstance();

  // Simula una base de conocimiento del formato anterior a la Etapa 8
  await fs.mkdir(path.join(knowledgeDir, 'images'), { recursive: true });
  await fs.writeFile(path.join(knowledgeDir, 'images', 'legacy.png'), Buffer.from(VALID_PNG_B64, 'base64'));
  await fs.writeFile(path.join(knowledgeDir, 'knowledge.json'), JSON.stringify({
    entries: [{ id: 'legacy1', title: 'Entrada vieja', text: 'texto', tags: [], imageFile: 'legacy.png', embedding: null, updatedAt: '2024-01-01' }]
  }));

  const entries = await rag.listEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].files.length, 1);
  assert.equal(entries[0].files[0].kind, 'image');
  assert.equal(entries[0].imageFile, undefined, 'el campo viejo no debe sobrevivir a la migración');

  const migratedPath = path.join(knowledgeDir, 'files', 'legacy1', entries[0].files[0].filename);
  await assert.doesNotReject(() => fs.access(migratedPath), 'el archivo debe existir en el layout nuevo');
});

test('search y buildContext siguen funcionando tras la división en módulos', async () => {
  const { rag } = await freshRagInstance();
  await rag.addEntry({ title: 'Pizza Familiar', text: 'Cuesta S/35', tags: ['pizza', 'precio'] });
  const results = await rag.search('pizza', { minScore: 0 });
  assert.ok(results.length > 0);
  const ctx = await rag.buildContext('pizza', { minScore: 0 });
  assert.match(ctx.context, /Pizza Familiar/);
});
