/**
 * @module course-importer
 *
 * Parses course activity and classroom training (ILT) files into
 * Activity and User records.  Accepts raw `ArrayBuffer` data (from
 * an XLSX/CSV file) and returns a `Promise<ImportResult>`.
 *
 * Never touches the DOM or state.js — returns data for the caller
 * to commit.
 */

import { createActivity, generateActivityId } from '../models/activity.js';
import { createUser } from '../models/user.js';
import { calculateActivityPoints } from '../models/points.js';
import { resolveCourseMapping } from './course-type-map.js';

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

// ── Public API ──────────────────────────────────────────────────────

/**
 * Import course activity data from an XLSX/CSV ArrayBuffer.
 *
 * Detects whether the file is a standard course export or a
 * classroom training (ILT) file and routes accordingly.
 *
 * @param {ArrayBuffer} data     - raw file bytes
 * @param {*}           xlsx     - the XLSX library instance (injected)
 * @param {ImportOptions} options
 * @returns {Promise<ImportResult>}
 *
 * @example
 * const result = await importCourseFile(buffer, XLSX, { config, filename: 'courses.xlsx' });
 */
export async function importCourseFile(data, xlsx, options) {
  const { config, filename = 'unknown', dryRun = false } = options;
  const warnings = [];
  const errors = [];

  let jsonData;
  try {
    // cellDates: true makes SheetJS convert Excel date serial cells into JS
    // Date objects, instead of leaving them as raw numbers (e.g. 45292) that
    // would otherwise be misread as ms-since-epoch and collapse to 1970.
    const workbook = xlsx.read(new Uint8Array(data), { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  } catch (err) {
    errors.push(`Failed to parse file ${filename}: ${err.message}`);
    return { activities: [], users: [], warnings, errors };
  }

  if (!jsonData || jsonData.length === 0) {
    errors.push(`File ${filename} is empty`);
    return { activities: [], users: [], warnings, errors };
  }

  const isILT = detectClassroomFormat(jsonData);
  const result = isILT
    ? processILT(jsonData, config, filename, warnings, errors)
    : processCourseRows(jsonData, config, filename, warnings, errors);

  if (dryRun) {
    return { ...result, activities: [], users: [] };
  }
  return result;
}

// ── ILT detection ───────────────────────────────────────────────────

/**
 * Heuristic: ILT files have email in col[1] and "completed" in
 * col[2] within the first 10 rows, but no course-ID-shaped value
 * in col[0].
 *
 * @param {*[][]} jsonData
 * @returns {boolean}
 */
function detectClassroomFormat(jsonData) {
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row || row.length < 3) continue;
    const col1 = String(row[1] ?? '');
    const col2 = String(row[2] ?? '');
    const col0 = String(row[0] ?? '');
    if (
      col1.includes('@') &&
      col2.toLowerCase().includes('completed') &&
      !col0.match(/^[A-Z0-9]{10}$/)
    ) {
      return true;
    }
  }
  return false;
}

// ── ILT processing ──────────────────────────────────────────────────

/**
 * @param {*[][]} jsonData
 * @param {PointConfig} config
 * @param {string} filename
 * @param {string[]} warnings
 * @param {string[]} errors
 * @returns {ImportResult}
 */
function processILT(jsonData, config, filename, warnings, errors) {
  const activities = [];
  const usersMap = new Map();
  const sessionName = deriveSessionName(filename);
  const points = config?.generalCourses?.['Classroom Training'] ?? 100;

  for (let i = 0; i < jsonData.length; i++) {
    try {
      const result = processILTRow(jsonData[i], i, points, sessionName, filename);
      if (result.warning) { warnings.push(`Row ${i + 1}: ${result.warning}`); continue; }
      if (!result.activity) continue;
      activities.push(result.activity);
      if (!usersMap.has(result.email)) {
        usersMap.set(result.email, createUser(result.email, result.name));
      }
    } catch (err) {
      warnings.push(`Row ${i + 1}: error — ${err.message}`);
    }
  }

  return { activities, users: [...usersMap.values()], warnings, errors };
}

/**
 * Process a single ILT row.
 *
 * @param {*[]} row
 * @param {number} rowIndex
 * @param {number} points
 * @param {string} sessionName
 * @param {string} filename
 * @returns {{ activity?: *, email?: string, name?: string, warning?: string }}
 */
function processILTRow(row, rowIndex, points, sessionName, filename) {
  if (!row || row.length < 2) return {};

  const name = String(row[0] ?? '').trim();
  const email = String(row[1] ?? '').trim().toLowerCase();
  const status = String(row[2] ?? '').trim();

  if (!email.includes('@')) return {};
  if (status.toLowerCase() !== 'completed') {
    return { warning: `skipped, status="${status}"` };
  }

  const externalId = `ILT_${sanitiseForId(filename)}_${rowIndex}`;
  const activity = createActivity({
    id: generateActivityId(email, externalId),
    userId: email,
    externalId,
    title: sessionName,
    type: 'course',
    level: 'classroom',
    courseType: 'Classroom Training',
    pointsEarned: points,
    completedDate: new Date().toISOString(),
    status: 'completed',
    source: 'course-import',
  });

  return { activity, email, name };
}

// ── Standard course processing ──────────────────────────────────────

/**
 * @param {*[][]} jsonData
 * @param {PointConfig} config
 * @param {string} filename
 * @param {string[]} warnings
 * @param {string[]} errors
 * @returns {ImportResult}
 */
