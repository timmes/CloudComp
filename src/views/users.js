/**
 * @module views/users
 *
 * User table rendering, sort, filter, bulk operations, manual points.
 */

import {
  getUsers, getUser, getTeams, getActivities, getConfig,
  getUsersWithPoints, getUserWithPoints, getUserTotalPoints, getUserMonthPoints,
  upsertUser, upsertTeam, addActivity,
  bulkSelection, sortState, log, getCurrentMonth,
  formatNumber, formatDate, downloadJSON, autoSave, esc,
} from './shared.js';
import { updateTeamPoints } from './teams.js';

let refreshDashboard, refreshActivitiesTable, refreshTeamsTable;
export function _setRefreshFns(fns) { ({ refreshDashboard, refreshActivitiesTable, refreshTeamsTable } = fns); }

// ── Table rendering ─────────────────────────────────────────────────

export function refreshUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  let users = Object.values(getUsersWithPoints());

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="cc-empty-state" style="padding:3rem 1rem;"><div class="cc-empty-state-icon" style="width:4rem;height:4rem;margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:2rem;height:2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/></svg></div><div class="cc-empty-state-title" style="font-size:1rem;">No users yet</div><p class="cc-empty-state-text" style="font-size:0.8125rem;">Import learning data to populate users automatically.</p></div></td></tr>`;
    return;
  }

  users.sort((a, b) => {
    let av = a[sortState.users.field], bv = b[sortState.users.field];
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    return sortState.users.ascending ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  tbody.innerHTML = users.map(user => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3">
        <input type="checkbox" class="user-checkbox rounded" value="${esc(user.email)}"
               data-action="toggleUserSelection" data-email="${esc(user.email)}" data-trigger="change"
               ${bulkSelection.users.has(user.email) ? 'checked' : ''}>
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-900">${esc(user.name)}</div>
        <div class="text-sm text-gray-500">${esc(user.email)}</div>
      </td>
      <td class="px-4 py-3"><span class="font-bold text-purple-600">${formatNumber(user.currentMonthPoints)}</span></td>
      <td class="px-4 py-3"><span class="font-medium text-gray-900">${formatNumber(user.totalPoints)}</span></td>
      <td class="px-4 py-3"><span class="text-gray-600">${user.activities?.length || 0}</span></td>
      <td class="px-4 py-3"><span class="text-sm text-gray-500">${esc(formatDate(user.lastActivity))}</span></td>
    </tr>
  `).join('');

  updateUserSortButtons();
  updateBulkSelectionUI('users');
}

// ── Bulk selection ──────────────────────────────────────────────────

export function toggleUserSelection(email) {
  if (bulkSelection.users.has(email)) bulkSelection.users.delete(email); else bulkSelection.users.add(email);
  updateBulkSelectionUI('users');
}

export function toggleSelectAllUsers() {
  const cb = document.getElementById('selectAllUsersCheckbox');
  const cbs = document.querySelectorAll('.user-checkbox');
  if (cb.checked) { cbs.forEach(c => { c.checked = true; bulkSelection.users.add(c.value); }); }
  else { cbs.forEach(c => { c.checked = false; }); bulkSelection.users.clear(); }
  updateBulkSelectionUI('users');
}

export function selectAllUsers() {
  document.querySelectorAll('.user-checkbox').forEach(c => { c.checked = true; bulkSelection.users.add(c.value); });
  document.getElementById('selectAllUsersCheckbox').checked = true;
  updateBulkSelectionUI('users');
}

export function deselectAllUsers() {
  document.querySelectorAll('.user-checkbox').forEach(c => { c.checked = false; });
  bulkSelection.users.clear();
  document.getElementById('selectAllUsersCheckbox').checked = false;
  updateBulkSelectionUI('users');
}

export function updateBulkSelectionUI(type) {
  if (type === 'users') {
    const n = bulkSelection.users.size;
    document.getElementById('selectedUsersCount').textContent = n;
    n > 0 ? document.getElementById('userBulkActions').classList.remove('hidden') : document.getElementById('userBulkActions').classList.add('hidden');
  } else if (type === 'activities') {
    const n = bulkSelection.activities.size;
    document.getElementById('selectedActivitiesCount').textContent = n;
    n > 0 ? document.getElementById('activityBulkActions').classList.remove('hidden') : document.getElementById('activityBulkActions').classList.add('hidden');
  }
}

// ── Bulk operations ─────────────────────────────────────────────────

export function bulkAwardPoints() {
  if (bulkSelection.users.size === 0) { alert('Please select users first'); return; }
  document.getElementById('bulkAwardUserCount').textContent = bulkSelection.users.size;
  populateActivityTypePicker('bulkActivityType');
  document.getElementById('bulkAwardPointsModal').classList.remove('hidden');
}

export function closeBulkAwardPointsModal() {
  document.getElementById('bulkAwardPointsModal').classList.add('hidden');
  const picker = document.getElementById('bulkActivityType');
  if (picker) picker.value = '';
  document.getElementById('bulkActivityTitle').value = '';
  document.getElementById('bulkPoints').value = '';
  document.getElementById('bulkDescription').value = '';
}

export function submitBulkAwardPoints() {
  const title = document.getElementById('bulkActivityTitle').value.trim();
  const points = parseInt(document.getElementById('bulkPoints').value);
  const description = document.getElementById('bulkDescription').value.trim();
  if (!title || !points) { alert('Please fill in all required fields'); return; }

  const { category, subCategory } = readPickerSelection('bulkActivityType');
  const courseType = subCategory || 'Bulk Award';

  let successCount = 0;
  bulkSelection.users.forEach(email => {
    addActivity({ id: `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userEmail: email, userId: email, courseId: `bulk_${Date.now()}`, title, level: 'manual', category, subCategory, courseType, pointsEarned: points, completedDate: new Date().toISOString(), score: null, source: 'bulk_award', importDate: new Date().toISOString(), monthYear: getCurrentMonth(), description });
    const user = getUser(email);
    if (user) {
      upsertUser({ ...user, lastActivity: new Date().toISOString() });
      successCount++;
    }
  });

  closeBulkAwardPointsModal(); deselectAllUsers();
  if (refreshDashboard) refreshDashboard(); refreshUsersTable();
  if (refreshActivitiesTable) refreshActivitiesTable();
  autoSave();
  log(`Bulk awarded ${points} points to ${successCount} users for "${title}"`);
  alert(`Successfully awarded ${points} points to ${successCount} users!`);
}

