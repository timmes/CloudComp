/**
 * @module views/dashboard
 *
 * Dashboard rendering: stat metrics, leaderboards, recent activities, charts.
 * Supports user/team sub-tabs, month/quarter/year time periods,
 * and course-type filtering.
 */

import {
  getUsers, getUsersWithPoints, getUserWithPoints, getActivities, getTeams,
  getCampaigns, getConfig,
  getCurrentMonth, getCurrentQuarterRange, getCurrentYearPrefix,
  formatNumber, formatDate, esc,
} from './shared.js';
import { updateAllTeamPoints } from './teams.js';
import {
  isCampaignActive, getCampaignParticipantIds,
  getCampaignLeaderboard, getCampaignTeamLeaderboard,
} from '../models/campaign.js';

// ── Dashboard filter state ─────────────────────────────────────────

let _subTab = 'users';
let _timePeriod = 'month';
let _courseTypeFilter = null;
let _selectedCampaignId = null;

// ── Public action handlers ─────────────────────────────────────────

export function setDashboardSubTab(tab) {
  _subTab = tab;
  refreshDashboard();
}

export function setDashboardTimePeriod(period) {
  _timePeriod = period;
  refreshDashboard();
}

export function setDashboardCourseTypeFilter(type) {
  _courseTypeFilter = _courseTypeFilter === type ? null : type;
  refreshDashboard();
}

export function clearDashboardCourseTypeFilter() {
  _courseTypeFilter = null;
  refreshDashboard();
}

/** @param {string} campaignId */
export function setDashboardCampaign(campaignId) {
  _selectedCampaignId = campaignId || null;
  refreshDashboard();
}

// ── Filtered activities ────────────────────────────────────────────

function getFilteredActivities() {
  const all = getActivities();
  if (!_courseTypeFilter) return all;
  return all.filter(a => a.courseType === _courseTypeFilter);
}

// ── On-the-fly points (used when course-type filter is active) ────

function computeUserPoints(activities) {
  const monthPrefix = getCurrentMonth();
  const { start: qStart, end: qEnd } = getCurrentQuarterRange();
  const yearPrefix = getCurrentYearPrefix();
  const map = new Map();

  for (const a of activities) {
    if (a.status && a.status !== 'completed') continue;
    const uid = a.userId || a.userEmail || '';
    const e = map.get(uid) || { month: 0, quarter: 0, year: 0, total: 0 };
    e.total += a.pointsEarned;
    if (a.completedDate) {
      if (a.completedDate.startsWith(monthPrefix)) e.month += a.pointsEarned;
      if (a.completedDate >= qStart && a.completedDate <= qEnd + '\uffff') e.quarter += a.pointsEarned;
      if (a.completedDate.startsWith(yearPrefix)) e.year += a.pointsEarned;
    }
    map.set(uid, e);
  }
  return map;
}

function periodKey() {
  const keys = {
    month: 'currentMonthPoints',
    quarter: 'currentQuarterPoints',
    year: 'currentYearPoints',
    overall: 'totalPoints',
  };
  return keys[_timePeriod] || keys.month;
}

function periodLabel() {
  const labels = {
    month: 'this month',
    quarter: 'this quarter',
    year: 'this year',
    overall: 'all time',
  };
  return labels[_timePeriod] || labels.month;
}

// ── Main refresh orchestrator ──────────────────────────────────────

export function refreshDashboard() {
  const users = getUsersWithPoints();
  const allActivities = getActivities();
  const teams = getTeams();

  const hasData = Object.keys(users).length > 0 || allActivities.length > 0;
  const content = document.getElementById('dashboardContent');
  const empty = document.getElementById('dashboardEmpty');
  if (content) content.style.display = hasData ? '' : 'none';
  if (empty) empty.style.display = hasData ? 'none' : '';
  if (!hasData) return;

  const filtered = getFilteredActivities();
  updateAllTeamPoints();

  updateMetrics(users, teams, filtered);
  updateActivityCharts(allActivities);
  updateSubTabUI(teams);
  updateTimePeriodUI();
  updateCourseFilterUI();

  if (_subTab === 'users') {
    updateUserLeaderboard(filtered);
  } else if (_subTab === 'teams') {
    updateTeamLeaderboard(filtered, teams);
  } else if (_subTab === 'campaigns') {
    updateCampaignsPanel();
  }
  if (_subTab !== 'campaigns') updateRecentActivities(filtered);
}

