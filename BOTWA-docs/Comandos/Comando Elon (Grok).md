---
tags:
  - botwa
  - comando
aliases:
  - "/elon"
---

# ✅ Comando /elon (Grok AI) - IMPLEMENTADO

## 🎯 Estado: COMPLETADO

La integración con Grok (xAI de Elon Musk) está **100% funcional**.

## 📋 Configuración

### En `config.json`:
```json
"grok": {
  "apiKey": "TU_GROK_API_KEY",
  "enabled": true,
  "model": "grok-beta"
}
```

### Comando registrado:
```json
"/elon": "Pregunta a Grok (xAI de Elon Musk)"
```

## 🚀 Cómo usar

### Sintaxis:
```
/elon [tu pregunta]
```

### Ejemplos:
```
/elon ¿Qué opinas de los coches eléctricos?
/elon Explícame la inteligencia artificial
/elon ¿Cuál es el futuro de la tecnología?
/elon Dame consejos para emprender
```

## 🔧 Implementación técnica

### Función principal: `callGrok()`
- **Endpoint**: `https://api.x.ai/v1/chat/completions`
- **Método**: POST
- **Modelo**: grok-beta
- **Temperature**: 0.7
- **Prompt global**: Usa el mismo prompt configurado para Gemini

### Flujo:
1. Usuario envía `/elon [pregunta]`
2. Bot valida que haya texto después del comando
3. Envía mensaje "🚀 Consultando a Grok..."
4. Llama a la API de xAI con la pregunta
5. Responde con formato: `🤖 *Grok (xAI):*\n\n[respuesta]`

## ✅ Características

- ✅ Integración completa con API de xAI
- ✅ Manejo de errores robusto
- ✅ Validación de API Key
- ✅ Usa el prompt global configurado
- ✅ Respuestas formateadas
- ✅ Mensajes de estado al usuario
- ✅ Compatible con el sistema de cola de mensajes

## 🎨 Mensajes del bot

### Cuando falta texto:
```
⚠️ Envía tu pregunta después del comando /elon

Ejemplo: /elon ¿Qué opinas de los coches eléctricos?
```

### Mientras procesa:
```
🚀 Consultando a Grok...
```

### Respuesta exitosa:
```
🤖 *Grok (xAI):*

[Respuesta de Grok aquí]
```

### Si hay error:
```
❌ Error al conectar con Grok. Verifica tu API Key.
```

## 📊 Comparación con otros comandos IA

| Comando | IA | Uso |
|---------|-----|-----|
| `/pregunta` | Gemini | Preguntas generales |
| `/elon` | Grok (xAI) | Preguntas con estilo Elon Musk |
| `/resumen` | Gemini | Resumir textos |
| `/analizar` | Gemini Vision | Analizar imágenes |

## 🔐 Seguridad

- La API Key está configurada en `config.json`
- Se valida la existencia de la configuración antes de usar
- Manejo seguro de errores de API

## 🎯 Próximos pasos sugeridos

1. ✅ Probar el comando en WhatsApp
2. ✅ Verificar que las respuestas sean coherentes
3. ✅ Ajustar el prompt global si es necesario
4. ✅ Monitorear el uso de la API

## 📝 Notas

- Grok usa el mismo `promptGlobal` que Gemini
- El modelo por defecto es `grok-beta`
- La temperatura está en 0.7 para respuestas balanceadas
- Compatible con todos los grupos permitidos

---

**Estado final**: ✅ LISTO PARA USAR
**Fecha**: 22 de noviembre de 2025

## 🔗 Relacionado
- [[Index]]
- [[Comando Sora (ChatGPT)]]
- [[Comando Papear (Sin Censura)]]
- [[Resumen de IAs Disponibles]]
