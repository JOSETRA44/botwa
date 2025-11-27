# 🤖 WhatsApp Bot con Gemini AI

Bot de WhatsApp que usa Google Gemini para responder mensajes automáticamente.

## 🚀 Instalación

```bash
npm install
```

## 📱 Comandos Principales

### 1️⃣ Limpiar Sesión (Cambiar de Cuenta)
```bash
limpiar-auth.bat
```

### 2️⃣ Iniciar con QR - WhatsApp Normal
```bash
iniciar-qr-normal.bat
```

### 3️⃣ Iniciar con QR - WhatsApp Business
```bash
iniciar-qr-business.bat
```

### 4️⃣ Iniciar con Código - WhatsApp Normal
```bash
iniciar-codigo-normal.bat
```

### 5️⃣ Iniciar con Código - WhatsApp Business
```bash
iniciar-codigo-business.bat
```

### 6️⃣ Iniciar Panel Web
```bash
iniciar-panel.bat
```
Abre: http://localhost:3000

### 7️⃣ Iniciar Todo (Bot + Panel)
```bash
iniciar-todo.bat
```

## ⚙️ Configuración

Desde el panel web (http://localhost:3000):
- API Key de Gemini (https://makersuite.google.com/app/apikey)
- Grupos permitidos
- Comandos personalizados
- Prompt global

## 📝 Comandos del Bot

- `/ayuda` - Lista de comandos
- `/resumen [texto]` - Resume texto

## 🔄 Flujo de Uso

```bash
# 1. Instalar
npm install

# 2. Iniciar bot (elige uno)
iniciar-qr-normal.bat          # Más común
iniciar-codigo-normal.bat      # Alternativa

# 3. Autenticar en WhatsApp

# 4. Configurar desde panel web
iniciar-panel.bat
```

## 📄 Licencia

MIT
