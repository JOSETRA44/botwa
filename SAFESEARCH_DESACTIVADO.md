# 🔓 SafeSearch Desactivado en Google Images

## ✅ **CONFIGURADO: Búsquedas Sin Censura**

---

## 🎯 **¿Qué es SafeSearch?**

SafeSearch es un filtro de Google que censura contenido explícito o sensible en los resultados de búsqueda.

---

## 🔓 **Estado Actual: DESACTIVADO**

Tu bot está configurado con **SafeSearch desactivado** (`safe=off`), lo que significa:

- ✅ **Sin censura** - Muestra todos los resultados
- ✅ **Sin filtros** - No oculta contenido
- ✅ **Resultados completos** - Todo lo que Google encuentra

---

## ⚙️ **Configuración**

### **En config.json:**

```json
{
  "googleSearch": {
    "apiKey": "TU_GOOGLE_SEARCH_API_KEY",
    "searchEngineId": "242b199a6ef514540",
    "enabled": true,
    "safeSearch": false  ← Sin censura
  }
}
```

### **Opciones:**

```json
"safeSearch": false  → Sin censura (safe=off)
"safeSearch": true   → Con censura (safe=active)
```

---

## 🔧 **Cómo Funciona**

### **Con SafeSearch Desactivado (Actual):**
```javascript
// URL de búsqueda:
https://www.googleapis.com/customsearch/v1?
  key=API_KEY
  &cx=SEARCH_ENGINE_ID
  &q=búsqueda
  &searchType=image
  &num=1
  &safe=off  ← Sin censura
```

### **Con SafeSearch Activado:**
```javascript
// URL de búsqueda:
https://www.googleapis.com/customsearch/v1?
  key=API_KEY
  &cx=SEARCH_ENGINE_ID
  &q=búsqueda
  &searchType=image
  &num=1
  &safe=active  ← Con censura
```

---

## 📊 **Comparación**

| Característica | SafeSearch OFF | SafeSearch ON |
|----------------|----------------|---------------|
| **Censura** | ❌ No | ✅ Sí |
| **Resultados** | Todos | Filtrados |
| **Contenido explícito** | ✅ Muestra | ❌ Oculta |
| **Contenido sensible** | ✅ Muestra | ❌ Oculta |
| **Resultados completos** | ✅ Sí | ⚠️ Limitados |

---

## 🎯 **Ejemplos**

### **Con SafeSearch OFF (Actual):**
```
Usuario: /go bikini
Bot: [Muestra todos los resultados sin filtrar]

Usuario: /go contenido adulto
Bot: [Muestra todos los resultados]
```

### **Con SafeSearch ON:**
```
Usuario: /go bikini
Bot: [Solo muestra resultados "seguros"]

Usuario: /go contenido adulto
Bot: [Puede no encontrar resultados]
```

---

## 🔄 **Cómo Cambiar la Configuración**

### **Para Activar SafeSearch (Con Censura):**

1. Abre `config.json`
2. Cambia:
   ```json
   "safeSearch": false
   ```
   Por:
   ```json
   "safeSearch": true
   ```
3. Reinicia el bot

### **Para Desactivar SafeSearch (Sin Censura):**

1. Abre `config.json`
2. Cambia:
   ```json
   "safeSearch": true
   ```
   Por:
   ```json
   "safeSearch": false
   ```
3. Reinicia el bot

---

## ⚠️ **IMPORTANTE**

### **Responsabilidad:**
- ⚠️ Con SafeSearch desactivado, el bot puede mostrar contenido explícito
- ⚠️ Asegúrate de que los usuarios sean mayores de edad
- ⚠️ Cumple con las leyes locales sobre contenido

### **Recomendaciones:**
- ✅ Informa a los usuarios sobre la configuración
- ✅ Usa con responsabilidad
- ✅ Considera activar SafeSearch si es para menores

---

## 🔍 **Verificación**

Para verificar que SafeSearch está desactivado:

1. Reinicia el bot
2. Busca algo que normalmente sería filtrado
3. Si muestra todos los resultados → SafeSearch OFF ✅
4. Si filtra resultados → SafeSearch ON

---

## 📝 **Logs**

El bot registra las búsquedas normalmente:
```
[14:30:15] 🔍 Imagen de Google enviada: "búsqueda"
```

No hay diferencia en los logs entre SafeSearch ON u OFF.

---

## 🎯 **Estado Actual**

```
✅ SafeSearch: DESACTIVADO (safe=off)
✅ Sin censura
✅ Resultados completos
✅ Bot sin restricciones
```

---

## 🔧 **Código Implementado**

```javascript
// En bot.js - función searchGoogleImage()
const safeSearch = config.googleSearch.safeSearch !== false ? 'active' : 'off';
const url = `https://www.googleapis.com/customsearch/v1?
  key=${apiKey}
  &cx=${searchEngineId}
  &q=${encodeURIComponent(query)}
  &searchType=image
  &num=1
  &safe=${safeSearch}`;  ← Parámetro de SafeSearch
```

---

## ✅ **Resumen**

Tu bot está configurado con:
- ✅ **SafeSearch desactivado** (`safe=off`)
- ✅ **Sin censura** en búsquedas de Google
- ✅ **Resultados completos** sin filtros
- ✅ **Configurable** desde config.json

**¡Tu bot es sin restricciones como lo querías!** 🔓
