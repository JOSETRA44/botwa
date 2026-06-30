---
tags:
  - botwa
  - fix
---

# 🔧 Fix Definitivo: Comando `/papear`

## 🐛 Problema Real Encontrado

### Error Original:
```
❌ Error de API Gemini Papear: 404
models/gemini-1.5-flash is not found for API version v1beta
```

### Causa Raíz:
La API de Gemini tiene **DOS versiones**:
- **v1beta** - Versión beta (algunos modelos no disponibles)
- **v1** - Versión estable (todos los modelos disponibles)

El código estaba usando `v1beta` que NO soporta `gemini-1.5-flash` para `generateContent`.

---

## ✅ Solución Definitiva

### Cambio 1: Versión de API

**Antes** (❌ No funciona):
```javascript
`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
```

**Ahora** (✅ Funciona):
```javascript
`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`
```

### Cambio 2: Modelo por Defecto

**Antes**:
```javascript
const model = config.geminiPapear.model || 'gemini-2.5-flash';  // ❌ No existe
```

**Ahora**:
```javascript
const model = config.geminiPapear.model || 'gemini-1.5-flash';  // ✅ Correcto
```

### Cambio 3: Mejor Validación de Respuesta

**Antes** (causaba crash):
```javascript
if (data.candidates[0].content.parts[0]) {  // ❌ Crash si undefined
  return data.candidates[0].content.parts[0].text;
}
```

**Ahora** (seguro):
```javascript
if (data.candidates && 
    data.candidates.length > 0 && 
    data.candidates[0] &&
    data.candidates[0].content && 
    data.candidates[0].content.parts && 
    data.candidates[0].content.parts.length > 0) {
  return data.candidates[0].content.parts[0].text;
}
```

---

## 📊 Comparación de Versiones de API

| Versión | URL | Modelos Soportados | Estado |
|---------|-----|-------------------|--------|
| **v1beta** | `/v1beta/models/...` | Limitados | ⚠️ Beta |
| **v1** | `/v1/models/...` | Todos | ✅ Estable |

### Modelos Disponibles en v1:
- ✅ `gemini-1.5-flash`
- ✅ `gemini-1.5-pro`
- ✅ `gemini-1.0-pro`

### Modelos NO disponibles en v1beta para generateContent:
- ❌ `gemini-1.5-flash` (solo en v1)
- ❌ `gemini-1.5-pro` (solo en v1)

---

## 🧪 Pruebas

### Prueba 1: Auto-papeo
```
Tú: /papear
```

**Esperado**:
```
Bot: 🔥 *AUTO-PAPEO ACTIVADO* 🔥

Ni para usar un comando sirves 💀
Imagina no saber ni copiar bien un comando 🤡
```

### Prueba 2: Con argumentos
```
Tú: /papear es lento
```

**Esperado**:
```
Bot: 🔥 *PAPEADA* 🔥

"Es lento" dice el que tarda 3 días en responder 💀
Hermano, hasta una tortuga te gana 🐢
```

### Prueba 3: Respondiendo mensaje
```
Usuario A: "Los gatos son mejores"
Tú: /papear [respondiendo]
```

**Esperado**:
```
Bot: 🔥 *PAPEADA BRUTAL* 🔥

Hermano, con ese argumento no llegas ni a la esquina 💀
Los gatos ni te reconocen como dueño 🤡
```

---

## 🔍 Debugging

### Ver Logs en Consola

**Si funciona correctamente**:
```
✅ Respuesta de Gemini Papear: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
```

**Si hay error de API**:
```
❌ Error de API Gemini Papear: 404 {"error":{"code":404,"message":"..."}}
```

**Si la respuesta está vacía**:
```
⚠️ No se encontró contenido en la respuesta: {"candidates":[]}
```

---

## 📝 Configuración Final

### En `config.json`:
```json
{
  "geminiPapear": {
    "apiKey": "TU_GEMINI_PAPEAR_API_KEY",
    "enabled": true,
    "model": "gemini-1.5-flash"
  }
}
```

### En `bot.js`:
```javascript
// URL correcta con v1 (no v1beta)
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' }
        // ... resto de categorías en BLOCK_NONE
      ]
    })
  }
);
```

## 🔗 Relacionado
- [[Index]]
- [[Fix Papear - Debug]]
- [[Comando Papear (Sin Censura)]]