export function bulkAssignTeam() {
  if (bulkSelection.users.size === 0) { alert('Please select users first'); return; }
  const select = document.getElementById('bulkTeamSelect');
  select.innerHTML = '<option value="">Choose a team...</option>';
  Object.values(getTeams()).forEach(team => { select.innerHTML += `<option value="${esc(team.id)}">${esc(team.name)}</option>`; });
  document.getElementById('bulkAssignUserCount').textContent = bulkSelection.users.size;
  document.getElementById('bulkAssignTeamModal').classList.remove('hidden');
}

export function closeBulkAssignTeamModal() { document.getElementById('bulkAssignTeamModal').classList.add('hidden'); document.getElementById('bulkTeamSelect').value = ''; }

export function submitBulkAssignTeam() {
  const teamId = document.getElementById('bulkTeamSelect').value;
  if (!teamId) { alert('Please select a team'); return; }
  const teams = getTeams();
  const team = teams[teamId];
  if (!team) return;

  let successCount = 0;
  const members = [...(team.members || [])];

  bulkSelection.users.forEach(email => {
    if (!members.includes(email)) {
      members.push(email);
      const user = getUser(email);
      if (user) {
        if (user.teamId && teams[user.teamId]) {
          const oldTeam = teams[user.teamId];
          upsertTeam({ ...oldTeam, members: (oldTeam.members || []).filter(e => e !== email) });
        }
        upsertUser({ ...user, teamId });
        successCount++;
      }
    }
  });

  upsertTeam({ ...team, members });
  updateTeamPoints(teamId);
  closeBulkAssignTeamModal(); deselectAllUsers();
  refreshUsersTable();
  if (refreshTeamsTable) refreshTeamsTable();
  if (refreshDashboard) refreshDashboard();
  autoSave();
  log(`Bulk assigned ${successCount} users to team ${team.name}`);
  alert(`Successfully assigned ${successCount} users to team ${team.name}!`);
}

