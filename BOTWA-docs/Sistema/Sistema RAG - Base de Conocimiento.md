---
tags:
  - botwa
  - sistema
  - rag
aliases:
  - RAG
  - Base de Conocimiento
---

# 📚 Sistema RAG - Base de Conocimiento del Negocio

## 🎯 ¿Qué es?

Un sistema de **Retrieval-Augmented Generation (RAG)** que permite a un negocio cargar su propia información (productos, precios, horarios, promociones, catálogos con fotos) para que el bot responda a los clientes **con datos reales** en vez de inventar.

```
Cliente: "¿cuánto está la pizza familiar?"
   │
   ▼
1. El bot convierte la pregunta en un embedding (vector)
2. Busca las entradas más parecidas en la base de conocimiento
3. Inyecta esas entradas en el prompt de Gemini
4. Gemini responde con el dato real: "¡Hola! La pizza familiar está a S/35"
5. Si la entrada tiene imagen de catálogo, el bot la envía también
```

## 🧩 Arquitectura

| Componente | Archivo | Rol |
|------------|---------|-----|
| Módulo RAG | `rag.js` | CRUD de entradas, embeddings, búsqueda por similitud |
| Integración bot | `bot.js` | Inyecta contexto en respuestas automáticas, `/pregunta` y `/catalogo` |
| API del panel | `server.js` | Endpoints `/knowledge/*` para gestionar la base |
| UI del panel | `public/index.html` | Sección "Base de Conocimiento" con formulario y buscador |
| Datos | `knowledge/knowledge.json` | Entradas + embeddings (local, **gitignorado**) |
| Imágenes | `knowledge/images/` | Fotos de catálogo (local, **gitignorado**) |

## 🤖 Detalles técnicos

### Embeddings
- **Modelo**: `gemini-embedding-001` (misma `GEMINI_API_KEY` del `.env`, sin costo adicional de configuración)
- **Dimensión**: 768 (reducida con `outputDimensionality` para aligerar el JSON)
- **taskType**: `RETRIEVAL_DOCUMENT` para entradas, `RETRIEVAL_QUERY` para consultas

### Búsqueda
- Similitud **coseno** en memoria (sin base de datos externa)
- **Umbral mínimo: 0.65** — este modelo da similitudes con piso alto (~0.55 incluso para consultas sin relación); 0.65 separa bien lo relevante de lo irrelevante
- **Umbral para enviar imagen: 0.68** (más estricto, para no mandar fotos fuera de contexto)
- **Fallback por palabras clave** si no hay API key o el embedding falla: el bot nunca se rompe

### Inyección de contexto
El contexto se antepone al prompt con la instrucción de usar **solo** esos datos para responder sobre el negocio, y admitir honestamente cuando la información no está disponible (evita alucinaciones de precios/horarios).

## 📝 Cómo cargar información (para el negocio)

1. Inicia el panel: `iniciar-panel.bat` → http://localhost:3000
2. Baja a la sección **"📚 Base de Conocimiento del Negocio (RAG)"**
3. Agrega entradas: título + información + etiquetas + foto opcional
4. Usa el buscador de prueba para simular preguntas de clientes y ver qué recupera el bot
5. Si agregaste la API key de Gemini **después** de crear entradas, pulsa **🔄 Reindexar**

> [!tip] Consejos para buenas entradas
> - Una entrada = un tema (un producto, un horario, una promoción)
> - Incluye el precio y las variantes en el texto
> - Las fotos de catálogo se envían automáticamente cuando el cliente pregunta por ese producto

## ⚡ Comando /catalogo

| Uso | Resultado |
|-----|-----------|
| `/catalogo` | Lista todas las entradas de la base (🖼️ = tiene foto) |
| `/catalogo pizza` | Busca "pizza", responde con la información y envía las fotos que coincidan |

Además, **no hace falta el comando**: en chats privados (o mencionando al bot en grupos) el RAG se consulta automáticamente en cada respuesta.

## 🔌 API REST (panel)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/knowledge` | Listar entradas |
| POST | `/knowledge` | Crear `{title, text, tags?, imageBase64?, imageMime?}` |
| PUT | `/knowledge/:id` | Actualizar (re-embebe si cambió el texto) |
| DELETE | `/knowledge/:id` | Eliminar entrada y su imagen |
| GET | `/knowledge/image/:file` | Servir imagen de catálogo |
| POST | `/knowledge/search` | Probar búsqueda `{query}` |
| POST | `/knowledge/reindex` | Regenerar todos los embeddings |

## 🔒 Privacidad

La carpeta `knowledge/` está en `.gitignore`: la información del negocio **nunca se sube al repositorio**, igual que las API keys en `.env`.

## 🔗 Relacionado
- [[Index]]
- [[Panel Web - Nuevo Diseño]]
- [[Como Usar el Bot]]
- [[Instalacion]]
