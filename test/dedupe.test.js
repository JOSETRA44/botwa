// Pruebas de whatsapp/dedupe.js — la segunda capa de defensa contra
// respuestas duplicadas (la primera es el filtro por type:'notify' en
// bot.js, ver BOTWA-docs/Fixes/Diagnostico de Respuestas Duplicadas.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMessageDeduper } from '../whatsapp/dedupe.js';

test('un id nuevo nunca se debe saltar', () => {
  const deduper = createMessageDeduper();
  assert.equal(deduper.shouldSkip('abc'), false);
});

test('un id ya recordado se debe saltar', () => {
  const deduper = createMessageDeduper();
  deduper.remember('abc');
  assert.equal(deduper.shouldSkip('abc'), true);
});

test('ids distintos no interfieren entre sí', () => {
  const deduper = createMessageDeduper();
  deduper.remember('abc');
  assert.equal(deduper.shouldSkip('xyz'), false);
});

test('id vacío/undefined nunca se salta (no bloquea mensajes sin id)', () => {
  const deduper = createMessageDeduper();
  assert.equal(deduper.shouldSkip(undefined), false);
  assert.equal(deduper.shouldSkip(null), false);
  assert.equal(deduper.shouldSkip(''), false);
  deduper.remember(undefined);
  assert.equal(deduper.shouldSkip(undefined), false);
});

test('respeta maxSize con desalojo FIFO (el id más antiguo se olvida primero)', () => {
  const deduper = createMessageDeduper({ maxSize: 3 });
  deduper.remember('a');
  deduper.remember('b');
  deduper.remember('c');
  deduper.remember('d'); // debe desalojar 'a'
  assert.equal(deduper.shouldSkip('a'), false, '"a" debió ser desalojado por ser el más antiguo');
  assert.equal(deduper.shouldSkip('b'), true);
  assert.equal(deduper.shouldSkip('c'), true);
  assert.equal(deduper.shouldSkip('d'), true);
});
