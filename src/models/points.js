/**
 * @module points
 *
 * Pure scoring logic for CloudComp.  Every function is deterministic —
 * no DOM access, no localStorage, no side-effects.  Point values come
 * from a caller-supplied {@link PointConfig} object.
 */

// ── Type definitions ────────────────────────────────────────────────

/**
 * @typedef {Object} PointConfig
 * @property {Record<string, number>} awsCourseTypes
 * @property {Record<string, number>} generalCourses
 * @property {Record<string, number>} events
 * @property {Record<string, number>} hackathons
 * @property {Record<string, number>} quizzes
 */

/**
 * @typedef {Object} Activity
 * @property {string}      id
 * @property {string}      userId
 * @property {string}      title
 * @property {string}      type          - 'course'|'meeting'|'quiz'|'hackathon'|'manual'
 * @property {string}      level         - 'foundational'|'associate'|'professional'|'specialty'|''
 * @property {string}      courseType    - raw value from import source
 * @property {number}      pointsEarned
 * @property {string|null} completedDate - ISO 8601
 * @property {string}      source
 * @property {number|null} score         - 0-100 for quizzes, null otherwise
 * @property {boolean}     isDuplicate
 */

// ── Default config ──────────────────────────────────────────────────

/** @type {PointConfig} */
export const DEFAULT_POINT_CONFIG = Object.freeze({
  awsCourseTypes: Object.freeze({
    'AWS Builder Lab': 100,
    'AWS Cloud Quest': 75,
    'AWS Jam Journey': 150,
    'AWS Simulearn': 75,
    'Certification Exam Preparation': 100,
    'Digital Course With Lab': 100,
  }),
  generalCourses: Object.freeze({
    'Classroom Training': 100,
    'Digital Courses - Foundational': 50,
    'Digital Courses - Associate': 75,
    'Digital Courses - Professional': 100,
    'Digital Courses - Specialty': 100,
  }),
  events: Object.freeze({
    'Live Events': 25,
  }),
  hackathons: Object.freeze({
    'Hackathons - Participation': 150,
    'Hackathons - 3rd Place': 250,
    'Hackathons - 2nd Place': 350,
    'Hackathons - 1st Place': 450,
  }),
  quizzes: Object.freeze({
    'Quiz Completion': 20,
    'Quiz 80%+ Score': 50,
    'Quiz Perfect Score': 70,
  }),
});

// ── Keyword rules for courseType matching ────────────────────────────
//
// Ordered list — first match wins.  The `key` is what we look for
// (case-insensitive substring) in the raw courseType string.  The
// `configSection` + `configKey` point at the value inside PointConfig.

/** @type {ReadonlyArray<{key: string, configSection: keyof PointConfig, configKey: string}>} */
const COURSE_TYPE_KEYWORDS = Object.freeze([
  { key: 'builder lab',                    configSection: 'awsCourseTypes', configKey: 'AWS Builder Lab' },
  { key: 'cloud quest',                    configSection: 'awsCourseTypes', configKey: 'AWS Cloud Quest' },
  { key: 'jam journey',                    configSection: 'awsCourseTypes', configKey: 'AWS Jam Journey' },
  { key: 'simulearn',                      configSection: 'awsCourseTypes', configKey: 'AWS Simulearn' },
  { key: 'certification exam preparation', configSection: 'awsCourseTypes', configKey: 'Certification Exam Preparation' },
  { key: 'with lab',                       configSection: 'awsCourseTypes', configKey: 'Digital Course With Lab' },
  { key: 'classroom',                      configSection: 'generalCourses', configKey: 'Classroom Training' },
]);

// ── Level-to-config mapping ─────────────────────────────────────────

/** @type {Record<string, string>} */
const LEVEL_MAP = Object.freeze({
  fundamental:  'Digital Courses - Foundational',
  intermediate: 'Digital Courses - Associate',
  advanced:     'Digital Courses - Professional',
  specialty:    'Digital Courses - Specialty',
});

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Case-insensitive lookup in a config section.
 * Returns the value if a key matches, or `undefined`.
 *
 * @param {Record<string, number>} section
 * @param {string} rawKey
 * @returns {number | undefined}
 */
