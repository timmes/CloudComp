import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POINT_CONFIG,
  calculateActivityPoints,
  getTotalPoints,
  getMonthPoints,
  getCampaignPoints,
} from '../../src/models/points.js';

// ── Helpers ─────────────────────────────────────────────────────────

function activity(points, completedDate = '2026-04-15T00:00:00Z', userId = 'a@b.com') {
  return { pointsEarned: points, completedDate, userId };
}

const cfg = DEFAULT_POINT_CONFIG;

// ── calculateActivityPoints ─────────────────────────────────────────

describe('calculateActivityPoints', () => {
  it('looks up selfPacedDigital values', () => {
    expect(calculateActivityPoints('selfPacedDigital', 'Skill Builder Course', cfg)).toBe(50);
    expect(calculateActivityPoints('selfPacedDigital', 'Skill Builder Learning Plan', cfg)).toBe(150);
    expect(calculateActivityPoints('selfPacedDigital', 'Cloud Quest Role', cfg)).toBe(100);
    expect(calculateActivityPoints('selfPacedDigital', 'Escape Room Challenge', cfg)).toBe(75);
    expect(calculateActivityPoints('selfPacedDigital', 'Foundational Training Pkg', cfg)).toBe(100);
    expect(calculateActivityPoints('selfPacedDigital', 'Quiz Completion', cfg)).toBe(25);
  });

  it('looks up liveLearning values', () => {
    expect(calculateActivityPoints('liveLearning', 'Live Webinar', cfg)).toBe(25);
    expect(calculateActivityPoints('liveLearning', 'Workshop First Hour', cfg)).toBe(30);
    expect(calculateActivityPoints('liveLearning', 'Workshop Full + Hands-on', cfg)).toBe(75);
    expect(calculateActivityPoints('liveLearning', 'Office Hours Session', cfg)).toBe(20);
    expect(calculateActivityPoints('liveLearning', 'Office Hours Q Submitted', cfg)).toBe(10);
    expect(calculateActivityPoints('liveLearning', 'Hands-on Challenge', cfg)).toBe(50);
  });

  it('looks up certifications values', () => {
    expect(calculateActivityPoints('certifications', 'Cloud Practitioner', cfg)).toBe(200);
    expect(calculateActivityPoints('certifications', 'AI Practitioner', cfg)).toBe(200);
    expect(calculateActivityPoints('certifications', 'Associate Cert', cfg)).toBe(300);
    expect(calculateActivityPoints('certifications', 'Professional/Specialty Cert', cfg)).toBe(500);
    expect(calculateActivityPoints('certifications', 'AWS Jam Challenge', cfg)).toBe(100);
  });

  it('looks up gamifiedEvents values', () => {
    expect(calculateActivityPoints('gamifiedEvents', 'Participate Event', cfg)).toBe(50);
    expect(calculateActivityPoints('gamifiedEvents', 'Top 3 Bonus', cfg)).toBe(100);
    expect(calculateActivityPoints('gamifiedEvents', 'Participate Hackathon', cfg)).toBe(100);
    expect(calculateActivityPoints('gamifiedEvents', 'Hackathon Prototype Bonus', cfg)).toBe(200);
  });

  it('looks up communityEngagement values', () => {
    expect(calculateActivityPoints('communityEngagement', 'Join Channel', cfg)).toBe(10);
    expect(calculateActivityPoints('communityEngagement', 'First Question', cfg)).toBe(10);
    expect(calculateActivityPoints('communityEngagement', 'Share Resource', cfg)).toBe(15);
    expect(calculateActivityPoints('communityEngagement', 'Champion Knowledge-sharing', cfg)).toBe(25);
    expect(calculateActivityPoints('communityEngagement', 'Survey Feedback', cfg)).toBe(10);
  });

  it('returns 0 for unknown category', () => {
    expect(calculateActivityPoints('nonexistent', 'anything', cfg)).toBe(0);
  });

  it('returns 0 for unknown subCategory', () => {
    expect(calculateActivityPoints('selfPacedDigital', 'nonexistent', cfg)).toBe(0);
  });

  it('respects custom config values', () => {
    const custom = { ...cfg, selfPacedDigital: { ...cfg.selfPacedDigital, 'Cloud Quest Role': 999 } };
    expect(calculateActivityPoints('selfPacedDigital', 'Cloud Quest Role', custom)).toBe(999);
  });
});

// ── getTotalPoints ──────────────────────────────────────────────────

describe('getTotalPoints', () => {
  it('sums pointsEarned across activities', () => {
    const acts = [activity(50), activity(75), activity(100)];
    expect(getTotalPoints(acts, cfg)).toBe(225);
  });

  it('returns 0 for empty array', () => {
    expect(getTotalPoints([], cfg)).toBe(0);
  });

  it('returns correct total for single activity', () => {
    expect(getTotalPoints([activity(42)], cfg)).toBe(42);
  });

  it('skips non-completed activities', () => {
    const acts = [
      activity(50),
      { pointsEarned: 100, completedDate: null, userId: 'x@y.com', status: 'in_progress' },
    ];
    expect(getTotalPoints(acts, cfg)).toBe(50);
  });
});

