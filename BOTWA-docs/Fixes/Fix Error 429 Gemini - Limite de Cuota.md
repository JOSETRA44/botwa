---
tags:
  - botwa
  - fix
aliases:
  - "429"
  - Rate Limit Gemini
---

# 🔧 Fix: Error 429 de Gemini — el bot dejaba de responder

## 🐛 Síntoma

El log mostraba que el bot reconocía el mensaje, encontraba coincidencias en el [[Sistema RAG - Base de Conocimiento|RAG]] e incluso registraba `✅ Respuesta enviada`, pero el usuario no recibía nada útil (o recibía "Verifica tu API Key", un mensaje engañoso). En la consola aparecía:

```
❌ Error al llamar a Gemini: Error de API: 429
```

## 🔍 Causa raíz

**429 = cupo/límite de solicitudes agotado (`RESOURCE_EXHAUSTED`), no un problema de autenticación.** Google recortó el tier gratuito de `gemini-2.5-flash` entre 50-80% el 6-7 de diciembre de 2025: pasó a solo **~10 solicitudes por minuto (RPM) y 250 al día**. Ese cupo se cuenta **por proyecto de Google Cloud, no por API key** — así que si `apiKeyGemini`, `geminiVision.apiKey` y `geminiPapear.apiKey` pertenecen a la misma cuenta/proyecto (lo usual cuando se generan todas desde el mismo Google AI Studio), **comparten el mismo cupo de 10 RPM** aunque sean strings distintos.

Con varios usuarios escribiéndole al bot en un lapso corto (respuestas automáticas + `/pregunta` + `/analizar` + `/papear`, todas usando `gemini-2.5-flash`), es fácil superar ese límite tan bajo.

El código anterior no distinguía esto: cualquier error de la API devolvía el mismo mensaje ("Verifica tu API Key"), lo cual es incorrecto y confuso para un 429 — la key está bien, es el cupo el que se agotó.

## ✅ Solución aplicada

En `bot.js` (compartido por `callGemini`, `callGeminiPapear` y `analyzeImageWithGemini`, las 3 funciones que llaman a `generateContent` de Gemini):

1. **Limitador proactivo** (`waitForGeminiSlot`): lleva un registro de las llamadas del último minuto y, si se acerca al límite (8 de 10, con margen de seguridad), espera automáticamente antes de disparar la siguiente — en vez de disparar y fallar.
2. **Reintento con backoff** (`fetchGeminiWithRetry`): si aun así llega un 429, reintenta respetando el header `Retry-After` de Google si viene incluido, o con backoff exponencial (1.5s, 3s) hasta 2 intentos.
3. **Mensaje honesto**: si se agotan los reintentos, el bot responde `⏳ Estoy recibiendo muchos mensajes ahora mismo. Espera un momento y vuelve a intentar.` en vez de sugerir revisar la API key.
4. En `rag.js`, `embedText()` también reintenta ante 429 (su cuota es más generosa — 100 RPM / 1000 RPD para `gemini-embedding-001` — pero es la misma protección por consistencia).

## 🧪 Cómo se verificó

Se extrajo la lógica del limitador y el retry a un script aislado con `fetch` simulado (sin tocar la sesión real de WhatsApp) y se comprobó:
- Las primeras 8 llamadas por minuto pasan sin esperar.
- La 9na espera lo necesario hasta liberar cupo.
- Un 429 dispara un reintento y, si la segunda respuesta es 200, se recupera sola.
- Si se agotan los reintentos, lanza `GeminiRateLimitError` sin tumbar el proceso.
- Si Google manda `Retry-After`, se respeta ese tiempo en vez del backoff por defecto.

> [!warning] Lección operativa
> No se debe correr `node bot.js` directamente como prueba de humo si la sesión de WhatsApp ya está conectada/en uso real — abre una segunda conexión con las mismas credenciales de `auth/` y puede desconectar la sesión en vivo. Usar `node --check` para sintaxis y scripts aislados con `fetch` simulado para probar lógica.

## 🚀 Para aplicar el fix

El cambio ya está en el código, pero el proceso de `bot.js` que está corriendo en este momento cargó la versión anterior en memoria. **Hay que reiniciar el bot** para que tome la nueva lógica:

```bash
# Detener el proceso actual (Ctrl+C si está en primer plano, o detener-bot.bat)
# Luego iniciar de nuevo con el método que uses normalmente:
iniciar-qr-normal.bat
```

## 💡 Si el 429 sigue apareciendo seguido

El límite de 10 RPM del tier gratuito es muy bajo para un bot con varios grupos activos. Opciones:
1. **Habilitar facturación** en el proyecto de Google Cloud (mueve a Tier 1: ~2000 RPM, con costo mínimo para este volumen).
2. Revisar en [Google AI Studio](https://aistudio.google.com/) si `apiKeyGemini`, `geminiVision.apiKey` y `geminiPapear.apiKey` son del mismo proyecto — si es así, están compitiendo por el mismo cupo de 10 RPM.
3. Bajar `GEMINI_RPM_LIMIT` en `bot.js` no ayuda a tener más cupo, solo evita que el bot mismo dispare el 429 tan seguido — la solución real de fondo es el punto 1.

## 📚 Fuentes consultadas

- [429 resource_exhausted — Google AI Developers Forum](https://discuss.ai.google.dev/t/429-resource-exhausted/111737)
- [Gemini API 429 RESOURCE_EXHAUSTED: guía de límites — LaoZhang AI](https://blog.laozhang.ai/en/posts/gemini-api-rate-limits-guide)
- [Rate limits — Gemini API oficial (Google AI for Developers)](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Free Tier Rate Limits 2026 — AI Free API](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits)

## 🔗 Relacionado
- [[Index]]
- [[Sistema RAG - Base de Conocimiento]]
- [[Fix Papear - Definitivo]]
