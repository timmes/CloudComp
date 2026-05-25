/**
 * @module views/import
 *
 * File import orchestration: course files + Teams meeting CSVs.
 */

import {
  getUsers, getUser, getActivities, getConfig,
  getUsersWithPoints,
  upsertUser, addActivity, replaceActivity,
  selectedFiles, log, getCurrentMonth,
  formatNumber, autoSave,
  importCourseFile, importTeamsFile, deduplicateBatch, esc,
} from './shared.js';

let refreshDashboard;
export function _setRefreshFns(fns) { ({ refreshDashboard } = fns); }

export function updateFileList(type, files) {
  const el = document.getElementById(type + 'FileList');
  if (files.length === 0) { el.innerHTML = ''; return; }
  if (files.length === 1) {
    el.innerHTML = `<div class="text-xs"><strong>1 file selected:</strong><br>${esc(files[0].name)}</div>`;
  } else {
    const list = Array.from(files).map((f, i) => `${i + 1}. ${esc(f.name)}`).join('<br>');
    el.innerHTML = `<div class="text-xs"><strong>${files.length} files selected:</strong><br>${list}</div>`;
  }
  document.getElementById('processBtn').disabled = !(selectedFiles.course.length > 0 || selectedFiles.teams.length > 0);
}

export async function processAllFiles() {
  if (!selectedFiles.course.length && !selectedFiles.teams.length) { alert('Please select files to process'); return; }

  log('Starting multi-file processing...');
  document.getElementById('importResults').classList.remove('hidden');
  setImportSpinner(true);

  let totalProcessed = 0, totalActivities = 0;

  try {
    for (const file of selectedFiles.course) {
      const r = await processCourseFile(file);
      totalProcessed += r.processed; totalActivities += r.activities;
    }
    for (const file of selectedFiles.teams) {
      const r = await processTeamsFile(file);
      totalProcessed += r.processed; totalActivities += r.activities;
    }

    log(`Multi-file processing complete! ${totalActivities} activities from ${totalProcessed} records`);
    updateImportStats(totalProcessed, totalActivities, 0);
    if (refreshDashboard) refreshDashboard();
    autoSave();

    selectedFiles.course = []; selectedFiles.teams = [];
    updateFileList('course', []); updateFileList('teams', []);
    document.getElementById('processBtn').disabled = true;
  } finally {
    setImportSpinner(false);
  }
}

function setImportSpinner(active) {
  const el = document.getElementById('importSpinner');
  if (!el) return;
  el.classList.toggle('hidden', !active);
}

async function processCourseFile(file) {
  log(`Processing course file: ${file.name}`);
  try {
    const buffer = await file.arrayBuffer();
    const result = await importCourseFile(buffer, window.XLSX, { config: getConfig().pointConfig, filename: file.name });
    result.warnings.forEach(w => log(`${file.name}: ${w}`));
    result.errors.forEach(e => log(`${file.name}: ${e}`));
    if (result.errors.length > 0) return { processed: 0, activities: 0 };
    commitImportResult(result);
    log(`${file.name}: ${result.activities.length} activities, ${result.users.length} users`);
    return { processed: result.activities.length + result.warnings.length, activities: result.activities.length };
  } catch (error) { log(`Error processing ${file.name}: ${error.message}`); return { processed: 0, activities: 0 }; }
}

async function processTeamsFile(file) {
  log(`Processing Teams file: ${file.name}`);
  try {
    const text = await file.text();
    const result = await importTeamsFile(text, { config: getConfig().pointConfig, filename: file.name });
    result.warnings.forEach(w => log(`${file.name}: ${w}`));
    result.errors.forEach(e => log(`${file.name}: ${e}`));
    if (result.errors.length > 0) return { processed: 0, activities: 0 };
    commitImportResult(result);
    log(`${file.name}: ${result.activities.length} meeting attendance activities`);
    return { processed: result.activities.length + result.warnings.length, activities: result.activities.length };
  } catch (error) { log(`Error processing Teams file ${file.name}: ${error.message}`); return { processed: 0, activities: 0 }; }
}

function commitImportResult(result) {
  const { accepted, upgrades, stats } = deduplicateBatch(result.activities, getActivities());

  for (const activity of accepted) addActivity(activity);
  for (const activity of upgrades) replaceActivity(activity);

  for (const user of result.users) {
    if (!getUser(user.email)) upsertUser(user);
  }

  const parts = [`${stats.accepted} accepted`];
  if (stats.upgraded > 0) parts.push(`${stats.upgraded} upgraded`);
  if (stats.duplicatesSkipped > 0) parts.push(`${stats.duplicatesSkipped} duplicates skipped`);
  log(`Dedup: ${parts.join(', ')}`);
}

function updateImportStats(totalProcessed, totalActivities, totalInProgress) {
  const users = getUsersWithPoints();
  document.getElementById('importStats').innerHTML = `
    <div class="cc-metric"><div class="cc-metric-label">Processed</div><div class="cc-metric-value">${formatNumber(totalProcessed)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Completed</div><div class="cc-metric-value">${formatNumber(totalActivities)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">In Progress</div><div class="cc-metric-value">${formatNumber(totalInProgress)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Total Users</div><div class="cc-metric-value">${formatNumber(Object.keys(users).length)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Points Awarded</div><div class="cc-metric-value">${formatNumber(Object.values(users).reduce((s, u) => s + (u.totalPoints || 0), 0))}</div></div>
  `;
}
