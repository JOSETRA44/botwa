# 🔍 Comando /go - Búsqueda en Google Images

## ✅ **IMPLEMENTADO: Búsqueda con Google Custom Search**

---

## 🎯 **¿Qué hace el comando /go?**

Busca y envía una imagen desde Google Images. Encuentra **cualquier cosa**: logos, memes, banderas, capturas, diagramas, etc.

---

## 📝 **Cómo Usar**

### **Sintaxis:**
```
/go [búsqueda]
```

### **Ejemplos:**

```
/go logo python
→ Envía el logo de Python

/go meme gato
→ Envía un meme de gato

/go bandera peru
→ Envía la bandera de Perú

/go captura vscode
→ Envía captura de VSCode

/go diagrama red
→ Envía diagrama de red
```

---

## 🆚 **Diferencia: /gg vs /go**

| Característica | /gg (Unsplash) | /go (Google) |
|----------------|----------------|--------------|
| **Fuente** | Unsplash | Google Images |
| **Tipo** | Fotos profesionales | TODO |
| **Límite** | 50/hora | 100/día |
| **Calidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Variedad** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### **Cuándo usar /gg:**
- ✅ Fotos profesionales
- ✅ Paisajes, naturaleza
- ✅ Animales, personas
- ✅ Alta calidad estética

### **Cuándo usar /go:**
- ✅ Logos específicos
- ✅ Memes
- ✅ Banderas, símbolos
- ✅ Capturas de pantalla
- ✅ Diagramas técnicos
- ✅ Cualquier cosa específica

---

## 📊 **Ejemplo de Respuesta**

```
Usuario: /go logo python

Bot: 🔍 Buscando en Google: "logo python"...

[Envía imagen del logo de Python]

Bot: 🔍 Python Logo - Official
     🌐 Fuente: python.org
     🔗 Google Images
     
     💡 Usa /go [búsqueda] para más imágenes
```

---

## ✅ **Qué Puedes Buscar**

### **Logos:**
- `/go logo python` - Logo de Python
- `/go logo javascript` - Logo de JavaScript
- `/go logo react` - Logo de React
- `/go logo google` - Logo de Google

### **Memes:**
- `/go meme gato` - Memes de gatos
- `/go meme perro` - Memes de perros
- `/go meme programador` - Memes de programadores

### **Banderas:**
- `/go bandera peru` - Bandera de Perú
- `/go bandera españa` - Bandera de España
- `/go bandera brasil` - Bandera de Brasil

### **Capturas:**
- `/go captura vscode` - Captura de VSCode
- `/go captura windows` - Captura de Windows
- `/go screenshot chrome` - Captura de Chrome

### **Diagramas:**
- `/go diagrama red` - Diagrama de red
- `/go diagrama base datos` - Diagrama de BD
- `/go flowchart` - Diagrama de flujo

### **Iconos:**
- `/go icono casa` - Icono de casa
- `/go icono usuario` - Icono de usuario
- `/go icon settings` - Icono de configuración

### **Personajes:**
- `/go pikachu` - Pikachu
- `/go mario bros` - Mario Bros
- `/go mickey mouse` - Mickey Mouse

---

## 📊 **Límites**

### **Google Custom Search:**
- 🆓 **100 búsquedas por día** (gratis)
- 🔄 Se resetea a medianoche (UTC)
- ⚠️ Si se acaba, usa `/gg` como alternativa

### **Si llegas al límite:**
```
Bot: ❌ Límite de búsquedas de Google alcanzado (100/día). 
     Intenta mañana o usa /gg
```

---

## 💡 **Consejos para Mejores Resultados**

### **1. Sé Específico**
✅ Bueno: `/go logo python`
❌ Malo: `/go python`

### **2. Usa Palabras Clave**
✅ Bueno: `/go meme gato gracioso`
⚠️ Regular: `/go gato`

### **3. Prueba en Inglés**
✅ Bueno: `/go python logo` (más resultados)
⚠️ Regular: `/go logo de python`

### **4. Especifica el Tipo**
✅ Bueno: `/go captura vscode`
✅ Bueno: `/go diagrama red`
✅ Bueno: `/go icono casa`

---

## ⚙️ **Configuración**

### **En config.json:**

```json
{
  "googleSearch": {
    "apiKey": "TU_GOOGLE_SEARCH_API_KEY",
    "searchEngineId": "242b199a6ef514540",
    "enabled": true
  }
}
```

✅ Ya está configurado y listo para usar

---

## 🔧 **Solución de Problemas**

### **Problema 1: "API de Google no configurada"**
**Solución:**
- Verifica que `apiKey` y `searchEngineId` estén en config.json
- Reinicia el bot

