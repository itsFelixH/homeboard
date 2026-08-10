/**
 * Shared State module - server-side persistence synced across devices
 *
 * Replaces localStorage for data that should be shared (plants, packages, countdown names).
 * State is stored in data/state.json on the server.
 *
 * Usage:
 *   const val = await State.get('plants_last');
 *   await State.set('plants_last', '2026-08-10T12:00:00Z');
 *   await State.set('packages', [...]);
 */
const State = (() => {
  let _cache = null; // in-memory cache of full state

  /** Fetch full state from server (cached after first call) */
  async function _load() {
    if (_cache !== null) return _cache;
    try {
      const res = await fetch('/state');
      if (res.ok) {
        _cache = await res.json();
      } else {
        _cache = {};
      }
    } catch (e) {
      console.warn('[State] Failed to load shared state, using empty:', e);
      _cache = {};
    }
    return _cache;
  }

  /** Get a value by key (async) */
  async function get(key) {
    const state = await _load();
    return state[key] !== undefined ? state[key] : null;
  }

  /** Set a value by key (persists to server immediately) */
  async function set(key, value) {
    const state = await _load();
    state[key] = value;
    try {
      await fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
    } catch (e) {
      console.error('[State] Failed to save shared state:', e);
    }
  }

  /** Remove a key */
  async function remove(key) {
    const state = await _load();
    delete state[key];
    try {
      await fetch('/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: null })
      });
    } catch (e) {
      console.error('[State] Failed to remove from shared state:', e);
    }
  }

  /** Force reload from server (e.g. after another device updates) */
  function invalidate() {
    _cache = null;
  }

  return { get, set, remove, invalidate };
})();
