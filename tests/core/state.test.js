// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUsers,
  getUser,
  getTeams,
  getActivities,
  getCampaigns,
  getCampaign,
  getConfig,
  upsertUser,
  upsertTeam,
  addActivity,
  replaceActivity,
  addActivities,
  replaceActivities,
  upsertUsers,
  upsertCampaign,
  deleteTeam,
  deleteCampaign,
  updateConfig,
  loadFromStorage,
  exportJSON,
  importJSON,
  _resetForTesting,
} from '../../src/core/state.js';
import { EVENTS, on, off } from '../../src/core/events.js';
import { save, remove } from '../../src/core/storage.js';
import { DEFAULT_POINT_CONFIG } from '../../src/models/points.js';

// ── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  _resetForTesting();
});

// ── Helpers ─────────────────────────────────────────────────────────

function makeUser(email, extra = {}) {
  return { email, name: email.split('@')[0], totalPoints: 0, ...extra };
}

function makeActivity(id, userId, extra = {}) {
  return {
    id,
    userId,
    title: `Activity ${id}`,
    type: 'course',
    pointsEarned: 50,
    completedDate: '2026-04-15T00:00:00Z',
    source: 'test',
    ...extra,
  };
}

function makeCampaign(id, extra = {}) {
  return {
    id,
    name: `Campaign ${id}`,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    status: 'active',
    participantIds: [],
    teamIds: [],
    ...extra,
  };
}

/** Subscribe to an event for the duration of a single test. */
function listenOnce(event) {
  const handler = vi.fn();
  on(event, handler);
  // Return handler and cleanup fn
  return { handler, cleanup: () => off(event, handler) };
}

// ── getUsers / getUser ──────────────────────────────────────────────

describe('getUsers', () => {
  it('returns empty object when no users exist', () => {
    expect(getUsers()).toEqual({});
  });

  it('returns all upserted users', () => {
    upsertUser(makeUser('a@b.com'));
    upsertUser(makeUser('c@d.com'));
    const users = getUsers();
    expect(Object.keys(users)).toHaveLength(2);
    expect(users['a@b.com']).toBeDefined();
    expect(users['c@d.com']).toBeDefined();
  });

  it('returns a shallow copy (mutations do not affect state)', () => {
    upsertUser(makeUser('a@b.com'));
    const users = getUsers();
    users['x@y.com'] = { email: 'x@y.com' };
    expect(getUser('x@y.com')).toBe(null);
  });
});

describe('getUser', () => {
  it('returns null for non-existent user', () => {
    expect(getUser('nobody@example.com')).toBe(null);
  });

  it('returns user by email', () => {
    upsertUser(makeUser('alice@example.com', { name: 'Alice' }));
    const user = getUser('alice@example.com');
    expect(user.name).toBe('Alice');
  });

  it('is case-insensitive on email lookup', () => {
    upsertUser(makeUser('Alice@Example.COM'));
    expect(getUser('alice@example.com')).not.toBe(null);
    expect(getUser('ALICE@EXAMPLE.COM')).not.toBe(null);
  });

  it('returns a shallow copy (mutations do not affect state)', () => {
    upsertUser(makeUser('a@b.com', { totalPoints: 100 }));
    const user = getUser('a@b.com');
    user.totalPoints = 999;
    expect(getUser('a@b.com').totalPoints).toBe(100);
  });

  it('returns null for null/undefined email', () => {
    expect(getUser(null)).toBe(null);
    expect(getUser(undefined)).toBe(null);
  });
});

// ── upsertUser ──────────────────────────────────────────────────────

