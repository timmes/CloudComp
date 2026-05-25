/**
 * @module views/config
 *
 * Point configuration UI: load, save, reset all data.
 */

import {
  getConfig, updateConfig, importJSON, log, autoSave,
  calculateActivityPoints,
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
