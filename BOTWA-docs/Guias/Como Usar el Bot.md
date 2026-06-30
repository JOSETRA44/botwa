---
tags:
  - botwa
  - guia
---

# 🤖 Cómo Usar el Bot de WhatsApp

## 🎯 Sistema Híbrido Implementado

El bot funciona de manera diferente según dónde lo uses:

---

## 📱 **EN CHATS PRIVADOS (1 a 1)**

El bot responde **automáticamente** a todos tus mensajes usando IA.

### Ejemplos:
```
Tú: Hola, ¿cómo estás?
Bot: ¡Hola! 😊 Estoy muy bien, gracias por preguntar...

Tú: ¿Qué es la fotosíntesis?
Bot: La fotosíntesis es el proceso por el cual...

Tú: Cuéntame un chiste
Bot: ¿Por qué los pájaros no usan Facebook? 🐦...
```

**✅ Ventajas:**
- Conversación natural
- No necesitas comandos
- Responde a todo automáticamente

---

## 👥 **EN GRUPOS**

El bot **NO responde automáticamente**. Debes mencionarlo para que use IA.

### Para usar IA en grupos:
Menciona al bot con cualquiera de estas formas:
- `@bot [tu mensaje]`
- `bot: [tu mensaje]`
- `bot, [tu mensaje]`
- `bot [tu mensaje]`

### Ejemplos:
```
Tú: @bot ¿Cuál es la capital de Francia?
Bot: La capital de Francia es París 🇫🇷

Tú: bot: explícame la teoría de la relatividad
Bot: La teoría de la relatividad de Einstein...

Tú: Hola a todos
Bot: (No responde - no fue mencionado)
```

**✅ Ventajas:**
- No molesta en conversaciones grupales
- Solo responde cuando lo necesitas
- Ahorra uso de API

---

## ⚡ **COMANDOS (Funcionan en Grupos y Chats Privados)**

Los comandos siempre usan `/` y funcionan en cualquier lugar.

### 🤖 Comandos con IA:

#### `/pregunta [texto]`
Pregunta algo a la IA (útil en grupos sin mencionar @bot)
```
/pregunta ¿Cómo funciona el internet?
/pregunta Dame 5 ideas para un negocio
/pregunta ¿Qué es mejor, Python o JavaScript?
```

#### `/resumen [texto]`
Resume un texto largo
```
/resumen [pega aquí un artículo largo]
```

---

### 📝 Comandos Rápidos (Sin IA):

#### `/menu`
Muestra el menú principal con todos los comandos
```
/menu
```

#### `/biografia`
Información sobre el bot
```
/biografia
```

#### `/horario`
Horario de atención
```
/horario
```

#### `/contacto`
Información de contacto
```
/contacto
```

#### `/ayuda`
Lista detallada de comandos
```
/ayuda
```

---

## 📊 **RESUMEN RÁPIDO**

| Situación | Cómo Usar |
|-----------|-----------|
| **Chat privado** | Escribe normalmente |
| **Grupo (IA)** | Menciona `@bot` |
| **Comandos** | Usa `/comando` |

---

## 💡 **EJEMPLOS PRÁCTICOS**

### En un Chat Privado:
```
Tú: Buenos días
Bot: ¡Buenos días! 😊 ¿En qué puedo ayudarte hoy?

Tú: /menu
Bot: [Muestra el menú]

Tú: /biografia
Bot: 🤖 Soy un bot de WhatsApp...
```

### En un Grupo:
```
Juan: Hola a todos
Bot: (No responde)

María: @bot ¿qué hora es?
Bot: [Responde con la hora]

Pedro: /menu
Bot: [Muestra el menú]

Ana: Alguien sabe de matemáticas?
Bot: (No responde)

Tú: bot: explica el teorema de Pitágoras
Bot: El teorema de Pitágoras establece que...
```

---

## 🔧 **CONFIGURACIÓN**

### Cambiar Comportamiento:
Edita `config.json` para personalizar:
- `promptGlobal`: Personalidad del bot
- `delayMin/Max`: Tiempo de respuesta
- `gruposPermitidos`: Grupos donde funciona
- `comandosSimples`: Comandos personalizados

### Panel Web:
Accede al panel web para configurar:
```bash
iniciar-panel.bat
```
Luego abre: http://localhost:3000

---

## ❓ **PREGUNTAS FRECUENTES**

### ¿Por qué el bot no responde en grupos?
Debes mencionarlo con `@bot` o usar comandos con `/`

### ¿Puedo agregar más comandos?
Sí, edita `config.json` o usa el panel web

### ¿Cómo desactivo el bot temporalmente?
Usa el panel web para pausar/reanudar

### ¿El bot consume mucha API?
No, solo responde cuando:
- En chats privados: Siempre
- En grupos: Solo si lo mencionas
- Comandos: Solo `/pregunta` y `/resumen` usan IA

---

## 🎉 **¡Disfruta tu Bot!**

Ahora tienes un bot inteligente que:
- ✅ No molesta en grupos
- ✅ Responde cuando lo necesitas
- ✅ Tiene comandos útiles
- ✅ Usa IA eficientemente

**¿Dudas?** Usa `/ayuda` o `/menu` 🚀

## 🔗 Relacionado
- [[Index]]
- [[Instalacion]]
- [[Guia Rapida]]
