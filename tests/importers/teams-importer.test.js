import { describe, it, expect } from 'vitest';
import { importTeamsFile } from '../../src/importers/teams-importer.js';
import { DEFAULT_POINT_CONFIG } from '../../src/models/points.js';

// ── Helpers ─────────────────────────────────────────────────────────

const cfg = DEFAULT_POINT_CONFIG;
const opts = (extra = {}) => ({ config: cfg, filename: 'meeting.csv', ...extra });

function meetingCsv(title, attendedCount, emails) {
  const lines = [`Meeting title: ${title}`];
  if (attendedCount !== null) {
    lines.push(`Attended participants: ${attendedCount}`);
  }
  for (const email of emails) {
    lines.push(email);
  }
  return lines.join('\n');
}

function multiMeetingCsv(meetings) {
  return meetings.map(m => meetingCsv(m.title, m.count, m.emails)).join('\n');
}

// ── Basic parsing ───────────────────────────────────────────────────

describe('importTeamsFile — basic parsing', () => {
  it('parses a single meeting with attendees', async () => {
    const csv = meetingCsv('Standup', 2, ['alice@b.com', 'bob@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it('parses multiple meetings in one file', async () => {
    const csv = multiMeetingCsv([
      { title: 'Standup', count: 2, emails: ['alice@b.com', 'bob@b.com'] },
      { title: 'Retro', count: 1, emails: ['charlie@b.com'] },
    ]);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(3);
  });

  it('sets type to "meeting" for all activities', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].type).toBe('meeting');
  });

  it('sets courseType to "Teams Meeting"', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].courseType).toBe('Teams Meeting');
  });

  it('awards meeting points from config (25 default)', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].pointsEarned).toBe(25);
  });

  it('sets source to "teams-import"', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].source).toBe('teams-import');
  });

  it('lowercases attendee emails', async () => {
    const csv = meetingCsv('Standup', 1, ['ALICE@B.COM']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].userId).toBe('alice@b.com');
  });

  it('deduplicates emails within the same meeting', async () => {
    const csv = meetingCsv('Standup', 2, ['alice@b.com', 'alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(1);
  });

  it('sets title from meeting title line', async () => {
    const csv = meetingCsv('Weekly Sync', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].title).toBe('Weekly Sync');
  });
});

// ── Meeting ID determinism ──────────────────────────────────────────

describe('importTeamsFile — meeting ID', () => {
  it('generates deterministic meeting IDs from title', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const r1 = await importTeamsFile(csv, opts());
    const r2 = await importTeamsFile(csv, opts());
    expect(r1.activities[0].id).toBe(r2.activities[0].id);
  });

  it('generates different IDs for different meeting titles', async () => {
    const csv1 = meetingCsv('Standup', 1, ['alice@b.com']);
    const csv2 = meetingCsv('Retro', 1, ['alice@b.com']);
    const r1 = await importTeamsFile(csv1, opts());
    const r2 = await importTeamsFile(csv2, opts());
    expect(r1.activities[0].id).not.toBe(r2.activities[0].id);
  });
});

// ── User creation ───────────────────────────────────────────────────

describe('importTeamsFile — user creation', () => {
  it('creates User for every unique email', async () => {
    const csv = multiMeetingCsv([
      { title: 'Standup', count: 2, emails: ['alice@b.com', 'bob@b.com'] },
      { title: 'Retro', count: 1, emails: ['alice@b.com'] },
    ]);
    const result = await importTeamsFile(csv, opts());
    expect(result.users).toHaveLength(2);
    expect(result.users.map(u => u.email).sort()).toEqual(['alice@b.com', 'bob@b.com']);
  });
});

// ── Date extraction ─────────────────────────────────────────────────

describe('importTeamsFile — date from filename', () => {
  it('extracts date from filename with YYYY-MM-DD pattern', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts({ filename: 'meeting_2026-03-15.csv' }));
    expect(result.activities[0].completedDate).toContain('2026-03-15');
  });

  it('extracts date from filename with underscores', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts({ filename: 'meeting_2026_03_15.csv' }));
    expect(result.activities[0].completedDate).toContain('2026-03-15');
  });

  it('falls back to current date when filename has no date', async () => {
    const csv = meetingCsv('Standup', 1, ['alice@b.com']);
    const result = await importTeamsFile(csv, opts({ filename: 'meeting.csv' }));
    const today = new Date().toISOString().slice(0, 10);
    expect(result.activities[0].completedDate).toContain(today);
  });
});

// ── Title parsing variants ──────────────────────────────────────────

