---
tags:
  - botwa
  - fix
aliases:
  - respuestas duplicadas
  - mensajes duplicados
---

# 🔍 Diagnóstico: el bot respondía dos veces al mismo mensaje

## 🐛 Síntoma

El dueño reportó que, por alguna razón, el bot contestaba dos veces un mismo mensaje.

## 🔬 Investigación

El log del panel (buffer de 100 entradas) estaba completamente lleno de una ráfaga de reconexiones: **"♻️ Reconectando... (código: 440)" repetido cada ~8 segundos durante 4 minutos seguidos**, seguida de reconexiones más esporádicas (códigos 428/408) durante las horas siguientes. El código 440 en Baileys indica un conflicto de sesión/stream (conexión reemplazada). Esta ráfaga fue tan intensa que empujó fuera del buffer cualquier log directo del mensaje duplicado — el diagnóstico se hizo por análisis de código, no por ver el duplicado en vivo en los logs.

**Causa raíz confirmada en la documentación oficial de Baileys:** el evento `messages.upsert` trae un campo `type` que puede ser `'notify'` (mensaje nuevo, recibido en vivo) o `'append'` (reenvío de sincronización de historial — "add/update the given messages. If they were received while the connection was online, the update will have type: notify"). El ejemplo oficial de Baileys es explícito: solo tratar `type === 'notify'` como mensaje nuevo; todo lo demás es "ya visto/manejado".

El código de `bot.js` **nunca leía este campo** — procesaba absolutamente todo lo que llegara por `messages.upsert`, sin importar el `type`. Cada vez que el bot se reconectaba (y hubo muchísimas reconexiones seguidas ese día), Baileys podía reenviar mensajes recientes como parte de la sincronización de historial (`type: 'append'`) — y el bot los procesaba **de nuevo** como si fueran mensajes nuevos, generando una segunda respuesta al mismo mensaje.

## ✅ Qué se implementó

1. **Filtro por `type: 'notify'`** en el listener de `messages.upsert` (`bot.js`, `setupBotHandlers`) — solo se procesan mensajes que llegan en vivo; los de sincronización de historial se ignoran (con un log informativo si `logsEnabled`).
2. **`whatsapp/dedupe.js`** (nuevo módulo, `createMessageDeduper`) — una segunda capa de defensa: recuerda los últimos 500 `key.id` procesados y nunca vuelve a procesar el mismo mensaje dos veces, sin importar la causa (protege incluso si el filtro por `type` no cubriera algún caso no documentado). Vive como un módulo separado del `messages.upsert` de bot.js precisamente para que sea testeable con `node:test` sin tocar Baileys — 5 pruebas nuevas.
3. El deduplicador es un **singleton a nivel de módulo**, no se crea dentro de `setupBotHandlers` — si se creara ahí, se resetearía en cada reconexión, perdiendo la memoria justo en el momento en que más se necesita (reconectar es exactamente cuándo puede llegar un mensaje duplicado).

## 🔎 Hallazgo relacionado (no corregido a propósito, para no mezclar cambios)

La misma investigación encontró que el handler solo procesa `messages[0]` — Baileys entrega un **arreglo** de mensajes en cada `messages.upsert` y la documentación oficial advierte explícitamente: *"the event provides an array... do not just handle the first message, you will miss messages"*. Esto es una **pérdida** de mensajes (lo opuesto a duplicarlos), no la causa del bug reportado — se deja anotado para una futura sesión, ya que corregirlo implica decidir cómo debería comportarse la cola/anti-spam ante varios mensajes de un mismo evento, y no quería mezclar ese cambio de comportamiento con el fix puntual de esta sesión.

## 🧪 Verificación realizada
- `node --check` en los archivos tocados.
- `npm test` — 99/99 en verde (5 casos nuevos de `dedupe.test.js`).
- Bot reiniciado y reconectado sin pedir QR nuevo.
- Confirmado que no quedó ninguna instancia duplicada de `node bot.js` corriendo al mismo tiempo (se verificó explícitamente con `Get-CimInstance Win32_Process`, cuidando no tocar otros procesos node de otros proyectos del usuario que estaban corriendo en la misma máquina).

## 🔗 Relacionado
- [[Index]]
- [[Diagnostico de Entrega de Mensajes]]
- [[Fix Gemini 503 y Ampliacion del Panel]]
