---
tags:
  - botwa
  - guia
---

# 🚀 Guía: Bot 24/7 en tu Laptop

## 📋 Pasos para Configurar

### 1. **Evitar Suspensión** (IMPORTANTE)

Ejecuta como **Administrador**:
```
mantener-activo.bat
```

Esto configura:
- ✅ Laptop NUNCA se suspende
- ✅ Pantalla se apaga en 30 min (ahorra energía)
- ✅ Bot sigue corriendo aunque cierres la tapa (en algunos modelos)

### 2. **Iniciar Bot en Segundo Plano**

Ejecuta:
```
bot-segundo-plano.bat
```

El bot correrá en segundo plano. Puedes:
- ✅ Minimizar la ventana
- ✅ Usar otras aplicaciones
- ✅ Cerrar la ventana (el bot sigue corriendo)

### 3. **Verificar que Está Corriendo**

Abre **Administrador de Tareas** (Ctrl+Shift+Esc):
- Busca "Node.js JavaScript Runtime"
- Si aparece = Bot está corriendo ✅

### 4. **Detener el Bot**

Cuando quieras detenerlo:
```
detener-bot.bat
```

### 5. **Restaurar Configuración Normal**

Cuando ya no necesites el bot 24/7:
```
restaurar-suspension.bat
```

---

## ⚡ Configuración Manual (Alternativa)

Si prefieres configurar manualmente:

### Windows 10/11:
1. **Panel de Control** → **Opciones de energía**
2. **Cambiar la configuración del plan**
3. Configurar:
   - Apagar pantalla: 30 minutos
   - Suspender el equipo: **Nunca**
4. **Guardar cambios**

---

## 💡 Consejos Importantes

### ✅ Recomendaciones:
1. **Mantén la laptop conectada** - No uses batería 24/7
2. **Buena ventilación** - No la pongas sobre cama/sofá
3. **Limpia ventiladores** - Evita sobrecalentamiento
4. **Cierra programas pesados** - Deja solo el bot corriendo

### ⚠️ Advertencias:
- La laptop estará encendida 24/7
- Consumirá electricidad constantemente
- Puede calentarse más de lo normal
- La batería puede degradarse si no está conectada

---

## 🔧 Solución de Problemas

### El bot se detiene cuando cierro la tapa:
**Solución**: Configurar "Al cerrar la tapa"
1. Panel de Control → Opciones de energía
2. Elegir comportamiento al cerrar la tapa
3. Cambiar a: **No hacer nada**

### El bot se detiene en suspensión:
**Solución**: Ejecuta `mantener-activo.bat` como **Administrador**

### La laptop se calienta mucho:
**Solución**:
- Usa un soporte con ventilación
- Limpia los ventiladores
- Reduce la carga (cierra otros programas)

### Quiero ver los logs del bot:
**Solución**: En lugar de `bot-segundo-plano.bat`, usa:
```
iniciar-todo.bat
```
Verás los logs en tiempo real.

---

## 📊 Comparación de Métodos

| Método | Ventana Visible | Logs Visibles | Fácil de Detener |
|--------|----------------|---------------|------------------|
| `iniciar-todo.bat` | ✅ Sí | ✅ Sí | ✅ Ctrl+C |
| `bot-segundo-plano.bat` | ❌ No | ❌ No | ⚠️ Usar detener-bot.bat |

---

## 🎯 Flujo Recomendado

### Para Desarrollo/Pruebas:
```bash
1. iniciar-todo.bat
2. Ver logs en tiempo real
3. Ctrl+C para detener
```

### Para Producción 24/7:
```bash
1. mantener-activo.bat (como Admin)
2. bot-segundo-plano.bat
3. Minimizar/cerrar ventana
4. Dejar corriendo
```

### Para Detener:
```bash
1. detener-bot.bat
2. restaurar-suspension.bat (opcional)
```

---

## 🚀 Próximo Paso: Servidor en la Nube

Cuando estés listo para un bot REAL 24/7 sin depender de tu laptop:

### Railway (Recomendado):
- ✅ Gratis para empezar
- ✅ 500 horas/mes gratis
- ✅ Fácil de configurar
- ✅ Se reinicia automáticamente
- ✅ No consume tu electricidad

### Otros:
- Render (gratis)
- DigitalOcean ($4/mes)
- AWS EC2 (gratis 12 meses)

**Avísame cuando quieras configurarlo** y te ayudo paso a paso.

---

## 📝 Resumen Rápido

```bash
# 1. Evitar suspensión (como Admin)
mantener-activo.bat

# 2. Iniciar bot
bot-segundo-plano.bat

# 3. Verificar en Administrador de Tareas
# Buscar: "Node.js JavaScript Runtime"

# 4. Detener cuando quieras
detener-bot.bat

# 5. Restaurar configuración
restaurar-suspension.bat
```

---

**Estado**: ✅ Configurado para 24/7 en laptop
**Próximo paso**: Migrar a servidor en la nube (cuando quieras)

## 🔗 Relacionado
- [[Index]]
- [[Guia Rapida]]
