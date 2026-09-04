import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoryJSON, validateStoryBundle } from '../js/persistence/story-schema.js';
import { makeStoryBundle } from '../test-support/fixtures.js';

test('validates a complete story bundle', () => {
  const validated = validateStoryBundle(makeStoryBundle());
  assert.equal(validated.id, 'story_test');
  assert.equal(validated.tree.rootId, 'node_root');
});

test('imports under a new id to avoid overwriting an existing story', () => {
  const imported = parseStoryJSON(JSON.stringify(makeStoryBundle()));
  assert.match(imported.id, /^story_[a-z0-9]+$/);
  assert.notEqual(imported.id, 'story_test');
});

test('rejects cyclic story trees', () => {
  const bundle = makeStoryBundle();
  bundle.tree.nodes.node_root.parentId = 'node_root';
  bundle.tree.nodes.node_root.childIds = ['node_root'];
  assert.throws(() => validateStoryBundle(bundle), /root cannot have a parent|cycle/i);
});

test('rejects unsafe media protocols', () => {
  const bundle = makeStoryBundle();
  bundle.world.locations.loc_start.imageUrl = 'javascript:alert(1)';
  assert.throws(() => validateStoryBundle(bundle), /image URL/i);
});

test('rejects malformed JSON with a useful error', () => {
  assert.throws(() => parseStoryJSON('{broken'), /not valid JSON/i);
});
