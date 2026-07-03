// Pruebas de whatsapp/queue.js — extraído de bot.js en la Etapa 3 de la
// reestructuración. Estructura de datos pura, sin I/O.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUserQueueStore } from '../whatsapp/queue.js';

test('getOrCreate: crea una cola vacía para un usuario nuevo', () => {
  const store = createUserQueueStore();
  const queue = store.getOrCreate('user1');
  assert.deepEqual(queue.messages, []);
  assert.equal(queue.processing, false);
  assert.equal(queue.timeout, null);
});

test('getOrCreate: devuelve la misma cola en llamadas repetidas', () => {
  const store = createUserQueueStore();
  const first = store.getOrCreate('user1');
  first.processing = true;
  const second = store.getOrCreate('user1');
  assert.equal(second.processing, true, 'debe ser el mismo objeto, no uno nuevo');
});

test('add: agrega mensajes al buffer y actualiza lastMessage', () => {
  const store = createUserQueueStore();
  const ok = store.add('user1', { text: 'hola' });
  assert.equal(ok, true);
  const queue = store.getOrCreate('user1');
  assert.equal(queue.messages.length, 1);
  assert.equal(queue.messages[0].text, 'hola');
});

test('add: respeta el límite maxQueueSize', () => {
  const store = createUserQueueStore({ maxQueueSize: 2 });
  assert.equal(store.add('user1', { text: '1' }), true);
  assert.equal(store.add('user1', { text: '2' }), true);
  assert.equal(store.add('user1', { text: '3' }), false, 'la 3ra debe rechazarse, cola llena');
  assert.equal(store.getOrCreate('user1').messages.length, 2);
});

test('add: las colas de distintos usuarios son independientes', () => {
  const store = createUserQueueStore({ maxQueueSize: 1 });
  assert.equal(store.add('user1', { text: 'a' }), true);
  assert.equal(store.add('user2', { text: 'b' }), true, 'user2 no debe verse afectado por el límite de user1');
});
