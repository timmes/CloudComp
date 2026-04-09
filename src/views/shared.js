/**
 * @module views/shared
 *
 * Shared state and utilities used across all view modules.
 * Imports directly from core modules — no bridge, no window globals.
 */

import {
  getUsers, getUser, getTeams, getActivities, getConfig,
  upsertUser, upsertTeam, addActivity, deleteTeam as stateDeleteTeam,
  updateConfig, loadFromStorage, exportJSON, importJSON,
} from '../core/state.js';
import {
  calculateCoursePoints, calculateQuizBonus,
  calculateHackathonPoints, calculateMeetingPoints,
} from '../models/points.js';
import { importCourseFile } from '../importers/course-importer.js';
import { importTeamsFile } from '../importers/teams-importer.js';
import { deduplicateBatch } from '../importers/deduplication.js';

// Re-export everything view modules need
export {
  getUsers, getUser, getTeams, getActivities, getConfig,
  upsertUser, upsertTeam, addActivity, stateDeleteTeam,
  updateConfig, loadFromStorage, exportJSON, importJSON,
  calculateCoursePoints, calculateQuizBonus,
  calculateHackathonPoints, calculateMeetingPoints,
  importCourseFile, importTeamsFile, deduplicateBatch,
};

// ── UI-only state (not persisted) ───────────────────────────────────

export const selectedFiles = { course: [], teams: [] };

export const bulkSelection = {
  users: new Set(),
  activities: new Set(),
};

export const sortState = {
  users:      { field: 'currentMonthPoints', ascending: false },
  activities: { field: 'pointsEarned',       ascending: false },
  teams:      { field: 'currentMonthPoints', ascending: false },
};

// ── HTML escaping ───────────────────────────────────────────────────

/**
 * Escape a string for safe insertion into HTML.
 *
 * @param {*} value - coerced to string
 * @returns {string}
 */
export function esc(value) {
  const str = String(value ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Utility functions ───────────────────────────────────────────────

export function log(message) {
  const logElement = document.getElementById('importLog');
  if (logElement) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    logElement.innerHTML += `[${timestamp}] ${esc(message)}\n`;
    logElement.scrollTop = logElement.scrollHeight;
  }
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString();
}

export function formatNumber(num) {
  return num.toLocaleString();
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function updateDataStatus(type, message) {
  const statusElement = document.getElementById('dataStatus');
  const indicator = statusElement.querySelector('.status-indicator');
  indicator.className = `status-indicator status-${type}`;
  statusElement.querySelector('span').textContent = message;
}

// ── Derived point totals (cached) ───────────────────────────────────
//
// A single O(M) pass over activities builds a lookup of
// { totalPoints, currentMonthPoints } per user. The cache is
// invalidated on DATA_CHANGED and rebuilt lazily on next access.

import { EVENTS, on } from '../core/events.js';

/** @type {Map<string, { total: number, month: number }> | null} */
let _pointsCache = null;

on(EVENTS.DATA_CHANGED, () => { _pointsCache = null; });

function ensurePointsCache() {
  if (_pointsCache) return _pointsCache;

  const prefix = getCurrentMonth();
  const activities = getActivities();
  const cache = new Map();

  for (const a of activities) {
    const uid = a.userId || a.userEmail || '';
    const entry = cache.get(uid) || { total: 0, month: 0 };
    entry.total += a.pointsEarned;
    if (a.completedDate && a.completedDate.startsWith(prefix)) {
      entry.month += a.pointsEarned;
    }
    cache.set(uid, entry);
  }

  _pointsCache = cache;
  return cache;
}

/**
 * Total points for a user, derived from the activity log.
 * @param {string} email
 * @returns {number}
 */
export function getUserTotalPoints(email) {
  return ensurePointsCache().get(email)?.total ?? 0;
}

/**
 * Current month points for a user, derived from this month's activities.
 * @param {string} email
 * @returns {number}
 */
export function getUserMonthPoints(email) {
  return ensurePointsCache().get(email)?.month ?? 0;
}

/**
 * Get a user enriched with derived point totals.
 * @param {string} email
 * @returns {*|null}
 */
export function getUserWithPoints(email) {
  const user = getUser(email);
  if (!user) return null;
  const pts = ensurePointsCache().get(email) || { total: 0, month: 0 };
  return { ...user, totalPoints: pts.total, currentMonthPoints: pts.month };
}

/**
 * Get all users enriched with derived point totals.
 * @returns {Record<string, *>}
 */
export function getUsersWithPoints() {
  const users = getUsers();
  const cache = ensurePointsCache();
  const result = {};
  for (const [email, user] of Object.entries(users)) {
    const pts = cache.get(email) || { total: 0, month: 0 };
    result[email] = { ...user, totalPoints: pts.total, currentMonthPoints: pts.month };
  }
  return result;
}

export function autoSave() {
  updateConfig(getConfig());
  return true;
}

export function scrollToSection(event, sectionId) {
  event.preventDefault();
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
