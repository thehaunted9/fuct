/**
 * Autosave — debounced save to IndexedDB after each story update.
 * Also handles JSON export / import for story bundle sharing.
 */

import { saveStory, loadStory } from './db.js';
import store from '../state/store.js';
import { loadCharacters } from '../state/characters.js';
import { loadWorld } from '../state/world.js';
import { setStoryId, getSession } from '../state/session.js';
import { uid } from '../utils/uid.js';

let _debounceTimer = null;
const DEBOUNCE_MS = 2000;

/**
 * Trigger a debounced autosave for the current story.
 * Called after every node append / character / world update.
 */
export function triggerAutosave() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _save(), DEBOUNCE_MS);
}

/**
 * Force an immediate save (e.g., before navigating away).
 */
export async function forceSave() {
  clearTimeout(_debounceTimer);
  await _save();
}

/**
 * Load a story from IndexedDB into the store.
 * @param {string} storyId
 */
export async function loadStoryIntoStore(storyId) {
  const bundle = await loadStory(storyId);
  if (!bundle) throw new Error(`Story ${storyId} not found`);
  _hydrateStore(bundle);
  return bundle;
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
  const text = await file.text();
  const bundle = JSON.parse(text);
  if (!bundle.id) bundle.id = uid('story');
  await saveStory(bundle);
  _hydrateStore(bundle);
  return bundle.id;
}

// ─── Private ──────────────────────────────────────────────────────────────────

async function _save() {
  const bundle = _buildBundle();
  if (!bundle.id) return; // no story initialized yet
  await saveStory(bundle);
}

function _buildBundle() {
  const session = getSession();
  const tree = store.get('tree');
  const characters = store.get('characters');
  const world = store.get('world');

  return {
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
  if (bundle.tree) store.set('tree', bundle.tree);
  if (bundle.characters) loadCharacters(bundle.characters);
  if (bundle.world) loadWorld(bundle.world);
  setStoryId(bundle.id);
}
