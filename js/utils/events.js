/**
 * Global event bus — decouples UI modules from state modules.
 * Usage:
 *   import bus from './events.js';
 *   bus.on('story:token', handler);
 *   bus.emit('story:token', { text: '...' });
 *   bus.off('story:token', handler);
 */
const listeners = new Map();

const bus = {
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
  },
  off(event, fn) {
    listeners.get(event)?.delete(fn);
  },
  emit(event, data) {
    listeners.get(event)?.forEach(fn => fn(data));
  }
};

export default bus;
