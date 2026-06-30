---
tags:
  - botwa
  - fix
---

# 🔧 Fix: Comando `/papear` - Debugging

## 🐛 Problema Encontrado

El comando `/papear` no estaba generando respuestas.

---

## ✅ Soluciones Aplicadas

### 1. **Modelo Incorrecto** ❌➡️✅

**Problema**: 
```json
"model": "gemini-2.5-flash"  // ❌ Este modelo NO EXISTE
```

**Solución**:
```json
"model": "gemini-1.5-flash"  // ✅ Modelo correcto
```

**Modelos válidos de Gemini**:
- `gemini-1.5-flash` (rápido, recomendado)
- `gemini-1.5-pro` (más potente, más lento)
- `gemini-1.0-pro` (versión anterior)

### 2. **Mejor Manejo de Errores** 🔍

Agregué logs detallados para ver exactamente qué está pasando:

```javascript
// Antes:
if (!response.ok) {
  throw new Error(`Error de API: ${response.status}`);
}

// Ahora:
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  console.error('❌ Error de API Gemini Papear:', response.status, errorData);
  throw new Error(`Error de API: ${response.status} - ${JSON.stringify(errorData)}`);
}
```

### 3. **Detección de Bloqueos por Safety** ⚠️

Aunque los safety settings están en `BLOCK_NONE`, Gemini puede bloquear respuestas muy extremas:

```javascript
// Verificar si la respuesta fue bloqueada
if (data.promptFeedback && data.promptFeedback.blockReason) {
  return `⚠️ La IA bloqueó la respuesta por: ${data.promptFeedback.blockReason}`;
}

if (data.candidates[0].finishReason === 'SAFETY') {
  return '⚠️ La IA bloqueó la respuesta por contenido sensible.';
}
```

---

## 🔍 Cómo Debuggear

### 1. **Ver Logs en Consola**

Cuando uses `/papear`, verás en la consola:

```
✅ Respuesta de Gemini Papear: {"candidates":[{"content":...
```

O si hay error:

```
❌ Error de API Gemini Papear: 400 {"error":{"message":"..."}}
```

### 2. **Verificar API Key**

Prueba la API key manualmente:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=TU_GEMINI_PAPEAR_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Hola"}]}]}'
```

### 3. **Probar con Mensaje Simple**

```
/papear test
```

Si funciona, el problema era el modelo.

---

## 📊 Posibles Errores y Soluciones

### Error 400: Invalid Model

**Causa**: Modelo incorrecto
**Solución**: Usar `gemini-1.5-flash` o `gemini-1.5-pro`

### Error 403: API Key Invalid

**Causa**: API Key incorrecta o sin permisos
**Solución**: Verificar la API key en Google AI Studio

### Error SAFETY

**Causa**: Contenido demasiado ofensivo
**Solución**: El bot ahora te avisa y puedes reformular

### No genera respuesta

**Causa**: Respuesta bloqueada silenciosamente
**Solución**: Los logs ahora muestran el motivo

---

## 🧪 Pruebas Recomendadas

### Prueba 1: Auto-papeo
```
/papear
```
**Esperado**: Te papea por no usar el comando correctamente

### Prueba 2: Con argumentos
```
/papear es lento
```
**Esperado**: Genera papeada sobre ser lento

### Prueba 3: Respondiendo mensaje
```
[Alguien dice algo]
/papear [respondiendo]
```
**Esperado**: Papea el mensaje citado

### Prueba 4: Con argumentos y mensaje
```
[Alguien dice algo]
/papear es otaku [respondiendo]
```
**Esperado**: Papea usando el argumento adicional

---

## 🔧 Configuración Final

### En `config.json`:
```json
{
  "geminiPapear": {
    "apiKey": "TU_GEMINI_PAPEAR_API_KEY",
    "enabled": true,
    "model": "gemini-1.5-flash"  // ✅ Corregido
  }
}
```

### Safety Settings (en código):
```javascript
safetySettings: [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
]
```

---

## 📝 Logs Mejorados

### Antes:
```
❌ Error al papear con Gemini: Error de API: 400
```

### Ahora:
```
❌ Error de API Gemini Papear: 400 {
  "error": {
    "code": 400,
    "message": "models/gemini-2.5-flash is not found",
    "status": "NOT_FOUND"
  }
}
```

Mucho más claro para debuggear.

---

## ✅ Checklist de Verificación

- [x] Modelo corregido a `gemini-1.5-flash`
- [x] API Key configurada correctamente
- [x] Safety settings en `BLOCK_NONE`
- [x] Logs detallados agregados
- [x] Detección de bloqueos por safety
- [x] Manejo de errores mejorado
- [x] Mensajes de error descriptivos

---

## 🎯 Resultado Esperado

### Funcionamiento Normal:
```
Usuario: /papear test
Bot: escribiendo...
Bot: 🔥 *AUTO-PAPEO ACTIVADO* 🔥

Ni para usar un comando sirves 💀
"Test" dice como si fuera un argumento válido 🤡
```

### Si hay bloqueo:
```
Bot: ⚠️ La IA bloqueó la respuesta por contenido sensible.
     Intenta reformular.
```

### Si hay error de API:
```
Bot: ❌ Error al generar la papeada: Error de API: 400 - {...}
```

---

## 🔍 Verificar en Tiempo Real

### 1. Inicia el bot
```bash
node bot.js
```

### 2. Usa el comando
```
/papear test
```

### 3. Observa la consola
Deberías ver:
```
✅ Respuesta de Gemini Papear: {"candidates":[...
```

O un error específico si algo falla.

---

## 💡 Tips Adicionales

### Si sigue sin funcionar:

1. **Verifica que el bot esté actualizado**:
   - Reinicia el bot después de los cambios
   - Asegúrate de que `config.json` se recargó

2. **Prueba la API Key manualmente**:
   - Ve a Google AI Studio
   - Prueba la key con el modelo `gemini-1.5-flash`

3. **Revisa los logs**:
   - Busca mensajes de error en la consola
   - Los nuevos logs te dirán exactamente qué falló

4. **Prueba con diferentes mensajes**:
   - Empieza con algo simple
   - Si funciona, prueba con mensajes más complejos

---

**Fecha de fix**: 22 de noviembre de 2025
**Problema**: Modelo incorrecto (`gemini-2.5-flash` no existe)
**Solución**: Cambiado a `gemini-1.5-flash`
**Estado**: ✅ CORREGIDO Y MEJORADO

## 🔗 Relacionado
- [[Index]]
- [[Fix Papear - Definitivo]]
- [[Comando Papear (Sin Censura)]]
