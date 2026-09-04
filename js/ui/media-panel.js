/**
 * Media Panel — scene image and ambient audio soundtrack.
 * Updates automatically when the active location changes.
 */

import store from '../state/store.js';
import { getActiveLocation } from '../state/world.js';
import { safeMediaUrl } from '../utils/urls.js';

let _audio = null;

export function initMediaPanel() {
  _audio = document.getElementById('ambient-audio');

  store.subscribe('world', () => _update());
  _update();

  // Volume control
  document.getElementById('audio-volume')?.addEventListener('input', e => {
    if (_audio) _audio.volume = parseFloat(e.target.value);
  });

  // Play/pause
  document.getElementById('audio-play-btn')?.addEventListener('click', () => {
    if (!_audio) return;
    if (_audio.paused) _audio.play().catch(() => {});
    else _audio.pause();
    _updatePlayBtn();
  });

  if (_audio) {
    _audio.addEventListener('play', _updatePlayBtn);
    _audio.addEventListener('pause', _updatePlayBtn);
  }
}

function _update() {
  const loc = getActiveLocation();
  const strip = document.getElementById('media-strip');

  const imageUrl = safeMediaUrl(loc?.imageUrl);
  const audioUrl = safeMediaUrl(loc?.ambientSoundtrack);
  const hasImage = Boolean(imageUrl);
  const hasAudio = Boolean(audioUrl);

  if (!hasImage && !hasAudio) {
    if (strip) strip.classList.add('empty');
    return;
  }

  if (strip) strip.classList.remove('empty');

  // Scene image
  const img = document.getElementById('scene-image');
  if (img) {
    if (hasImage) {
      img.src = imageUrl;
      img.classList.remove('hidden');
    } else {
      img.src = '';
      img.classList.add('hidden');
    }
  }

  // Audio
  const trackName = document.getElementById('audio-track-name');
  if (hasAudio && _audio) {
    const src = audioUrl;
    if (_audio.src !== src) {
      _audio.src = src;
      _audio.loop = true;
      _audio.volume = parseFloat(document.getElementById('audio-volume')?.value ?? 0.4);
      _audio.play().catch(() => {}); // Autoplay may be blocked
    }
    if (trackName) trackName.textContent = src.split('/').pop() ?? 'Ambient';
  } else {
    if (_audio && !_audio.paused) _audio.pause();
    if (trackName) trackName.textContent = '';
  }

  _updatePlayBtn();
}

function _updatePlayBtn() {
  const btn = document.getElementById('audio-play-btn');
  if (!btn || !_audio) return;
  btn.textContent = _audio.paused ? '▶' : '⏸';
}
