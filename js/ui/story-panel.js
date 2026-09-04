/**
 * Story Panel — renders story text and handles live streaming token appending.
 * Subscribes to store changes for the active node and stream events from bus.
 */

import { parseMarkdown } from '../utils/markdown.js';
import bus from '../utils/events.js';
import store from '../state/store.js';
import { getActiveNode, getTree } from '../state/story-tree.js';

let _storyContent = null;
let _streamingSegment = null;
let _streamCursor = null;
let _streamBuffer = '';

export function initStoryPanel() {
  _storyContent = document.getElementById('story-content');
  _streamingSegment = document.getElementById('streaming-segment');
  _streamCursor = document.getElementById('stream-cursor');

  if (!_storyContent) return;

  // Re-render when tree changes (node navigation, rewind)
  store.subscribe('tree', tree => {
    if (!tree || !tree.activeNodeId) return;
    _renderActiveNode(tree);
  });

  // Stream events
  bus.on('stream:token', ({ text }) => _appendToken(text));
  bus.on('stream:start', ({ userInput, mode, actorName }) => _onStreamStart(userInput, mode, actorName));
  bus.on('stream:end', () => _onStreamEnd());
  bus.on('stream:error', ({ message }) => _onStreamError(message));

  // TTS state → update global play-all button
  bus.on('tts:state', ({ isPlaying, isPaused }) => _updateTTSBar(isPlaying, isPaused));

  // Delegate play-segment clicks
  _storyContent.addEventListener('click', e => {
    const btn = e.target.closest('.tts-play-btn');
    if (btn) {
      e.stopPropagation();
      const nodeId = btn.closest('.story-segment')?.dataset.node;
      if (nodeId) bus.emit('tts:play-segment', { nodeId });
    }
  });

  // Global TTS controls
  document.getElementById('tts-play-all')?.addEventListener('click', () => bus.emit('tts:play-all'));
  document.getElementById('tts-pause')?.addEventListener('click',    () => bus.emit('tts:pause'));
  document.getElementById('tts-resume')?.addEventListener('click',   () => bus.emit('tts:resume'));
  document.getElementById('tts-stop')?.addEventListener('click',     () => bus.emit('tts:stop'));
  document.getElementById('tts-settings-btn')?.addEventListener('click', () => bus.emit('tts:settings:open'));
}

/**
 * Render the story text up to and including the given active node.
 * Shows the full narrative text of all ancestor nodes.
 */
function _renderActiveNode(tree) {
  if (!_storyContent) return;

  // Build ancestry chain
  const node = tree.nodes[tree.activeNodeId];
  if (!node) return;

  const segments = [];
  let current = tree.activeNodeId;
  while (current) {
    const n = tree.nodes[current];
    if (!n) break;
    segments.unshift(n);
    current = n.parentId;
  }

  // Render all segments
  _storyContent.innerHTML = segments
    .filter(n => n.narrativeText || n.deltaText)
    .map(n => _segmentHTML(n))
    .join('');

  _scrollToBottom();
}

function _segmentHTML(node) {
  const text = node.deltaText || node.narrativeText;
  if (!text) return '';

  let echoHtml = '';
  if (node.userInput) {
    const isNarrator = node.actorId === 'narrator';
    const label = isNarrator ? 'Narrator' : (node.actorId ?? 'Player');
    echoHtml = `<div class="user-action-echo${isNarrator ? ' narrator-echo' : ''}">
      <span class="actor-label">${_escHtml(label)}:</span>
      <span>${_escHtml(node.userInput)}</span>
    </div>`;
  }

  return `<div class="story-segment" data-node="${_escHtml(node.id)}">
    ${echoHtml}
    <div class="story-text">${parseMarkdown(text)}</div>
    <button class="tts-play-btn" title="Read this segment aloud">🔊</button>
  </div>`;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

function _onStreamStart(userInput, mode, actorName) {
  _streamBuffer = '';

  // Add user echo above the streaming area
  let echoHtml = '';
  if (userInput) {
    const isNarrator = mode === 'narrator';
    const label = isNarrator ? 'Narrator' : (actorName ?? 'Player');
    echoHtml = `<div class="user-action-echo${isNarrator ? ' narrator-echo' : ''}">
      <span class="actor-label">${_escHtml(label)}:</span>
      <span>${_escHtml(userInput)}</span>
    </div>`;
  }

  if (_streamingSegment) {
    _streamingSegment.innerHTML = `
      ${echoHtml}
      <div id="stream-text" class="story-text"></div>
      <span id="stream-cursor"></span>
    `;
    _streamCursor = _streamingSegment.querySelector('#stream-cursor');
  }

  _scrollToBottom();
}

function _appendToken(text) {
  _streamBuffer += text;

  const streamText = _streamingSegment?.querySelector('#stream-text');
  if (streamText) {
    streamText.innerHTML = parseMarkdown(_streamBuffer);
  }

  // Move cursor to end of last paragraph
  if (_streamCursor && _streamingSegment) {
    const lastP = _streamingSegment.querySelector('.story-text *:last-child') || _streamingSegment;
    lastP.appendChild(_streamCursor);
  }

  _scrollToBottom();
}

function _onStreamEnd() {
  // Clear streaming area (the tree subscription will re-render with the full node)
  if (_streamingSegment) _streamingSegment.innerHTML = '';
  _streamBuffer = '';
}

function _onStreamError(message) {
  if (_streamingSegment) {
    _streamingSegment.innerHTML = `<div style="color:var(--danger);font-size:0.85rem;padding:var(--sp-3)">
      Error: ${_escHtml(message)}
    </div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _scrollToBottom() {
  const panel = document.getElementById('story-panel');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function _updateTTSBar(isPlaying, isPaused) {
  const playAllBtn = document.getElementById('tts-play-all');
  const pauseBtn   = document.getElementById('tts-pause');
  const resumeBtn  = document.getElementById('tts-resume');
  const stopBtn    = document.getElementById('tts-stop');

  if (playAllBtn) playAllBtn.style.display = isPlaying ? 'none' : 'inline-flex';
  if (pauseBtn)   pauseBtn.style.display   = isPlaying && !isPaused ? 'inline-flex' : 'none';
  if (resumeBtn)  resumeBtn.style.display  = isPaused ? 'inline-flex' : 'none';
  if (stopBtn)    stopBtn.style.display    = isPlaying || isPaused ? 'inline-flex' : 'none';
}

function _escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
