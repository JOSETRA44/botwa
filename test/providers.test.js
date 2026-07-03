// Pruebas de providers/*.js — extraídos de bot.js en la Etapa 2 de la
// reestructuración. No hacen llamadas reales: mockean fetch global.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callGrok } from '../providers/grok.js';
import { callChatGPT } from '../providers/chatgpt.js';
import { callGeminiRaw, callGemini } from '../providers/gemini.js';
import { makeGeminiLimiter, GeminiRateLimitError } from '../providers/geminiLimiter.js';

function fakeLimiter(fetchImpl) {
  return makeGeminiLimiter({ fetchImpl, sleepImpl: () => Promise.resolve() });
}

test('callGrok: sin API key configurada, no intenta la llamada', async () => {
  const result = await callGrok('hola', { config: { grok: {} } });
  assert.match(result, /no configurada/);
});

test('callGrok: devuelve el texto del primer choice', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'respuesta de grok' } }] })
  });
  const result = await callGrok('hola', { config: { grok: { apiKey: 'x' }, promptGlobal: 'p' }, fetchImpl });
  assert.equal(result, 'respuesta de grok');
});

test('callGrok: API responde con error, devuelve mensaje amigable sin lanzar', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401 });
  const result = await callGrok('hola', { config: { grok: { apiKey: 'x' } }, fetchImpl });
  assert.match(result, /Error al conectar con Grok/);
});

test('callChatGPT: sin API key configurada, no intenta la llamada', async () => {
  const result = await callChatGPT('hola', { config: { openai: {} } });
  assert.match(result, /no configurada/);
});

test('callChatGPT: devuelve el texto del primer choice', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: 'respuesta de chatgpt' } }] })
  });
  const result = await callChatGPT('hola', { config: { openai: { apiKey: 'x' }, promptGlobal: 'p' }, fetchImpl });
  assert.equal(result, 'respuesta de chatgpt');
});

test('callGeminiRaw: sin API key configurada, lanza GEMINI_NOT_CONFIGURED', async () => {
  const geminiLimiter = fakeLimiter(async () => ({ status: 200, ok: true, headers: { get: () => null } }));
  await assert.rejects(
    () => callGeminiRaw('hola', '', { config: { apiKeyGemini: '' }, geminiLimiter }),
    /GEMINI_NOT_CONFIGURED/
  );
});

test('callGeminiRaw: devuelve el texto del primer candidato', async () => {
  const geminiLimiter = fakeLimiter(async () => ({
    status: 200,
    ok: true,
    headers: { get: () => null },
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'respuesta real' }] } }] })
  }));
  const result = await callGeminiRaw('hola', '', { config: { apiKeyGemini: 'x', promptGlobal: 'p' }, geminiLimiter });
  assert.equal(result, 'respuesta real');
});

test('callGemini: nunca lanza, envuelve el error de key no configurada', async () => {
  const geminiLimiter = fakeLimiter(async () => ({ status: 200, ok: true, headers: { get: () => null } }));
  const result = await callGemini('hola', '', { config: { apiKeyGemini: '' }, geminiLimiter });
  assert.match(result, /no está configurada/);
});

test('callGemini: envuelve GeminiRateLimitError con mensaje amigable', async () => {
  const geminiLimiter = fakeLimiter(async () => ({ status: 429, headers: { get: () => null } }));
  const result = await callGemini('hola', '', { config: { apiKeyGemini: 'x', promptGlobal: 'p' }, geminiLimiter });
  assert.match(result, /muchos mensajes/);
});
