/**
 * @module signup-importer
 *
 * Parses program sign-up sheets (XLSX or CSV) into a list of
 * participants. Only the `Email` column is required; if a name column
 * is present (Name / Full Name / Display Name, or First Name +
 * Last Name) it's used as the display name. Otherwise the email's
 * local-part is used.
 *
 * Pure: no DOM access, no storage access, no side-effects.
 */

import { createUser } from '../models/user.js';

// ── Types ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} SignupParticipant
 * @property {string} email - lowercased
 * @property {string} name
 *
 * @typedef {Object} SignupImportResult
 * @property {SignupParticipant[]} participants
 * @property {import('../models/user.js').User[]} users
 * @property {string[]} warnings
 * @property {string[]} errors
 *
 * @typedef {Object} SignupImportOptions
 * @property {string}  [filename]
 * @property {*}       [xlsx]      - SheetJS module; required for XLSX input
 * @property {string}  [sheetName] - optional override; defaults to first sheet
 */

// ── Public API ──────────────────────────────────────────────────────

/**
 * Parse a sign-up file. Accepts either a string (CSV) or an
 * ArrayBuffer/Uint8Array (XLSX). For XLSX input, `options.xlsx` must
 * be the SheetJS module.
 *
 * @param {string|ArrayBuffer|Uint8Array} input
 * @param {SignupImportOptions} options
 * @returns {SignupImportResult}
 */
export function parseSignupFile(input, options = {}) {
  const { filename = 'unknown', xlsx, sheetName } = options;
  const warnings = [];
  const errors = [];

  let rows;
  try {
    rows = toRowMatrix(input, { xlsx, filename, sheetName });
  } catch (err) {
    errors.push(`Failed to parse ${filename}: ${err.message}`);
    return { participants: [], users: [], warnings, errors };
  }

  if (!rows || rows.length === 0) {
    errors.push(`File ${filename} is empty`);
    return { participants: [], users: [], warnings, errors };
  }

  let header = findHeader(rows);
  if (!header) {
    header = inferHeaderFromEmailColumn(rows);
    if (header) {
      warnings.push(`No "Email" header recognised in ${filename}; auto-detected column ${header.columns.email + 1} by email shape`);
    }
  }
  if (!header) {
    const preview = rows.slice(0, Math.min(5, rows.length))
      .map((r, i) => `row ${i + 1}: [${(r ?? []).map(c => String(c ?? '').slice(0, 40)).join(' | ')}]`)
      .join('; ');
    errors.push(`No Email column found in ${filename}. First rows scanned: ${preview}`);
    return { participants: [], users: [], warnings, errors };
  }

  const { headerRow, columns } = header;
  const seen = new Map();

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawEmail = cell(row, columns.email);
    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!email) continue;
    if (!email.includes('@')) {
      warnings.push(`Row ${i + 1}: skipped, "${rawEmail}" is not a valid email`);
      continue;
    }

    if (seen.has(email)) continue;
    seen.set(email, { email, name: extractName(row, columns, email) });
  }

  const participants = [...seen.values()];
  const users = participants.map(p => createUser(p.email, p.name));

  if (participants.length === 0) {
    warnings.push(`No participants found in ${filename}`);
  }

  return { participants, users, warnings, errors };
}

// ── Internals ───────────────────────────────────────────────────────

function toRowMatrix(input, { xlsx, filename, sheetName }) {
  if (typeof input === 'string') {
    return parseCsv(input);
  }
  if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
    const isXlsx = /\.xlsx$/i.test(filename || '');
    if (isXlsx) {
      if (!xlsx) {
        throw new Error(`File ${filename} is XLSX but no XLSX library provided`);
      }
      const wb = xlsx.read(
        input instanceof ArrayBuffer ? new Uint8Array(input) : input,
        { type: 'array', cellDates: true },
      );
      const name = sheetName && wb.Sheets[sheetName] ? sheetName : wb.SheetNames[0];
      const ws = wb.Sheets[name];
      if (!ws) return [];
      return xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });
    }
    // Binary CSV/TSV — decode honouring BOM (UTF-16LE common).
    return parseCsv(decodeTextBuffer(input));
  }
  throw new Error('Unsupported input type — pass a string, ArrayBuffer, or Uint8Array');
}

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

