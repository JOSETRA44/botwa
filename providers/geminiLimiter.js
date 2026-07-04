// ============================================================
// Límite de tasa para Gemini (generateContent)
// ============================================================
// El tier gratuito de gemini-2.5-flash permite solo ~10 solicitudes
// por minuto (Google lo recortó ~80% en diciembre de 2025) y ese cupo
// se comparte entre /pregunta, las respuestas automáticas, /analizar
// y /papear porque todas usan el mismo modelo. Sin este límite,
// varios usuarios escribiendo a la vez provocan errores 429 que antes
// se mostraban como "verifica tu API Key" (mensaje engañoso: el
// problema es de cupo, no de autenticación).
export class GeminiRateLimitError extends Error {}

// Fábrica del limitador de tasa (recibe sus dependencias, no lee globals)
// para poder probarla con node:test sin tocar la sesión real de WhatsApp.
export function makeGeminiLimiter({
  rpmLimit = 8, addLog, isLogsEnabled, fetchImpl = fetch, now = Date.now,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const callTimestamps = [];

  async function waitForSlot() {
    const t = now();
    while (callTimestamps.length && t - callTimestamps[0] > 60000) {
      callTimestamps.shift();
    }
    if (callTimestamps.length >= rpmLimit) {
      const waitMs = 60000 - (t - callTimestamps[0]) + 100;
      if (isLogsEnabled?.()) addLog?.(`⏳ Límite de Gemini alcanzado, esperando ${Math.ceil(waitMs / 1000)}s...`, 'warning');
      await sleepImpl(waitMs);
      return waitForSlot();
    }
    callTimestamps.push(now());
  }

  // fetch con reintento automático ante 429 (límite de cuota, respeta
  // Retry-After si Google lo envía) y 503 (sobrecarga temporal del modelo
  // — "This model is currently experiencing high demand" — confirmado en
  // producción que se resuelve solo en 1-2 reintentos con un pequeño
  // backoff, y sin reintento el bot caía al catálogo directo aunque
  // Gemini iba a responder bien un par de segundos después).
  async function fetchWithRetry(url, options, maxRetries = 2) {
    await waitForSlot();
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetchImpl(url, options);
      if (response.status !== 429 && response.status !== 503) return response;

      if (attempt === maxRetries) {
        if (response.status === 429) {
          throw new GeminiRateLimitError('Límite de solicitudes de Gemini alcanzado (429)');
        }
        return response; // 503 persistente: se agotaron los reintentos, que el llamador lo trate como "Error de API: 503"
      }
      const retryAfter = response.status === 429 ? response.headers.get('retry-after') : null;
      const backoffMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1500 * 2 ** attempt;
      console.warn(`⚠️ Gemini ${response.status} (intento ${attempt + 1}/${maxRetries}), reintentando en ${backoffMs}ms`);
      await sleepImpl(backoffMs);
    }
  }

  return { waitForSlot, fetchWithRetry };
}
