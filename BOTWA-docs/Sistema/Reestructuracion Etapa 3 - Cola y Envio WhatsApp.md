---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - whatsapp/
  - Etapa 3 arquitectura
---

# 🏗️ Reestructuración — Etapa 3: cola de mensajes y envío a WhatsApp

## 🎯 Alcance (deliberadamente acotado)

Continuación de [[Reestructuracion Etapa 2 - Proveedores de IA]]. El roadmap original describía esta etapa como "extraer la cola de mensajes y el envío a WhatsApp (`addMessageToQueue`/`processUserQueue`)". Al revisar el código, `processUserQueue` resultó estar mucho más entrelazado de lo que el nombre sugiere: además de la cola, orquesta el delay anti-spam, el indicador de "escribiendo...", `answerQuery` (IA/RAG), el envío de fórmulas/stickers (`processAIResponseWithFormulas`) y el conteo de mensajes por hora — son ~9 dependencias distintas del módulo.

Extraer `processUserQueue` completo habría significado tocar de una sola vez el código más crítico y de mayor riesgo de todo el bot (justo la ruta de envío que se investigó toda esta sesión por el bug de entrega), inyectando 9 dependencias a la fuerza solo para poder decir "está extraído". Se decidió acotar el alcance real de esta etapa a lo que sí es una **estructura de datos independiente y de bajo riesgo**: la cola en sí. `processUserQueue` se queda en `bot.js` como orquestador — es candidato más natural para la Etapa 5 (dispatcher/orquestación), no para esta.

## ✅ Qué se hizo

- **`whatsapp/queue.js`** — `createUserQueueStore({ maxQueueSize })`, expone `getOrCreate(userId)` y `add(userId, messageData)`. Reemplaza el `Map` module-level (`userQueues`) y las funciones `getUserQueue`/`addMessageToQueue` de `bot.js` — mismo contrato exacto (el objeto de cola sigue siendo mutado directamente por `processUserQueue` para `processing`/`timeout`, eso no cambió).
- **`whatsapp/send.js`** — `sendRagImages(sock, remoteJid, images, quotedMsg, { readFile })`, con `readFile` inyectable (por defecto `fs.readFile` real) para poder probarlo sin tocar disco.

`bot.js` bajó de 1608 a 1579 líneas.

### Pruebas nuevas
- `test/queue.test.js` (5 casos): creación de cola, mismidad de referencia, límite de tamaño, aislamiento entre usuarios.
- `test/send.test.js` (4 casos): límite de 2 imágenes máx., cita del mensaje original, tolerancia a fallos de lectura individuales, caso sin imágenes.

Suite completa: 31/31 en ~1s.

## 🧪 Verificación realizada
- `node --check` en todos los archivos del proyecto.
- `npm test` — 31/31 en verde.
- Importar `bot.js` sigue sin conectar a WhatsApp.
- `server.js` levantado y probado (no depende de `whatsapp/`).

## 🗺️ Lo que sigue
- **Etapa 4:** centralizar la conversión de stickers/LaTeX (hoy duplicada en 3 sitios) en `media.js`.
- **Etapa 5:** extraer `processUserQueue` (el orquestador real de la respuesta) y reemplazar el dispatcher de ~600 líneas (`processCommand`) por un registro `Map<comando, handler>` — candidata natural para juntar ambas cosas, ya que `processUserQueue` es en esencia "el comando implícito" que se ejecuta cuando no hay un `/comando` explícito.

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 2 - Proveedores de IA]]
- [[Diagnostico de Entrega de Mensajes]]
