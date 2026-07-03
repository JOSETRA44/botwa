// Cliente de Grok (xAI). Extraído de bot.js en la Etapa 2 de la
// reestructuración — comportamiento idéntico, ahora recibe { config } en
// vez de leer el global del módulo.
export async function callGrok(userMessage, { config, fetchImpl = fetch }) {
  if (!config.grok || !config.grok.apiKey) {
    return '⚠️ API de Grok no configurada.';
  }

  try {
    const apiKey = config.grok.apiKey;
    const model = config.grok.model || 'grok-beta';

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
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a Grok:', error.message);
    return '❌ Error al conectar con Grok. Verifica tu API Key.';
  }
}
