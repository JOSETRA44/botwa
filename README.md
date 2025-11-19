# 🤖 WhatsApp Bot + Panel de Control

Bot de WhatsApp con panel web simple para gestionar configuración mediante JSON.

## 📋 Características

- ✅ Bot de WhatsApp usando Baileys (versión estable)
- ✅ Panel web con Bootstrap 5
- ✅ Configuración mediante `config.json`
- ✅ Integración con Google Gemini AI
- ✅ Sistema de comandos personalizables
- ✅ Control de grupos permitidos
- ✅ Anti-spam integrado
- ✅ Reconexión automática

## 🚀 Instalación

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar el bot

Edita el archivo `config.json` o usa el panel web (recomendado).

## 📱 Uso

### Iniciar el panel web

```bash
node server.js
```

Luego abre tu navegador en: `http://localhost:3000`

### Iniciar el bot de WhatsApp

```bash
node bot.js
```

La primera vez mostrará un código QR. Escanéalo con WhatsApp:
1. Abre WhatsApp en tu teléfono
2. Ve a Configuración > Dispositivos vinculados
3. Toca "Vincular un dispositivo"
4. Escanea el código QR que aparece en la terminal

## ⚙️ Configuración

### Desde el panel web (Recomendado)

1. Inicia el servidor: `node server.js`
2. Abre `http://localhost:3000` en tu navegador
3. Edita la configuración:
   - **Prompt Global**: Personalidad del bot con Gemini
   - **API Key Gemini**: Tu clave de API ([Obtener aquí](https://makersuite.google.com/app/apikey))
   - **Grupos Permitidos**: IDs de grupos donde el bot responderá
   - **Comandos**: Comandos personalizados (formato: `/comando=descripción`)
4. Guarda los cambios
5. Reinicia el bot para aplicar cambios

### Desde config.json (Manual)

Edita directamente el archivo `config.json`:

```json
{
  "promptGlobal": "Eres un asistente útil y educado.",
  "apiKeyGemini": "TU_API_KEY_AQUI",
  "gruposPermitidos": [
    "120363123456789012@g.us",
    "120363987654321098@g.us"
  ],
  "comandos": {
    "/ayuda": "Muestra información del bot.",
    "/resumen": "Resume el texto enviado por el usuario."
  }
}
```

## 🔍 Cómo obtener el ID de un grupo

### Método 1: Desde el código
Agrega este código temporal en `bot.js` dentro del evento `messages.upsert`:

```javascript
console.log('ID del chat:', remoteJid);
```

### Método 2: Usando el bot
1. Comenta temporalmente la validación de grupos en `bot.js`
2. Envía un mensaje al grupo
3. Revisa la consola para ver el ID
4. Copia el ID (formato: `120363XXXXXXXXXX@g.us`)
5. Agrégalo en el panel web o `config.json`

## 📝 Comandos disponibles

Los comandos se configuran en el panel web. Por defecto:

- `/ayuda` - Muestra la lista de comandos disponibles
- `/resumen` - Resume el texto que envíes después del comando

### Agregar nuevos comandos

En el panel web, en la sección "Comandos Personalizados", agrega líneas con el formato:

```
/micomando=Descripción de lo que hace
/clima=Muestra el clima actual
/info=Información del bot
```

## 🛡️ Seguridad

- **Anti-spam**: El bot ignora usuarios que envían más de 10 mensajes por segundo
- **Grupos permitidos**: Solo responde en grupos configurados
- **Validación JSON**: Valida datos antes de guardar
- **Manejo de errores**: No se rompe si hay errores en la configuración

## 🔄 Reiniciar el bot después de cambios

Después de modificar la configuración en el panel web:

1. Detén el bot (Ctrl+C en la terminal donde corre `bot.js`)
2. Vuelve a iniciarlo: `node bot.js`

Los cambios se aplicarán automáticamente.

## 📂 Estructura del proyecto

```
whatsapp-bot/
│
├── bot.js              # Bot de WhatsApp (Baileys)
├── server.js           # Servidor Express del panel
├── config.json         # Configuración del bot
├── package.json        # Dependencias
├── README.md           # Este archivo
│
├── public/
│   ├── index.html      # Panel web
│   └── style.css       # Estilos del panel
│
└── auth_info_baileys/  # Sesión de WhatsApp (se crea automáticamente)
```

## ⚠️ Notas importantes

1. **No borres la carpeta `auth_info_baileys`**: Contiene tu sesión de WhatsApp
2. **Protege tu API Key**: No la compartas ni la subas a repositorios públicos
3. **El panel no reinicia el bot**: Debes reiniciarlo manualmente después de cambios
4. **Grupos permitidos**: El bot solo funciona en grupos configurados (por seguridad)
5. **Node.js 18+**: Asegúrate de tener Node.js versión 18 o superior

## 🐛 Solución de problemas

### El bot no responde en grupos
- Verifica que el ID del grupo esté en `gruposPermitidos`
- El formato debe ser: `120363XXXXXXXXXX@g.us`

### Error de API Key de Gemini
- Verifica que la API Key sea válida
- Obtén una nueva en: https://makersuite.google.com/app/apikey

### El bot se desconecta constantemente
- Verifica tu conexión a internet
- El bot se reconecta automáticamente

### No aparece el código QR
- Asegúrate de tener Node.js 18+
- Borra la carpeta `auth_info_baileys` y vuelve a iniciar

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs en la consola
2. Verifica que `config.json` tenga formato válido
3. Asegúrate de tener todas las dependencias instaladas

## 📄 Licencia

MIT