// ── getMonthPoints ──────────────────────────────────────────────────

describe('getMonthPoints', () => {
  it('sums only activities in the specified month', () => {
    const acts = [
      activity(50, '2026-04-01T00:00:00Z'),
      activity(75, '2026-04-30T23:59:59Z'),
      activity(100, '2026-05-01T00:00:00Z'),
      activity(25, '2026-03-31T23:59:59Z'),
    ];
    expect(getMonthPoints(acts, 2026, 4)).toBe(125);
  });

  it('returns 0 when no activities match', () => {
    const acts = [activity(50, '2026-01-15T00:00:00Z')];
    expect(getMonthPoints(acts, 2026, 4)).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(getMonthPoints([], 2026, 4)).toBe(0);
  });

  it('handles single-digit month (pads to 2 digits)', () => {
    const acts = [activity(50, '2026-01-15T00:00:00Z')];
    expect(getMonthPoints(acts, 2026, 1)).toBe(50);
  });

  it('skips activities with null completedDate', () => {
    const acts = [
      activity(50, '2026-04-15T00:00:00Z'),
      { pointsEarned: 100, completedDate: null, userId: 'x@y.com' },
    ];
    expect(getMonthPoints(acts, 2026, 4)).toBe(50);
  });
});

// ── getCampaignPoints ───────────────────────────────────────────────

describe('getCampaignPoints', () => {
  const alice = 'alice@example.com';
  const bob = 'bob@example.com';
  const charlie = 'charlie@example.com';

  const campaignActivities = [
    activity(50, '2026-01-15T00:00:00Z', alice),
    activity(75, '2026-02-10T00:00:00Z', alice),
    activity(100, '2026-03-20T00:00:00Z', bob),
    activity(25, '2026-04-05T00:00:00Z', alice),
    activity(30, '2026-02-15T00:00:00Z', charlie),
  ];

  it('counts only activities within campaign date range', () => {
    const result = getCampaignPoints(
      campaignActivities, [alice, bob, charlie],
      '2026-02-01T00:00:00Z', '2026-03-31T23:59:59Z', cfg,
    );
    expect(result).toBe(205);
  });

  it('counts only activities from eligible participantIds', () => {
    const result = getCampaignPoints(
      campaignActivities, [alice],
      '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', cfg,
    );
    expect(result).toBe(150);
  });

  it('returns 0 when no activities fall within range', () => {
    const result = getCampaignPoints(
      campaignActivities, [alice, bob],
      '2027-01-01T00:00:00Z', '2027-12-31T23:59:59Z', cfg,
    );
    expect(result).toBe(0);
  });

  it('returns 0 when participantIds is empty', () => {
    const result = getCampaignPoints(
      campaignActivities, [],
      '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z', cfg,
    );
    expect(result).toBe(0);
  });

  it('handles open-ended campaign (null endDate)', () => {
    const result = getCampaignPoints(
      campaignActivities, [alice, bob, charlie],
      '2026-03-01T00:00:00Z', null, cfg,
    );
    expect(result).toBe(125);
  });

  it('handles empty activities array', () => {
    expect(getCampaignPoints([], [alice], '2026-01-01', null, cfg)).toBe(0);
  });

  it('skips activities with null completedDate', () => {
    const acts = [
      activity(50, '2026-02-15T00:00:00Z', alice),
      { pointsEarned: 100, completedDate: null, userId: alice },
    ];
    expect(getCampaignPoints(acts, [alice], '2026-01-01', null, cfg)).toBe(50);
  });

  it('uses inclusive boundaries for startDate and endDate', () => {
    const acts = [
      activity(10, '2026-03-01T00:00:00Z', alice),
      activity(20, '2026-03-31T23:59:59Z', alice),
    ];
    expect(getCampaignPoints(acts, [alice], '2026-03-01T00:00:00Z', '2026-03-31T23:59:59Z', cfg)).toBe(30);
  });
});

// ── DEFAULT_POINT_CONFIG ────────────────────────────────────────────

describe('DEFAULT_POINT_CONFIG', () => {
  it('is frozen (not accidentally mutatable)', () => {
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.selfPacedDigital)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.liveLearning)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.certifications)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.gamifiedEvents)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.communityEngagement)).toBe(true);
  });

  it('has all 26 expected point values', () => {
    const total = Object.keys(DEFAULT_POINT_CONFIG.selfPacedDigital).length
      + Object.keys(DEFAULT_POINT_CONFIG.liveLearning).length
      + Object.keys(DEFAULT_POINT_CONFIG.certifications).length
      + Object.keys(DEFAULT_POINT_CONFIG.gamifiedEvents).length
      + Object.keys(DEFAULT_POINT_CONFIG.communityEngagement).length;
    expect(total).toBe(26);
  });
});