// ── Metrics ────────────────────────────────────────────────────────

function updateMetrics(users, teams, activities) {
  const monthPrefix = getCurrentMonth();
  const { start: qStart, end: qEnd } = getCurrentQuarterRange();
  const yearPrefix = getCurrentYearPrefix();

  document.getElementById('totalUsers').textContent = formatNumber(Object.keys(users).length);
  document.getElementById('totalTeams').textContent = formatNumber(Object.keys(teams).length);
  document.getElementById('completedActivities').textContent = formatNumber(activities.length);

  const totalPoints = Object.values(users).reduce((sum, u) => sum + (u.totalPoints || 0), 0);
  document.getElementById('totalPointsAwarded').textContent = formatNumber(totalPoints);

  setMetricText('currentMonthActivities', activities.filter(a => a.completedDate?.startsWith(monthPrefix)).length);
  setMetricText('currentQuarterActivities', activities.filter(a => a.completedDate >= qStart && a.completedDate <= qEnd + '\uffff').length);
  setMetricText('currentYearActivities', activities.filter(a => a.completedDate?.startsWith(yearPrefix)).length);
}

function setMetricText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = formatNumber(value);
}

// ── Sub-tab UI ─────────────────────────────────────────────────────

function updateSubTabUI(teams) {
  const hasTeams = Object.keys(teams).length > 0;
  const hasCampaigns = Object.keys(getCampaigns()).length > 0;

  const teamsTabBtn = document.getElementById('dashSubTabTeams');
  if (teamsTabBtn) teamsTabBtn.style.display = hasTeams ? '' : 'none';
  const campaignsTabBtn = document.getElementById('dashSubTabCampaigns');
  if (campaignsTabBtn) campaignsTabBtn.style.display = hasCampaigns ? '' : 'none';

  if (_subTab === 'teams' && !hasTeams) _subTab = 'users';
  if (_subTab === 'campaigns' && !hasCampaigns) _subTab = 'users';

  document.querySelectorAll('#dashboardSubTabs .tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _subTab);
  });

  const onCampaigns = _subTab === 'campaigns';
  const userPanel = document.getElementById('dashUserLeaderboard');
  const teamPanel = document.getElementById('dashTeamLeaderboard');
  const leaderboardArea = document.getElementById('dashLeaderboardArea');
  const campaignPanel = document.getElementById('dashCampaignPanel');
  const timeToggle = document.getElementById('timePeriodToggle');

  if (leaderboardArea) leaderboardArea.style.display = onCampaigns ? 'none' : '';
  if (campaignPanel) campaignPanel.style.display = onCampaigns ? '' : 'none';
  if (timeToggle) timeToggle.style.display = onCampaigns ? 'none' : '';
  if (userPanel) userPanel.style.display = _subTab === 'users' ? '' : 'none';
  if (teamPanel) teamPanel.style.display = _subTab === 'teams' ? '' : 'none';
}

// ── Time period UI ─────────────────────────────────────────────────

function updateTimePeriodUI() {
  document.querySelectorAll('#timePeriodToggle .cc-sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === _timePeriod);
  });
}

// ── Course filter UI ───────────────────────────────────────────────

