// Pruebas de answerQuery() — el punto único de decisión de bot.js entre
// responder directo del catálogo, con IA, o una mezcla (config.responseMode).
// Formaliza los 8 escenarios ya validados manualmente con un script
// desechable durante el desarrollo del modo híbrido.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerQuery, GeminiRateLimitError } from '../bot.js';

const KB_ENTRY_HIGH = { title: 'Pizza Familiar', text: 'S/35', score: 0.85, imageFile: 'pizza.jpg' };
const KB_ENTRY_LOW = { title: 'Horario', text: '9am-6pm', score: 0.55, imageFile: null };

function baseDeps(overrides = {}) {
  return {
    config: { responseMode: 'hybrid', apiKeyGemini: 'fake-key', ...overrides.config },
    botState: { logsEnabled: false, ...overrides.botState },
    addLog: overrides.addLog || (() => {}),
    getRagContext: overrides.getRagContext || (async () => ({ context: '', images: [], results: [] })),
    callGemini: overrides.callGemini || (async () => 'respuesta IA'),
    callGeminiRaw: overrides.callGeminiRaw || (async () => 'respuesta IA'),
    ragHighConfidenceScore: 0.80,
    GeminiRateLimitError
  };
}

function ragWith(results) {
  return async () => ({
    context: 'contexto',
    images: results.filter((r) => r.imageFile).map((r) => ({ title: r.title, imagePath: `/fake/${r.imageFile}` })),
    results
  });
}

test('modo ai: siempre llama a Gemini, ignora el catálogo', async () => {
  const deps = baseDeps({ config: { responseMode: 'ai' }, getRagContext: ragWith([KB_ENTRY_HIGH]) });
  const result = await answerQuery('hola', deps);
  assert.equal(result.text, 'respuesta IA');
});

test('modo direct + alta confianza: responde directo del catálogo', async () => {
  const deps = baseDeps({ config: { responseMode: 'direct' }, getRagContext: ragWith([KB_ENTRY_HIGH]) });
  const result = await answerQuery('cuanto cuesta la pizza', deps);
  assert.match(result.text, /Pizza Familiar/);
  assert.equal(result.images.length, 1);
});

test('modo direct + sin coincidencia: fallback genérico, sin IA', async () => {
  let calledAI = false;
  const deps = baseDeps({
    config: { responseMode: 'direct' },
    getRagContext: ragWith([]),
    callGeminiRaw: async () => { calledAI = true; return 'no debería llamarse'; }
  });
  const result = await answerQuery('algo random', deps);
  assert.equal(calledAI, false);
  assert.match(result.text, /No encontré información exacta/);
});

test('modo hybrid + alta confianza: responde del catálogo sin gastar cuota de IA', async () => {
  let calledAI = false;
  const deps = baseDeps({
    getRagContext: ragWith([KB_ENTRY_HIGH]),
    callGeminiRaw: async () => { calledAI = true; return 'no debería llamarse'; }
  });
  const result = await answerQuery('cuanto cuesta la pizza familiar', deps);
  assert.equal(calledAI, false);
  assert.match(result.text, /Pizza Familiar/);
});

test('modo hybrid + sin API key + coincidencia media: cae al catálogo', async () => {
  const deps = baseDeps({ config: { apiKeyGemini: '' }, getRagContext: ragWith([KB_ENTRY_LOW]) });
  const result = await answerQuery('a que hora abren', deps);
  assert.match(result.text, /Horario/);
});

test('modo hybrid + sin API key + sin coincidencia: fallback genérico', async () => {
  const deps = baseDeps({ config: { apiKeyGemini: '' }, getRagContext: ragWith([]) });
  const result = await answerQuery('pregunta sin relacion', deps);
  assert.match(result.text, /No encontré información exacta/);
});

test('modo hybrid + Gemini falla + hay coincidencia: cae al catálogo, no muestra error crudo', async () => {
  const deps = baseDeps({
    getRagContext: ragWith([KB_ENTRY_LOW]),
    callGeminiRaw: async () => { throw new GeminiRateLimitError('429'); }
  });
  const result = await answerQuery('a que hora abren', deps);
  assert.match(result.text, /Horario/);
  assert.doesNotMatch(result.text, /⏳/);
});

test('modo hybrid + confianza baja + Gemini funciona: usa la respuesta de la IA', async () => {
  const deps = baseDeps({
    getRagContext: ragWith([KB_ENTRY_LOW]),
    callGeminiRaw: async () => 'Respuesta natural de Gemini'
  });
  const result = await answerQuery('a que hora abren', deps);
  assert.equal(result.text, 'Respuesta natural de Gemini');
});