export function bulkExportUsers() {
  if (bulkSelection.users.size === 0) { alert('Please select users first'); return; }
  const data = {
    title: 'Selected Users Export', exportDate: new Date().toISOString(),
    users: Array.from(bulkSelection.users).map(email => {
      const user = getUserWithPoints(email);
      return { email: user.email, name: user.name, currentMonthPoints: user.currentMonthPoints, totalPoints: user.totalPoints, activities: user.activities?.length || 0, teamId: user.teamId, lastActivity: user.lastActivity };
    }),
  };
  downloadJSON(data, `selected_users_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`);
  log(`Exported ${bulkSelection.users.size} selected users`);
}

// ── Sort / filter ───────────────────────────────────────────────────

export function toggleUserSort(field) {
  if (sortState.users.field === field) sortState.users.ascending = !sortState.users.ascending;
  else { sortState.users.field = field; sortState.users.ascending = false; }
  refreshUsersTable();
}

export function toggleUserSortOrder() { sortState.users.ascending = !sortState.users.ascending; refreshUsersTable(); }

export function updateUserSortButtons() {
  ['sortCurrentMonth', 'sortTotal'].forEach(id => {
    document.getElementById(id).className = 'cc-sort-btn';
  });
  const af = sortState.users.field === 'currentMonthPoints' ? 'sortCurrentMonth' : 'sortTotal';
  document.getElementById(af).className = 'cc-sort-btn active';
  document.getElementById('sortOrderUser').textContent = sortState.users.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
}

export function filterUsers() {
  const s = document.getElementById('userSearch').value.toLowerCase();
  document.querySelectorAll('#usersTableBody tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(s) ? '' : 'none'; });
}

// ── Manual points + stubs ───────────────────────────────────────────

export function addManualPoints() {
  populateActivityTypePicker('manualActivityType');
  document.getElementById('addPointsModal').classList.remove('hidden');
  document.getElementById('manualUserResults').style.display = 'none';
}

export function closeAddPointsModal() {
  document.getElementById('addPointsModal').classList.add('hidden');
  document.getElementById('manualUserSearch').value = '';
  document.getElementById('manualUserEmail').value = '';
  document.getElementById('manualUserResults').style.display = 'none';
  const picker = document.getElementById('manualActivityType');
  if (picker) picker.value = '';
  document.getElementById('manualActivityTitle').value = '';
  document.getElementById('manualPoints').value = '';
  document.getElementById('manualDescription').value = '';
}

export function filterManualPointsUsers() {
  const query = (document.getElementById('manualUserSearch')?.value || '').toLowerCase();
  const container = document.getElementById('manualUserResults');
  if (!query || query.length < 1) { container.style.display = 'none'; return; }

  const matches = Object.values(getUsers())
    .filter(u => u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query))
    .slice(0, 6);

  if (matches.length === 0) {
    container.innerHTML = `<div class="px-3 py-2 text-sm" style="color:var(--cc-text-muted);">No users found. Email will be used as-is.</div>`;
  } else {
    container.innerHTML = matches.map(u => `
      <div data-action="selectManualPointsUser" data-email="${esc(u.email)}" data-name="${esc(u.name)}"
           class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50" style="color:var(--cc-text);">
        <div class="font-medium">${esc(u.name)}</div>
        <div class="text-xs" style="color:var(--cc-text-muted);">${esc(u.email)}</div>
      </div>`).join('');
  }
  container.style.display = '';
}

export function selectManualPointsUser(email, name) {
  document.getElementById('manualUserEmail').value = email;
  document.getElementById('manualUserSearch').value = `${name} (${email})`;
  document.getElementById('manualUserResults').style.display = 'none';
}

