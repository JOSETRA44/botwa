---
tags:
  - botwa
  - sistema
  - rag
aliases:
  - responseMode
  - Modo Hibrido
---

# 🤝 Modo de Respuesta (IA / Híbrido / Solo Catálogo)

## 🎯 ¿Por qué existe?

Después del corte real por el [[Fix Error 429 Gemini - Limite de Cuota|límite de cuota de Gemini]], quedó claro que el negocio necesita que el bot siga respondiendo aunque la IA falle, esté agotada, o no esté configurada. El bot ya tenía la mitad del trabajo hecho: [[Sistema RAG - Base de Conocimiento|el RAG]] cae automáticamente a comparación de palabras clave sin necesidad de IA. Lo que faltaba era que las respuestas normales (no solo `/catalogo`) pudieran usar ese camino.

## ⚙️ Los 3 modos (`config.responseMode`)

Configurable desde el panel → pestaña **Configuración** → tarjetas justo debajo de la API Key de Gemini.

| Modo | Valor | Comportamiento |
|------|-------|----------------|
| 🤝 Equilibrado (por defecto) | `hybrid` | Si el catálogo tiene la respuesta exacta (score ≥ 0.80), responde directo sin gastar cuota de IA. Si no, intenta con Gemini — y si Gemini falla por cualquier motivo (429, sin key, error de red), cae al catálogo si hay algo que mostrar, o a un mensaje genérico si no. |
| 📚 Solo catálogo | `direct` | Nunca llama a Gemini. Responde con lo que haya en la base de conocimiento, o un mensaje honesto de "no lo tengo" si no hay coincidencia. Funciona con `apiKeyGemini` completamente vacío. |
| ✨ Siempre con IA | `ai` | Comportamiento de siempre (antes de este cambio): todo pasa por Gemini, con la misma lógica de reintento/límite de tasa ya existente. |

Aplica tanto a las **respuestas automáticas** (chat privado, `@bot` en grupos) como a `/pregunta`. El comando `/catalogo` sigue siendo independiente del modo — siempre responde directo del catálogo, como antes.

## 🧠 Cómo decide (`answerQuery()` en `bot.js`)

```
¿hay coincidencia en el catálogo con score ≥ 0.80?
  sí → responder directo del catálogo (ningún modo gasta IA aquí, excepto "ai")
  no →
    modo "direct"  → catálogo si hay algo, si no: mensaje genérico
    modo "ai"      → siempre Gemini
    modo "hybrid"  → ¿hay API key de Gemini?
                       no  → catálogo si hay algo, si no: mensaje genérico
                       sí  → intenta Gemini
                              falla → catálogo si hay algo, si no: mensaje genérico
```

El umbral de alta confianza (`HIGH_CONFIDENCE_SCORE = 0.80`) vive como constante en `rag.js` — más alto que el piso de relevancia general (0.65) porque aquí la barra es "esto ES la respuesta", no solo "podría servir".

## 🐛 Bug encontrado y corregido durante esta verificación

Al probar el guardado del nuevo selector se descubrió que **guardar la configuración desde el panel llevaba roto desde el rediseño** ([[Panel Web - Arquitectura y Diseño Editorial]]): el nuevo `public/js/config.js` ya envía `gruposPermitidos`/`gruposExcluidos` como arrays y `comandos`/`comandosSimples` como objetos, pero `server.js` seguía esperando strings crudos y les llamaba `.split()` — el endpoint lanzaba `TypeError` y devolvía error 500 en silencio. Además, `comandosSimples` nunca se persistía (ni siquiera en la versión anterior a este cambio). Se corrigió `POST /config` en `server.js` para aceptar ambos formatos (arrays/objetos del panel actual, o strings por compatibilidad) y para guardar `comandosSimples` correctamente. Verificado con un POST real que preservó los 3 grupos, 14 comandos y 3 comandos simples existentes sin pérdida de datos.

> [!warning] Si notaste que "guardar cambios" no hacía nada en el panel
> Ya está arreglado. Antes de este fix, cualquier guardado desde la pestaña Configuración fallaba silenciosamente (mensaje de éxito falso en algunos casos, error 500 en otros) sin que se reflejara en `config.json`.

## 🔗 Relacionado
- [[Index]]
- [[Sistema RAG - Base de Conocimiento]]
- [[Fix Error 429 Gemini - Limite de Cuota]]
- [[Panel Web - Arquitectura y Diseño Editorial]]
- [[Comando Catalogo (RAG)]]
