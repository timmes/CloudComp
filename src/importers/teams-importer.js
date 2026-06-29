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
import { calculateActivityPoints } from '../models/points.js';

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
 * Import Teams meeting attendance data from a CSV string or XLSX ArrayBuffer.
 *
 * @param {string|ArrayBuffer} content   - raw CSV text or XLSX ArrayBuffer
 * @param {ImportOptions & {xlsx?: *}} options
 * @returns {Promise<ImportResult>}
 *
 * @example
 * const result = await importTeamsFile(csvText, { config, filename: 'meeting.csv' });
 * const result = await importTeamsFile(buffer, { config, filename: 'report.xlsx', xlsx: XLSX });
 */
export async function importTeamsFile(content, options) {
  const { config, filename = 'unknown', dryRun = false, xlsx } = options;
  const warnings = [];
  const errors = [];

  let textContent;
  if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
    const isXlsx = /\.xlsx$/i.test(filename);
    if (isXlsx) {
      if (!xlsx) {
        errors.push(`File ${filename} is XLSX but no XLSX library provided`);
        return { activities: [], users: [], warnings, errors };
      }
      try {
        textContent = xlsxToText(content, xlsx);
      } catch (err) {
        errors.push(`Failed to parse XLSX ${filename}: ${err.message}`);
        return { activities: [], users: [], warnings, errors };
      }
    } else {
      // Raw CSV/TSV binary — decode honouring any BOM (Teams attendance
      // exports are frequently UTF-16LE with a BOM, which UTF-8 decode
      // turns into garbage).
      textContent = decodeTextBuffer(content);
    }
  } else {
    textContent = content;
  }

  if (!textContent || !textContent.trim()) {
    errors.push(`File ${filename} is empty`);
    return { activities: [], users: [], warnings, errors };
  }

  let meetings;
  try {
    // Newer "sectioned" Teams attendance reports use a tabular "2.
    // Participants" section instead of line-prefixed "Meeting title:"
    // markers. Try that path first, fall back to the legacy parser.
    meetings = parseSectionedReport(textContent, filename, warnings);
    if (meetings.length === 0) {
      meetings = parseMeetings(textContent, filename, warnings);
    }
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
  const points = calculateActivityPoints('liveLearning', 'Live Webinar', config);

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

// ── Sectioned-report parsing (newer Teams attendance format) ────────

/**
 * Parse a sectioned Teams attendance report. These exports have a
 * tabular "2. Participants" section with columns like
 *   Name | First Join | Last Leave | In-Meeting Duration | Email | ...
 * and may or may not include a "Meeting title" row in section 1.
 *
 * Returns an empty array (no throw) when the tabular header isn't
 * found — caller falls back to {@link parseMeetings} for the legacy
 * line-oriented format.
 *
 * @param {string} content
 * @param {string} filename
 * @param {string[]} warnings
 * @returns {ParsedMeeting[]}
 */
function parseSectionedReport(content, filename, warnings) {
  const lines = content.split('\n').map(l => l.replace(/\0/g, ''));
  const header = findParticipantsHeader(lines);
  if (!header) return [];

  const { rowIndex, columns } = header;
  const emails = [];
  for (let i = rowIndex + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw == null) continue;
    const trimmed = raw.trim();
    // Stop at the next numbered section (e.g. "3. In-Meeting Activities").
    if (/^\d+\.\s/.test(trimmed)) break;
    if (!trimmed) continue;

    const cells = raw.split('\t');
    const candidate = columns.email < cells.length
      ? String(cells[columns.email] ?? '').trim()
      : '';
    // Some rows have the email column blank but still hold an email
    // somewhere else (e.g. UPN column); fall back to any email-shaped
    // value on the row.
    const email = extractEmail(candidate) || extractEmail(raw);
    if (email && !emails.includes(email)) {
      emails.push(email);
    }
  }

  if (emails.length === 0) {
    warnings.push(`Sectioned report in ${filename}: participants table had no email rows`);
    return [];
  }

  const title = findReportTitle(lines, rowIndex) || titleFromFilename(filename);
  // Distinguish recurring meetings with the same title by suffixing
  // the meetingId with the meeting's actual date. Falls back to the
  // filename date, then to no suffix when nothing parseable exists
  // (preserves legacy behaviour for date-less inputs).
  const meetingDateIso = findMeetingDate(lines, rowIndex)
                      || extractDateFromFilenameOrNull(filename);
  const dateSuffix = meetingDateIso ? meetingDateIso.slice(0, 10) : '';
  const meetingId = dateSuffix
    ? `${sanitiseForId(title)}_${dateSuffix}`
    : sanitiseForId(title);
  return [{
    title,
    meetingId,
    attendees: emails.length,
    emails,
    date: meetingDateIso || new Date().toISOString(),
  }];
}

/**
 * Scan section 1 (rows above the participants table) for a date row
 * — "Start time", "Meeting date", "Date", "Meeting start time", etc.
 * Returns an ISO 8601 timestamp or null.
 *
 * @param {string[]} lines
 * @param {number} participantsRow - stop searching at this index
 * @returns {string|null}
 */
