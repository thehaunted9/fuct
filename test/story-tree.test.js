import test from 'node:test';
import assert from 'node:assert/strict';
import store from '../js/state/store.js';
import { createCharacter, getActiveCharacter, loadCharacters, setActiveCharacter } from '../js/state/characters.js';
import { createLocation, getActiveLocation, initWorld, setActiveLocation } from '../js/state/world.js';
import {
  appendNode, createArc, getAncestry, getHistoryMessages, getTree, initTree, navigateTo
} from '../js/state/story-tree.js';

function initializeStory() {
  loadCharacters({ all: {}, activeId: null });
  initWorld({ name: 'World', startingLocation: { name: 'Start' } });
  const charId = createCharacter({ name: 'Player' });
  setActiveCharacter(charId);
  const locationId = getActiveLocation().id;
  initTree({ narrativeText: 'The opening scene.', activeCharacterId: charId, locationId });
  return { charId, locationId };
}

test('includes opening narration in later model history', () => {
  initializeStory();
  const nodeId = appendNode({
    userInput: 'Open the door',
    narrativeText: 'The door opens.',
    deltaText: 'The door opens.',
    actorId: 'narrator',
    sessionSnapshot: {}
  });
  assert.deepEqual(getHistoryMessages(nodeId), [
    { role: 'assistant', content: 'The opening scene.' },
    { role: 'user', content: 'Open the door' },
    { role: 'assistant', content: 'The door opens.' }
  ]);
});

test('rewind restores the node character and location context', () => {
  const first = initializeStory();
  const secondCharacterId = createCharacter({ name: 'Second' });
  const secondLocationId = createLocation({ name: 'Elsewhere' });
  setActiveCharacter(secondCharacterId);
  setActiveLocation(secondLocationId);

  const nodeId = appendNode({
    userInput: 'Continue',
    narrativeText: 'Elsewhere.',
    deltaText: 'Elsewhere.',
    actorId: secondCharacterId,
    sessionSnapshot: {
      activeCharacterId: secondCharacterId,
      locationId: secondLocationId,
      activeArcId: 'arc_main'
    }
  });

  setActiveCharacter(first.charId);
  setActiveLocation(first.locationId);
  navigateTo(nodeId);
  assert.equal(getActiveCharacter().id, secondCharacterId);
  assert.equal(getActiveLocation().id, secondLocationId);
});

test('parallel arcs carry their own id in the root snapshot', () => {
  initializeStory();
  const arcId = createArc('Elsewhere');
  const tree = getTree();
  assert.equal(tree.activeArcId, arcId);
  assert.equal(tree.nodes[tree.activeNodeId].sessionSnapshot.activeArcId, arcId);
});

test('a completed stream stays attached to its originating branch', () => {
  initializeStory();
  const origin = getTree().activeNodeId;
  const otherArcId = createArc('Meanwhile');
  const otherArcNodeId = getTree().activeNodeId;

  const generatedNodeId = appendNode({
    userInput: 'Keep going',
    narrativeText: 'Generated for the main branch.',
    deltaText: 'Generated for the main branch.',
    actorId: 'narrator',
    sessionSnapshot: { activeArcId: 'arc_main' },
    arcId: 'arc_main',
    parentId: origin
  });

  const tree = getTree();
  assert.equal(tree.nodes[generatedNodeId].parentId, origin);
  assert.ok(tree.arcs.arc_main.nodeIds.includes(generatedNodeId));
  assert.equal(tree.activeArcId, otherArcId);
  assert.equal(tree.activeNodeId, otherArcNodeId);
});

test('ancestry traversal fails safely on a corrupt cycle', () => {
  initializeStory();
  const tree = getTree();
  const root = tree.nodes[tree.rootId];
  store.set('tree', {
    ...tree,
    nodes: { ...tree.nodes, [root.id]: { ...root, parentId: root.id } }
  });
  assert.throws(() => getAncestry(root.id), /cycle/i);
});
