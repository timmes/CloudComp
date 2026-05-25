/**
 * @module views/activities
 *
 * Activity table rendering, sort, filter, bulk operations.
 */

import {
  getUsers, getUser, getActivities, getTeams,
  getUserWithPoints,
  bulkSelection, sortState, log, getCurrentMonth,
  formatNumber, formatDate, downloadJSON, autoSave, esc,
} from './shared.js';
import { updateBulkSelectionUI } from './users.js';
import { updateTeamPoints } from './teams.js';

let refreshDashboard, refreshUsersTable, refreshTeamsTable;
export function _setRefreshFns(fns) { ({ refreshDashboard, refreshUsersTable, refreshTeamsTable } = fns); }

function statusLabel(s) {
  const labels = { completed: 'Completed', in_progress: 'In Progress', enrolled: 'Enrolled' };
  return labels[s] || labels.completed;
}

function statusClass(s) {
  const classes = { completed: 'bg-green-100 text-green-800', in_progress: 'bg-yellow-100 text-yellow-800', enrolled: 'bg-gray-100 text-gray-800' };
  return classes[s] || classes.completed;
}

export function refreshActivitiesTable() {
  const tbody = document.getElementById('activitiesTableBody');
  let activities = [...getActivities()];

  if (activities.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="cc-empty-state" style="padding:3rem 1rem;"><div class="cc-empty-state-icon" style="width:4rem;height:4rem;margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:2rem;height:2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"/></svg></div><div class="cc-empty-state-title" style="font-size:1rem;">No activities yet</div><p class="cc-empty-state-text" style="font-size:0.8125rem;">Import learning data or add points manually to see activities here.</p></div></td></tr>`;
    return;
  }

  activities.sort((a, b) => {
    let av, bv;
    if (sortState.activities.field === 'pointsEarned') { av = a.pointsEarned; bv = b.pointsEarned; }
    else { av = new Date(a.completedDate); bv = new Date(b.completedDate); }
    return sortState.activities.ascending ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  tbody.innerHTML = activities.map(a => {
    const user = getUser(a.userEmail || a.userId);
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3"><input type="checkbox" class="activity-checkbox rounded" value="${esc(a.id)}" data-action="toggleActivitySelection" data-activity-id="${esc(a.id)}" data-trigger="change" ${bulkSelection.activities.has(a.id) ? 'checked' : ''}></td>
        <td class="px-4 py-3"><div class="font-medium text-gray-900">${esc(user?.name || a.userEmail || a.userId)}</div></td>
        <td class="px-4 py-3"><div class="font-medium text-gray-900">${esc(a.title)}</div></td>
        <td class="px-4 py-3"><span class="text-sm text-gray-600">${esc(a.courseType)}</span></td>
        <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${a.level==='fundamental'?'bg-green-100 text-green-800':a.level==='intermediate'?'bg-blue-100 text-blue-800':a.level==='advanced'?'bg-purple-100 text-purple-800':'bg-gray-100 text-gray-800'}">${esc(a.level)}</span></td>
        <td class="px-4 py-3"><span class="font-bold text-purple-600">${a.pointsEarned}</span></td>
        <td class="px-4 py-3"><span class="cc-pill ${statusClass(a.status)}">${esc(statusLabel(a.status))}</span></td>
        <td class="px-4 py-3"><span class="text-sm text-gray-500">${a.completedDate ? esc(formatDate(a.completedDate)) : '-'}</span></td>
        <td class="px-4 py-3"><span class="text-xs text-gray-500">${esc(a.source)}</span></td>
      </tr>`;
  }).join('');

  updateActivitySortButtons();
  updateBulkSelectionUI('activities');
}

export function toggleActivitySelection(id) {
  if (bulkSelection.activities.has(id)) bulkSelection.activities.delete(id); else bulkSelection.activities.add(id);
  updateBulkSelectionUI('activities');
}

export function toggleSelectAllActivities() {
  const cb = document.getElementById('selectAllActivitiesCheckbox');
  const cbs = document.querySelectorAll('.activity-checkbox');
  if (cb.checked) { cbs.forEach(c => { c.checked = true; bulkSelection.activities.add(c.value); }); }
  else { cbs.forEach(c => { c.checked = false; }); bulkSelection.activities.clear(); }
  updateBulkSelectionUI('activities');
}

export function selectAllActivities() {
  document.querySelectorAll('.activity-checkbox').forEach(c => { c.checked = true; bulkSelection.activities.add(c.value); });
  document.getElementById('selectAllActivitiesCheckbox').checked = true;
  updateBulkSelectionUI('activities');
}

export function deselectAllActivities() {
  document.querySelectorAll('.activity-checkbox').forEach(c => { c.checked = false; });
  bulkSelection.activities.clear();
  document.getElementById('selectAllActivitiesCheckbox').checked = false;
  updateBulkSelectionUI('activities');
}

export function bulkAdjustPoints() {
  if (bulkSelection.activities.size === 0) { alert('Please select activities first'); return; }
  document.getElementById('bulkAdjustActivityCount').textContent = bulkSelection.activities.size;
  document.getElementById('bulkAdjustPointsModal').classList.remove('hidden');
}

export function closeBulkAdjustPointsModal() {
  document.getElementById('bulkAdjustPointsModal').classList.add('hidden');
  document.getElementById('bulkAdjustType').value = 'add';
  document.getElementById('bulkAdjustValue').value = '';
  document.getElementById('bulkAdjustReason').value = '';
}

