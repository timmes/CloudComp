/**
 * @module views/import
 *
 * File import orchestration: course files + Teams meeting CSVs.
 */

import {
  getUsers, getUser, getActivities, getConfig,
  getUsersWithPoints,
  upsertUser, addActivity,
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

  let totalProcessed = 0, totalActivities = 0;

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
  const { accepted } = deduplicateBatch(result.activities, getActivities());

  for (const activity of accepted) addActivity(activity);

  for (const user of result.users) {
    if (!getUser(user.email)) upsertUser(user);
  }

  if (accepted.length > 0) log(`Dedup: ${accepted.length} accepted, ${result.activities.length - accepted.length} duplicates skipped`);
}

function updateImportStats(totalProcessed, totalActivities, totalInProgress) {
  const users = getUsersWithPoints();
  document.getElementById('importStats').innerHTML = `
    <div class="bg-blue-50 p-4 rounded-lg text-center"><div class="text-2xl font-bold text-blue-600">${formatNumber(totalProcessed)}</div><div class="text-sm text-blue-800">Records Processed</div></div>
    <div class="bg-green-50 p-4 rounded-lg text-center"><div class="text-2xl font-bold text-green-600">${formatNumber(totalActivities)}</div><div class="text-sm text-green-800">Completed Activities</div></div>
    <div class="bg-orange-50 p-4 rounded-lg text-center"><div class="text-2xl font-bold text-orange-600">${formatNumber(totalInProgress)}</div><div class="text-sm text-orange-800">In Progress</div></div>
    <div class="bg-purple-50 p-4 rounded-lg text-center"><div class="text-2xl font-bold text-purple-600">${formatNumber(Object.keys(users).length)}</div><div class="text-sm text-purple-800">Total Users</div></div>
    <div class="bg-indigo-50 p-4 rounded-lg text-center"><div class="text-2xl font-bold text-indigo-600">${formatNumber(Object.values(users).reduce((s, u) => s + (u.totalPoints || 0), 0))}</div><div class="text-sm text-indigo-800">Points Awarded</div></div>
  `;
}
