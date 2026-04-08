/**
 * IndexedDB wrapper for story persistence.
 * Stories are stored as JSON blobs under the 'stories' object store.
 */

const DB_NAME = 'storybuilder';
const DB_VERSION = 1;
const STORE = 'stories';

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = e => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = e => reject(e.target.error);
  });
}

/**
 * Save (upsert) a story bundle.
 * @param {object} bundle  Must have an `id` field.
 */
export async function saveStory(bundle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bundle);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

/**
 * Load a story bundle by id.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function loadStory(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = e => reject(e.target.error);
  });
}

/**
 * Return all story summaries (id, title, updatedAt) without full tree data.
 * @returns {Promise<Array<{id, title, updatedAt}>>}
 */
export async function listStories() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      const summaries = req.result.map(({ id, title, createdAt, updatedAt }) => ({
        id, title, createdAt, updatedAt
      }));
      // Sort newest first
      summaries.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      resolve(summaries);
    };
    req.onerror = e => reject(e.target.error);
  });
}

/**
 * Delete a story by id.
 * @param {string} id
 */
export async function deleteStory(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}
