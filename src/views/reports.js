/**
 * @module views/reports
 *
 * Reports view: YTD performance charts, course-type breakdown,
 * user/team sub-tabs with search/filter.
 */

import {
  getUsers, getActivities, getTeams,
  getUserWithPoints,
  getCurrentYearPrefix,
  formatNumber, esc,
} from './shared.js';
import { updateAllTeamPoints } from './teams.js';

// ── Chart color palette ────────────────────────────────────────────

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#64748b',
];

// ── Module state ───────────────────────────────────────────────────

let _subTab = 'users';
let _selectedEntity = null;   // { type: 'user'|'team', id: string, name: string }
let _ytdChart = null;
let _courseChart = null;

// ── Public action handlers ─────────────────────────────────────────

/** @param {'users'|'teams'} tab */
export function setReportsSubTab(tab) {
  _subTab = tab;
  _selectedEntity = null;
  refreshReports();
}

/** @param {string} entityType @param {string} entityId */
export function setReportEntity(entityType, entityId) {
  if (entityType === 'user') {
    const u = getUserWithPoints(entityId);
    _selectedEntity = u ? { type: 'user', id: entityId, name: u.name } : null;
  } else {
    const t = getTeams()[entityId];
    _selectedEntity = t ? { type: 'team', id: entityId, name: t.name } : null;
  }
  hideSearchResults();
  refreshReports();
}

export function clearReportEntity() {
  _selectedEntity = null;
  const input = document.getElementById('reportsSearch');
  if (input) input.value = '';
  refreshReports();
}

export function filterReportEntities() {
  const query = (document.getElementById('reportsSearch')?.value || '').toLowerCase();
  if (!query) { hideSearchResults(); return; }
  renderSearchResults(query);
}

// ── Main refresh ───────────────────────────────────────────────────

export function refreshReports() {
  updateAllTeamPoints();
  updateSubTabUI();
  updateFilterIndicator();
  updateSearchPlaceholder();

  const activities = getReportActivities();
  renderSummaryMetrics(activities);
  renderYtdChart(activities);
  renderCourseChart(activities);
}

// ── Sub-tab UI ─────────────────────────────────────────────────────

function updateSubTabUI() {
  const hasTeams = Object.keys(getTeams()).length > 0;
  const teamsBtn = document.getElementById('reportsSubTabTeams');
  if (teamsBtn) teamsBtn.style.display = hasTeams ? '' : 'none';
  if (_subTab === 'teams' && !hasTeams) _subTab = 'users';

  document.querySelectorAll('#reportsSubTabs .tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _subTab);
  });
}

function updateSearchPlaceholder() {
  const input = document.getElementById('reportsSearch');
  if (input) input.placeholder = _subTab === 'users' ? 'Search users...' : 'Search teams...';
}

// ── Filter indicator ───────────────────────────────────────────────

