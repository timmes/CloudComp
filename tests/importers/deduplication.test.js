import { describe, it, expect } from 'vitest';
import {
  isDuplicate,
  deduplicateBatch,
} from '../../src/importers/deduplication.js';

// ── Helpers ─────────────────────────────────────────────────────────

function act(userId, externalId, extra = {}) {
  return { userId, externalId, title: `Activity ${externalId}`, ...extra };
}

// ── isDuplicate ─────────────────────────────────────────────────────

describe('isDuplicate', () => {
  it('returns true for same email + externalId combination', () => {
    const existing = [act('alice@b.com', 'COURSE-1')];
    expect(isDuplicate(act('alice@b.com', 'COURSE-1'), existing)).toBe(true);
  });

  it('returns false for same email, different externalId', () => {
    const existing = [act('alice@b.com', 'COURSE-1')];
    expect(isDuplicate(act('alice@b.com', 'COURSE-2'), existing)).toBe(false);
  });

  it('returns false for different email, same externalId', () => {
    const existing = [act('alice@b.com', 'COURSE-1')];
    expect(isDuplicate(act('bob@b.com', 'COURSE-1'), existing)).toBe(false);
  });

  it('is case-insensitive on email', () => {
    const existing = [act('alice@b.com', 'COURSE-1')];
    expect(isDuplicate(act('ALICE@B.COM', 'COURSE-1'), existing)).toBe(true);
    expect(isDuplicate(act('Alice@B.Com', 'COURSE-1'), existing)).toBe(true);
  });

  it('is case-insensitive on externalId', () => {
    const existing = [act('alice@b.com', 'course-1')];
    expect(isDuplicate(act('alice@b.com', 'COURSE-1'), existing)).toBe(true);
  });

  it('trims externalId whitespace', () => {
    const existing = [act('alice@b.com', 'COURSE-1')];
    expect(isDuplicate(act('alice@b.com', '  COURSE-1  '), existing)).toBe(true);
  });

  it('handles undefined externalId gracefully', () => {
    const a = { userId: 'alice@b.com', externalId: undefined };
    const existing = [{ userId: 'alice@b.com', externalId: undefined }];
    expect(isDuplicate(a, existing)).toBe(true);
  });

  it('handles null externalId gracefully', () => {
    const a = { userId: 'alice@b.com', externalId: null };
    const existing = [{ userId: 'alice@b.com', externalId: null }];
    expect(isDuplicate(a, existing)).toBe(true);
  });

  it('handles undefined userId gracefully', () => {
    const a = { userId: undefined, externalId: 'X' };
    const existing = [{ userId: undefined, externalId: 'X' }];
    expect(isDuplicate(a, existing)).toBe(true);
  });

  it('returns false when existingActivities is empty', () => {
    expect(isDuplicate(act('alice@b.com', 'COURSE-1'), [])).toBe(false);
  });

  it('checks against multiple existing activities', () => {
    const existing = [
      act('alice@b.com', 'COURSE-1'),
      act('bob@b.com', 'COURSE-2'),
      act('alice@b.com', 'COURSE-3'),
    ];
    expect(isDuplicate(act('alice@b.com', 'COURSE-3'), existing)).toBe(true);
    expect(isDuplicate(act('alice@b.com', 'COURSE-4'), existing)).toBe(false);
  });
});

// ── deduplicateBatch ────────────────────────────────────────────────

