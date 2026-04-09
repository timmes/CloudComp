import { describe, it, expect } from 'vitest';
import { createUser, addPointsToUser } from '../../src/models/user.js';

// ── createUser ──────────────────────────────────────────────────────

describe('createUser', () => {
  it('lowercases email for both id and email fields', () => {
    const user = createUser('Alice@Example.COM', 'Alice');
    expect(user.id).toBe('alice@example.com');
    expect(user.email).toBe('alice@example.com');
  });

  it('sets name from the argument', () => {
    expect(createUser('a@b.com', 'Alice').name).toBe('Alice');
  });

  it('derives name from email when name is empty string', () => {
    expect(createUser('alice@example.com', '').name).toBe('alice');
  });

  it('derives name from email when name is falsy', () => {
    expect(createUser('bob@example.com', null).name).toBe('bob');
    expect(createUser('bob@example.com', undefined).name).toBe('bob');
  });

  it('initialises totalPoints to 0', () => {
    expect(createUser('a@b.com', 'A').totalPoints).toBe(0);
  });

  it('initialises currentMonthPoints to 0', () => {
    expect(createUser('a@b.com', 'A').currentMonthPoints).toBe(0);
  });

  it('initialises teamId to null', () => {
    expect(createUser('a@b.com', 'A').teamId).toBe(null);
  });

  it('initialises badges to an empty array', () => {
    expect(createUser('a@b.com', 'A').badges).toEqual([]);
  });

  it('sets createdAt to a valid ISO 8601 string', () => {
    const user = createUser('a@b.com', 'A');
    expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt);
  });

  it('returns all 8 typedef properties', () => {
    const user = createUser('a@b.com', 'A');
    const keys = Object.keys(user).sort();
    expect(keys).toEqual([
      'badges', 'createdAt', 'currentMonthPoints',
      'email', 'id', 'name', 'teamId', 'totalPoints',
    ]);
  });

  it('each call returns a distinct object', () => {
    const a = createUser('a@b.com', 'A');
    const b = createUser('a@b.com', 'A');
    expect(a).not.toBe(b);
  });

  it('each call returns a distinct badges array', () => {
    const a = createUser('a@b.com', 'A');
    const b = createUser('a@b.com', 'A');
    a.badges.push('test');
    expect(b.badges).toEqual([]);
  });
});

// ── addPointsToUser ─────────────────────────────────────────────────

describe('addPointsToUser', () => {
  const base = createUser('a@b.com', 'Alice');

  it('adds points to totalPoints', () => {
    const updated = addPointsToUser(base, 50, false);
    expect(updated.totalPoints).toBe(50);
  });

  it('adds to currentMonthPoints when isCurrentMonth is true', () => {
    const updated = addPointsToUser(base, 75, true);
    expect(updated.totalPoints).toBe(75);
    expect(updated.currentMonthPoints).toBe(75);
  });

  it('does not change currentMonthPoints when isCurrentMonth is false', () => {
    const updated = addPointsToUser(base, 75, false);
    expect(updated.totalPoints).toBe(75);
    expect(updated.currentMonthPoints).toBe(0);
  });

  it('does not mutate the input user', () => {
    const before = { ...base };
    addPointsToUser(base, 100, true);
    expect(base.totalPoints).toBe(before.totalPoints);
    expect(base.currentMonthPoints).toBe(before.currentMonthPoints);
  });

  it('returns a new object', () => {
    const updated = addPointsToUser(base, 10, true);
    expect(updated).not.toBe(base);
  });

  it('preserves all other fields', () => {
    const withTeam = { ...base, teamId: 't1', badges: ['b1'] };
    const updated = addPointsToUser(withTeam, 10, true);
    expect(updated.email).toBe(withTeam.email);
    expect(updated.name).toBe(withTeam.name);
    expect(updated.teamId).toBe('t1');
    expect(updated.badges).toEqual(['b1']);
    expect(updated.createdAt).toBe(withTeam.createdAt);
  });

  it('accumulates across multiple calls', () => {
    const step1 = addPointsToUser(base, 50, true);
    const step2 = addPointsToUser(step1, 30, true);
    const step3 = addPointsToUser(step2, 20, false);
    expect(step3.totalPoints).toBe(100);
    expect(step3.currentMonthPoints).toBe(80);
  });

  it('handles zero points', () => {
    const updated = addPointsToUser(base, 0, true);
    expect(updated.totalPoints).toBe(0);
    expect(updated.currentMonthPoints).toBe(0);
  });

  it('handles negative points (point deductions)', () => {
    const withPoints = addPointsToUser(base, 100, true);
    const deducted = addPointsToUser(withPoints, -30, true);
    expect(deducted.totalPoints).toBe(70);
    expect(deducted.currentMonthPoints).toBe(70);
  });
});
