import { describe, it, expect } from 'vitest';
import {
  DEFAULT_POINT_CONFIG,
  calculateCoursePoints,
  calculateQuizBonus,
  calculateHackathonPoints,
  calculateMeetingPoints,
  getTotalPoints,
  getMonthPoints,
  getCampaignPoints,
} from '../../src/models/points.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Shallow-clone default config with optional overrides. */
function configWith(overrides) {
  return {
    awsCourseTypes:  { ...DEFAULT_POINT_CONFIG.awsCourseTypes,  ...overrides?.awsCourseTypes },
    generalCourses:  { ...DEFAULT_POINT_CONFIG.generalCourses,  ...overrides?.generalCourses },
    events:          { ...DEFAULT_POINT_CONFIG.events,          ...overrides?.events },
    hackathons:      { ...DEFAULT_POINT_CONFIG.hackathons,      ...overrides?.hackathons },
    quizzes:         { ...DEFAULT_POINT_CONFIG.quizzes,         ...overrides?.quizzes },
  };
}

/** Minimal activity with only the fields the aggregation functions read. */
function activity(points, completedDate = '2026-04-15T00:00:00Z', userId = 'a@b.com') {
  return { pointsEarned: points, completedDate, userId };
}

const cfg = DEFAULT_POINT_CONFIG;

// ── calculateCoursePoints ───────────────────────────────────────────

describe('calculateCoursePoints', () => {
  // AWS course types — exact match
  it('awards 100pts for AWS Builder Lab', () => {
    expect(calculateCoursePoints('AWS Builder Lab', '', cfg)).toBe(100);
  });

  it('awards 75pts for AWS Cloud Quest', () => {
    expect(calculateCoursePoints('AWS Cloud Quest', '', cfg)).toBe(75);
  });

  it('awards 150pts for AWS Jam Journey', () => {
    expect(calculateCoursePoints('AWS Jam Journey', '', cfg)).toBe(150);
  });

  it('awards 75pts for AWS Simulearn', () => {
    expect(calculateCoursePoints('AWS Simulearn', '', cfg)).toBe(75);
  });

  it('awards 100pts for Certification Exam Preparation', () => {
    expect(calculateCoursePoints('Certification Exam Preparation', '', cfg)).toBe(100);
  });

  it('awards 100pts for Digital Course With Lab', () => {
    expect(calculateCoursePoints('Digital Course With Lab', '', cfg)).toBe(100);
  });

  // General categories — level-based fallback
  it('awards 100pts for Classroom Training regardless of level', () => {
    expect(calculateCoursePoints('Classroom Training', '', cfg)).toBe(100);
    expect(calculateCoursePoints('Classroom Training', 'fundamental', cfg)).toBe(100);
    expect(calculateCoursePoints('Classroom Training', 'advanced', cfg)).toBe(100);
  });

  it('awards 50pts for Foundational digital course', () => {
    expect(calculateCoursePoints('', 'fundamental', cfg)).toBe(50);
  });

  it('awards 75pts for Associate digital course', () => {
    expect(calculateCoursePoints('', 'intermediate', cfg)).toBe(75);
  });

  it('awards 100pts for Professional digital course', () => {
    expect(calculateCoursePoints('', 'advanced', cfg)).toBe(100);
  });

  it('awards 100pts for Specialty digital course', () => {
    expect(calculateCoursePoints('', 'specialty', cfg)).toBe(100);
  });

  // Default fallback
  it('falls back to 50pts (Foundational) when courseType and level are empty', () => {
    expect(calculateCoursePoints('', '', cfg)).toBe(50);
  });

  // Case-insensitive matching
  it('is case-insensitive on exact courseType matching', () => {
    expect(calculateCoursePoints('aws builder lab', '', cfg)).toBe(100);
    expect(calculateCoursePoints('AWS BUILDER LAB', '', cfg)).toBe(100);
    expect(calculateCoursePoints('Aws Builder Lab', '', cfg)).toBe(100);
  });

  it('is case-insensitive on keyword substring matching', () => {
    expect(calculateCoursePoints('My Cloud Quest Course', '', cfg)).toBe(75);
    expect(calculateCoursePoints('my CLOUD QUEST course', '', cfg)).toBe(75);
  });

  it('is case-insensitive on level matching', () => {
    expect(calculateCoursePoints('', 'FUNDAMENTAL', cfg)).toBe(50);
    expect(calculateCoursePoints('', 'Intermediate', cfg)).toBe(75);
    expect(calculateCoursePoints('', 'ADVANCED', cfg)).toBe(100);
  });

  // Keyword substring matching
  it('matches "Builder Lab" as substring in longer courseType', () => {
    expect(calculateCoursePoints('Some Builder Lab v2', '', cfg)).toBe(100);
  });

  it('matches "With Lab" as substring', () => {
    expect(calculateCoursePoints('Advanced Digital Course With Lab 2026', '', cfg)).toBe(100);
  });

  it('matches "Classroom" as substring', () => {
    expect(calculateCoursePoints('Classroom Workshop', '', cfg)).toBe(100);
  });

  // Keyword priority: first match wins
  it('prefers keyword match over level fallback', () => {
    // courseType contains "Classroom" -> 100, even though level says fundamental (50)
    expect(calculateCoursePoints('Classroom', 'fundamental', cfg)).toBe(100);
  });

  // Custom config
  it('respects custom config values over defaults', () => {
    const custom = configWith({ awsCourseTypes: { 'AWS Builder Lab': 999 } });
    expect(calculateCoursePoints('AWS Builder Lab', '', custom)).toBe(999);
  });

  // Null/undefined inputs
  it('handles null courseType without throwing', () => {
    expect(calculateCoursePoints(null, '', cfg)).toBe(50);
  });

  it('handles undefined courseType without throwing', () => {
    expect(calculateCoursePoints(undefined, '', cfg)).toBe(50);
  });

  it('handles null level without throwing', () => {
    expect(calculateCoursePoints('', null, cfg)).toBe(50);
  });

  it('handles undefined level without throwing', () => {
    expect(calculateCoursePoints('', undefined, cfg)).toBe(50);
  });

  it('handles both null without throwing', () => {
    expect(calculateCoursePoints(null, null, cfg)).toBe(50);
  });

  // Whitespace-only inputs
  it('treats whitespace-only courseType as empty', () => {
    expect(calculateCoursePoints('   ', '', cfg)).toBe(50);
  });

  // Unrecognised courseType with no valid level
  it('falls back to Foundational for unrecognised courseType with no level', () => {
    expect(calculateCoursePoints('Totally Unknown Course', '', cfg)).toBe(50);
  });

  // Unrecognised courseType but valid level
  it('falls back to level-based points for unrecognised courseType', () => {
    expect(calculateCoursePoints('Unknown Course', 'advanced', cfg)).toBe(100);
  });
});

