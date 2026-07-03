// Pruebas de whatsapp/send.js — extraído de bot.js en la Etapa 3 de la
// reestructuración. `readFile` inyectado para no tocar el disco real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendRagImages } from '../whatsapp/send.js';

function fakeSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content, opts) => sent.push({ jid, content, opts }) };
}

test('envía hasta un máximo de 2 imágenes aunque haya más', async () => {
  const sock = fakeSock();
  const images = [
    { title: 'A', imagePath: '/a.jpg' },
    { title: 'B', imagePath: '/b.jpg' },
    { title: 'C', imagePath: '/c.jpg' }
  ];
  const readFile = async () => Buffer.from('fake');
  await sendRagImages(sock, 'user@s.whatsapp.net', images, null, { readFile });
  assert.equal(sock.sent.length, 2);
  assert.equal(sock.sent[0].content.caption, '📦 A');
  assert.equal(sock.sent[1].content.caption, '📦 B');
});

test('cita el mensaje original cuando se pasa quotedMsg', async () => {
  const sock = fakeSock();
  const quotedMsg = { key: { id: 'abc' } };
  const readFile = async () => Buffer.from('fake');
  await sendRagImages(sock, 'user@s.whatsapp.net', [{ title: 'A', imagePath: '/a.jpg' }], quotedMsg, { readFile });
  assert.deepEqual(sock.sent[0].opts, { quoted: quotedMsg });
});

test('si falla la lectura de una imagen, continúa con las demás sin lanzar', async () => {
  const sock = fakeSock();
  const images = [
    { title: 'Rota', imagePath: '/rota.jpg' },
    { title: 'Buena', imagePath: '/buena.jpg' }
  ];
  const readFile = async (path) => {
    if (path === '/rota.jpg') throw new Error('no existe');
    return Buffer.from('fake');
  };
  await sendRagImages(sock, 'user@s.whatsapp.net', images, null, { readFile });
  assert.equal(sock.sent.length, 1);
  assert.equal(sock.sent[0].content.caption, '📦 Buena');
});

test('sin imágenes, no llama a sendMessage', async () => {
  const sock = fakeSock();
  await sendRagImages(sock, 'user@s.whatsapp.net', [], null, { readFile: async () => Buffer.from('x') });
  assert.equal(sock.sent.length, 0);
});
