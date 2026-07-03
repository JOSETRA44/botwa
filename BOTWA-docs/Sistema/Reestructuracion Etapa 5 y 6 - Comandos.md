---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - commands/
  - Map de comandos
  - Etapa 5 arquitectura
  - Etapa 6 arquitectura
---

# 🏗️ Reestructuración — Etapas 5 y 6: comandos

Continuación de [[Reestructuracion Etapa 3 - Cola y Envio WhatsApp]]. El bot volvió a estar operativo (sesión de auth limpiada tras el diagnóstico de [[Diagnostico de Entrega de Mensajes]]), así que estas dos etapas se verificaron con pruebas reales enviadas por WhatsApp, no solo `node --test`.

## Etapa 5: `processCommand` → registro `Map<comando, handler>`

`processCommand` era un if/else de ~600 líneas para 14 comandos. Se convirtió en un `Map`: cada comando quedó como `commandHandlers.set('/x', handler)`, con el cuerpo exacto de antes (cero cambios de comportamiento). El despachador ahora es:
```js
const handler = commandHandlers.get(cmd);
if (handler) { await handler(...); return; }
// fallback: comandosSimples → comandos (config dinámica) → "no reconocido"
```
`processCommand` se exportó para poder probar el despacho (`test/commands.test.js`, 7 casos: dispatch correcto, case-insensitive, prioridad del registro sobre `comandosSimples`, orden de resolución de los fallbacks).

## Etapa 6: cada comando en su propio archivo, por tema

Aun con el Map, los 14 handlers seguían viviendo dentro de `bot.js` — agregar un comando nuevo todavía significaba escribirlo en ese archivo. Se separaron en `commands/`, agrupados por tema (no uno por archivo — 14 archivos de 20-40 líneas cada uno hubiera sido más fragmentación de la que un proyecto de este tamaño necesita):

- `commands/help.js` — `/menu`, `/ayuda`
- `commands/images.js` — `/gg`, `/go`
- `commands/media.js` — `/analizar`, `/guardar`, `/s`, `/r`
- `commands/ai.js` — `/elon`, `/sora`, `/resumen`, `/papear`
- `commands/business.js` — `/pregunta`, `/catalogo`

Cada archivo exporta una fábrica (`createMediaCommands()`, etc.) que devuelve `{ '/comando': handler }`. `bot.js` los combina en el registro:
```js
const commandHandlers = new Map(Object.entries({
  ...createHelpCommands(), ...createImageCommands(), ...createMediaCommands(),
  ...createAiCommands(), ...createBusinessCommands()
}));
```

> [!warning] Por qué los handlers reciben `ctx` como parámetro y no como closure
> `config`/`botState` en `bot.js` no solo se *mutan* — se **reemplazan** por objetos nuevos (`loadConfig()`/`loadBotState()`, esta última se llama en cada mensaje entrante). Si los archivos de `commands/` hubieran capturado `config`/`botState` por closure al momento de registrarse (una sola vez, al arrancar), se habrían quedado con una referencia obsoleta para siempre. La solución: cada handler recibe `(message, sock, remoteJid, msg, ctx)`, y `ctx` se reconstruye en `bot.js` con `commandContext()` **en cada despacho** — mismo patrón ya usado en `whatsapp/messageHandler.js` (Etapa 5) para el mismo problema.

`bot.js` bajó de 1493 a **950 líneas** en esta etapa (de 1938 líneas originales, es una reducción del 51%).

## 🔌 Bonus: verificación de las APIs de IA (mismo día)

Se pidió verificar que las APIs de IA (Gemini/Grok/OpenAI) estuvieran bien configuradas, ya que Grok y ChatGPT habían dejado de responder. Diagnóstico con llamadas de prueba directas a cada API:

| API | Modelo configurado | Estado | Causa real |
|---|---|---|---|
| Gemini | `gemini-2.5-flash` | ✅ Funciona | Bien configurado — de hecho tiene más RPM gratis (15) que el modelo "recomendado" más nuevo (Gemini 3 Flash, 10 RPM) |
| Grok | `grok-beta` | ❌ Roto | xAI retiró ese alias el 15 de mayo de 2026 (`"Model not found: grok-beta"`) |
| OpenAI | `gpt-4o-mini` | ❌ Roto | Modelo vigente, pero la cuenta devuelve `insufficient_quota` |

