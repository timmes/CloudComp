import { describe, it, expect } from 'vitest';
import {
  createActivity,
  generateActivityId,
} from '../../src/models/activity.js';

// ── generateActivityId ──────────────────────────────────────────────

describe('generateActivityId', () => {
  it('returns a deterministic id from userId and externalId', () => {
    const a = generateActivityId('alice@b.com', 'COURSE-123');
    const b = generateActivityId('alice@b.com', 'COURSE-123');
    expect(a).toBe(b);
  });

  it('starts with act_ prefix', () => {
    expect(generateActivityId('a@b.com', 'X')).toMatch(/^act_/);
  });

  it('lowercases userId', () => {
    const a = generateActivityId('Alice@B.COM', 'X');
    const b = generateActivityId('alice@b.com', 'X');
    expect(a).toBe(b);
  });

  it('trims externalId', () => {
    const a = generateActivityId('a@b.com', '  X  ');
    const b = generateActivityId('a@b.com', 'X');
    expect(a).toBe(b);
  });

  it('produces different ids for different userIds', () => {
    const a = generateActivityId('alice@b.com', 'X');
    const b = generateActivityId('bob@b.com', 'X');
    expect(a).not.toBe(b);
  });

  it('produces different ids for different externalIds', () => {
    const a = generateActivityId('a@b.com', 'X');
    const b = generateActivityId('a@b.com', 'Y');
    expect(a).not.toBe(b);
  });

  it('handles null userId without throwing', () => {
    expect(() => generateActivityId(null, 'X')).not.toThrow();
    expect(generateActivityId(null, 'X')).toMatch(/^act_/);
  });

  it('handles null externalId without throwing', () => {
    expect(() => generateActivityId('a@b.com', null)).not.toThrow();
    expect(generateActivityId('a@b.com', null)).toMatch(/^act_/);
  });

  it('handles both null without throwing', () => {
    expect(() => generateActivityId(null, null)).not.toThrow();
  });

  it('handles undefined without throwing', () => {
    expect(() => generateActivityId(undefined, undefined)).not.toThrow();
  });
});

// ── createActivity ──────────────────────────────────────────────────

describe('createActivity', () => {
  it('creates an activity with provided fields', () => {
    const act = createActivity({
      userId: 'alice@b.com',
      title: 'AWS Cloud Quest',
      type: 'course',
      courseType: 'AWS Cloud Quest',
      pointsEarned: 75,
      completedDate: '2026-04-15T00:00:00Z',
      source: 'course-import',
    });
    expect(act.userId).toBe('alice@b.com');
    expect(act.title).toBe('AWS Cloud Quest');
    expect(act.type).toBe('course');
    expect(act.pointsEarned).toBe(75);
    expect(act.completedDate).toBe('2026-04-15T00:00:00Z');
    expect(act.source).toBe('course-import');
  });

  it('lowercases userId', () => {
    const act = createActivity({ userId: 'ALICE@B.COM', title: 'X' });
    expect(act.userId).toBe('alice@b.com');
  });

  it('uses provided id when given', () => {
    const act = createActivity({ id: 'custom-id', userId: 'a@b.com', title: 'X' });
    expect(act.id).toBe('custom-id');
  });

  it('generates id from userId and externalId when id not provided', () => {
    const act = createActivity({
      userId: 'a@b.com',
      title: 'X',
      externalId: 'EXT-1',
    });
    expect(act.id).toBe(generateActivityId('a@b.com', 'EXT-1'));
  });

  it('generates id with empty externalId when neither id nor externalId provided', () => {
    const act = createActivity({ userId: 'a@b.com', title: 'X' });
    expect(act.id).toBe(generateActivityId('a@b.com', ''));
  });

  // Default values
  it('defaults type to "course"', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).type).toBe('course');
  });

  it('defaults level to empty string', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).level).toBe('');
  });

  it('defaults courseType to empty string', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).courseType).toBe('');
  });

  it('defaults pointsEarned to 0', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).pointsEarned).toBe(0);
  });

  it('defaults completedDate to null', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).completedDate).toBe(null);
  });

  it('defaults source to "manual"', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).source).toBe('manual');
  });

  it('defaults score to null', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).score).toBe(null);
  });

  it('defaults isDuplicate to false', () => {
    expect(createActivity({ userId: 'a@b.com', title: 'X' }).isDuplicate).toBe(false);
  });

  it('defaults title to empty string when not provided', () => {
    expect(createActivity({ userId: 'a@b.com' }).title).toBe('');
  });

  it('returns all 11 typedef properties', () => {
    const act = createActivity({ userId: 'a@b.com', title: 'X' });
    const keys = Object.keys(act).sort();
    expect(keys).toEqual([
      'completedDate', 'courseType', 'id', 'isDuplicate',
      'level', 'pointsEarned', 'score', 'source', 'title',
      'type', 'userId',
    ]);
  });

  it('each call returns a distinct object', () => {
    const a = createActivity({ userId: 'a@b.com', title: 'X' });
    const b = createActivity({ userId: 'a@b.com', title: 'X' });
    expect(a).not.toBe(b);
  });

  it('handles null userId without throwing', () => {
    expect(() => createActivity({ userId: null, title: 'X' })).not.toThrow();
    expect(createActivity({ userId: null, title: 'X' }).userId).toBe('');
  });
});
