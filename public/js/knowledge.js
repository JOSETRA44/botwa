// Base de Conocimiento (RAG): alta, listado, borrado, búsqueda de prueba
// y reindexado de embeddings. Reescrito en la Etapa 9 de la
// reestructuración para soportar múltiples archivos (imágenes y PDFs)
// por entrada, cada uno con su propia descripción.

import { api } from './api.js';
import { qs, escapeHtml, fileToBase64 } from './dom.js';
import { showAlert } from './alerts.js';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 5;

// Archivos elegidos en <input multiple> pero aún no subidos — se guardan
// aparte del input (que es de solo lectura) para poder editar la
// descripción de cada uno y quitarlos individualmente antes de guardar.
let pendingFiles = [];

const icon = (name) => `<svg class="icon"><use href="#icon-${name}"></use></svg>`;

function fileKind(mime) {
  return mime === 'application/pdf' ? 'pdf' : 'image';
}

function renderPendingFiles() {
  const container = qs('#kbFilesPending');
  container.innerHTML = pendingFiles.map((pf, i) => `
    <div class="kb-pending-item">
      ${icon(fileKind(pf.file.type) === 'pdf' ? 'file-text' : 'image')}
      <span class="kb-pending-name" title="${escapeHtml(pf.file.name)}">${escapeHtml(pf.file.name)}</span>
      <input type="text" class="form-input" placeholder="Descripción (para que el bot sepa cuándo mostrarlo)"
             data-pending-desc="${i}" value="${escapeHtml(pf.description)}">
      <button type="button" data-pending-remove="${i}" title="Quitar">${icon('x')}</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-pending-desc]').forEach((input) => {
    input.addEventListener('input', (e) => {
      pendingFiles[Number(e.target.dataset.pendingDesc)].description = e.target.value;
    });
  });
  container.querySelectorAll('[data-pending-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pendingFiles.splice(Number(btn.dataset.pendingRemove), 1);
      renderPendingFiles();
    });
  });
}

function onFilesSelected(event) {
  const files = [...event.target.files];
  const oversized = files.find((f) => f.size > MAX_FILE_BYTES);
  if (oversized) {
    showAlert(`⚠️ "${oversized.name}" supera los ${MAX_FILE_BYTES / 1024 / 1024}MB por archivo`, 'danger');
    event.target.value = '';
    return;
  }
  if (files.length > MAX_FILES) {
    showAlert(`⚠️ Máximo ${MAX_FILES} archivos por entrada`, 'danger');
    event.target.value = '';
    return;
  }
  pendingFiles = files.map((file) => ({ file, description: '' }));
  renderPendingFiles();
}

function fileChipHtml(entryId, file) {
  const label = file.description || file.filename;
  return `
    <span class="kb-file-chip" title="${escapeHtml(file.description || file.filename)}">
      ${icon(file.kind === 'pdf' ? 'file-text' : 'image')}
      <span>${escapeHtml(label)}</span>
      <button type="button" data-remove-file="${entryId}:${file.id}" title="Quitar archivo">${icon('x')}</button>
    </span>
  `;
}

function renderEntry(entry) {
  const files = entry.files || [];
  const firstImage = files.find((f) => f.kind === 'image');
  const thumb = firstImage
    ? `<img class="kb-entry-thumb" src="/knowledge/file/${entry.id}/${firstImage.id}" alt="">`
    : `<div class="kb-entry-thumb-placeholder">${icon('file-text')}</div>`;

  const tags = (entry.tags || [])
    .map((tag) => `<span class="kb-tag">${escapeHtml(tag)}</span>`)
    .join('');

  const fileChips = files.length
    ? `<div class="kb-entry-files">${files.map((f) => fileChipHtml(entry.id, f)).join('')}</div>`
    : '';

  return `
    <div class="kb-entry">
      ${thumb}
      <div class="kb-entry-body">
        <div class="kb-entry-title">${escapeHtml(entry.title)} ${entry.hasEmbedding ? '' : icon('triangle-alert')}</div>
        <div class="kb-entry-text">${escapeHtml(entry.text)}</div>
        <div>${tags}</div>
        ${fileChips}
      </div>
      <div class="kb-entry-actions">
        <button class="btn btn-danger btn-sm" data-delete-id="${entry.id}">${icon('trash-2')}</button>
      </div>
    </div>
  `;
}

async function refreshList() {
  const list = qs('#kbList');
  try {
    const data = await api.listKnowledge();
    const entries = data.entries || [];
    qs('#kbCount').textContent = entries.length;

    if (entries.length === 0) {
      list.innerHTML = `<div class="kb-empty">${icon('inbox')} Aún no hay información cargada. Agrega la primera entrada con el formulario de arriba.</div>`;
      return;
    }

    list.innerHTML = entries.map(renderEntry).join('');
    list.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.deleteId));
    });
    list.querySelectorAll('[data-remove-file]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [entryId, fileId] = btn.dataset.removeFile.split(':');
        deleteEntryFile(entryId, fileId);
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="kb-empty">${icon('circle-x')} Error al cargar la base de conocimiento: ${escapeHtml(error.message)}</div>`;
  }
}