function updateFilterIndicator() {
  const el = document.getElementById('reportsFilterIndicator');
  if (!el) return;
  if (_selectedEntity) {
    el.innerHTML = `<span class="cc-pill" style="background:var(--cc-accent-light);color:var(--cc-accent);">${esc(_selectedEntity.name)} <button data-action="clearReportEntity" style="margin-left:0.25rem;cursor:pointer;font-weight:700;">&times;</button></span>`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

// ── Filtered activities ────────────────────────────────────────────

function getReportActivities() {
  const yearPrefix = getCurrentYearPrefix();
  let activities = getActivities().filter(
    a => a.completedDate?.startsWith(yearPrefix) && (!a.status || a.status === 'completed'),
  );

  if (_selectedEntity?.type === 'user') {
    activities = activities.filter(a => (a.userId || a.userEmail) === _selectedEntity.id);
  } else if (_selectedEntity?.type === 'team') {
    const team = getTeams()[_selectedEntity.id];
    const members = new Set(team?.members || []);
    activities = activities.filter(a => members.has(a.userId || a.userEmail));
  }
  return activities;
}

// ── Summary metrics ────────────────────────────────────────────────

function renderSummaryMetrics(activities) {
  const el = document.getElementById('reportsSummary');
  if (!el) return;
  const pts = activities.reduce((s, a) => s + a.pointsEarned, 0);
  const types = new Set(activities.map(a => a.courseType)).size;

  el.innerHTML = `
    <div class="cc-metric"><div class="cc-metric-label">Activities (YTD)</div><div class="cc-metric-value">${formatNumber(activities.length)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Points (YTD)</div><div class="cc-metric-value">${formatNumber(pts)}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Course Types</div><div class="cc-metric-value">${types}</div></div>
    <div class="cc-metric"><div class="cc-metric-label">Avg Points/Activity</div><div class="cc-metric-value">${activities.length > 0 ? formatNumber(Math.round(pts / activities.length)) : 0}</div></div>
  `;
}

// ── YTD bar chart ──────────────────────────────────────────────────

function renderYtdChart(activities) {
  const canvas = document.getElementById('ytdChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_ytdChart) { _ytdChart.destroy(); _ytdChart = null; }

  const { labels, data } = buildMonthlyData(activities);
  _ytdChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Points', data, backgroundColor: PALETTE[0], borderRadius: 4 }],
    },
    options: chartOptions(false),
  });
}

// ── Course type doughnut ───────────────────────────────────────────

function renderCourseChart(activities) {
  const canvas = document.getElementById('courseChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (_courseChart) { _courseChart.destroy(); _courseChart = null; }

  const { labels, data } = buildCourseTypeData(activities);
  if (labels.length === 0) {
    _courseChart = null;
    return;
  }
  _courseChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: PALETTE.slice(0, labels.length) }],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 12 } } } } },
  });
}

// ── Data builders ──────────────────────────────────────────────────

function buildMonthlyData(activities) {
  const year = getCurrentYearPrefix();
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = months.map(prefix => {
    return activities.filter(a => a.completedDate?.startsWith(prefix))
      .reduce((s, a) => s + a.pointsEarned, 0);
  });
  return { labels, data };
}

function buildCourseTypeData(activities) {
  const map = {};
  activities.forEach(a => { const t = a.courseType || 'Unknown'; map[t] = (map[t] || 0) + a.pointsEarned; });
  const sorted = Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8);
  return { labels: sorted.map(([t]) => t), data: sorted.map(([, v]) => v) };
}

function chartOptions(showLegend) {
  return {
    responsive: true,
    plugins: { legend: { display: showLegend } },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
  };
}

// ── Search ─────────────────────────────────────────────────────────

function renderSearchResults(query) {
  const container = document.getElementById('reportsSearchResults');
  if (!container) return;
  let items = [];

  if (_subTab === 'users') {
    items = Object.values(getUsers())
      .filter(u => u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query))
      .slice(0, 8)
      .map(u => ({ id: u.email, name: u.name, sub: u.email, type: 'user' }));
  } else {
    items = Object.values(getTeams())
      .filter(t => t.name?.toLowerCase().includes(query))
      .slice(0, 8)
      .map(t => ({ id: t.id, name: t.name, sub: `${(t.members || []).length} members`, type: 'team' }));
  }

  if (items.length === 0) {
    container.innerHTML = '<div class="px-3 py-2 text-sm" style="color:var(--cc-text-muted);">No results</div>';
  } else {
    container.innerHTML = items.map(it => `
      <div data-action="setReportEntity" data-entity-type="${it.type}" data-entity-id="${esc(it.id)}"
           class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50" style="color:var(--cc-text);">
        <div class="font-medium">${esc(it.name)}</div>
        <div class="text-xs" style="color:var(--cc-text-muted);">${esc(it.sub)}</div>
      </div>
    `).join('');
  }
  container.style.display = '';
}

function hideSearchResults() {
  const el = document.getElementById('reportsSearchResults');
  if (el) el.style.display = 'none';
}