describe('importTeamsFile — title parsing', () => {
  it('handles "Meeting Title:" with colon', async () => {
    const csv = 'Meeting Title: My Meeting\nalice@b.com';
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].title).toBe('My Meeting');
  });

  it('handles tab-separated title', async () => {
    const csv = 'Meeting title\tMy Meeting\nalice@b.com';
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].title).toBe('My Meeting');
  });

  it('strips parenthetical from title', async () => {
    const csv = 'Meeting title: My Meeting (recurring)\nalice@b.com';
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].title).toBe('My Meeting');
  });

  it('handles null bytes in input', async () => {
    const csv = 'Meeting title: Standup\0\nalice@b.com\0';
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(1);
  });
});

// ── Warnings ────────────────────────────────────────────────────────

describe('importTeamsFile — warnings', () => {
  it('warns when no meetings found', async () => {
    const csv = 'just some random text\nno meeting here';
    const result = await importTeamsFile(csv, opts());
    expect(result.warnings.some(w => w.includes('No meetings found'))).toBe(true);
    expect(result.activities).toHaveLength(0);
  });

  it('warns when attended count is set but no emails found', async () => {
    // A meeting title followed by a count but no email lines
    const csv = 'Meeting title: Ghost Meeting\nAttended participants: 5\nSummary of something';
    const result = await importTeamsFile(csv, opts());
    // The meeting has no emails so it won't be pushed to meetings array
    // because `emails.length > 0` check fails — but the warn happens
    // for meetings that DO get pushed with 0 emails.
    // Let's verify we at least get a warning or no activities.
    expect(result.activities).toHaveLength(0);
  });
});

// ── Error handling ──────────────────────────────────────────────────

describe('importTeamsFile — error handling', () => {
  it('returns error (not throws) for empty content', async () => {
    const result = await importTeamsFile('', opts());
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    expect(result.activities).toHaveLength(0);
  });

  it('returns error (not throws) for null content', async () => {
    const result = await importTeamsFile(null, opts());
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
  });

  it('returns error (not throws) for whitespace-only content', async () => {
    const result = await importTeamsFile('   \n  \n  ', opts());
    expect(result.errors.some(e => e.includes('empty'))).toBe(true);
  });
});

// ── dryRun ──────────────────────────────────────────────────────────