**Importante:** ni Grok ni OpenAI tienen un nivel gratuito real para su API (solo trial credits que se agotan) — a diferencia de Gemini, que sí lo tiene. Verificado directamente contra las APIs: `grok-4.3` y `grok-4-fast-non-reasoning` devuelven `403 permission-denied: "no tiene créditos"` (no `400 model not found`), confirmando que el nombre de modelo es válido pero la cuenta de xAI no tiene facturación activa. Lo mismo con OpenAI.

**Qué se arregló en código** (lo que sí se puede arreglar sin acceso a las cuentas):
- `config.json`: `grok.model` → `grok-4-fast-non-reasoning` (modelo vigente, económico, apropiado para el uso conversacional de `/elon`).
- `providers/gemini.js`: los *defaults* internos (`|| 'gemini-1.5-flash'`, ya retirado por Google) → `gemini-2.5-flash`, para que nunca se caiga silenciosamente a un modelo muerto si `config.geminiModel` llegara a faltar.
- `providers/grok.js` / `providers/chatgpt.js`: los mensajes de error ya no dicen genéricamente "verifica tu API Key" para *cualquier* fallo — distinguen 401 (key inválida), 403/`insufficient_quota` (sin créditos/billing) y 429 (límite de cuota), para que el próximo diagnóstico no tenga que repetir esta misma investigación desde cero.

**Lo que NO se puede arreglar en código:** Grok y OpenAI seguirán sin responder hasta que se agregue un método de pago en [console.x.ai](https://console.x.ai) y [platform.openai.com](https://platform.openai.com) respectivamente. El código ahora reporta esto claramente en vez de sugerir revisar la API Key.

## 🏛️ Sobre "microservicios orientados a eventos"

Se evaluó explícitamente si migrar a una arquitectura de microservicios desacoplada y orientada a eventos. Veredicto: **no para este proyecto, y sí una versión acotada de la idea.**

- **En contra de microservicios distribuidos:** Baileys exige una única conexión WebSocket persistente por número de WhatsApp — no hay forma de repartir esa sesión entre servicios sin duplicarla o migrarla, que es justo el punto más fresco de esta sesión (el diagnóstico de sesión Signal). Microservicios resuelve problemas de equipos múltiples, escalado diferenciado y heterogeneidad tecnológica — ninguno aplica aquí (un solo desarrollador, un solo cuello de botella real que es la cuota de Gemini/la sesión de WhatsApp, todo Node.js). El costo sí sería real: llamadas de red entre servicios, más piezas que monitorear, un orquestador/broker que no existe hoy — todo esto corriendo en una laptop.
- **A favor de "orientado a eventos" dentro del mismo proceso:** queda como oportunidad futura usar `EventEmitter` de Node para desacoplar `messages.upsert` (hoy hace todo en línea: JID, grupo, anti-spam, despacho) sin necesitar infraestructura distribuida. No implementado en esta sesión — las Etapas 5/6 ya resuelven el problema concreto que motivaba la pregunta ("crear comandos fácilmente").

## 🧪 Verificación realizada
- `node --check` en los 20 archivos del proyecto.
- `npm test` — 50/50 en verde.
- **Bot real conectado y probado en vivo** (con permiso explícito del usuario para esta sesión): `/menu` despachado correctamente por el nuevo registro tras la Etapa 5, entregado sin error al contacto que antes fallaba.

## 🗺️ Lo que sigue
- **Etapa 4** (aún pendiente, se saltó a propósito): centralizar la conversión de stickers/LaTeX (hoy en `processAIResponseWithFormulas` + `commands/media.js`) en `media.js`.
- Desacoplar `messages.upsert` con un `EventEmitter` interno (ver sección de arquitectura arriba) — opcional, no bloqueante.
- Agregar créditos/billing en xAI y OpenAI para que `/elon` y `/sora` vuelvan a responder.

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 3 - Cola y Envio WhatsApp]]
- [[Diagnostico de Entrega de Mensajes]]
- [[Fix Error 429 Gemini - Limite de Cuota]]
