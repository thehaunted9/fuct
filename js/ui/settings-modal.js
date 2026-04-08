/**
 * Settings modal — API key, model selection, UI preferences.
 * Uses the native <dialog> element.
 */

import { setApiKey, setModel, getSession } from '../state/session.js';
import { callGrok } from '../api/grok.js';
import bus from '../utils/events.js';

const MODELS = [
  { value: 'grok-4',      label: 'Grok 4 (Latest)' },
  { value: 'grok-3',      label: 'Grok 3' },
  { value: 'grok-3-mini', label: 'Grok 3 Mini (Faster, cheaper)' },
  { value: 'grok-2',      label: 'Grok 2' },
];

export function initSettingsModal() {
  const dialog = document.getElementById('settings-dialog');
  if (!dialog) return;

  _populateForm();

  // Open
  bus.on('settings:open', () => {
    _populateForm();
    dialog.showModal();
  });

  // Close button
  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());

  // Close on backdrop click
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  // Save
  dialog.querySelector('#settings-save')?.addEventListener('click', _save);

  // Test connection
  dialog.querySelector('#test-connection')?.addEventListener('click', _testConnection);
}

function _populateForm() {
  const dialog = document.getElementById('settings-dialog');
  const session = getSession();

  const keyInput = dialog.querySelector('#api-key-input');
  if (keyInput) keyInput.value = session.apiKey ?? '';

  const modelSelect = dialog.querySelector('#model-select');
  if (modelSelect) {
    modelSelect.innerHTML = MODELS.map(m =>
      `<option value="${m.value}"${m.value === session.model ? ' selected' : ''}>${m.label}</option>`
    ).join('');
  }
}

function _save() {
  const dialog = document.getElementById('settings-dialog');
  const key = dialog.querySelector('#api-key-input')?.value.trim();
  const model = dialog.querySelector('#model-select')?.value;

  if (key !== undefined) setApiKey(key);
  if (model) setModel(model);

  dialog.close();
  bus.emit('toast', { message: 'Settings saved', type: 'success' });
}

async function _testConnection() {
  const dialog = document.getElementById('settings-dialog');
  const resultEl = dialog.querySelector('#test-connection-result');
  const key = dialog.querySelector('#api-key-input')?.value.trim();
  const model = dialog.querySelector('#model-select')?.value ?? 'grok-3';

  if (!key) {
    if (resultEl) { resultEl.textContent = 'Enter an API key first.'; resultEl.style.color = 'var(--danger)'; }
    return;
  }

  if (resultEl) { resultEl.textContent = 'Testing…'; resultEl.style.color = 'var(--text-muted)'; }

  try {
    const response = await callGrok({
      apiKey: key,
      model,
      systemPrompt: 'You are a story engine.',
      messages: [{ role: 'user', content: 'Respond with exactly: "Connection successful."' }],
      maxTokens: 20
    });
    if (resultEl) {
      resultEl.textContent = `✓ ${response.trim()}`;
      resultEl.style.color = 'var(--success)';
    }
  } catch (err) {
    if (resultEl) {
      resultEl.textContent = `✗ ${err.message}`;
      resultEl.style.color = 'var(--danger)';
    }
  }
}

/** Return the HTML markup for the settings dialog (injected into index.html). */
export function settingsModalHTML() {
  return `
<dialog id="settings-dialog" aria-label="Settings">
  <div class="modal-header">
    <span class="modal-title">Settings</span>
    <button class="modal-close" aria-label="Close">✕</button>
  </div>
  <div class="modal-body">
    <div class="form-group">
      <label for="api-key-input">Grok API Key</label>
      <div class="api-key-row">
        <input type="password" id="api-key-input" placeholder="xai-…" autocomplete="off">
        <button id="test-connection" class="btn btn-ghost">Test</button>
      </div>
      <div id="test-connection-result"></div>
      <p class="api-warning">
        Your API key is stored locally in your browser and sent directly to xAI.
        Never use this on a shared or public computer.
      </p>
    </div>

    <div class="form-group">
      <label for="model-select">Model</label>
      <select id="model-select"></select>
    </div>

    <div class="form-group">
      <label>Story Library</label>
      <div class="flex gap-2">
        <button id="open-library-btn" class="btn btn-ghost w-full">Open Story Library</button>
      </div>
    </div>

    <div class="form-group">
      <label>Export / Import</label>
      <div class="flex gap-2">
        <button id="export-story-btn" class="btn btn-ghost flex-1">Export Story JSON</button>
        <label class="btn btn-ghost flex-1" style="cursor:pointer;justify-content:center;">
          Import Story JSON
          <input type="file" id="import-story-input" accept=".json,.story.json" style="display:none">
        </label>
      </div>
    </div>
  </div>
  <div class="modal-footer">
    <button class="btn btn-ghost" onclick="this.closest('dialog').close()">Cancel</button>
    <button id="settings-save" class="btn btn-primary">Save</button>
  </div>
</dialog>`;
}
