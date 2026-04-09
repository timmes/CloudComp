/**
 * @module campaign
 *
 * Canonical Campaign data shape and pure helper functions.
 * No DOM access, no storage access, no side-effects.
 */

// ── Type definitions ────────────────────────────────────────────────

/**
 * @typedef {Object} Campaign
 * @property {string}      id
 * @property {string}      name
 * @property {string}      description
 * @property {string}      startDate       - ISO 8601
 * @property {string|null} endDate         - null = open-ended
 * @property {string}      status          - 'draft'|'active'|'completed'|'archived'
 * @property {string[]}    participantIds  - directly linked user IDs (lowercase emails)
 * @property {string[]}    teamIds         - linked team IDs; members are auto-included
 * @property {string}      color           - Tailwind color key for visual accent
 * @property {string}      createdAt       - ISO 8601
 */

/**
 * @typedef {import('./user.js').User} User
 * @typedef {import('./team.js').Team} Team
 * @typedef {import('./activity.js').Activity} Activity
 * @typedef {import('./points.js').PointConfig} PointConfig
 */

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} userId
 * @property {string} name
 * @property {number} points
 * @property {number} rank
 */

/**
 * @typedef {Object} TeamLeaderboardEntry
 * @property {string} teamId
 * @property {string} name
 * @property {number} points
 * @property {number} memberCount
 * @property {number} rank
 */

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Create a new Campaign with sensible defaults.
 *
 * @param {Partial<Campaign> & { name: string, startDate: string }} fields
 * @returns {Campaign}
 *
 * @example
 * createCampaign({ name: 'Q1 Push', startDate: '2026-01-01' })
 */
