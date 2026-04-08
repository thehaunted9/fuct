/**
 * Character Editor Modal — create and edit characters.
 */

import bus from '../utils/events.js';
import { createCharacter, updateCharacter, deleteCharacter, getAllCharacters, getCharacter } from '../state/characters.js';

let _editingId = null;
let _tags = { strengths: [], weaknesses: [], goals: [] };

export function initCharacterEditor() {
  const dialog = document.getElementById('char-dialog');
  if (!dialog) return;

  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  // Tab switching
  dialog.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      dialog.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      dialog.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      dialog.querySelector(`#${tab.dataset.panel}`)?.classList.add('active');
    });
  });

  dialog.querySelector('#char-save')?.addEventListener('click', _save);
  dialog.querySelector('#char-delete')?.addEventListener('click', _delete);

  // Tag inputs
  ['strengths', 'weaknesses', 'goals'].forEach(field => {
    const input = dialog.querySelector(`#char-${field}-input`);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/,$/, '');
        if (val) { _addTag(field, val); input.value = ''; }
      }
    });
  });

  // Open events
  bus.on('char:edit', ({ id }) => _open(id));
  bus.on('char:create', () => _open(null));
}

function _open(id) {
  _editingId = id;
  const dialog = document.getElementById('char-dialog');
  if (!dialog) return;

  const char = id ? getCharacter(id) : null;

  _tags = {
    strengths: [...(char?.strengths ?? [])],
    weaknesses: [...(char?.weaknesses ?? [])],
    goals: [...(char?.goals ?? [])]
  };

  // Populate fields
  _setVal('char-name-input', char?.name ?? '');
  _setVal('char-role-input', char?.role ?? '');
  _setVal('char-voice-input', char?.voiceTone ?? '');
  _setVal('char-appearance-input', char?.appearance ?? '');
  _setVal('char-backstory-input', char?.backstory ?? '');
  _setVal('char-mood-input', char?.currentState?.mood ?? '');
  _setVal('char-health-input', char?.currentState?.health ?? '');

  _renderTags('strengths');
  _renderTags('weaknesses');
  _renderTags('goals');

  const deleteBtn = dialog.querySelector('#char-delete');
  if (deleteBtn) deleteBtn.style.display = id ? 'inline-flex' : 'none';

  dialog.querySelector('.modal-title').textContent = id ? 'Edit Character' : 'New Character';

  // Reset to first tab
  dialog.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  dialog.querySelectorAll('.tab-panel').forEach((p, i) => p.classList.toggle('active', i === 0));

  dialog.showModal();
}

function _save() {
  const dialog = document.getElementById('char-dialog');
  const data = {
    name:        _getVal('char-name-input'),
    role:        _getVal('char-role-input'),
    voiceTone:   _getVal('char-voice-input'),
    appearance:  _getVal('char-appearance-input'),
    backstory:   _getVal('char-backstory-input'),
    strengths:   [..._tags.strengths],
    weaknesses:  [..._tags.weaknesses],
    goals:       [..._tags.goals],
    currentState: {
      mood:   _getVal('char-mood-input') || 'neutral',
      health: _getVal('char-health-input') || 'healthy'
    }
  };

  if (!data.name.trim()) {
    bus.emit('toast', { message: 'Character needs a name.', type: 'error' });
    return;
  }

  if (_editingId) {
    updateCharacter(_editingId, data);
    bus.emit('toast', { message: 'Character updated.', type: 'success' });
  } else {
    createCharacter(data);
    bus.emit('toast', { message: 'Character created.', type: 'success' });
  }

  dialog?.close();
  bus.emit('sidebar:refresh');
}

function _delete() {
  if (!_editingId) return;
  if (!confirm('Delete this character?')) return;
  deleteCharacter(_editingId);
  document.getElementById('char-dialog')?.close();
  bus.emit('toast', { message: 'Character deleted.', type: 'success' });
  bus.emit('sidebar:refresh');
}

function _addTag(field, value) {
  if (!_tags[field].includes(value)) {
    _tags[field].push(value);
    _renderTags(field);
  }
}

