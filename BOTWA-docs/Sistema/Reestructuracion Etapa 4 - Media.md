---
tags:
  - botwa
  - sistema
  - arquitectura
aliases:
  - media/
  - Etapa 4 arquitectura
---

# 🏗️ Reestructuración — Etapa 4: media (stickers/LaTeX)

Última etapa pendiente del roadmap original (ver [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]), ejecutada al final porque las anteriores (proveedores, cola, comandos, preflight) tenían más impacto inmediato.

## 🔍 La duplicación real que esto arregló

`processAIResponseWithFormulas` (fórmulas LaTeX → sticker) y el comando `/s` en `commands/media.js` (imagen → sticker) tenían **la misma llamada a `sharp`** — resize a 512x512, `fit: 'contain'`, conversión a webp — cada uno con su propio color de fondo (blanco para fórmulas, transparente para fotos). Era la misma lógica escrita dos veces, con la variación real (el color de fondo) escondida en medio del código.

## ✅ Qué se hizo

- **`media/stickers.js`** — `imageToSticker(buffer, { background })` y `stickerToImage(buffer)`. El color de fondo quedó como parámetro (antes hardcodeado en cada sitio), que es la única diferencia real entre los dos usos.
- **`media/latex.js`** — `detectLatexFormulas(text)` y `renderLatexToImage(latex, { fetchImpl })`, movidos tal cual desde `bot.js`. `fetchImpl` inyectable para poder probar sin red real (mismo patrón usado en `providers/` desde la Etapa 2).
- `bot.js` y `commands/media.js` ahora importan estas funciones en vez de llamar a `sharp` directamente — `sharp` ya no se importa en ninguno de los dos archivos.

`bot.js` bajó de 950 a **886 líneas** (de 1938 líneas originales al inicio de la sesión, una reducción del **54%**).

## 🧪 Pruebas nuevas
`test/media.test.js` (8 casos): detección de fórmulas en bloque/inline, fórmulas ausentes, `renderLatexToImage` con éxito/fallo de red (mockeado), y conversión imagen↔sticker verificada con `sharp` real sobre una imagen generada en memoria (confirma formato webp/png y dimensiones 512x512, no solo que "no lance").

## 🧪 Verificación realizada
- `node --check` en todos los archivos del proyecto.
- `npm test` — 65/65 en verde.
- Bot real reiniciado y conectado sin problemas tras el cambio.

## 🗺️ Con esto se completó el roadmap original de reestructuración
Las 7 etapas planificadas están hechas. `bot.js` pasó de 1938 a 886 líneas. Lo que queda es todo lo ya documentado como "futuro, no bloqueante":
- Desacoplar `messages.upsert` con un `EventEmitter` interno (ver [[Reestructuracion Etapa 5 y 6 - Comandos]]).
- UI en el panel para cambiar modelos de IA sin editar `config.json` a mano (relevante ahora que el bot se vende — un cliente no técnico no puede reaccionar solo si xAI/Google vuelven a retirar un modelo).
- Créditos/billing pendientes en xAI y OpenAI (fuera del alcance del código).

## 🔗 Relacionado
- [[Index]]
- [[Reestructuracion Etapa 7 - Verificacion de Arranque]]
- [[Reestructuracion Etapa 5 y 6 - Comandos]]
- [[Soporte de Formulas Matematicas]]
- [[Comando r y Formulas como Sticker]]
