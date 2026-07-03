// Cliente de Gemini (chat, visión, y el modo "papear" sin censura).
// Recibe { config, geminiLimiter } como parámetro en vez de leer globals
// del módulo — extraído de bot.js en la Etapa 2 de la reestructuración
// (ver BOTWA-docs/Sistema/Reestructuracion...), comportamiento idéntico.
import { GeminiRateLimitError } from './geminiLimiter.js';

export { GeminiRateLimitError };

// Analizar imagen con Gemini Vision
export async function analyzeImageWithGemini(imageBuffer, question = '', { config, geminiLimiter }) {
  if (!config.geminiVision || !config.geminiVision.apiKey) {
    return '⚠️ API de Gemini Vision no configurada.';
  }

  try {
    const apiKey = config.geminiVision.apiKey;
    const model = config.geminiVision.model || 'gemini-2.5-flash';

    // Convertir buffer a base64
    const base64Image = imageBuffer.toString('base64');

    // Prompt por defecto o personalizado
    const prompt = question || 'Describe esta imagen en detalle. Menciona objetos, colores, personas, texto visible, y cualquier detalle relevante.';

    const response = await geminiLimiter.fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Error de API: ${response.status}`);
    }

    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }

    return 'No pude analizar la imagen. Intenta de nuevo.';
  } catch (error) {
    console.error('❌ Error al analizar imagen:', error.message);
    if (error instanceof GeminiRateLimitError) {
      return '⏳ Estoy recibiendo muchos mensajes ahora mismo. Espera un momento y vuelve a intentar.';
    }
    return '❌ Error al analizar la imagen. Verifica tu API Key de Gemini Vision.';
  }
}

// Núcleo de la llamada a Gemini: lanza en vez de devolver strings de error,
// para que answerQuery() (modo hybrid/direct) pueda distinguir éxito de
// fallo y decidir si cae al catálogo directo. callGemini() más abajo
// conserva el comportamiento público de siempre envolviendo esto.
// extraContext: bloque opcional de la base de conocimiento (RAG) que se
// antepone al mensaje para que la IA responda con datos reales del negocio.
export async function callGeminiRaw(userMessage, extraContext = '', { config, geminiLimiter }) {
  if (!config.apiKeyGemini || config.apiKeyGemini.trim() === '') {
    throw new Error('GEMINI_NOT_CONFIGURED');
  }

  const contextBlock = extraContext ? `\n\n${extraContext}\n` : '';
  const prompt = `${config.promptGlobal}${contextBlock}\n\nUsuario: ${userMessage}`;

  // Usar gemini-1.5-flash (más rápido y económico) o gemini-1.5-pro
  const model = config.geminiModel || 'gemini-1.5-flash';

  const response = await geminiLimiter.fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKeyGemini}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    }
  );
  // fetchWithRetry ya lanza GeminiRateLimitError si agota reintentos ante 429

  if (!response.ok) {
    throw new Error(`Error de API: ${response.status}`);
  }

  const data = await response.json();

  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('EMPTY_RESPONSE');
}

// Llamar a la API de Gemini (versión pública: nunca lanza, siempre
// devuelve un string enviable al usuario). Usada por el modo "ai" y por
// /resumen, que siempre requieren una respuesta de IA.
export async function callGemini(userMessage, extraContext = '', deps) {
  try {
    return await callGeminiRaw(userMessage, extraContext, deps);
  } catch (error) {
    console.error('❌ Error al llamar a Gemini:', error.message);
    if (error.message === 'GEMINI_NOT_CONFIGURED') {
      return 'La API Key de Gemini no está configurada. Por favor, configúrala en el panel web.';
    }
    if (error instanceof GeminiRateLimitError) {
      return '⏳ Estoy recibiendo muchos mensajes ahora mismo. Espera un momento y vuelve a intentar.';
    }
    if (error.message === 'EMPTY_RESPONSE') {
      return 'No pude generar una respuesta. Intenta de nuevo.';
    }
    return 'Error al conectar con Gemini. Verifica tu API Key.';
  }
}

// Llamar a Gemini para PAPEAR (sin censura, modo brutal)
export async function callGeminiPapear(targetMessage, argumentos = '', { config, geminiLimiter }) {
  if (!config.geminiPapear || !config.geminiPapear.apiKey) {
    console.error('❌ Config geminiPapear no encontrado:', config.geminiPapear);
    return '⚠️ API de Gemini Papear no configurada.';
  }

  try {
    // Prompt SIMPLE y DIRECTO
    let prompt = '';

    if (!targetMessage && !argumentos) {
      // Auto-papeo
      prompt = 'Roast corto: "Ni usar un comando sabes 💀"';
    } else if (targetMessage) {
      // Papear mensaje
      prompt = `Roast esto: "${targetMessage.substring(0, 100)}". Respuesta corta con emojis 💀🔥😂`;
    } else {
      // Solo argumentos
      prompt = `Roast: "${argumentos}". Respuesta corta con emojis 💀🔥😂`;
    }

    const model = config.geminiPapear.model || 'gemini-1.5-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${config.geminiPapear.apiKey}`;

    console.log('🌐 URL:', apiUrl.replace(config.geminiPapear.apiKey, 'API_KEY_HIDDEN'));
    console.log('📦 Modelo:', model);

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ],
      generationConfig: {
        temperature: 0.9,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 500  // Aumentado para tener espacio suficiente
      }
    };

    console.log('📤 Enviando request...');

    const response = await geminiLimiter.fetchWithRetry(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Error de API Gemini Papear:', response.status, errorData);
      throw new Error(`Error de API: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('📥 Respuesta COMPLETA de Gemini:', JSON.stringify(data, null, 2));

    // Verificar si la respuesta fue bloqueada por safety
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      console.error('⚠️ Respuesta bloqueada por promptFeedback:', data.promptFeedback.blockReason);
      console.error('📋 Safety ratings:', JSON.stringify(data.promptFeedback.safetyRatings, null, 2));
      return `⚠️ La IA bloqueó la respuesta por: ${data.promptFeedback.blockReason}\n\nIntenta con un mensaje menos ofensivo.`;
    }

    // Verificar si hay candidatos
    if (!data.candidates || data.candidates.length === 0) {
      console.error('❌ No hay candidatos en la respuesta');
      console.error('📋 Data completa:', JSON.stringify(data, null, 2));
      return '⚠️ La IA no generó ninguna respuesta. Puede estar bloqueada por contenido sensible.';
    }

    const candidate = data.candidates[0];
    console.log('📝 Candidato:', JSON.stringify(candidate, null, 2));

    // Verificar finishReason
    if (candidate.finishReason === 'SAFETY') {
      console.error('⚠️ Candidato bloqueado por SAFETY');
      console.error('📋 Safety ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
      return '⚠️ La IA bloqueó la respuesta por contenido sensible. El prompt es demasiado agresivo.';
    }

    // Verificar contenido
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      console.error('❌ No hay contenido en el candidato');
      console.error('📋 Candidate completo:', JSON.stringify(candidate, null, 2));
      return '⚠️ La IA no generó texto. Respuesta vacía.';
    }

    const text = candidate.content.parts[0].text;
    console.log('✅ Texto generado:', text);
    return text;
  } catch (error) {
    console.error('❌ Error al papear con Gemini:', error.message);
    if (error instanceof GeminiRateLimitError) {
      return '⏳ Estoy recibiendo muchos mensajes ahora mismo. Espera un momento y vuelve a intentar.';
    }
    return `❌ Error al generar la papeada: ${error.message}`;
  }
}