function lookupCI(section, rawKey) {
  const lower = rawKey.toLowerCase();
  for (const key of Object.keys(section)) {
    if (key.toLowerCase() === lower) {
      return section[key];
    }
  }
  return undefined;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Calculate points for a course activity.
 *
 * Resolution order:
 * 1. Exact (case-insensitive) match against `config.awsCourseTypes`
 * 2. Keyword substring match against courseType (first match wins)
 * 3. Level-based lookup in `config.generalCourses`
 * 4. Fallback to `Digital Courses - Foundational`
 *
 * @param {string} courseType  - raw courseType from the import source
 * @param {string} level      - e.g. 'fundamental', 'intermediate', 'advanced', 'specialty'
 * @param {PointConfig} config
 * @returns {number}
 *
 * @example
 * calculateCoursePoints('AWS Cloud Quest', '', config) // => 75
 * @example
 * calculateCoursePoints('Some Builder Lab Course', '', config) // => 100
 * @example
 * calculateCoursePoints('Digital Course', 'advanced', config) // => 100
 * @example
 * calculateCoursePoints('', 'fundamental', config) // => 50
 * @example
 * calculateCoursePoints('', '', config) // => 50  (fallback)
 */
export function calculateCoursePoints(courseType, level, config) {
  const ct = (courseType ?? '').trim();

  if (ct) {
    const exact = lookupCI(config.awsCourseTypes, ct);
    if (exact !== undefined) return exact;

    const ctLower = ct.toLowerCase();
    for (const rule of COURSE_TYPE_KEYWORDS) {
      if (ctLower.includes(rule.key)) {
        return config[rule.configSection][rule.configKey];
      }
    }
  }

  if (level) {
    const configKey = LEVEL_MAP[level.toLowerCase()];
    if (configKey) return config.generalCourses[configKey];
  }

  return config.generalCourses['Digital Courses - Foundational'];
}

/**
 * Calculate bonus points for a quiz based on score.
 *
 * - score === 100  =>  Quiz Perfect Score
 * - score >= 80    =>  Quiz 80%+ Score
 * - otherwise      =>  Quiz Completion
 *
 * @param {number | null} score - 0-100 (null treated as 0)
 * @param {PointConfig} config
 * @returns {number}
 *
 * @example
 * calculateQuizBonus(100, config) // => 70
 * @example
 * calculateQuizBonus(85, config)  // => 50
 * @example
 * calculateQuizBonus(42, config)  // => 20
 * @example
 * calculateQuizBonus(null, config) // => 20
 */
export function calculateQuizBonus(score, config) {
  const s = score ?? 0;
  if (s === 100) return config.quizzes['Quiz Perfect Score'];
  if (s >= 80) return config.quizzes['Quiz 80%+ Score'];
  return config.quizzes['Quiz Completion'];
}

/**
 * Calculate hackathon points based on placement.
 *
 * @param {number | null} placement - 1, 2, 3 for podium; anything else = participation
 * @param {PointConfig} config
 * @returns {number}
 *
 * @example
 * calculateHackathonPoints(1, config) // => 450
 * @example
 * calculateHackathonPoints(2, config) // => 350
 * @example
 * calculateHackathonPoints(3, config) // => 250
 * @example
 * calculateHackathonPoints(null, config) // => 150
 * @example
 * calculateHackathonPoints(4, config) // => 150
 */
export function calculateHackathonPoints(placement, config) {
  if (placement === 1) return config.hackathons['Hackathons - 1st Place'];
  if (placement === 2) return config.hackathons['Hackathons - 2nd Place'];
  if (placement === 3) return config.hackathons['Hackathons - 3rd Place'];
  return config.hackathons['Hackathons - Participation'];
}

/**
 * Points awarded for attending a meeting / live event.
 *
 * @param {PointConfig} config
 * @returns {number}
 *
 * @example
 * calculateMeetingPoints(config) // => 25
 */
export function calculateMeetingPoints(config) {
  return config.events['Live Events'];
}

/**
 * Sum `pointsEarned` across a list of activities.
 *
 * The `config` parameter is accepted for forward-compatibility with
 * per-config scoring rules (e.g. point caps) but is currently unused.
 *
 * @param {Activity[]} activities
 * @param {PointConfig} _config - reserved for future scoring rules
 * @returns {number}
 *
 * @example
 * getTotalPoints([{ pointsEarned: 50 }, { pointsEarned: 75 }], config) // => 125
 * @example
 * getTotalPoints([], config) // => 0
 */
export function getTotalPoints(activities, _config) {
  let total = 0;
  for (const a of activities) {
    total += a.pointsEarned;
  }
  return total;
}

/**
 * Sum `pointsEarned` for activities completed in a given year/month.
 *
 * Compares against the `completedDate` ISO string (prefix `YYYY-MM`).
 *
 * @param {Activity[]} activities
 * @param {number} year  - e.g. 2026
 * @param {number} month - 1-12
 * @returns {number}
 *
 * @example
 * getMonthPoints(activities, 2026, 4) // points for April 2026
 * @example
 * getMonthPoints([], 2026, 1) // => 0
 */
export function getMonthPoints(activities, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  let total = 0;
  for (const a of activities) {
    if (a.completedDate && a.completedDate.startsWith(prefix)) {
      total += a.pointsEarned;
    }
  }
  return total;
}

/**
 * Sum `pointsEarned` for activities within a campaign window,
 * restricted to a set of eligible participant IDs.
 *
 * An activity counts if:
 * - its `userId` is in `participantIds`
 * - its `completedDate` >= `startDate`
 * - its `completedDate` <= `endDate` (if `endDate` is not null)
 *
 * @param {Activity[]} activities
 * @param {string[]}   participantIds - lowercase email IDs
 * @param {string}     startDate      - ISO 8601 (inclusive)
 * @param {string|null} endDate       - ISO 8601 (inclusive), null = open-ended
 * @param {PointConfig} _config       - reserved for future per-campaign scoring
 * @returns {number}
 *
 * @example
 * getCampaignPoints(activities, ['a@b.com'], '2026-01-01', '2026-03-31', config)
 */
export function getCampaignPoints(
  activities,
  participantIds,
  startDate,
  endDate,
  _config,
) {
  const ids = new Set(participantIds);
  let total = 0;
  for (const a of activities) {
    if (!ids.has(a.userId)) continue;
    if (!a.completedDate) continue;
    if (a.completedDate < startDate) continue;
    if (endDate !== null && a.completedDate > endDate) continue;
    total += a.pointsEarned;
  }
  return total;
}
