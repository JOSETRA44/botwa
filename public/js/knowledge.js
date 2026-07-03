// Base de Conocimiento (RAG): alta, listado, borrado, búsqueda de prueba
// y reindexado de embeddings.

import { api } from './api.js';
import { qs, escapeHtml, fileToBase64 } from './dom.js';
import { showAlert } from './alerts.js';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function renderEntry(entry) {
  const thumb = entry.imageFile
    ? `<img class="kb-entry-thumb" src="/knowledge/image/${encodeURIComponent(entry.imageFile)}" alt="">`
    : `<div class="kb-entry-thumb-placeholder">📄</div>`;

  const tags = (entry.tags || [])
    .map((tag) => `<span class="kb-tag">${escapeHtml(tag)}</span>`)
    .join('');

  return `
    <div class="kb-entry">
      ${thumb}
      <div class="kb-entry-body">
        <div class="kb-entry-title">${escapeHtml(entry.title)} ${entry.hasEmbedding ? '' : '⚠️'}</div>
        <div class="kb-entry-text">${escapeHtml(entry.text)}</div>
        <div>${tags}</div>
      </div>
      <div class="kb-entry-actions">
        <button class="btn btn-danger btn-sm" data-delete-id="${entry.id}">🗑️</button>
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
      list.innerHTML = '<div class="kb-empty">📭 Aún no hay información cargada. Agrega la primera entrada con el formulario de arriba.</div>';
      return;
    }

    list.innerHTML = entries.map(renderEntry).join('');
    list.querySelectorAll('[data-delete-id]').forEach((btn) => {
      btn.addEventListener('click', () => deleteEntry(btn.dataset.deleteId));
    });
  } catch (error) {
    list.innerHTML = `<div class="kb-empty">❌ Error al cargar la base de conocimiento: ${escapeHtml(error.message)}</div>`;
  }
}

async function deleteEntry(id) {
  if (!confirm('¿Eliminar esta entrada y su imagen?')) return;
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

async function addEntry() {
  const title = qs('#kbTitle').value.trim();
  const text = qs('#kbText').value.trim();
  const tags = qs('#kbTags').value.trim();
  const imageInput = qs('#kbImage');
  const btn = qs('#btnKbAdd');

  if (!title || !text) {
    showAlert('⚠️ Título e información son obligatorios', 'danger');
    return;
  }

  let imageBase64 = null;
  let imageMime = null;
  const file = imageInput.files[0];
  if (file) {
    if (file.size > MAX_IMAGE_BYTES) {
      showAlert('⚠️ La imagen supera los 10 MB', 'danger');
      return;
    }
    imageBase64 = await fileToBase64(file);
    imageMime = file.type;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Guardando...';
  try {
    const result = await api.addKnowledge({ title, text, tags, imageBase64, imageMime });
    if (result.success) {
      showAlert('✅ Entrada agregada a la base de conocimiento', 'success');
      qs('#kbTitle').value = '';
      qs('#kbText').value = '';
      qs('#kbTags').value = '';
      imageInput.value = '';
      refreshList();
    } else {
      showAlert(`❌ ${result.error || 'Error al guardar'}`, 'danger');
    }
  } catch (error) {
    showAlert(`❌ ${error.message}`, 'danger');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '➕ Agregar a la base';
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
        — <b>${escapeHtml(r.title)}</b>${r.imageFile ? ' 🖼️' : ''}<br>
        ${escapeHtml(r.text.slice(0, 140))}${r.text.length > 140 ? '…' : ''}
      </div>
    `).join('');
  } catch (error) {
    resultsDiv.innerHTML = `<div class="kb-empty">❌ ${escapeHtml(error.message)}</div>`;
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
    btn.innerHTML = '🔄 Reindexar';
  }
}

export function initKnowledge() {
  qs('#btnKbAdd').addEventListener('click', addEntry);
  qs('#btnKbSearch').addEventListener('click', runSearch);
  qs('#btnKbReindex').addEventListener('click', runReindex);
  qs('#kbSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSearch();
  });

  refreshList();
}
