/**
 * World Editor Modal — create and edit locations, factions, and lore.
 */

import bus from '../utils/events.js';
import {
  getWorld, updateWorld,
  createLocation, updateLocation, deleteLocation, setActiveLocation, getAllLocations,
  addFaction, updateFaction, removeFaction,
  addLoreEntry, removeLoreEntry
} from '../state/world.js';
import { safeMediaUrl } from '../utils/urls.js';

export function initWorldEditor() {
  const dialog = document.getElementById('world-dialog');
  if (!dialog) return;

  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  dialog.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      dialog.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      dialog.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      dialog.querySelector(`#${tab.dataset.panel}`)?.classList.add('active');
    });
  });

  dialog.querySelector('#world-save')?.addEventListener('click', _save);
  dialog.querySelector('#add-location-btn')?.addEventListener('click', _addLocation);
  dialog.querySelector('#add-faction-btn')?.addEventListener('click', _addFaction);

  bus.on('world:edit', () => _open());
}

function _open() {
  _populateWorldTab();
  _populateLocationsTab();
  _populateFactionsTab();

  const dialog = document.getElementById('world-dialog');
  dialog.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  dialog.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));
  dialog.showModal();
}

function _populateWorldTab() {
  const world = getWorld();
  _setVal('world-name-input', world?.name ?? '');
  _setVal('world-genre-input', world?.genre ?? '');
  _setVal('world-tone-input', world?.tone ?? '');
  _setVal('world-lore-input', world?.globalLore ?? '');
}

function _populateLocationsTab() {
  const locations = getAllLocations();
  const container = document.getElementById('locations-list');
  if (!container) return;

  if (Object.keys(locations).length === 0) {
    container.innerHTML = '<div class="empty-state">No locations yet. Add one below.</div>';
    return;
  }

  container.innerHTML = Object.values(locations).map(loc => `
    <div class="location-card" data-loc-id="${loc.id}">
      <div class="location-card-header">
        <span class="location-card-name">${_esc(loc.name)}</span>
        <div class="flex gap-2">
          <button class="btn btn-ghost set-active-loc" data-id="${loc.id}" style="font-size:0.75rem;padding:2px 8px">Set Active</button>
          <button class="btn btn-danger delete-loc" data-id="${loc.id}" style="font-size:0.75rem;padding:2px 8px">✕</button>
        </div>
      </div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" class="loc-name" data-id="${loc.id}" value="${_esc(loc.name)}">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="loc-desc" data-id="${loc.id}" rows="2">${_esc(loc.description)}</textarea>
      </div>
        <div class="form-row">
        <div class="form-group">
          <label>Weather</label>
          <input type="text" class="loc-weather" data-id="${loc.id}" value="${_esc(loc.weather)}" placeholder="e.g. rainy">
        </div>
          <div class="form-group">
            <label>Image URL</label>
            <input type="url" class="loc-image" data-id="${loc.id}" value="${_esc(loc.imageUrl)}" placeholder="https://…">
          </div>
        </div>
        <div class="form-group">
          <label>Ambient Soundtrack URL</label>
          <input type="url" class="loc-audio" data-id="${loc.id}" value="${_esc(loc.ambientSoundtrack)}" placeholder="https://…">
        </div>
      <div class="form-group">
        <label>Local Conflicts (one per line)</label>
        <textarea class="loc-conflicts" data-id="${loc.id}" rows="2">${_esc((loc.localConflicts ?? []).join('\n'))}</textarea>
      </div>
      <div class="form-group">
        <label>Lore Entries</label>
        <div class="lore-list" data-loc="${loc.id}">
          ${(loc.loreEntries ?? []).map(e => `
            <div class="lore-entry flex items-center gap-2" data-lore-id="${e.id}">
              <div class="flex-1">
                <div class="lore-title">${_esc(e.title)}</div>
                <div class="lore-body">${_esc(e.body)}</div>
              </div>
              <button class="btn-icon remove-lore" data-loc="${loc.id}" data-lore="${e.id}" title="Remove">✕</button>
            </div>
          `).join('')}
        </div>
        <div class="flex gap-2 mt-2">
          <input type="text" class="lore-title-input" placeholder="Lore title" style="flex:1">
          <input type="text" class="lore-body-input" placeholder="Lore text" style="flex:2">
          <button class="btn btn-ghost add-lore-btn" data-loc="${loc.id}" style="white-space:nowrap">+ Add</button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach listeners
  container.querySelectorAll('.set-active-loc').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveLocation(btn.dataset.id);
      bus.emit('toast', { message: 'Active location updated.', type: 'success' });
      bus.emit('sidebar:refresh');
    });
  });

  container.querySelectorAll('.delete-loc').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this location?')) {
        deleteLocation(btn.dataset.id);
        btn.closest('.location-card')?.remove();
      }
    });
  });

  container.querySelectorAll('.remove-lore').forEach(btn => {
    btn.addEventListener('click', () => {
      removeLoreEntry(btn.dataset.loc, btn.dataset.lore);
      btn.closest('[data-lore-id]')?.remove();
    });
  });

  container.querySelectorAll('.add-lore-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.location-card');
      const titleInput = card?.querySelector('.lore-title-input');
      const bodyInput = card?.querySelector('.lore-body-input');
      const title = titleInput?.value.trim();
      const body = bodyInput?.value.trim();
      if (!title) return;
      addLoreEntry(btn.dataset.loc, { title, body });
      if (titleInput) titleInput.value = '';
      if (bodyInput) bodyInput.value = '';
      _populateLocationsTab(); // Re-render
    });
  });
}

function _populateFactionsTab() {
  const world = getWorld();
  const container = document.getElementById('factions-list');
  if (!container) return;

  const factions = world?.factions ?? [];
  if (factions.length === 0) {
    container.innerHTML = '<div class="empty-state">No factions yet.</div>';
    return;
  }

  container.innerHTML = factions.map(f => `
    <div class="faction-row" data-faction-id="${f.id}">
      <input type="text" class="fac-name" data-id="${f.id}" value="${_esc(f.name)}" placeholder="Name" style="flex:1">
      <input type="text" class="fac-desc" data-id="${f.id}" value="${_esc(f.description)}" placeholder="Description" style="flex:2">
      <select class="fac-disp" data-id="${f.id}" style="width:auto">
        ${['hostile','neutral','friendly','ally'].map(d => `<option${f.disposition === d ? ' selected' : ''}>${d}</option>`).join('')}
      </select>
      <button class="btn-icon remove-faction" data-id="${f.id}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.remove-faction').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFaction(btn.dataset.id);
      btn.closest('[data-faction-id]')?.remove();
    });
  });
}

