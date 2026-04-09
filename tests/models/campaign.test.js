import { describe, it, expect } from 'vitest';
import { DEFAULT_POINT_CONFIG } from '../../src/models/points.js';
import {
  createCampaign,
  isCampaignActive,
  getCampaignParticipantIds,
  getCampaignLeaderboard,
  getCampaignTeamLeaderboard,
} from '../../src/models/campaign.js';

// ── Helpers ─────────────────────────────────────────────────────────

const cfg = DEFAULT_POINT_CONFIG;

function makeCampaign(overrides = {}) {
  return createCampaign({
    id: 'c1',
    name: 'Test Campaign',
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    participantIds: [],
    teamIds: [],
    ...overrides,
  });
}

function makeActivity(userId, points, completedDate, extra = {}) {
  return {
    id: `a_${userId}_${completedDate}`,
    userId,
    title: 'Test',
    type: 'course',
    pointsEarned: points,
    completedDate,
    isDuplicate: false,
    ...extra,
  };
}

// ── createCampaign ──────────────────────────────────────────────────

describe('createCampaign', () => {
  it('sets name and startDate from fields', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.name).toBe('Q1');
    expect(c.startDate).toBe('2026-01-01');
  });

  it('generates an id starting with camp_ when not provided', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.id).toMatch(/^camp_/);
  });

  it('uses provided id', () => {
    const c = createCampaign({ id: 'custom', name: 'Q1', startDate: '2026-01-01' });
    expect(c.id).toBe('custom');
  });

  it('defaults endDate to null', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.endDate).toBe(null);
  });

  it('defaults status to draft', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.status).toBe('draft');
  });

  it('defaults participantIds and teamIds to empty arrays', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.participantIds).toEqual([]);
    expect(c.teamIds).toEqual([]);
  });

  it('defaults color to blue', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.color).toBe('blue');
  });

  it('defaults description to empty string', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(c.description).toBe('');
  });

  it('sets createdAt to a valid ISO string', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    expect(new Date(c.createdAt).toISOString()).toBe(c.createdAt);
  });

  it('returns all 10 typedef properties', () => {
    const c = createCampaign({ name: 'Q1', startDate: '2026-01-01' });
    const keys = Object.keys(c).sort();
    expect(keys).toEqual([
      'color', 'createdAt', 'description', 'endDate', 'id',
      'name', 'participantIds', 'startDate', 'status', 'teamIds',
    ]);
  });
});

// ── isCampaignActive ────────────────────────────────────────────────

describe('isCampaignActive', () => {
  it('returns true for status=active with no endDate', () => {
    expect(isCampaignActive(makeCampaign({ status: 'active', endDate: null }))).toBe(true);
  });

  it('returns true for status=active before endDate', () => {
    expect(isCampaignActive(makeCampaign({
      status: 'active',
      endDate: '2099-12-31T23:59:59Z',
    }))).toBe(true);
  });

  it('returns false for status=active after endDate', () => {
    expect(isCampaignActive(makeCampaign({
      status: 'active',
      endDate: '2020-01-01T00:00:00Z',
    }))).toBe(false);
  });

  it('returns false for status=draft', () => {
    expect(isCampaignActive(makeCampaign({ status: 'draft', endDate: null }))).toBe(false);
  });

  it('returns false for status=completed', () => {
    expect(isCampaignActive(makeCampaign({ status: 'completed', endDate: null }))).toBe(false);
  });

  it('returns false for status=archived', () => {
    expect(isCampaignActive(makeCampaign({ status: 'archived', endDate: null }))).toBe(false);
  });
});

// ── getCampaignParticipantIds ───────────────────────────────────────

