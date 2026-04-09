import { describe, it, expect } from 'vitest';
import { importCourseFile } from '../../src/importers/course-importer.js';
import { DEFAULT_POINT_CONFIG } from '../../src/models/points.js';

// ── Mock XLSX ───────────────────────────────────────────────────────

/**
 * Build a mock XLSX library that returns the given rows
 * from sheet_to_json.  Each row is an array of cell values.
 */
function mockXlsx(rows) {
  return {
    read: () => ({
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: '__mock__' },
    }),
    utils: {
      sheet_to_json: () => rows,
    },
  };
}

/** Mock XLSX that throws on read. */
function brokenXlsx(msg = 'corrupt') {
  return {
    read: () => { throw new Error(msg); },
    utils: { sheet_to_json: () => [] },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

const cfg = DEFAULT_POINT_CONFIG;
const opts = (extra = {}) => ({ config: cfg, filename: 'test.xlsx', ...extra });

const COURSE_HEADERS = ['Email', 'Course ID', 'Course Title', 'Status', 'Level', 'CourseType', 'Completed on', 'Score', 'First Name', 'Last Name'];

function courseRow(email, courseId, title, status, level, courseType, completedOn, score = null, first = '', last = '') {
  return [email, courseId, title, status, level, courseType, completedOn, score, first, last];
}

function iltRow(name, email, status) {
  return [name, email, status, ''];
}

function toBuffer() {
  return new ArrayBuffer(0); // Content doesn't matter — mock XLSX ignores it
}

// ── Standard course export ──────────────────────────────────────────

describe('importCourseFile — standard courses', () => {
  it('parses valid course export and returns correct activity count', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'Course 1', 'COMPLETED', 'fundamental', 'Digital Course', '2026-04-01'),
      courseRow('bob@b.com', 'C2', 'Course 2', 'COMPLETED', 'advanced', 'Digital Course', '2026-04-02'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('sets type to "quiz" for quiz rows', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'Q1', 'Quiz 1', 'COMPLETED', '', 'Quiz', '2026-04-01', 85),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].type).toBe('quiz');
  });

  it('sets type to "quiz" for Card Clash courseType', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'CC1', 'Card Clash', 'COMPLETED', '', 'Card Clash', '2026-04-01', 90),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].type).toBe('quiz');
  });

  it('applies quiz bonus for 80%+ score', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'Q1', 'Quiz', 'COMPLETED', '', 'Quiz', '2026-04-01', 85),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(50); // Quiz 80%+ Score
  });

  it('applies quiz base points for score below 80', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'Q1', 'Quiz', 'COMPLETED', '', 'Quiz', '2026-04-01', 60),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(20); // Quiz Completion
  });

  it('applies perfect quiz bonus for score of 100', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'Q1', 'Quiz', 'COMPLETED', '', 'Quiz', '2026-04-01', 100),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(70); // Quiz Perfect Score
  });

  it('calculates course points by courseType', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'Lab', 'COMPLETED', '', 'AWS Builder Lab', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(100);
  });

  it('calculates course points by level when courseType unrecognised', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'Some Course', 'COMPLETED', 'advanced', 'Unknown Type', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(100); // Professional
  });

  it('skips IN PROGRESS rows with a warning', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'In Progress Course', 'IN PROGRESS', 'fundamental', '', ''),
      courseRow('bob@b.com', 'C2', 'Done Course', 'COMPLETED', 'fundamental', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('in-progress'))).toBe(true);
  });

  it('skips rows with unrecognised status', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'ENROLLED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('ENROLLED'))).toBe(true);
  });

  it('skips rows missing Email/Course ID/Title with a warning', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
      courseRow('alice@b.com', '', 'X', 'COMPLETED', '', '', '2026-04-01'),
      courseRow('alice@b.com', 'C1', '', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(0);
    expect(result.warnings).toHaveLength(3);
  });

  it('skips rows with invalid completion date', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', 'not-a-date'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(0);
    expect(result.warnings.some(w => w.includes('invalid completion date'))).toBe(true);
  });

  it('creates User for every unique email', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01', null, 'Alice', 'Smith'),
      courseRow('alice@b.com', 'C2', 'Y', 'COMPLETED', '', '', '2026-04-02', null, 'Alice', 'Smith'),
      courseRow('bob@b.com', 'C3', 'Z', 'COMPLETED', '', '', '2026-04-03', null, 'Bob', 'Jones'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.users).toHaveLength(2);
    expect(result.users.map(u => u.email).sort()).toEqual(['alice@b.com', 'bob@b.com']);
  });

  it('builds user name from First Name + Last Name', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01', null, 'Alice', 'Smith'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.users[0].name).toBe('Alice Smith');
  });

  it('sets activity source to "course-import"', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].source).toBe('course-import');
  });

  it('lowercases email in activity userId', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('ALICE@B.COM', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].userId).toBe('alice@b.com');
  });

  it('generates deterministic activity ids', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const r1 = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    const r2 = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(r1.activities[0].id).toBe(r2.activities[0].id);
  });

  it('stores score as a number for quiz rows', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'Q1', 'Quiz', 'COMPLETED', '', 'Quiz', '2026-04-01', 92),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].score).toBe(92);
  });

  it('stores score as null for non-quiz rows', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'Course', 'COMPLETED', '', 'Digital Course', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].score).toBe(null);
  });
});

