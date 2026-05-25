/**
 * @module views/campaigns
 *
 * Campaign management: list, create/edit, detail view with leaderboards.
 */

import {
  getUsers, getTeams, getActivities, getConfig,
  getCampaigns, getCampaign, upsertCampaign, stateDeleteCampaign,
  sortState, log, formatDate, formatNumber, esc,
} from './shared.js';
import {
  createCampaign, getCampaignParticipantIds,
  getCampaignLeaderboard, getCampaignTeamLeaderboard,
} from '../models/campaign.js';

let refreshDashboard;
export function _setRefreshFns(fns) { ({ refreshDashboard } = fns); }

// ── Status styling ──────────────────────────────────────────────────

const STATUS_CLASS = {
  draft:     'bg-gray-100 text-gray-800',
  active:    'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  archived:  'bg-gray-100 text-gray-600',
};

// ── Table rendering ─────────────────────────────────────────────────

export function refreshCampaignsTable() {
  const tbody = document.getElementById('campaignsTableBody');
  const teams = getTeams();
  let campaigns = Object.values(getCampaigns());

  campaigns.sort((a, b) => {
    let av = a[sortState.campaigns.field] ?? '';
    let bv = b[sortState.campaigns.field] ?? '';
    if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
    return sortState.campaigns.ascending
      ? (av > bv ? 1 : av < bv ? -1 : 0)
      : (av < bv ? 1 : av > bv ? -1 : 0);
  });

  if (campaigns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="cc-empty-state" style="padding:3rem 1rem;"><div class="cc-empty-state-icon" style="width:4rem;height:4rem;margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width:2rem;height:2rem;"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .982-3.172M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"/></svg></div><div class="cc-empty-state-title" style="font-size:1rem;">No campaigns yet</div><p class="cc-empty-state-text" style="font-size:0.8125rem;">Create a campaign to run time-boxed learning competitions.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = campaigns.map(c => {
    const pCount = getCampaignParticipantIds(c, teams).length;
    const sc = STATUS_CLASS[c.status] || STATUS_CLASS.draft;
    return `
      <tr class="">
        <td class="px-4 py-3">
          <div class="font-medium text-gray-900">${esc(c.name)}</div>
          <div class="text-sm text-gray-500">${esc(c.description || '')}</div>
        </td>
        <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full ${sc}">${esc(c.status)}</span></td>
        <td class="px-4 py-3"><span class="text-sm text-gray-500">${esc(formatDate(c.startDate))}</span></td>
        <td class="px-4 py-3"><span class="text-sm text-gray-500">${c.endDate ? esc(formatDate(c.endDate)) : 'Open-ended'}</span></td>
        <td class="px-4 py-3"><span class="text-gray-600">${pCount}</span></td>
        <td class="px-4 py-3">
          <div class="flex space-x-2">
            <button data-action="viewCampaign" data-campaign-id="${esc(c.id)}" class="text-indigo-600 hover:text-indigo-800 text-sm">View</button>
            <button data-action="openEditCampaignModal" data-campaign-id="${esc(c.id)}" class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
            <button data-action="deleteCampaign" data-campaign-id="${esc(c.id)}" class="text-red-600 hover:text-red-800 text-sm">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  updateCampaignSortButtons();
}

// ── Sort / filter ───────────────────────────────────────────────────

export function toggleCampaignSort(field) {
  if (sortState.campaigns.field === field) sortState.campaigns.ascending = !sortState.campaigns.ascending;
  else { sortState.campaigns.field = field; sortState.campaigns.ascending = false; }
  refreshCampaignsTable();
}

export function toggleCampaignSortOrder() {
  sortState.campaigns.ascending = !sortState.campaigns.ascending;
  refreshCampaignsTable();
}

export function updateCampaignSortButtons() {
  ['sortCampaignStartDate', 'sortCampaignStatus', 'sortCampaignName'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.className = 'cc-sort-btn';
  });
  const map = { startDate: 'sortCampaignStartDate', status: 'sortCampaignStatus', name: 'sortCampaignName' };
  const active = document.getElementById(map[sortState.campaigns.field]);
  if (active) active.className = 'cc-sort-btn active';
  const ob = document.getElementById('sortOrderCampaign');
  if (ob) ob.textContent = sortState.campaigns.ascending ? 'Oldest First' : 'Newest First';
}

export function filterCampaigns() {
  const s = document.getElementById('campaignSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#campaignsTableBody tr');
  if (rows.length === 1 && rows[0].querySelector('td[colspan]')) return;
  rows.forEach(r => { r.style.display = r.textContent.toLowerCase().includes(s) ? '' : 'none'; });
}

// ── Create / Edit modal ─────────────────────────────────────────────

export function openCreateCampaignModal() {
  document.getElementById('campaignModalTitle').textContent = 'Create Campaign';
  document.getElementById('campaignNameInput').value = '';
  document.getElementById('campaignDescriptionInput').value = '';
  document.getElementById('campaignStartDateInput').value = '';
  document.getElementById('campaignEndDateInput').value = '';
  document.getElementById('campaignStatusInput').value = 'draft';
  document.getElementById('campaignColorInput').value = 'blue';
  populateParticipantSelects([], []);
  const modal = document.getElementById('campaignModal');
  modal.dataset.mode = 'create';
  modal.dataset.campaignId = '';
  modal.classList.remove('hidden');
}

export function openEditCampaignModal(campaignId) {
  const c = getCampaign(campaignId);
  if (!c) return;
  document.getElementById('campaignModalTitle').textContent = 'Edit Campaign';
  document.getElementById('campaignNameInput').value = c.name;
  document.getElementById('campaignDescriptionInput').value = c.description || '';
  document.getElementById('campaignStartDateInput').value = (c.startDate || '').slice(0, 10);
  document.getElementById('campaignEndDateInput').value = (c.endDate || '').slice(0, 10);
  document.getElementById('campaignStatusInput').value = c.status || 'draft';
  document.getElementById('campaignColorInput').value = c.color || 'blue';
  populateParticipantSelects(c.teamIds || [], c.participantIds || []);
  const modal = document.getElementById('campaignModal');
  modal.dataset.mode = 'edit';
  modal.dataset.campaignId = campaignId;
  modal.classList.remove('hidden');
}

function populateParticipantSelects(selectedTeamIds, selectedParticipantIds) {
  const teamSelect = document.getElementById('campaignTeams');
  teamSelect.innerHTML = '';
  for (const team of Object.values(getTeams())) {
    const opt = document.createElement('option');
    opt.value = team.id;
    opt.textContent = team.name;
    opt.selected = selectedTeamIds.includes(team.id);
    teamSelect.appendChild(opt);
  }

  const userSelect = document.getElementById('campaignParticipants');
  userSelect.innerHTML = '';
  for (const user of Object.values(getUsers())) {
    const opt = document.createElement('option');
    opt.value = user.email;
    opt.textContent = `${user.name} (${user.email})`;
    opt.selected = selectedParticipantIds.includes(user.email);
    userSelect.appendChild(opt);
  }
}

export function closeCampaignModal() {
  document.getElementById('campaignModal').classList.add('hidden');
}

export function saveCampaign() {
  const name = document.getElementById('campaignNameInput').value.trim();
  const startDate = document.getElementById('campaignStartDateInput').value;

  if (!name) { alert('Please enter a campaign name'); return; }
  if (!startDate) { alert('Please enter a start date'); return; }

  const endDateRaw = document.getElementById('campaignEndDateInput').value;
  if (endDateRaw && endDateRaw < startDate) {
    alert('End date must be after start date'); return;
  }

  const fields = {
    name,
    description: document.getElementById('campaignDescriptionInput').value.trim(),
    startDate: new Date(startDate).toISOString(),
    endDate: endDateRaw ? new Date(endDateRaw).toISOString() : null,
    status: document.getElementById('campaignStatusInput').value,
    color: document.getElementById('campaignColorInput').value,
    teamIds: Array.from(document.getElementById('campaignTeams').selectedOptions).map(o => o.value),
    participantIds: Array.from(document.getElementById('campaignParticipants').selectedOptions).map(o => o.value),
  };

  const modal = document.getElementById('campaignModal');
  if (modal.dataset.mode === 'edit') {
    upsertCampaign({ id: modal.dataset.campaignId, ...fields });
    log(`Campaign updated: ${name}`);
  } else {
    const campaign = createCampaign(fields);
    upsertCampaign(campaign);
    log(`Campaign created: ${name}`);
  }

  closeCampaignModal();
  refreshCampaignsTable();
  if (refreshDashboard) refreshDashboard();
}

// ── Delete ──────────────────────────────────────────────────────────

export function deleteCampaignAction(campaignId) {
  const c = getCampaign(campaignId);
  if (!c) return;
  if (!confirm(`Delete campaign "${c.name}"? This cannot be undone.`)) return;
  stateDeleteCampaign(campaignId);
  refreshCampaignsTable();
  log(`Campaign deleted: ${c.name}`);
}

// ── Detail / Leaderboard view ───────────────────────────────────────

export function viewCampaign(campaignId) {
  const c = getCampaign(campaignId);
  if (!c) return;

  document.getElementById('campaignListSection').classList.add('hidden');
  document.getElementById('campaignDetailSection').classList.remove('hidden');

  document.getElementById('campaignDetailName').textContent = c.name;
  document.getElementById('campaignDetailDescription').textContent = c.description || '';
  document.getElementById('campaignDetailStatus').innerHTML = `<span class="px-2 py-1 text-xs rounded-full ${STATUS_CLASS[c.status] || ''}">${esc(c.status)}</span>`;
  document.getElementById('campaignDetailStartDate').textContent = formatDate(c.startDate);
  document.getElementById('campaignDetailEndDate').textContent = c.endDate ? formatDate(c.endDate) : 'Open-ended';

  renderStatusActions(c);
  renderUserLeaderboard(c);
  renderTeamLeaderboard(c);
}

function renderStatusActions(campaign) {
  const container = document.getElementById('campaignDetailActions');
  const buttons = [];
  if (campaign.status === 'draft') {
    buttons.push(`<button data-action="setCampaignStatus" data-campaign-id="${esc(campaign.id)}" data-status="active" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-sm">Activate</button>`);
  }
  if (campaign.status === 'active') {
    buttons.push(`<button data-action="setCampaignStatus" data-campaign-id="${esc(campaign.id)}" data-status="completed" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Complete</button>`);
  }
  if (campaign.status === 'completed') {
    buttons.push(`<button data-action="setCampaignStatus" data-campaign-id="${esc(campaign.id)}" data-status="archived" class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg text-sm">Archive</button>`);
  }
  container.innerHTML = buttons.join(' ');
}

