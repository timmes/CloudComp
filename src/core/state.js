/**
 * @module state
 *
 * Single source of truth for all application data.  Replaces the
 * monolith's global `appData` variable.
 *
 * - **Reads** return shallow copies so callers cannot mutate state.
 * - **Writes** mutate `_state`, persist to storage, and emit
 *   {@link EVENTS.DATA_CHANGED} so views can react.
 * - **Lifecycle** functions handle serialisation round-trips.
 *
 * No other module should access `localStorage` or hold its own
 * copy of canonical data.
 */

import { load, save } from './storage.js';
import { EVENTS, emit } from './events.js';
import { DEFAULT_POINT_CONFIG } from '../models/points.js';

// ── Types ───────────────────────────────────────────────────────────

/**
 * @typedef {import('../models/points.js').PointConfig} PointConfig
 */

/**
 * @typedef {Object} AppConfig
 * @property {PointConfig} pointConfig
 * @property {string}      lastReset  - 'YYYY-MM'
 * @property {string}      version
 */

/**
 * @typedef {Object} Metadata
 * @property {string|null} lastImport
 * @property {number}      totalRecordsProcessed
 * @property {string[]}    sources
 */

/**
 * @typedef {Object} ActivityFilters
 * @property {string} [userId]     - lowercase email
 * @property {string} [type]       - 'course'|'meeting'|'quiz'|'hackathon'|'manual'
 * @property {string} [status]     - 'completed'|'in_progress'|'enrolled'
 * @property {string} [fromDate]   - ISO 8601, inclusive
 * @property {string} [toDate]     - ISO 8601, inclusive
 * @property {string} [campaignId] - scopes to campaign window + participants
 */

// ── Constants ───────────────────────────────────────────────────────

const STORAGE_KEY = 'cloudCompData';

/** @returns {AppConfig} */
function defaultConfig() {
  return {
    pointConfig: { ...DEFAULT_POINT_CONFIG },
    lastReset: new Date().toISOString().slice(0, 7),
    version: '2.0',
  };
}

/** Migrate old v1.x point config to v2.0 structure. */
function migrateConfig(config) {
  if (!config?.version || config.version < '2.0') {
    return { ...config, pointConfig: { ...DEFAULT_POINT_CONFIG }, version: '2.0' };
  }
  return config;
}

// ── Internal state ──────────────────────────────────────────────────

/** @type {{ users: Record<string,*>, teams: Record<string,*>, activities: *[], campaigns: Record<string,*>, config: AppConfig, metadata: Metadata }} */
let _state = emptyState();

/** @returns {typeof _state} */
function emptyState() {
  return {
    users:      {},
    teams:      {},
    activities: [],
    campaigns:  {},
    config:     defaultConfig(),
    metadata: {
      lastImport: null,
      totalRecordsProcessed: 0,
      sources: [],
    },
  };
}

// ── Persistence helpers ─────────────────────────────────────────────

/**
 * Persist current state to storage and emit DATA_CHANGED.
 * Called by every write function.
 */
function persistAndNotify() {
  save(STORAGE_KEY, {
    ..._state,
    metadata: { ..._state.metadata, lastSaved: new Date().toISOString() },
  });
  emit(EVENTS.DATA_CHANGED);
}

// ── Reads ───────────────────────────────────────────────────────────

/**
 * Return all users as a plain object (shallow copy).
 *
 * @returns {Record<string, *>}
 *
 * @example
 * const users = getUsers();
 * Object.values(users).forEach(u => console.log(u.name));
 */
export function getUsers() {
  return { ..._state.users };
}

/**
 * Return a single user by lowercase email, or `null`.
 *
 * @param {string} email
 * @returns {*|null}
 *
 * @example
 * getUser('alice@example.com') // user object or null
 */
export function getUser(email) {
  const user = _state.users[email?.toLowerCase()];
  return user ? { ...user } : null;
}

/**
 * Return all teams as a plain object (shallow copy).
 *
 * @returns {Record<string, *>}
 *
 * @example
 * const teams = getTeams();
 */
export function getTeams() {
  return { ..._state.teams };
}

/**
 * Return activities, optionally filtered.
 *
 * Supported filters (all optional, combined with AND):
 * - `userId`    — match `activity.userId`
 * - `type`      — match `activity.type`
 * - `fromDate`  — `completedDate >= fromDate` (ISO string compare)
 * - `toDate`    — `completedDate <= toDate`
 * - `campaignId`— resolves campaign window + participants, then filters
 *
 * Returns a new array — never the internal reference.
 *
 * @param {ActivityFilters} [filters={}]
 * @returns {*[]}
 *
 * @example
 * getActivities() // all
 * @example
 * getActivities({ userId: 'a@b.com', fromDate: '2026-01-01' })
 */