// ── calculateQuizBonus ──────────────────────────────────────────────

describe('calculateQuizBonus', () => {
  it('awards 20pts base for any quiz completion (low score)', () => {
    expect(calculateQuizBonus(42, cfg)).toBe(20);
  });

  it('awards 20pts for score of 0', () => {
    expect(calculateQuizBonus(0, cfg)).toBe(20);
  });

  it('does NOT award 80% bonus for score of 79', () => {
    expect(calculateQuizBonus(79, cfg)).toBe(20);
  });

  it('awards 80% bonus for score of exactly 80', () => {
    expect(calculateQuizBonus(80, cfg)).toBe(50);
  });

  it('awards 80% bonus for score of 99', () => {
    expect(calculateQuizBonus(99, cfg)).toBe(50);
  });

  it('awards perfect bonus for score of 100', () => {
    expect(calculateQuizBonus(100, cfg)).toBe(70);
  });

  it('handles null score (base points only, no throw)', () => {
    expect(calculateQuizBonus(null, cfg)).toBe(20);
  });

  it('handles undefined score (base points only, no throw)', () => {
    expect(calculateQuizBonus(undefined, cfg)).toBe(20);
  });

  it('respects custom config values', () => {
    const custom = configWith({ quizzes: {
      'Quiz Completion': 10,
      'Quiz 80%+ Score': 30,
      'Quiz Perfect Score': 50,
    }});
    expect(calculateQuizBonus(100, custom)).toBe(50);
    expect(calculateQuizBonus(85, custom)).toBe(30);
    expect(calculateQuizBonus(50, custom)).toBe(10);
  });
});

// ── calculateHackathonPoints ────────────────────────────────────────

describe('calculateHackathonPoints', () => {
  it('awards 450pts for 1st place', () => {
    expect(calculateHackathonPoints(1, cfg)).toBe(450);
  });

  it('awards 350pts for 2nd place', () => {
    expect(calculateHackathonPoints(2, cfg)).toBe(350);
  });

  it('awards 250pts for 3rd place', () => {
    expect(calculateHackathonPoints(3, cfg)).toBe(250);
  });

  it('awards 150pts for participation (null placement)', () => {
    expect(calculateHackathonPoints(null, cfg)).toBe(150);
  });

  it('awards 150pts for participation (undefined placement)', () => {
    expect(calculateHackathonPoints(undefined, cfg)).toBe(150);
  });

  it('awards participation points for placement > 3', () => {
    expect(calculateHackathonPoints(4, cfg)).toBe(150);
    expect(calculateHackathonPoints(10, cfg)).toBe(150);
  });

  it('awards participation points for placement 0', () => {
    expect(calculateHackathonPoints(0, cfg)).toBe(150);
  });

  it('respects config overrides', () => {
    const custom = configWith({ hackathons: {
      'Hackathons - Participation': 100,
      'Hackathons - 3rd Place': 200,
      'Hackathons - 2nd Place': 300,
      'Hackathons - 1st Place': 500,
    }});
    expect(calculateHackathonPoints(1, custom)).toBe(500);
    expect(calculateHackathonPoints(null, custom)).toBe(100);
  });
});

