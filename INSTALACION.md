# 🚀 Guía de Instalación Rápida

## Paso 1: Instalar dependencias

```bash
npm install
```

## Paso 2: Iniciar el panel web

Abre una terminal y ejecuta:

```bash
node server.js
```

Verás el mensaje: `🌐 Panel web disponible en http://localhost:3000`

## Paso 3: Configurar desde el navegador

1. Abre tu navegador en: `http://localhost:3000`
2. Configura:
   - **API Key de Gemini**: Obtén una gratis en https://makersuite.google.com/app/apikey
   - **Grupos Permitidos**: Déjalo vacío por ahora (lo configurarás después)
   - **Comandos**: Deja los que vienen por defecto
3. Haz clic en "Guardar Cambios"

## Paso 4: Iniciar el bot

Abre OTRA terminal (deja la del panel abierta) y ejecuta:

```bash
node bot.js
```

## Paso 5: Vincular WhatsApp

1. Aparecerá un código QR en la terminal
2. Abre WhatsApp en tu teléfono
3. Ve a: **Configuración** → **Dispositivos vinculados** → **Vincular un dispositivo**
4. Escanea el código QR
5. ¡Listo! El bot está conectado

## Paso 6: Obtener ID de grupos

Para que el bot funcione en grupos, necesitas sus IDs:

1. Envía un mensaje en cualquier grupo donde esté el bot
2. Revisa la terminal donde corre `bot.js`
3. Verás algo como: `⚠️ Mensaje ignorado de grupo no permitido: 120363123456789012@g.us`
4. Copia ese ID completo (incluyendo `@g.us`)
5. Ve al panel web (`http://localhost:3000`)
6. Pega el ID en "Grupos Permitidos" (uno por línea)
7. Guarda cambios
8. Reinicia el bot (Ctrl+C y luego `node bot.js` de nuevo)

## ✅ Verificar que funciona

1. Envía un mensaje en un grupo permitido
2. El bot debería responder usando Gemini
3. Prueba comandos: `/ayuda`, `/resumen texto a resumir`

## 🔄 Comandos útiles

### Reiniciar el bot
```bash
# En la terminal del bot, presiona Ctrl+C
# Luego ejecuta de nuevo:
node bot.js
```

### Ver logs del bot
Los mensajes y errores aparecen en la terminal donde corre `node bot.js`

### Detener todo
- Terminal del panel: Ctrl+C
- Terminal del bot: Ctrl+C

## ⚠️ Problemas comunes

### "Cannot find module '@whiskeysockets/baileys'"
Ejecuta: `npm install`

### El bot no responde en grupos
- Verifica que el ID del grupo esté en "Grupos Permitidos"
- Reinicia el bot después de agregar grupos

### Error de API Key
- Verifica que la API Key de Gemini sea correcta
- Obtén una nueva en: https://makersuite.google.com/app/apikey

### No aparece el código QR
- Asegúrate de tener Node.js 18 o superior: `node --version`
- Si ya vinculaste antes, borra la carpeta `auth_info_baileys` y vuelve a intentar
