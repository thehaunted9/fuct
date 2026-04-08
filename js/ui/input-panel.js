/**
 * Input Panel — textarea, send/stop buttons, mode switcher, action buttons.
 * Emits story generation requests via the event bus.
 */

import bus from '../utils/events.js';
import store from '../state/store.js';
import { getSession, setMode, abortStream } from '../state/session.js';
import { getTree, branchFrom, markCheckpoint, navigateTo, createArc, switchArc } from '../state/story-tree.js';
import { getActiveCharacter } from '../state/characters.js';
import { getActiveLocation } from '../state/world.js';

export function initInputPanel() {
  const input = document.getElementById('story-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (!input || !sendBtn) return;

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });

  // Keyboard: Ctrl+Enter to send
  input.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      _submit();
    }
    // Ctrl+S = checkpoint
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      _checkpoint();
    }
  });

  sendBtn.addEventListener('click', _submit);
  stopBtn?.addEventListener('click', () => { abortStream(); _setStreaming(false); });

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setMode(mode);
      _updateModeUI(mode);
    });
  });

  // Action buttons
  document.getElementById('branch-btn')?.addEventListener('click', _branchHere);
  document.getElementById('rewind-btn')?.addEventListener('click', _showRewindPicker);
  document.getElementById('checkpoint-btn')?.addEventListener('click', _checkpoint);
  document.getElementById('new-arc-btn')?.addEventListener('click', _newArc);

  // Streaming state changes
  store.subscribe('session', session => {
    _setStreaming(session.isStreaming);
    _updateModeUI(session.mode);
    _updatePlaceholder(session.mode);
  });

  // Initial UI
  const session = getSession();
  _updateModeUI(session.mode);
  _updatePlaceholder(session.mode);
}

function _submit() {
  const input = document.getElementById('story-input');
  const text = input?.value.trim();
  if (!text) return;

  const session = getSession();
  if (session.isStreaming) return;
  if (!session.apiKey) {
    bus.emit('toast', { message: 'Set your Grok API key in Settings first.', type: 'error' });
    return;
  }

  bus.emit('story:generate', {
    userInput: text,
    mode: session.mode
  });

  input.value = '';
  input.style.height = 'auto';
}

function _branchHere() {
  const tree = getTree();
  const nodeId = tree.activeNodeId;
  if (!nodeId) return;
  branchFrom(nodeId);
  bus.emit('toast', { message: 'Branched from current point. Type to continue this new path.', type: 'success' });
  bus.emit('sidebar:refresh');
}

function _showRewindPicker() {
  bus.emit('timeline:open');
}

function _checkpoint() {
  markCheckpoint();
  bus.emit('toast', { message: 'Checkpoint saved. You can rewind here anytime.', type: 'success' });
  bus.emit('sidebar:refresh');
  // Ctrl+S default browser save prevention
}

function _newArc() {
  bus.emit('arc:create');
}

function _setStreaming(isStreaming) {
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const input = document.getElementById('story-input');

  if (sendBtn) sendBtn.disabled = isStreaming;
  if (stopBtn) {
    stopBtn.style.display = isStreaming ? 'flex' : 'none';
  }
  if (input) input.disabled = isStreaming;
}

function _updateModeUI(mode) {
  // Update mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    const btnMode = btn.dataset.mode;
    btn.className = `mode-btn ${btn.className.replace(/active-\w+/g, '').trim()}`;
    if (btnMode === mode) {
      if (mode === 'character') btn.classList.add('active-char');
      else if (mode === 'narrator') btn.classList.add('active-narr');
      else if (mode === 'worldbuilder') btn.classList.add('active-world');
    }
  });

  // Update mode badge in top nav
  const badge = document.getElementById('mode-badge');
  if (badge) {
    const labels = { character: 'Character', narrator: 'Narrator', worldbuilder: 'World Builder' };
    badge.textContent = labels[mode] ?? mode;
    badge.className = `mode-badge ${mode === 'worldbuilder' ? 'worldbuilder' : mode}`;
  }
}

function _updatePlaceholder(mode) {
  const input = document.getElementById('story-input');
  if (!input) return;
  const char = getActiveCharacter();
  const charName = char?.name ?? 'your character';
  const placeholders = {
    character: `What does ${charName} do?  (Ctrl+Enter to send)`,
    narrator:  'Describe what happens next…  (Ctrl+Enter to send)',
    worldbuilder: 'Add to the world — a location, lore, event…  (Ctrl+Enter to send)'
  };
  input.placeholder = placeholders[mode] ?? '';
}
