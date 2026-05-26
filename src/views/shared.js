/**
 * @module views/shared
 *
 * Shared state and utilities used across all view modules.
 * Imports directly from core modules — no bridge, no window globals.
 */

import {
  getUsers, getUser, getTeams, getActivities, getConfig,
  upsertUser, upsertTeam, addActivity, replaceActivity,
  addActivities, replaceActivities, upsertUsers,
  deleteTeam as stateDeleteTeam, deleteCampaign as stateDeleteCampaign,
  getCampaigns, getCampaign, upsertCampaign,
  updateConfig, loadFromStorage, exportJSON, importJSON,
  getImportHistory, getExportHistory,
  addImportHistoryEntry, addExportHistoryEntry,
} from '../core/state.js';
import { calculateActivityPoints } from '../models/points.js';
import { importCourseFile } from '../importers/course-importer.js';
import { importTeamsFile } from '../importers/teams-importer.js';
import { deduplicateBatch } from '../importers/deduplication.js';

// Re-export everything view modules need
export {
  getUsers, getUser, getTeams, getActivities, getConfig,
  upsertUser, upsertTeam, addActivity, replaceActivity, stateDeleteTeam,
  addActivities, replaceActivities, upsertUsers,
  getCampaigns, getCampaign, upsertCampaign, stateDeleteCampaign,
  updateConfig, loadFromStorage, exportJSON, importJSON,
  getImportHistory, getExportHistory,
  addImportHistoryEntry, addExportHistoryEntry,
  calculateActivityPoints,
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
  campaigns:  { field: 'startDate',         ascending: false },
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

/** @returns {{ start: string, end: string }} ISO date boundaries for current quarter */
export function getCurrentQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
  return { start, end };
}

/** @returns {string} Current year as 4-digit string */
export function getCurrentYearPrefix() {
  return String(new Date().getFullYear());
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  // Pre-2000 dates are treated as bogus — typically an Excel serial number
  // mis-read as ms-since-epoch by a legacy import path. Showing '—' surfaces
  // the issue instead of misleading the user with '1/1/1970'.
  if (d.getFullYear() < 2000) return '—';
  return d.toLocaleDateString();
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

/** @type {Map<string, { total: number, month: number, quarter: number, year: number }> | null} */
let _pointsCache = null;

on(EVENTS.DATA_CHANGED, () => { _pointsCache = null; });

function ensurePointsCache() {
  if (_pointsCache) return _pointsCache;

  const monthPrefix = getCurrentMonth();
  const { start: qStart, end: qEnd } = getCurrentQuarterRange();
  const yearPrefix = getCurrentYearPrefix();
  const activities = getActivities();
  const cache = new Map();

  for (const a of activities) {
    if (a.status && a.status !== 'completed') continue;
    const uid = a.userId || a.userEmail || '';
    const entry = cache.get(uid) || { total: 0, month: 0, quarter: 0, year: 0 };
    entry.total += a.pointsEarned;
    if (a.completedDate) {
      if (a.completedDate.startsWith(monthPrefix)) entry.month += a.pointsEarned;
      if (a.completedDate >= qStart && a.completedDate <= qEnd + '\uffff') entry.quarter += a.pointsEarned;
      if (a.completedDate.startsWith(yearPrefix)) entry.year += a.pointsEarned;
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
 * Current quarter points for a user.
 * @param {string} email
 * @returns {number}
 */
export function getUserQuarterPoints(email) {
  return ensurePointsCache().get(email)?.quarter ?? 0;
}

/**
 * Current year points for a user.
 * @param {string} email
 * @returns {number}
 */
export function getUserYearPoints(email) {
  return ensurePointsCache().get(email)?.year ?? 0;
}

/**
 * Build a Map<email, latestCompletedDateISO> from the global activities array.
 * Used to derive `lastActivity` per user without storing it on the user record.
 * @returns {Map<string, string>}
 */
function buildLastActivityMap() {
  const map = new Map();
  for (const a of getActivities()) {
    const key = a.userEmail || a.userId;
    if (!key || !a.completedDate) continue;
    // Skip bogus pre-2000 dates so they don't win the max comparison.
    const t = new Date(a.completedDate).getTime();
    if (isNaN(t) || new Date(t).getFullYear() < 2000) continue;
    const prev = map.get(key);
    if (!prev || a.completedDate > prev) map.set(key, a.completedDate);
  }
  return map;
}

/**
 * Get a user enriched with derived point totals and last activity date.
 * @param {string} email
 * @returns {*|null}
 */
export function getUserWithPoints(email) {
  const user = getUser(email);
  if (!user) return null;
  const pts = ensurePointsCache().get(email) || { total: 0, month: 0, quarter: 0, year: 0 };
  const lastActivity = buildLastActivityMap().get(email) || user.lastActivity || null;
  return {
    ...user, totalPoints: pts.total, currentMonthPoints: pts.month,
    currentQuarterPoints: pts.quarter, currentYearPoints: pts.year,
    lastActivity,
  };
}

/**
 * Get all users enriched with derived point totals and last activity date.
 * @returns {Record<string, *>}
 */
export function getUsersWithPoints() {
  const users = getUsers();
  const cache = ensurePointsCache();
  const lastActivityMap = buildLastActivityMap();
  const result = {};
  for (const [email, user] of Object.entries(users)) {
    const pts = cache.get(email) || { total: 0, month: 0, quarter: 0, year: 0 };
    result[email] = {
      ...user, totalPoints: pts.total, currentMonthPoints: pts.month,
      currentQuarterPoints: pts.quarter, currentYearPoints: pts.year,
      lastActivity: lastActivityMap.get(email) || user.lastActivity || null,
    };
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