/**
 * Minimal CSV parser: comma-separated, double-quoted fields with `""`
 * escaping, CRLF or LF line endings. Good enough for sign-up sheets;
 * for richer CSV use the XLSX library.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; continue; }
    field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Search the first ~25 rows for one that contains an "Email" column,
 * and resolve the indices of any optional name columns.
 *
 * Matching is loose: any cell whose normalized text contains "email"
 * or "e-mail" qualifies. Some sources (Microsoft Forms, Eventbrite,
 * etc.) emit headers like "Email Address" or "Please confirm your
 * email" rather than a bare "Email".
 *
 * @param {Array<Array<*>>} rows
 * @returns {{ headerRow: number, columns: { email: number, name: number, first: number, last: number } } | null}
 */
function findHeader(rows) {
  const limit = Math.min(25, rows.length);
  for (let r = 0; r < limit; r++) {
    const row = rows[r];
    if (!row) continue;
    const labels = row.map(c => normalizeHeader(c));
    const email = matchEmailColumn(labels);
    if (email === -1) continue;
    return {
      headerRow: r,
      columns: {
        email,
        name:  matchAny(labels, [/^name$/, /^full name$/, /^display name$/, /^participant name$/, /^attendee name$/]),
        first: matchAny(labels, [/^first name$/, /^firstname$/, /^given name$/]),
        last:  matchAny(labels, [/^last name$/, /^lastname$/, /^surname$/, /^family name$/]),
      },
    };
  }
  return null;
}

/**
 * Fallback when no recognisable header exists: pick the column with
 * the most cells that look like emails (contain `@`). Returns null if
 * nothing email-shaped is found.
 *
 * @param {Array<Array<*>>} rows
 * @returns {{ headerRow: number, columns: { email: number, name: -1, first: -1, last: -1 } } | null}
 */
function inferHeaderFromEmailColumn(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      const s = String(row[c] ?? '').trim();
      if (s.includes('@') && /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(s)) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
  }
  if (counts.size === 0) return null;
  let bestCol = -1, bestN = 0;
  for (const [col, n] of counts) {
    if (n > bestN) { bestN = n; bestCol = col; }
  }
  if (bestCol === -1) return null;
  // Treat the row *above* the first email-shaped cell as a synthetic
  // header so its row contents aren't imported as a participant.
  let headerRow = 0;
  for (let r = 0; r < rows.length; r++) {
    const cell = rows[r]?.[bestCol];
    if (cell && String(cell).includes('@')) { headerRow = Math.max(0, r - 1); break; }
  }
  return {
    headerRow,
    columns: { email: bestCol, name: -1, first: -1, last: -1 },
  };
}

function matchAny(labels, patterns) {
  for (let i = 0; i < labels.length; i++) {
    for (const p of patterns) {
      if (p.test(labels[i])) return i;
    }
  }
  return -1;
}

function matchEmailColumn(labels) {
  // Prefer exact / strong matches first, then any cell containing "email".
  const strong = ['email', 'email address', 'e-mail', 'e mail', 'mail'];
  for (const s of strong) {
    const i = labels.indexOf(s);
    if (i !== -1) return i;
  }
  for (let i = 0; i < labels.length; i++) {
    if (/\bemail\b|\be-?mail\b/.test(labels[i])) return i;
  }
  return -1;
}

function normalizeHeader(raw) {
  return String(raw ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function cell(row, idx) {
  return idx === -1 ? null : row[idx];
}

function extractName(row, columns, email) {
  const single = String(cell(row, columns.name) ?? '').trim();
  if (single) return single;
  const first = String(cell(row, columns.first) ?? '').trim();
  const last  = String(cell(row, columns.last)  ?? '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return email.split('@')[0];
}
