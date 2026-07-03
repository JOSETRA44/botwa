---
tags:
  - botwa
  - sistema
  - frontend
aliases:
  - Panel Web
  - Dashboard
---

# 🖋️ Panel Web — Arquitectura y Diseño Editorial

## 🎯 Por qué se rehizo

El panel había crecido como un único `index.html` de 1000+ líneas con CSS y JavaScript inline mezclados: código espagueti difícil de mantener y de extender (cada nueva sección — RAG, logs, config — se apilaba en el mismo `<script>`). Se reestructuró en **módulos separados** con una identidad visual propia, pensada para que un dueño de negocio no técnico la entienda de un vistazo.

## 🎨 Dirección de diseño

**"Sala de control editorial"**: papel cálido en vez del típico gradiente morado de IA, verde pino como color de marca (distinto del verde brillante de WhatsApp pero relacionado — confianza/negocio), terracota como acento de acción, y una tipografía con carácter en vez de las fuentes genéricas (Inter/Arial/system-ui):

| Rol | Fuente | Uso |
|-----|--------|-----|
| Titulares | **Fraunces** (serif variable) | `h1`, títulos de tarjeta |
| Cuerpo/UI | **Work Sans** | Texto, formularios, botones |
| Datos/código | **IBM Plex Mono** | Logs, eyebrow, badges, IDs |

Detalles distintivos: pestañas numeradas al estilo índice editorial (`01 Panel`, `02 Configuración`, `03 Conocimiento`), textura de grano sutil sobre el fondo (SVG inline, sin imágenes externas), badge de estado con punto pulsante, panel de logs estilo "recibo/terminal" en verde-negro muy oscuro.

Todos los colores, tipografías, radios y sombras están centralizados como variables CSS en `tokens.css` — para retemar el panel solo hay que tocar ese archivo.

## 🧩 Arquitectura de archivos

```
public/
├── index.html          Solo marcado semántico + 3 <section> de pestañas
├── css/
│   ├── tokens.css       Variables: color, tipografía, espaciado, sombra
│   ├── layout.css       Fondo, cabecera, navegación por pestañas, grillas
│   ├── components.css   Tarjetas, botones, badges, formularios, alertas
│   ├── logs.css         Panel de logs estilo terminal
│   └── knowledge.css    Tarjetas de la base de conocimiento (RAG)
└── js/
    ├── api.js           Único punto que conoce las rutas del backend
    ├── dom.js            qs/qsa, escapeHtml, fileToBase64
    ├── alerts.js         Sistema de notificaciones (toasts apilados)
    ├── tabs.js            Navegación entre pestañas
    ├── status.js          Estado del bot + botones de control
    ├── logs.js            Polling de logs, auto-scroll, limpiar
    ├── config.js          Formulario de configuración (carga/guardado)
    ├── knowledge.js        CRUD + búsqueda + reindexado del RAG
    └── main.js             Bootstrap: importa e inicializa cada módulo
```

Son **ES modules nativos** (`<script type="module" src="js/main.js">`) — sin bundler, sin paso de compilación. Cada módulo importa solo lo que necesita (`import { api } from './api.js'`), así que agregar una sección nueva significa crear un archivo más, no editar un script gigante.

## 🗺️ Las 3 pestañas

- **01 Panel** — Control del bot (pausar/reanudar/reset), contador de mensajes, logs en tiempo real
- **02 Configuración** — Prompt global, API keys (Gemini/Grok → se guardan en `.env`), grupos permitidos/excluidos, delays, comandos
- **03 Conocimiento** — Alta/baja de entradas en la [[Sistema RAG - Base de Conocimiento]], buscador de prueba, reindexado

## 🔌 Contrato con el backend

`api.js` es la única capa que llama a `server.js` — ningún otro módulo usa `fetch` directamente. Si cambia una ruta del backend, solo se edita `api.js`.

```js
export const api = {
  getState, control,               // /state, /control
  getLogs, clearLogs,              // /logs, /logs/clear
  getConfig, saveConfig,           // /config
  listKnowledge, addKnowledge,     // /knowledge
  deleteKnowledge, searchKnowledge,
  reindexKnowledge
};
```

Las peticiones que fallan (`response.ok === false`) lanzan con el mensaje de error del servidor, así los módulos de UI solo necesitan un `try/catch` + `showAlert(error.message)`.

## ✅ Verificado

Probado en el navegador contra datos reales de producción (entradas de la base de conocimiento ya cargadas): las 3 pestañas cargan sin errores de consola, el buscador del RAG devuelve resultados con foto e indicador de similitud (`82% — quien es body 🖼️`), y los controles de pausar/reanudar escriben correctamente en `bot-state.json`.

## 🔗 Relacionado
- [[Index]]
- [[Panel Web - Nuevo Diseño]] (diseño anterior, histórico)
- [[Sistema RAG - Base de Conocimiento]]
- [[Mejoras de UX]]
