import { uid } from '../utils/uid.js';
import { safeMediaUrl } from '../utils/urls.js';

export const STORY_SCHEMA_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const MAX_NODES = 5000;
const MAX_CHARACTERS = 200;
const MAX_LOCATIONS = 500;
const MAX_ARCS = 100;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/** Validate and normalize a persisted story before it reaches application state. */
export function validateStoryBundle(input, { regenerateStoryId = false } = {}) {
  assertRecord(input, 'Story bundle');

  const schemaVersion = input.schemaVersion ?? STORY_SCHEMA_VERSION;
  if (schemaVersion !== STORY_SCHEMA_VERSION) {
    throw new Error(`Unsupported story schema version: ${schemaVersion}`);
  }

  const tree = normalizeTree(input.tree);
  const characters = normalizeCharacters(input.characters);
  const world = normalizeWorld(input.world);

  return {
    schemaVersion: STORY_SCHEMA_VERSION,
    id: regenerateStoryId ? uid('story') : requireId(input.id, 'Story id'),
    title: readString(input.title ?? world.name, 'Story title', 500),
    createdAt: readTimestamp(input.createdAt, 'createdAt'),
    updatedAt: readTimestamp(input.updatedAt, 'updatedAt'),
    tree,
    characters,
    world
  };
}

export function parseStoryJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    throw new Error('The selected file is not valid JSON.');
  }
  return validateStoryBundle(parsed, { regenerateStoryId: true });
}

function normalizeTree(value) {
  assertRecord(value, 'Story tree');
  assertRecord(value.nodes, 'Story tree nodes');
  assertRecord(value.arcs, 'Story arcs');

  const nodeEntries = Object.entries(value.nodes);
  if (nodeEntries.length === 0 || nodeEntries.length > MAX_NODES) {
    throw new Error(`Story tree must contain between 1 and ${MAX_NODES} nodes.`);
  }

  const nodes = {};
  for (const [key, rawNode] of nodeEntries) {
    requireId(key, 'Node key');
    assertRecord(rawNode, `Node ${key}`);
    const id = requireId(rawNode.id, `Node ${key} id`);
    if (id !== key) throw new Error(`Node key ${key} does not match its id.`);

    nodes[id] = {
      id,
      parentId: optionalId(rawNode.parentId, `Node ${id} parentId`),
      childIds: readIdArray(rawNode.childIds, `Node ${id} childIds`, 500),
      createdAt: readTimestamp(rawNode.createdAt, `Node ${id} createdAt`),
      isCheckpoint: Boolean(rawNode.isCheckpoint),
      label: readString(rawNode.label ?? '', `Node ${id} label`, 500),
      narrativeText: readString(rawNode.narrativeText ?? '', `Node ${id} narrativeText`, 250000),
      deltaText: readString(rawNode.deltaText ?? '', `Node ${id} deltaText`, 250000),
      actorId: readString(rawNode.actorId ?? 'narrator', `Node ${id} actorId`, 128),
      userInput: readString(rawNode.userInput ?? '', `Node ${id} userInput`, 20000),
      sessionSnapshot: normalizeSnapshot(rawNode.sessionSnapshot)
    };
  }

  const rootId = requireId(value.rootId, 'Story rootId');
  const activeNodeId = requireId(value.activeNodeId, 'Story activeNodeId');
  if (!nodes[rootId] || !nodes[activeNodeId]) throw new Error('Story root or active node is missing.');
  if (nodes[rootId].parentId !== null) throw new Error('The main story root cannot have a parent.');

  for (const node of Object.values(nodes)) {
    if (node.parentId && !nodes[node.parentId]) {
      throw new Error(`Node ${node.id} references a missing parent.`);
    }
    for (const childId of node.childIds) {
      const child = nodes[childId];
      if (!child) throw new Error(`Node ${node.id} references a missing child.`);
      if (child.parentId !== node.id) throw new Error(`Node ${childId} has inconsistent parent linkage.`);
    }
    if (node.parentId && !nodes[node.parentId].childIds.includes(node.id)) {
      throw new Error(`Node ${node.id} is missing from its parent's children.`);
    }
    assertAcyclicParentChain(node.id, nodes);
  }

  const arcEntries = Object.entries(value.arcs);
  if (arcEntries.length === 0 || arcEntries.length > MAX_ARCS) {
    throw new Error(`Story must contain between 1 and ${MAX_ARCS} arcs.`);
  }

  const arcs = {};
  const nodeOwners = new Map();
  for (const [arcId, rawArc] of arcEntries) {
    requireId(arcId, 'Arc id');
    assertRecord(rawArc, `Arc ${arcId}`);
    const nodeIds = readIdArray(rawArc.nodeIds, `Arc ${arcId} nodeIds`, MAX_NODES);
    if (nodeIds.length === 0) throw new Error(`Arc ${arcId} has no nodes.`);
    nodeIds.forEach(nodeId => {
      if (!nodes[nodeId]) throw new Error(`Arc ${arcId} references a missing node.`);
      const owner = nodeOwners.get(nodeId);
      if (owner && owner !== arcId) throw new Error(`Node ${nodeId} belongs to multiple arcs.`);
      nodeOwners.set(nodeId, arcId);
    });
    const arcActiveNodeId = requireId(rawArc.activeNodeId, `Arc ${arcId} activeNodeId`);
    if (!nodeIds.includes(arcActiveNodeId)) throw new Error(`Arc ${arcId} has an invalid active node.`);
    arcs[arcId] = {
      name: readString(rawArc.name ?? 'Untitled Arc', `Arc ${arcId} name`, 500),
      nodeIds,
      activeNodeId: arcActiveNodeId
    };
  }

  if (nodeOwners.size !== Object.keys(nodes).length) throw new Error('Every story node must belong to an arc.');

  const activeArcId = requireId(value.activeArcId, 'Story activeArcId');
  if (!arcs[activeArcId]) throw new Error('The active story arc is missing.');
  if (!arcs[activeArcId].nodeIds.includes(activeNodeId)) {
    throw new Error('The active node does not belong to the active arc.');
  }

  const checkpointIds = readIdArray(value.checkpointIds ?? [], 'checkpointIds', MAX_NODES);
  checkpointIds.forEach(id => {
    if (!nodes[id]) throw new Error(`Checkpoint ${id} references a missing node.`);
  });

  return { rootId, nodes, activeNodeId, checkpointIds, arcs, activeArcId };
}

