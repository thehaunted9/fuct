/**
 * New Story Wizard — multi-step setup dialog.
 * Steps: 1) Genre & Tone  2) World  3) Starting Location  4) Character  5) Conflict & Begin
 */

import bus from '../utils/events.js';

const GENRES = [
  { value: 'fantasy',     icon: '⚔️',  name: 'Fantasy',       desc: 'Magic, quests, ancient realms' },
  { value: 'sci-fi',      icon: '🚀',  name: 'Sci-Fi',        desc: 'Space, technology, future worlds' },
  { value: 'horror',      icon: '🌑',  name: 'Horror',        desc: 'Dread, mystery, the unknown' },
  { value: 'romance',     icon: '💌',  name: 'Romance',       desc: 'Love, longing, entanglement' },
  { value: 'thriller',    icon: '🔪',  name: 'Thriller',      desc: 'Tension, secrets, danger' },
  { value: 'historical',  icon: '📜',  name: 'Historical',    desc: 'Real eras, reimagined' },
  { value: 'mystery',     icon: '🔍',  name: 'Mystery',       desc: 'Clues, deduction, revelations' },
  { value: 'adventure',   icon: '🗺️',  name: 'Adventure',     desc: 'Exploration, discovery, danger' },
];

const TONES = [
  { value: 'grim',        label: 'Grim & Dark' },
  { value: 'adventurous', label: 'Adventurous' },
  { value: 'whimsical',   label: 'Whimsical' },
  { value: 'tense',       label: 'Tense & Suspenseful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'hopeful',     label: 'Hopeful' },
];

let _state = {};
let _currentStep = 0;

export function initWizard() {
  bus.on('wizard:open', _open);

  const dialog = document.getElementById('wizard-dialog');
  if (!dialog) return;

  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.querySelector('#wizard-back')?.addEventListener('click', _back);
  dialog.querySelector('#wizard-next')?.addEventListener('click', _next);
}

function _open() {
  _state = {
    genre: '',
    tone: 'adventurous',
    worldName: '',
    worldLore: '',
    locationName: '',
    locationDesc: '',
    locationWeather: '',
    charName: '',
    charRole: '',
    charBackstory: '',
    charGoals: '',
    initialConflict: ''
  };
  _currentStep = 0;
  _renderStep();
  document.getElementById('wizard-dialog')?.showModal();
}

function _renderStep() {
  const dialog = document.getElementById('wizard-dialog');
  if (!dialog) return;

  const stepsContainer = dialog.querySelector('#wizard-steps');
  const backBtn = dialog.querySelector('#wizard-back');
  const nextBtn = dialog.querySelector('#wizard-next');
  const dots = dialog.querySelectorAll('.wizard-step-dot');

  dots.forEach((dot, i) => {
    dot.className = 'wizard-step-dot ' + (i < _currentStep ? 'done' : i === _currentStep ? 'active' : '');
  });

  if (backBtn) backBtn.style.visibility = _currentStep === 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.textContent = _currentStep === 4 ? 'Begin Story!' : 'Next →';

  stepsContainer.innerHTML = _stepHTML(_currentStep);
  _attachStepListeners(_currentStep);
}

function _stepHTML(step) {
  switch (step) {
    case 0: return `
      <h3 style="margin-bottom:var(--sp-4)">Choose a Genre</h3>
      <div class="genre-grid">
        ${GENRES.map(g => `
          <button class="genre-btn${_state.genre === g.value ? ' selected' : ''}" data-genre="${g.value}">
            <span class="genre-icon">${g.icon}</span>
            <span class="genre-name">${g.name}</span>
            <span class="genre-desc">${g.desc}</span>
          </button>
        `).join('')}
      </div>
      <div class="form-group mt-4">
        <label for="wiz-tone">Story Tone</label>
        <select id="wiz-tone">
          ${TONES.map(t => `<option value="${t.value}"${_state.tone === t.value ? ' selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>`;

    case 1: return `
      <h3 style="margin-bottom:var(--sp-4)">Name Your World</h3>
      <div class="form-group">
        <label for="wiz-world-name">World Name</label>
        <input type="text" id="wiz-world-name" value="${_esc(_state.worldName)}" placeholder="e.g. The Shattered Reach">
      </div>
      <div class="form-group">
        <label for="wiz-world-lore">World Lore (optional)</label>
        <textarea id="wiz-world-lore" rows="4" placeholder="Describe the history, magic system, key facts...">${_esc(_state.worldLore)}</textarea>
      </div>`;

    case 2: return `
      <h3 style="margin-bottom:var(--sp-4)">Starting Location</h3>
      <div class="form-group">
        <label for="wiz-loc-name">Location Name</label>
        <input type="text" id="wiz-loc-name" value="${_esc(_state.locationName)}" placeholder="e.g. The Rusted Flagon tavern">
      </div>
      <div class="form-group">
        <label for="wiz-loc-desc">Description</label>
        <textarea id="wiz-loc-desc" rows="3" placeholder="What does this place look, feel, smell like?">${_esc(_state.locationDesc)}</textarea>
      </div>
      <div class="form-group">
        <label for="wiz-loc-weather">Weather / Atmosphere</label>
        <input type="text" id="wiz-loc-weather" value="${_esc(_state.locationWeather)}" placeholder="e.g. rainy, candlelit, eerily quiet">
      </div>`;

    case 3: return `
      <h3 style="margin-bottom:var(--sp-4)">Your Character</h3>
      <div class="form-group">
        <label for="wiz-char-name">Character Name</label>
        <input type="text" id="wiz-char-name" value="${_esc(_state.charName)}" placeholder="e.g. Aelindra">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="wiz-char-role">Role / Class</label>
          <input type="text" id="wiz-char-role" value="${_esc(_state.charRole)}" placeholder="e.g. Rogue, Scholar, Knight">
        </div>
      </div>
      <div class="form-group">
        <label for="wiz-char-backstory">Backstory (optional)</label>
        <textarea id="wiz-char-backstory" rows="3" placeholder="Who are they? Where do they come from?">${_esc(_state.charBackstory)}</textarea>
      </div>
      <div class="form-group">
        <label for="wiz-char-goals">Goals (comma separated)</label>
        <input type="text" id="wiz-char-goals" value="${_esc(_state.charGoals)}" placeholder="e.g. Find the stolen artifact, Avenge my mentor">
      </div>`;

    case 4: return `
      <h3 style="margin-bottom:var(--sp-4)">The Central Conflict</h3>
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:var(--sp-4)">
        Optionally describe the story's central tension or conflict. This seeds the opening narration.
      </p>
      <div class="form-group">
        <label for="wiz-conflict">Initial Conflict</label>
        <textarea id="wiz-conflict" rows="4" placeholder="e.g. A mysterious plague is spreading from the north, and rumours point to a legendary artifact that must be recovered before it falls into the wrong hands...">${_esc(_state.initialConflict)}</textarea>
      </div>
      <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--border-radius);padding:var(--sp-3);margin-top:var(--sp-4);font-size:0.8rem;color:var(--text-secondary)">
        <strong style="color:var(--text-primary)">Ready to begin:</strong><br>
        ${_esc(_state.worldName || 'Your world')} · ${_esc(_state.locationName || 'Starting location')} · ${_esc(_state.charName || 'Your character')}
      </div>`;

    default: return '';
  }
}

function _attachStepListeners(step) {
  // Genre buttons
  document.querySelectorAll('.genre-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.genre = btn.dataset.genre;
      document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Tone
  document.getElementById('wiz-tone')?.addEventListener('change', e => { _state.tone = e.target.value; });

  // Step-specific fields
  const fieldMap = {
    'wiz-world-name':    v => _state.worldName = v,
    'wiz-world-lore':    v => _state.worldLore = v,
    'wiz-loc-name':      v => _state.locationName = v,
    'wiz-loc-desc':      v => _state.locationDesc = v,
    'wiz-loc-weather':   v => _state.locationWeather = v,
    'wiz-char-name':     v => _state.charName = v,
    'wiz-char-role':     v => _state.charRole = v,
    'wiz-char-backstory':v => _state.charBackstory = v,
    'wiz-char-goals':    v => _state.charGoals = v,
    'wiz-conflict':      v => _state.initialConflict = v,
  };

  Object.entries(fieldMap).forEach(([id, setter]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', e => setter(e.target.value));
  });
}

function _back() {
  if (_currentStep > 0) { _currentStep--; _renderStep(); }
}

function _next() {
  if (!_validate(_currentStep)) return;
  if (_currentStep < 4) { _currentStep++; _renderStep(); }
  else _finish();
}

function _validate(step) {
  if (step === 0 && !_state.genre) {
    bus.emit('toast', { message: 'Please select a genre.', type: 'error' });
    return false;
  }
  if (step === 1 && !_state.worldName.trim()) {
    bus.emit('toast', { message: 'Give your world a name.', type: 'error' });
    return false;
  }
  if (step === 2 && !_state.locationName.trim()) {
    bus.emit('toast', { message: 'Name your starting location.', type: 'error' });
    return false;
  }
  if (step === 3 && !_state.charName.trim()) {
    bus.emit('toast', { message: 'Give your character a name.', type: 'error' });
    return false;
  }
  return true;
}

function _finish() {
  // Main owns the transaction so it can save the current story before replacing state.
  document.getElementById('wizard-dialog')?.close();

  bus.emit('story:begin', {
    setup: {
      ..._state,
      charGoals: _state.charGoals
        ? _state.charGoals.split(',').map(goal => goal.trim()).filter(Boolean)
        : []
    },
    initialConflict: _state.initialConflict
  });
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
