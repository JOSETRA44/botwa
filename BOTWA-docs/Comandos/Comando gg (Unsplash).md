---
tags:
  - botwa
  - comando
aliases:
  - "/gg"
---

# 🖼️ Comando /gg - Búsqueda de Imágenes

## ✅ **IMPLEMENTADO: Búsqueda de Imágenes con Unsplash**

---

## 🎯 **¿Qué hace el comando /gg?**

Busca y envía una imagen de alta calidad desde Unsplash basada en tu búsqueda.

---

## 📝 **Cómo Usar**

### **Sintaxis:**
```
/gg [búsqueda]
```

### **Ejemplos:**

```
/gg gato
→ Envía una foto de un gato

/gg montaña
→ Envía una foto de una montaña

/gg playa
→ Envía una foto de una playa

/gg café
→ Envía una foto de café

/gg atardecer
→ Envía una foto de un atardecer

/gg ciudad
→ Envía una foto de una ciudad
```

---

## 🎨 **Características**

### **1. Una Imagen por Búsqueda**
- Envía solo 1 imagen de alta calidad
- Rápido y eficiente
- No satura el chat

### **2. Imágenes Profesionales**
- Fotos de alta resolución
- Estéticamente agradables
- De fotógrafos profesionales

### **3. Información de Créditos**
- Muestra el nombre del fotógrafo
- Link a Unsplash
- Descripción de la imagen

### **4. Búsqueda Inteligente**
- Entiende español e inglés
- Busca conceptos generales
- Resultados relevantes

---

## 📊 **Ejemplo de Respuesta**

```
Usuario: /gg perro

Bot: 🔍 Buscando imagen de "perro"...

[Envía imagen de un perro]

Bot: 📸 Golden Retriever jugando en el parque

     👤 Foto por: John Doe
     🔗 Unsplash.com
     
     💡 Usa /gg [búsqueda] para más imágenes
```

---

## ✅ **Qué Puedes Buscar**

### **Animales:**
- `/gg gato` - Gatos
- `/gg perro` - Perros
- `/gg león` - Leones
- `/gg pájaro` - Pájaros
- `/gg pez` - Peces

### **Naturaleza:**
- `/gg montaña` - Montañas
- `/gg bosque` - Bosques
- `/gg océano` - Océanos
- `/gg río` - Ríos
- `/gg flor` - Flores

### **Paisajes:**
- `/gg playa` - Playas
- `/gg desierto` - Desiertos
- `/gg campo` - Campos
- `/gg lago` - Lagos
- `/gg cascada` - Cascadas

### **Ciudades:**
- `/gg ciudad` - Ciudades
- `/gg calle` - Calles
- `/gg edificio` - Edificios
- `/gg puente` - Puentes
- `/gg arquitectura` - Arquitectura

### **Objetos:**
- `/gg café` - Café
- `/gg libro` - Libros
- `/gg computadora` - Computadoras
- `/gg cámara` - Cámaras
- `/gg reloj` - Relojes

### **Conceptos:**
- `/gg atardecer` - Atardeceres
- `/gg amanecer` - Amaneceres
- `/gg noche` - Noche
- `/gg lluvia` - Lluvia
- `/gg nieve` - Nieve

### **Personas:**
- `/gg doctor` - Doctores
- `/gg chef` - Chefs
- `/gg músico` - Músicos
- `/gg deportista` - Deportistas
- `/gg familia` - Familias

---

## ❌ **Qué NO Puedes Buscar**

Unsplash solo tiene fotos de stock, NO encontrarás:

- ❌ Logos específicos (ej: "logo de python")
- ❌ Memes
- ❌ Capturas de pantalla
- ❌ Diagramas técnicos
- ❌ Personajes de anime/caricaturas
- ❌ Marcas específicas

**Si buscas algo que no existe:**
```
Bot: ❌ No se encontraron imágenes

     💡 Intenta con:
     • Palabras más generales
     • En inglés (ej: "cat" en vez de "gato")
     • Conceptos simples: paisajes, animales, objetos
```

---

## 💡 **Consejos para Mejores Resultados**

### **1. Usa Palabras Simples**
✅ Bueno: `/gg gato`
❌ Malo: `/gg gato persa con ojos azules`

### **2. Conceptos Generales**
✅ Bueno: `/gg montaña`
❌ Malo: `/gg monte everest desde el lado norte`

### **3. Prueba en Inglés**
✅ Bueno: `/gg cat` (más resultados)
⚠️ Regular: `/gg gato` (menos resultados)

### **4. Una Palabra es Mejor**
✅ Bueno: `/gg playa`
⚠️ Regular: `/gg playa tropical`

---

## ⚙️ **Configuración**

### **En config.json:**