async function deleteEntry(id) {
  if (!confirm('¿Eliminar esta entrada y todos sus archivos?')) return;
  try {
    const result = await api.deleteKnowledge(id);
    if (result.success) {
      showAlert('🗑️ Entrada eliminada', 'success');
      refreshList();
    } else {
      showAlert(`❌ ${result.error || 'Error al eliminar'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  }
}

async function deleteEntryFile(entryId, fileId) {
  if (!confirm('¿Quitar este archivo de la entrada?')) return;
  try {
    const result = await api.deleteKnowledgeFile(entryId, fileId);
    if (result.success) {
      showAlert('🗑️ Archivo eliminado', 'success');
      refreshList();
    } else {
      showAlert(`❌ ${result.error || 'Error al eliminar el archivo'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  }
}

async function addEntry() {
  const title = qs('#kbTitle').value.trim();
  const text = qs('#kbText').value.trim();
  const tags = qs('#kbTags').value.trim();
  const filesInput = qs('#kbFiles');
  const btn = qs('#btnKbAdd');

  if (!title || !text) {
    showAlert('⚠️ Título e información son obligatorios', 'danger');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Guardando...';
  try {
    const files = await Promise.all(pendingFiles.map(async (pf) => ({
      base64: await fileToBase64(pf.file),
      mime: pf.file.type,
      filename: pf.file.name,
      description: pf.description
    })));

    const result = await api.addKnowledge({ title, text, tags, files });
    if (result.success) {
      showAlert('✅ Entrada agregada a la base de conocimiento', 'success');
      qs('#kbTitle').value = '';
      qs('#kbText').value = '';
      qs('#kbTags').value = '';
      filesInput.value = '';
      pendingFiles = [];
      renderPendingFiles();
      refreshList();
    } else {
      showAlert(`❌ ${result.error || 'Error al guardar'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('plus')} Agregar a la base`;
  }
}

async function runSearch() {
  const query = qs('#kbSearchInput').value.trim();
  const resultsDiv = qs('#kbSearchResults');

  if (!query) {
    resultsDiv.innerHTML = '<div class="kb-empty">Escribe una consulta de prueba</div>';
    return;
  }

  resultsDiv.innerHTML = '<div class="kb-empty"><span class="loading" style="border-top-color: var(--ink-faint);"></span> Buscando...</div>';
  try {
    const data = await api.searchKnowledge(query);
    const results = data.results || [];

    if (results.length === 0) {
      resultsDiv.innerHTML = '<div class="kb-empty">Sin coincidencias — el bot respondería sin contexto del negocio</div>';
      return;
    }

    resultsDiv.innerHTML = results.map((r) => `
      <div class="kb-search-result">
        <span class="kb-score">${(r.score * 100).toFixed(0)}%</span>
        — <b>${escapeHtml(r.title)}</b>${(r.files || []).length ? ' ' + icon('image') : ''}${r.highConfidence ? ' <span class="choice-card-badge">Respuesta directa</span>' : ''}<br>
        ${escapeHtml(r.text.slice(0, 140))}${r.text.length > 140 ? '…' : ''}
      </div>
    `).join('');
  } catch (error) {
    resultsDiv.innerHTML = `<div class="kb-empty">${icon('circle-x')} ${escapeHtml(error.message)}</div>`;
  }
}

async function runReindex() {
  const btn = qs('#btnKbReindex');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading" style="border-top-color: var(--ink);"></span> Reindexando...';
  try {
    const result = await api.reindexKnowledge();
    if (result.success) {
      showAlert(`✅ Reindexado: ${result.ok} ok, ${result.failed} fallidas de ${result.total}`, 'success');
      refreshList();
    } else {
      showAlert(`❌ ${result.error || 'Error al reindexar'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${icon('refresh-cw')} Reindexar`;
  }
}

export function initKnowledge() {
  qs('#btnKbAdd').addEventListener('click', addEntry);
  qs('#btnKbSearch').addEventListener('click', runSearch);
  qs('#btnKbReindex').addEventListener('click', runReindex);
  qs('#kbFiles').addEventListener('change', onFilesSelected);
  qs('#kbSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  refreshList();
}