export function submitManualPoints() {
  const hidden = document.getElementById('manualUserEmail').value.trim().toLowerCase();
  const search = document.getElementById('manualUserSearch').value.trim().toLowerCase();
  const email = hidden || (search.includes('@') ? search : '');
  const title = document.getElementById('manualActivityTitle').value.trim();
  const points = parseInt(document.getElementById('manualPoints').value);
  const description = document.getElementById('manualDescription').value.trim();
  if (!email || !title || !points) { alert('Please fill in all required fields'); return; }

  const { category, subCategory } = readPickerSelection('manualActivityType');
  const courseType = subCategory || 'Manual Award';

  addActivity({ id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, userEmail: email, userId: email, courseId: `manual_${Date.now()}`, title, level: 'manual', category, subCategory, courseType, pointsEarned: points, completedDate: new Date().toISOString(), score: null, source: 'manual_entry', importDate: new Date().toISOString(), monthYear: getCurrentMonth(), description });

  let user = getUser(email);
  if (!user) {
    upsertUser({ email, name: email.split('@')[0], activities: [], joinDate: new Date().toISOString(), lastActivity: new Date().toISOString() });
    user = getUser(email);
  }
  upsertUser({ ...user, lastActivity: new Date().toISOString() });

  closeAddPointsModal();
  if (refreshDashboard) refreshDashboard(); refreshUsersTable();
  if (refreshActivitiesTable) refreshActivitiesTable();
  autoSave();
  log(`Manual points awarded: ${points} to ${email} for "${title}"`);
}

// ── Activity Type picker (shared by single + bulk manual flows) ─────
//
// The picker mirrors the activity types defined on the Configuration
// tab so manually-entered activities can be tagged with the same
// category/sub-category as imported ones. Options are rebuilt on every
// modal open so any edits to point values show up immediately.

const PICKER_SECTION_LABEL = {
  selfPacedDigital:    'Self-Paced Digital Training',
  liveLearning:        'Live Learning Sessions',
  certifications:      'Certifications & Exams',
  gamifiedEvents:      'Gamified Events & Challenges',
  communityEngagement: 'Community Engagement',
};

/**
 * Rebuild the option list of an Activity Type <select> from the
 * current point configuration.
 *
 * @param {string} selectId - DOM id of the <select> element
 */
export function populateActivityTypePicker(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const pc = getConfig().pointConfig || {};
  const groups = Object.entries(PICKER_SECTION_LABEL)
    .map(([key, label]) => {
      const entries = Object.entries(pc[key] || {});
      if (entries.length === 0) return '';
      const opts = entries.map(([sub, pts]) =>
        `<option value="${esc(key)}|${esc(sub)}" data-points="${pts}">${esc(sub)} — ${pts} pts</option>`
      ).join('');
      return `<optgroup label="${esc(label)}">${opts}</optgroup>`;
    })
    .join('');
  sel.innerHTML = `<option value="">Custom (free-form)</option>${groups}`;
  sel.value = '';
}

/**
 * Parse the picker's current selection into { category, subCategory }.
 * Returns { category: '', subCategory: '' } for the Custom option.
 *
 * @param {string} selectId
 * @returns {{ category: string, subCategory: string }}
 */
function readPickerSelection(selectId) {
  const sel = document.getElementById(selectId);
  const raw = sel?.value || '';
  if (!raw) return { category: '', subCategory: '' };
  const [category, ...rest] = raw.split('|');
  return { category, subCategory: rest.join('|') };
}

/**
 * Auto-fill the title and points inputs when the user picks a
 * predefined activity type. The picker carries the target input IDs
 * via `data-title-id` and `data-points-id` so a single handler
 * serves both the manual and bulk modals.
 *
 * @param {HTMLSelectElement} el
 */
export function onActivityTypePicked(el) {
  const titleId = el.dataset.titleId;
  const pointsId = el.dataset.pointsId;
  const titleInput = titleId ? document.getElementById(titleId) : null;
  const pointsInput = pointsId ? document.getElementById(pointsId) : null;
  if (!titleInput || !pointsInput) return;

  if (!el.value) {
    titleInput.value = '';
    pointsInput.value = '';
    return;
  }

  const opt = el.options[el.selectedIndex];
  const { subCategory } = readPickerSelection(el.id);
  titleInput.value = subCategory;
  pointsInput.value = opt?.dataset?.points ?? '';
}