// ── calculateMeetingPoints ──────────────────────────────────────────

describe('calculateMeetingPoints', () => {
  it('awards 25pts for a meeting', () => {
    expect(calculateMeetingPoints(cfg)).toBe(25);
  });

  it('respects config overrides', () => {
    const custom = configWith({ events: { 'Live Events': 50 } });
    expect(calculateMeetingPoints(custom)).toBe(50);
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
    // Only Feb and March activities
    const result = getCampaignPoints(
      campaignActivities,
      [alice, bob, charlie],
      '2026-02-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
      cfg,
    );
    // alice 75 + bob 100 + charlie 30 = 205
    expect(result).toBe(205);
  });

  it('counts only activities from eligible participantIds', () => {
    // All dates, but only alice
    const result = getCampaignPoints(
      campaignActivities,
      [alice],
      '2026-01-01T00:00:00Z',
      '2026-12-31T23:59:59Z',
      cfg,
    );
    // alice: 50 + 75 + 25 = 150
    expect(result).toBe(150);
  });

  it('returns 0 when no activities fall within range', () => {
    const result = getCampaignPoints(
      campaignActivities,
      [alice, bob],
      '2027-01-01T00:00:00Z',
      '2027-12-31T23:59:59Z',
      cfg,
    );
    expect(result).toBe(0);
  });

  it('returns 0 when participantIds is empty', () => {
    const result = getCampaignPoints(
      campaignActivities,
      [],
      '2026-01-01T00:00:00Z',
      '2026-12-31T23:59:59Z',
      cfg,
    );
    expect(result).toBe(0);
  });

  it('handles open-ended campaign (null endDate) — counts all from startDate onwards', () => {
    const result = getCampaignPoints(
      campaignActivities,
      [alice, bob, charlie],
      '2026-03-01T00:00:00Z',
      null,
      cfg,
    );
    // bob 100 + alice 25 = 125
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
    const result = getCampaignPoints(acts, [alice], '2026-01-01', null, cfg);
    expect(result).toBe(50);
  });

  it('uses inclusive boundaries for startDate and endDate', () => {
    const acts = [
      activity(10, '2026-03-01T00:00:00Z', alice),
      activity(20, '2026-03-31T23:59:59Z', alice),
    ];
    const result = getCampaignPoints(
      acts,
      [alice],
      '2026-03-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
      cfg,
    );
    expect(result).toBe(30);
  });

  it('excludes activity exactly before startDate', () => {
    const acts = [
      activity(10, '2026-02-28T23:59:59Z', alice),
      activity(20, '2026-03-01T00:00:00Z', alice),
    ];
    const result = getCampaignPoints(
      acts,
      [alice],
      '2026-03-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
      cfg,
    );
    expect(result).toBe(20);
  });

  it('excludes activity exactly after endDate', () => {
    const acts = [
      activity(20, '2026-03-31T23:59:59Z', alice),
      activity(10, '2026-04-01T00:00:00Z', alice),
    ];
    const result = getCampaignPoints(
      acts,
      [alice],
      '2026-03-01T00:00:00Z',
      '2026-03-31T23:59:59Z',
      cfg,
    );
    expect(result).toBe(20);
  });
});

// ── DEFAULT_POINT_CONFIG ────────────────────────────────────────────

describe('DEFAULT_POINT_CONFIG', () => {
  it('is frozen (not accidentally mutatable)', () => {
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.awsCourseTypes)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.generalCourses)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.events)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.hackathons)).toBe(true);
    expect(Object.isFrozen(DEFAULT_POINT_CONFIG.quizzes)).toBe(true);
  });

  it('has all 18 expected point values', () => {
    const total = Object.keys(DEFAULT_POINT_CONFIG.awsCourseTypes).length
      + Object.keys(DEFAULT_POINT_CONFIG.generalCourses).length
      + Object.keys(DEFAULT_POINT_CONFIG.events).length
      + Object.keys(DEFAULT_POINT_CONFIG.hackathons).length
      + Object.keys(DEFAULT_POINT_CONFIG.quizzes).length;
    // 6 AWS + 5 general + 1 event + 4 hackathon + 3 quiz = 19
    expect(total).toBe(19);
  });
});