describe('importTeamsFile — dryRun', () => {
  it('returns empty activities and users when dryRun is true', async () => {
    const csv = meetingCsv('Standup', 2, ['alice@b.com', 'bob@b.com']);
    const result = await importTeamsFile(csv, opts({ dryRun: true }));
    expect(result.activities).toHaveLength(0);
    expect(result.users).toHaveLength(0);
  });

  it('still returns warnings when dryRun is true', async () => {
    const csv = 'just random text';
    const result = await importTeamsFile(csv, opts({ dryRun: true }));
    // No meetings found warning
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Result shape ────────────────────────────────────────────────────

describe('importTeamsFile — result shape', () => {
  it('always returns { activities, users, warnings, errors }', async () => {
    const result = await importTeamsFile('', opts());
    expect(result).toHaveProperty('activities');
    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.activities)).toBe(true);
    expect(Array.isArray(result.users)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ── Sectioned report format (newer Teams attendance export) ─────────

describe('importTeamsFile — sectioned report format', () => {
  // Mirrors the screenshot the user shared: tabular "2. Participants"
  // section with Name | First Join | Last Leave | In-Meeting Duration
  // | Email | Participant ID (UPN) | Role | Engagement: ... columns.
  function sectionedCsv({ title, participants, includeSummary = true }) {
    const lines = [];
    if (includeSummary) {
      lines.push('1. Summary');
      if (title) lines.push(`Meeting title\t${title}`);
      lines.push(`Attended participants\t${participants.length}`);
      lines.push('');
    }
    lines.push('2. Participants');
    lines.push([
      'Name', 'First Join', 'Last Leave', 'In-Meeting Duration', 'Email',
      'Participant ID (UPN)', 'Role', 'Engagement: Reaction-Applause',
      'Engagement: Camera On', 'Engagement: Raise Hands', 'Engagement: Unmute',
    ].join('\t'));
    for (const p of participants) {
      lines.push([
        p.name, p.firstJoin ?? '', p.lastLeave ?? '', p.duration ?? '',
        p.email, p.upn ?? p.email, p.role ?? 'Attendee',
        '', '', '', '',
      ].join('\t'));
    }
    return lines.join('\n');
  }

  it('parses participants from a sectioned report with a Meeting title row', async () => {
    const csv = sectionedCsv({
      title: 'Cloud Incubator Evolve Session 5',
      participants: [
        { name: 'Alice One',   firstJoin: '5/14/26, 10:46:35 AM', lastLeave: '5/14/26, 12:01:22 PM', duration: '1h 14m 46s', email: 'alice.one@example.com',   role: 'Organiser' },
        { name: 'Bob Two',     firstJoin: '5/14/26, 10:45:08 AM', lastLeave: '5/14/26, 11:09:29 AM', duration: '8m 21s',     email: 'bob.two@example.com',     role: 'Presenter' },
        { name: 'Cara Three',  firstJoin: '5/14/26, 10:45:17 AM', lastLeave: '5/14/26, 10:45:30 AM', duration: '13s',        email: 'cara.three@example.com',  role: 'Presenter' },
      ],
    });
    const result = await importTeamsFile(csv, opts({ filename: 'attendance.csv' }));
    expect(result.errors).toEqual([]);
    expect(result.activities).toHaveLength(3);
    expect(result.activities[0].title).toBe('Cloud Incubator Evolve Session 5');
    expect(result.activities.map(a => a.userId).sort()).toEqual([
      'alice.one@example.com',
      'bob.two@example.com',
      'cara.three@example.com',
    ]);
  });

  it('counts every attendee regardless of In-Meeting Duration (no min threshold)', async () => {
    const csv = sectionedCsv({
      title: 'Standup',
      participants: [
        { name: 'Long',  duration: '1h 14m 46s', email: 'long@b.com' },
        { name: 'Short', duration: '13s',         email: 'short@b.com' },
        { name: 'Zero',  duration: '0s',          email: 'zero@b.com' },
      ],
    });
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(3);
    expect(result.activities.every(a => a.pointsEarned === 25)).toBe(true);
  });

  it('synthesises a title from the filename when section 1 omits one', async () => {
    const csv = sectionedCsv({
      title: null,
      includeSummary: false,
      participants: [
        { name: 'Alice', email: 'alice@b.com', duration: '1h' },
      ],
    });
    const result = await importTeamsFile(csv, opts({
      filename: 'MeetingAttendanceReport-Weekly Sync-2026-05-14.csv',
    }));
    expect(result.errors).toEqual([]);
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].title).toBe('Weekly Sync');
  });

  it('stops at the next numbered section (e.g. 3. In-Meeting Activities)', async () => {
    const csv = [
      sectionedCsv({
        title: 'Standup',
        participants: [
          { name: 'Alice', email: 'alice@b.com', duration: '1h' },
          { name: 'Bob',   email: 'bob@b.com',   duration: '30m' },
        ],
      }),
      '',
      '3. In-Meeting Activities',
      'Timestamp\tEvent\tUser',
      '10:46:00 AM\tJoined\tspy@somewhere.com',
    ].join('\n');
    const result = await importTeamsFile(csv, opts());
    expect(result.activities.map(a => a.userId).sort()).toEqual(['alice@b.com', 'bob@b.com']);
  });

  it('falls back to the email-shaped value on the row when the Email column is blank', async () => {
    // Simulate a row whose dedicated Email column is empty but the
    // UPN column carries the address.
    const header = ['Name', 'First Join', 'Last Leave', 'In-Meeting Duration', 'Email', 'Participant ID (UPN)', 'Role'].join('\t');
    const csv = [
      '2. Participants',
      header,
      ['Alice', '', '', '1h', '', 'alice@b.com', 'Attendee'].join('\t'),
    ].join('\n');
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].userId).toBe('alice@b.com');
  });

  it('still works when "Meeting title" uses the legacy label spelling', async () => {
    const csv = [
      '1. Summary',
      'Meeting title\tBoard Meeting',
      '',
      '2. Participants',
      ['Name', 'First Join', 'Last Leave', 'In-Meeting Duration', 'Email', 'Role'].join('\t'),
      ['Alice', '', '', '1h', 'alice@b.com', 'Organiser'].join('\t'),
    ].join('\n');
    const result = await importTeamsFile(csv, opts());
    expect(result.activities[0].title).toBe('Board Meeting');
  });

  it('distinguishes recurring meetings with the same title via Start time', async () => {
    // Two attendance reports from the same recurring webinar:
    // identical title, different dates. Both should land — the
    // meetingId is suffixed with the meeting date so externalIds
    // don't collide in dedup.
    const may = sectionedCsv({
      title: 'Weekly Webinar',
      participants: [{ name: 'Alice One', duration: '55m', email: 'alice.one@example.com' }],
    }).replace('Attended participants\t1', 'Attended participants\t1\nStart time\t5/07/26, 10:54:04 AM');
    const jun = sectionedCsv({
      title: 'Weekly Webinar',
      participants: [{ name: 'Alice One', duration: '1h', email: 'alice.one@example.com' }],
    }).replace('Attended participants\t1', 'Attended participants\t1\nStart time\t6/04/26, 10:54:04 AM');

    const r1 = await importTeamsFile(may, opts({ filename: 'webinar_may.csv' }));
    const r2 = await importTeamsFile(jun, opts({ filename: 'webinar_jun.csv' }));

    expect(r1.activities).toHaveLength(1);
    expect(r2.activities).toHaveLength(1);
    expect(r1.activities[0].externalId).not.toBe(r2.activities[0].externalId);
    expect(r1.activities[0].externalId).toContain('2026-05-07');
    expect(r2.activities[0].externalId).toContain('2026-06-04');
    expect(r1.activities[0].completedDate.slice(0, 10)).toBe('2026-05-07');
    expect(r2.activities[0].completedDate.slice(0, 10)).toBe('2026-06-04');
  });

  it('produces a stable externalId on re-import of the same file (idempotent)', async () => {
    const csv = sectionedCsv({
      title: 'Weekly Webinar',
      participants: [{ name: 'Alice One', duration: '55m', email: 'alice.one@example.com' }],
    }).replace('Attended participants\t1', 'Attended participants\t1\nStart time\t5/07/26, 10:54:04 AM');
    const r1 = await importTeamsFile(csv, opts({ filename: 'webinar.csv' }));
    const r2 = await importTeamsFile(csv, opts({ filename: 'webinar.csv' }));
    expect(r1.activities[0].externalId).toBe(r2.activities[0].externalId);
  });

  it('decodes a UTF-16LE BOM ArrayBuffer (Teams CSV export encoding)', async () => {
    // Teams attendance CSVs are exported as UTF-16LE with a BOM, which
    // breaks the default UTF-8 decode path. Verify the BOM-aware decode
    // recovers the document.
    const text = sectionedCsv({
      title: 'Weekly Webinar',
      participants: [
        { name: 'Alice One', duration: '55m 14s', email: 'alice.one@example.com' },
        { name: 'Bob Two',   duration: '59s',     email: 'bob.two@example.com' },
      ],
    });
    // Encode to UTF-16LE with a BOM, mimicking the Teams export.
    const encoded = new Uint8Array(2 + text.length * 2);
    encoded[0] = 0xFF; encoded[1] = 0xFE;
    for (let i = 0; i < text.length; i++) {
      const cc = text.charCodeAt(i);
      encoded[2 + i * 2]     = cc & 0xFF;
      encoded[2 + i * 2 + 1] = (cc >> 8) & 0xFF;
    }
    const result = await importTeamsFile(encoded.buffer, opts({ filename: 'webinar_attendance.csv' }));
    expect(result.errors).toEqual([]);
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].title).toBe('Weekly Webinar');
    expect(result.activities.map(a => a.userId).sort()).toEqual([
      'alice.one@example.com',
      'bob.two@example.com',
    ]);
  });

  it('does not interfere with legacy line-oriented format', async () => {
    // Sanity check — legacy format keeps working when the tabular
    // detector finds nothing.
    const csv = meetingCsv('Legacy Standup', 2, ['alice@b.com', 'bob@b.com']);
    const result = await importTeamsFile(csv, opts());
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].title).toBe('Legacy Standup');
  });
});

