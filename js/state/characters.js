/**
 * Character state management.
 * Handles CRUD for characters and tracks which one is active.
 */

import store from './store.js';
import { uid } from '../utils/uid.js';

store.init('characters', {
  all: {},        // { [id]: Character }
  activeId: null  // currently played / focused character
});

/**
 * Create a new character and add it to the store.
 * @param {object} data  Partial character fields
 * @returns {string} character id
 */
export function createCharacter(data = {}) {
  const id = data.id ?? uid('char');
  const character = _defaults(id, data);
  const chars = store.get('characters');
  store.set('characters', {
    ...chars,
    all: { ...chars.all, [id]: character },
    activeId: chars.activeId ?? id
  });
  return id;
}

/**
 * Update a character's fields (shallow merge).
 * @param {string} id
 * @param {object} partial
 */
export function updateCharacter(id, partial) {
  const chars = store.get('characters');
  const existing = chars.all[id];
  if (!existing) return;
  store.set('characters', {
    ...chars,
    all: { ...chars.all, [id]: { ...existing, ...partial } }
  });
}

/**
 * Delete a character by id.
 * @param {string} id
 */
export function deleteCharacter(id) {
  const chars = store.get('characters');
  const { [id]: _, ...rest } = chars.all;
  const newActiveId = chars.activeId === id
    ? (Object.keys(rest)[0] ?? null)
    : chars.activeId;
  store.set('characters', { ...chars, all: rest, activeId: newActiveId });
}

/**
 * Set the active (currently played) character.
 * @param {string} id
 */
export function setActiveCharacter(id) {
  const chars = store.get('characters');
  if (!chars.all[id]) return;
  store.set('characters', { ...chars, activeId: id });
}

export function getActiveCharacter() {
  const chars = store.get('characters');
  return chars.all[chars.activeId] ?? null;
}

export function getAllCharacters() {
  return store.get('characters').all;
}

export function getCharacter(id) {
  return store.get('characters').all[id] ?? null;
}

/**
 * Replace all characters (used when loading a saved story).
 * @param {{ all: object, activeId: string }} data
 */
export function loadCharacters(data) {
  store.set('characters', data);
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _defaults(id, data) {
  return {
    id,
    name: data.name ?? 'Unnamed Character',
    isPlayer: data.isPlayer ?? true,
    role: data.role ?? '',
    backstory: data.backstory ?? '',
    strengths: data.strengths ?? [],
    weaknesses: data.weaknesses ?? [],
    goals: data.goals ?? [],
    relationships: data.relationships ?? {},
    appearance: data.appearance ?? '',
    voiceTone: data.voiceTone ?? '',
    currentState: data.currentState ?? { mood: 'neutral', health: 'healthy' },
    ttsProfile: data.ttsProfile ?? {
      voiceURI: '',    // '' = browser default voice
      rate: 1.0,       // 0.5 – 2.0
      pitch: 1.0,      // 0.0 – 2.0
      volume: 1.0      // 0.0 – 1.0
    }
  };
}
