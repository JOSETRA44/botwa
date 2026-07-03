// Cliente de Grok (xAI). Extraído de bot.js en la Etapa 2 de la
// reestructuración — comportamiento idéntico, ahora recibe { config } en
// vez de leer el global del módulo.
export async function callGrok(userMessage, { config, fetchImpl = fetch }) {
  if (!config.grok || !config.grok.apiKey) {
    return '⚠️ API de Grok no configurada.';
  }

  try {
    const apiKey = config.grok.apiKey;
    // grok-beta y otros alias *-beta/*-fast/*-latest de la familia grok-3/
    // grok-4 fueron retirados por xAI el 15 de mayo de 2026 — sin un
    // config.grok.model explícito, usar un nombre de modelo vigente.
    const model = config.grok.model || 'grok-4-fast-non-reasoning';

    const response = await fetchImpl(
      'https://api.x.ai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: config.promptGlobal || 'Eres un asistente útil.'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          model: model,
          stream: false,
          temperature: 0.7
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error(`❌ Error de API Grok (${response.status}):`, errorBody);
      // La API Key puede ser válida y el problema ser otro (modelo retirado,
      // cuenta sin créditos) — no siempre es "verifica tu API Key" como
      // decía antes, ese mensaje mandaba a revisar lo que no era.
      if (response.status === 401) {
        return '❌ API Key de Grok inválida o revocada.';
      }
      if (response.status === 403) {
        return '⚠️ La cuenta de Grok no tiene créditos/licencia activa. Revisa la facturación en console.x.ai.';
      }
      if (response.status === 429) {
        return '⏳ Límite de solicitudes de Grok alcanzado. Espera un momento y vuelve a intentar.';
      }
      if (response.status === 400) {
        return `❌ Grok rechazó la solicitud (modelo "${model}" puede no existir o estar retirado).`;
      }
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a Grok:', error.message);
    return '❌ Error al conectar con Grok. Intenta de nuevo más tarde.';
  }
}
