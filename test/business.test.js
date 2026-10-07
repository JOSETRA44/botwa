// Pruebas de commands/business.js — /catalogo reescrito en la Etapa 10
// con paginación determinista (Baileys no soporta de forma confiable
// botones/listas nativas, así que la navegación es por texto) y envío
// enriquecido de adjuntos (imágenes y PDFs con su descripción real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBusinessCommands } from '../commands/business.js';

function fakeSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content, opts) => sent.push({ jid, content, opts }) };
}

function entry(id, title, files = []) {
  return { id, title, text: `Texto de ${title}`, tags: [], files, score: 1 };
}

function baseCtx(overrides = {}) {
  const sentFiles = [];
  return {
    simulateTyping: async () => {},
    rag: {
      listEntries: overrides.listEntries || (async () => []),
      search: overrides.search || (async () => [])
    },
    formatKbAnswer: (results) => results.map((r) => `*${r.title}*\n${r.text}`).join('\n\n'),
    KB_ANSWER_INTRO_COMMAND: '📚 Esto encontré:',
    kbResultsToAttachments: (results) => results.flatMap((r) => (r.files || []).map((f) => ({ title: r.title, ...f }))),
    sendEntryFiles: overrides.sendEntryFiles || (async (sock, jid, attachments) => sentFiles.push(...attachments)),
    answerQuery: overrides.answerQuery || (async () => ({ text: 'respuesta', attachments: [] })),
    processAIResponseWithFormulas: overrides.processAIResponseWithFormulas || (async (text, sock, jid, msg) => {
      await sock.sendMessage(jid, { text }, { quoted: msg });
    }),
    _sentFiles: sentFiles
  };
}

const { '/catalogo': catalogo, '/pregunta': pregunta } = createBusinessCommands();

test('/catalogo sin argumento, catálogo vacío: avisa que está vacía', async () => {
  const sock = fakeSock();
  const ctx = baseCtx({ listEntries: async () => [] });
  await catalogo('/catalogo', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /está vacía/);
});

test('/catalogo sin argumento: lista numerada en orden estable por id', async () => {
  const sock = fakeSock();
  const entries = [entry('bbb', 'Segundo'), entry('aaa', 'Primero'), entry('ccc', 'Tercero')];
  const ctx = baseCtx({ listEntries: async () => entries });
  await catalogo('/catalogo', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  const text = sock.sent[0].content.text;
  // orden por id: aaa, bbb, ccc -> Primero, Segundo, Tercero
  assert.ok(text.indexOf('1. ') < text.indexOf('Primero'));
  assert.ok(text.indexOf('Primero') < text.indexOf('Segundo'));
  assert.ok(text.indexOf('Segundo') < text.indexOf('Tercero'));
});

test('/catalogo pagina cuando hay más de 10 entradas', async () => {
  const sock = fakeSock();
  const entries = Array.from({ length: 15 }, (_, i) => entry(String(i).padStart(3, '0'), `Producto ${i}`));
  const ctx = baseCtx({ listEntries: async () => entries });
  await catalogo('/catalogo', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /Página 1\/2/);
  assert.match(sock.sent[0].content.text, /catalogo p2/);
});

test('/catalogo p2 muestra la segunda página', async () => {
  const sock = fakeSock();
  const entries = Array.from({ length: 15 }, (_, i) => entry(String(i).padStart(3, '0'), `Producto ${i}`));
  const ctx = baseCtx({ listEntries: async () => entries });
  await catalogo('/catalogo p2', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /Página 2\/2/);
  assert.match(sock.sent[0].content.text, /Producto 10/); // ítem #11 (índice 10) es el primero de la página 2
});

test('/catalogo [número] muestra el detalle de ese producto y envía sus archivos', async () => {
  const sock = fakeSock();
  const entries = [
    entry('aaa', 'Primero', [{ id: 'f1', filename: 'a.jpg', mime: 'image/jpeg', kind: 'image', description: 'Foto A' }]),
    entry('bbb', 'Segundo')
  ];
  const ctx = baseCtx({ listEntries: async () => entries });
  await catalogo('/catalogo 1', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /Primero/);
  assert.equal(ctx._sentFiles.length, 1);
  assert.equal(ctx._sentFiles[0].description, 'Foto A');
});

test('/catalogo [número inválido] responde con error claro, sin lanzar', async () => {
  const sock = fakeSock();
  const entries = [entry('aaa', 'Primero')];
  const ctx = baseCtx({ listEntries: async () => entries });
  await catalogo('/catalogo 99', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /No hay ningún producto/);
});

test('/catalogo [texto] hace búsqueda semántica y envía los adjuntos de las coincidencias', async () => {
  const sock = fakeSock();
  const searchResults = [entry('x1', 'Pizza', [{ id: 'f1', filename: 'p.jpg', mime: 'image/jpeg', kind: 'image', description: 'Pizza rica' }])];
  const ctx = baseCtx({ listEntries: async () => searchResults, search: async () => searchResults });
  await catalogo('/catalogo pizza', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /Pizza/);
  assert.equal(ctx._sentFiles.length, 1);
});

test('/catalogo [texto] sin coincidencias: mensaje claro, no lanza', async () => {
  const sock = fakeSock();
  const ctx = baseCtx({ listEntries: async () => [entry('a', 'algo')], search: async () => [] });
  await catalogo('/catalogo inexistente', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.match(sock.sent[0].content.text, /No encontré nada/);
});

test('/pregunta envía los adjuntos de la respuesta si los hay', async () => {
  const sock = fakeSock();
  const ctx = baseCtx({
    answerQuery: async () => ({ text: 'la respuesta', attachments: [{ title: 'x', filePath: '/x.jpg', kind: 'image' }] })
  });
  await pregunta('/pregunta algo', sock, 'user@s.whatsapp.net', { key: {} }, ctx);
  assert.equal(ctx._sentFiles.length, 1);
});
