/**
 * @module teams-importer
 *
 * Parses Microsoft Teams meeting attendance CSV exports into
 * Activity and User records.  Accepts a raw `string` (CSV content)
 * and returns a `Promise<ImportResult>`.
 *
 * Never touches the DOM or state.js — returns data for the caller
 * to commit.
 */

import { createActivity, generateActivityId } from '../models/activity.js';
import { createUser } from '../models/user.js';
import { calculateMeetingPoints } from '../models/points.js';

// ── Types ───────────────────────────────────────────────────────────

/**
 * @typedef {import('../models/points.js').PointConfig} PointConfig
 *
 * @typedef {Object} ImportResult
 * @property {import('../models/activity.js').Activity[]} activities
 * @property {import('../models/user.js').User[]}         users
 * @property {string[]} warnings
 * @property {string[]} errors
 */

/**
 * @typedef {Object} ImportOptions
 * @property {boolean}     [dryRun=false]
 * @property {PointConfig}  config
 * @property {string}       filename
 */

/**
 * @typedef {Object} ParsedMeeting
 * @property {string}   title
 * @property {string}   meetingId    - deterministic, derived from title
 * @property {number}   attendees   - count from "Attended participants" line
 * @property {string[]} emails      - discovered attendee emails
 * @property {string}   date        - ISO 8601
 */

// ── Public API ──────────────────────────────────────────────────────

/**
 * Import Teams meeting attendance data from a CSV string.
 *
 * @param {string} content   - raw CSV text
 * @param {ImportOptions} options
 * @returns {Promise<ImportResult>}
 *
 * @example
 * const result = await importTeamsFile(csvText, { config, filename: 'meeting.csv' });
 */
export async function importTeamsFile(content, options) {
  const { config, filename = 'unknown', dryRun = false } = options;
  const warnings = [];
  const errors = [];

  if (!content || !content.trim()) {
    errors.push(`File ${filename} is empty`);
    return { activities: [], users: [], warnings, errors };
  }

  let meetings;
  try {
    meetings = parseMeetings(content, filename, warnings);
  } catch (err) {
    errors.push(`Failed to parse ${filename}: ${err.message}`);
    return { activities: [], users: [], warnings, errors };
  }

  if (meetings.length === 0) {
    warnings.push(`No meetings found in ${filename}`);
    return { activities: [], users: [], warnings, errors };
  }

  const activities = [];
  const usersMap = new Map();
  const points = calculateMeetingPoints(config);

  for (const meeting of meetings) {
    for (const email of meeting.emails) {
      const externalId = `${meeting.meetingId}_${email}`;

      activities.push(createActivity({
        id: generateActivityId(email, externalId),
        userId: email,
        externalId,
        title: meeting.title,
        type: 'meeting',
        level: '',
        courseType: 'Teams Meeting',
        pointsEarned: points,
        completedDate: meeting.date,
        source: 'teams-import',
      }));

      if (!usersMap.has(email)) {
        usersMap.set(email, createUser(email, ''));
      }
    }
  }

  if (dryRun) {
    return { activities: [], users: [], warnings, errors };
  }

  return {
    activities,
    users: [...usersMap.values()],
    warnings,
    errors,
  };
}

// ── CSV parsing ─────────────────────────────────────────────────────

/**
 * Parse the Teams CSV format into structured meeting objects.
 *
 * The Teams export format is line-oriented (not columnar CSV):
 * - "Meeting title: <title>"
 * - "Attended participants: <count>"
 * - Lines containing email addresses are attendees
 *
 * @param {string} content
 * @param {string} filename
 * @param {string[]} warnings
 * @returns {ParsedMeeting[]}
 */
function parseMeetings(content, filename, warnings) {
  const lines = content.split('\n');
  const meetings = [];
  let current = null;
  let emails = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\0/g, '').trim();
    if (!line) continue;

    const titleMatch = matchTitle(line);
    if (titleMatch) {
      if (current && emails.length > 0) {
        current.emails = [...emails];
        meetings.push(current);
      }
      current = {
        title: titleMatch,
        meetingId: sanitiseForId(titleMatch),
        attendees: 0,
        emails: [],
        date: extractDateFromFilename(filename),
      };
      emails = [];
      continue;
    }

    const countMatch = matchAttendedCount(line);
    if (countMatch !== null && current) {
      current.attendees = countMatch;
      continue;
    }

    if (current) {
      const email = extractEmail(line);
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
  }

  // Flush the last meeting
  if (current && emails.length > 0) {
    current.emails = [...emails];
    meetings.push(current);
  }

  // For meetings with a count but no discovered emails, warn
  for (const m of meetings) {
    if (m.emails.length === 0 && m.attendees > 0) {
      warnings.push(
        `Meeting "${m.title}": ${m.attendees} attendees reported but no emails found`,
      );
    }
  }

  return meetings;
}

// ── Line matchers ───────────────────────────────────────────────────

/**
 * @param {string} line
 * @returns {string|null} title or null
 */
function matchTitle(line) {
  if (!line.toLowerCase().includes('meeting title')) return null;
  const m = line.match(/Meeting\s+title[:\t]\s*(.+?)(?:\s*\(|$)/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {string} line
 * @returns {number|null}
 */
function matchAttendedCount(line) {
  if (!line.toLowerCase().includes('attended participants')) return null;
  const m = line.match(/Attended\s+participants[:\t]\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * @param {string} line
 * @returns {string|null} lowercased email or null
 */
function extractEmail(line) {
  const m = line.match(
    /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,
  );
  return m ? m[1].toLowerCase() : null;
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Derive a deterministic meeting ID from the title.
 *
 * @param {string} title
 * @returns {string}
 */
function sanitiseForId(title) {
  return `meeting_${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
}

/**
 * Attempt to extract a date from the filename.
 * Falls back to the current date.
 *
 * @param {string} filename
 * @returns {string} ISO 8601
 */
function extractDateFromFilename(filename) {
  const m = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
  if (m) {
    const d = new Date(m[1].replace(/_/g, '-'));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}