describe('upsertUser', () => {
  it('creates a new user if email not seen before', () => {
    upsertUser(makeUser('a@b.com', { name: 'Alice' }));
    expect(getUser('a@b.com').name).toBe('Alice');
  });

  it('updates existing user without overwriting unrelated fields', () => {
    upsertUser(makeUser('a@b.com', { name: 'Alice', totalPoints: 50 }));
    upsertUser({ email: 'a@b.com', totalPoints: 100 });
    const user = getUser('a@b.com');
    expect(user.totalPoints).toBe(100);
    expect(user.name).toBe('Alice'); // preserved
  });

  it('lowercases email as the key', () => {
    upsertUser(makeUser('Alice@Example.COM'));
    expect(getUser('alice@example.com')).not.toBe(null);
    expect(getUser('alice@example.com').email).toBe('alice@example.com');
  });

  it('persists to storage after upsert', () => {
    upsertUser(makeUser('a@b.com'));
    // Reload from storage in a fresh state
    _resetForTesting();
    loadFromStorage();
    expect(getUser('a@b.com')).not.toBe(null);
  });

  it('emits DATA_CHANGED after upsert', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    upsertUser(makeUser('a@b.com'));
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// ── getTeams / upsertTeam ───────────────────────────────────────────

describe('getTeams', () => {
  it('returns empty object when no teams exist', () => {
    expect(getTeams()).toEqual({});
  });

  it('returns a shallow copy', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    const teams = getTeams();
    teams['t99'] = { id: 't99' };
    expect(getTeams()['t99']).toBeUndefined();
  });
});

describe('upsertTeam', () => {
  it('creates a new team', () => {
    upsertTeam({ id: 't1', name: 'Alpha', color: 'blue', memberIds: [] });
    expect(getTeams()['t1'].name).toBe('Alpha');
  });

  it('updates existing team preserving unmodified fields', () => {
    upsertTeam({ id: 't1', name: 'Alpha', color: 'blue' });
    upsertTeam({ id: 't1', name: 'Beta' });
    const team = getTeams()['t1'];
    expect(team.name).toBe('Beta');
    expect(team.color).toBe('blue'); // preserved
  });

  it('persists to storage', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    _resetForTesting();
    loadFromStorage();
    expect(getTeams()['t1'].name).toBe('Alpha');
  });

  it('emits DATA_CHANGED', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    upsertTeam({ id: 't1', name: 'Alpha' });
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// ── deleteTeam ──────────────────────────────────────────────────────

describe('deleteTeam', () => {
  it('removes team from state', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    deleteTeam('t1');
    expect(getTeams()['t1']).toBeUndefined();
  });

  it('is a no-op for non-existent team (no emit)', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    deleteTeam('nonexistent');
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it('persists deletion', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    deleteTeam('t1');
    _resetForTesting();
    loadFromStorage();
    expect(getTeams()['t1']).toBeUndefined();
  });

  it('emits DATA_CHANGED', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    deleteTeam('t1');
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does not affect other teams', () => {
    upsertTeam({ id: 't1', name: 'Alpha' });
    upsertTeam({ id: 't2', name: 'Beta' });
    deleteTeam('t1');
    expect(getTeams()['t2'].name).toBe('Beta');
  });
});

// ── addActivity ─────────────────────────────────────────────────────

describe('addActivity', () => {
  it('appends an activity', () => {
    addActivity(makeActivity('a1', 'a@b.com'));
    expect(getActivities()).toHaveLength(1);
    expect(getActivities()[0].id).toBe('a1');
  });

  it('preserves insertion order', () => {
    addActivity(makeActivity('a1', 'a@b.com'));
    addActivity(makeActivity('a2', 'a@b.com'));
    addActivity(makeActivity('a3', 'a@b.com'));
    const ids = getActivities().map(a => a.id);
    expect(ids).toEqual(['a1', 'a2', 'a3']);
  });

  it('stores a copy of the activity (caller cannot mutate state)', () => {
    const act = makeActivity('a1', 'a@b.com');
    addActivity(act);
    act.pointsEarned = 999;
    expect(getActivities()[0].pointsEarned).toBe(50);
  });

  it('emits DATA_CHANGED', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    addActivity(makeActivity('a1', 'a@b.com'));
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('persists to storage', () => {
    addActivity(makeActivity('a1', 'a@b.com'));
    _resetForTesting();
    loadFromStorage();
    expect(getActivities()).toHaveLength(1);
  });
});

// ── getActivities filters ───────────────────────────────────────────

describe('getActivities', () => {
  beforeEach(() => {
    addActivity(makeActivity('a1', 'alice@b.com', {
      type: 'course', completedDate: '2026-01-15T00:00:00Z',
    }));
    addActivity(makeActivity('a2', 'alice@b.com', {
      type: 'quiz', completedDate: '2026-03-10T00:00:00Z',
    }));
    addActivity(makeActivity('a3', 'bob@b.com', {
      type: 'course', completedDate: '2026-05-20T00:00:00Z',
    }));
    addActivity(makeActivity('a4', 'bob@b.com', {
      type: 'meeting', completedDate: '2026-06-01T00:00:00Z',
    }));
  });

  it('returns all activities when no filters', () => {
    expect(getActivities()).toHaveLength(4);
  });

  it('returns a new array (not the internal reference)', () => {
    const a = getActivities();
    const b = getActivities();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('filters by userId', () => {
    const result = getActivities({ userId: 'alice@b.com' });
    expect(result).toHaveLength(2);
    expect(result.every(a => a.userId === 'alice@b.com')).toBe(true);
  });

  it('userId filter is case-insensitive', () => {
    const result = getActivities({ userId: 'ALICE@B.COM' });
    expect(result).toHaveLength(2);
  });

  it('filters by type', () => {
    const result = getActivities({ type: 'course' });
    expect(result).toHaveLength(2);
    expect(result.every(a => a.type === 'course')).toBe(true);
  });

  it('filters by fromDate (inclusive)', () => {
    const result = getActivities({ fromDate: '2026-03-10T00:00:00Z' });
    expect(result).toHaveLength(3); // a2, a3, a4
  });

  it('filters by toDate (inclusive)', () => {
    const result = getActivities({ toDate: '2026-03-10T00:00:00Z' });
    expect(result).toHaveLength(2); // a1, a2
  });

  it('combines multiple filters with AND', () => {
    const result = getActivities({
      userId: 'bob@b.com',
      type: 'course',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a3');
  });

  it('combines date range filters', () => {
    const result = getActivities({
      fromDate: '2026-02-01T00:00:00Z',
      toDate: '2026-05-31T23:59:59Z',
    });
    expect(result).toHaveLength(2); // a2, a3
  });

  it('returns empty array when no activities match', () => {
    expect(getActivities({ userId: 'nobody@b.com' })).toEqual([]);
  });
});

// ── getActivities — campaignId filter ───────────────────────────────

describe('getActivities — campaignId filter', () => {
  beforeEach(() => {
    upsertUser(makeUser('alice@b.com'));
    upsertUser(makeUser('bob@b.com'));
    upsertUser(makeUser('charlie@b.com'));
    upsertTeam({ id: 't1', name: 'Alpha', memberIds: ['bob@b.com'] });

    addActivity(makeActivity('a1', 'alice@b.com', {
      completedDate: '2026-02-15T00:00:00Z',
    }));
    addActivity(makeActivity('a2', 'bob@b.com', {
      completedDate: '2026-03-10T00:00:00Z',
    }));
    addActivity(makeActivity('a3', 'charlie@b.com', {
      completedDate: '2026-04-20T00:00:00Z',
    }));
    addActivity(makeActivity('a4', 'alice@b.com', {
      completedDate: '2025-12-01T00:00:00Z', // before campaign
    }));
  });

  it('scopes to campaign participants and date window', () => {
    upsertCampaign(makeCampaign('c1', {
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-06-30T23:59:59Z',
      participantIds: ['alice@b.com'],
      teamIds: ['t1'], // includes bob via team
    }));

    const result = getActivities({ campaignId: 'c1' });
    const ids = result.map(a => a.id);
    expect(ids).toContain('a1'); // alice, in range
    expect(ids).toContain('a2'); // bob (via team), in range
    expect(ids).not.toContain('a3'); // charlie not a participant
    expect(ids).not.toContain('a4'); // alice but before startDate
  });

  it('returns empty array for nonexistent campaign', () => {
    expect(getActivities({ campaignId: 'nonexistent' })).toEqual([]);
  });

  it('handles open-ended campaign (null endDate)', () => {
    upsertCampaign(makeCampaign('c2', {
      startDate: '2026-03-01T00:00:00Z',
      endDate: null,
      participantIds: ['alice@b.com', 'bob@b.com', 'charlie@b.com'],
    }));

    const result = getActivities({ campaignId: 'c2' });
    const ids = result.map(a => a.id);
    expect(ids).toEqual(expect.arrayContaining(['a2', 'a3']));
    expect(ids).not.toContain('a1'); // before startDate
    expect(ids).not.toContain('a4'); // before startDate
  });

  it('can combine campaignId with other filters', () => {
    upsertCampaign(makeCampaign('c1', {
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      participantIds: ['alice@b.com', 'bob@b.com'],
    }));

    const result = getActivities({ campaignId: 'c1', userId: 'alice@b.com' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('skips activities with null completedDate', () => {
    addActivity(makeActivity('a5', 'alice@b.com', { completedDate: null }));
    upsertCampaign(makeCampaign('c1', {
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2026-12-31T23:59:59Z',
      participantIds: ['alice@b.com'],
    }));

    const result = getActivities({ campaignId: 'c1' });
    expect(result.find(a => a.id === 'a5')).toBeUndefined();
  });
});

// ── getCampaigns / getCampaign ──────────────────────────────────────

describe('getCampaigns', () => {
  it('returns empty object when no campaigns exist', () => {
    expect(getCampaigns()).toEqual({});
  });

  it('returns a shallow copy', () => {
    upsertCampaign(makeCampaign('c1'));
    const campaigns = getCampaigns();
    campaigns['c99'] = { id: 'c99' };
    expect(getCampaign('c99')).toBe(null);
  });
});

describe('getCampaign', () => {
  it('returns null for non-existent campaign', () => {
    expect(getCampaign('nope')).toBe(null);
  });

  it('returns the campaign by id', () => {
    upsertCampaign(makeCampaign('c1', { name: 'Q1 Push' }));
    expect(getCampaign('c1').name).toBe('Q1 Push');
  });

  it('returns a shallow copy (mutations do not affect state)', () => {
    upsertCampaign(makeCampaign('c1', { name: 'Original' }));
    const c = getCampaign('c1');
    c.name = 'Mutated';
    expect(getCampaign('c1').name).toBe('Original');
  });
});

// ── upsertCampaign ──────────────────────────────────────────────────

describe('upsertCampaign', () => {
  it('creates a new campaign', () => {
    upsertCampaign(makeCampaign('c1', { name: 'New' }));
    expect(getCampaign('c1').name).toBe('New');
  });

  it('updates existing campaign preserving unmodified fields', () => {
    upsertCampaign(makeCampaign('c1', { name: 'Old', status: 'draft' }));
    upsertCampaign({ id: 'c1', status: 'active' });
    const c = getCampaign('c1');
    expect(c.status).toBe('active');
    expect(c.name).toBe('Old'); // preserved
  });

  it('persists to storage', () => {
    upsertCampaign(makeCampaign('c1'));
    _resetForTesting();
    loadFromStorage();
    expect(getCampaign('c1')).not.toBe(null);
  });

  it('emits DATA_CHANGED', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    upsertCampaign(makeCampaign('c1'));
    expect(handler).toHaveBeenCalled();
    cleanup();
  });

  it('emits CAMPAIGN_UPDATED with campaign id', () => {
    const { handler, cleanup } = listenOnce(EVENTS.CAMPAIGN_UPDATED);
    upsertCampaign(makeCampaign('c1'));
    expect(handler).toHaveBeenCalledWith({ id: 'c1' });
    cleanup();
  });
});

// ── deleteCampaign ──────────────────────────────────────────────────

describe('deleteCampaign', () => {
  it('removes campaign from state', () => {
    upsertCampaign(makeCampaign('c1'));
    deleteCampaign('c1');
    expect(getCampaign('c1')).toBe(null);
  });

  it('is a no-op for non-existent campaign (no emit)', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    deleteCampaign('nonexistent');
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it('does not delete associated activities or users', () => {
    upsertUser(makeUser('a@b.com'));
    addActivity(makeActivity('a1', 'a@b.com'));
    upsertCampaign(makeCampaign('c1', { participantIds: ['a@b.com'] }));
    deleteCampaign('c1');

    expect(getUser('a@b.com')).not.toBe(null);
    expect(getActivities()).toHaveLength(1);
  });

  it('persists deletion', () => {
    upsertCampaign(makeCampaign('c1'));
    deleteCampaign('c1');
    _resetForTesting();
    loadFromStorage();
    expect(getCampaign('c1')).toBe(null);
  });

  it('emits DATA_CHANGED', () => {
    upsertCampaign(makeCampaign('c1'));
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    deleteCampaign('c1');
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// ── getConfig / updateConfig ────────────────────────────────────────

describe('getConfig', () => {
  it('returns default config initially', () => {
    const cfg = getConfig();
    expect(cfg.version).toBe('2.0');
    expect(cfg.pointConfig).toBeDefined();
  });

  it('returns a shallow copy', () => {
    const cfg = getConfig();
    cfg.version = '9.9';
    expect(getConfig().version).toBe('2.0');
  });
});

describe('updateConfig', () => {
  it('merges partial config', () => {
    updateConfig({ lastReset: '2026-04' });
    expect(getConfig().lastReset).toBe('2026-04');
    expect(getConfig().version).toBe('2.0'); // preserved
  });

  it('persists to storage', () => {
    updateConfig({ version: '2.0' });
    _resetForTesting();
    loadFromStorage();
    expect(getConfig().version).toBe('2.0');
  });

  it('emits DATA_CHANGED', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    updateConfig({ version: '2.0' });
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// ── loadFromStorage ─────────────────────────────────────────────────

describe('loadFromStorage', () => {
  it('restores full state including campaigns', () => {
    upsertUser(makeUser('a@b.com'));
    upsertTeam({ id: 't1', name: 'Alpha' });
    addActivity(makeActivity('a1', 'a@b.com'));
    upsertCampaign(makeCampaign('c1'));

    _resetForTesting();
    loadFromStorage();

    expect(getUser('a@b.com')).not.toBe(null);
    expect(getTeams()['t1']).toBeDefined();
    expect(getActivities()).toHaveLength(1);
    expect(getCampaign('c1')).not.toBe(null);
  });

  it('starts with empty state if localStorage is empty', () => {
    loadFromStorage();
    expect(getUsers()).toEqual({});
    expect(getActivities()).toEqual([]);
    expect(getTeams()).toEqual({});
    expect(getCampaigns()).toEqual({});
  });

  it('handles corrupted localStorage without throwing', () => {
    localStorage.setItem('cloudCompData', '{not valid json!!!');
    expect(() => loadFromStorage()).not.toThrow();
    expect(getUsers()).toEqual({});
  });

  it('fills missing fields with defaults', () => {
    // Save partial data directly
    save('cloudCompData', { users: { 'a@b.com': makeUser('a@b.com') } });
    loadFromStorage();
    expect(getUser('a@b.com')).not.toBe(null);
    expect(getActivities()).toEqual([]); // defaulted
    expect(getConfig().pointConfig).toBeDefined(); // defaulted
  });
});

// ── exportJSON ──────────────────────────────────────────────────────

describe('exportJSON', () => {
  it('returns a JSON-safe snapshot of all state', () => {
    upsertUser(makeUser('a@b.com'));
    addActivity(makeActivity('a1', 'a@b.com'));
    upsertCampaign(makeCampaign('c1'));

    const json = exportJSON();
    expect(json.users['a@b.com']).toBeDefined();
    expect(json.activities).toHaveLength(1);
    expect(json.campaigns['c1']).toBeDefined();
    expect(json.config).toBeDefined();
    expect(json.metadata.exportedDate).toBeDefined();
  });

  it('returns copies (mutations do not affect state)', () => {
    upsertUser(makeUser('a@b.com'));
    const json = exportJSON();
    json.users['a@b.com'].name = 'MUTATED';
    delete json.users['a@b.com'];
    expect(getUser('a@b.com')).not.toBe(null);
  });

  it('is JSON-serialisable', () => {
    upsertUser(makeUser('a@b.com'));
    addActivity(makeActivity('a1', 'a@b.com'));
    const json = exportJSON();
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});

// ── importJSON ──────────────────────────────────────────────────────

describe('importJSON', () => {
  it('replaces entire state with imported data', () => {
    upsertUser(makeUser('old@b.com'));
    importJSON({
      users: { 'new@b.com': makeUser('new@b.com') },
      activities: [makeActivity('a1', 'new@b.com')],
    });
    expect(getUser('old@b.com')).toBe(null);
    expect(getUser('new@b.com')).not.toBe(null);
    expect(getActivities()).toHaveLength(1);
  });

  it('persists imported data to storage', () => {
    importJSON({ users: { 'a@b.com': makeUser('a@b.com') } });
    _resetForTesting();
    loadFromStorage();
    expect(getUser('a@b.com')).not.toBe(null);
  });

  it('emits DATA_CHANGED', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    importJSON({ users: {} });
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('fills missing fields with defaults', () => {
    importJSON({ users: { 'a@b.com': makeUser('a@b.com') } });
    expect(getActivities()).toEqual([]);
    expect(getConfig().pointConfig).toBeDefined();
    expect(getCampaigns()).toEqual({});
  });

  it('round-trips with exportJSON', () => {
    upsertUser(makeUser('a@b.com', { totalPoints: 100 }));
    addActivity(makeActivity('a1', 'a@b.com', { pointsEarned: 100 }));
    upsertTeam({ id: 't1', name: 'Alpha', memberIds: ['a@b.com'] });
    upsertCampaign(makeCampaign('c1'));

    const exported = exportJSON();
    _resetForTesting();
    importJSON(exported);

    expect(getUser('a@b.com').totalPoints).toBe(100);
    expect(getActivities()).toHaveLength(1);
    expect(getTeams()['t1'].name).toBe('Alpha');
    expect(getCampaign('c1')).not.toBe(null);
  });
});

// ── _resetForTesting ────────────────────────────────────────────────

describe('_resetForTesting', () => {
  it('resets state to empty defaults', () => {
    upsertUser(makeUser('a@b.com'));
    addActivity(makeActivity('a1', 'a@b.com'));
    _resetForTesting();
    expect(getUsers()).toEqual({});
    expect(getActivities()).toEqual([]);
  });

  it('does not persist the reset (localStorage unchanged)', () => {
    upsertUser(makeUser('a@b.com'));
    _resetForTesting();
    // localStorage still has the old data
    loadFromStorage();
    expect(getUser('a@b.com')).not.toBe(null);
  });
});

// ── replaceActivity ─────────────────────────────────────────────────

describe('replaceActivity', () => {
  it('returns true and replaces when id matches', () => {
    addActivity(makeActivity('a1', 'a@b.com', { title: 'Original' }));
    const updated = makeActivity('a1', 'a@b.com', { title: 'Updated' });
    const result = replaceActivity(updated);
    expect(result).toBe(true);
    expect(getActivities()[0].title).toBe('Updated');
  });

  it('returns false when id not found', () => {
    addActivity(makeActivity('a1', 'a@b.com'));
    const result = replaceActivity(makeActivity('nonexistent', 'a@b.com'));
    expect(result).toBe(false);
  });

  it('does not mutate the original activities array (getActivities returns copy)', () => {
    addActivity(makeActivity('a1', 'a@b.com', { title: 'First' }));
    const before = getActivities();
    replaceActivity(makeActivity('a1', 'a@b.com', { title: 'Replaced' }));
    // The snapshot taken before replace should be unchanged
    expect(before[0].title).toBe('First');
  });

  it('persists replaced activity to localStorage', () => {
    addActivity(makeActivity('a1', 'a@b.com', { title: 'Original' }));
    replaceActivity(makeActivity('a1', 'a@b.com', { title: 'Persisted' }));
    _resetForTesting();
    loadFromStorage();
    expect(getActivities()[0].title).toBe('Persisted');
  });

  it('emits DATA_CHANGED on successful replace', () => {
    addActivity(makeActivity('a1', 'a@b.com'));
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    replaceActivity(makeActivity('a1', 'a@b.com', { title: 'New' }));
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });
});

// ── Bulk writes (used by importers to avoid O(N²) persistence) ──────

describe('addActivities (bulk)', () => {
  it('appends all activities in one batch', () => {
    addActivities([
      makeActivity('a1', 'a@b.com'),
      makeActivity('a2', 'a@b.com'),
      makeActivity('a3', 'c@d.com'),
    ]);
    expect(getActivities()).toHaveLength(3);
    expect(getActivities().map(a => a.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('returns the number appended', () => {
    expect(addActivities([makeActivity('a1', 'a@b.com'), makeActivity('a2', 'a@b.com')])).toBe(2);
  });

  it('is a no-op for empty or missing input', () => {
    expect(addActivities([])).toBe(0);
    expect(addActivities(null)).toBe(0);
    expect(addActivities(undefined)).toBe(0);
    expect(getActivities()).toHaveLength(0);
  });

  it('emits DATA_CHANGED exactly once for the whole batch', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    addActivities([
      makeActivity('a1', 'a@b.com'),
      makeActivity('a2', 'a@b.com'),
      makeActivity('a3', 'a@b.com'),
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does not emit DATA_CHANGED on empty input', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    addActivities([]);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });

  it('stores copies — mutating an input does not affect stored state', () => {
    const act = makeActivity('a1', 'a@b.com');
    addActivities([act]);
    act.title = 'mutated';
    expect(getActivities()[0].title).toBe('Activity a1');
  });
});

describe('replaceActivities (bulk)', () => {
  beforeEach(() => {
    addActivities([
      makeActivity('a1', 'a@b.com', { status: 'in_progress' }),
      makeActivity('a2', 'a@b.com', { status: 'in_progress' }),
      makeActivity('a3', 'a@b.com', { status: 'completed' }),
    ]);
  });

  it('replaces all matching activities in one batch', () => {
    replaceActivities([
      makeActivity('a1', 'a@b.com', { status: 'completed', title: 'A1 done' }),
      makeActivity('a2', 'a@b.com', { status: 'completed', title: 'A2 done' }),
    ]);
    const acts = getActivities();
    expect(acts.find(a => a.id === 'a1').status).toBe('completed');
    expect(acts.find(a => a.id === 'a1').title).toBe('A1 done');
    expect(acts.find(a => a.id === 'a2').status).toBe('completed');
    expect(acts.find(a => a.id === 'a3').status).toBe('completed'); // untouched
  });

  it('returns the number replaced and silently ignores unknown ids', () => {
    const n = replaceActivities([
      makeActivity('a1', 'a@b.com'),
      makeActivity('unknown', 'a@b.com'),
    ]);
    expect(n).toBe(1);
  });

  it('emits DATA_CHANGED exactly once when at least one match is replaced', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    replaceActivities([
      makeActivity('a1', 'a@b.com'),
      makeActivity('a2', 'a@b.com'),
    ]);
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does not emit DATA_CHANGED when no ids match', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    replaceActivities([makeActivity('unknown', 'a@b.com')]);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });
});

describe('upsertUsers (bulk)', () => {
  it('inserts new users in one batch', () => {
    upsertUsers([
      makeUser('a@b.com', { name: 'Alice' }),
      makeUser('c@d.com', { name: 'Carol' }),
    ]);
    expect(Object.keys(getUsers())).toHaveLength(2);
    expect(getUser('a@b.com').name).toBe('Alice');
    expect(getUser('c@d.com').name).toBe('Carol');
  });

  it('merges with existing users on email match (lowercase key)', () => {
    upsertUser(makeUser('a@b.com', { name: 'Old', totalPoints: 10 }));
    upsertUsers([{ email: 'A@b.com', name: 'New' }]);
    const u = getUser('a@b.com');
    expect(u.name).toBe('New');
    expect(u.totalPoints).toBe(10); // preserved by merge
    expect(u.email).toBe('a@b.com'); // normalised
  });

  it('returns the number written and ignores entries without an email', () => {
    const n = upsertUsers([
      makeUser('a@b.com'),
      { name: 'no-email' },
      null,
      undefined,
      makeUser('c@d.com'),
    ]);
    expect(n).toBe(2);
    expect(Object.keys(getUsers())).toHaveLength(2);
  });

  it('emits DATA_CHANGED exactly once for the whole batch', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    upsertUsers([makeUser('a@b.com'), makeUser('c@d.com'), makeUser('e@f.com')]);
    expect(handler).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('is a no-op for empty input', () => {
    const { handler, cleanup } = listenOnce(EVENTS.DATA_CHANGED);
    expect(upsertUsers([])).toBe(0);
    expect(handler).not.toHaveBeenCalled();
    cleanup();
  });
});

// ── migrateActivities via loadFromStorage ───────────────────────────

describe('migrateActivities via loadFromStorage', () => {
  it('backfills status:completed on legacy activities without a status field', () => {
    const legacy = {
      users: {},
      teams: {},
      activities: [
        { id: 'a1', userId: 'a@b.com', title: 'Legacy Course', pointsEarned: 50 },
      ],
      campaigns: {},
    };
    save('cloudCompData', legacy);
    loadFromStorage();
    expect(getActivities()[0].status).toBe('completed');
  });

  it('preserves existing status values (in_progress stays in_progress)', () => {
    const data = {
      activities: [
        { id: 'a1', userId: 'a@b.com', title: 'In Progress', status: 'in_progress' },
      ],
    };
    save('cloudCompData', data);
    loadFromStorage();
    expect(getActivities()[0].status).toBe('in_progress');
  });
});

// ── migrateConfig via loadFromStorage ───────────────────────────────

describe('migrateConfig via loadFromStorage', () => {
  it('replaces v1.x config (version:1.0) with DEFAULT_POINT_CONFIG and version:2.0', () => {
    const data = {
      config: { version: '1.0', pointConfig: { selfPacedDigital: { old: 5 } } },
    };
    save('cloudCompData', data);
    loadFromStorage();
    const cfg = getConfig();
    expect(cfg.version).toBe('2.0');
    expect(cfg.pointConfig).toEqual(DEFAULT_POINT_CONFIG);
  });

  it('produces a v2.0 config when stored config has no version field', () => {
    // loadFromStorage merges defaultConfig (v2.0) over stored config, so the
    // merged object gets version:'2.0' from defaults and migrateConfig passes it
    // through unchanged.  The result must still be a valid v2.0 config.
    const data = {
      config: { pointConfig: { selfPacedDigital: { old: 5 } } },
    };
    save('cloudCompData', data);
    loadFromStorage();
    const cfg = getConfig();
    expect(cfg.version).toBe('2.0');
    // pointConfig from stored data overrides the default in the merge before
    // migration, so the stored (non-default) pointConfig is preserved here.
    expect(cfg.pointConfig).toBeDefined();
  });

  it('leaves v2.0 config untouched and preserves lastReset', () => {
    const data = {
      config: {
        version: '2.0',
        lastReset: '2026-01',
        pointConfig: { ...DEFAULT_POINT_CONFIG },
      },
    };
    save('cloudCompData', data);
    loadFromStorage();
    const cfg = getConfig();
    expect(cfg.version).toBe('2.0');
    expect(cfg.lastReset).toBe('2026-01');
  });
});

// ── getActivities status filter ─────────────────────────────────────

describe('getActivities status filter', () => {
  beforeEach(() => {
    addActivity(makeActivity('a1', 'a@b.com', { status: 'completed' }));
    addActivity(makeActivity('a2', 'a@b.com', { status: 'in_progress' }));
    addActivity(makeActivity('a3', 'a@b.com', { status: 'enrolled' }));
  });

  it('filters by status:completed', () => {
    const result = getActivities({ status: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('filters by status:in_progress', () => {
    const result = getActivities({ status: 'in_progress' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a2');
  });

  it('filters by status:enrolled', () => {
    const result = getActivities({ status: 'enrolled' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a3');
  });

  it('treats activities without status field as completed', () => {
    addActivity(makeActivity('a4', 'a@b.com')); // no status field in makeActivity
    // makeActivity sets pointsEarned etc but no status, so add one without it explicitly
    // Actually makeActivity spreads extra, and createActivity defaults status='completed'
    // So add raw activity via save to simulate truly missing status:
    const rawData = {
      activities: [
        { id: 'legacy1', userId: 'a@b.com', title: 'Legacy' },
      ],
    };
    save('cloudCompData', rawData);
    _resetForTesting();
    loadFromStorage();
    const result = getActivities({ status: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('legacy1');
  });
});
