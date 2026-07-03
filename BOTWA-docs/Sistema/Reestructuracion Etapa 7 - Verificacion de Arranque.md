---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - preflight
  - shared/preflight.js
  - Etapa 7 arquitectura
---

# 🏗️ Reestructuración — Etapa 7: verificación de arranque

## 🎯 Por qué

El dueño reveló un dato que cambia las prioridades: **este bot está diseñado para venderse** — cada cliente lo instala en su propia laptop/servidor con su propio número de WhatsApp (no es un SaaS multi-tenant compartido; ver la discusión de arquitectura en [[Reestructuracion Etapa 5 y 6 - Comandos]]). Eso significa que quien lo configura no necesariamente es alguien técnico, y no va a tener a nadie investigando por horas cuando algo falla — exactamente lo que pasó esta misma sesión con Grok y OpenAI: llevaban roto un tiempo indeterminado y nadie lo sabía hasta que se investigó a fondo.

Se buscaron skills externos para esto (`npx skills find`) — ninguno resultó realmente aplicable (uno era sobre validar *ideas de negocio*, no configuración de software; el otro tenía poca adopción y cubría algo ya conocido), así que se implementó directo.

## ✅ Qué se hizo

**`shared/preflight.js`** — un reporte de arranque que corre en `startBot()`, antes de intentar conectar a WhatsApp:
- `buildPreflightReport(config, { entryCount })` — función pura, testeable, que arma una lista de items con estado `ok`/`warning`/`info`.
- `printPreflightReport(report)` — lo imprime en consola de forma legible para alguien no técnico.

**Deliberadamente NO hace llamadas reales a ninguna API** — solo valida presencia de claves y forma del config. La razón es concreta: Grok y OpenAI no tienen nivel gratuito, así que una validación "en vivo" en cada arranque le costaría dinero al cliente cada vez que reinicia el bot. En cambio, valida:
- Gemini (motor principal): si falta la key, advierte que el modo "ai" y las respuestas fuera del catálogo no van a funcionar (pero el modo híbrido/directo sigue sirviendo desde el catálogo).
- Catálogo de negocio (RAG): si está vacío, lo dice explícitamente — un catálogo vacío es la razón más probable de que el modo híbrido no tenga nada que responder.
- Las 6 integraciones opcionales (Grok, OpenAI, Gemini Vision, Gemini Papear, Unsplash, Google Search): informa cuál comando se ve afectado si falta cada una, sin bloquear el arranque.

Ejemplo real de salida:
```
📋 Verificación de configuración:
────────────────────────────────────────────────────────────
✅ Gemini (motor principal): Configurado.
✅ Catálogo de negocio (RAG): 2 entrada(s) cargada(s).
✅ Grok / xAI (/elon): Configurado.
✅ ChatGPT / OpenAI (/sora): Configurado.
...
────────────────────────────────────────────────────────────
```

## 🧪 Verificación realizada
- `node --check` en todos los archivos.
- `npm test` — 57/57 en verde (7 casos nuevos de `preflight.test.js`).
- Bot real reiniciado y confirmado que el reporte se imprime antes de la conexión a WhatsApp, sin costo (no llamó a ninguna API externa).

## 🗺️ Lo que sigue
- **Etapa 4** (aún pendiente): centralizar la conversión de stickers/LaTeX en `media.js`.
- Considerar: un comando de panel/CLI para que el propio cliente pueda correr este preflight check bajo demanda (hoy solo se ve en la consola al arrancar `node bot.js`, que un cliente no técnico puede no estar mirando).
- Si el modelo de negocio cambia a soportar múltiples clientes desde una sola instalación (multi-tenant), esto requeriría una revisión de arquitectura mucho más grande — no asumido, a confirmar con el dueño si llega a ser el caso.

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 5 y 6 - Comandos]]
- [[Diagnostico de Entrega de Mensajes]]