function renderUserLeaderboard(campaign) {
  const users = getUsers();
  const teams = getTeams();
  const activities = getActivities();
  const config = getConfig();
  const lb = getCampaignLeaderboard(campaign, users, teams, activities, config);

  const tbody = document.getElementById('campaignUserLeaderboardBody');
  if (lb.length === 0 || lb.every(e => e.points === 0)) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-3 text-center text-gray-500 text-sm">No activity yet</td></tr>`;
    return;
  }

  tbody.innerHTML = lb.filter(e => e.points > 0).map(e => `
    <tr class="${e.rank <= 3 ? 'bg-indigo-50/30' : 'hover:bg-gray-50'}">
      <td class="px-4 py-3"><span class="font-bold">${e.rank}${e.rank === 1 ? '🥇' : e.rank === 2 ? '🥈' : e.rank === 3 ? '🥉' : ''}</span></td>
      <td class="px-4 py-3"><span class="font-medium text-gray-900">${esc(e.name)}</span></td>
      <td class="px-4 py-3"><span class="font-bold text-purple-600">${formatNumber(e.points)}</span></td>
    </tr>
  `).join('');
}

function renderTeamLeaderboard(campaign) {
  const users = getUsers();
  const teams = getTeams();
  const activities = getActivities();
  const config = getConfig();
  const lb = getCampaignTeamLeaderboard(campaign, users, teams, activities, config);

  const tbody = document.getElementById('campaignTeamLeaderboardBody');
  if (lb.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500 text-sm">No teams linked</td></tr>`;
    return;
  }

  tbody.innerHTML = lb.map(e => `
    <tr class="">
      <td class="px-4 py-3"><span class="font-bold">${e.rank}</span></td>
      <td class="px-4 py-3"><span class="font-medium text-gray-900">${esc(e.name)}</span></td>
      <td class="px-4 py-3"><span class="text-gray-600">${e.memberCount}</span></td>
      <td class="px-4 py-3"><span class="font-bold text-teal-600">${formatNumber(e.points)}</span></td>
    </tr>
  `).join('');
}

export function closeCampaignDetail() {
  document.getElementById('campaignDetailSection').classList.add('hidden');
  document.getElementById('campaignListSection').classList.remove('hidden');
}

// ── Status transition ───────────────────────────────────────────────

export function setCampaignStatus(campaignId, newStatus) {
  upsertCampaign({ id: campaignId, status: newStatus });
  refreshCampaignsTable();
  viewCampaign(campaignId);
  log(`Campaign status changed to ${newStatus}`);
}