### **Problema 2: "No se encontraron imágenes"**
**Solución:**
- Usa palabras más específicas
- Prueba en inglés
- Verifica la ortografía

### **Problema 3: "Límite alcanzado"**
**Solución:**
- Espera hasta mañana (se resetea a medianoche UTC)
- Usa `/gg` como alternativa
- Límite: 100 búsquedas/día

### **Problema 4: "Error al enviar la imagen"**
**Solución:**
- Verifica tu conexión a internet
- La imagen puede ser muy grande
- Intenta otra búsqueda

---

## 🎯 **Casos de Uso**

### **1. Desarrollo de Software**
```
Usuario: Necesito el logo de React
Usuario: /go logo react
Bot: [Envía logo de React]
```

### **2. Diseño Gráfico**
```
Usuario: /go icono usuario
Bot: [Envía icono de usuario]
Usuario: /go icono configuracion
Bot: [Envía icono de configuración]
```

### **3. Educación**
```
Usuario: /go diagrama sistema solar
Bot: [Envía diagrama del sistema solar]
Usuario: /go mapa mundo
Bot: [Envía mapa del mundo]
```

### **4. Entretenimiento**
```
Usuario: /go meme programador
Bot: [Envía meme de programador]
Usuario: /go pikachu
Bot: [Envía imagen de Pikachu]
```

---

## 🚀 **Comandos Relacionados**

```
/menu      - Ver todos los comandos
/ayuda     - Ayuda detallada
/gg        - Buscar fotos profesionales (Unsplash)
/go        - Buscar en Google Images
/pregunta  - Pregunta a la IA
/resumen   - Resume textos
```

---

## 📝 **Ejemplos Prácticos**

### **Ejemplo 1: Logo**
```
Usuario: /go logo python

Bot: 🔍 Buscando en Google: "logo python"...
     [Envía imagen]
     🔍 Python Logo - Official
     🌐 Fuente: python.org
     🔗 Google Images
```

### **Ejemplo 2: Meme**
```
Usuario: /go meme gato

Bot: 🔍 Buscando en Google: "meme gato"...
     [Envía imagen]
     🔍 Funny Cat Meme
     🌐 Fuente: imgur.com
     🔗 Google Images
```

### **Ejemplo 3: Bandera**
```
Usuario: /go bandera peru

Bot: 🔍 Buscando en Google: "bandera peru"...
     [Envía imagen]
     🔍 Bandera del Perú
     🌐 Fuente: wikipedia.org
     🔗 Google Images
```

### **Ejemplo 4: Sin Resultados**
```
Usuario: /go asdfghjkl

Bot: 🔍 Buscando en Google: "asdfghjkl"...
     ❌ No se encontraron imágenes
     
     💡 Intenta con:
     • Palabras diferentes
     • En inglés
     • Usa /gg para fotos profesionales
```

### **Ejemplo 5: Límite Alcanzado**
```
Usuario: /go logo java

Bot: 🔍 Buscando en Google: "logo java"...
     ❌ Límite de búsquedas de Google alcanzado (100/día). 
        Intenta mañana o usa /gg
```

---

## 🎉 **Beneficios**

### ✅ **Para Usuarios:**
- Encuentra cualquier imagen
- Logos, memes, banderas, etc.
- Resultados de Google (confiables)
- Fácil de usar

### ✅ **Para el Bot:**
- 100 búsquedas/día (suficiente)
- API oficial de Google
- Código simple y confiable
- Complementa a /gg

---

## 📊 **Estadísticas**

El bot registra en logs:
```
[14:30:15] 🔍 Imagen de Google enviada: "logo python"
[14:30:20] 🔍 Imagen de Google enviada: "meme gato"
[14:30:25] ❌ Error enviando imagen de Google: timeout
```

---

## 🔄 **Comparación Completa**

| Búsqueda | Usar /gg | Usar /go |
|----------|----------|----------|
| Paisaje | ✅ | ⚠️ |
| Animal | ✅ | ⚠️ |
| Logo | ❌ | ✅ |
| Meme | ❌ | ✅ |
| Bandera | ❌ | ✅ |
| Captura | ❌ | ✅ |
| Diagrama | ❌ | ✅ |
| Icono | ❌ | ✅ |

---

## 📚 **Documentación Oficial**

- **Google Custom Search:** https://developers.google.com/custom-search
- **API Reference:** https://developers.google.com/custom-search/v1/reference
- **Límites:** https://developers.google.com/custom-search/v1/overview#pricing

---

## ✨ **¡Disfruta Buscando en Google!**

El comando `/go` está listo para usar. Pruébalo con:

```
/go logo python
/go meme gato
/go bandera peru
/go captura vscode
```

**¡Encuentra cualquier cosa!** 🎉
