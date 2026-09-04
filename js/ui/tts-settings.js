/**
 * TTS Settings Modal
 * - Narrator voice profile (voiceURI, rate, pitch, volume)
 * - Per-character voice profiles
 * - Test/preview button for each voice
 */

import bus from '../utils/events.js';
import { getVoices, getNarratorProfile, setNarratorProfile, preview } from './tts-engine.js';
import { getAllCharacters, updateCharacter } from '../state/characters.js';

export function initTTSSettings() {
  const dialog = document.getElementById('tts-dialog');
  if (!dialog) return;

  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.querySelector('#tts-save')?.addEventListener('click', _save);

  bus.on('tts:settings:open', () => _open());
  bus.on('tts:voices-loaded', () => { if (dialog.open) _open(); });
}

function _open() {
  _render();
  document.getElementById('tts-dialog')?.showModal();
}

function _render() {
  const dialog = document.getElementById('tts-dialog');
  if (!dialog) return;

  const body = dialog.querySelector('#tts-modal-body');
  if (!body) return;

  const voices = getVoices();
  const narratorProfile = getNarratorProfile();
  const characters = getAllCharacters();

  body.innerHTML = `
    ${_voiceCardHTML('narrator', 'Narrator', narratorProfile, voices)}
    <hr style="border-color:var(--border);margin:var(--sp-4) 0">
    <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:var(--sp-3)">
      Character Voices
    </div>
    ${Object.values(characters).map(c =>
      _voiceCardHTML(c.id, c.name, c.ttsProfile ?? {}, voices)
    ).join('')}
    ${Object.keys(characters).length === 0
      ? '<div class="empty-state">No characters yet. Create characters first.</div>'
      : ''}
  `;

  // Attach preview buttons
  body.querySelectorAll('.tts-preview-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.tts-voice-card');
      const profile = _readCardProfile(card);
      const name = card.dataset.id === 'narrator' ? 'the narrator' : btn.dataset.name;
      preview(`Hello, I am ${name}. This is how I sound in your story.`, profile);
    });
  });
}

function _voiceCardHTML(id, name, profile, voices) {
  const voiceOptions = [
    `<option value="">Browser default</option>`,
    ...voices.map(v =>
      `<option value="${_esc(v.name)}"${profile.voiceURI === v.name ? ' selected' : ''}>${_esc(v.name)} (${v.lang})</option>`
    )
  ].join('');

  return `
    <div class="tts-voice-card" data-id="${_esc(id)}">
      <div class="flex items-center" style="justify-content:space-between;margin-bottom:var(--sp-3)">
        <div>
          <span style="font-weight:600;font-size:0.9rem">${_esc(name)}</span>
          ${id === 'narrator' ? '<span class="tag" style="margin-left:var(--sp-2)">Narrator</span>' : ''}
        </div>
        <button class="btn btn-ghost tts-preview-btn" data-name="${_esc(name)}" style="font-size:0.75rem;padding:3px 10px">
          🔊 Preview
        </button>
      </div>

      <div class="form-group">
        <label>Voice</label>
        <select class="tts-voice-select">
          ${voiceOptions}
        </select>
      </div>

      <div class="tts-sliders">
        <div class="form-group">
          <label>Speed — <span class="tts-rate-val">${profile.rate ?? 1}</span>x</label>
          <input type="range" class="tts-rate" min="0.5" max="2" step="0.05"
                 value="${profile.rate ?? 1}" style="accent-color:var(--accent)">
        </div>
        <div class="form-group">
          <label>Pitch — <span class="tts-pitch-val">${profile.pitch ?? 1}</span></label>
          <input type="range" class="tts-pitch" min="0" max="2" step="0.05"
                 value="${profile.pitch ?? 1}" style="accent-color:var(--accent)">
        </div>
        <div class="form-group">
          <label>Volume — <span class="tts-volume-val">${Math.round((profile.volume ?? 1) * 100)}%</span></label>
          <input type="range" class="tts-volume" min="0" max="1" step="0.05"
                 value="${profile.volume ?? 1}" style="accent-color:var(--accent)">
        </div>
      </div>
    </div>
  `;
}

// Live-update labels as sliders move
document.addEventListener('input', e => {
  const card = e.target.closest?.('.tts-voice-card');
  if (!card) return;
  if (e.target.classList.contains('tts-rate'))   card.querySelector('.tts-rate-val').textContent   = (+e.target.value).toFixed(2);
  if (e.target.classList.contains('tts-pitch'))  card.querySelector('.tts-pitch-val').textContent  = (+e.target.value).toFixed(2);
  if (e.target.classList.contains('tts-volume')) card.querySelector('.tts-volume-val').textContent = Math.round(e.target.value * 100) + '%';
});

function _save() {
  const body = document.getElementById('tts-modal-body');
  if (!body) return;

  body.querySelectorAll('.tts-voice-card').forEach(card => {
    const id = card.dataset.id;
    const profile = _readCardProfile(card);

    if (id === 'narrator') {
      setNarratorProfile(profile);
    } else {
      updateCharacter(id, { ttsProfile: profile });
    }
  });

  document.getElementById('tts-dialog')?.close();
  bus.emit('toast', { message: 'Voice settings saved.', type: 'success' });
}

function _readCardProfile(card) {
  return {
    voiceURI: card.querySelector('.tts-voice-select')?.value ?? '',
    rate:     parseFloat(card.querySelector('.tts-rate')?.value   ?? 1),
    pitch:    parseFloat(card.querySelector('.tts-pitch')?.value  ?? 1),
    volume:   parseFloat(card.querySelector('.tts-volume')?.value ?? 1)
  };
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