```json
{
  "unsplash": {
    "accessKey": "TU_ACCESS_KEY",
    "secretKey": "TU_SECRET_KEY",
    "enabled": true
  }
}
```

### **Límites de Unsplash:**
- 🆓 **50 búsquedas por hora** (gratis)
- 🔄 Se resetea cada hora automáticamente
- ✅ Suficiente para uso personal

---

## 🔧 **Solución de Problemas**

### **Problema 1: "API de Unsplash no configurada"**
**Solución:**
- Verifica que `accessKey` esté en config.json
- Reinicia el bot

### **Problema 2: "No se encontraron imágenes"**
**Solución:**
- Usa palabras más simples
- Prueba en inglés
- Busca conceptos generales

### **Problema 3: "Error al enviar la imagen"**
**Solución:**
- Verifica tu conexión a internet
- Intenta de nuevo
- Reinicia el bot si persiste

### **Problema 4: Límite alcanzado**
**Síntoma:** No responde o da error
**Solución:**
- Espera 1 hora (se resetea automáticamente)
- Límite: 50 búsquedas/hora

---

## 📊 **Estadísticas**

El bot registra en logs:
```
[14:30:15] 📸 Imagen enviada: "gato"
[14:30:20] 📸 Imagen enviada: "montaña"
[14:30:25] ❌ Error enviando imagen: timeout
```

---

## 🎯 **Casos de Uso**

### **1. Ilustrar Conversaciones**
```
Usuario: Estoy pensando en ir a la playa
Bot: [respuesta con IA]
Usuario: /gg playa
Bot: [envía foto de playa]
```

### **2. Inspiración Visual**
```
Usuario: /gg atardecer
Bot: [envía foto de atardecer]
Usuario: ¡Hermoso! /gg montaña
Bot: [envía foto de montaña]
```

### **3. Aprender Vocabulario**
```
Usuario: ¿Qué es un "fjord"?
Bot: [explicación con IA]
Usuario: /gg fjord
Bot: [envía foto de un fjord]
```

---

## 🚀 **Comandos Relacionados**

```
/menu      - Ver todos los comandos
/ayuda     - Ayuda detallada
/pregunta  - Pregunta a la IA
/resumen   - Resume textos
/gg        - Busca imágenes
```

---

## 📝 **Ejemplos Prácticos**

### **Ejemplo 1: Búsqueda Simple**
```
Usuario: /gg gato

Bot: 🔍 Buscando imagen de "gato"...
     [Envía imagen]
     📸 Gato naranja durmiendo
     👤 Foto por: Jane Smith
     🔗 Unsplash.com
```

### **Ejemplo 2: Sin Resultados**
```
Usuario: /gg logo de python

Bot: 🔍 Buscando imagen de "logo de python"...
     ❌ No se encontraron imágenes
     
     💡 Intenta con:
     • Palabras más generales
     • En inglés (ej: "cat" en vez de "gato")
     • Conceptos simples: paisajes, animales, objetos
```

### **Ejemplo 3: Uso Incorrecto**
```
Usuario: /gg

Bot: ⚠️ Uso: /gg [búsqueda]
     
     📝 Ejemplos:
     • /gg gato
     • /gg montaña
     • /gg playa
     • /gg café
     
     💡 Busca paisajes, animales, objetos, etc.
```

---

## 🎉 **Beneficios**

### ✅ **Para Usuarios:**
- Imágenes de alta calidad
- Respuesta rápida (1 imagen)
- Fácil de usar
- Gratis

### ✅ **Para el Bot:**
- No consume mucha API
- 50 búsquedas/hora (suficiente)
- Código simple y confiable
- Fácil de mantener

---

## 🔄 **Actualizaciones Futuras (Opcional)**

### **Posibles Mejoras:**
1. **Múltiples Imágenes**
   - `/gg gato 3` → Envía 3 imágenes

2. **Filtros**
   - `/gg gato -color:black` → Solo gatos negros

3. **Categorías**
   - `/gg-foto naturaleza` → Fotos de naturaleza
   - `/gg-paisaje montaña` → Paisajes de montañas

4. **Favoritos**
   - `/gg-save gato` → Guardar imagen
   - `/gg-list` → Ver guardadas

---

## 📚 **Documentación Oficial**

- **Unsplash API:** https://unsplash.com/developers
- **Términos de Uso:** https://unsplash.com/terms
- **Límites:** https://unsplash.com/documentation#rate-limiting

---

## ✨ **¡Disfruta Buscando Imágenes!**

El comando `/gg` está listo para usar. Pruébalo con:

```
/gg gato
/gg montaña
/gg playa
/gg café
```

**¡Diviértete!** 🎉

## 🔗 Relacionado
- [[Index]]
- [[Comando go (Google Images)]]
