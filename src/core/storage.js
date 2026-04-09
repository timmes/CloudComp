/**
 * @module storage
 *
 * The only module that may call `localStorage` directly.
 * Every other module reads/writes storage through these functions.
 *
 * Values are JSON-serialised automatically on save and parsed on load.
 * A quota guard prevents writes that would exceed 4 MB, returning
 * `false` instead of throwing or corrupting existing data.
 */

// ── Quota constants ─────────────────────────────────────────────────

/** Maximum bytes we allow before refusing a write. */
const QUOTA_LIMIT_BYTES = 4 * 1024 * 1024; // 4 MB

// ── Quota-warning hook ──────────────────────────────────────────────
//
// storage.js is extracted before events.js (Step 2 before Step 3).
// Rather than import a module that doesn't exist yet, we expose a
// setter that events.js will call once it initialises.  Until then
// the warning is a no-op — no data is lost either way because save()
// returns false on quota breach.

/** @type {((payload: { key: string, usedKB: number }) => void) | null} */
let _onQuotaWarning = null;

/**
 * Register the callback that fires when a save would exceed the
 * quota limit.  Intended to be called once by `events.js` to wire
 * up `emit(EVENTS.STORAGE_QUOTA_WARNING, payload)`.
 *
 * @param {(payload: { key: string, usedKB: number }) => void} handler
 * @returns {void}
 *
 * @example
 * setQuotaWarningHandler(({ key, usedKB }) => console.warn(key, usedKB))
 */
export function setQuotaWarningHandler(handler) {
  _onQuotaWarning = handler;
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Return the total number of bytes currently stored in localStorage.
 * Each char in a DOMString is 2 bytes (UTF-16).
 *
 * @returns {number} bytes
 */
function totalStoredBytes() {
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    bytes += key.length * 2;
    bytes += localStorage.getItem(key).length * 2;
  }
  return bytes;
}

/**
 * Check whether localStorage is available at all.
 * Safari private-browsing and some iframe sandboxes disable it.
 *
 * @returns {boolean}
 */
function isLocalStorageAvailable() {
  const testKey = '__storage_test__';
  try {
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Load a value from localStorage.
 *
 * Returns the parsed JSON value, or `fallback` if the key does not
 * exist, localStorage is unavailable, or the stored value is not
 * valid JSON.  Never throws.
 *
 * @param {string} key
 * @param {*} [fallback=null]
 * @returns {*}
 *
 * @example
 * load('cloudCompData')            // parsed object or null
 * @example
 * load('missing', { empty: true }) // { empty: true }
 */
export function load(key, fallback = null) {
  try {
    if (!isLocalStorageAvailable()) return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Save a value to localStorage (JSON-serialised).
 *
 * Returns `true` on success.
 * Returns `false` without writing if:
 *   - the serialised payload would push total usage past 4 MB
 *   - localStorage is unavailable
 *   - the browser throws a QuotaExceededError
 *
 * Existing data under `key` is never corrupted — the old value
 * is only overwritten after the quota check passes.
 *
 * @param {string} key
 * @param {*} value - must be JSON-serialisable
 * @returns {boolean}
 *
 * @example
 * save('cloudCompData', { users: {} }) // true
 * @example
 * save('huge', massiveObject)          // false if over 4 MB
 */
export function save(key, value) {
  try {
    if (!isLocalStorageAvailable()) return false;

    const serialised = JSON.stringify(value);
    const newValueBytes = serialised.length * 2;
    const newKeyBytes = key.length * 2;

    // Subtract the current size of this key (if it exists) so we
    // measure the *net* increase, not the absolute size.
    const existingRaw = localStorage.getItem(key);
    const existingBytes = existingRaw !== null
      ? (key.length * 2) + (existingRaw.length * 2)
      : 0;

    const currentTotal = totalStoredBytes();
    const projected = currentTotal - existingBytes + newKeyBytes + newValueBytes;

    if (projected > QUOTA_LIMIT_BYTES) {
      const usedKB = Math.round(projected / 1024);
      if (_onQuotaWarning) {
        _onQuotaWarning({ key, usedKB });
      }
      return false;
    }

    localStorage.setItem(key, serialised);
    return true;
  } catch {
    // QuotaExceededError or SecurityError — never throw, never corrupt.
    return false;
  }
}

/**
 * Remove a key from localStorage.
 *
 * No-op if the key does not exist or localStorage is unavailable.
 * Never throws.
 *
 * @param {string} key
 *
 * @example
 * remove('cloudCompData')
 */
export function remove(key) {
  try {
    if (!isLocalStorageAvailable()) return;
    localStorage.removeItem(key);
  } catch {
    // Swallow — nothing to recover.
  }
}

/**
 * Return the total localStorage usage in kilobytes.
 *
 * Returns `0` if localStorage is unavailable.
 *
 * @returns {number} KB (rounded to nearest integer)
 *
 * @example
 * getQuotaUsedKB() // e.g. 312
 */
export function getQuotaUsedKB() {
  try {
    if (!isLocalStorageAvailable()) return 0;
    return Math.round(totalStoredBytes() / 1024);
  } catch {
    return 0;
  }
}
