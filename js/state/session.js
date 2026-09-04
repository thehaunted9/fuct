/**
 * Volatile session state — not persisted between page loads.
 * Tracks current mode, streaming state, and UI context.
 */

import store from './store.js';

const persistedApiKey = localStorage.getItem('grok_api_key') ?? '';

store.init('session', {
  mode: 'character',          // 'character' | 'narrator' | 'worldbuilder'
  isStreaming: false,
  streamAbortController: null,
  pendingBranchFromNodeId: null,
  apiKey: sessionStorage.getItem('grok_api_key') ?? persistedApiKey,
  rememberApiKey: Boolean(persistedApiKey),
  model: localStorage.getItem('grok_model') ?? 'grok-4',
  storyId: null,              // IndexedDB record id for current story
  initialized: false          // true after new-story wizard completes
});

export function setMode(mode) {
  store.patch('session', { mode });
}

export function getMode() {
  return store.get('session').mode;
}

export function setStreaming(isStreaming, abortController = null) {
  store.patch('session', { isStreaming, streamAbortController: abortController });
}

export function abortStream() {
  const { streamAbortController } = store.get('session');
  if (streamAbortController) {
    streamAbortController.abort();
  }
}

export function setPendingBranch(nodeId) {
  store.patch('session', { pendingBranchFromNodeId: nodeId });
}

export function clearPendingBranch() {
  store.patch('session', { pendingBranchFromNodeId: null });
}

export function setApiKey(key, remember = false) {
  sessionStorage.setItem('grok_api_key', key);
  if (remember) localStorage.setItem('grok_api_key', key);
  else localStorage.removeItem('grok_api_key');
  store.patch('session', { apiKey: key, rememberApiKey: remember });
}

export function setModel(model) {
  localStorage.setItem('grok_model', model);
  store.patch('session', { model });
}

export function setStoryId(id) {
  store.patch('session', { storyId: id });
}

export function setInitialized(value) {
  store.patch('session', { initialized: value });
}

export function getSession() {
  return store.get('session');
}
