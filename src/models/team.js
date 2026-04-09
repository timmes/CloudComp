/**
 * @module team
 *
 * Canonical Team data shape and pure helper functions.
 * No DOM access, no storage access, no side-effects.
 */

// ── Type definition ─────────────────────────────────────────────────

/**
 * @typedef {Object} Team
 * @property {string}   id
 * @property {string}   name
 * @property {string}   color       - Tailwind color key: 'slate'|'blue'|'teal'|'green'|'amber'|'orange'|'rose'|'purple'
 * @property {string}   description
 * @property {string[]} memberIds   - array of lowercase user emails
 * @property {string}   createdAt   - ISO 8601
 */

/**
 * @typedef {import('./user.js').User} User
 */

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a new Team with sensible defaults.
 *
 * @param {string} name
 * @param {string} color - Tailwind color key
 * @param {string} [description='']
 * @returns {Team}
 *
 * @example
 * createTeam('Alpha Squad', 'blue', 'The first team')
 */
export function createTeam(name, color, description = '') {
  return {
    id: `team_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name,
    color,
    description,
    memberIds: [],
    createdAt: new Date().toISOString(),
  };
}

// ── Pure helpers ────────────────────────────────────────────────────

/**
 * Calculate the sum of `totalPoints` across all team members.
 *
 * Members whose email does not appear in `users` are treated as
 * 0 points (not an error).
 *
 * @param {Team} team
 * @param {Record<string, User>} users - keyed by lowercase email
 * @returns {number}
 *
 * @example
 * calculateTeamPoints(team, users) // => 325
 */
export function calculateTeamPoints(team, users) {
  let total = 0;
  for (const id of team.memberIds) {
    total += users[id]?.totalPoints ?? 0;
  }
  return total;
}

/**
 * Calculate the sum of `currentMonthPoints` across all team members.
 *
 * Members whose email does not appear in `users` are treated as
 * 0 points (not an error).
 *
 * @param {Team} team
 * @param {Record<string, User>} users - keyed by lowercase email
 * @returns {number}
 *
 * @example
 * calculateTeamMonthPoints(team, users) // => 150
 */
export function calculateTeamMonthPoints(team, users) {
  let total = 0;
  for (const id of team.memberIds) {
    total += users[id]?.currentMonthPoints ?? 0;
  }
  return total;
}
