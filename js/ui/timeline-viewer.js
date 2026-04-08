/**
 * Timeline Viewer — SVG branch graph of the story tree.
 * Clickable nodes for navigation / rewind.
 */

import bus from '../utils/events.js';
import store from '../state/store.js';
import { getTree, navigateTo } from '../state/story-tree.js';

const NODE_R = 10;
const NODE_SPACING_X = 80;
const NODE_SPACING_Y = 50;

export function initTimelineViewer() {
  const dialog = document.getElementById('timeline-dialog');
  if (!dialog) return;

  dialog.querySelector('.modal-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  bus.on('timeline:open', () => {
    _render();
    dialog.showModal();
  });

  store.subscribe('tree', () => {
    if (dialog.open) _render();
  });
}

function _render() {
  const svg = document.getElementById('timeline-svg');
  if (!svg) return;

  const tree = getTree();
  if (!tree?.rootId) {
    svg.innerHTML = '<text x="20" y="40" fill="var(--text-muted)" font-size="12">No story nodes yet.</text>';
    return;
  }

  // Layout: assign x,y positions via BFS
  const positions = {};
  const queue = [{ id: tree.rootId, col: 0, row: 0 }];
  const colCounters = {}; // track row usage per col depth

  while (queue.length > 0) {
    const { id, col, row } = queue.shift();
    positions[id] = {
      x: col * NODE_SPACING_X + NODE_R + 20,
      y: row * NODE_SPACING_Y + NODE_R + 20
    };
    const node = tree.nodes[id];
    if (!node) continue;
    node.childIds?.forEach((childId, i) => {
      const childRow = (colCounters[col + 1] ?? row) + (i > 0 ? i : 0);
      colCounters[col + 1] = childRow + 1;
      queue.push({ id: childId, col: col + 1, row: childRow });
    });
  }

  // Compute SVG dimensions
  const allX = Object.values(positions).map(p => p.x);
  const allY = Object.values(positions).map(p => p.y);
  const width = Math.max(...allX) + NODE_R + 40;
  const height = Math.max(...allY) + NODE_R + 40;

  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  let edgesHTML = '';
  let nodesHTML = '';

  Object.entries(tree.nodes).forEach(([id, node]) => {
    const pos = positions[id];
    if (!pos) return;

    // Edges to children
    node.childIds?.forEach(childId => {
      const cpos = positions[childId];
      if (!cpos) return;
      edgesHTML += `<path class="tl-edge" d="M${pos.x},${pos.y} C${pos.x + NODE_SPACING_X / 2},${pos.y} ${cpos.x - NODE_SPACING_X / 2},${cpos.y} ${cpos.x},${cpos.y}"/>`;
    });

    // Node circle
    const isActive = id === tree.activeNodeId;
    const isCheckpoint = node.isCheckpoint;
    const label = (node.label ?? '').slice(0, 12);

    nodesHTML += `
      <g class="tl-node${isActive ? ' active' : ''}${isCheckpoint ? ' checkpoint' : ''}" data-node="${id}">
        <circle cx="${pos.x}" cy="${pos.y}" r="${NODE_R}"/>
        <text class="tl-label" x="${pos.x}" y="${pos.y + NODE_R + 12}">${_esc(label)}</text>
      </g>`;
  });

  svg.innerHTML = edgesHTML + nodesHTML;

  // Attach click listeners
  svg.querySelectorAll('.tl-node[data-node]').forEach(el => {
    el.addEventListener('click', () => {
      const nodeId = el.dataset.node;
      navigateTo(nodeId);
      document.getElementById('timeline-dialog')?.close();
      bus.emit('toast', { message: 'Rewound to selected node.', type: 'success' });
      bus.emit('sidebar:refresh');
    });
  });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function timelineDialogHTML() {
  return `
<dialog id="timeline-dialog" aria-label="Story Timeline" style="max-width:90vw;width:auto">
  <div class="modal-header">
    <span class="modal-title">Story Timeline</span>
    <button class="modal-close" aria-label="Close">✕</button>
  </div>
  <div class="modal-body" style="padding:var(--sp-3)">
    <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--sp-3)">
      Click any node to rewind to that point. Orange = current, blue ring = checkpoint.
    </p>
    <div id="timeline-container">
      <svg id="timeline-svg" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  </div>
</dialog>`;
}