function _save() {
  // Save world meta
  updateWorld({
    name: _getVal('world-name-input'),
    genre: _getVal('world-genre-input'),
    tone: _getVal('world-tone-input'),
    globalLore: _getVal('world-lore-input')
  });

  // Save all location edits
  const container = document.getElementById('locations-list');
  const locationCards = [...(container?.querySelectorAll('.location-card') ?? [])];
  for (const card of locationCards) {
    const id = card.dataset.locId;
    if (!id) continue;
    const rawImageUrl = card.querySelector('.loc-image')?.value?.trim() ?? '';
    const rawAudioUrl = card.querySelector('.loc-audio')?.value?.trim() ?? '';
    const imageUrl = safeMediaUrl(rawImageUrl);
    const ambientSoundtrack = safeMediaUrl(rawAudioUrl);
    if ((rawImageUrl && !imageUrl) || (rawAudioUrl && !ambientSoundtrack)) {
      bus.emit('toast', { message: 'Media URLs must use http, https, blob, or a relative path.', type: 'error' });
      return;
    }
    updateLocation(id, {
      name: card.querySelector('.loc-name')?.value?.trim() ?? '',
      description: card.querySelector('.loc-desc')?.value?.trim() ?? '',
      weather: card.querySelector('.loc-weather')?.value?.trim() ?? '',
      imageUrl,
      ambientSoundtrack,
      localConflicts: (card.querySelector('.loc-conflicts')?.value ?? '')
        .split('\n').map(l => l.trim()).filter(Boolean)
    });
  }

  // Save faction edits
  const fContainer = document.getElementById('factions-list');
  fContainer?.querySelectorAll('[data-faction-id]').forEach(row => {
    const id = row.dataset.factionId;
    updateFaction(id, {
      name: row.querySelector('.fac-name')?.value ?? '',
      description: row.querySelector('.fac-desc')?.value ?? '',
      disposition: row.querySelector('.fac-disp')?.value ?? 'neutral'
    });
  });

  document.getElementById('world-dialog')?.close();
  bus.emit('toast', { message: 'World saved.', type: 'success' });
  bus.emit('sidebar:refresh');
}

function _addLocation() {
  createLocation({ name: 'New Location' });
  _populateLocationsTab();
}

function _addFaction() {
  addFaction({ name: 'New Faction' });
  _populateFactionsTab();
}

function _setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function _getVal(id) { return document.getElementById(id)?.value?.trim() ?? ''; }
function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
