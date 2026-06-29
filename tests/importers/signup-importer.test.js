// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseSignupFile } from '../../src/importers/signup-importer.js';

// ── Helpers ─────────────────────────────────────────────────────────

function csv(rows) {
  return rows.map(r => r.map(c => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

function xlsxBuffer(rows, sheetName = 'Sheet1') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// ── CSV path ────────────────────────────────────────────────────────

describe('parseSignupFile (CSV)', () => {
  it('extracts participants from a simple Email-only sheet', () => {
    const text = csv([
      ['Email'],
      ['Alice@example.com'],
      ['bob@example.com'],
    ]);
    const { participants, users, warnings, errors } = parseSignupFile(text, { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'alice' },
      { email: 'bob@example.com',   name: 'bob' },
    ]);
    expect(users.map(u => u.email)).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('uses a single "Name" column when present', () => {
    const text = csv([
      ['Name', 'Email'],
      ['Alice Smith', 'alice@example.com'],
      ['Bob Jones',   'bob@example.com'],
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'Alice Smith' },
      { email: 'bob@example.com',   name: 'Bob Jones' },
    ]);
  });

  it('combines First Name + Last Name when no single name column is present', () => {
    const text = csv([
      ['First Name', 'Last Name', 'Email'],
      ['Alice', 'Smith', 'alice@example.com'],
      ['Bob',   '',      'bob@example.com'],   // partial → still uses first
      ['',      'Jones', 'cara@example.com'],  // partial → still uses last
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'Alice Smith' },
      { email: 'bob@example.com',   name: 'Bob' },
      { email: 'cara@example.com',  name: 'Jones' },
    ]);
  });

  it('prefers single Name column over First/Last when both exist', () => {
    const text = csv([
      ['First Name', 'Last Name', 'Full Name', 'Email'],
      ['Alice', 'Smith', 'Dr. Alice Smith', 'alice@example.com'],
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants[0].name).toBe('Dr. Alice Smith');
  });

  it('falls back to the email local-part when no name columns yield a value', () => {
    const text = csv([
      ['First Name', 'Last Name', 'Email'],
      ['', '', 'charlie@example.com'],
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants[0].name).toBe('charlie');
  });

  it('scans up to 25 rows deep for the header', () => {
    const rows = [];
    for (let i = 0; i < 20; i++) rows.push([`Intro ${i}`]);
    rows.push(['Email']);
    rows.push(['alice@example.com']);
    const { participants, errors } = parseSignupFile(csv(rows), { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(participants).toEqual([{ email: 'alice@example.com', name: 'alice' }]);
  });

  it('finds the header row even when preceded by blank/intro rows', () => {
    const text = csv([
      ['Cloud Incubator Evolve'],
      [''],
      ['Email', 'Name'],
      ['alice@example.com', 'Alice Smith'],
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'Alice Smith' },
    ]);
  });

  it('lowercases emails and de-duplicates on the lowercased value', () => {
    const text = csv([
      ['Email', 'Name'],
      ['Alice@Example.com', 'Alice'],
      ['alice@example.com', 'Alice (later)'],   // duplicate → first wins
      ['bob@example.com',   'Bob'],
    ]);
    const { participants } = parseSignupFile(text, { filename: 'a.csv' });
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com',   name: 'Bob' },
    ]);
  });

  it('warns about invalid email values but does not abort', () => {
    const text = csv([
      ['Email'],
      ['not-an-email'],
      ['alice@example.com'],
    ]);
    const { participants, warnings, errors } = parseSignupFile(text, { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/not a valid email/);
    expect(participants).toEqual([{ email: 'alice@example.com', name: 'alice' }]);
  });

  it('skips rows whose Email cell is blank without warning', () => {
    const text = csv([
      ['Email', 'Name'],
      ['', 'No One'],
      ['alice@example.com', 'Alice'],
    ]);
    const { participants, warnings } = parseSignupFile(text, { filename: 'a.csv' });
    expect(warnings).toEqual([]);
    expect(participants).toEqual([{ email: 'alice@example.com', name: 'Alice' }]);
  });

  it('accepts alternate header spellings ("E-mail", "Email Address")', () => {
    expect(parseSignupFile(csv([['E-mail'], ['a@example.com']]), {}).participants[0].email).toBe('a@example.com');
    expect(parseSignupFile(csv([['Email Address'], ['b@example.com']]), {}).participants[0].email).toBe('b@example.com');
  });

  it('finds the email column when the header is descriptive (e.g. "Please enter your email")', () => {
    const text = csv([
      ['Full Name', 'Please enter your email address'],
      ['Alice Smith', 'alice@example.com'],
    ]);
    const { participants, errors } = parseSignupFile(text, { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(participants).toEqual([{ email: 'alice@example.com', name: 'Alice Smith' }]);
  });

  it('locates the header row even when buried behind 15+ intro rows', () => {
    const rows = [];
    for (let i = 0; i < 18; i++) rows.push([`Cloud Incubator Evolve — meta line ${i}`]);
    rows.push(['Email', 'Name']);
    rows.push(['alice@example.com', 'Alice']);
    const { participants, errors } = parseSignupFile(csv(rows), { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(participants).toEqual([{ email: 'alice@example.com', name: 'Alice' }]);
  });

  it('falls back to auto-detection when no header has an email-ish label', () => {
    // No "email" anywhere in headers, but column 2 clearly holds emails.
    const text = csv([
      ['ID', 'Person', 'Reachable At'],
      ['001', 'Alice', 'alice@example.com'],
      ['002', 'Bob',   'bob@example.com'],
    ]);
    const { participants, warnings, errors } = parseSignupFile(text, { filename: 'a.csv' });
    expect(errors).toEqual([]);
    expect(warnings.some(w => /auto-detected/.test(w))).toBe(true);
    expect(participants.map(p => p.email)).toEqual(['alice@example.com', 'bob@example.com']);
  });

  it('errors with a preview of the scanned rows when no email column can be located', () => {
    const text = csv([
      ['Name', 'Phone'],
      ['Alice', '+1 555'],
    ]);
    const { errors } = parseSignupFile(text, { filename: 'broken.csv' });
    expect(errors[0]).toMatch(/No Email column found in broken\.csv/);
    expect(errors[0]).toMatch(/row 1: \[Name \| Phone\]/);
  });
});

// ── XLSX path ───────────────────────────────────────────────────────

describe('parseSignupFile (XLSX)', () => {
  it('parses an XLSX ArrayBuffer when the SheetJS module is supplied', () => {
    const buf = xlsxBuffer([
      ['Email', 'Name'],
      ['alice@example.com', 'Alice'],
      ['bob@example.com',   'Bob'],
    ]);
    const { participants, errors } = parseSignupFile(buf, { filename: 'a.xlsx', xlsx: XLSX });
    expect(errors).toEqual([]);
    expect(participants).toEqual([
      { email: 'alice@example.com', name: 'Alice' },
      { email: 'bob@example.com',   name: 'Bob' },
    ]);
  });

  it('errors when given a binary input but no xlsx module', () => {
    const buf = xlsxBuffer([['Email'], ['a@example.com']]);
    const { participants, errors } = parseSignupFile(buf, { filename: 'a.xlsx' });
    expect(participants).toEqual([]);
    expect(errors[0]).toMatch(/no XLSX library/);
  });
});
