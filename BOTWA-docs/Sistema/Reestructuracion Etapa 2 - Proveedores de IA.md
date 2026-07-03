---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - providers/
  - Etapa 2 arquitectura
---

# 🏗️ Reestructuración — Etapa 2: proveedores de IA

## 🎯 Por qué ahora

Continuación de [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]. El bot no está en producción en este momento (sesión desconectada), lo que reduce el riesgo de tocar el flujo de IA — se aprovechó esa ventana para ejecutar la Etapa 2 del roadmap en vez de solo documentarla.

## ✅ Qué se hizo

Los 5 clientes de IA (`analyzeImageWithGemini`, `callGeminiRaw`, `callGemini`, `callGeminiPapear`, `callGrok`, `callChatGPT` — 6 funciones en total, todas usaban el mismo patrón de fetch + manejo de errores casi idéntico repetido) se movieron a un módulo `providers/`:

- `providers/geminiLimiter.js` — `GeminiRateLimitError` y `makeGeminiLimiter` (ya existían desde la Etapa 1, solo cambiaron de archivo).
- `providers/gemini.js` — las 4 funciones de Gemini (chat, visión, papear), reciben `{ config, geminiLimiter }` como parámetro en vez de leer variables globales del módulo.
- `providers/grok.js` / `providers/chatgpt.js` — reciben `{ config, fetchImpl }` (el `fetchImpl` inyectable es nuevo, agregado específicamente para poder probarlos sin golpear la red real).

`bot.js` conserva funciones del mismo nombre y firma exacta que antes (`callGemini(userMessage, extraContext)`, etc.) como wrappers delgados que delegan a `providers/*` inyectando `config`/`geminiLimiter` automáticamente — **cero cambios en ningún punto de llamada** (`processCommand`, `answerQuery`, `answerQueryDeps`) ni en los tests de la Etapa 1. `bot.js` bajó de ~1947 a 1608 líneas.

### Pruebas nuevas
`test/providers.test.js` (9 casos) prueba los 6 proveedores con `fetch` inyectado — sin red real, sin esperas reales (el límite de Gemini también usa `sleepImpl` instantáneo en los tests). Suite completa: 22/22 en ~0.7s.

## 🧪 Verificación realizada
- `node --check` en los 11 archivos del proyecto.
- `npm test` — 22/22 en verde.
- Importar `bot.js` sigue sin conectar a WhatsApp (guardia de Etapa 1 intacto).
- `server.js` levantado y probado (no depende de `providers/`, pero se confirmó que sigue sirviendo las 5 rutas principales sin cambios).
- **No se ejecutó `node bot.js` directamente** — el bot no estaba conectado durante esta sesión, pero se mantuvo la misma disciplina de verificación que cuando sí lo está.

## 🗺️ Lo que sigue
- **Etapa 3:** extraer la cola de mensajes y el envío a WhatsApp a un módulo `whatsapp/`.
- **Etapa 4:** centralizar la conversión de stickers/LaTeX (hoy duplicada en 3 sitios) en `media.js`.
- **Etapa 5:** reemplazar el dispatcher de ~600 líneas (`processCommand`) por un registro `Map<comando, handler>`.

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]
- [[Diagnostico de Entrega de Mensajes]]