describe('deduplicateBatch', () => {
  it('separates accepted from duplicates correctly', () => {
    const existing = [act('alice@b.com', 'C-1')];
    const incoming = [
      act('alice@b.com', 'C-1'), // duplicate
      act('alice@b.com', 'C-2'), // new
      act('bob@b.com', 'C-1'),   // new (different user)
    ];
    const result = deduplicateBatch(incoming, existing);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(1);
  });

  it('counts stats.duplicatesSkipped accurately', () => {
    const existing = [act('alice@b.com', 'C-1'), act('alice@b.com', 'C-2')];
    const incoming = [
      act('alice@b.com', 'C-1'), // dup
      act('alice@b.com', 'C-2'), // dup
      act('alice@b.com', 'C-3'), // new
    ];
    const result = deduplicateBatch(incoming, existing);
    expect(result.stats.accepted).toBe(1);
    expect(result.stats.duplicatesSkipped).toBe(2);
  });

  it('accepts all when no existing activities', () => {
    const incoming = [act('a@b.com', 'C-1'), act('a@b.com', 'C-2')];
    const result = deduplicateBatch(incoming, []);
    expect(result.accepted).toHaveLength(2);
    expect(result.duplicates).toHaveLength(0);
    expect(result.stats.accepted).toBe(2);
    expect(result.stats.duplicatesSkipped).toBe(0);
  });

  it('deduplicates within the batch itself (two rows, same course)', () => {
    const incoming = [
      act('alice@b.com', 'C-1'),
      act('alice@b.com', 'C-1'), // duplicate of first row
    ];
    const result = deduplicateBatch(incoming, []);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('does not mutate the existing activities array', () => {
    const existing = [act('alice@b.com', 'C-1')];
    const existingCopy = [...existing];
    const incoming = [act('bob@b.com', 'C-2')];
    deduplicateBatch(incoming, existing);
    expect(existing).toEqual(existingCopy);
    expect(existing).toHaveLength(1);
  });

  it('does not mutate the incoming activities array', () => {
    const incoming = [act('a@b.com', 'C-1'), act('a@b.com', 'C-1')];
    const incomingCopy = [...incoming];
    deduplicateBatch(incoming, []);
    expect(incoming).toEqual(incomingCopy);
    expect(incoming).toHaveLength(2);
  });

  it('handles empty incoming batch', () => {
    const result = deduplicateBatch([], [act('a@b.com', 'C-1')]);
    expect(result.accepted).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.stats.accepted).toBe(0);
    expect(result.stats.duplicatesSkipped).toBe(0);
  });

  it('handles both arrays empty', () => {
    const result = deduplicateBatch([], []);
    expect(result.accepted).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it('is case-insensitive on email in batch context', () => {
    const incoming = [
      act('Alice@B.com', 'C-1'),
      act('alice@b.com', 'C-1'), // same user, different case
    ];
    const result = deduplicateBatch(incoming, []);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('is case-insensitive on externalId in batch context', () => {
    const incoming = [
      act('alice@b.com', 'course-1'),
      act('alice@b.com', 'COURSE-1'), // same externalId, different case
    ];
    const result = deduplicateBatch(incoming, []);
    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });

  it('preserves activity objects in accepted and duplicates', () => {
    const a1 = act('a@b.com', 'C-1', { pointsEarned: 50 });
    const a2 = act('a@b.com', 'C-1', { pointsEarned: 75 });
    const result = deduplicateBatch([a1, a2], []);
    expect(result.accepted[0]).toBe(a1);
    expect(result.duplicates[0]).toBe(a2);
  });
});

// ── Regression: re-import same file ─────────────────────────────────

describe('regression', () => {
  it('does not double-count when same file is imported twice', () => {
    const batch = [
      act('alice@b.com', 'C-1'),
      act('alice@b.com', 'C-2'),
      act('bob@b.com', 'C-1'),
    ];
    const first = deduplicateBatch(batch, []);
    expect(first.accepted).toHaveLength(3);

    const second = deduplicateBatch(batch, first.accepted);
    expect(second.accepted).toHaveLength(0);
    expect(second.duplicates).toHaveLength(batch.length);
  });

  it('accepts only new activities on second import with additions', () => {
    const batch1 = [act('alice@b.com', 'C-1'), act('bob@b.com', 'C-2')];
    const first = deduplicateBatch(batch1, []);

    const batch2 = [
      act('alice@b.com', 'C-1'), // dup
      act('bob@b.com', 'C-2'),   // dup
      act('alice@b.com', 'C-3'), // new
    ];
    const second = deduplicateBatch(batch2, first.accepted);
    expect(second.accepted).toHaveLength(1);
    expect(second.accepted[0].externalId).toBe('C-3');
    expect(second.duplicates).toHaveLength(2);
  });
});
