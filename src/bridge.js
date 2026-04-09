/**
 * @module bridge
 *
 * Compatibility layer that exposes a `window.appData` object with
 * the same Map-based API the monolith UI code expects, but backed
 * by state.js under the hood.
 *
 * This lets the ~90 UI functions continue using `appData.users.get(email)`
 * while all reads/writes flow through the extracted modules.
 *
 * This file is transitional — once the UI is fully refactored to
 * import from state.js directly, this bridge can be deleted.
 */

import {
  getUsers, getUser, getTeams, getActivities, getConfig,
  upsertUser, upsertTeam, addActivity,
  updateConfig, loadFromStorage, exportJSON, importJSON,
  deleteTeam,
} from './core/state.js';

// ── MapShim ─────────────────────────────────────────────────────────

/**
 * A Map-like wrapper that delegates reads to state.js getters
 * and writes to state.js upsert functions.
 */
class MapShim {
  /** @param {() => Record<string,*>} getter @param {(v: *) => void} upsertFn @param {string} idField @param {((key: string) => void)|null} deleteFn */
  constructor(getter, upsertFn, idField, deleteFn = null) {
    this._getter = getter;
    this._upsert = upsertFn;
    this._idField = idField;
    this._delete = deleteFn;
  }

  get(key) {
    return this._getter()[key] ?? undefined;
  }

  has(key) {
    return key in this._getter();
  }

  set(key, value) {
    this._upsert({ ...value, [this._idField]: key });
    return this;
  }

  delete(key) {
    if (this._delete) {
      this._delete(key);
      return true;
    }
    return false;
  }

  get size() {
    return Object.keys(this._getter()).length;
  }

  values() {
    return Object.values(this._getter())[Symbol.iterator]();
  }

  keys() {
    return Object.keys(this._getter())[Symbol.iterator]();
  }

  entries() {
    return Object.entries(this._getter())[Symbol.iterator]();
  }

  forEach(callback) {
    const data = this._getter();
    for (const [key, value] of Object.entries(data)) {
      callback(value, key, this);
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

// ── Activities proxy ────────────────────────────────────────────────

/**
 * Build an array-like proxy for appData.activities that reads from
 * state.js but also supports .push() and .splice() for the remaining
 * monolith mutation code.
 *
 * We store a mutable local cache that syncs from state.js on read
 * and pushes through addActivity on write.
 */
let _activitiesCache = [];
let _activitiesDirty = true;

function getActivitiesProxy() {
  if (_activitiesDirty) {
    _activitiesCache = getActivities();
    _activitiesDirty = false;
  }
  return _activitiesCache;
}

function markActivitiesDirty() {
  _activitiesDirty = true;
}

// state.js emits DATA_CHANGED on every write — use it to invalidate cache
import { EVENTS, on } from './core/events.js';
on(EVENTS.DATA_CHANGED, markActivitiesDirty);

// ── appData ─────────────────────────────────────────────────────────

const usersShim = new MapShim(getUsers, upsertUser, 'email', null);
const teamsShim = new MapShim(getTeams, upsertTeam, 'id', deleteTeam);

// ── Mutable config reference ────────────────────────────────────────
// The monolith mutates appData.config.pointConfig deeply (e.g.
// appData.config.pointConfig.awsCourseTypes['AWS Builder Lab'] = 100).
// We keep a live mutable reference that syncs from state.js on load
// and writes back on saveConfiguration/autoSave.

let _configRef = getConfig();
on(EVENTS.DATA_CHANGED, () => { _configRef = getConfig(); });

/**
 * The compatibility appData object.
 * Reads delegate to state.js; writes go through upsert/addActivity.
 */
const appData = {
  get users() { return usersShim; },
  get teams() { return teamsShim; },

  get activities() { return getActivitiesProxy(); },
  set activities(_val) { /* ignore bulk assignment — handled by importJSON */ },

  // inProgressActivities not yet in state.js — keep a local array
  inProgressActivities: [],

  get config() { return _configRef; },
  set config(val) { _configRef = val; updateConfig(val); },

  get metadata() { return { lastImport: null, totalRecordsProcessed: 0, sources: [] }; },
  set metadata(_val) { /* stored via state.js config, not separately */ },
};

// ── Patched global functions ────────────────────────────────────────

/**
 * Push an activity both to the local cache (for immediate UI reads)
 * and to state.js (for persistence).
 */
const originalPush = Array.prototype.push;
Object.defineProperty(appData, 'activities', {
  get() {
    const arr = getActivitiesProxy();
    // Patch push on every access — the array is recreated on cache invalidation
    arr.push = function (...items) {
      const result = originalPush.apply(this, items);
      for (const item of items) {
        addActivity(item);
      }
      return result;
    };
    arr.splice = function (start, deleteCount) {
      // Monolith only uses splice for deletion (inProgress removal).
      // Since activities in state.js don't support splice, we just
      // do it on the local array. The next DATA_CHANGED will refresh.
      return Array.prototype.splice.call(this, start, deleteCount);
    };
    arr.find = Array.prototype.find;
    arr.findIndex = Array.prototype.findIndex;
    arr.filter = Array.prototype.filter;
    arr.some = Array.prototype.some;
    arr.sort = Array.prototype.sort;
    arr.map = Array.prototype.map;
    arr.forEach = Array.prototype.forEach;
    return arr;
  },
  set(_val) { /* ignore */ },
  configurable: true,
});

// ── Replace global functions ────────────────────────────────────────

window.appData = appData;

// Expose state.js lifecycle functions for monolith-ui.js
window.__stateAPI = { loadFromStorage, exportJSON, importJSON, updateConfig };

// Expose points.js functions for monolith-ui.js
import {
  calculateCoursePoints,
  calculateQuizBonus,
  calculateHackathonPoints,
  calculateMeetingPoints,
} from './models/points.js';

window.__pointsAPI = {
  calculateCoursePoints,
  calculateQuizBonus,
  calculateHackathonPoints,
  calculateMeetingPoints,
};

// Expose importers for monolith-ui.js
import { importCourseFile } from './importers/course-importer.js';
import { importTeamsFile } from './importers/teams-importer.js';
import { deduplicateBatch } from './importers/deduplication.js';

window.__importAPI = { importCourseFile, importTeamsFile, deduplicateBatch };