export function createCampaign(fields) {
  return {
    id: fields.id ?? `camp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    name: fields.name,
    description: fields.description ?? '',
    startDate: fields.startDate,
    endDate: fields.endDate ?? null,
    status: fields.status ?? 'draft',
    participantIds: fields.participantIds ?? [],
    teamIds: fields.teamIds ?? [],
    color: fields.color ?? 'blue',
    createdAt: fields.createdAt ?? new Date().toISOString(),
  };
}

// ── Status helpers ──────────────────────────────────────────────────

/**
 * Whether the campaign is currently active.
 *
 * A campaign is active when its `status` is `'active'` AND the
 * current date has not passed its `endDate` (if one is set).
 *
 * @param {Campaign} campaign
 * @returns {boolean}
 *
 * @example
 * isCampaignActive({ status: 'active', endDate: null, ... })    // true
 * @example
 * isCampaignActive({ status: 'active', endDate: '2020-01-01' }) // false (past)
 * @example
 * isCampaignActive({ status: 'draft', endDate: null, ... })     // false
 */
export function isCampaignActive(campaign) {
  if (campaign.status !== 'active') return false;
  if (campaign.endDate === null) return true;
  return new Date().toISOString() <= campaign.endDate;
}

// ── Participant resolution ──────────────────────────────────────────

/**
 * Canonical participant resolution.
 *
 * Returns the union of `participantIds` and all members of linked
 * teams, deduplicated.  No other code should reimplement this logic.
 *
 * @param {Campaign} campaign
 * @param {Record<string, Team>} teams
 * @returns {string[]} array of unique user IDs
 *
 * @example
 * getCampaignParticipantIds(campaign, teams)
 * // => ['alice@b.com', 'bob@b.com']
 */
export function getCampaignParticipantIds(campaign, teams) {
  const ids = new Set(campaign.participantIds ?? []);
  for (const teamId of campaign.teamIds ?? []) {
    const team = teams[teamId];
    if (team) {
      for (const memberId of team.memberIds ?? []) {
        ids.add(memberId);
      }
    }
  }
  return [...ids];
}

// ── Leaderboard helpers ─────────────────────────────────────────────

/**
 * Build a user leaderboard for a campaign.
 *
 * Only activities within the campaign date window from eligible
 * participants are counted.  Entries are sorted by points descending.
 * Tied users share the same rank; the next rank is skipped.
 *
 * @param {Campaign} campaign
 * @param {Record<string, User>} users
 * @param {Record<string, Team>} teams
 * @param {Activity[]} activities
 * @param {PointConfig} config
 * @returns {LeaderboardEntry[]}
 *
 * @example
 * getCampaignLeaderboard(campaign, users, teams, activities, config)
 */
export function getCampaignLeaderboard(
  campaign, users, teams, activities, _config,
) {
  const participantIds = getCampaignParticipantIds(campaign, teams);
  const eligible = filterCampaignActivities(
    activities, participantIds, campaign,
  );
  return buildUserLeaderboard(eligible, participantIds, users);
}

/**
 * Build a team leaderboard for a campaign.
 *
 * For each linked team, sums points from team members who are also
 * campaign participants, within the campaign date window.
 * Sorted by points descending with shared-rank tie-breaking.
 *
 * @param {Campaign} campaign
 * @param {Record<string, User>} users
 * @param {Record<string, Team>} teams
 * @param {Activity[]} activities
 * @param {PointConfig} config
 * @returns {TeamLeaderboardEntry[]}
 *
 * @example
 * getCampaignTeamLeaderboard(campaign, users, teams, activities, config)
 */
export function getCampaignTeamLeaderboard(
  campaign, users, teams, activities, _config,
) {
  const participantIds = getCampaignParticipantIds(campaign, teams);
  const participantSet = new Set(participantIds);
  const eligible = filterCampaignActivities(
    activities, participantIds, campaign,
  );
  return buildTeamLeaderboard(
    eligible, campaign, teams, participantSet,
  );
}

// ── Internal helpers ────────────────────────────────────────────────

/**
 * @param {Activity[]} activities
 * @param {string[]} participantIds
 * @param {Campaign} campaign
 * @returns {Activity[]}
 */
function filterCampaignActivities(activities, participantIds, campaign) {
  const ids = new Set(participantIds);
  return activities.filter(a => {
    if (a.isDuplicate) return false;
    if (!ids.has(a.userId)) return false;
    if (!a.completedDate) return false;
    if (a.completedDate < campaign.startDate) return false;
    if (campaign.endDate && a.completedDate > campaign.endDate) return false;
    return true;
  });
}

/**
 * @param {Activity[]} eligible
 * @param {string[]} participantIds
 * @param {Record<string, User>} users
 * @returns {LeaderboardEntry[]}
 */
function buildUserLeaderboard(eligible, participantIds, users) {
  const pointsByUser = new Map();
  for (const id of participantIds) {
    pointsByUser.set(id, 0);
  }
  for (const a of eligible) {
    pointsByUser.set(a.userId, (pointsByUser.get(a.userId) ?? 0) + a.pointsEarned);
  }

  const sorted = [...pointsByUser.entries()]
    .map(([userId, points]) => ({
      userId,
      name: users[userId]?.name ?? userId,
      points,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points);

  return assignRanks(sorted);
}

/**
 * @param {Activity[]} eligible
 * @param {Campaign} campaign
 * @param {Record<string, Team>} teams
 * @param {Set<string>} participantSet
 * @returns {TeamLeaderboardEntry[]}
 */
function buildTeamLeaderboard(eligible, campaign, teams, participantSet) {
  const pointsByTeam = new Map();

  for (const teamId of campaign.teamIds ?? []) {
    const team = teams[teamId];
    if (!team) continue;

    const eligibleMembers = (team.memberIds ?? [])
      .filter(id => participantSet.has(id));
    const memberSet = new Set(eligibleMembers);

    let teamPoints = 0;
    for (const a of eligible) {
      if (memberSet.has(a.userId)) {
        teamPoints += a.pointsEarned;
      }
    }

    pointsByTeam.set(teamId, {
      teamId,
      name: team.name,
      points: teamPoints,
      memberCount: eligibleMembers.length,
      rank: 0,
    });
  }

  const sorted = [...pointsByTeam.values()]
    .sort((a, b) => b.points - a.points);

  return assignRanks(sorted);
}

/**
 * Assign ranks with ties: tied entries share the same rank and
 * the next rank is skipped.  Returns a new array — no mutation.
 *
 * @template {Object & { points: number, rank: number }} T
 * @param {T[]} sorted - must already be sorted by points descending
 * @returns {T[]}
 */
function assignRanks(sorted) {
  let currentRank = 1;
  return sorted.map((entry, i, arr) => {
    if (i > 0 && entry.points < arr[i - 1].points) {
      currentRank = i + 1;
    }
    return { ...entry, rank: currentRank };
  });
}