function processCourseRows(jsonData, config, filename, warnings, errors) {
  const headerIdx = findHeaderRow(jsonData);
  if (headerIdx === -1) {
    errors.push(`No header row with "Email" column found in ${filename}`);
    return { activities: [], users: [], warnings, errors };
  }

  const headers = jsonData[headerIdx];
  const activities = [];
  const usersMap = new Map();

  for (let i = headerIdx + 1; i < jsonData.length; i++) {
    try {
      const record = rowToRecord(headers, jsonData[i]);
      const result = processOneRecord(record, config, filename);
      if (result.warning) warnings.push(`Row ${i + 1}: ${result.warning}`);
      if (result.activity) activities.push(result.activity);
      if (result.user && !usersMap.has(result.user.email)) {
        usersMap.set(result.user.email, result.user);
      }
    } catch (err) {
      warnings.push(`Row ${i + 1}: error — ${err.message}`);
    }
  }

  return {
    activities,
    users: [...usersMap.values()],
    warnings,
    errors,
  };
}

/**
 * Find the first row (within first 5) that contains "Email".
 *
 * @param {*[][]} jsonData
 * @returns {number} index, or -1
 */
function findHeaderRow(jsonData) {
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    if (jsonData[i] && jsonData[i].includes('Email')) return i;
  }
  return -1;
}

/**
 * Zip a header row and a data row into a keyed record.
 *
 * @param {string[]} headers
 * @param {*[]} row
 * @returns {Record<string, *>}
 */
function rowToRecord(headers, row) {
  const record = {};
  for (let j = 0; j < headers.length; j++) {
    record[headers[j]] = row?.[j];
  }
  return record;
}

/**
 * Process one course record into an activity + user (or a skip).
 *
 * @param {Record<string,*>} record
 * @param {PointConfig} config
 * @param {string} filename
 * @returns {{ activity?: *, user?: *, warning?: string }}
 */
function processOneRecord(record, config, _filename) {
  const fields = extractRecordFields(record);
  if (fields.warning) return { warning: fields.warning };

  const isCompleted = fields.status === 'completed';
  const { category, subCategory } = resolveCourseMapping(fields.courseType);
  const points = calculateActivityPoints(category, subCategory, config);

  const activity = createActivity({
    id: generateActivityId(fields.email, fields.courseId),
    userId: fields.email,
    externalId: fields.courseId,
    title: fields.title,
    type: 'course',
    level: fields.level || '',
    courseType: fields.courseType || '',
    pointsEarned: isCompleted ? points : 0,
    completedDate: fields.completedDate,
    status: fields.status,
    source: 'course-import',
    score: isCompleted ? parseScore(record['Score']) : null,
  });

  const name = buildName(record['First Name'], record['Last Name'], fields.email);
  return { activity, user: createUser(fields.email, name) };
}

/**
 * Validate and extract fields from a course record.
 * Returns a warning string if the row should be skipped.
 *
 * @param {Record<string,*>} record
 * @returns {{ email: string, courseId: string, title: string, level: string, courseType: string, completedDate: string, warning?: undefined } | { warning: string }}
 */
/** @param {string} raw @returns {'completed'|'in_progress'|'enrolled'} */
function mapStatus(raw) {
  const s = (raw ?? '').trim().toUpperCase();
  if (s === 'COMPLETED') return 'completed';
  if (s === 'IN PROGRESS') return 'in_progress';
  return 'enrolled';
}

function extractRecordFields(record) {
  const email = str(record['Email']).toLowerCase();
  const courseId = str(record['Course ID']);
  const title = str(record['Course Title']);
  const status = mapStatus(record['Status']);

  if (!email || !courseId || !title) return { warning: 'skipped, missing Email/Course ID/Title' };

  const completedDate = status === 'completed' ? parseDate(record['Completed on']) : null;
  if (status === 'completed' && !completedDate) return { warning: 'skipped, invalid completion date' };

  return {
    email, courseId, title, status,
    level: str(record['Level']).toLowerCase(),
    courseType: str(record['CourseType']),
    completedDate,
  };
}

// ── Shared helpers ──────────────────────────────────────────────────



/** @param {*} raw @returns {number|null} */
function parseScore(raw) {
  if (raw == null) return null;
  const n = parseFloat(raw);
  return Number.isNaN(n) ? null : n;
}

/**
 * Parse a date cell from an XLSX/CSV file into an ISO 8601 string.
 * Accepts JS Date objects (when cellDates:true), date strings, and
 * raw Excel serial numbers as a defensive fallback.
 *
 * @param {*} raw
 * @returns {string|null}
 */
function parseDate(raw) {
  if (raw == null || raw === 'null' || raw === '') return null;
  // Excel serial number guard: small positive numbers are days since 1900-01-00.
  // Without this, new Date(45292) would be read as ms-since-epoch → 1970.
  if (typeof raw === 'number' && raw > 1 && raw < 100000) {
    const ms = (raw - 25569) * 86400000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  try {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/** @param {*} v @returns {string} */
function str(v) {
  return (v ?? '').toString().trim();
}

/** @param {string} filename @returns {string} */
function sanitiseForId(filename) {
  return filename.replace(/[^a-zA-Z0-9]/g, '_');
}

/** @param {string} filename @returns {string} */
function deriveSessionName(filename) {
  if (filename.toLowerCase().includes('ilt')) {
    return 'Instructor-Led Training (ILT)';
  }
  const m = filename.match(/([^/\\]+?)(?:-session|-example)?\.\w+$/i);
  if (m) {
    const clean = m[1].replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (!clean.toLowerCase().includes('example')) return `${clean} Training`;
  }
  return 'Classroom Training Session';
}

/**
 * @param {*} first
 * @param {*} last
 * @param {string} email
 * @returns {string}
 */
function buildName(first, last, email) {
  const full = `${str(first)} ${str(last)}`.trim();
  return full || email.split('@')[0];
}
