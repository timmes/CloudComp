/**
 * @module views/config
 *
 * Point configuration UI: load, save, reset all data.
 */

import {
  getConfig, updateConfig, importJSON, log, autoSave,
  calculateActivityPoints,
  getImportHistory, getExportHistory,
  formatNumber, esc,
} from './shared.js';

// ── Field mappings (element ID -> config key) ──────────────────────

const FIELD_MAP = {
  selfPacedDigital: {
    cfgSkillBuilderCourse: 'Skill Builder Course',
    cfgSkillBuilderPlan:   'Skill Builder Learning Plan',
    cfgCloudQuestRole:     'Cloud Quest Role',
    cfgEscapeRoom:         'Escape Room Challenge',
    cfgFoundationalPkg:    'Foundational Training Pkg',
    cfgQuizCompletion:     'Quiz Completion',
  },
  liveLearning: {
    cfgLiveWebinar:        'Live Webinar',
    cfgWorkshopFirst:      'Workshop First Hour',
    cfgWorkshopFull:       'Workshop Full + Hands-on',
    cfgOfficeHours:        'Office Hours Session',
    cfgOfficeHoursQ:       'Office Hours Q Submitted',
    cfgHandsOnChallenge:   'Hands-on Challenge',
  },
  certifications: {
    cfgCloudPractitioner:  'Cloud Practitioner',
    cfgAIPractitioner:     'AI Practitioner',
    cfgAssociateCert:      'Associate Cert',
    cfgProSpecCert:        'Professional/Specialty Cert',
    cfgJamChallenge:       'AWS Jam Challenge',
  },
  gamifiedEvents: {
    cfgParticipateEvent:   'Participate Event',
    cfgTop3Bonus:          'Top 3 Bonus',
    cfgParticipateHack:    'Participate Hackathon',
    cfgHackPrototype:      'Hackathon Prototype Bonus',
  },
  communityEngagement: {
    cfgJoinChannel:        'Join Channel',
    cfgFirstQuestion:      'First Question',
    cfgShareResource:      'Share Resource',
    cfgChampionKnowledge:  'Champion Knowledge-sharing',
    cfgSurveyFeedback:     'Survey Feedback',
  },
};

// ── Helpers ────────────────────────────────────────────────────────

function readSection(idMap) {
  const result = {};
  for (const [id, key] of Object.entries(idMap)) {
    result[key] = parseInt(document.getElementById(id)?.value) || 0;
  }
  return result;
}

function writeSection(section, idMap) {
  for (const [id, key] of Object.entries(idMap)) {
    const el = document.getElementById(id);
    if (el) el.value = section?.[key] ?? 0;
  }
}

// ── Public API ─────────────────────────────────────────────────────

export function updatePointConfig() {
  const cfg = getConfig();
  const pc = {};
  for (const [section, idMap] of Object.entries(FIELD_MAP)) {
    pc[section] = readSection(idMap);
  }
  updateConfig({ ...cfg, pointConfig: pc });
  log('Point configuration updated');
}

export function loadConfiguration() {
  const pc = getConfig().pointConfig;
  for (const [section, idMap] of Object.entries(FIELD_MAP)) {
    writeSection(pc[section], idMap);
  }
  refreshHistoryTables();
}

export function saveConfiguration() {
  updatePointConfig();
  const status = document.getElementById('configStatus');
  status.textContent = 'Configuration saved!';
  setTimeout(() => { status.textContent = ''; }, 3000);
}

// ── Reset all data ─────────────────────────────────────────────────

export function openResetDataModal() {
  document.getElementById('resetDataConfirmInput').value = '';
  document.getElementById('resetDataModal').classList.remove('hidden');
}

export function closeResetDataModal() {
  document.getElementById('resetDataModal').classList.add('hidden');
}