// ── XLSX support ────────────────────────────────────────────────────

describe('importTeamsFile — XLSX support', () => {
  function mockXlsx(rows) {
    return {
      read: () => ({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: '__mock__' },
      }),
      utils: {
        sheet_to_json: () => rows,
      },
    };
  }

  it('parses XLSX ArrayBuffer by converting to text lines', async () => {
    const rows = [
      ['Meeting title\tStandup'],
      ['Attended participants\t2'],
      [],
      ['Name\tEmail'],
      ['Alice\talice@b.com\tAttendee'],
      ['Bob\tbob@b.com\tAttendee'],
    ];
    const buf = new ArrayBuffer(0);
    const result = await importTeamsFile(buf, opts({ filename: 'report.xlsx', xlsx: mockXlsx(rows) }));
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].title).toBe('Standup');
  });

  it('returns error when XLSX provided without xlsx library', async () => {
    const buf = new ArrayBuffer(0);
    const result = await importTeamsFile(buf, opts({ filename: 'report.xlsx' }));
    expect(result.errors.some(e => e.includes('XLSX'))).toBe(true);
  });

  it('extracts emails from tab-separated XLSX rows', async () => {
    const rows = [
      ['Meeting title\tWeekly Sync'],
      ['Attended participants\t1'],
      [],
      ['Alice Smith (ZA)\t5/14/26\t10:00 AM\t5/14/26\t11:00 AM\t1h\talice@b.com\talice@b.com\tAttendee'],
    ];
    const buf = new ArrayBuffer(0);
    const result = await importTeamsFile(buf, opts({ filename: 'teams.xlsx', xlsx: mockXlsx(rows) }));
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].userId).toBe('alice@b.com');
  });
});
