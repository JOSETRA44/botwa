// Reporte de arranque ("preflight"): un cliente que compra este bot y lo
// instala solo no tiene forma de saber por qué algo no funciona hasta que
// un usuario final se queja — exactamente lo que pasó esta sesión con
// Grok/OpenAI (llevaban semanas rotos y nadie lo sabía hasta que se
// investigó a fondo). Este módulo da un reporte claro al arrancar, ANTES
// de conectar a WhatsApp, sin costo: solo valida presencia/forma, nunca
// hace una llamada real a ninguna API (eso sí costaría dinero en cada
// reinicio con Grok/OpenAI, que no tienen nivel gratuito).
//
// Es intencionalmente informativo, no bloqueante: el bot arranca igual
// aunque falten integraciones opcionales, porque el modo híbrido/directo
// ya está diseñado para seguir funcionando desde el catálogo sin IA.
export function buildPreflightReport(config, { entryCount = 0 } = {}) {
  const items = [];

  const hasKey = (value) => typeof value === 'string' && value.trim() !== '';

  items.push({
    name: 'Gemini (motor principal)',
    status: hasKey(config.apiKeyGemini) ? 'ok' : 'warning',
    message: hasKey(config.apiKeyGemini)
      ? 'Configurado.'
      : 'Sin API Key. El modo "ai" y las respuestas fuera del catálogo no funcionarán; el modo "hybrid"/"direct" seguirán respondiendo desde el catálogo.'
  });

  items.push({
    name: 'Catálogo de negocio (RAG)',
    status: entryCount > 0 ? 'ok' : 'warning',
    message: entryCount > 0
      ? `${entryCount} entrada(s) cargada(s).`
      : 'El catálogo está vacío. Agrega productos/información del negocio desde el panel web antes de usar /catalogo o el modo híbrido.'
  });

  const optional = [
    ['Grok / xAI (/elon)', config.grok?.apiKey],
    ['ChatGPT / OpenAI (/sora)', config.openai?.apiKey],
    ['Gemini Vision (/analizar)', config.geminiVision?.apiKey],
    ['Gemini Papear (/papear)', config.geminiPapear?.apiKey],
    ['Unsplash (/gg)', config.unsplash?.accessKey],
    ['Google Images (/go)', config.googleSearch?.apiKey]
  ];

  for (const [name, key] of optional) {
    items.push({
      name,
      status: hasKey(key) ? 'ok' : 'info',
      message: hasKey(key) ? 'Configurado.' : 'Sin API Key — el comando asociado responderá "no configurada" hasta que se agregue una clave en el panel.'
    });
  }

  return { items };
}

// Imprime el reporte en consola con un formato legible — pensado para que
// quien instala el bot (no necesariamente alguien técnico) entienda de un
// vistazo qué funciona y qué falta, sin tener que leer logs de error.
export function printPreflightReport(report) {
  const icon = { ok: '✅', warning: '⚠️ ', info: 'ℹ️ ' };
  console.log('\n📋 Verificación de configuración:');
  console.log('─'.repeat(60));
  for (const item of report.items) {
    console.log(`${icon[item.status] || '•'} ${item.name}: ${item.message}`);
  }
  console.log('─'.repeat(60));
}
