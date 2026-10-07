---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - rag/
  - multi-archivo
  - Etapa 8 arquitectura
  - Etapa 9 arquitectura
  - Etapa 10 arquitectura
---

# 🏗️ Reestructuración — Etapas 8, 9 y 10: RAG multi-archivo, panel profesional y navegación por WhatsApp

## 🎯 Contexto

El dueño pidió llevar el panel y el sistema RAG de "funcional" a "profesional, vendible a empresas para uso cotidiano": iconos en vez de emoticonos, catálogo con imágenes **y PDFs** (no solo una imagen por entrada), cada archivo con su propia descripción, y una forma de que el cliente final "navegue" el catálogo por WhatsApp. Pidió investigar qué hacen los chatbots profesionales antes de diseñar — el plan completo de esta investigación y diseño está en el historial de planificación de la sesión; este documento resume lo que efectivamente se construyó.

**Hallazgo clave de la investigación:** Baileys (la librería no oficial que usa este bot) ya no soporta de forma confiable botones/listas/carruseles interactivos de WhatsApp — Meta los deprecó para el protocolo Web MD no oficial, empujando todo hacia su API Cloud oficial (que requiere cuenta de Meta Business verificada, plantillas aprobadas y costo por conversación — fuera de alcance). Los paquetes que "reactivan" botones lo hacen con nodos binarios no soportados oficialmente, el mismo tipo de comportamiento no estándar que causó los problemas de sesión investigados en [[Diagnostico de Entrega de Mensajes]]. **Decisión: navegación por texto** (listas numeradas + comandos de paginación), el patrón estándar y seguro para bots no oficiales. Sí se confirmó que enviar documentos (PDF) es un tipo de mensaje básico y estable de Baileys.

## Etapa 8: RAG multi-archivo

`rag.js` (277 líneas, un archivo) se dividió en `rag/` siguiendo el mismo patrón de modularización usado en el resto del proyecto esta sesión:
- **`rag/files.js`** — sin estado: valida mime + tamaño + **magic bytes** (los primeros bytes reales del archivo, no solo el mime que declara el cliente — evita subir un ejecutable disfrazado de imagen), guarda/borra bytes en `knowledge/files/{entryId}/{fileId}.{ext}` (antes: `knowledge/images/{id}.{ext}`, plano, una sola imagen por entrada).
- **`rag/store.js`** — persistencia de `knowledge.json` con **escritura atómica** (temp + rename, no sobreescritura directa) y la **migración automática** del formato viejo (`imageFile` string → `files[]`) — corre una sola vez, la primera vez que se carga una base vieja.
- **`rag/search.js`** — embeddings + búsqueda, sin cambios de lógica. `buildContext` ahora arma `attachments` (imágenes Y pdfs de las coincidencias, con su descripción real) además de `images` (compatibilidad).
- **`rag/entries.js`** — el orquestador CRUD real (coordina files.js → store.js → search.js).
- **`rag/index.js`** — fachada pública, misma API de siempre.

**Nuevo modelo de datos**: `files: [{ id, filename, mime, kind: 'image'|'pdf', description }]` — hasta 5 archivos por entrada, 8MB por archivo, 20MB por entrada. Las descripciones son **para humanos, no para la IA** (petición explícita) — el embedding sigue calculándose solo de `title+text+tags`.

Migración verificada contra los datos reales del negocio (2 entradas) sin pérdida: las imágenes existentes pasaron a `files[]` con `kind: 'image'`, la carpeta vieja quedó vacía (archivos movidos, no copiados).

## Etapa 9: backend + panel profesional

