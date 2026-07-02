---
tags:
  - botwa
  - comando
  - rag
aliases:
  - "/catalogo"
---

# 📚 Comando /catalogo - Consultar el Negocio

## 🎯 ¿Qué hace?

Consulta la [[Sistema RAG - Base de Conocimiento|base de conocimiento del negocio]] directamente desde WhatsApp. Si las coincidencias tienen foto de catálogo, el bot las envía.

## 📝 Cómo usar

### Ver todo lo disponible:
```
/catalogo
```
```
Bot: 📚 BASE DE CONOCIMIENTO (5 entradas)

• 🖼️ Pizza Familiar de Pepperoni
• 🖼️ Combo Dúo
• Horario de atención
• Delivery y zonas de reparto
• Promoción de viernes

💡 Usa /catalogo [búsqueda] para consultar y recibir fotos del catálogo.
```

### Buscar algo específico:
```
/catalogo pizza familiar
```
```
Bot: 📚 Esto encontré:

*Pizza Familiar de Pepperoni*
Pizza familiar de pepperoni a S/35. Incluye borde de queso gratis los viernes.

[Envía la foto del catálogo] 📦 Pizza Familiar de Pepperoni
```

## 🤖 Sin comando también funciona

El RAG se consulta **automáticamente** en:
- Chats privados (cada mensaje)
- Grupos cuando mencionan al bot (`@bot`)
- El comando `/pregunta`

Si la consulta coincide con el catálogo (similitud ≥ 0.68) y la entrada tiene foto, el bot la envía junto con la respuesta.

## ⚙️ ¿De dónde salen los datos?

Del panel web (http://localhost:3000 → sección "📚 Base de Conocimiento"). Ver [[Sistema RAG - Base de Conocimiento]] para la guía completa de carga.

## 🔗 Relacionado
- [[Index]]
- [[Sistema RAG - Base de Conocimiento]]
- [[Comando gg (Unsplash)]]
