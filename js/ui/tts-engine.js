/**
 * TTS Engine — Web Speech API based text-to-speech.
 *
 * Features:
 * - Per-character voice profiles (voice, rate, pitch, volume)
 * - Separate narrator voice
 * - Smart text parsing: splits story text into narration / dialogue / internal thought segments
 * - Dialogue (text in "quotes") spoken in the active character's voice
 * - Internal thoughts (*italics*) spoken quietly in character voice
 * - Everything else spoken in narrator voice
 * - Play/pause/stop controls, per-segment play buttons
 * - Highlights the segment currently being spoken
 */

import bus from '../utils/events.js';
import { getActiveCharacter, getCharacter } from '../state/characters.js';
import { getTree } from '../state/story-tree.js';

// ─── State ────────────────────────────────────────────────────────────────────

let _voices = [];
let _queue = [];      // Array of { text, profile, segmentEl }
let _queueIndex = 0;
let _currentUtterance = null;
let _isPaused = false;
let _isPlaying = false;
let _activeSegmentEl = null;

const DEFAULT_NARRATOR_PROFILE = {
  voiceURI: '',
  rate: 0.92,
  pitch: 0.85,
  volume: 1.0
};

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initTTS() {
  if (!('speechSynthesis' in window)) {
    console.warn('TTS: Web Speech API not supported in this browser.');
    return;
  }

  // Voices load asynchronously in most browsers
  _loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = _loadVoices;
  }

  // Bus events from UI
  bus.on('tts:play-segment', ({ nodeId }) => playSegment(nodeId));
  bus.on('tts:play-all', () => playAll());
  bus.on('tts:stop', stop);
  bus.on('tts:pause', pause);
  bus.on('tts:resume', resume);
}

function _loadVoices() {
  _voices = speechSynthesis.getVoices();
  bus.emit('tts:voices-loaded', { voices: _voices });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Play a single story segment by its node id.
 * @param {string} nodeId
 */
export function playSegment(nodeId) {
  stop();
  const segEl = document.querySelector(`.story-segment[data-node="${nodeId}"]`);
  const textEl = segEl?.querySelector('.story-text');
  if (!textEl) return;

  const rawText = _extractText(textEl);
  const segments = _parseSegments(rawText);
  const actorId = getTree().nodes[nodeId]?.actorId;
  _buildQueue(segments, segEl, actorId);
  _playQueue();
}

/**
 * Play all visible story segments from top to bottom.
 */
export function playAll() {
  stop();
  const allSegments = document.querySelectorAll('.story-segment[data-node]');
  allSegments.forEach(segEl => {
    const textEl = segEl.querySelector('.story-text');
    if (!textEl) return;
    const rawText = _extractText(textEl);
    const segments = _parseSegments(rawText);
    const nodeId = segEl.dataset.node;
    const actorId = getTree().nodes[nodeId]?.actorId;
    _buildQueue(segments, segEl, actorId);
  });
  _playQueue();
}

/**
 * Stop all speech and clear the queue.
 */
export function stop() {
  speechSynthesis.cancel();
  _queue = [];
  _queueIndex = 0;
  _isPlaying = false;
  _isPaused = false;
  _currentUtterance = null;
  _clearHighlight();
  _emitState();
}

export function pause() {
  if (_isPlaying && !_isPaused) {
    speechSynthesis.pause();
    _isPaused = true;
    _emitState();
  }
}

export function resume() {
  if (_isPaused) {
    speechSynthesis.resume();
    _isPaused = false;
    _emitState();
  }
}

export function isPlaying() { return _isPlaying; }
export function isPaused()  { return _isPaused; }

/**
 * Return available voices for the voice picker UI.
 * @returns {SpeechSynthesisVoice[]}
 */
export function getVoices() {
  return _voices.length ? _voices : speechSynthesis.getVoices();
}

/**
 * Get narrator voice profile from localStorage.
 * @returns {object}
 */
export function getNarratorProfile() {
  try {
    const stored = localStorage.getItem('tts_narrator');
    return stored ? { ...DEFAULT_NARRATOR_PROFILE, ...JSON.parse(stored) } : { ...DEFAULT_NARRATOR_PROFILE };
  } catch (_) {
    return { ...DEFAULT_NARRATOR_PROFILE };
  }
}

/**
 * Save narrator voice profile to localStorage.
 * @param {object} profile
 */
export function setNarratorProfile(profile) {
  localStorage.setItem('tts_narrator', JSON.stringify(profile));
}

/**
 * Speak arbitrary text with a given profile (for preview/test).
 * @param {string} text
 * @param {object} profile  { voiceURI, rate, pitch, volume }
 */
export function preview(text, profile) {
  speechSynthesis.cancel();
  const utt = _makeUtterance(text, profile);
  speechSynthesis.speak(utt);
}

// ─── Text Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse story text into an array of { type, text } segments.
 * Types:
 *   'narration'  — plain narrative prose
 *   'dialogue'   — text inside "double quotes" or "smart quotes"
 *   'thought'    — text inside *asterisks* or _underscores_ (markdown italics)
 *
 * @param {string} text  Plain text (markdown stripped)
 * @returns {Array<{type: string, text: string}>}
 */
export function _parseSegments(text) {
  const segments = [];
  // Match: "dialogue" | *thought* | _thought_ | remaining narration
  const pattern = /("[\s\S]*?"|"[\s\S]*?"|\*[\s\S]*?\*|_[\s\S]*?_)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Narration before this match
    if (match.index > lastIndex) {
      const narr = text.slice(lastIndex, match.index).trim();
      if (narr) segments.push({ type: 'narration', text: narr });
    }

    const raw = match[0];
    if (raw.startsWith('"') || raw.startsWith('\u201c')) {
      // Dialogue — strip the quotes
      segments.push({ type: 'dialogue', text: raw.replace(/^["\u201c]|["\u201d]$/g, '') });
    } else {
      // Thought — strip the * or _
      segments.push({ type: 'thought', text: raw.replace(/^\*|_|\*$|_$/g, '') });
    }

    lastIndex = match.index + raw.length;
  }

  // Trailing narration
  if (lastIndex < text.length) {
    const narr = text.slice(lastIndex).trim();
    if (narr) segments.push({ type: 'narration', text: narr });
  }

  return segments.filter(s => s.text.trim().length > 0);
}