export function getActivities(filters = {}) {
  let result = _state.activities;

  if (filters.campaignId) {
    result = applyCampaignFilter(result, filters.campaignId);
  }
  if (filters.userId) {
    const uid = filters.userId.toLowerCase();
    result = result.filter(a => a.userId === uid);
  }
  if (filters.type) {
    result = result.filter(a => a.type === filters.type);
  }
  if (filters.status) {
    result = result.filter(a => (a.status || 'completed') === filters.status);
  }
  if (filters.fromDate) {
    result = result.filter(
      a => a.completedDate && a.completedDate >= filters.fromDate,
    );
  }
  if (filters.toDate) {
    result = result.filter(
      a => a.completedDate && a.completedDate <= filters.toDate,
    );
  }

  // Return a copy so callers can't mutate internal state
  return result === _state.activities ? [...result] : result;
}

/**
 * Apply campaign-scoped filtering: restrict to activities within
 * the campaign's date window from its participants.
 *
 * @param {*[]} activities
 * @param {string} campaignId
 * @returns {*[]}
 */
function applyCampaignFilter(activities, campaignId) {
  const campaign = _state.campaigns[campaignId];
  if (!campaign) return [];

  const participantSet = resolveCampaignParticipants(campaign);
  return activities.filter(a => {
    if (!participantSet.has(a.userId)) return false;
    if (!a.completedDate) return false;
    if (a.completedDate < campaign.startDate) return false;
    if (campaign.endDate && a.completedDate > campaign.endDate) return false;
    return true;
  });
}

/**
 * Resolve the full set of participant user IDs for a campaign,
 * including members of linked teams.
 *
 * @param {*} campaign
 * @returns {Set<string>}
 */
function resolveCampaignParticipants(campaign) {
  const ids = new Set(campaign.participantIds ?? []);
  for (const teamId of campaign.teamIds ?? []) {
    const team = _state.teams[teamId];
    if (team) {
      for (const memberId of team.memberIds ?? []) {
        ids.add(memberId);
      }
    }
  }
  return ids;
}

/**
 * Return all campaigns as a plain object (shallow copy).
 *
 * @returns {Record<string, *>}
 *
 * @example
 * const campaigns = getCampaigns();
 */
export function getCampaigns() {
  return { ..._state.campaigns };
}

/**
 * Return a single campaign by id, or `null`.
 *
 * @param {string} id
 * @returns {*|null}
 *
 * @example
 * getCampaign('camp_123') // campaign object or null
 */
export function getCampaign(id) {
  const campaign = _state.campaigns[id];
  return campaign ? { ...campaign } : null;
}

/**
 * Return the current app config (shallow copy).
 *
 * @returns {AppConfig}
 *
 * @example
 * const cfg = getConfig();
 */
export function getConfig() {
  return { ..._state.config };
}

// ── Writes ──────────────────────────────────────────────────────────

/**
 * Create or update a user.  Keyed by lowercase `user.email`.
 * Merges with the existing user record if one exists.
 *
 * @param {*} user - must have an `email` property
 * @returns {void}
 *
 * @example
 * upsertUser({ email: 'alice@example.com', name: 'Alice', totalPoints: 0 })
 */
export function upsertUser(user) {
  const key = user.email.toLowerCase();
  const existing = _state.users[key];
  _state.users[key] = existing ? { ...existing, ...user, email: key } : { ...user, email: key };
  persistAndNotify();
}

/**
 * Create or update a team.  Keyed by `team.id`.
 * Merges with the existing team record if one exists.
 *
 * @param {*} team - must have an `id` property
 * @returns {void}
 *
 * @example
 * upsertTeam({ id: 'team_1', name: 'Alpha', color: 'blue', memberIds: [] })
 */
export function upsertTeam(team) {
  const existing = _state.teams[team.id];
  _state.teams[team.id] = existing ? { ...existing, ...team } : { ...team };
  persistAndNotify();
}

/**
 * Append an activity to the activities list.
 *
 * @param {*} activity
 * @returns {void}
 *
 * @example
 * addActivity({ id: 'a1', userId: 'a@b.com', pointsEarned: 50, ... })
 */
export function addActivity(activity) {
  _state.activities = [..._state.activities, { ...activity }];
  persistAndNotify();
}

/**
 * Replace an existing activity by matching on `id`.
 * Used for status upgrades (e.g. in_progress -> completed).
 *
 * @param {*} activity - must have an `id` property
 * @returns {boolean} true if replaced, false if not found
 */
export function replaceActivity(activity) {
  const idx = _state.activities.findIndex(a => a.id === activity.id);
  if (idx === -1) return false;
  _state.activities = [
    ..._state.activities.slice(0, idx),
    { ...activity },
    ..._state.activities.slice(idx + 1),
  ];
  persistAndNotify();
  return true;
}

