// Pruebas de whatsapp/messageHandler.js (processUserQueue) — extraído de
// bot.js en la Etapa 5 de la reestructuración. Todas las dependencias van
// mockeadas: sin red, sin WhatsApp real, sin esperas reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserQueueStore } from '../whatsapp/queue.js';
import { processUserQueue } from '../whatsapp/messageHandler.js';

function baseDeps(overrides = {}) {
  const queueStore = overrides.queueStore || createUserQueueStore();
  const addLogCalls = [];
  return {
    queueStore,
    canSendMessage: overrides.canSendMessage || (() => true),
    incrementMessageCount: overrides.incrementMessageCount || (() => {}),
    config: { delayMin: 0, delayMax: 0, ...overrides.config },
    botState: { logsEnabled: false, messagesSentLastHour: 1, ...overrides.botState },
    addLog: overrides.addLog || ((msg, type) => addLogCalls.push({ msg, type })),
    appLogger: { error: () => {} },
    randomDelay: overrides.randomDelay || (() => Promise.resolve()),
    simulateTyping: overrides.simulateTyping || (() => Promise.resolve()),
    answerQuery: overrides.answerQuery || (async () => ({ text: 'respuesta', attachments: [] })),
    processAIResponseWithFormulas: overrides.processAIResponseWithFormulas || (async () => {}),
    sendEntryFiles: overrides.sendEntryFiles || (async () => {}),
    maxMessagesInGroup: overrides.maxMessagesInGroup ?? 5,
    groupingDelayMs: overrides.groupingDelayMs ?? 10,
    maxMessagesPerHour: overrides.maxMessagesPerHour ?? 100,
    _addLogCalls: addLogCalls
  };
}

test('no hace nada si la cola ya está procesando', async () => {
  const queueStore = createUserQueueStore();
  queueStore.add('u1', { text: 'hola', remoteJid: 'u1@s.whatsapp.net', msg: {} });
  queueStore.getOrCreate('u1').processing = true;

  let called = false;
  const deps = baseDeps({ queueStore, answerQuery: async () => { called = true; return { text: '', attachments: [] }; } });
  await processUserQueue('u1', {}, () => deps);
  assert.equal(called, false);
});

test('sin mensajes en cola: limpia el timeout y no hace nada', async () => {
  const queueStore = createUserQueueStore();
  const queue = queueStore.getOrCreate('u1');
  queue.timeout = setTimeout(() => {}, 100000);
  const deps = baseDeps({ queueStore });
  await processUserQueue('u1', {}, () => deps);
  assert.equal(queue.timeout, null);
});

test('camino feliz: procesa un mensaje, llama answerQuery y envía la respuesta', async () => {
  const queueStore = createUserQueueStore();
  const lastMsg = { key: { id: 'abc' } };
  queueStore.add('u1', { text: 'hola', remoteJid: 'u1@s.whatsapp.net', isGroup: false, msg: lastMsg });

  let formulasArgs = null;
  const deps = baseDeps({
    queueStore,
    answerQuery: async (query) => { assert.equal(query, 'hola'); return { text: 'respuesta IA', attachments: [] }; },
    processAIResponseWithFormulas: async (text, sock, remoteJid, quotedMsg) => { formulasArgs = { text, remoteJid, quotedMsg }; }
  });

  await processUserQueue('u1', { fake: 'sock' }, () => deps);

  assert.deepEqual(formulasArgs, { text: 'respuesta IA', remoteJid: 'u1@s.whatsapp.net', quotedMsg: lastMsg });
  assert.equal(queueStore.getOrCreate('u1').processing, false);
});

test('agrupa varios mensajes con el prefijo "Mensaje N:"', async () => {
  const queueStore = createUserQueueStore();
  queueStore.add('u1', { text: 'primero', remoteJid: 'u1@s.whatsapp.net', msg: {} });
  queueStore.add('u1', { text: 'segundo', remoteJid: 'u1@s.whatsapp.net', msg: {} });

  let receivedQuery = null;
  const deps = baseDeps({
    queueStore,
    answerQuery: async (query) => { receivedQuery = query; return { text: 'ok', attachments: [] }; }
  });
  await processUserQueue('u1', {}, () => deps);
  assert.equal(receivedQuery, 'Mensaje 1: primero\nMensaje 2: segundo');
});

test('envía los adjuntos del RAG cuando la respuesta trae alguno', async () => {
  const queueStore = createUserQueueStore();
  queueStore.add('u1', { text: 'hola', remoteJid: 'u1@s.whatsapp.net', msg: {} });

  let sentAttachments = null;
  const deps = baseDeps({
    queueStore,
    answerQuery: async () => ({ text: 'ok', attachments: [{ title: 'A', filePath: '/a.jpg', kind: 'image' }] }),
    sendEntryFiles: async (sock, remoteJid, attachments) => { sentAttachments = attachments; }
  });
  await processUserQueue('u1', {}, () => deps);
  assert.equal(sentAttachments.length, 1);
});

test('límite de mensajes por hora alcanzado: no llama a answerQuery ni incrementa el contador', async () => {
  const queueStore = createUserQueueStore();
  queueStore.add('u1', { text: 'hola', remoteJid: 'u1@s.whatsapp.net', msg: {} });

  let calledAnswer = false;
  let calledIncrement = false;
  const deps = baseDeps({
    queueStore,
    canSendMessage: () => false,
    answerQuery: async () => { calledAnswer = true; return { text: '', attachments: [] }; },
    incrementMessageCount: () => { calledIncrement = true; }
  });
  await processUserQueue('u1', {}, () => deps);
  assert.equal(calledAnswer, false);
  assert.equal(calledIncrement, false);
  assert.equal(queueStore.getOrCreate('u1').processing, false);
});

test('si answerQuery lanza, el error se captura y no se propaga', async () => {
  const queueStore = createUserQueueStore();
  queueStore.add('u1', { text: 'hola', remoteJid: 'u1@s.whatsapp.net', msg: {} });

  let loggedError = null;
  const deps = baseDeps({
    queueStore,
    answerQuery: async () => { throw new Error('boom'); },
    appLoggerOverride: undefined
  });
  deps.appLogger = { error: (obj, msg) => { loggedError = { obj, msg }; } };

  await processUserQueue('u1', {}, () => deps);
  assert.ok(loggedError);
  assert.equal(loggedError.msg, 'Error al procesar cola de usuario');
  assert.equal(queueStore.getOrCreate('u1').processing, false, 'processing debe resetearse incluso si hubo error');
});

test('si quedan mensajes tras procesar el lote (más de maxMessagesInGroup), reprograma el timeout', async () => {
  const queueStore = createUserQueueStore({ maxQueueSize: 10 });
  for (let i = 0; i < 3; i++) {
    queueStore.add('u1', { text: `msg${i}`, remoteJid: 'u1@s.whatsapp.net', msg: {} });
  }
  const deps = baseDeps({ queueStore, maxMessagesInGroup: 2, groupingDelayMs: 5 });
  await processUserQueue('u1', {}, () => deps);

  const queue = queueStore.getOrCreate('u1');
  assert.equal(queue.messages.length, 1, 'debe quedar 1 mensaje sin procesar (3 - maxMessagesInGroup=2)');
  assert.notEqual(queue.timeout, null, 'debe haber programado un reintento');
  clearTimeout(queue.timeout);
});