// ─── Queue & Playback ─────────────────────────────────────────────────────────

function _buildQueue(segments, segmentEl, actorId = null) {
  const char = actorId === 'narrator'
    ? null
    : (actorId ? getCharacter(actorId) : getActiveCharacter());
  const narratorProfile = getNarratorProfile();
  const charProfile = char?.ttsProfile ?? null;

  segments.forEach(seg => {
    let profile;
    if (seg.type === 'dialogue' && charProfile) {
      profile = { ...charProfile };
    } else if (seg.type === 'thought' && charProfile) {
      // Thoughts: character voice but quieter and slightly slower
      profile = { ...charProfile, volume: (charProfile.volume ?? 1) * 0.7, rate: (charProfile.rate ?? 1) * 0.85 };
    } else {
      profile = narratorProfile;
    }

    _queue.push({ text: seg.text, profile, segmentEl });
  });
}

function _playQueue() {
  if (_queue.length === 0) return;
  _isPlaying = true;
  _queueIndex = 0;
  _emitState();
  _speakNext();
}

function _speakNext() {
  if (_queueIndex >= _queue.length) {
    _isPlaying = false;
    _clearHighlight();
    _emitState();
    return;
  }

  const item = _queue[_queueIndex];
  _highlightSegment(item.segmentEl);

  const utt = _makeUtterance(item.text, item.profile);
  utt.onend = () => {
    _queueIndex++;
    _speakNext();
  };
  utt.onerror = (e) => {
    if (e.error !== 'interrupted') {
      console.warn('TTS error:', e.error);
    }
    _queueIndex++;
    _speakNext();
  };

  _currentUtterance = utt;
  speechSynthesis.speak(utt);
}

function _makeUtterance(text, profile) {
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate   = profile?.rate   ?? 1;
  utt.pitch  = profile?.pitch  ?? 1;
  utt.volume = profile?.volume ?? 1;

  if (profile?.voiceURI) {
    const voice = _voices.find(v => v.voiceURIName === profile.voiceURI || v.name === profile.voiceURI);
    if (voice) utt.voice = voice;
  }

  return utt;
}

// ─── Highlight ────────────────────────────────────────────────────────────────

function _highlightSegment(el) {
  if (_activeSegmentEl === el) return;
  _clearHighlight();
  el?.classList.add('tts-active');
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  _activeSegmentEl = el;
}

function _clearHighlight() {
  _activeSegmentEl?.classList.remove('tts-active');
  _activeSegmentEl = null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract plain text from a DOM element, stripping HTML tags.
 * @param {HTMLElement} el
 * @returns {string}
 */
function _extractText(el) {
  // Use innerText to preserve line breaks naturally
  return el.innerText ?? el.textContent ?? '';
}

function _emitState() {
  bus.emit('tts:state', { isPlaying: _isPlaying, isPaused: _isPaused });
}
