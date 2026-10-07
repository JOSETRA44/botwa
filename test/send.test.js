// Pruebas de whatsapp/send.js (sendEntryFiles) — generalizado en la Etapa
// 10 de la reestructuración para enviar imágenes Y PDFs con su
// descripción real, con un presupuesto global de adjuntos por respuesta
// (no por entrada) y sin esperas reales entre envíos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendEntryFiles, MAX_ATTACHMENTS_PER_RESPONSE } from '../whatsapp/send.js';

function fakeSock() {
  const sent = [];
  return { sent, sendMessage: async (jid, content, opts) => sent.push({ jid, content, opts }) };
}

const instantSleep = () => Promise.resolve();

test('envía una imagen con su descripción real como caption', async () => {
  const sock = fakeSock();
  const attachments = [{ title: 'Pizza', description: 'Pizza familiar S/35', filePath: '/a.jpg', kind: 'image' }];
  const readFile = async () => Buffer.from('fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.equal(sock.sent.length, 1);
  assert.equal(sock.sent[0].content.image !== undefined, true);
  assert.equal(sock.sent[0].content.caption, 'Pizza familiar S/35');
});

test('si el archivo no tiene descripción, usa el título como caption', async () => {
  const sock = fakeSock();
  const attachments = [{ title: 'Pizza', filePath: '/a.jpg', kind: 'image' }];
  const readFile = async () => Buffer.from('fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.equal(sock.sent[0].content.caption, 'Pizza');
});

test('envía un PDF como document, no como image', async () => {
  const sock = fakeSock();
  const attachments = [{ title: 'Menú', description: 'Menú completo', filePath: '/menu.pdf', mime: 'application/pdf', kind: 'pdf' }];
  const readFile = async () => Buffer.from('%PDF-fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.equal(sock.sent[0].content.document !== undefined, true);
  assert.equal(sock.sent[0].content.image, undefined);
  assert.equal(sock.sent[0].content.fileName, 'Menú.pdf');
});

test('respeta el presupuesto global MAX_ATTACHMENTS_PER_RESPONSE aunque vengan más', async () => {
  const sock = fakeSock();
  const attachments = Array.from({ length: MAX_ATTACHMENTS_PER_RESPONSE + 5 }, (_, i) => ({
    title: `Item ${i}`, filePath: `/item${i}.jpg`, kind: 'image'
  }));
  const readFile = async () => Buffer.from('fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.equal(sock.sent.length, MAX_ATTACHMENTS_PER_RESPONSE);
});

test('trunca captions muy largos', async () => {
  const sock = fakeSock();
  const longDescription = 'x'.repeat(2000);
  const attachments = [{ title: 'x', description: longDescription, filePath: '/a.jpg', kind: 'image' }];
  const readFile = async () => Buffer.from('fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.ok(sock.sent[0].content.caption.length < 1010);
  assert.ok(sock.sent[0].content.caption.endsWith('…'));
});

test('cita el mensaje original cuando se pasa quotedMsg', async () => {
  const sock = fakeSock();
  const quotedMsg = { key: { id: 'abc' } };
  const readFile = async () => Buffer.from('fake');
  await sendEntryFiles(sock, 'user@s.whatsapp.net', [{ title: 'A', filePath: '/a.jpg', kind: 'image' }], quotedMsg, { readFile, sleep: instantSleep });
  assert.deepEqual(sock.sent[0].opts, { quoted: quotedMsg });
});

test('si falla la lectura de un archivo, continúa con los demás sin lanzar', async () => {
  const sock = fakeSock();
  const attachments = [
    { title: 'Rota', filePath: '/rota.jpg', kind: 'image' },
    { title: 'Buena', filePath: '/buena.jpg', kind: 'image' }
  ];
  const readFile = async (path) => {
    if (path === '/rota.jpg') throw new Error('no existe');
    return Buffer.from('fake');
  };
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, { readFile, sleep: instantSleep });
  assert.equal(sock.sent.length, 1);
  assert.equal(sock.sent[0].content.caption, 'Buena');
});

test('sin adjuntos, no llama a sendMessage', async () => {
  const sock = fakeSock();
  await sendEntryFiles(sock, 'user@s.whatsapp.net', [], null, { readFile: async () => Buffer.from('x'), sleep: instantSleep });
  assert.equal(sock.sent.length, 0);
});

test('espera entre envíos sucesivos pero no después del último', async () => {
  const sock = fakeSock();
  const waits = [];
  const attachments = [
    { title: 'A', filePath: '/a.jpg', kind: 'image' },
    { title: 'B', filePath: '/b.jpg', kind: 'image' }
  ];
  await sendEntryFiles(sock, 'user@s.whatsapp.net', attachments, null, {
    readFile: async () => Buffer.from('fake'),
    sleep: (ms) => { waits.push(ms); return Promise.resolve(); }
  });
  assert.equal(waits.length, 1, 'debe esperar entre el 1ro y el 2do, pero no después del último');
});