describe('getCampaignParticipantIds', () => {
  it('returns directly linked participantIds', () => {
    const c = makeCampaign({ participantIds: ['alice@b.com', 'bob@b.com'] });
    expect(getCampaignParticipantIds(c, {})).toEqual(['alice@b.com', 'bob@b.com']);
  });

  it('includes all members of linked teams', () => {
    const c = makeCampaign({ teamIds: ['t1'] });
    const teams = { t1: { id: 't1', memberIds: ['charlie@b.com'] } };
    expect(getCampaignParticipantIds(c, teams)).toContain('charlie@b.com');
  });

  it('deduplicates users who appear in both participantIds and a linked team', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com'],
      teamIds: ['t1'],
    });
    const teams = { t1: { id: 't1', memberIds: ['alice@b.com', 'bob@b.com'] } };
    const result = getCampaignParticipantIds(c, teams);
    const aliceCount = result.filter(id => id === 'alice@b.com').length;
    expect(aliceCount).toBe(1);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no participants or teams are linked', () => {
    expect(getCampaignParticipantIds(makeCampaign(), {})).toEqual([]);
  });

  it('handles a team with no members', () => {
    const c = makeCampaign({ teamIds: ['t1'] });
    const teams = { t1: { id: 't1', memberIds: [] } };
    expect(getCampaignParticipantIds(c, teams)).toEqual([]);
  });

  it('ignores teamIds that do not exist in teams', () => {
    const c = makeCampaign({ teamIds: ['nonexistent'] });
    expect(getCampaignParticipantIds(c, {})).toEqual([]);
  });

  it('handles multiple teams', () => {
    const c = makeCampaign({ teamIds: ['t1', 't2'] });
    const teams = {
      t1: { id: 't1', memberIds: ['a@b.com'] },
      t2: { id: 't2', memberIds: ['c@d.com'] },
    };
    const result = getCampaignParticipantIds(c, teams);
    expect(result).toHaveLength(2);
    expect(result).toContain('a@b.com');
    expect(result).toContain('c@d.com');
  });
});

// ── getCampaignLeaderboard ──────────────────────────────────────────

describe('getCampaignLeaderboard', () => {
  const users = {
    'alice@b.com': { name: 'Alice' },
    'bob@b.com': { name: 'Bob' },
    'charlie@b.com': { name: 'Charlie' },
  };

  const activities = [
    makeActivity('alice@b.com', 100, '2026-03-15T00:00:00Z'),
    makeActivity('alice@b.com', 50, '2026-06-15T00:00:00Z'),
    makeActivity('bob@b.com', 200, '2026-04-10T00:00:00Z'),
    makeActivity('charlie@b.com', 75, '2026-05-01T00:00:00Z'),
    makeActivity('alice@b.com', 30, '2025-12-01T00:00:00Z'), // before campaign
    makeActivity('bob@b.com', 999, '2027-01-01T00:00:00Z'),  // after campaign
  ];

  it('ranks participants by points descending', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com'],
    });
    const lb = getCampaignLeaderboard(c, users, {}, activities, cfg);
    expect(lb[0].userId).toBe('bob@b.com');
    expect(lb[0].points).toBe(200);
    expect(lb[1].userId).toBe('alice@b.com');
    expect(lb[1].points).toBe(150);
    expect(lb[2].userId).toBe('charlie@b.com');
    expect(lb[2].points).toBe(75);
  });

  it('only counts activities within campaign date window', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com'],
    });
    const lb = getCampaignLeaderboard(c, users, {}, activities, cfg);
    // alice: 100+50=150 (excludes 30 from 2025)
    // bob: 200 (excludes 999 from 2027)
    expect(lb.find(e => e.userId === 'alice@b.com').points).toBe(150);
    expect(lb.find(e => e.userId === 'bob@b.com').points).toBe(200);
  });

  it('only counts activities from eligible participants', () => {
    const c = makeCampaign({ participantIds: ['alice@b.com'] });
    const lb = getCampaignLeaderboard(c, users, {}, activities, cfg);
    expect(lb).toHaveLength(1);
    expect(lb[0].userId).toBe('alice@b.com');
  });

  it('correctly handles tied points (same rank, next rank skipped)', () => {
    const tiedActivities = [
      makeActivity('alice@b.com', 100, '2026-03-15T00:00:00Z'),
      makeActivity('bob@b.com', 100, '2026-04-10T00:00:00Z'),
      makeActivity('charlie@b.com', 50, '2026-05-01T00:00:00Z'),
    ];
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com'],
    });
    const lb = getCampaignLeaderboard(c, users, {}, tiedActivities, cfg);
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(1);
    expect(lb[2].rank).toBe(3); // skips rank 2
  });

  it('returns empty array when no eligible activities exist', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com'],
      startDate: '2099-01-01T00:00:00Z',
    });
    const lb = getCampaignLeaderboard(c, users, {}, activities, cfg);
    // alice is a participant but has 0 points (no activities in range)
    expect(lb).toHaveLength(1);
    expect(lb[0].points).toBe(0);
  });

  it('excludes isDuplicate activities from scoring', () => {
    const dupeActivities = [
      makeActivity('alice@b.com', 100, '2026-03-15T00:00:00Z', { isDuplicate: true }),
      makeActivity('alice@b.com', 50, '2026-06-15T00:00:00Z'),
    ];
    const c = makeCampaign({ participantIds: ['alice@b.com'] });
    const lb = getCampaignLeaderboard(c, users, {}, dupeActivities, cfg);
    expect(lb[0].points).toBe(50);
  });

  it('includes team members via teamIds', () => {
    const teams = { t1: { id: 't1', memberIds: ['bob@b.com'] } };
    const c = makeCampaign({
      participantIds: ['alice@b.com'],
      teamIds: ['t1'],
    });
    const lb = getCampaignLeaderboard(c, users, teams, activities, cfg);
    expect(lb).toHaveLength(2);
  });

  it('uses userId as name fallback for unknown users', () => {
    const c = makeCampaign({ participantIds: ['unknown@b.com'] });
    const lb = getCampaignLeaderboard(c, {}, {}, [], cfg);
    expect(lb[0].name).toBe('unknown@b.com');
  });
});

