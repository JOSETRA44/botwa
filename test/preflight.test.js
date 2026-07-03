// Pruebas de shared/preflight.js — el reporte de arranque pensado para
// que quien instala el bot (no necesariamente alguien técnico) sepa de
// entrada qué falta configurar, sin tener que descubrirlo por quejas de
// clientes semanas después (como pasó con Grok/OpenAI esta sesión).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreflightReport } from '../shared/preflight.js';

test('Gemini sin API key: advierte pero no bloquea', () => {
  const report = buildPreflightReport({ apiKeyGemini: '' }, { entryCount: 5 });
  const gemini = report.items.find((i) => i.name.includes('Gemini (motor'));
  assert.equal(gemini.status, 'warning');
});

test('Gemini con API key: todo ok', () => {
  const report = buildPreflightReport({ apiKeyGemini: 'AIza...' }, { entryCount: 5 });
  const gemini = report.items.find((i) => i.name.includes('Gemini (motor'));
  assert.equal(gemini.status, 'ok');
});

test('catálogo vacío: advierte', () => {
  const report = buildPreflightReport({}, { entryCount: 0 });
  const catalogo = report.items.find((i) => i.name.includes('Catálogo'));
  assert.equal(catalogo.status, 'warning');
});

test('catálogo con entradas: ok y muestra el conteo', () => {
  const report = buildPreflightReport({}, { entryCount: 12 });
  const catalogo = report.items.find((i) => i.name.includes('Catálogo'));
  assert.equal(catalogo.status, 'ok');
  assert.match(catalogo.message, /12/);
});

test('integraciones opcionales sin key: informativo, no advertencia (no son críticas)', () => {
  const report = buildPreflightReport({ grok: {}, openai: {} }, { entryCount: 1 });
  const grok = report.items.find((i) => i.name.includes('Grok'));
  const openai = report.items.find((i) => i.name.includes('ChatGPT'));
  assert.equal(grok.status, 'info');
  assert.equal(openai.status, 'info');
});

test('integraciones opcionales con key: ok', () => {
  const report = buildPreflightReport({ grok: { apiKey: 'x' } }, { entryCount: 1 });
  const grok = report.items.find((i) => i.name.includes('Grok'));
  assert.equal(grok.status, 'ok');
});

test('reporta las 8 integraciones esperadas (Gemini + catálogo + 6 opcionales)', () => {
  const report = buildPreflightReport({}, { entryCount: 0 });
  assert.equal(report.items.length, 8);
});