/**
 * Create or update a campaign.  Keyed by `campaign.id`.
 * Merges with the existing campaign record if one exists.
 * Emits {@link EVENTS.CAMPAIGN_UPDATED} in addition to DATA_CHANGED.
 *
 * @param {*} campaign - must have an `id` property
 * @returns {void}
 *
 * @example
 * upsertCampaign({ id: 'c1', name: 'Q1 Push', startDate: '2026-01-01' })
 */
export function upsertCampaign(campaign) {
  const existing = _state.campaigns[campaign.id];
  _state.campaigns[campaign.id] = existing
    ? { ...existing, ...campaign }
    : { ...campaign };
  persistAndNotify();
  emit(EVENTS.CAMPAIGN_UPDATED, { id: campaign.id });
}

/**
 * Remove a team by id.
 * No-op if the team does not exist.
 * Does not remove members from users — callers should handle that.
 *
 * @param {string} id
 * @returns {void}
 *
 * @example
 * deleteTeam('team_1')
 */
export function deleteTeam(id) {
  if (!_state.teams[id]) return;
  const { [id]: _, ...rest } = _state.teams;
  _state.teams = rest;
  persistAndNotify();
}

/**
 * Remove a campaign by id.
 * No-op if the campaign does not exist.
 * Does not delete associated activities or users.
 *
 * @param {string} id
 * @returns {void}
 *
 * @example
 * deleteCampaign('c1')
 */
export function deleteCampaign(id) {
  if (!_state.campaigns[id]) return;
  const { [id]: _, ...rest } = _state.campaigns;
  _state.campaigns = rest;
  persistAndNotify();
}

/**
 * Merge a partial config into the current config.
 *
 * @param {Partial<AppConfig>} partial
 * @returns {void}
 *
 * @example
 * updateConfig({ lastReset: '2026-04' })
 */
export function updateConfig(partial) {
  _state.config = { ..._state.config, ...partial };
  persistAndNotify();
}

// ── Migration ──────────────────────────────────────────────────────

/** Backfill status field on legacy activities that lack it. */
function migrateActivities(activities) {
  return activities.map(a => a.status ? a : { ...a, status: 'completed' });
}

// ── Lifecycle ───────────────────────────────────────────────────────

/**
 * Load state from localStorage.  If nothing is stored or the data
 * is corrupt, state resets to empty defaults.  Never throws.
 *
 * @returns {void}
 *
 * @example
 * loadFromStorage() // call once at app startup
 */
export function loadFromStorage() {
  const data = load(STORAGE_KEY, null);
  if (!data) {
    _state = emptyState();
    return;
  }
  _state = {
    users:      data.users      ?? {},
    teams:      data.teams      ?? {},
    activities: migrateActivities(data.activities ?? []),
    campaigns:  data.campaigns  ?? {},
    config:     migrateConfig(data.config
      ? { ...defaultConfig(), ...data.config }
      : defaultConfig()),
    metadata:   data.metadata
      ? { lastImport: null, totalRecordsProcessed: 0, sources: [], ...data.metadata }
      : { lastImport: null, totalRecordsProcessed: 0, sources: [] },
  };
}

/**
 * Return the full state as a plain JSON-safe object for file export.
 * Includes an `exportedDate` timestamp in metadata.
 *
 * @returns {*}
 *
 * @example
 * const json = exportJSON();
 * downloadFile(JSON.stringify(json), 'backup.json');
 */
export function exportJSON() {
  return {
    users:      { ..._state.users },
    teams:      { ..._state.teams },
    activities: [..._state.activities],
    campaigns:  { ..._state.campaigns },
    config:     { ..._state.config },
    metadata: {
      ..._state.metadata,
      exportedDate: new Date().toISOString(),
    },
  };
}

/**
 * Replace the entire state with data from a previously exported
 * JSON object.  Persists immediately and emits DATA_CHANGED.
 *
 * @param {*} json - object with `users`, `activities`, etc.
 * @returns {void}
 *
 * @example
 * importJSON(parsedBackup)
 */
export function importJSON(json) {
  _state = {
    users:      json.users      ?? {},
    teams:      json.teams      ?? {},
    activities: migrateActivities(json.activities ?? []),
    campaigns:  json.campaigns  ?? {},
    config:     migrateConfig(json.config
      ? { ...defaultConfig(), ...json.config }
      : defaultConfig()),
    metadata:   json.metadata
      ? { lastImport: null, totalRecordsProcessed: 0, sources: [], ...json.metadata }
      : { lastImport: null, totalRecordsProcessed: 0, sources: [] },
  };
  persistAndNotify();
}

// ── Testing helper ──────────────────────────────────────────────────

/**
 * Reset state to empty defaults without persisting.
 * **Only for use in tests.**
 *
 * @returns {void}
 *
 * @example
 * _resetForTesting() // in beforeEach
 */
export function _resetForTesting() {
  _state = emptyState();
}