export function confirmResetAllData() {
  const input = document.getElementById('resetDataConfirmInput').value.trim();
  if (input !== 'confirm deletion') {
    alert('Please type "confirm deletion" to proceed.');
    return;
  }
  importJSON({ users: {}, teams: {}, activities: [], campaigns: {}, config: null, metadata: null });
  closeResetDataModal();
  loadConfiguration();
  log('All data has been reset');
  alert('All data has been deleted.');
}

export function calculatePoints(category, subCategory) {
  const pc = getConfig().pointConfig;
  return calculateActivityPoints(category, subCategory, pc);
}

// ── History rendering ──────────────────────────────────────────────

const IMPORT_TYPE_LABEL = {
  course: 'Course file',
  teams: 'Teams CSV',
  'data-restore': 'Data restore',
};

/**
 * Render the two history tables in the Configuration tab. Safe to call
 * even when the tab isn't mounted yet (no-ops if the tbodies are absent).
 */
export function refreshHistoryTables() {
  renderImportsTable();
  renderExportsTable();
}

function renderImportsTable() {
  const tbody = document.getElementById('historyImportsBody');
  if (!tbody) return;
  const rows = getImportHistory();
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-sm" style="color:var(--cc-text-muted);">No imports yet</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const s = r.stats || {};
    const parts = r.type === 'data-restore'
      ? buildRestoreStats(s)
      : buildFileImportStats(s);
    return `
      <tr>
        <td><span class="text-sm text-gray-900" style="word-break:break-all;">${esc(r.filename || '—')}</span></td>
        <td><span class="cc-pill bg-gray-100 text-gray-700">${esc(IMPORT_TYPE_LABEL[r.type] || r.type || 'import')}</span></td>
        <td><span class="text-sm text-gray-500">${esc(formatDateTime(r.date))}</span></td>
        <td><span class="text-sm text-gray-600">${parts.length ? esc(parts.join(', ')) : '—'}</span></td>
      </tr>`;
  }).join('');
}

function renderExportsTable() {
  const tbody = document.getElementById('historyExportsBody');
  if (!tbody) return;
  const rows = getExportHistory();
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-sm" style="color:var(--cc-text-muted);">No exports yet</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const s = r.stats || {};
    const parts = [];
    if (s.users != null) parts.push(`${formatNumber(s.users)} users`);
    if (s.teams != null) parts.push(`${formatNumber(s.teams)} teams`);
    if (s.activities != null) parts.push(`${formatNumber(s.activities)} activities`);
    if (s.campaigns != null) parts.push(`${formatNumber(s.campaigns)} campaigns`);
    if (s.sizeBytes != null) parts.push(`${formatBytes(s.sizeBytes)}`);
    return `
      <tr>
        <td><span class="text-sm text-gray-900" style="word-break:break-all;">${esc(r.filename || '—')}</span></td>
        <td><span class="text-sm text-gray-500">${esc(formatDateTime(r.date))}</span></td>
        <td><span class="text-sm text-gray-600">${parts.length ? esc(parts.join(', ')) : '—'}</span></td>
      </tr>`;
  }).join('');
}

function buildFileImportStats(s) {
  const parts = [];
  if (s.accepted) parts.push(`${formatNumber(s.accepted)} accepted`);
  if (s.upgraded) parts.push(`${formatNumber(s.upgraded)} upgraded`);
  if (s.duplicatesSkipped) parts.push(`${formatNumber(s.duplicatesSkipped)} duplicates`);
  if (s.warnings) parts.push(`${formatNumber(s.warnings)} warnings`);
  if (s.errors) parts.push(`${formatNumber(s.errors)} errors`);
  return parts;
}

function buildRestoreStats(s) {
  const parts = [];
  if (s.users != null) parts.push(`${formatNumber(s.users)} users`);
  if (s.teams != null) parts.push(`${formatNumber(s.teams)} teams`);
  if (s.activities != null) parts.push(`${formatNumber(s.activities)} activities`);
  if (s.campaigns != null) parts.push(`${formatNumber(s.campaigns)} campaigns`);
  return parts;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  // Pre-2000 dates have come up as bogus elsewhere; consistent treatment.
  if (d.getFullYear() < 2000) return '—';
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
