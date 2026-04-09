/**
 * @module events
 *
 * Minimal pub/sub event bus.  Views subscribe with {@link on};
 * models publish with {@link emit}.  This is the only coupling
 * point between the two layers.
 *
 * Always use the {@link EVENTS} constants as event names — never
 * raw strings.
 */

import { setQuotaWarningHandler } from './storage.js';

// ── Event constants ─────────────────────────────────────────────────

/**
 * Canonical event names.  Every call to {@link on}, {@link off}, or
 * {@link emit} must use one of these constants.
 *
 * @readonly
 * @enum {string}
 */
export const EVENTS = Object.freeze({
  DATA_CHANGED:          'data:changed',
  IMPORT_COMPLETE:       'import:complete',
  IMPORT_PROGRESS:       'import:progress',
  POINTS_AWARDED:        'points:awarded',
  BADGE_AWARDED:         'badge:awarded',
  CAMPAIGN_UPDATED:      'campaign:updated',
  STORAGE_QUOTA_WARNING: 'storage:quotaWarning',
});

// ── Internal registry ───────────────────────────────────────────────

/** @type {Map<string, Set<Function>>} */
const _listeners = new Map();

// ── Public API ──────────────────────────────────────────────────────

/**
 * Subscribe to an event.
 *
 * The same handler can only be registered once per event — duplicate
 * calls are no-ops (Set semantics).
 *
 * @param {string} event - one of {@link EVENTS}
 * @param {Function} handler - called with the payload when the event fires
 * @returns {void}
 *
 * @example
 * on(EVENTS.DATA_CHANGED, (payload) => refreshDashboard(payload))
 */
export function on(event, handler) {
  if (!_listeners.has(event)) {
    _listeners.set(event, new Set());
  }
  _listeners.get(event).add(handler);
}

/**
 * Unsubscribe from an event.
 *
 * No-op if the handler was not registered.
 *
 * @param {string} event - one of {@link EVENTS}
 * @param {Function} handler - the exact function reference passed to {@link on}
 * @returns {void}
 *
 * @example
 * off(EVENTS.DATA_CHANGED, refreshDashboard)
 */
export function off(event, handler) {
  const set = _listeners.get(event);
  if (set) {
    set.delete(handler);
  }
}

/**
 * Emit an event, calling all registered handlers synchronously
 * in registration order.
 *
 * If a handler throws, the error is caught so remaining handlers
 * still execute.  The error is re-thrown after all handlers run
 * if exactly one threw; if multiple threw, only the last is thrown.
 *
 * @param {string} event - one of {@link EVENTS}
 * @param {*} [payload] - arbitrary data passed to each handler
 * @returns {void}
 *
 * @example
 * emit(EVENTS.POINTS_AWARDED, { userId: 'a@b.com', points: 50 })
 * @example
 * emit(EVENTS.DATA_CHANGED)
 */
export function emit(event, payload) {
  const set = _listeners.get(event);
  if (!set || set.size === 0) return;

  let lastError = null;
  for (const handler of set) {
    try {
      handler(payload);
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
}

// ── Wire storage quota warning ──────────────────────────────────────
//
// storage.js exposes a callback hook because it was extracted before
// this module (Step 2 before Step 3).  Now that events.js exists we
// connect the two: quota breaches emit STORAGE_QUOTA_WARNING.

setQuotaWarningHandler((payload) => {
  emit(EVENTS.STORAGE_QUOTA_WARNING, payload);
});
