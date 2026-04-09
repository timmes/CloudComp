// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  load,
  save,
  remove,
  getQuotaUsedKB,
  setQuotaWarningHandler,
} from '../../src/core/storage.js';

// ── Helpers ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  // Reset the quota warning handler between tests
  setQuotaWarningHandler(null);
});

// ── load ────────────────────────────────────────────────────────────

describe('load', () => {
  it('returns parsed JSON for an existing key', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(load('k')).toEqual({ a: 1 });
  });

  it('returns fallback (null) when key does not exist', () => {
    expect(load('missing')).toBe(null);
  });

  it('returns custom fallback when key does not exist', () => {
    expect(load('missing', { empty: true })).toEqual({ empty: true });
  });

  it('returns fallback when stored value is not valid JSON', () => {
    localStorage.setItem('bad', '{not json!!!');
    expect(load('bad', 'default')).toBe('default');
  });

  it('handles stored primitives (string, number, boolean, null)', () => {
    localStorage.setItem('str', JSON.stringify('hello'));
    localStorage.setItem('num', JSON.stringify(42));
    localStorage.setItem('bool', JSON.stringify(true));
    localStorage.setItem('nil', JSON.stringify(null));

    expect(load('str')).toBe('hello');
    expect(load('num')).toBe(42);
    expect(load('bool')).toBe(true);
    expect(load('nil')).toBe(null);
  });

  it('handles stored arrays', () => {
    localStorage.setItem('arr', JSON.stringify([1, 2, 3]));
    expect(load('arr')).toEqual([1, 2, 3]);
  });

  it('returns fallback (not throws) when localStorage is disabled', () => {
    const original = Storage.prototype.setItem;
    // Make the availability probe fail
    Storage.prototype.setItem = () => { throw new DOMException('disabled'); };
    try {
      expect(load('k', 'fb')).toBe('fb');
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

// ── save ────────────────────────────────────────────────────────────

describe('save', () => {
  it('saves and retrieves a value round-trip', () => {
    const data = { users: { a: 1 }, list: [1, 2] };
    expect(save('test', data)).toBe(true);
    expect(load('test')).toEqual(data);
  });

  it('returns true on success', () => {
    expect(save('k', 'v')).toBe(true);
  });

  it('overwrites an existing key', () => {
    save('k', 'first');
    save('k', 'second');
    expect(load('k')).toBe('second');
  });

  it('saves primitives correctly', () => {
    save('num', 42);
    save('bool', false);
    save('nil', null);
    expect(load('num')).toBe(42);
    expect(load('bool')).toBe(false);
    expect(load('nil')).toBe(null);
  });

  it('returns false when localStorage is disabled', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('disabled'); };
    try {
      expect(save('k', 'v')).toBe(false);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('does not corrupt existing data when a save fails due to exception', () => {
    save('k', 'original');

    const original = Storage.prototype.setItem;
    // First call is the availability probe (let it pass),
    // second call is the actual write (make it fail).
    let callCount = 0;
    Storage.prototype.setItem = function (...args) {
      callCount++;
      if (callCount <= 1) {
        // Availability probe: setItem (call 1), then removeItem (not setItem)
        return original.apply(this, args);
      }
      throw new DOMException('boom', 'QuotaExceededError');
    };
    try {
      expect(save('k', 'new value that should fail')).toBe(false);
      // Restore before loading
      Storage.prototype.setItem = original;
      expect(load('k')).toBe('original');
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

// ── save — quota guard ──────────────────────────────────────────────

describe('save — quota guard', () => {
  it('returns false when payload would exceed 4 MB', () => {
    // 4 MB = 4 * 1024 * 1024 = 4194304 bytes
    // Each char in serialised JSON = 2 bytes (UTF-16)
    // So we need a string that when JSON-serialised exceeds 2M chars
    // JSON.stringify adds 2 quote chars, so payload length + 2
    const bigString = 'x'.repeat(2 * 1024 * 1024);
    expect(save('big', bigString)).toBe(false);
  });

  it('does not write when quota would be exceeded', () => {
    const bigString = 'x'.repeat(2 * 1024 * 1024);
    save('big', bigString);
    expect(localStorage.getItem('big')).toBe(null);
  });

  it('allows overwrites that stay within quota (net-delta check)', () => {
    // Fill with a moderately large value
    const mediumString = 'y'.repeat(1024 * 1024); // ~2MB when serialised
    expect(save('k', mediumString)).toBe(true);
    // Overwriting with same-sized value should succeed (net delta ~0)
    const replacement = 'z'.repeat(1024 * 1024);
    expect(save('k', replacement)).toBe(true);
    expect(load('k')).toBe(replacement);
  });

  it('emits quota warning via setQuotaWarningHandler', () => {
    const handler = vi.fn();
    setQuotaWarningHandler(handler);

    const bigString = 'x'.repeat(2 * 1024 * 1024);
    save('tooBig', bigString);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'tooBig',
        usedKB: expect.any(Number),
      }),
    );
  });

  it('does not call handler when save succeeds', () => {
    const handler = vi.fn();
    setQuotaWarningHandler(handler);

    save('small', 'hello');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns false even without a quota handler registered', () => {
    // No handler set — should still return false, not throw
    const bigString = 'x'.repeat(2 * 1024 * 1024);
    expect(save('big', bigString)).toBe(false);
  });
});

// ── remove ──────────────────────────────────────────────────────────

describe('remove', () => {
  it('removes an existing key', () => {
    save('k', 'v');
    remove('k');
    expect(load('k')).toBe(null);
  });

  it('is a no-op for a non-existent key (no throw)', () => {
    expect(() => remove('nonexistent')).not.toThrow();
  });

  it('is a no-op when localStorage is disabled (no throw)', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('disabled'); };
    try {
      expect(() => remove('k')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('only removes the specified key, not others', () => {
    save('a', 1);
    save('b', 2);
    remove('a');
    expect(load('a')).toBe(null);
    expect(load('b')).toBe(2);
  });
});

// ── getQuotaUsedKB ──────────────────────────────────────────────────

describe('getQuotaUsedKB', () => {
  it('returns 0 when localStorage is empty', () => {
    expect(getQuotaUsedKB()).toBe(0);
  });

  it('returns a positive number after saving data', () => {
    save('data', { big: 'x'.repeat(1000) });
    expect(getQuotaUsedKB()).toBeGreaterThan(0);
  });

  it('decreases after removing data', () => {
    save('data', { big: 'x'.repeat(10000) });
    const before = getQuotaUsedKB();
    remove('data');
    const after = getQuotaUsedKB();
    expect(after).toBeLessThan(before);
  });

  it('returns 0 when localStorage is disabled', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException('disabled'); };
    try {
      expect(getQuotaUsedKB()).toBe(0);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('returns KB rounded to nearest integer', () => {
    save('data', 'x'.repeat(512));
    const kb = getQuotaUsedKB();
    expect(Number.isInteger(kb)).toBe(true);
  });
});

// ── setQuotaWarningHandler ──────────────────────────────────────────

describe('setQuotaWarningHandler', () => {
  it('replaces previous handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    setQuotaWarningHandler(first);
    setQuotaWarningHandler(second);

    const bigString = 'x'.repeat(2 * 1024 * 1024);
    save('big', bigString);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('can be cleared by passing null', () => {
    const handler = vi.fn();
    setQuotaWarningHandler(handler);
    setQuotaWarningHandler(null);

    const bigString = 'x'.repeat(2 * 1024 * 1024);
    save('big', bigString);

    expect(handler).not.toHaveBeenCalled();
  });
});

// ── Round-trip integration ──────────────────────────────────────────

describe('round-trip integration', () => {
  it('save → load → remove → load returns fallback', () => {
    const data = { users: ['alice', 'bob'], points: 42 };
    save('state', data);
    expect(load('state')).toEqual(data);
    remove('state');
    expect(load('state', 'gone')).toBe('gone');
  });

  it('multiple keys are independent', () => {
    save('a', 1);
    save('b', 2);
    save('c', 3);
    expect(load('a')).toBe(1);
    expect(load('b')).toBe(2);
    expect(load('c')).toBe(3);
    remove('b');
    expect(load('a')).toBe(1);
    expect(load('b')).toBe(null);
    expect(load('c')).toBe(3);
  });
});