function updateCourseFilterUI() {
  const el = document.getElementById('dashboardFilterIndicator');
  if (!el) return;
  if (_courseTypeFilter) {
    el.innerHTML = `<span class="cc-pill" style="background:var(--cc-accent-light);color:var(--cc-accent);">${esc(_courseTypeFilter)} <button data-action="clearDashboardCourseTypeFilter" style="margin-left:0.25rem;cursor:pointer;font-weight:700;">&times;</button></span>`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// ── User leaderboard ───────────────────────────────────────────────

function updateUserLeaderboard(activities) {
  const key = periodKey();
  let ranked;

  if (_courseTypeFilter) {
    const pts = computeUserPoints(activities);
    const field = { currentMonthPoints: 'month', currentQuarterPoints: 'quarter', currentYearPoints: 'year', totalPoints: 'total' }[key];
    ranked = Object.values(getUsersWithPoints())
      .map(u => ({ ...u, [key]: pts.get(u.email)?.[field] ?? 0 }))
      .filter(u => u[key] > 0);
  } else {
    ranked = Object.values(getUsersWithPoints()).filter(u => u[key] > 0);
  }

  ranked.sort((a, b) => b[key] - a[key]);
  ranked = ranked.slice(0, 10);

  const tbody = document.getElementById('leaderboardBody');
  if (ranked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-sm" style="color:var(--cc-text-muted);">No activity ${periodLabel()}</td></tr>`;
    return;
  }

  tbody.innerHTML = ranked.map((user, i) => `
    <tr>
      <td class="w-12"><span class="font-semibold text-gray-500">${i + 1}</span></td>
      <td>
        <div class="font-medium text-gray-900 text-sm">${esc(user.name)}</div>
        <div class="text-xs text-gray-400">${esc(user.email)}</div>
      </td>
      <td class="text-right"><span class="font-semibold text-gray-900">${formatNumber(user[key])}</span></td>
    </tr>
  `).join('');
}

// ── Team leaderboard ───────────────────────────────────────────────

function updateTeamLeaderboard(activities, teams) {
  const key = periodKey();
  let ranked;

  if (_courseTypeFilter) {
    const pts = computeUserPoints(activities);
    const field = { currentMonthPoints: 'month', currentQuarterPoints: 'quarter', currentYearPoints: 'year', totalPoints: 'total' }[key];
    ranked = Object.values(teams).map(t => {
      const members = t.members || [];
      const teamPts = members.reduce((s, email) => s + (pts.get(email)?.[field] ?? 0), 0);
      return { ...t, [key]: teamPts };
    }).filter(t => t[key] > 0);
  } else {
    ranked = Object.values(teams).filter(t => t[key] > 0);
  }

  ranked.sort((a, b) => b[key] - a[key]);
  ranked = ranked.slice(0, 10);

  const tbody = document.getElementById('teamLeaderboardBody');
  if (ranked.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-6 text-center text-sm" style="color:var(--cc-text-muted);">No team activity ${periodLabel()}</td></tr>`;
    return;
  }

  tbody.innerHTML = ranked.map((team, i) => `
    <tr>
      <td class="w-12"><span class="font-semibold text-gray-500">${i + 1}</span></td>
      <td><span class="font-medium text-gray-900 text-sm">${esc(team.name)}</span></td>
      <td><span class="text-sm text-gray-500">${(team.members || []).length}</span></td>
      <td class="text-right"><span class="font-semibold text-gray-900">${formatNumber(team[key])}</span></td>
    </tr>
  `).join('');
}

// ── Campaigns panel ────────────────────────────────────────────────

function updateCampaignsPanel() {
  const campaigns = Object.values(getCampaigns());
  if (campaigns.length === 0) return;

  // Sort: active first, then by start date descending
  campaigns.sort((a, b) => {
    const aActive = isCampaignActive(a) ? 0 : 1;
    const bActive = isCampaignActive(b) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return (b.startDate || '').localeCompare(a.startDate || '');
  });

  if (!_selectedCampaignId || !campaigns.some(c => c.id === _selectedCampaignId)) {
    _selectedCampaignId = campaigns[0].id;
  }
  const campaign = campaigns.find(c => c.id === _selectedCampaignId);

  renderCampaignSelector(campaigns, _selectedCampaignId);
  renderCampaignSummary(campaign);
  renderCampaignMetrics(campaign);
  renderCampaignLeaderboard(campaign);
}

function renderCampaignSelector(campaigns, selectedId) {
  const select = document.getElementById('dashCampaignSelect');
  if (!select) return;
  select.innerHTML = campaigns.map(c => {
    const tag = isCampaignActive(c) ? '● ' : '';
    return `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${tag}${esc(c.name)}</option>`;
  }).join('');
}

function renderCampaignSummary(campaign) {
  const el = document.getElementById('dashCampaignSummary');
  if (!el) return;
  const start = formatDate(campaign.startDate);
  const end = campaign.endDate ? formatDate(campaign.endDate) : 'Open-ended';
  const statusBadge = `<span class="cc-pill" style="background:var(--cc-accent-light);color:var(--cc-accent);">${esc(campaign.status)}</span>`;
  el.innerHTML = `
    <div class="flex items-center gap-3 flex-wrap">
      ${statusBadge}
      <span>${start} → ${end}</span>
      ${campaign.description ? `<span style="color:var(--cc-text);">• ${esc(campaign.description)}</span>` : ''}
    </div>
  `;
}

function renderCampaignMetrics(campaign) {
  const el = document.getElementById('dashCampaignMetrics');
  if (!el) return;
  const teams = getTeams();
  const activities = getActivities();
  const participantIds = getCampaignParticipantIds(campaign, teams);
  const participantSet = new Set(participantIds);

  const eligible = activities.filter(a => {
    if (a.status && a.status !== 'completed') return false;
    if (!participantSet.has(a.userId)) return false;
    if (!a.completedDate) return false;
    if (a.completedDate < campaign.startDate) return false;
    if (campaign.endDate && a.completedDate > campaign.endDate) return false;
    return true;
  });
  const totalPoints = eligible.reduce((s, a) => s + (a.pointsEarned || 0), 0);
  const activeUsers = new Set(eligible.map(a => a.userId)).size;

  el.innerHTML = `
    <div class="cc-metric"><div class="cc-metric-label">Participants</div><div class="cc-metric-value">${formatNumber(participantIds.length)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Active Participants</div><div class="cc-metric-value">${formatNumber(activeUsers)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Activities</div><div class="cc-metric-value">${formatNumber(eligible.length)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Points Awarded</div><div class="cc-metric-value">${formatNumber(totalPoints)}</div></div>
  `;
}

function renderCampaignLeaderboard(campaign) {
  const tbody = document.getElementById('dashCampaignLeaderboardBody');
  if (!tbody) return;
  const users = getUsers();
  const teams = getTeams();
  const activities = getActivities();
  const config = getConfig();
  const lb = getCampaignLeaderboard(campaign, users, teams, activities, config)
    .filter(e => e.points > 0)
    .slice(0, 10);

  if (lb.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="px-4 py-6 text-center text-sm" style="color:var(--cc-text-muted);">No activity in this campaign yet</td></tr>`;
    return;
  }

  tbody.innerHTML = lb.map(e => `
    <tr>
      <td class="w-12"><span class="font-semibold text-gray-500">${e.rank}</span></td>
      <td>
        <div class="font-medium text-gray-900 text-sm">${esc(e.name)}</div>
        <div class="text-xs text-gray-400">${esc(e.userId)}</div>
      </td>
      <td class="text-right"><span class="font-semibold text-gray-900">${formatNumber(e.points)}</span></td>
    </tr>
  `).join('');
}

// ── Recent activities ──────────────────────────────────────────────

function updateRecentActivities(activities) {
  let scoped = activities;
  if (_timePeriod === 'month') {
    const prefix = getCurrentMonth();
    scoped = activities.filter(a => a.completedDate?.startsWith(prefix));
  } else if (_timePeriod === 'quarter') {
    const { start, end } = getCurrentQuarterRange();
    scoped = activities.filter(a => a.completedDate >= start && a.completedDate <= end + '\uffff');
  } else if (_timePeriod === 'year') {
    const prefix = getCurrentYearPrefix();
    scoped = activities.filter(a => a.completedDate?.startsWith(prefix));
  }
  // _timePeriod === 'overall' \u2192 no time scoping; scoped remains all activities
  const recent = [...scoped]
    .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
    .slice(0, 10);

  const container = document.getElementById('recentActivities');
  if (recent.length === 0) {
    container.innerHTML = `<div class="text-sm py-6 text-center" style="color:var(--cc-text-muted);">No activities yet</div>`;
    return;
  }

  container.innerHTML = recent.map(a => {
    const user = getUserWithPoints(a.userEmail || a.userId);
    return `
      <div class="flex items-center justify-between py-2">
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium text-gray-900 truncate">${esc(user?.name || a.userEmail || a.userId)}</div>
          <div class="text-xs text-gray-400 truncate">${esc(a.title)}</div>
        </div>
        <div class="text-right ml-4 shrink-0">
          <div class="text-sm font-semibold text-gray-900">+${a.pointsEarned}</div>
          <div class="text-xs text-gray-400">${esc(formatDate(a.completedDate))}</div>
        </div>
      </div>`;
  }).join('');
}

function computeCompletionRate(activities) {
  if (activities.length === 0) return 0;
  const completed = activities.filter(a => !a.status || a.status === 'completed').length;
  return Math.round((completed / activities.length) * 100);
}

// ── Activity charts ────────────────────────────────────────────────
// Course-type list shows the full breakdown so the filter remains
// changeable. Completion rate scopes to the selected course type.

function updateActivityCharts(activities) {
  const courseTypes = {};
  activities.forEach(a => {
    const t = a.courseType || 'Unknown';
    courseTypes[t] = (courseTypes[t] || 0) + 1;
  });
  const top5 = Object.entries(courseTypes).sort(([, a], [, b]) => b - a).slice(0, 5);

  const completionScope = _courseTypeFilter
    ? activities.filter(a => (a.courseType || 'Unknown') === _courseTypeFilter)
    : activities;
  const completionLabel = _courseTypeFilter
    ? `Completion Rate (${esc(_courseTypeFilter)})`
    : 'Completion Rate';

  const container = document.getElementById('activityCharts');
  container.innerHTML = `
    <div>
      <div class="cc-metric-label mb-3">Course Types</div>
      <div class="space-y-2">
        ${top5.length === 0 ? '<div class="text-sm" style="color:var(--cc-text-muted);">No data</div>' :
          top5.map(([type, count]) => {
            const pct = activities.length > 0 ? Math.round((count / activities.length) * 100) : 0;
            const isActive = _courseTypeFilter === type;
            return `
              <div data-action="setDashboardCourseTypeFilter" data-course-type="${esc(type)}"
                   style="cursor:pointer;border-radius:var(--cc-radius-sm);padding:0.375rem 0.5rem;transition:background 0.15s;${isActive ? 'background:var(--cc-accent-light);' : ''}"
                   class="hover:bg-gray-50">
                <div class="flex justify-between text-sm mb-1">
                  <span style="color:${isActive ? 'var(--cc-accent)' : 'var(--cc-text-secondary)'};font-weight:${isActive ? '600' : '400'};" class="truncate mr-2">${esc(type)}</span>
                  <span class="font-medium shrink-0" style="color:var(--cc-text);">${count}</span>
                </div>
                <div class="w-full rounded-full h-1.5" style="background:#f3f4f6;">
                  <div class="h-1.5 rounded-full" style="width:${pct}%;background:${isActive ? 'var(--cc-accent)' : '#d1d5db'};"></div>
                </div>
              </div>`;
          }).join('')}
      </div>
    </div>
    <div class="cc-metric text-center">
      <div class="cc-metric-label">${completionLabel}</div>
      <div class="cc-metric-value">${computeCompletionRate(completionScope)}%</div>
    </div>
  `;
}
