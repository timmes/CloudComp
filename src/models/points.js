/**
 * @module points
 *
 * Pure scoring logic for CloudComp.  Every function is deterministic --
 * no DOM access, no localStorage, no side-effects.  Point values come
 * from a caller-supplied {@link PointConfig} object.
 */

// ── Type definitions ────────────────────────────────────────────────

/**
 * @typedef {Object} PointConfig
 * @property {Record<string, number>} selfPacedDigital
 * @property {Record<string, number>} liveLearning
 * @property {Record<string, number>} certifications
 * @property {Record<string, number>} gamifiedEvents
 * @property {Record<string, number>} communityEngagement
 */

/**
 * @typedef {Object} Activity
 * @property {string}      id
 * @property {string}      userId
 * @property {string}      title
 * @property {string}      type
 * @property {string}      level
 * @property {string}      courseType
 * @property {number}      pointsEarned
 * @property {string|null} completedDate - ISO 8601
 * @property {string}      status        - 'completed'|'in_progress'|'enrolled'
 * @property {string}      source
 * @property {number|null} score
 * @property {boolean}     isDuplicate
 */

// ── Default config ──────────────────────────────────────────────────

/** @type {PointConfig} */
export const DEFAULT_POINT_CONFIG = Object.freeze({
  selfPacedDigital: Object.freeze({
    'Skill Builder Course':        50,
    'Skill Builder Learning Plan': 150,
    'Cloud Quest Role':            100,
    'Escape Room Challenge':       75,
    'Foundational Training Pkg':   100,
    'Quiz Completion':             25,
  }),
  liveLearning: Object.freeze({
    'Live Webinar':                25,
    'Workshop First Hour':         30,
    'Workshop Full + Hands-on':    75,
    'Office Hours Session':        20,
    'Office Hours Q Submitted':    10,
    'Hands-on Challenge':          50,
  }),
  certifications: Object.freeze({
    'Cloud Practitioner':          200,
    'AI Practitioner':             200,
    'Associate Cert':              300,
    'Professional/Specialty Cert': 500,
    'AWS Jam Challenge':           100,
  }),
  gamifiedEvents: Object.freeze({
    'Participate Event':           50,
    'Top 3 Bonus':                 100,
    'Participate Hackathon':       100,
    'Hackathon Prototype Bonus':   200,
  }),
  communityEngagement: Object.freeze({
    'Join Channel':                10,
    'First Question':              10,
    'Share Resource':              15,
    'Champion Knowledge-sharing':  25,
    'Survey Feedback':             10,
  }),
});

// ── Public API ──────────────────────────────────────────────────────

/**
 * Look up points for an activity by category and sub-category.
 *
 * @param {string} category    - e.g. 'selfPacedDigital'
 * @param {string} subCategory - e.g. 'Skill Builder < 2h'
 * @param {PointConfig} config
 * @returns {number} points, or 0 if not found
 *
 * @example
 * calculateActivityPoints('selfPacedDigital', 'Cloud Quest Role', config) // => 100
 * @example
 * calculateActivityPoints('liveLearning', 'Live Webinar', config) // => 25
 */
export function calculateActivityPoints(category, subCategory, config) {
  const section = config[category];
  if (!section) return 0;
  return section[subCategory] ?? 0;
}

/**
 * Sum `pointsEarned` across a list of activities.
 * Skips non-completed activities.
 *
 * @param {Activity[]} activities
 * @param {PointConfig} _config - reserved for future scoring rules
 * @returns {number}
 */
export function getTotalPoints(activities, _config) {
  let total = 0;
  for (const a of activities) {
    if (a.status && a.status !== 'completed') continue;
    total += a.pointsEarned;
  }
  return total;
}

/**
 * Sum `pointsEarned` for activities completed in a given year/month.
 *
 * @param {Activity[]} activities
 * @param {number} year  - e.g. 2026
 * @param {number} month - 1-12
 * @returns {number}
 */
export function getMonthPoints(activities, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  let total = 0;
  for (const a of activities) {
    if (a.status && a.status !== 'completed') continue;
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
 * @param {Activity[]} activities
 * @param {string[]}   participantIds
 * @param {string}     startDate - ISO 8601 (inclusive)
 * @param {string|null} endDate  - ISO 8601 (inclusive), null = open-ended
 * @param {PointConfig} _config
 * @returns {number}
 */
export function getCampaignPoints(
  activities, participantIds, startDate, endDate, _config,
) {
  const ids = new Set(participantIds);
  let total = 0;
  for (const a of activities) {
    if (a.status && a.status !== 'completed') continue;
    if (!ids.has(a.userId)) continue;
    if (!a.completedDate) continue;
    if (a.completedDate < startDate) continue;
    if (endDate !== null && a.completedDate > endDate) continue;
    total += a.pointsEarned;
  }
  return total;
}
