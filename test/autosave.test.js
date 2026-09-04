import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;

const { initAutosave, forceSave } = await import('../js/persistence/autosave.js');
const { loadStory } = await import('../js/persistence/db.js');
const { setStoryId } = await import('../js/state/session.js');
const { initTree } = await import('../js/state/story-tree.js');
const { loadCharacters, createCharacter } = await import('../js/state/characters.js');
const { initWorld, updateWorld, getActiveLocation } = await import('../js/state/world.js');

test('captures the originating story snapshot before a story id switch', async () => {
  initAutosave();
  loadCharacters({ all: {}, activeId: null });
  initWorld({ name: 'Original', startingLocation: { name: 'Start' } });
  const characterId = createCharacter({ name: 'Player' });
  setStoryId('story_one');
  initTree({
    narrativeText: 'Opening',
    activeCharacterId: characterId,
    locationId: getActiveLocation().id
  });
  await forceSave();

  updateWorld({ name: 'Updated before switch' });
  setStoryId('story_two');
  await forceSave();

  const saved = await loadStory('story_one');
  assert.equal(saved.world.name, 'Updated before switch');
  assert.equal(await loadStory('story_two'), null);
});
