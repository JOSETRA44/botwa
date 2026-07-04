---
tags:
  - botwa
  - fix
  - sistema
aliases:
  - Gemini 503
  - Panel ampliado
---

# 🔧 Fix: Gemini 503 sin reintento + ampliación del panel

## 🐛 Síntoma reportado

El dueño reportó que el bot "se está bugueando" — específicamente, que antes las fórmulas matemáticas se enviaban como sticker con LaTeX y dejaron de hacerlo. También preguntó si el bot confunde cuándo usar el catálogo vs. sus capacidades de IA.

## 🔬 Diagnóstico

Los logs del panel mostraban:
```
[19:00:28] ⚠️ Gemini no disponible (Error de API: 503), respondiendo con el catálogo directo
[19:01:31] ⚠️ Gemini no disponible (Error de API: 503), respondiendo con el catálogo directo
```
Prueba directa contra la API de Gemini confirmó: **3 intentos seguidos, los primeros 2 devolvieron 503** ("This model is currently experiencing high demand... Please try again later" — sobrecarga temporal del lado de Google, no un problema de nuestra cuenta ni de código) y el 3ro respondió bien, con la fórmula en LaTeX incluida.

**Causa raíz:** el limitador de Gemini (`providers/geminiLimiter.js`, ver [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]) solo reintentaba ante status `429` (límite de cuota). Ante un `503` (sobrecarga temporal), devolvía el error inmediatamente sin reintentar — así que `answerQuery` caía al catálogo directo en el primer 503, aunque Gemini iba a responder bien un par de segundos después. Esto explica el síntoma exacto: no es que el código de fórmulas/stickers esté roto (las pruebas de la Etapa 4 ya lo confirmaban), es que la respuesta de IA con la fórmula **nunca llegaba a generarse**.

## ✅ Qué se hizo

**`providers/geminiLimiter.js`:** `fetchWithRetry` ahora reintenta también en `503`, con el mismo backoff exponencial que ya existía para 429 (la cabecera `Retry-After` sigue siendo específica de 429, un 503 no la trae). Si el 503 persiste tras agotar los reintentos, se devuelve la respuesta tal cual (no se lanza `GeminiRateLimitError`, porque no es un problema de cuota) — el llamador la trata como cualquier otro error de API y cae al catálogo, que sigue siendo el comportamiento correcto cuando Gemini realmente no está disponible.

Verificado en producción real: la misma consulta que antes fallaba con 503 ahora genera la fórmula correctamente en el primer intento con reintento.

## 🤔 Sobre "el bot confunde catálogo vs. IA"

Aclaración importante: hay **dos mecanismos distintos** que pueden hacer que el bot responda desde el catálogo en vez de con IA, y vale la pena distinguirlos:

1. **Coincidencia de alta confianza** (`ragConfidenceThreshold`, antes `rag.HIGH_CONFIDENCE_SCORE` fijo en 0.80): decisión *deliberada* — si el catálogo ya tiene la respuesta con alta seguridad, se usa directo para no gastar cuota de IA en algo que ya se sabe responder bien.
2. **Falla de la IA** (como el 503 de esta investigación): red de seguridad — si Gemini falla por cualquier motivo, cae al catálogo en vez de mostrarle un error al cliente.

El incidente de esta sesión fue el mecanismo (2), no un mal ajuste del mecanismo (1). Aun así, dado que (1) antes era un número fijo en el código sin forma de ajustarlo, se aprovechó para hacerlo configurable (ver siguiente sección) — así, si en el futuro el dueño nota que el catálogo "gana" con demasiada o muy poca frecuencia, puede ajustarlo él mismo sin pedir un cambio de código.

## 🖥️ Ampliación del panel

Al revisar el panel se encontró un vacío real para un producto que se vende a alguien no técnico: **solo Gemini y Grok se podían configurar desde la interfaz** — OpenAI, Gemini Vision, Gemini Papear, Unsplash y Google Search solo se podían configurar editando `.env`/`config.json` a mano. Tampoco había forma de cambiar ningún nombre de modelo desde el panel (el mismo tipo de problema que causó el incidente de `grok-beta` retirado — sin editar código, un cliente no podría reaccionar si xAI o Google retiran otro modelo).

Se agregó al panel (`public/index.html` + `public/js/config.js` + `server.js`):
- Slider de **"Umbral de confianza del catálogo"** (`ragConfidenceThreshold`, 0.5–0.95) junto al selector de modo de respuesta.
- Sección colapsable **"🔌 Integraciones avanzadas"** con API Key + modelo para OpenAI, Gemini Vision, Gemini Papear, Unsplash (2 keys) y Google Search (key + Search Engine ID) — cada campo indica qué comando afecta.
- Campo de modelo para Grok y para Gemini (motor principal), editables sin tocar `config.json`.

Todas las API keys se siguen guardando en `.env` (nunca en `config.json`), igual que Gemini/Grok ya hacían — mismo patrón, extendido a las demás integraciones.

## 🧪 Verificación realizada
- `node --check` en todos los archivos + `npm test` (68/68, incluye 3 casos nuevos para el reintento en 503).
- Prueba real contra la API de Gemini confirmando el reintento en 503 funciona end-to-end.
- Round-trip del panel probado contra los datos reales de `config.json` (no una copia): 0 pérdida de datos, todas las API keys y modelos preservados correctamente.
- Bot real reconectado sin pedir QR nuevo tras los cambios.

> [!warning] Nota operativa
> Durante esta verificación, un comando de limpieza de procesos mató por accidente el proceso `bot.js` que estaba conectado. Se detectó de inmediato (logs sin actividad nueva) y se reinició sin pérdida de sesión — pero es un recordatorio de que incluso con permiso explícito para reiniciar el bot, hay que apuntar los comandos de limpieza de procesos con precisión (nunca `Stop-Process` amplio sobre todos los `node.exe`).

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]
- [[Fix Error 429 Gemini - Limite de Cuota]]
- [[Reestructuracion Etapa 7 - Verificacion de Arranque]]