- **`server.js`**: `POST/PUT /knowledge` ahora aceptan `files: [{base64, mime, filename, description}]` (arreglo). Nuevo `GET /knowledge/file/:entryId/:fileId` (generaliza el viejo `/knowledge/image/:file`, que ya no tenía sentido con el layout por carpeta) y `DELETE /knowledge/:id/file/:fileId` para borrar un archivo puntual sin borrar la entrada.
- **Panel — multi-archivo**: el input de imagen único se reemplazó por una zona de carga múltiple (`<input multiple accept="image/*,application/pdf">`) con un campo de descripción por archivo antes de subir; la lista de entradas ahora muestra una galería de chips (uno por archivo, con su descripción) en vez de una sola miniatura.
- **Panel — iconos profesionales**: se vendorizaron 21 iconos de **Lucide** (MIT, SVG) como un sprite inline embebido una vez en `index.html` — cero CDN, cero dependencia de red (coherente con que es un producto autoalojado que corre en la laptop del cliente). Reemplazó el chrome persistente del panel (títulos, botones, tarjetas, selector de modo); los emoticonos en mensajes transitorios de éxito/error (toasts) se dejaron sin tocar a propósito — no afectan la primera impresión "profesional" del dashboard y cambiarlos era un barrido mecánico de bajo valor.

Verificado con un test end-to-end real contra el servidor corriendo (crear entrada con imagen+PDF, servir cada archivo, buscar, borrar un archivo puntual, editar, borrar la entrada) y visualmente en el navegador — confirmado que las 2 entradas reales del negocio nunca se tocaron durante las pruebas.

## Etapa 10: navegación del catálogo por WhatsApp

- **`/catalogo` sin argumento**: lista numerada paginada (10 por página) en **orden global estable** (por `id`, nunca cambia) — el ítem "3" siempre es el mismo producto sin importar qué le mostramos antes a ese cliente ni si el bot se reinició. Se descartó a propósito la idea original de recordar "qué vio cada usuario" en memoria (un `Map` sin TTL en un proceso que ya tuvo un incidente de estabilidad) a favor de este enfoque sin estado, más simple y más confiable.
- **`/catalogo pN`**: página N. **`/catalogo [número]`**: detalle completo de ese producto (texto + todos sus archivos con su descripción real). **`/catalogo [texto]`**: búsqueda semántica de siempre.
- **`whatsapp/send.js`**: `sendRagImages` (máx. 2 imágenes, caption = solo el título) se generalizó a `sendEntryFiles` — envía imágenes **y PDFs**, con la descripción real de cada archivo como caption, un **presupuesto global de 6 adjuntos por respuesta** (no por entrada — evita que "las 3 mejores coincidencias" disparen hasta 15 mensajes de media en ráfaga a un número que ya tuvo problemas de sesión) y un pequeño delay entre envíos.
- `answerQuery()` pasó a devolver `attachments` (imágenes y PDFs con descripción) en vez de `images` (solo imágenes con título) — actualizado en `bot.js`, `whatsapp/messageHandler.js` y `commands/business.js`.

## 🧪 Verificación realizada
- `node --check` en los ~30 archivos del proyecto.
- `npm test` — **94/94 en verde** (14 pruebas nuevas de `rag.test.js`, 9 de `business.test.js`, 9 reescritas de `send.test.js`).
- Bot y panel reales reiniciados y reconectados sin pedir QR nuevo tras cada etapa.
- Migración de la base de conocimiento real verificada sin pérdida de datos.

## 📊 Balance del proyecto tras 10 etapas
`bot.js`: 1938 → **896 líneas** (-54%). RAG: 1 archivo de 277 líneas → 5 módulos de 22-156 líneas cada uno. Suite de pruebas: 0 → **94 casos**.

## 🗺️ Lo que sigue (no implementado, anotado a propósito)
- Deuda técnica: `server.js` sin autenticación (más relevante ahora que se pueden subir PDFs arbitrarios); sin barrido de archivos huérfanos si una escritura falla a mitad de camino.
- `EventEmitter` interno para desacoplar `messages.upsert` (ver [[Reestructuracion Etapa 5 y 6 - Comandos]]).
- Si el modelo de negocio pasa a soportar múltiples clientes desde una instalación (multi-tenant), requeriría una revisión de arquitectura mucho más grande.

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 7 - Verificacion de Arranque]]
- [[Reestructuracion Etapa 5 y 6 - Comandos]]
- [[Diagnostico de Entrega de Mensajes]]
- [[Sistema RAG - Base de Conocimiento]]
- [[Comando Catalogo (RAG)]]