function findMeetingDate(lines, participantsRow) {
  const labels = [
    'start time', 'meeting start time', 'meeting date', 'date',
    'session start', 'started at',
  ];
  for (let i = 0; i < participantsRow; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split('\t').map(c => String(c ?? '').trim());
    if (cells.length < 2) continue;
    if (!labels.includes(cells[0].toLowerCase())) continue;
    const raw = cells.slice(1).find(c => c.length > 0);
    if (!raw) continue;
    const iso = parseDateLoose(raw);
    if (iso) return iso;
  }
  return null;
}

/**
 * Parse a date string from a Teams export ("5/07/26, 10:54:04 AM",
 * "2026-05-07", "2026-05-07T10:54:04Z"). Returns ISO 8601 or null.
 *
 * @param {string} raw
 * @returns {string|null}
 */
function parseDateLoose(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  // Sanity check: Teams exports never legitimately predate 2000.
  if (d.getFullYear() < 2000 || d.getFullYear() > 2100) return null;
  return d.toISOString();
}

/**
 * Locate the tabular "Participants" header — any row containing both
 * an Email column and a Duration/Join column. Returns the row index
 * and the resolved column indices, or null.
 *
 * @param {string[]} lines
 * @returns {{ rowIndex: number, columns: { email: number, duration: number, firstJoin: number, lastLeave: number, role: number } } | null}
 */
function findParticipantsHeader(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split('\t').map(c => String(c ?? '').trim().toLowerCase());
    const email = cells.findIndex(c => c === 'email' || c === 'email address' || c === 'e-mail');
    if (email === -1) continue;
    const duration  = cells.findIndex(c => c.includes('in-meeting duration') || c === 'duration' || c === 'time in meeting');
    const firstJoin = cells.findIndex(c => c === 'first join' || c === 'first joined' || c === 'join time');
    const lastLeave = cells.findIndex(c => c === 'last leave' || c === 'last left' || c === 'leave time');
    const role      = cells.findIndex(c => c === 'role');
    if (duration === -1 && firstJoin === -1 && lastLeave === -1) continue;
    return { rowIndex: i, columns: { email, duration, firstJoin, lastLeave, role } };
  }
  return null;
}

/**
 * Search any row above the participants table for a title cell. The
 * newer report uses labels like "Meeting title", but it can also
 * appear as "Title" or "Subject". Returns null if none found.
 *
 * @param {string[]} lines
 * @param {number} participantsRow - stop searching at this index
 * @returns {string|null}
 */
function findReportTitle(lines, participantsRow) {
  const labels = ['meeting title', 'title', 'subject', 'meeting subject'];
  for (let i = 0; i < participantsRow; i++) {
    const line = lines[i];
    if (!line) continue;
    const cells = line.split('\t').map(c => String(c ?? '').trim());
    if (cells.length < 2) continue;
    const label = cells[0].toLowerCase();
    if (!labels.includes(label)) continue;
    const value = cells.slice(1).find(c => c.length > 0);
    if (value) return value.replace(/^\(.*\)\s*/, '').trim();
  }
  return null;
}

/**
 * Last-resort title: strip extension and obvious noise from the
 * filename. Microsoft Teams names these files like
 * "MeetingAttendanceReport-Some Meeting-2026-05-14.csv".
 *
 * @param {string} filename
 * @returns {string}
 */
function titleFromFilename(filename) {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/^MeetingAttendanceReport[-_ ]*/i, '')
    .replace(/[-_]?\d{4}[-_]\d{2}[-_]\d{2}([-_]\d{2}[-_]\d{2}[-_]\d{2})?$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base || 'Teams Meeting';
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
  return extractDateFromFilenameOrNull(filename) ?? new Date().toISOString();
}

/**
 * Like {@link extractDateFromFilename} but returns null instead of
 * synthesising "now" — used for places where the absence of a date
 * is meaningful (e.g. building a deterministic meetingId).
 *
 * @param {string} filename
 * @returns {string|null} ISO 8601 or null
 */
function extractDateFromFilenameOrNull(filename) {
  const m = filename.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
  if (!m) return null;
  const d = new Date(m[1].replace(/_/g, '-'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Convert an XLSX ArrayBuffer into a plain text string.
 * Teams attendance XLSX files store tab-separated data within single
 * cells per row; we join cells with tabs and rows with newlines.
 *
 * @param {ArrayBuffer|Uint8Array} data
 * @param {*} xlsx - XLSX library instance
 * @returns {string}
 */
function xlsxToText(data, xlsx) {
  const workbook = xlsx.read(new Uint8Array(data), { type: 'array', cellDates: true });
  const lines = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    for (const row of rows) {
      lines.push(row.join('\t'));
    }
  }
  return lines.join('\n');
}

/**
 * Decode a binary buffer to a string, honouring a UTF-16LE, UTF-16BE,
 * or UTF-8 BOM. Defaults to UTF-8 when no BOM is present.
 *
 * Microsoft Teams attendance CSV exports are UTF-16LE with a BOM —
 * the standard `Blob.text()` (UTF-8) returns garbage for those files,
 * which is why the importer cannot find any expected headers.
 *
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
function decodeTextBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  return new TextDecoder('utf-8').decode(bytes);
}
