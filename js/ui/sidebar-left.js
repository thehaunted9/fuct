/**
 * Left Sidebar — arc tabs, branch tree, and location switcher.
 */

import store from '../state/store.js';
import bus from '../utils/events.js';
import { getTree, navigateTo, switchArc, createArc, getAncestry } from '../state/story-tree.js';
import { getAllLocations, setActiveLocation, getWorld } from '../state/world.js';
import { getSession } from '../state/session.js';
import { buildTransitionPrompt } from '../api/prompts.js';
import { getActiveCharacter } from '../state/characters.js';

export function initSidebarLeft() {
  store.subscribe('tree', () => _render());
  store.subscribe('world', () => _render());
  bus.on('sidebar:refresh', () => _render());
  bus.on('story:loaded', () => _render());
  bus.on('arc:create:confirmed', ({ name }) => _createNewArc(name));
  bus.on('timeline:open', () => _openTimeline());
  _render();
}

function _render() {
  _renderArcTabs();
  _renderBranchTree();
  _renderLocations();
}

// ─── Arc Tabs ─────────────────────────────────────────────────────────────────

function _renderArcTabs() {
  const container = document.getElementById('arc-tabs');
  if (!container) return;

  const tree = getTree();
  if (!tree?.arcs) { container.innerHTML = ''; return; }

  container.innerHTML = Object.entries(tree.arcs).map(([arcId, arc]) => `
    <div class="arc-tab${arcId === tree.activeArcId ? ' active' : ''}" data-arc="${arcId}">
      ${_esc(arc.name)}
    </div>
  `).join('') + `<div class="arc-tab" id="add-arc-tab" title="New parallel storyline">+</div>`;

  container.querySelectorAll('.arc-tab[data-arc]').forEach(tab => {
    tab.addEventListener('click', () => {
      switchArc(tab.dataset.arc);
      bus.emit('sidebar:refresh');
    });
  });

  document.getElementById('add-arc-tab')?.addEventListener('click', () => {
    bus.emit('arc:create');
  });
}

// ─── Branch Tree ──────────────────────────────────────────────────────────────

function _renderBranchTree() {
  const container = document.getElementById('branch-tree');
  if (!container) return;

  const tree = getTree();
  if (!tree?.rootId) {
    container.innerHTML = '<div class="empty-state" style="padding:var(--sp-4)">No story yet. Start a new story.</div>';
    return;
  }

  const arc = tree.arcs[tree.activeArcId];
  if (!arc) { container.innerHTML = ''; return; }

  // Build a list of nodes from root to all descendants in this arc
  const nodeIds = arc.nodeIds ?? [];
  const nodes = nodeIds.map(id => tree.nodes[id]).filter(Boolean);

  if (nodes.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:var(--sp-4)">Arc is empty.</div>';
    return;
  }

  container.innerHTML = nodes.map(node => {
    const depth = _getDepth(tree, node.id);
    const isActive = node.id === tree.activeNodeId;
    return `
      <div class="branch-node${isActive ? ' active' : ''}${node.isCheckpoint ? ' checkpoint' : ''}"
           data-node="${node.id}"
           style="--depth:${Math.min(depth, 4)}">
        <span style="font-size:0.7rem;color:var(--text-muted)">${node.isCheckpoint ? '⚑' : '•'}</span>
        <span class="truncate">${_esc(node.label || 'Story beat')}</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.branch-node[data-node]').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.node);
    });
  });
}

function _getDepth(tree, nodeId) {
  let depth = 0;
  let current = nodeId;
  while (current) {
    const node = tree.nodes[current];
    if (!node || !node.parentId) break;
    depth++;
    current = node.parentId;
  }
  return depth;
}

// ─── Location Switcher ────────────────────────────────────────────────────────

function _renderLocations() {
  const container = document.getElementById('location-list');
  if (!container) return;

  const world = getWorld();
  const locations = getAllLocations();
  const locArray = Object.values(locations);

  if (locArray.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:var(--sp-2) var(--sp-4);font-size:0.78rem">No locations yet</div>';
    return;
  }

  container.innerHTML = locArray.map(loc => `
    <div class="location-item${loc.id === world?.activeLocationId ? ' active' : ''}" data-loc="${loc.id}">
      <span class="loc-icon">📍</span>
      <span class="truncate">${_esc(loc.name)}</span>
    </div>
  `).join('');

  container.querySelectorAll('.location-item[data-loc]').forEach(el => {
    el.addEventListener('click', () => {
      const locId = el.dataset.loc;
      const currentWorld = getWorld();
      if (locId === currentWorld?.activeLocationId) return;

      const fromLoc = Object.values(getAllLocations()).find(l => l.id === currentWorld?.activeLocationId);
      const toLoc = Object.values(getAllLocations()).find(l => l.id === locId);

      setActiveLocation(locId);
      _renderLocations();

      // Generate transition narration
      bus.emit('story:transition', { fromLocationName: fromLoc?.name ?? 'here', toLocation: toLoc });
    });
  });
}

// ─── New Arc ──────────────────────────────────────────────────────────────────

function _createNewArc(name) {
  const char = getActiveCharacter();
  const world = getWorld();
  createArc(name, {
    activeCharacterId: char?.id ?? null,
    locationId: world?.activeLocationId ?? null,
    activeArcId: null
  });
  bus.emit('toast', { message: `Arc "${name}" created. Switch to it using the tabs above.`, type: 'success' });
  _render();
}

// ─── Timeline Modal ────────────────────────────────────────────────────────────

function _openTimeline() {
  const dialog = document.getElementById('timeline-dialog');
  if (dialog) dialog.showModal();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
