import { describe, it, expect } from 'vitest';
import {
  createTeam,
  calculateTeamPoints,
  calculateTeamMonthPoints,
} from '../../src/models/team.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeUser(email, totalPoints = 0, currentMonthPoints = 0) {
  return { email, totalPoints, currentMonthPoints };
}

function teamWith(memberIds) {
  return { ...createTeam('Test', 'blue'), memberIds };
}

// ── createTeam ──────────────────────────────────────────────────────

describe('createTeam', () => {
  it('sets name and color', () => {
    const team = createTeam('Alpha', 'teal');
    expect(team.name).toBe('Alpha');
    expect(team.color).toBe('teal');
  });

  it('sets description from argument', () => {
    expect(createTeam('A', 'blue', 'Desc').description).toBe('Desc');
  });

  it('defaults description to empty string', () => {
    expect(createTeam('A', 'blue').description).toBe('');
  });

  it('generates an id starting with team_', () => {
    expect(createTeam('A', 'blue').id).toMatch(/^team_/);
  });

  it('generates unique ids across calls', () => {
    const a = createTeam('A', 'blue');
    const b = createTeam('A', 'blue');
    expect(a.id).not.toBe(b.id);
  });

  it('initialises memberIds to an empty array', () => {
    expect(createTeam('A', 'blue').memberIds).toEqual([]);
  });

  it('sets createdAt to a valid ISO 8601 string', () => {
    const team = createTeam('A', 'blue');
    expect(new Date(team.createdAt).toISOString()).toBe(team.createdAt);
  });

  it('returns all 6 typedef properties', () => {
    const keys = Object.keys(createTeam('A', 'blue')).sort();
    expect(keys).toEqual([
      'color', 'createdAt', 'description', 'id', 'memberIds', 'name',
    ]);
  });

  it('each call returns a distinct memberIds array', () => {
    const a = createTeam('A', 'blue');
    const b = createTeam('A', 'blue');
    a.memberIds.push('x@y.com');
    expect(b.memberIds).toEqual([]);
  });
});

// ── calculateTeamPoints ─────────────────────────────────────────────

describe('calculateTeamPoints', () => {
  it('sums totalPoints of all members', () => {
    const users = {
      'a@b.com': makeUser('a@b.com', 100),
      'c@d.com': makeUser('c@d.com', 200),
    };
    const team = teamWith(['a@b.com', 'c@d.com']);
    expect(calculateTeamPoints(team, users)).toBe(300);
  });

  it('returns 0 for a team with no members', () => {
    expect(calculateTeamPoints(teamWith([]), {})).toBe(0);
  });

  it('treats missing users as 0 points', () => {
    const users = { 'a@b.com': makeUser('a@b.com', 50) };
    const team = teamWith(['a@b.com', 'ghost@b.com']);
    expect(calculateTeamPoints(team, users)).toBe(50);
  });

  it('handles all members missing from users', () => {
    const team = teamWith(['x@y.com', 'z@w.com']);
    expect(calculateTeamPoints(team, {})).toBe(0);
  });

  it('handles single member', () => {
    const users = { 'a@b.com': makeUser('a@b.com', 42) };
    expect(calculateTeamPoints(teamWith(['a@b.com']), users)).toBe(42);
  });
});

// ── calculateTeamMonthPoints ────────────────────────────────────────

describe('calculateTeamMonthPoints', () => {
  it('sums currentMonthPoints of all members', () => {
    const users = {
      'a@b.com': makeUser('a@b.com', 100, 30),
      'c@d.com': makeUser('c@d.com', 200, 70),
    };
    const team = teamWith(['a@b.com', 'c@d.com']);
    expect(calculateTeamMonthPoints(team, users)).toBe(100);
  });

  it('returns 0 for a team with no members', () => {
    expect(calculateTeamMonthPoints(teamWith([]), {})).toBe(0);
  });

  it('treats missing users as 0 points', () => {
    const users = { 'a@b.com': makeUser('a@b.com', 100, 25) };
    const team = teamWith(['a@b.com', 'ghost@b.com']);
    expect(calculateTeamMonthPoints(team, users)).toBe(25);
  });

  it('handles all members missing from users', () => {
    const team = teamWith(['x@y.com', 'z@w.com']);
    expect(calculateTeamMonthPoints(team, {})).toBe(0);
  });

  it('does not confuse totalPoints with currentMonthPoints', () => {
    const users = { 'a@b.com': makeUser('a@b.com', 999, 10) };
    expect(calculateTeamMonthPoints(teamWith(['a@b.com']), users)).toBe(10);
  });
});
