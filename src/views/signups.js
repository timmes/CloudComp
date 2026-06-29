/**
 * @module views/signups
 *
 * Program sign-up import flow: pick an XLSX/CSV with at least an
 * Email column, prompt for a campaign name, then bulk-upsert the
 * users and create an active campaign with them as participants.
 */

import {
  getUsers, upsertUsers, upsertCampaign,
  addImportHistoryEntry,
  log, esc, autoSave,
} from './shared.js';
import { parseSignupFile } from '../importers/signup-importer.js';
import { createCampaign } from '../models/campaign.js';

// ── Pending parse result (between file pick and modal confirm) ──────

let _pending = null;

let refreshDashboard, refreshHistoryTables, refreshCampaignsTable, refreshUsersTable;
export function _setRefreshFns(fns) {
  ({ refreshDashboard, refreshHistoryTables, refreshCampaignsTable, refreshUsersTable } = fns);
}

// ── Public API ──────────────────────────────────────────────────────

/** Programmatically open the hidden file input. */
export function clickSignupFile() {
  document.getElementById('signupFile').click();
}

/**
 * Called when the user picks a file in the hidden input. Parses it,
 * reports warnings to the log, and (if any participants were found)
 * opens the campaign-name modal.
 *
 * @param {File} file
 */
export async function signupFileChosen(file) {
  if (!file) return;

  document.getElementById('importResults').classList.remove('hidden');
  log(`Parsing sign-up file: ${file.name}`);

  let result;
  try {
    // Always read as ArrayBuffer — the importer decides XLSX vs. CSV
    // by filename and decodes CSV honouring its BOM (UTF-16 sign-up
    // sheets are common in the wild).
    const buffer = await file.arrayBuffer();
    const isXlsx = /\.xlsx$/i.test(file.name);
    result = parseSignupFile(buffer, {
      filename: file.name,
      xlsx: isXlsx ? window.XLSX : undefined,
    });
  } catch (err) {
    log(`Failed to read ${file.name}: ${err.message}`);
    return;
  }

  result.warnings.forEach(w => log(`${file.name}: ${w}`));
  result.errors.forEach(e => log(`${file.name}: ${e}`));

  if (result.errors.length > 0 || result.participants.length === 0) {
    document.getElementById('signupFileList').textContent = '';
    document.getElementById('signupFile').value = '';
    return;
  }

  _pending = { filename: file.name, result };

  document.getElementById('signupFileList').innerHTML =
    `<strong>${esc(file.name)}</strong> — ${result.participants.length} participants ready`;
  document.getElementById('signupFilename').textContent = file.name;
  document.getElementById('signupParticipantCount').textContent = result.participants.length;
  document.getElementById('signupCampaignName').value = suggestCampaignName(file.name);
  document.getElementById('signupCampaignModal').classList.remove('hidden');
  document.getElementById('signupCampaignName').focus();
}

export function closeSignupCampaignModal() {
  document.getElementById('signupCampaignModal').classList.add('hidden');
  document.getElementById('signupCampaignName').value = '';
  document.getElementById('signupFile').value = '';
  document.getElementById('signupFileList').textContent = '';
  _pending = null;
}

export function submitSignupImport() {
  if (!_pending) { closeSignupCampaignModal(); return; }

  const name = document.getElementById('signupCampaignName').value.trim();
  if (!name) { alert('Please enter a campaign name'); return; }

  const { filename, result } = _pending;
  const { participants, users } = result;

  // Upsert users (existing users keep their name; new users get the
  // imported name or the email local-part as fallback).
  const existing = getUsers();
  const newUsers = users.filter(u => !existing[u.email]);
  upsertUsers(newUsers);

  const campaign = createCampaign({
    name,
    description: `Imported from ${filename}`,
    startDate: new Date().toISOString(),
    endDate: null,
    status: 'active',
    color: 'blue',
    participantIds: participants.map(p => p.email),
  });
  upsertCampaign(campaign);

  addImportHistoryEntry({
    filename,
    date: new Date().toISOString(),
    type: 'signup',
    stats: {
      accepted: participants.length,
      users: newUsers.length,
      campaignId: campaign.id,
      campaignName: name,
      warnings: result.warnings.length,
      errors: result.errors.length,
    },
  });

  log(`Sign-up import: created campaign "${name}" with ${participants.length} participants (${newUsers.length} new users)`);

  closeSignupCampaignModal();
  autoSave();
  if (refreshUsersTable) refreshUsersTable();
  if (refreshCampaignsTable) refreshCampaignsTable();
  if (refreshHistoryTables) refreshHistoryTables();
  if (refreshDashboard) refreshDashboard();

  alert(`Campaign "${name}" created with ${participants.length} participants.`);
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Derive a reasonable default campaign name from a filename:
 *   "Cloud Incubator Evolve Sign Up.xlsx" → "Cloud Incubator Evolve"
 *
 * @param {string} filename
 * @returns {string}
 */
function suggestCampaignName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')                    // strip extension
    .replace(/[-_]+/g, ' ')                     // dashes/underscores → spaces
    .replace(/\bsign[\s-]*up\b/gi, '')          // drop "sign up" / "sign-up"
    .replace(/\bsignups?\b/gi, '')              // and "signups"
    .replace(/\bparticipants?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
