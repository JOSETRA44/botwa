# 🧪 Pruebas del Sistema de Cola de Mensajes

## 📋 **Guía de Pruebas**

Sigue estos pasos para verificar que el sistema de cola funciona correctamente.

---

## 🚀 **Preparación**

1. **Reinicia el bot:**
   ```bash
   # Detén el bot actual (Ctrl+C)
   iniciar-qr-normal.bat
   ```

2. **Activa los logs:**
   - Abre el panel web: http://localhost:3000
   - Activa "Logs Habilitados"
   - Observa la consola del bot

---

## ✅ **Prueba 1: Mensajes Agrupados (Básico)**

### **Objetivo:** Verificar que agrupa mensajes rápidos

### **Pasos:**
1. Envía al bot (en chat privado):
   ```
   Hola
   ```
2. Inmediatamente (antes de 3 segundos):
   ```
   ¿Cómo estás?
   ```
3. Inmediatamente:
   ```
   Necesito ayuda
   ```
4. **Espera 3 segundos**

### **Resultado Esperado:**
- ✅ El bot responde UNA sola vez
- ✅ La respuesta considera los 3 mensajes
- ✅ En logs: "Procesando 3 mensaje(s) agrupado(s)"

### **Ejemplo de respuesta esperada:**
```
Bot: "¡Hola! Estoy bien, gracias por preguntar. 
      Claro, ¿en qué necesitas ayuda?"
```

---

## ✅ **Prueba 2: Mensajes Espaciados**

### **Objetivo:** Verificar que responde a mensajes separados

### **Pasos:**
1. Envía:
   ```
   ¿Qué es la IA?
   ```
2. **Espera 5 segundos** (más de 3)
3. Envía:
   ```
   ¿Y el machine learning?
   ```
4. **Espera 5 segundos**

### **Resultado Esperado:**
- ✅ El bot responde DOS veces (una por cada mensaje)
- ✅ Cada respuesta es independiente
- ✅ En logs: "Procesando 1 mensaje(s) agrupado(s)" (dos veces)

---

## ✅ **Prueba 3: Corrección Rápida**

### **Objetivo:** Verificar contexto en correcciones

### **Pasos:**
1. Envía:
   ```
   ¿Cuál es la capital de Francia?
   ```
2. Inmediatamente:
   ```
   perdón, de España
   ```
3. **Espera 3 segundos**

### **Resultado Esperado:**
- ✅ El bot entiende la corrección
- ✅ Responde sobre España, no Francia
- ✅ Respuesta: "La capital de España es Madrid 🇪🇸"

---

## ✅ **Prueba 4: Múltiples Instrucciones**

### **Objetivo:** Verificar que procesa instrucciones múltiples

### **Pasos:**
1. Envía:
   ```
   Resume este texto: La inteligencia artificial es...
   ```
2. Inmediatamente:
   ```
   hazlo en 3 puntos
   ```
3. Inmediatamente:
   ```
   y usa emojis
   ```
4. **Espera 3 segundos**

### **Resultado Esperado:**
- ✅ El bot resume el texto
- ✅ Lo hace en 3 puntos
- ✅ Usa emojis
- ✅ Todo en una sola respuesta

---

## ✅ **Prueba 5: Anti-Spam (Límite de Cola)**

### **Objetivo:** Verificar que avisa cuando hay spam

### **Pasos:**
1. Envía 11 mensajes seguidos (rápido):
   ```
   Mensaje 1
   Mensaje 2
   Mensaje 3
   ...
   Mensaje 11
   ```

### **Resultado Esperado:**
- ✅ El bot procesa los primeros 10
- ✅ En el mensaje 11, responde:
   ```
   ⚠️ Por favor espera a que responda tus mensajes 
      anteriores antes de enviar más.
   ```
- ✅ En logs: "Cola llena para usuario: ..."

---

## ✅ **Prueba 6: En Grupos con @bot**

### **Objetivo:** Verificar que funciona en grupos

### **Pasos:**
1. En un grupo permitido, envía:
   ```
   @bot hola
   ```
2. Inmediatamente:
   ```
   @bot ¿cómo estás?
   ```
3. **Espera 3 segundos**

### **Resultado Esperado:**
- ✅ El bot agrupa ambos mensajes
- ✅ Responde una sola vez
- ✅ La respuesta considera ambos mensajes

