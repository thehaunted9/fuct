/**
 * World and location state management.
 * Handles the story world, its locations, factions, and lore.
 */

import store from './store.js';
import { uid } from '../utils/uid.js';

store.init('world', {
  id: null,
  name: '',
  genre: 'fantasy',
  tone: 'adventurous',
  globalLore: '',
  factions: [],
  locations: {},        // { [id]: Location }
  activeLocationId: null
});

// ─── World ────────────────────────────────────────────────────────────────────

export function initWorld(data = {}) {
  const id = uid('world');
  const firstLocation = data.startingLocation ?? null;
  const locations = {};
  let activeLocationId = null;

  if (firstLocation) {
    const locId = uid('loc');
    locations[locId] = _locationDefaults(locId, firstLocation);
    activeLocationId = locId;
  }

  store.set('world', {
    id,
    name: data.name ?? 'Unnamed World',
    genre: data.genre ?? 'fantasy',
    tone: data.tone ?? 'adventurous',
    globalLore: data.globalLore ?? '',
    factions: data.factions ?? [],
    locations,
    activeLocationId
  });

  return id;
}

export function updateWorld(partial) {
  store.patch('world', partial);
}

export function getWorld() {
  return store.get('world');
}

export function loadWorld(data) {
  store.set('world', data);
}

// ─── Locations ────────────────────────────────────────────────────────────────

export function createLocation(data = {}) {
  const world = store.get('world');
  const id = data.id ?? uid('loc');
  const location = _locationDefaults(id, data);
  store.set('world', {
    ...world,
    locations: { ...world.locations, [id]: location },
    activeLocationId: world.activeLocationId ?? id
  });
  return id;
}

export function updateLocation(id, partial) {
  const world = store.get('world');
  const existing = world.locations[id];
  if (!existing) return;
  store.set('world', {
    ...world,
    locations: { ...world.locations, [id]: { ...existing, ...partial } }
  });
}

export function deleteLocation(id) {
  const world = store.get('world');
  const { [id]: _, ...rest } = world.locations;
  const newActive = world.activeLocationId === id
    ? (Object.keys(rest)[0] ?? null)
    : world.activeLocationId;
  store.set('world', { ...world, locations: rest, activeLocationId: newActive });
}

export function setActiveLocation(id) {
  const world = store.get('world');
  if (!world.locations[id]) return;
  store.set('world', { ...world, activeLocationId: id });
}

export function getActiveLocation() {
  const world = store.get('world');
  return world.locations[world.activeLocationId] ?? null;
}

export function getAllLocations() {
  return store.get('world').locations;
}

// ─── Lore entries (per location) ─────────────────────────────────────────────

export function addLoreEntry(locationId, entry) {
  const world = store.get('world');
  const loc = world.locations[locationId];
  if (!loc) return;
  const newEntry = { id: uid('lore'), title: entry.title ?? '', body: entry.body ?? '' };
  store.set('world', {
    ...world,
    locations: {
      ...world.locations,
      [locationId]: { ...loc, loreEntries: [...loc.loreEntries, newEntry] }
    }
  });
}

export function removeLoreEntry(locationId, entryId) {
  const world = store.get('world');
  const loc = world.locations[locationId];
  if (!loc) return;
  store.set('world', {
    ...world,
    locations: {
      ...world.locations,
      [locationId]: {
        ...loc,
        loreEntries: loc.loreEntries.filter(e => e.id !== entryId)
      }
    }
  });
}

// ─── Factions ─────────────────────────────────────────────────────────────────

export function addFaction(data) {
  const world = store.get('world');
  const faction = { id: uid('fac'), name: data.name ?? '', description: data.description ?? '', disposition: data.disposition ?? 'neutral' };
  store.set('world', { ...world, factions: [...world.factions, faction] });
}

export function updateFaction(id, partial) {
  const world = store.get('world');
  store.set('world', {
    ...world,
    factions: world.factions.map(f => f.id === id ? { ...f, ...partial } : f)
  });
}

export function removeFaction(id) {
  const world = store.get('world');
  store.set('world', { ...world, factions: world.factions.filter(f => f.id !== id) });
}

// ─── Private ──────────────────────────────────────────────────────────────────

function _locationDefaults(id, data) {
  return {
    id,
    name: data.name ?? 'Unnamed Location',
    description: data.description ?? '',
    weather: data.weather ?? '',
    ambientSoundtrack: data.ambientSoundtrack ?? '',
    imageUrl: data.imageUrl ?? '',
    localConflicts: data.localConflicts ?? [],
    connectedLocationIds: data.connectedLocationIds ?? [],
    loreEntries: data.loreEntries ?? []
  };
}
