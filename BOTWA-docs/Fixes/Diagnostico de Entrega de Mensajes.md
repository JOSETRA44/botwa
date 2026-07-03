---
tags:
  - botwa
  - fix
aliases:
  - messages.update
  - Entrega de mensajes
---

# 🔍 Diagnóstico: "Respuesta enviada" pero el cliente no recibe nada

## 🐛 Síntoma

El log del panel mostraba el flujo completo terminando en éxito:
```
[13:23:02] 📩 [CONTACTO] Mensaje: Hola
[13:23:02] 📝 [CONTACTO] Mensaje agregado a cola (1 en buffer)
[13:23:05] 🔄 [CONTACTO] Procesando 1 mensaje(s) agrupado(s)
[13:23:11] ✅ [CONTACTO] Respuesta enviada (1/100 esta hora)
```
pero el cliente en WhatsApp no recibía nada.

## 🔬 Investigación

Se investigó con dos agentes en paralelo: uno rastreó el código completo desde la recepción del mensaje hasta el envío, y otro mapeó la arquitectura general del proyecto. Hallazgos clave:

1. **No hay ningún bug que trague errores silenciosamente.** El log `✅ Respuesta enviada` está dentro del mismo `try` que el `sock.sendMessage()` — si esa promesa rechaza, no se ejecuta esa línea. El log es honesto, pero **incompleto**.
2. **`sock.sendMessage()` resuelto ≠ mensaje recibido por el cliente.** Solo confirma que WhatsApp aceptó el mensaje cifrado, nunca que el destinatario lo recibió o vio — y el bot no tenía forma de distinguir ambas cosas (cero manejo de `messages.update`, el evento de recibos de entrega de Baileys).
3. **JIDs `@lid` no son la causa probable.** Dos de los contactos con el problema tienen JIDs `@lid` (identificadores de privacidad de WhatsApp), pero Baileys 7.0.0-rc.8 ya maneja esto internamente (cambia a identidad `meLid`, tiene su propio `LIDMappingStore`) y existen mapeos válidos para esos contactos en `auth/`. No hay evidencia de que el bot necesite traducir el JID manualmente.
4. **Evidencia real encontrada: 3 cierres de sesión forzados** (`❌ Sesión cerrada`, `DisconnectReason.loggedOut` genuino, no una reconexión normal) en ~5 minutos, uno de ellos justo procesando un mensaje a uno de los contactos afectados, seguido de tener que volver a escanear el QR. Esto es señal fuerte de que WhatsApp está cerrando la sesión del dispositivo vinculado (posible marcado como spam de un cliente no oficial/Baileys) o de inestabilidad real de conexión — el bot corre en una laptop sin supervisor de proceso.

**Ninguna de las dos causas más probables (marcado de spam por WhatsApp, o inestabilidad de conexión) se puede arreglar en código.** Lo que sí se podía arreglar: la ceguera total ante estos eventos.

## ✅ Qué se implementó (visibilidad, no una "corrección")

1. **Listener de `messages.update`** (`bot.js`): registra en el panel cuando un mensaje propio falla (`status: ERROR`), se entrega (`DELIVERY_ACK`) o se lee (`READ`) — la primera vez que esta información existe en el proyecto.
2. **Callback `onReconnecting`** en `auth/loginQR.js`/`auth/loginPhone.js`: las reconexiones normales (antes invisibles, solo `console.log`) ahora aparecen en el panel como `♻️ Reconectando...`.
3. **Logger persistente** (`logger.js`, usa `pino`, ya era una dependencia): los errores que antes solo iban a `console.error` y se perdían (el bot corre vía `start /B` sin redirección de salida) ahora también se escriben a `app.log`.
4. **Tripwire de JID** (`bot.js`): compara el JID entrante contra `jidNormalizedUser` y solo *loguea* si difieren — el envío sigue yendo al JID original exactamente igual que antes. No es una corrección, es una alarma barata por si el problema fuera esto después de todo.

## 💡 Qué hacer si vuelve a pasar

Con estos cambios, la próxima vez que un cliente diga "no me llegó nada": revisar el panel en busca de `❌ Entrega fallida` (evidencia dura de fallo real de entrega), `♻️ Reconectando...` cerca de la hora del mensaje (evidencia de inestabilidad de conexión), o `⚠️ JID no normalizado` (reabriría la hipótesis de un problema de JID). Antes de este cambio, ninguna de las tres señales existía.

Si los cierres de sesión forzados siguen ocurriendo seguido, es una señal de que WhatsApp podría estar limitando este número por comportamiento automatizado — algo a vigilar, no un bug de código.

## 🔗 Relacionado
- [[Index]]
- [[Diagnostico de Codigo de Emparejamiento]]
- [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]
