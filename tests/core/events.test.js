// @vitest-environment jsdom
//
// jsdom is required because events.js imports storage.js at the
// module level (to wire the quota-warning hook), and storage.js
// accesses localStorage.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { EVENTS, on, off, emit } from '../../src/core/events.js';

// ── Cleanup ─────────────────────────────────────────────────────────
// The _listeners Map is module-level state that persists across tests.
// We track every handler registered during each test and remove it
// afterwards so tests are fully isolated.

/** @type {Array<{event: string, handler: Function}>} */
const registered = [];

function trackOn(event, handler) {
  on(event, handler);
  registered.push({ event, handler });
}

afterEach(() => {
  for (const { event, handler } of registered) {
    off(event, handler);
  }
  registered.length = 0;
});

// ── EVENTS constant ─────────────────────────────────────────────────

describe('EVENTS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(EVENTS)).toBe(true);
  });

  it('contains all 7 expected event names', () => {
    expect(Object.keys(EVENTS)).toHaveLength(7);
    expect(EVENTS.DATA_CHANGED).toBe('data:changed');
    expect(EVENTS.IMPORT_COMPLETE).toBe('import:complete');
    expect(EVENTS.IMPORT_PROGRESS).toBe('import:progress');
    expect(EVENTS.POINTS_AWARDED).toBe('points:awarded');
    expect(EVENTS.BADGE_AWARDED).toBe('badge:awarded');
    expect(EVENTS.CAMPAIGN_UPDATED).toBe('campaign:updated');
    expect(EVENTS.STORAGE_QUOTA_WARNING).toBe('storage:quotaWarning');
  });

  it('has unique values (no two constants share a string)', () => {
    const values = Object.values(EVENTS);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ── on ──────────────────────────────────────────────────────────────

describe('on', () => {
  it('registers a handler that is called on emit', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    emit(EVENTS.DATA_CHANGED, { x: 1 });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ x: 1 });
  });

  it('supports multiple handlers for the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, a);
    trackOn(EVENTS.DATA_CHANGED, b);
    emit(EVENTS.DATA_CHANGED);
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('duplicate registration of the same handler is a no-op', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    on(EVENTS.DATA_CHANGED, handler); // duplicate — not tracked for cleanup, same ref
    emit(EVENTS.DATA_CHANGED);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('different events are independent', () => {
    const a = vi.fn();
    const b = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, a);
    trackOn(EVENTS.IMPORT_COMPLETE, b);
    emit(EVENTS.DATA_CHANGED);
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
  });
});

// ── off ─────────────────────────────────────────────────────────────

describe('off', () => {
  it('removes a registered handler', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    off(EVENTS.DATA_CHANGED, handler);
    emit(EVENTS.DATA_CHANGED);
    expect(handler).not.toHaveBeenCalled();
  });

  it('is a no-op for a handler that was never registered', () => {
    const handler = vi.fn();
    expect(() => off(EVENTS.DATA_CHANGED, handler)).not.toThrow();
  });

  it('is a no-op for an event that has no listeners at all', () => {
    const handler = vi.fn();
    expect(() => off('nonexistent:event', handler)).not.toThrow();
  });

  it('only removes the specified handler, not others', () => {
    const keep = vi.fn();
    const remove = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, keep);
    trackOn(EVENTS.DATA_CHANGED, remove);
    off(EVENTS.DATA_CHANGED, remove);
    emit(EVENTS.DATA_CHANGED);
    expect(keep).toHaveBeenCalledOnce();
    expect(remove).not.toHaveBeenCalled();
  });

  it('handler can re-register after being removed', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    off(EVENTS.DATA_CHANGED, handler);
    trackOn(EVENTS.DATA_CHANGED, handler);
    emit(EVENTS.DATA_CHANGED);
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── emit ────────────────────────────────────────────────────────────

describe('emit', () => {
  it('passes the payload to the handler', () => {
    const handler = vi.fn();
    trackOn(EVENTS.POINTS_AWARDED, handler);
    const payload = { userId: 'a@b.com', points: 50 };
    emit(EVENTS.POINTS_AWARDED, payload);
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('passes undefined when no payload is given', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    emit(EVENTS.DATA_CHANGED);
    expect(handler).toHaveBeenCalledWith(undefined);
  });

  it('is a no-op for an event with no listeners', () => {
    expect(() => emit('nonexistent:event', {})).not.toThrow();
  });

  it('calls handlers in registration order', () => {
    const order = [];
    const first = () => order.push('first');
    const second = () => order.push('second');
    const third = () => order.push('third');
    trackOn(EVENTS.DATA_CHANGED, first);
    trackOn(EVENTS.DATA_CHANGED, second);
    trackOn(EVENTS.DATA_CHANGED, third);
    emit(EVENTS.DATA_CHANGED);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('calls the handler every time emit is called', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    emit(EVENTS.DATA_CHANGED);
    emit(EVENTS.DATA_CHANGED);
    emit(EVENTS.DATA_CHANGED);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('remaining handlers run even if an earlier handler throws', () => {
    const first = vi.fn(() => { throw new Error('boom'); });
    const second = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, first);
    trackOn(EVENTS.DATA_CHANGED, second);

    expect(() => emit(EVENTS.DATA_CHANGED)).toThrow('boom');
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it('re-throws the last error after all handlers execute', () => {
    const first = vi.fn(() => { throw new Error('first'); });
    const second = vi.fn(() => { throw new Error('second'); });
    trackOn(EVENTS.DATA_CHANGED, first);
    trackOn(EVENTS.DATA_CHANGED, second);

    expect(() => emit(EVENTS.DATA_CHANGED)).toThrow('second');
  });

  it('does not throw when no handler throws', () => {
    const handler = vi.fn();
    trackOn(EVENTS.DATA_CHANGED, handler);
    expect(() => emit(EVENTS.DATA_CHANGED)).not.toThrow();
  });
});

// ── storage.js integration ──────────────────────────────────────────

describe('storage quota warning integration', () => {
  it('emits STORAGE_QUOTA_WARNING when storage save exceeds quota', async () => {
    // Dynamically import save so the events.js wiring is already in place
    const { save } = await import('../../src/core/storage.js');

    const handler = vi.fn();
    trackOn(EVENTS.STORAGE_QUOTA_WARNING, handler);

    // Attempt a write that exceeds 4 MB
    const bigString = 'x'.repeat(2 * 1024 * 1024);
    save('quotaTest', bigString);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'quotaTest',
        usedKB: expect.any(Number),
      }),
    );
  });
});