export function submitBulkAdjustPoints() {
  const adjustType = document.getElementById('bulkAdjustType').value;
  const value = parseFloat(document.getElementById('bulkAdjustValue').value);
  const reason = document.getElementById('bulkAdjustReason').value.trim();
  if (!value || isNaN(value)) { alert('Please enter a valid value'); return; }

  const activities = getActivities();
  let successCount = 0;
  const affectedUsers = new Set();

  bulkSelection.activities.forEach(activityId => {
    const activity = activities.find(a => a.id === activityId);
    if (activity) {
      const oldPoints = activity.pointsEarned;
      let newPoints = oldPoints;
      switch (adjustType) {
        case 'add': newPoints = oldPoints + value; break;
        case 'subtract': newPoints = Math.max(0, oldPoints - value); break;
        case 'multiply': newPoints = Math.round(oldPoints * value); break;
        case 'set': newPoints = value; break;
      }
      const pointDiff = newPoints - oldPoints;
      activity.pointsEarned = newPoints;
      activity.adjustmentHistory = activity.adjustmentHistory || [];
      activity.adjustmentHistory.push({ date: new Date().toISOString(), type: adjustType, value, oldPoints, newPoints, reason });

      affectedUsers.add(activity.userEmail || activity.userId);
      successCount++;
    }
  });

  affectedUsers.forEach(email => { const u = getUser(email); if (u?.teamId) updateTeamPoints(u.teamId); });
  closeBulkAdjustPointsModal(); deselectAllActivities();
  if (refreshDashboard) refreshDashboard(); refreshActivitiesTable();
  if (refreshUsersTable) refreshUsersTable(); if (refreshTeamsTable) refreshTeamsTable();
  autoSave();
  log(`Bulk adjusted points for ${successCount} activities (${adjustType} ${value})`);
  alert(`Successfully adjusted points for ${successCount} activities!`);
}

export function bulkDeleteActivities() {
  if (bulkSelection.activities.size === 0) { alert('Please select activities first'); return; }
  if (!confirm(`Are you sure you want to delete ${bulkSelection.activities.size} activities?`)) return;

  const activities = getActivities();
  const affectedUsers = new Set();
  let successCount = 0;

  bulkSelection.activities.forEach(activityId => {
    const idx = activities.findIndex(a => a.id === activityId);
    if (idx !== -1) {
      const activity = activities[idx];
      affectedUsers.add(activity.userEmail || activity.userId);
      activities.splice(idx, 1);
      successCount++;
    }
  });

  affectedUsers.forEach(email => { const u = getUser(email); if (u?.teamId) updateTeamPoints(u.teamId); });
  deselectAllActivities();
  if (refreshDashboard) refreshDashboard(); refreshActivitiesTable();
  if (refreshUsersTable) refreshUsersTable(); if (refreshTeamsTable) refreshTeamsTable();
  autoSave();
  log(`Bulk deleted ${successCount} activities`);
  alert(`Successfully deleted ${successCount} activities!`);
}

export function bulkExportActivities() {
  if (bulkSelection.activities.size === 0) { alert('Please select activities first'); return; }
  const activities = getActivities();
  const data = {
    title: 'Selected Activities Export', exportDate: new Date().toISOString(),
    activities: Array.from(bulkSelection.activities).map(id => {
      const a = activities.find(x => x.id === id);
      const u = getUser(a.userEmail || a.userId);
      return { user: u?.name || a.userEmail || a.userId, email: a.userEmail || a.userId, activity: a.title, courseType: a.courseType, level: a.level, points: a.pointsEarned, completedDate: a.completedDate, source: a.source, adjustmentHistory: a.adjustmentHistory };
    }),
  };
  downloadJSON(data, `selected_activities_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
  log(`Exported ${bulkSelection.activities.size} selected activities`);
}

export function toggleActivitySort(field) {
  if (sortState.activities.field === field) sortState.activities.ascending = !sortState.activities.ascending;
  else { sortState.activities.field = field; sortState.activities.ascending = false; }
  refreshActivitiesTable();
}

export function toggleActivitySortOrder() { sortState.activities.ascending = !sortState.activities.ascending; refreshActivitiesTable(); }

export function updateActivitySortButtons() {
  ['sortPoints', 'sortDate'].forEach(id => { document.getElementById(id).className = 'cc-sort-btn'; });
  const af = sortState.activities.field === 'pointsEarned' ? 'sortPoints' : 'sortDate';
  document.getElementById(af).className = 'cc-sort-btn active';
  const ob = document.getElementById('sortOrderActivity');
  ob.textContent = sortState.activities.field === 'pointsEarned' ? (sortState.activities.ascending ? 'Least First ⬆️' : 'Most First ⬇️') : (sortState.activities.ascending ? 'Oldest First ⬆️' : 'Recent First ⬇️');
}

export function filterActivities() {
  const s = document.getElementById('activitySearch').value.toLowerCase();
  const f = document.getElementById('activityFilter').value;
  const cm = getCurrentMonth();
  const activities = getActivities();
  document.querySelectorAll('#activitiesTableBody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    const aid = row.querySelector('button')?.onclick?.toString()?.match(/'([^']+)'/)?.[1];
    const a = aid ? activities.find(x => x.id === aid) : null;
    let show = text.includes(s);
    if (show && f !== 'all') {
      switch (f) {
        case 'current-month': show = a?.monthYear === cm; break;
        case 'courses': show = !a?.courseType?.includes('Meeting'); break;
        case 'events': show = a?.courseType?.includes('Meeting') || a?.level === 'live_event'; break;
      }
    }
    row.style.display = show ? '' : 'none';
  });
}
