/**
 * @module views/reports
 *
 * Report generation and monthly reset.
 */

import {
  getUsers, getActivities, getTeams, getConfig,
  getUsersWithPoints,
  upsertUser, updateConfig,
  log, getCurrentMonth, downloadJSON,
} from './shared.js';

let refreshDashboard, refreshUsersTable;
export function _setRefreshFns(fns) { ({ refreshDashboard, refreshUsersTable } = fns); }

export function generateLeaderboardReport() {
  const currentMonth = getCurrentMonth();
  const leaderboard = Object.values(getUsersWithPoints())
    .filter(u => u.currentMonthPoints > 0)
    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints);

  downloadJSON({
    title: `Leaderboard Report - ${currentMonth}`, generated: new Date().toISOString(),
    data: leaderboard.map((u, i) => ({ rank: i + 1, name: u.name, email: u.email, currentMonthPoints: u.currentMonthPoints, totalPoints: u.totalPoints, activities: u.activities?.length || 0 })),
  }, `cloud_comp_leaderboard_${currentMonth}.json`);
}

export function generateActivityReport() {
  downloadJSON({
    title: 'Activity Report', generated: new Date().toISOString(),
    data: getActivities().map(a => {
      const u = getUsers()[a.userEmail || a.userId];
      return { user: u?.name || a.userEmail || a.userId, email: a.userEmail || a.userId, activity: a.title, courseType: a.courseType, level: a.level, points: a.pointsEarned, completedDate: a.completedDate, source: a.source };
    }),
  }, `cloud_comp_activities_${new Date().toISOString().slice(0, 10)}.json`);
}

export function generateSummaryReport() {
  const currentMonth = getCurrentMonth();
  const users = getUsersWithPoints();
  const activities = getActivities();
  const teams = getTeams();
  downloadJSON({
    title: 'Summary Report', generated: new Date().toISOString(),
    summary: {
      totalUsers: Object.keys(users).length, totalTeams: Object.keys(teams).length,
      totalActivities: activities.length,
      totalPoints: Object.values(users).reduce((s, u) => s + (u.totalPoints || 0), 0),
      currentMonthActivities: activities.filter(a => a.monthYear === currentMonth).length,
      currentMonthPoints: Object.values(users).reduce((s, u) => s + (u.currentMonthPoints || 0), 0),
    },
    topUsers: Object.values(users).sort((a, b) => b.currentMonthPoints - a.currentMonthPoints).slice(0, 10)
      .map(u => ({ name: u.name, email: u.email, currentMonthPoints: u.currentMonthPoints, totalPoints: u.totalPoints })),
    topTeams: Object.values(teams).sort((a, b) => b.currentMonthPoints - a.currentMonthPoints).slice(0, 5)
      .map(t => ({ name: t.name, members: (t.members||[]).length, currentMonthPoints: t.currentMonthPoints, totalPoints: t.totalPoints })),
  }, `cloud_comp_summary_${new Date().toISOString().slice(0, 10)}.json`);
}

export function resetMonthlyLeaderboard() {
  if (!confirm('Are you sure you want to reset the monthly leaderboard?')) return;
  const currentMonth = getCurrentMonth();
  const users = getUsersWithPoints();

  downloadJSON({
    month: currentMonth, resetDate: new Date().toISOString(),
    leaderboard: Object.values(users).filter(u => u.currentMonthPoints > 0)
      .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
      .map(u => ({ name: u.name, email: u.email, points: u.currentMonthPoints })),
  }, `cloud_comp_leaderboard_archive_${currentMonth}.json`);

  // Points are derived from the activity log — no need to zero them.
  // The archive download above captures the current standings.
  updateConfig({ ...getConfig(), lastReset: currentMonth });

  if (refreshDashboard) refreshDashboard();
  if (refreshUsersTable) refreshUsersTable();
  log(`Monthly leaderboard reset for ${currentMonth}`);
}

export function confirmMonthlyReset() { resetMonthlyLeaderboard(); }
