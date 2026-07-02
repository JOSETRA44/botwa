# 🤖 WhatsApp Bot con Gemini AI

Bot de WhatsApp que usa Google Gemini para responder mensajes automáticamente.

## 📚 Base de Conocimiento (RAG) para negocios

El bot incluye un sistema RAG: carga la información de tu negocio (productos, precios, horarios, fotos de catálogo) desde el panel web y el bot responderá a los clientes con esos datos reales — enviando las fotos del catálogo cuando la consulta coincida. Comando en WhatsApp: `/catalogo [búsqueda]`. Los datos viven en `knowledge/` (local, nunca se sube a git).

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

## 🔑 Configuración de API Keys

Copia `.env.example` a `.env` y completa tus propias claves:

```bash
cp .env.example .env
```

Variables disponibles: `GEMINI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `UNSPLASH_SECRET_KEY`, `GOOGLE_SEARCH_API_KEY`, `GEMINI_VISION_API_KEY`, `GROK_API_KEY`, `OPENAI_API_KEY`, `GEMINI_PAPEAR_API_KEY`.

`.env` está en `.gitignore` y nunca debe subirse al repositorio. `config.json` solo contiene configuración no sensible (prompt, grupos, comandos, modelos).

## ⚙️ Configuración

Desde el panel web (http://localhost:3000):
- API Key de Gemini y de Grok (se guardan en `.env`, no en `config.json`)
- Grupos permitidos
- Comandos personalizados
- Prompt global

## 📖 Documentación completa

Ver la bóveda de Obsidian en [`BOTWA-docs/`](./BOTWA-docs/Index.md) para guías de uso, detalle de cada comando, sistema interno e historial de cambios.

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
