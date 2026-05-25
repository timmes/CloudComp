/**
 * @module views/teams
 *
 * Team management: CRUD, member management, sort, filter.
 */

import {
  getUsers, getUser, getTeams, upsertUser, upsertTeam, stateDeleteTeam,
  getUserWithPoints, getUserMonthPoints, getUserQuarterPoints, getUserYearPoints, getUserTotalPoints,
  sortState, log, formatNumber, formatDate, autoSave, esc,
} from './shared.js';

let refreshDashboard;
export function _setRefreshFns(fns) { ({ refreshDashboard } = fns); }

// ── Team points ─────────────────────────────────────────────────────

export function updateTeamPoints(teamId) {
  const teams = getTeams();
  const team = teams[teamId];
  if (!team) return;

  const members = team.members || [];
  const monthPts = members.reduce((sum, email) => sum + getUserMonthPoints(email), 0);
  const quarterPts = members.reduce((sum, email) => sum + getUserQuarterPoints(email), 0);
  const yearPts = members.reduce((sum, email) => sum + getUserYearPoints(email), 0);
  const totalPts = members.reduce((sum, email) => sum + getUserTotalPoints(email), 0);
  upsertTeam({
    ...team, currentMonthPoints: monthPts, currentQuarterPoints: quarterPts,
    currentYearPoints: yearPts, totalPoints: totalPts,
  });
}

export function updateAllTeamPoints() {
  const teams = getTeams();
  for (const teamId of Object.keys(teams)) { updateTeamPoints(teamId); }
}

// ── CRUD ────────────────────────────────────────────────────────────

export function createTeam() {
  const name = document.getElementById('teamName').value.trim();
  const description = document.getElementById('teamDescription').value.trim();
  const color = document.getElementById('teamColor').value;
  if (!name) { alert('Please enter a team name'); return; }

  if (Object.values(getTeams()).find(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert('A team with this name already exists'); return;
  }

  const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  upsertTeam({ id: teamId, name, description, color, members: [], createdDate: new Date().toISOString(), currentMonthPoints: 0, totalPoints: 0 });

  closeCreateTeamModal();
  refreshTeamsTable();
  if (refreshDashboard) refreshDashboard();
  log(`Team created: ${name}`);
}

export function openCreateTeamModal() { document.getElementById('createTeamModal').classList.remove('hidden'); }

export function closeCreateTeamModal() {
  document.getElementById('createTeamModal').classList.add('hidden');
  document.getElementById('teamName').value = '';
  document.getElementById('teamDescription').value = '';
  document.getElementById('teamColor').value = 'blue';
}

export function deleteTeam(teamId) {
  const team = getTeams()[teamId];
  if (!team) return;
  if (!confirm(`Are you sure you want to delete the team "${team.name}"? This cannot be undone.`)) return;

  (team.members || []).forEach(email => {
    const user = getUser(email);
    if (user && user.teamId === teamId) { upsertUser({ ...user, teamId: null }); }
  });

  stateDeleteTeam(teamId);
  refreshTeamsTable();
  if (refreshDashboard) refreshDashboard();
  log(`Team deleted: ${team.name}`);
}

// ── Member management ───────────────────────────────────────────────

export function openManageTeamMembers(teamId) {
  const team = getTeams()[teamId];
  if (!team) return;

  document.getElementById('managingTeamName').textContent = team.name;
  document.getElementById('managingTeamDescription').textContent = team.description || 'No description';
  document.getElementById('manageTeamMembersModal').dataset.teamId = teamId;

  const select = document.getElementById('availableUsers');
  select.innerHTML = '';

  Object.values(getUsers())
    .filter(u => !(team.members || []).includes(u.email))
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.email;
      opt.textContent = `${u.name} (${u.email})`;
      select.appendChild(opt);
    });

  updateTeamMembersList(teamId);
  document.getElementById('manageTeamMembersModal').classList.remove('hidden');
}

export function closeManageTeamMembersModal() { document.getElementById('manageTeamMembersModal').classList.add('hidden'); }

export function addUsersToTeam() {
  const teamId = document.getElementById('manageTeamMembersModal').dataset.teamId;
  const team = getTeams()[teamId];
  if (!team) return;

  const selected = Array.from(document.getElementById('availableUsers').selectedOptions);
  const members = [...(team.members || [])];

  selected.forEach(opt => {
    const email = opt.value;
    if (!members.includes(email)) {
      members.push(email);
      const user = getUser(email);
      if (user) upsertUser({ ...user, teamId });
    }
  });

  upsertTeam({ ...team, members });
  updateTeamPoints(teamId);
  openManageTeamMembers(teamId);
  refreshTeamsTable();
  if (refreshDashboard) refreshDashboard();
  log(`Added ${selected.length} users to team ${team.name}`);
}

export function removeUserFromTeam(teamId, userEmail) {
  const team = getTeams()[teamId];
  if (!team) return;

  upsertTeam({ ...team, members: (team.members || []).filter(e => e !== userEmail) });

  const user = getUser(userEmail);
  if (user && user.teamId === teamId) upsertUser({ ...user, teamId: null });

  updateTeamPoints(teamId);
  updateTeamMembersList(teamId);
  refreshTeamsTable();
  if (refreshDashboard) refreshDashboard();
  log(`Removed user from team ${team.name}`);
}