function _removeTag(field, value) {
  _tags[field] = _tags[field].filter(t => t !== value);
  _renderTags(field);
}

function _renderTags(field) {
  const container = document.getElementById(`char-${field}-tags`);
  if (!container) return;
  container.innerHTML = _tags[field].map(t => `
    <span class="removable-tag">
      ${_esc(t)}
      <span class="remove" data-field="${field}" data-value="${_esc(t)}">×</span>
    </span>
  `).join('');
  container.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => _removeTag(btn.dataset.field, btn.dataset.value));
  });
}

function _setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
function _getVal(id) {
  return document.getElementById(id)?.value?.trim() ?? '';
}
function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function characterEditorHTML() {
  return `
<dialog id="char-dialog" aria-label="Character Editor">
  <div class="modal-header">
    <span class="modal-title">Character</span>
    <button class="modal-close" aria-label="Close">✕</button>
  </div>
  <div class="modal-tabs">
    <button class="modal-tab active" data-panel="char-tab-identity">Identity</button>
    <button class="modal-tab" data-panel="char-tab-backstory">Backstory</button>
    <button class="modal-tab" data-panel="char-tab-traits">Traits</button>
    <button class="modal-tab" data-panel="char-tab-state">Current State</button>
  </div>
  <div class="modal-body">
    <div id="char-tab-identity" class="tab-panel active">
      <div class="form-row">
        <div class="form-group">
          <label for="char-name-input">Name *</label>
          <input type="text" id="char-name-input" placeholder="Character name">
        </div>
        <div class="form-group">
          <label for="char-role-input">Role / Class</label>
          <input type="text" id="char-role-input" placeholder="e.g. Rogue, Scholar">
        </div>
      </div>
      <div class="form-group">
        <label for="char-appearance-input">Appearance</label>
        <textarea id="char-appearance-input" rows="2" placeholder="Physical description..."></textarea>
      </div>
      <div class="form-group">
        <label for="char-voice-input">Voice / Tone</label>
        <input type="text" id="char-voice-input" placeholder="e.g. sardonic, earnest, mysterious">
      </div>
    </div>

    <div id="char-tab-backstory" class="tab-panel">
      <div class="form-group">
        <label for="char-backstory-input">Backstory</label>
        <textarea id="char-backstory-input" rows="8" placeholder="Who are they? Where do they come from? What shaped them?"></textarea>
      </div>
    </div>

    <div id="char-tab-traits" class="tab-panel">
      <div class="form-group">
        <label>Strengths</label>
        <div class="tag-input-row">
          <input type="text" id="char-strengths-input" placeholder="Add strength, press Enter">
        </div>
        <div id="char-strengths-tags" class="tag-list mt-2"></div>
      </div>
      <div class="form-group">
        <label>Weaknesses</label>
        <div class="tag-input-row">
          <input type="text" id="char-weaknesses-input" placeholder="Add weakness, press Enter">
        </div>
        <div id="char-weaknesses-tags" class="tag-list mt-2"></div>
      </div>
      <div class="form-group">
        <label>Goals</label>
        <div class="tag-input-row">
          <input type="text" id="char-goals-input" placeholder="Add goal, press Enter">
        </div>
        <div id="char-goals-tags" class="tag-list mt-2"></div>
      </div>
    </div>

    <div id="char-tab-state" class="tab-panel">
      <div class="form-row">
        <div class="form-group">
          <label for="char-mood-input">Current Mood</label>
          <input type="text" id="char-mood-input" placeholder="e.g. wary, hopeful, furious">
        </div>
        <div class="form-group">
          <label for="char-health-input">Health / Condition</label>
          <input type="text" id="char-health-input" placeholder="e.g. healthy, injured, exhausted">
        </div>
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button id="char-delete" class="btn btn-danger" style="display:none">Delete</button>
    <button class="btn btn-ghost" onclick="this.closest('dialog').close()">Cancel</button>
    <button id="char-save" class="btn btn-primary">Save</button>
  </div>
</dialog>`;
}
