---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - shared/store.js
  - Etapa 1 arquitectura
---

# 🏗️ Reestructuración — Etapa 1: módulo compartido + pruebas

## 🎯 Por qué

`bot.js` llegó a 1938 líneas mezclando absolutamente todo: conexión a WhatsApp, cola de mensajes, 5 clientes de IA distintos, el sistema RAG, procesamiento de stickers/LaTeX, y un dispatcher de ~600 líneas para 17 comandos. El proyecto no tiene ni una sola prueba automatizada ni linter, y está en producción sirviendo clientes reales — así que reescribirlo todo de una vez sería temerario. Esta es la **primera de varias etapas** de una reestructuración incremental, elegida específicamente porque es pequeña, segura, y sienta las bases (pruebas + un módulo compartido) para las siguientes.

## 🔍 El bug que esto arregló de paso

Investigando la arquitectura se confirmó que `bot.js` y `server.js` tenían **cada uno su propia implementación** de leer/escribir `config.json`, `bot-state.json` y `panel-logs.json` — y ya habían empezado a divergir: `saveBotState` era inmediato en `server.js` pero con throttle de 5 minutos en `bot.js`; los valores por defecto de `loadConfig` no coincidían entre los dos archivos. Es el mismo patrón que causó el bug de guardado del panel arreglado en la sesión anterior (ver [[Modo de Respuesta Hibrido]]) — dos implementaciones separadas del mismo concepto que se desincronizan con el tiempo.

## ✅ Qué se hizo

### Nuevo módulo `shared/store.js`
Única fuente de verdad para `config.json`, `bot-state.json` y `panel-logs.json`. Exporta `applyEnvSecrets`, `DEFAULT_CONFIG`, `DEFAULT_BOT_STATE`, `loadConfig`, `saveConfig`, `loadBotState`, `saveBotState`, `loadPanelLogs`, `addPanelLog`, `clearPanelLogs`. `bot.js` y `server.js` ahora importan estas funciones en vez de reimplementarlas — **ningún formato en disco ni ninguna ruta del panel cambió**, es la misma lógica en un solo lugar.

`saveBotState` acepta un `throttleMs` opcional (por defecto 0 = inmediato): el contador horario de `bot.js` lo pasa explícitamente para conservar su comportamiento de siempre; el panel (`server.js`, pausar/reanudar/etc.) sigue guardando de inmediato como antes.

### `answerQuery` y el limitador de Gemini ahora son inyectables
`answerQuery(query)` pasó a `answerQuery(query, deps)`, recibiendo `config`/`botState`/`addLog`/`getRagContext`/`callGemini`/`callGeminiRaw` como parámetros en vez de leer variables globales del módulo. El limitador de tasa de Gemini (`waitForGeminiSlot`/`fetchGeminiWithRetry`) se convirtió en una fábrica `makeGeminiLimiter({ rpmLimit, fetchImpl, now, sleepImpl })`. **La lógica de negocio no cambió ni una línea** — solo cómo reciben sus dependencias, lo cual las hace testeables.

### Suite de pruebas con el test runner nativo de Node
`node --test` (nativo desde Node 18+, cero dependencias nuevas). `test/answerQuery.test.js` (8 casos: los 3 modos del [[Modo de Respuesta Hibrido]] y sus caminos de fallback) y `test/geminiLimiter.test.js` (5 casos: cupo disponible, límite de RPM, retry con/sin `Retry-After`, agotamiento de reintentos). `npm test` corre las 13 en ~2 segundos.

> [!warning] Detalle importante: `bot.js` ya no se auto-ejecuta al importarlo
> `bot.js` llamaba a `startBot()` incondicionalmente al final del archivo — si un archivo de prueba hacía `import { answerQuery } from '../bot.js'`, eso hubiera disparado una conexión real a WhatsApp. Se agregó un guardia estándar (`if (import.meta.url === pathToFileURL(process.argv[1]).href)`) para que `startBot()` solo se ejecute cuando `bot.js` corre directamente (`node bot.js`), nunca al ser importado. Verificado: importar el módulo ya no imprime "🚀 Iniciando WhatsApp Bot..." ni intenta conectar.

## 🧪 Verificación realizada

- `node --check` en los 7 archivos tocados.
- `npm test` — 13/13 en verde.
- `shared/store.js` probado contra copias de prueba de los 3 archivos JSON (no los reales): 9 aserciones, incluyendo que `saveConfig` limpia las API keys y que el throttle de `saveBotState` funciona.
- `server.js` levantado y probado con las 5 rutas principales + un POST /config idéntico a los datos reales (round-trip sin pérdida: mismos 3 grupos, 14 comandos).
- **No se ejecutó `node bot.js` directamente en ningún momento** — la sesión real de WhatsApp nunca se tocó.

## 🗺️ Lo que sigue (futuras sesiones, no implementado aún)

- **Etapa 2:** extraer los 5 clientes de IA (Gemini/Grok/ChatGPT/Papear/Vision) a un módulo `providers/` con una forma común.
- **Etapa 3:** extraer la cola de mensajes y el envío a WhatsApp a un módulo `whatsapp/`.
- **Etapa 4:** centralizar la conversión de stickers/LaTeX (hoy duplicada en 3 sitios) en `media.js`.
- **Etapa 5:** reemplazar el dispatcher de ~600 líneas (`processCommand`) por un registro `Map<comando, handler>`.

## 🔗 Relacionado
- [[Index]]
- [[Diagnostico de Entrega de Mensajes]]
- [[Modo de Respuesta Hibrido]]
- [[Fix Error 429 Gemini - Limite de Cuota]]