function updateTeamMembersList(teamId) {
  const team = getTeams()[teamId];
  if (!team) return;
  const container = document.getElementById('teamMembersList');
  const members = team.members || [];

  if (members.length === 0) { container.innerHTML = '<p class="text-gray-500 text-sm">No members yet</p>'; return; }

  container.innerHTML = members.map(email => {
    const user = getUserWithPoints(email);
    return `
      <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
        <div>
          <div class="font-medium text-gray-900">${esc(user?.name || email)}</div>
          <div class="text-sm text-gray-500">${esc(email)}</div>
          <div class="text-xs text-gray-600">Points this month: ${user?.currentMonthPoints || 0}</div>
        </div>
        <button data-action="removeUserFromTeam" data-team-id="${esc(teamId)}" data-email="${esc(email)}" class="text-red-600 hover:text-red-800 text-sm">Remove</button>
      </div>`;
  }).join('');
}

// ── Table rendering ─────────────────────────────────────────────────

export function refreshTeamsTable() {
  const tbody = document.getElementById('teamsTableBody');
  updateAllTeamPoints();

  let teams = Object.values(getTeams());

  teams.sort((a, b) => {
    let av, bv;
    if (sortState.teams.field === 'members') { av = (a.members||[]).length; bv = (b.members||[]).length; }
    else { av = a[sortState.teams.field]; bv = b[sortState.teams.field]; }
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    return sortState.teams.ascending ? (av > bv ? 1 : av < bv ? -1 : 0) : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  if (teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="cc-empty-state" style="padding:3rem 1rem;"><div class="cc-empty-state-icon" style="width:4rem;height:4rem;margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:2rem;height:2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"/></svg></div><div class="cc-empty-state-title" style="font-size:1rem;">No teams yet</div><p class="cc-empty-state-text" style="font-size:0.8125rem;">Create a team to start tracking group progress.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = teams.map(team => {
    const cc = { blue:'bg-blue-100 text-blue-800',green:'bg-green-100 text-green-800',purple:'bg-purple-100 text-purple-800',orange:'bg-orange-100 text-orange-800',pink:'bg-pink-100 text-pink-800',teal:'bg-teal-100 text-teal-800',indigo:'bg-indigo-100 text-indigo-800',red:'bg-red-100 text-red-800' }[team.color] || 'bg-gray-100 text-gray-800';
    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3"><div class="flex items-center"><span class="px-2 py-1 text-xs rounded-full ${cc} mr-2">${esc(team.name.substring(0, 2).toUpperCase())}</span><div><div class="font-medium text-gray-900">${esc(team.name)}</div><div class="text-sm text-gray-500">${esc(team.description || 'No description')}</div></div></div></td>
        <td class="px-4 py-3"><span class="text-gray-600">${(team.members||[]).length}</span></td>
        <td class="px-4 py-3"><span class="font-bold text-teal-600">${formatNumber(team.currentMonthPoints)}</span></td>
        <td class="px-4 py-3"><span class="font-medium text-gray-900">${formatNumber(team.totalPoints)}</span></td>
        <td class="px-4 py-3"><span class="text-sm text-gray-500">${esc(formatDate(team.createdDate))}</span></td>
        <td class="px-4 py-3"><div class="flex space-x-2"><button data-action="openManageTeamMembers" data-team-id="${esc(team.id)}" class="text-blue-600 hover:text-blue-800 text-sm">Manage</button><button data-action="deleteTeam" data-team-id="${esc(team.id)}" class="text-red-600 hover:text-red-800 text-sm">Delete</button></div></td>
      </tr>`;
  }).join('');
  updateTeamSortButtons();
}

// ── Sort / filter ───────────────────────────────────────────────────

export function toggleTeamSort(field) {
  if (sortState.teams.field === field) sortState.teams.ascending = !sortState.teams.ascending;
  else { sortState.teams.field = field; sortState.teams.ascending = false; }
  refreshTeamsTable();
}

export function toggleTeamSortOrder() { sortState.teams.ascending = !sortState.teams.ascending; refreshTeamsTable(); }

export function updateTeamSortButtons() {
  ['sortMembers','sortTeamCurrentMonth','sortTeamTotal'].forEach(id => { const b = document.getElementById(id); if (b) b.className = 'cc-sort-btn'; });
  const af = sortState.teams.field === 'members' ? 'sortMembers' : sortState.teams.field === 'currentMonthPoints' ? 'sortTeamCurrentMonth' : 'sortTeamTotal';
  const ab = document.getElementById(af); if (ab) ab.className = 'cc-sort-btn active';
  const ob = document.getElementById('sortOrderTeam'); if (ob) ob.textContent = sortState.teams.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
}

export function filterTeams() {
  const s = document.getElementById('teamSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#teamsTableBody tr');
  if (rows.length === 1 && rows[0].querySelector('td[colspan]')) return;
  rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(s) ? '' : 'none'; });
}
