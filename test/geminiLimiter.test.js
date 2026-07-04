// Pruebas de makeGeminiLimiter() — el limitador de tasa + reintento con
// backoff para las llamadas a Gemini (agregado tras el incidente de
// error 429 por límite de cuota gratuita). Formaliza los 5 escenarios ya
// validados manualmente con un script desechable durante ese fix.
//
// `now` y `sleepImpl` son inyectables precisamente para que estas pruebas
// no tengan que esperar minutos reales — se simula el paso del tiempo en
// vez de bloquear la suite con setTimeout reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGeminiLimiter, GeminiRateLimitError } from '../bot.js';

function instantSleep(waits) {
  return (ms) => { waits.push(ms); return Promise.resolve(); };
}

test('permite la llamada si hay cupo disponible', async () => {
  const limiter = makeGeminiLimiter({
    rpmLimit: 8,
    fetchImpl: async () => ({ status: 200, ok: true, headers: { get: () => null } })
  });
  const start = Date.now();
  const response = await limiter.fetchWithRetry('http://fake', {});
  assert.equal(response.status, 200);
  assert.ok(Date.now() - start < 200, 'no debería esperar si hay cupo');
});

test('espera cuando se alcanza el límite de RPM', async () => {
  // Reloj simulado que avanza exactamente lo que se le pide "dormir" —
  // así waitForSlot() puede recalcular con el tiempo ya avanzado en vez
  // de quedar en bucle infinito (el mock no crea una espera real).
  const clock = { time: 0 };
  const waits = [];
  const limiter = makeGeminiLimiter({
    rpmLimit: 2,
    now: () => clock.time,
    sleepImpl: (ms) => { waits.push(ms); clock.time += ms; return Promise.resolve(); },
    fetchImpl: async () => ({ status: 200, ok: true, headers: { get: () => null } })
  });

  await limiter.fetchWithRetry('http://fake', {}); // timestamps: [0]
  clock.time = 10;
  await limiter.fetchWithRetry('http://fake', {}); // timestamps: [0, 10]

  clock.time = 59960; // casi al borde de la ventana de 60s desde el primer timestamp
  await limiter.fetchWithRetry('http://fake', {});

  assert.equal(waits.length, 1, 'debe haber esperado exactamente una vez');
  assert.equal(waits[0], 140, 'espera = 60000 - (59960-0) + 100 = 140ms');
});

test('reintenta en 429 respetando Retry-After', async () => {
  let calls = 0;
  const waits = [];
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep(waits),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return { status: 429, headers: { get: (h) => (h === 'retry-after' ? '3' : null) } };
      return { status: 200, ok: true, headers: { get: () => null } };
    }
  });
  const response = await limiter.fetchWithRetry('http://fake', {});
  assert.equal(calls, 2);
  assert.equal(response.status, 200);
  assert.deepEqual(waits, [3000], 'debe respetar Retry-After: 3 (segundos -> 3000ms)');
});

test('reintenta en 429 con backoff exponencial sin Retry-After', async () => {
  let calls = 0;
  const waits = [];
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep(waits),
    fetchImpl: async () => {
      calls++;
      if (calls <= 2) return { status: 429, headers: { get: () => null } };
      return { status: 200, ok: true, headers: { get: () => null } };
    }
  });
  const response = await limiter.fetchWithRetry('http://fake', {}, 2);
  assert.equal(calls, 3);
  assert.equal(response.status, 200);
  assert.deepEqual(waits, [1500, 3000], 'backoff exponencial: 1500ms, luego 3000ms');
});

test('lanza GeminiRateLimitError al agotar los reintentos', async () => {
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep([]),
    fetchImpl: async () => ({ status: 429, headers: { get: () => null } })
  });
  await assert.rejects(
    () => limiter.fetchWithRetry('http://fake', {}, 1),
    GeminiRateLimitError
  );
});

test('reintenta en 503 (modelo con alta demanda) igual que en 429', async () => {
  let calls = 0;
  const waits = [];
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep(waits),
    fetchImpl: async () => {
      calls++;
      if (calls <= 2) return { status: 503, headers: { get: () => null } };
      return { status: 200, ok: true, headers: { get: () => null } };
    }
  });
  const response = await limiter.fetchWithRetry('http://fake', {}, 2);
  assert.equal(calls, 3, 'debe reintentar en 503 igual que en 429');
  assert.equal(response.status, 200);
  assert.deepEqual(waits, [1500, 3000]);
});

test('503 persistente: agota reintentos y devuelve la respuesta 503 (no lanza GeminiRateLimitError)', async () => {
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep([]),
    fetchImpl: async () => ({ status: 503, headers: { get: () => null } })
  });
  const response = await limiter.fetchWithRetry('http://fake', {}, 1);
  assert.equal(response.status, 503, 'un 503 persistente no es un límite de cuota, así que no debe lanzar GeminiRateLimitError');
});

test('503 no respeta Retry-After (esa cabecera es específica de 429)', async () => {
  const waits = [];
  let calls = 0;
  const limiter = makeGeminiLimiter({
    sleepImpl: instantSleep(waits),
    fetchImpl: async () => {
      calls++;
      if (calls === 1) return { status: 503, headers: { get: () => '30' } };
      return { status: 200, ok: true, headers: { get: () => null } };
    }
  });
  await limiter.fetchWithRetry('http://fake', {});
  assert.equal(waits[0], 1500, 'debe usar el backoff exponencial normal, no los 30s de la cabecera');
});
