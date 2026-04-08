/**
 * Right Sidebar — character sheet, world info, and lore codex.
 * Reactively updates when characters or world state changes.
 */

import store from '../state/store.js';
import bus from '../utils/events.js';
import { getActiveCharacter, getAllCharacters } from '../state/characters.js';
import { getWorld, getActiveLocation, getAllLocations } from '../state/world.js';

export function initSidebarRight() {
  store.subscribe('characters', () => _render());
  store.subscribe('world', () => _render());
  bus.on('sidebar:refresh', () => _render());
  bus.on('story:loaded', () => _render());
  _render();
}

function _render() {
  const container = document.getElementById('sidebar-right-inner');
  if (!container) return;
  container.innerHTML = _buildHTML();
  _attachListeners();
}

function _buildHTML() {
  const char = getActiveCharacter();
  const world = getWorld();
  const loc = getActiveLocation();
  const allChars = Object.values(getAllCharacters());

  return `
    ${_charCardHTML(char, allChars)}
    ${_worldCardHTML(world, loc)}
    ${_loreCardHTML(loc)}
  `;
}

function _charCardHTML(char, allChars) {
  if (!char) return `
    <div class="char-card">
      <div class="empty-state" style="padding:var(--sp-3)">
        <div>No character selected</div>
        <button class="btn btn-ghost mt-2" style="font-size:0.75rem" id="create-char-btn">+ Create Character</button>
      </div>
    </div>`;

  const npcs = allChars.filter(c => !c.isPlayer && c.id !== char.id);

  return `
    <div class="char-card">
      <div class="flex items-center" style="justify-content:space-between;margin-bottom:var(--sp-2)">
        <div>
          <div class="char-card-name">${_esc(char.name)}</div>
          <div class="char-card-role">${_esc(char.role || 'No role')}</div>
        </div>
        <button class="btn-icon" id="edit-char-btn" data-id="${char.id}" title="Edit character">✏️</button>
      </div>
      <div class="char-stat-row">
        ${char.currentState ? `
          <div>
            <div class="char-stat-label">State</div>
            <div class="char-stat-value">${_esc(_stateStr(char.currentState))}</div>
          </div>
        ` : ''}
        ${char.goals?.length ? `
          <div>
            <div class="char-stat-label">Goals</div>
            <div class="tag-list">${char.goals.map(g => `<span class="tag">${_esc(g)}</span>`).join('')}</div>
          </div>
        ` : ''}
        ${char.strengths?.length ? `
          <div>
            <div class="char-stat-label">Strengths</div>
            <div class="tag-list">${char.strengths.map(s => `<span class="tag" style="border-color:rgba(90,204,138,0.3);color:var(--mode-world)">${_esc(s)}</span>`).join('')}</div>
          </div>
        ` : ''}
        ${char.weaknesses?.length ? `
          <div>
            <div class="char-stat-label">Weaknesses</div>
            <div class="tag-list">${char.weaknesses.map(w => `<span class="tag" style="border-color:rgba(224,85,85,0.3);color:var(--danger)">${_esc(w)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>
    </div>

    ${npcs.length ? `
      <details class="accordion" style="margin-bottom:var(--sp-3)">
        <summary>NPCs (${npcs.length})</summary>
        <div class="accordion-body">
          ${npcs.map(npc => `
            <div style="padding:var(--sp-2) 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:0.82rem;font-weight:600">${_esc(npc.name)}</div>
                <div style="font-size:0.75rem;color:var(--text-muted)">${_esc(npc.role || 'NPC')}</div>
              </div>
              <button class="btn-icon edit-char-btn" data-id="${npc.id}" title="Edit">✏️</button>
            </div>
          `).join('')}
          <button class="btn btn-ghost w-full mt-2" id="create-char-btn" style="font-size:0.75rem">+ Add NPC</button>
        </div>
      </details>
    ` : `<button class="btn btn-ghost w-full" id="create-char-btn" style="font-size:0.75rem;margin-bottom:var(--sp-3)">+ Add NPC</button>`}
  `;
}

function _worldCardHTML(world, loc) {
  if (!world?.id) return '';
  return `
    <div class="world-card">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <div class="world-card-name">${_esc(world.name)}</div>
          <div class="world-card-meta">${_esc(world.genre)} · ${_esc(world.tone)}</div>
        </div>
        <button class="btn-icon" id="edit-world-btn" title="Edit world">✏️</button>
      </div>
      ${loc ? `
        <div style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border)">
          <div class="char-stat-label">Current Location</div>
          <div style="font-size:0.85rem;font-weight:600;color:var(--mode-world)">${_esc(loc.name)}</div>
          ${loc.weather ? `<div style="font-size:0.75rem;color:var(--text-muted)">${_esc(loc.weather)}</div>` : ''}
          ${loc.description ? `<div style="font-size:0.78rem;color:var(--text-secondary);margin-top:var(--sp-2)">${_esc(loc.description.slice(0, 120))}${loc.description.length > 120 ? '…' : ''}</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function _loreCardHTML(loc) {
  if (!loc?.loreEntries?.length) return '';
  return `
    <details class="accordion">
      <summary>Lore Codex (${loc.loreEntries.length})</summary>
      <div class="accordion-body">
        ${loc.loreEntries.map(e => `
          <div class="lore-entry">
            <div class="lore-title">${_esc(e.title)}</div>
            <div class="lore-body">${_esc(e.body)}</div>
          </div>
        `).join('')}
      </div>
    </details>
  `;
}

function _attachListeners() {
  document.getElementById('edit-char-btn')?.addEventListener('click', e => {
    bus.emit('char:edit', { id: e.currentTarget.dataset.id });
  });

  document.querySelectorAll('.edit-char-btn').forEach(btn => {
    btn.addEventListener('click', () => bus.emit('char:edit', { id: btn.dataset.id }));
  });

  document.getElementById('create-char-btn')?.addEventListener('click', () => {
    bus.emit('char:create');
  });

  document.getElementById('edit-world-btn')?.addEventListener('click', () => {
    bus.emit('world:edit');
  });
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function _stateStr(state) {
  return Object.entries(state ?? {}).map(([k, v]) => `${v}`).join(', ');
}
