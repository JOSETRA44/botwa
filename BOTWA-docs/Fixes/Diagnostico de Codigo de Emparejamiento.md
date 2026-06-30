---
tags:
  - botwa
  - fix
---

# 🔍 Diagnóstico: Problema con Código de Emparejamiento

## ❌ Problemas Encontrados

### 1. **Múltiples Listeners de Conexión**
El código tenía DOS listeners de `connection.update`, causando conflictos.

### 2. **Regeneración de Código Problemática**
El intervalo que regeneraba el código cada 50 segundos causaba:
- Múltiples requests al servidor de WhatsApp
- Cierre de conexión ("Connection Closed")
- Conflictos en el socket

### 3. **Manejo Incorrecto de Errores**
No distinguía entre diferentes tipos de desconexión.

## ✅ Correcciones Aplicadas

### 1. **Un Solo Listener**
Ahora hay un único listener de `connection.update` que maneja todos los casos.

### 2. **Sin Regeneración Automática**
El código se genera UNA sola vez. Tienes 60 segundos para ingresarlo.

### 3. **Mejor Manejo de Errores**
Distingue entre:
- `loggedOut` - Sesión cerrada
- `connectionClosed` - Normal durante autenticación
- Otros - Reconexión automática

## 🎯 Cómo Funciona Ahora

### Flujo Correcto:

```
1. Ejecutas: iniciar-codigo-normal.bat
2. Ingresas tu número: 51987654321
3. Se genera el código: XXXX-XXXX
4. Tienes 60 segundos para ingresarlo
5. Ingresas el código en WhatsApp
6. Conexión se cierra (normal)
7. Bot reconecta automáticamente
8. ✅ Conectado exitosamente
```

## 🐛 Posibles Problemas y Soluciones

### Problema 1: "Connection Closed"

**Causa:** Esto es NORMAL durante la autenticación con código.

**Solución:** No hagas nada, el bot reconecta automáticamente.

### Problema 2: Código No Funciona

**Causas posibles:**
1. **Número incorrecto**
   - ❌ Malo: +51 987 654 321
   - ❌ Malo: 987654321
   - ✅ Bueno: 51987654321

2. **Código expirado**
   - Tienes 60 segundos
   - Si expira, reinicia el bot

3. **Tipo de WhatsApp incorrecto**
   - Si usas WhatsApp Normal, usa: `iniciar-codigo-normal.bat`
   - Si usas WhatsApp Business, usa: `iniciar-codigo-business.bat`

4. **WhatsApp bloqueó tu número**
   - Espera 10-15 minutos
   - Intenta con QR: `iniciar-qr-normal.bat`

### Problema 3: "Error al solicitar código"

**Soluciones:**
1. Verifica tu conexión a internet
2. Desactiva VPN si tienes
3. Desactiva firewall temporalmente
4. Verifica el formato del número
5. Intenta con el método QR

## 🧪 Prueba Paso a Paso

### 1. Limpiar Sesión
```bash
limpiar-auth.bat
```

### 2. Iniciar Bot
```bash
iniciar-codigo-normal.bat
```

### 3. Ingresar Número
```
Número: 51987654321
```
(Reemplaza con tu número real)

### 4. Copiar Código
```
🔑 TU CÓDIGO: XXXX-XXXX
```

### 5. Ingresar en WhatsApp
1. Abre WhatsApp
2. Configuración → Dispositivos vinculados
3. Vincular un dispositivo
4. Vincular con número de teléfono
5. Ingresa: XXXXXXXX (sin guión)

### 6. Esperar
```
⚠️  Conexión cerrada. Esto es normal...
Esperando que ingreses el código...

♻️  Reconectando...

✅ ¡Bot conectado exitosamente!
```

## 📋 Checklist de Verificación

Antes de reportar un error, verifica:

- [ ] Número en formato correcto (CÓDIGO_PAÍS + NÚMERO)
- [ ] Sin espacios, sin +, sin guiones
- [ ] Tipo de WhatsApp correcto (Normal vs Business)
- [ ] Conexión a internet estable
- [ ] Firewall no bloqueando
- [ ] Código ingresado en menos de 60 segundos
- [ ] Archivos auth/loginQR.js y auth/loginPhone.js existen

## 🎯 Alternativa: Método QR

Si el código sigue sin funcionar, usa QR:

```bash
limpiar-auth.bat
iniciar-qr-normal.bat
```

El QR es más confiable y no tiene problemas de formato de número.

## 📊 Logs Útiles

Si ves estos mensajes, todo está bien:

```
✅ "Conexión cerrada. Esto es normal..."
✅ "Reconectando..."
✅ "Bot conectado exitosamente"
```

Si ves estos, hay problema:

```
❌ "Error al solicitar código"
❌ "Número incorrecto"
❌ "Firewall bloqueando"
```

## 🔧 Última Solución

Si nada funciona:

1. Desinstala y reinstala WhatsApp en tu teléfono
2. Usa el método QR en lugar de código
3. Verifica que tu número no esté bloqueado por WhatsApp
4. Intenta desde otra red (datos móviles en lugar de WiFi)

## 🔗 Relacionado
- [[Index]]
- [[Instalacion]]
