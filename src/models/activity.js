/**
 * @module activity
 *
 * Canonical Activity data shape and pure helper functions.
 * No DOM access, no storage access, no side-effects.
 */

// ── Type definition ─────────────────────────────────────────────────

/**
 * @typedef {Object} Activity
 * @property {string}      id            - hash of userId + externalId
 * @property {string}      userId        - lowercase email
 * @property {string}      title
 * @property {string}      type          - 'course'|'meeting'|'quiz'|'hackathon'|'manual'
 * @property {string}      level         - 'foundational'|'associate'|'professional'|'specialty'|''
 * @property {string}      courseType    - raw value from import source
 * @property {number}      pointsEarned
 * @property {string|null} completedDate - ISO 8601
 * @property {string}      source        - 'course-import'|'teams-import'|'manual'
 * @property {string}      status        - 'completed'|'in_progress'|'enrolled'
 * @property {number|null} score         - 0-100 for quizzes, null otherwise
 * @property {boolean}     isDuplicate
 */

// ── ID generation ───────────────────────────────────────────────────

/**
 * Generate a deterministic activity ID from a userId and an
 * external identifier (e.g. courseId from the import source).
 *
 * The result is a simple string hash — not cryptographic, just
 * stable and collision-resistant enough for deduplication.
 *
 * @param {string} userId     - lowercase email
 * @param {string} externalId - course ID, meeting ID, etc.
 * @returns {string}
 *
 * @example
 * generateActivityId('alice@b.com', 'COURSE-123') // => 'act_alice@b.com_COURSE-123'
 */
export function generateActivityId(userId, externalId) {
  const uid = (userId ?? '').toLowerCase();
  const eid = (externalId ?? '').trim();
  return `act_${uid}_${eid}`;
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a new Activity with sensible defaults.
 * Missing fields are filled with safe fallbacks.
 *
 * @param {Partial<Activity> & { userId: string, title: string }} fields
 * @returns {Activity}
 *
 * @example
 * createActivity({
 *   userId: 'alice@b.com',
 *   title: 'AWS Cloud Quest',
 *   type: 'course',
 *   courseType: 'AWS Cloud Quest',
 *   pointsEarned: 75,
 *   completedDate: '2026-04-15T00:00:00Z',
 *   source: 'course-import',
 * })
 */
export function createActivity(fields) {
  const userId = (fields.userId ?? '').toLowerCase();
  return {
    id: fields.id ?? generateActivityId(userId, fields.externalId ?? ''),
    userId,
    title: fields.title ?? '',
    type: fields.type ?? 'course',
    level: fields.level ?? '',
    courseType: fields.courseType ?? '',
    pointsEarned: fields.pointsEarned ?? 0,
    completedDate: fields.completedDate ?? null,
    status: fields.status ?? 'completed',
    source: fields.source ?? 'manual',
    score: fields.score ?? null,
    isDuplicate: fields.isDuplicate ?? false,
  };
}