function normalizeCharacters(value) {
  assertRecord(value, 'Characters');
  assertRecord(value.all, 'Character collection');
  const entries = Object.entries(value.all);
  if (entries.length > MAX_CHARACTERS) throw new Error(`A story can contain at most ${MAX_CHARACTERS} characters.`);

  const all = {};
  for (const [key, raw] of entries) {
    requireId(key, 'Character key');
    assertRecord(raw, `Character ${key}`);
    const id = requireId(raw.id, `Character ${key} id`);
    if (id !== key) throw new Error(`Character key ${key} does not match its id.`);
    const state = raw.currentState ?? {};
    assertRecord(state, `Character ${id} state`);
    all[id] = {
      id,
      name: readString(raw.name ?? 'Unnamed Character', `Character ${id} name`, 500),
      isPlayer: raw.isPlayer !== false,
      role: readString(raw.role ?? '', `Character ${id} role`, 500),
      backstory: readString(raw.backstory ?? '', `Character ${id} backstory`, 50000),
      strengths: readStringArray(raw.strengths ?? [], `Character ${id} strengths`, 200),
      weaknesses: readStringArray(raw.weaknesses ?? [], `Character ${id} weaknesses`, 200),
      goals: readStringArray(raw.goals ?? [], `Character ${id} goals`, 200),
      relationships: normalizeStringRecord(raw.relationships ?? {}, `Character ${id} relationships`),
      appearance: readString(raw.appearance ?? '', `Character ${id} appearance`, 20000),
      voiceTone: readString(raw.voiceTone ?? '', `Character ${id} voiceTone`, 1000),
      currentState: {
        mood: readString(state.mood ?? 'neutral', `Character ${id} mood`, 500),
        health: readString(state.health ?? 'healthy', `Character ${id} health`, 500)
      },
      ttsProfile: normalizeTTSProfile(raw.ttsProfile)
    };
  }

  const activeId = optionalId(value.activeId, 'Active character id');
  if (activeId && !all[activeId]) throw new Error('The active character is missing.');
  return { all, activeId };
}