// ── Header detection ────────────────────────────────────────────────

describe('importCourseFile — header detection', () => {
  it('finds header row within first 5 rows', async () => {
    const rows = [
      ['Metadata line 1'],
      ['Metadata line 2'],
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(1);
  });

  it('adds error when no header row found', async () => {
    const rows = [['No', 'Header', 'Here']];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.errors.some(e => e.includes('No header row'))).toBe(true);
    expect(result.activities).toHaveLength(0);
  });
});

// ── ILT / classroom training ────────────────────────────────────────

describe('importCourseFile — ILT format', () => {
  it('detects ILT format and processes rows', async () => {
    const rows = [
      iltRow('Alice Smith', 'alice@b.com', 'Completed'),
      iltRow('Bob Jones', 'bob@b.com', 'Completed'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ filename: 'ilt-session.xlsx' }));
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].courseType).toBe('Classroom Training');
  });

  it('awards Classroom Training points from config', async () => {
    const rows = [iltRow('Alice', 'alice@b.com', 'Completed')];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities[0].pointsEarned).toBe(100); // Classroom Training default
  });

  it('skips rows without "completed" status and adds warning', async () => {
    const rows = [
      iltRow('Alice', 'alice@b.com', 'Completed'),
      iltRow('Bob', 'bob@b.com', 'Not Completed'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(1);
    expect(result.warnings.some(w => w.includes('Not Completed'))).toBe(true);
  });

  it('skips rows without a valid email', async () => {
    const rows = [
      iltRow('Alice', 'not-an-email', 'Completed'),
      iltRow('Bob', 'bob@b.com', 'Completed'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(1);
  });

  it('creates users from ILT rows', async () => {
    const rows = [
      iltRow('Alice Smith', 'alice@b.com', 'Completed'),
      iltRow('Bob Jones', 'bob@b.com', 'Completed'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.users).toHaveLength(2);
  });

  it('deduplicates users within the same file', async () => {
    const rows = [
      iltRow('Alice', 'alice@b.com', 'Completed'),
      iltRow('Alice', 'alice@b.com', 'Completed'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.users).toHaveLength(1);
  });

  it('derives session name from filename containing "ilt"', async () => {
    const rows = [iltRow('Alice', 'alice@b.com', 'Completed')];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ filename: 'my-ilt-export.xlsx' }));
    expect(result.activities[0].title).toBe('Instructor-Led Training (ILT)');
  });

  it('generates deterministic activity ids for ILT', async () => {
    const rows = [iltRow('Alice', 'alice@b.com', 'Completed')];
    const r1 = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ filename: 'ilt.xlsx' }));
    const r2 = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ filename: 'ilt.xlsx' }));
    expect(r1.activities[0].id).toBe(r2.activities[0].id);
  });
});

// ── Error handling ──────────────────────────────────────────────────

describe('importCourseFile — error handling', () => {
  it('returns error (not throws) for corrupt XLSX data', async () => {
    const result = await importCourseFile(toBuffer(), brokenXlsx(), opts());
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to parse');
    expect(result.activities).toHaveLength(0);
  });

  it('returns error (not throws) for empty file', async () => {
    const result = await importCourseFile(toBuffer(), mockXlsx([]), opts());
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    expect(result.activities).toHaveLength(0);
  });

  it('continues processing after a single bad row', async () => {
    // Row with undefined values that might cause issues in str()
    const rows = [
      COURSE_HEADERS,
      [undefined, undefined, undefined, undefined, undefined, undefined, undefined],
      courseRow('alice@b.com', 'C1', 'Good', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts());
    expect(result.activities).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ── dryRun ──────────────────────────────────────────────────────────

describe('importCourseFile — dryRun', () => {
  it('returns empty activities and users when dryRun is true', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ dryRun: true }));
    expect(result.activities).toHaveLength(0);
    expect(result.users).toHaveLength(0);
  });

  it('still returns warnings and errors when dryRun is true', async () => {
    const rows = [
      COURSE_HEADERS,
      courseRow('alice@b.com', 'C1', 'X', 'IN PROGRESS', '', '', ''),
      courseRow('bob@b.com', 'C2', 'Y', 'COMPLETED', '', '', '2026-04-01'),
    ];
    const result = await importCourseFile(toBuffer(), mockXlsx(rows), opts({ dryRun: true }));
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Result shape ────────────────────────────────────────────────────

describe('importCourseFile — result shape', () => {
  it('always returns { activities, users, warnings, errors }', async () => {
    const result = await importCourseFile(toBuffer(), mockXlsx([]), opts());
    expect(result).toHaveProperty('activities');
    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.activities)).toBe(true);
    expect(Array.isArray(result.users)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
