/**
 * Autosave — debounced save to IndexedDB after each story update.
 * Also handles JSON export / import for story bundle sharing.
 */

import { saveStory, loadStory } from './db.js';
import store from '../state/store.js';
import { loadCharacters } from '../state/characters.js';
import { loadWorld } from '../state/world.js';
import { setStoryId, setInitialized, getSession } from '../state/session.js';
import { STORY_SCHEMA_VERSION, MAX_IMPORT_BYTES, parseStoryJSON, validateStoryBundle } from './story-schema.js';
import bus from '../utils/events.js';

let _debounceTimer = null;
let _pendingBundle = null;
let _saveChain = Promise.resolve();
let _hydrating = false;
let _initialized = false;
const DEBOUNCE_MS = 2000;

/** Subscribe once to every persistent store slice and install flush hooks. */
export function initAutosave() {
  if (_initialized) return;
  _initialized = true;

  ['tree', 'characters', 'world'].forEach(key => {
    store.subscribe(key, () => {
      if (!_hydrating) triggerAutosave();
    });
  });

  const flush = () => { forceSave().catch(_reportSaveError); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/**
 * Trigger a debounced autosave for the current story.
 * Called after every node append / character / world update.
 */
export function triggerAutosave() {
  const bundle = _buildBundle();
  if (!bundle.id) return;
  _pendingBundle = bundle;
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _flushPending().catch(_reportSaveError);
  }, DEBOUNCE_MS);
}

/**
 * Force an immediate save (e.g., before navigating away).
 */
export async function forceSave() {
  clearTimeout(_debounceTimer);
  _debounceTimer = null;
  if (!_pendingBundle) {
    const bundle = _buildBundle();
    if (bundle.id) _pendingBundle = bundle;
  }
  await _flushPending();
}

/**
 * Load a story from IndexedDB into the store.
 * @param {string} storyId
 */
export async function loadStoryIntoStore(storyId) {
  const bundle = await loadStory(storyId);
  if (!bundle) throw new Error(`Story ${storyId} not found`);
  const validated = validateStoryBundle(bundle);
  _hydrateStore(validated);
  return validated;
}

/**
 * Export the current story as a downloadable JSON file.
 */
export function exportStoryJSON() {
  const bundle = _buildBundle();
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${bundle.title ?? 'story'}.story.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Import a story from a JSON file into IndexedDB and the store.
 * @param {File} file
 * @returns {Promise<string>} story id
 */
export async function importStoryJSON(file) {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error(`Story files cannot exceed ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.`);
  }
  const text = await file.text();
  const bundle = parseStoryJSON(text);
  await forceSave();
  await saveStory(bundle);
  _hydrateStore(bundle);
  return bundle.id;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _flushPending() {
  const bundle = _pendingBundle;
  _pendingBundle = null;
  if (!bundle?.id) return;

  _saveChain = _saveChain.catch(() => {}).then(() => saveStory(bundle));
  await _saveChain;
}

function _buildBundle() {
  const session = getSession();
  const tree = store.get('tree');
  const characters = store.get('characters');
  const world = store.get('world');

  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    id: session.storyId,
    title: world?.name ?? 'Untitled Story',
    createdAt: tree?.nodes?.[tree?.rootId]?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    tree,
    characters,
    world
  };
}

function _hydrateStore(bundle) {
  _hydrating = true;
  try {
    store.set('tree', bundle.tree);
    loadCharacters(bundle.characters);
    loadWorld(bundle.world);
    setStoryId(bundle.id);
    setInitialized(true);
    _pendingBundle = null;
    clearTimeout(_debounceTimer);
  } finally {
    _hydrating = false;
  }
}

function _reportSaveError(error) {
  console.error('Autosave failed:', error);
  bus.emit('toast', { message: `Autosave failed: ${error.message}`, type: 'error' });
}
