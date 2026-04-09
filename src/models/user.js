/**
 * @module user
 *
 * Canonical User data shape and pure helper functions.
 * No DOM access, no storage access, no side-effects.
 */

// ── Type definition ─────────────────────────────────────────────────

/**
 * @typedef {Object} User
 * @property {string}      id                 - lowercase email (primary key)
 * @property {string}      email              - lowercase email
 * @property {string}      name
 * @property {string|null} teamId
 * @property {number}      totalPoints
 * @property {number}      currentMonthPoints
 * @property {string[]}    badges             - array of BadgeId strings
 * @property {string}      createdAt          - ISO 8601
 */

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a new User with sensible defaults.
 *
 * @param {string} email - will be lowercased
 * @param {string} name
 * @returns {User}
 *
 * @example
 * createUser('Alice@Example.com', 'Alice') // => { id: 'alice@example.com', ... }
 */
export function createUser(email, name) {
  const lc = email.toLowerCase();
  return {
    id: lc,
    email: lc,
    name: name || lc.split('@')[0],
    teamId: null,
    totalPoints: 0,
    currentMonthPoints: 0,
    badges: [],
    createdAt: new Date().toISOString(),
  };
}

// ── Pure helpers ────────────────────────────────────────────────────

/**
 * Return a new User with added points.
 * Does **not** mutate the input.
 *
 * @param {User} user
 * @param {number} points
 * @param {boolean} isCurrentMonth - if true, also increments currentMonthPoints
 * @returns {User}
 *
 * @example
 * addPointsToUser(user, 50, true)  // totalPoints +50, currentMonthPoints +50
 * @example
 * addPointsToUser(user, 75, false) // totalPoints +75, currentMonthPoints unchanged
 */
export function addPointsToUser(user, points, isCurrentMonth) {
  return {
    ...user,
    totalPoints: user.totalPoints + points,
    currentMonthPoints: isCurrentMonth
      ? user.currentMonthPoints + points
      : user.currentMonthPoints,
  };
}
