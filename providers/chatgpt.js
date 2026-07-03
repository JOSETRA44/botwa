// Cliente de ChatGPT (OpenAI). Extraído de bot.js en la Etapa 2 de la
// reestructuración — comportamiento idéntico, ahora recibe { config } en
// vez de leer el global del módulo.
export async function callChatGPT(userMessage, { config, fetchImpl = fetch }) {
  if (!config.openai || !config.openai.apiKey) {
    return '⚠️ API de ChatGPT no configurada.';
  }

  try {
    const apiKey = config.openai.apiKey;
    const model = config.openai.model || 'gpt-4o-mini';

    const response = await fetchImpl(
      'https://api.openai.com/v1/chat/completions',
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
          temperature: 0.7,
          max_tokens: 1000
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error de API: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }

    return 'No pude generar una respuesta. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al llamar a ChatGPT:', error.message);
    return '❌ Error al conectar con ChatGPT. Verifica tu API Key.';
  }
}
