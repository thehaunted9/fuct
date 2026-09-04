/**
 * Central reactive state store.
 * Simple pub/sub: subscribers are notified when a slice changes.
 *
 * Usage:
 *   import store from './store.js';
 *   store.subscribe('session', handler);
 *   store.set('session', { ...store.get('session'), mode: 'narrator' });
 *   store.get('session');
 */

const state = {};
const subs = new Map(); // key → Set<fn>

const store = {
  /**
   * Initialize a slice with a default value (idempotent).
   * @param {string} key
   * @param {*} defaultValue
   */
  init(key, defaultValue) {
    if (!(key in state)) state[key] = defaultValue;
    if (!subs.has(key)) subs.set(key, new Set());
  },

  get(key) {
    return state[key];
  },

  set(key, value) {
    state[key] = value;
    subs.get(key)?.forEach(fn => fn(value));
  },

  /** Merge an object into the current slice value (shallow). */
  patch(key, partial) {
    const current = state[key] ?? {};
    this.set(key, { ...current, ...partial });
  },

  subscribe(key, fn) {
    if (!subs.has(key)) subs.set(key, new Set());
    subs.get(key).add(fn);
    return () => subs.get(key).delete(fn); // returns unsubscribe fn
  }
};

export default store;
