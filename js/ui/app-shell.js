/**
 * App Shell — wires up top nav, sidebar toggles, and coordinates between panels.
 */

import bus from '../utils/events.js';
import store from '../state/store.js';
import { getSession } from '../state/session.js';
import { getWorld, getActiveLocation } from '../state/world.js';
import { getActiveCharacter } from '../state/characters.js';
import { getTree, switchArc } from '../state/story-tree.js';
import { exportStoryJSON, importStoryJSON } from '../persistence/autosave.js';
import { listStories, deleteStory } from '../persistence/db.js';

export function initAppShell() {
  _initSidebarToggles();
  _initNavActions();
  _initTitleEditing();
  _initToastSystem();
  _initImportExport();
  _initLibrary();
  _subscribeToStateUpdates();
}

// ─── Sidebar Toggles ─────────────────────────────────────────────────────────

function _initSidebarToggles() {
  document.getElementById('toggle-left')?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar-left');
    sb?.classList.toggle('collapsed');
  });

  document.getElementById('toggle-right')?.addEventListener('click', () => {
    const sb = document.getElementById('sidebar-right');
    sb?.classList.toggle('collapsed');
  });
}

// ─── Nav Actions ──────────────────────────────────────────────────────────────

function _initNavActions() {
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    bus.emit('settings:open');
  });

  document.getElementById('new-story-btn')?.addEventListener('click', () => {
    bus.emit('wizard:open');
  });
}

// ─── Story Title Editing ──────────────────────────────────────────────────────

function _initTitleEditing() {
  const title = document.getElementById('story-title');
  if (!title) return;

  title.setAttribute('contenteditable', 'true');
  title.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); title.blur(); }
  });
  title.addEventListener('blur', () => {
    const newName = title.textContent.trim();
    if (newName) {
      const world = getWorld();
      if (world) {
        store.patch('world', { name: newName });
        _updateBreadcrumb();
      }
    }
  });
}

// ─── Breadcrumb Updates ───────────────────────────────────────────────────────

function _subscribeToStateUpdates() {
  store.subscribe('world', () => _updateBreadcrumb());
  store.subscribe('tree', () => _updateBreadcrumb());
  store.subscribe('characters', () => {});

  // Arc creation event
  bus.on('arc:create', () => _promptNewArc());
  bus.on('sidebar:refresh', () => {});
}

function _updateBreadcrumb() {
  const crumb = document.getElementById('nav-breadcrumb');
  const title = document.getElementById('story-title');
  const world = getWorld();
  const loc = getActiveLocation();
  const tree = getTree();
  const arc = tree?.arcs?.[tree?.activeArcId];

  if (title && world?.name) title.textContent = world.name;

  if (crumb) {
    const parts = [];
    if (arc?.name) parts.push(`Arc: ${arc.name}`);
    if (loc?.name) parts.push(`Location: ${loc.name}`);
    crumb.textContent = parts.join('  ·  ');
  }
}

// ─── Toast Notification System ────────────────────────────────────────────────

function _initToastSystem() {
  bus.on('toast', ({ message, type = 'info' }) => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  });
}

// ─── Export / Import ─────────────────────────────────────────────────────────

function _initImportExport() {
  document.getElementById('export-story-btn')?.addEventListener('click', () => {
    try {
      exportStoryJSON();
      bus.emit('toast', { message: 'Story exported!', type: 'success' });
    } catch (e) {
      bus.emit('toast', { message: `Export failed: ${e.message}`, type: 'error' });
    }
  });

  document.getElementById('import-story-input')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importStoryJSON(file);
      bus.emit('toast', { message: 'Story imported successfully!', type: 'success' });
      bus.emit('story:loaded');
    } catch (err) {
      bus.emit('toast', { message: `Import failed: ${err.message}`, type: 'error' });
    }
    e.target.value = '';
  });
}

// ─── Story Library ────────────────────────────────────────────────────────────

function _initLibrary() {
  document.getElementById('open-library-btn')?.addEventListener('click', async () => {
    await _showLibrary();
  });
}

async function _showLibrary() {
  const dialog = document.getElementById('library-dialog');
  if (!dialog) return;

  const list = await listStories();
  const listEl = dialog.querySelector('#story-list');
  if (!listEl) return;

  if (list.length === 0) {
    listEl.innerHTML = '<div class="empty-state"><div class="icon">📖</div>No saved stories yet.</div>';
  } else {
    listEl.innerHTML = list.map(s => `
      <div class="story-list-item" data-id="${s.id}">
        <div>
          <div class="story-list-name">${_esc(s.title ?? 'Untitled')}</div>
          <div class="story-list-date">${_formatDate(s.updatedAt)}</div>
        </div>
        <div class="story-list-actions">
          <button class="btn btn-ghost load-story-btn" data-id="${s.id}">Load</button>
          <button class="btn btn-danger delete-story-btn" data-id="${s.id}">Delete</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.load-story-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        bus.emit('story:load', { storyId: btn.dataset.id });
        dialog.close();
      });
    });

    listEl.querySelectorAll('.delete-story-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (confirm('Delete this story?')) {
          await deleteStory(btn.dataset.id);
          btn.closest('.story-list-item')?.remove();
          bus.emit('toast', { message: 'Story deleted.', type: 'success' });
        }
      });
    });
  }

  dialog.showModal();
}

// ─── New Arc prompt ───────────────────────────────────────────────────────────

function _promptNewArc() {
  const name = prompt('Name for the new parallel storyline:');
  if (!name?.trim()) return;
  // Emit so sidebar-left and main engine can respond
  bus.emit('arc:create:confirmed', { name: name.trim() });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function _formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