function normalizeWorld(value) {
  assertRecord(value, 'World');
  assertRecord(value.locations, 'World locations');
  const id = requireId(value.id, 'World id');
  const locationEntries = Object.entries(value.locations);
  if (locationEntries.length > MAX_LOCATIONS) throw new Error(`A story can contain at most ${MAX_LOCATIONS} locations.`);

  const locations = {};
  for (const [key, raw] of locationEntries) {
    requireId(key, 'Location key');
    assertRecord(raw, `Location ${key}`);
    const locationId = requireId(raw.id, `Location ${key} id`);
    if (locationId !== key) throw new Error(`Location key ${key} does not match its id.`);
    const imageUrl = validateMediaUrl(raw.imageUrl ?? '', `Location ${key} image URL`);
    const ambientSoundtrack = validateMediaUrl(raw.ambientSoundtrack ?? '', `Location ${key} soundtrack URL`);
    locations[locationId] = {
      id: locationId,
      name: readString(raw.name ?? 'Unnamed Location', `Location ${key} name`, 500),
      description: readString(raw.description ?? '', `Location ${key} description`, 50000),
      weather: readString(raw.weather ?? '', `Location ${key} weather`, 1000),
      ambientSoundtrack,
      imageUrl,
      localConflicts: readStringArray(raw.localConflicts ?? [], `Location ${key} conflicts`, 500),
      connectedLocationIds: readIdArray(raw.connectedLocationIds ?? [], `Location ${key} connections`, MAX_LOCATIONS),
      loreEntries: normalizeLoreEntries(raw.loreEntries ?? [], locationId)
    };
  }

  for (const location of Object.values(locations)) {
    location.connectedLocationIds.forEach(connectedId => {
      if (!locations[connectedId]) throw new Error(`Location ${location.id} references a missing connection.`);
    });
  }

  const activeLocationId = optionalId(value.activeLocationId, 'Active location id');
  if (activeLocationId && !locations[activeLocationId]) throw new Error('The active location is missing.');

  const factions = Array.isArray(value.factions) ? value.factions : fail('World factions must be an array.');
  if (factions.length > 500) throw new Error('A story can contain at most 500 factions.');

  return {
    id,
    name: readString(value.name ?? 'Unnamed World', 'World name', 500),
    genre: readString(value.genre ?? 'fantasy', 'World genre', 500),
    tone: readString(value.tone ?? 'adventurous', 'World tone', 500),
    globalLore: readString(value.globalLore ?? '', 'World lore', 100000),
    factions: factions.map((raw, index) => {
      assertRecord(raw, `Faction ${index}`);
      return {
        id: requireId(raw.id, `Faction ${index} id`),
        name: readString(raw.name ?? '', `Faction ${index} name`, 500),
        description: readString(raw.description ?? '', `Faction ${index} description`, 20000),
        disposition: readString(raw.disposition ?? 'neutral', `Faction ${index} disposition`, 100)
      };
    }),
    locations,
    activeLocationId
  };
}

function normalizeSnapshot(value = {}) {
  assertRecord(value, 'Node session snapshot');
  return {
    activeCharacterId: optionalId(value.activeCharacterId, 'Snapshot character id'),
    locationId: optionalId(value.locationId, 'Snapshot location id'),
    activeArcId: optionalId(value.activeArcId, 'Snapshot arc id')
  };
}

function normalizeLoreEntries(value, locationId) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error(`Location ${locationId} has invalid lore entries.`);
  return value.map((raw, index) => {
    assertRecord(raw, `Lore entry ${index}`);
    return {
      id: requireId(raw.id, `Lore entry ${index} id`),
      title: readString(raw.title ?? '', `Lore entry ${index} title`, 500),
      body: readString(raw.body ?? '', `Lore entry ${index} body`, 20000)
    };
  });
}

function normalizeTTSProfile(value = {}) {
  assertRecord(value, 'TTS profile');
  return {
    voiceURI: readString(value.voiceURI ?? '', 'TTS voice', 1000),
    rate: readNumber(value.rate ?? 1, 'TTS rate', 0.5, 2),
    pitch: readNumber(value.pitch ?? 1, 'TTS pitch', 0, 2),
    volume: readNumber(value.volume ?? 1, 'TTS volume', 0, 1)
  };
}

function normalizeStringRecord(value, label) {
  assertRecord(value, label);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[readString(key, `${label} key`, 500)] = readString(String(item ?? ''), `${label} value`, 5000);
  }
  return result;
}

function assertAcyclicParentChain(startId, nodes) {
  const seen = new Set();
  let current = startId;
  while (current) {
    if (seen.has(current)) throw new Error(`Story tree contains a cycle at node ${current}.`);
    seen.add(current);
    current = nodes[current]?.parentId ?? null;
  }
}

function readStringArray(value, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must be an array with at most ${maxItems} items.`);
  return value.map((item, index) => readString(item, `${label}[${index}]`, 20000));
}

function readIdArray(value, label, maxItems) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must be an array with at most ${maxItems} items.`);
  const ids = value.map((item, index) => requireId(item, `${label}[${index}]`));
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate ids.`);
  return ids;
}

function readString(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(`${label} must be text.`);
  if (value.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return value;
}

function readNumber(value, label, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}

function readTimestamp(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a valid timestamp.`);
  return value;
}

function requireId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new Error(`${label} contains unsupported characters.`);
  }
  return value;
}

function optionalId(value, label) {
  return value === null || value === undefined || value === '' ? null : requireId(value, label);
}

function validateMediaUrl(value, label) {
  if (!value) return '';
  const validated = safeMediaUrl(value);
  if (!validated) throw new Error(`${label} must use http, https, blob, or a relative path.`);
  return validated;
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

function fail(message) {
  throw new Error(message);
}
