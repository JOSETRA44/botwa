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

## 🔄 Actualización: el sistema de detección funcionó (2026-07-03)

Menos de un día después de implementar el listener de `messages.update`, capturó un fallo real:
```
[14:35:20] ✅ [CONTACTO] Respuesta enviada (1/100 esta hora)
[14:35:20] ❌ Entrega fallida (msg 4A0F304B → 264218452435140@lid): status ERROR
```
junto con este log crudo de Baileys/libsignal en la consola:
```
Closing open session in favor of incoming prekey bundle
Closing session: SessionEntry { ... }
```

**Causa raíz identificada:** `Closing open session in favor of incoming prekey bundle` es un mensaje conocido de libsignal (la librería de cifrado E2E que usa Baileys) — indica que el estado de sesión Signal guardado localmente para ese contacto ya no coincide con lo que espera el dispositivo remoto, forzando una renegociación. Es exactamente el mismo contacto (`264218452435140@lid`) del reporte original de este documento — y coincide con que, en una sesión anterior, se ejecutó `node bot.js` por error mientras el bot real ya estaba conectado. Dos procesos escribiendo al mismo tiempo sobre el mismo estado de sesión Signal es una causa conocida de este tipo de desincronización del ratchet criptográfico.

**Qué se hizo:** se respaldaron y eliminaron los 3 archivos de sesión de ese contacto (`auth/session-264218452435140_*.json`) — no toda la carpeta `auth/` (eso hubiera forzado un nuevo escaneo de QR para toda la cuenta). Signal Protocol está diseñado para regenerar sesiones automáticamente desde un prekey bundle fresco la próxima vez que haya intercambio de mensajes con ese contacto — es la misma recuperación automática que ya se veía en el log, solo que no estaba llegando a buen puerto. El otro contacto (`137284787687557@lid`) mencionado en el reporte original no mostró evidencia de estar fallando actualmente, así que no se tocó — si vuelve a fallar, aplica el mismo arreglo.

## 🔄 Actualización 2: el arreglo puntual no bastó — causa sistémica, no aislada (2026-07-03, mismo día)

Horas después, el mismo contacto (`264218452435140@lid`) siguió fallando con `status ERROR` **después** de que su sesión ya se había regenerado limpiamente. Y peor: el segundo contacto (`137284787687557@lid`), que nunca se tocó, **también empezó a fallar** con el mismo síntoma:
```
[16:04:36] ❌ Entrega fallida (msg 3E959DDB → 264218452435140@lid): status ERROR
[16:04:37] ❌ Entrega fallida (msg FF3A4648 → 264218452435140@lid): status ERROR
[16:05:24] ❌ Entrega fallida (msg 6EF3E358 → 137284787687557@lid): status ERROR
```

Dos contactos `@lid` distintos con el mismo síntoma descarta la hipótesis de corrupción aislada por un proceso duplicado (esa explicación no puede repetirse en un contacto que nunca se tocó). Apunta a algo estructural en cómo esta versión de Baileys maneja el envío a contactos `@lid` específicamente.

**Causa raíz real:** `@whiskeysockets/baileys` estaba en `7.0.0-rc.8`, una versión candidata (no estable) de noviembre 2025. El changelog de versiones posteriores (`rc10`, mayo 2026) lista explícitamente: *"LID<->PN Mappings from contactAction, historySync, and more"*, *"Encryption failures handling"*, y *"improved signal reliability"* — exactamente la clase de bug que se estaba viendo. Entre `rc.8` y `rc13` (la más reciente disponible) hubo una brecha de 6 meses sin releases y luego 4 release candidatos en 2 semanas, señal de trabajo activo de corrección de bugs justo en esta área.

**Qué se hizo:** se actualizó `@whiskeysockets/baileys` de `^7.0.0-rc.8` a `^7.0.0-rc13` (`npm install`). Se verificó que la sesión de auth existente (`auth/creds.json`) sigue siendo válida con la versión nueva — se conectó una vez brevemente (sin enviar ningún mensaje real a ningún contacto) y reconectó sin pedir un nuevo escaneo de QR. `node --check` en todos los archivos y `npm test` (22/22) siguen en verde tras el upgrade.

**No confirmado todavía:** si esto resuelve el problema de raíz solo se sabrá cuando el bot vuelva a atender tráfico real de esos dos contactos — vigilar el panel en busca de `❌ Entrega fallida` para `264218452435140@lid` y `137284787687557@lid` en los próximos días.

## 🔗 Relacionado
- [[Index]]
- [[Diagnostico de Codigo de Emparejamiento]]
- [[Reestructuracion Etapa 1 - Modulo Compartido y Pruebas]]