// ── getCampaignTeamLeaderboard ──────────────────────────────────────

describe('getCampaignTeamLeaderboard', () => {
  const users = {
    'alice@b.com': { name: 'Alice' },
    'bob@b.com': { name: 'Bob' },
    'charlie@b.com': { name: 'Charlie' },
    'dave@b.com': { name: 'Dave' },
  };

  const teams = {
    t1: { id: 't1', name: 'Alpha', memberIds: ['alice@b.com', 'bob@b.com'] },
    t2: { id: 't2', name: 'Beta', memberIds: ['charlie@b.com', 'dave@b.com'] },
  };

  const activities = [
    makeActivity('alice@b.com', 100, '2026-03-15T00:00:00Z'),
    makeActivity('bob@b.com', 50, '2026-04-10T00:00:00Z'),
    makeActivity('charlie@b.com', 200, '2026-05-01T00:00:00Z'),
    makeActivity('dave@b.com', 25, '2026-06-01T00:00:00Z'),
  ];

  it('aggregates points across all team members who are campaign participants', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com', 'dave@b.com'],
      teamIds: ['t1', 't2'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, activities, cfg);
    expect(lb.find(e => e.teamId === 't2').points).toBe(225); // charlie+dave
    expect(lb.find(e => e.teamId === 't1').points).toBe(150); // alice+bob
  });

  it('auto-includes all team members as participants when their team is linked', () => {
    // Even though only alice and charlie are in participantIds,
    // linking t1 and t2 via teamIds auto-includes bob and dave.
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'charlie@b.com'],
      teamIds: ['t1', 't2'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, activities, cfg);
    expect(lb.find(e => e.teamId === 't1').points).toBe(150); // alice + bob (auto-included)
    expect(lb.find(e => e.teamId === 't1').memberCount).toBe(2);
  });

  it('ranks teams by combined eligible points', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com', 'dave@b.com'],
      teamIds: ['t1', 't2'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, activities, cfg);
    expect(lb[0].teamId).toBe('t2'); // 225 > 150
    expect(lb[0].rank).toBe(1);
    expect(lb[1].teamId).toBe('t1');
    expect(lb[1].rank).toBe(2);
  });

  it('correctly counts only activities within campaign date window', () => {
    const narrowActivities = [
      ...activities,
      makeActivity('alice@b.com', 999, '2025-01-01T00:00:00Z'), // before
      makeActivity('bob@b.com', 888, '2027-06-01T00:00:00Z'),   // after
    ];
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com'],
      teamIds: ['t1'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, narrowActivities, cfg);
    expect(lb[0].points).toBe(150); // only in-range activities
  });

  it('returns empty array when no teams are linked', () => {
    const c = makeCampaign({ participantIds: ['alice@b.com'], teamIds: [] });
    expect(getCampaignTeamLeaderboard(c, users, teams, activities, cfg)).toEqual([]);
  });

  it('handles ties with shared rank', () => {
    const tiedActivities = [
      makeActivity('alice@b.com', 100, '2026-03-15T00:00:00Z'),
      makeActivity('bob@b.com', 0, '2026-04-10T00:00:00Z'),
      makeActivity('charlie@b.com', 100, '2026-05-01T00:00:00Z'),
      makeActivity('dave@b.com', 0, '2026-06-01T00:00:00Z'),
    ];
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com', 'dave@b.com'],
      teamIds: ['t1', 't2'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, tiedActivities, cfg);
    expect(lb[0].rank).toBe(1);
    expect(lb[1].rank).toBe(1); // tied
  });

  it('includes memberCount in each entry', () => {
    const c = makeCampaign({
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com', 'dave@b.com'],
      teamIds: ['t1', 't2'],
    });
    const lb = getCampaignTeamLeaderboard(c, users, teams, activities, cfg);
    expect(lb.find(e => e.teamId === 't1').memberCount).toBe(2);
    expect(lb.find(e => e.teamId === 't2').memberCount).toBe(2);
  });
});