---

## ✅ **Prueba 7: Comandos (No Afectados)**

### **Objetivo:** Verificar que comandos funcionan normal

### **Pasos:**
1. Envía:
   ```
   /menu
   ```
2. Inmediatamente:
   ```
   /biografia
   ```

### **Resultado Esperado:**
- ✅ El bot responde DOS veces inmediatamente
- ✅ No agrupa comandos
- ✅ Cada comando se ejecuta al instante

---

## ✅ **Prueba 8: Mezcla Comandos y Mensajes**

### **Objetivo:** Verificar que no mezcla comandos con mensajes

### **Pasos:**
1. Envía:
   ```
   Hola
   ```
2. Inmediatamente:
   ```
   /menu
   ```
3. Inmediatamente:
   ```
   ¿Cómo estás?
   ```

### **Resultado Esperado:**
- ✅ `/menu` se ejecuta inmediatamente
- ✅ "Hola" y "¿Cómo estás?" se agrupan
- ✅ Dos respuestas: una del comando, otra de los mensajes

---

## 📊 **Verificación de Logs**

### **Logs Esperados (Ejemplo):**

```
[14:30:15] 📩 [CONTACTO] Mensaje: Hola
[14:30:15] 📝 [CONTACTO] Mensaje agregado a cola (1 en buffer)
[14:30:16] 📩 [CONTACTO] Mensaje: ¿Cómo estás?
[14:30:16] 📝 [CONTACTO] Mensaje agregado a cola (2 en buffer)
[14:30:17] 📩 [CONTACTO] Mensaje: Necesito ayuda
[14:30:17] 📝 [CONTACTO] Mensaje agregado a cola (3 en buffer)
[14:30:20] 🔄 [CONTACTO] Procesando 3 mensaje(s) agrupado(s)
[14:30:23] ✅ [CONTACTO] Respuesta enviada (1/100 esta hora)
```

---

## 🐛 **Problemas Comunes**

### **Problema 1: No agrupa mensajes**
**Síntoma:** Responde a cada mensaje por separado

**Solución:**
- Verifica que envías mensajes en menos de 3 segundos
- Revisa `config.json` → `messageGrouping.enabled: true`

### **Problema 2: No responde**
**Síntoma:** El bot no responde a ningún mensaje

**Solución:**
- Verifica que el bot esté activo (panel web)
- Revisa logs para ver errores
- Verifica API Key de Gemini

### **Problema 3: Responde muy lento**
**Síntoma:** Tarda más de 3 segundos en responder

**Solución:**
- Es normal, espera 3 segundos para agrupar
- Puedes reducir `groupDelay` en config.json

### **Problema 4: Avisa spam cuando no es**
**Síntoma:** Dice "espera..." con pocos mensajes

**Solución:**
- Aumenta `maxQueueSize` en config.json
- Verifica que no haya mensajes pendientes

---

## 📈 **Métricas de Éxito**

### **El sistema funciona correctamente si:**

- ✅ Agrupa 2-5 mensajes rápidos en una respuesta
- ✅ Responde a mensajes espaciados por separado
- ✅ No pierde ningún mensaje
- ✅ Avisa cuando hay spam (>10 mensajes)
- ✅ Comandos funcionan inmediatamente
- ✅ Logs muestran "Procesando X mensaje(s) agrupado(s)"

---

## 🎯 **Checklist Final**

Marca cada prueba completada:

- [ ] Prueba 1: Mensajes agrupados ✅
- [ ] Prueba 2: Mensajes espaciados ✅
- [ ] Prueba 3: Corrección rápida ✅
- [ ] Prueba 4: Múltiples instrucciones ✅
- [ ] Prueba 5: Anti-spam ✅
- [ ] Prueba 6: En grupos con @bot ✅
- [ ] Prueba 7: Comandos ✅
- [ ] Prueba 8: Mezcla comandos y mensajes ✅

---

## 🎉 **¡Sistema Verificado!**

Si todas las pruebas pasan, tu sistema de cola está funcionando perfectamente.

**Beneficios confirmados:**
- ✅ No pierde mensajes
- ✅ Respuestas contextuales
- ✅ Ahorra API
- ✅ Previene spam

**¡Disfruta tu bot mejorado!** 🚀
