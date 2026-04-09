/**
 * @module deduplication
 *
 * Determines whether an incoming activity is a duplicate of one
 * already in the system.  This is the single source of truth for
 * deduplication logic — no other module should reimplement it.
 *
 * ## Deduplication key
 *
 * Two activities are duplicates when **both** of these match
 * (case-insensitive on userId):
 *
 *   1. `userId`     — the lowercase email of the learner
 *   2. `externalId` — the course ID, meeting ID, or other source
 *                      identifier that came from the import file
 *
 * The `activity.id` field (which encodes userId + externalId via
 * `generateActivityId`) is **not** used for comparison because
 * legacy data may have IDs generated with a different scheme.
 * Comparing the two components directly is safer.
 *
 * See ARCH_DECISIONS.md for the full rationale.
 */

// ── Types ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} DeduplicateResult
 * @property {Activity[]} accepted          - activities that passed dedup
 * @property {Activity[]} duplicates        - activities flagged as duplicates
 * @property {{ accepted: number, duplicatesSkipped: number }} stats
 */

/**
 * @typedef {import('../models/activity.js').Activity} Activity
 */

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Build the dedup key from an activity's userId and externalId.
 * Both components are normalised: userId lowercased, externalId
 * trimmed and lowercased.
 *
 * @param {*} activity - must have `userId` and `externalId` properties
 * @returns {string}
 */
function dedupKey(activity) {
  const uid = (activity.userId ?? '').toLowerCase();
  const eid = (activity.externalId ?? '').trim().toLowerCase();
  return `${uid}|${eid}`;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Check whether a single activity is a duplicate of any activity
 * in `existingActivities`.
 *
 * Comparison is by `userId` + `externalId`, case-insensitive.
 *
 * @param {*} activity            - must have `userId` and `externalId`
 * @param {*[]} existingActivities - array to search for a match
 * @returns {boolean}
 *
 * @example
 * isDuplicate(
 *   { userId: 'alice@b.com', externalId: 'COURSE-1' },
 *   [{ userId: 'alice@b.com', externalId: 'COURSE-1' }],
 * ) // => true
 *
 * @example
 * isDuplicate(
 *   { userId: 'alice@b.com', externalId: 'COURSE-2' },
 *   [{ userId: 'alice@b.com', externalId: 'COURSE-1' }],
 * ) // => false
 */
export function isDuplicate(activity, existingActivities) {
  const key = dedupKey(activity);
  return existingActivities.some(a => dedupKey(a) === key);
}

/**
 * Separate an incoming batch into accepted and duplicate activities,
 * checked against an existing set AND against earlier items within
 * the same batch (so two identical rows in one import don't both
 * get accepted).
 *
 * Does **not** mutate `incoming` or `existing`.
 *
 * @param {*[]} incoming  - activities to evaluate
 * @param {*[]} existing  - activities already persisted
 * @returns {DeduplicateResult}
 *
 * @example
 * const { accepted, duplicates, stats } = deduplicateBatch(batch, stored);
 * // accepted:   activities safe to persist
 * // duplicates: activities that matched an existing or earlier-in-batch entry
 * // stats:      { accepted: 5, duplicatesSkipped: 2 }
 */
export function deduplicateBatch(incoming, existing) {
  const seen = new Set(existing.map(a => dedupKey(a)));
  const accepted = [];
  const duplicates = [];

  for (const activity of incoming) {
    const key = dedupKey(activity);
    if (seen.has(key)) {
      duplicates.push(activity);
    } else {
      seen.add(key);
      accepted.push(activity);
    }
  }

  return {
    accepted,
    duplicates,
    stats: {
      accepted: accepted.length,
      duplicatesSkipped: duplicates.length,
    },
  };
}
