/**
 * @module views/dashboard
 *
 * Dashboard rendering: stats cards, leaderboards, recent activities, charts.
 */

import { getUsersWithPoints, getUserWithPoints, getActivities, getTeams, getCurrentMonth, formatNumber, formatDate, esc } from './shared.js';
import { updateAllTeamPoints } from './teams.js';

export function refreshDashboard() {
  const currentMonth = getCurrentMonth();
  const users = getUsersWithPoints();
  const activities = getActivities();
  const teams = getTeams();

  document.getElementById('totalUsers').textContent = formatNumber(Object.keys(users).length);
  document.getElementById('completedActivities').textContent = formatNumber(activities.length);
  document.getElementById('inProgressActivities').textContent = '0';
  document.getElementById('totalTeams').textContent = formatNumber(Object.keys(teams).length);

  const totalPoints = Object.values(users).reduce((sum, u) => sum + (u.totalPoints || 0), 0);
  document.getElementById('totalPointsAwarded').textContent = formatNumber(totalPoints);

  const currentMonthActivities = activities.filter(a => a.monthYear === currentMonth).length;
  document.getElementById('currentMonthActivities').textContent = formatNumber(currentMonthActivities);

  updateLeaderboard();
  updateTeamLeaderboard();
  updateRecentActivities();
  updateActivityCharts();
}

function updateLeaderboard() {
  const leaderboard = Object.values(getUsersWithPoints())
    .filter(user => user.currentMonthPoints > 0)
    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
    .slice(0, 10);

  document.getElementById('leaderboardBody').innerHTML = leaderboard.map((user, i) => `
    <tr class="${i < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'hover:bg-gray-50'}">
      <td class="px-4 py-3">
        <span class="font-bold ${i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-600' : i === 2 ? 'text-orange-600' : 'text-gray-800'}">
          ${i + 1}${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="font-medium text-gray-900">${esc(user.name)}</div>
        <div class="text-sm text-gray-500">${esc(user.email)}</div>
      </td>
      <td class="px-4 py-3"><span class="font-bold text-purple-600">${formatNumber(user.currentMonthPoints)}</span></td>
    </tr>
  `).join('');
}

function updateTeamLeaderboard() {
  updateAllTeamPoints();
  const teams = Object.values(getTeams())
    .filter(t => t.currentMonthPoints > 0)
    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
    .slice(0, 5);

  const tbody = document.getElementById('teamLeaderboardBody');
  if (teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500 text-sm">No team activity this month</td></tr>`;
    return;
  }

  tbody.innerHTML = teams.map((team, i) => {
    const cc = { blue:'bg-blue-100 text-blue-800',green:'bg-green-100 text-green-800',purple:'bg-purple-100 text-purple-800',orange:'bg-orange-100 text-orange-800',pink:'bg-pink-100 text-pink-800',teal:'bg-teal-100 text-teal-800',indigo:'bg-indigo-100 text-indigo-800',red:'bg-red-100 text-red-800' }[team.color] || 'bg-gray-100 text-gray-800';
    return `
      <tr class="${i < 3 ? 'bg-gradient-to-r from-teal-50 to-cyan-50' : 'hover:bg-gray-50'}">
        <td class="px-4 py-3"><span class="font-bold ${i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-600' : i === 2 ? 'text-orange-600' : 'text-gray-800'}">${i + 1}${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : ''}</span></td>
        <td class="px-4 py-3"><div class="flex items-center"><span class="px-2 py-1 text-xs rounded-full ${cc} mr-2">${esc(team.name.substring(0, 2).toUpperCase())}</span><div class="font-medium text-gray-900">${esc(team.name)}</div></div></td>
        <td class="px-4 py-3"><span class="text-gray-600">${(team.members || team.memberIds || []).length}</span></td>
        <td class="px-4 py-3"><span class="font-bold text-teal-600">${formatNumber(team.currentMonthPoints)}</span></td>
      </tr>`;
  }).join('');
}

function updateRecentActivities() {
  const activities = [...getActivities()]
    .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
    .slice(0, 10);

  document.getElementById('recentActivities').innerHTML = activities.map(a => {
    const user = getUserWithPoints(a.userEmail || a.userId);
    return `
      <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div class="flex-1">
          <div class="font-medium text-gray-900">${esc(user?.name || a.userEmail || a.userId)}</div>
          <div class="text-sm text-gray-600">${esc(a.title)}</div>
          <div class="text-xs text-gray-500">${esc(formatDate(a.completedDate))}</div>
        </div>
        <div class="text-right">
          <div class="font-bold text-purple-600">+${a.pointsEarned}</div>
          <div class="text-xs text-gray-500">${esc(a.courseType)}</div>
        </div>
      </div>`;
  }).join('');
}

function updateActivityCharts() {
  const activities = getActivities();
  const courseTypes = {};
  activities.forEach(a => { const t = a.courseType || 'Unknown'; courseTypes[t] = (courseTypes[t] || 0) + 1; });
  const top5 = Object.entries(courseTypes).sort(([,a],[,b]) => b - a).slice(0, 5);

  document.getElementById('activityCharts').innerHTML = `
    <div class="text-center">
      <h4 class="font-medium text-gray-900 mb-3">Top Course Types</h4>
      <div class="space-y-2">${top5.map(([t, c]) => `<div class="flex justify-between items-center"><span class="text-sm text-gray-600 truncate">${esc(t)}</span><span class="font-medium text-blue-600">${c}</span></div>`).join('')}</div>
    </div>
    <div class="text-center">
      <h4 class="font-medium text-gray-900 mb-3">Monthly Activity</h4>
      <div class="text-3xl font-bold text-green-600">${activities.filter(a => a.monthYear === getCurrentMonth()).length}</div>
      <div class="text-sm text-gray-500">This Month</div>
    </div>
    <div class="text-center">
      <h4 class="font-medium text-gray-900 mb-3">Completion Rate</h4>
      <div class="text-3xl font-bold text-purple-600">${activities.length > 0 ? 100 : 0}%</div>
      <div class="text-sm text-gray-500">Activities Completed</div>
    </div>`;
}
