/**
 * @module main
 *
 * Application entry point. Uses delegated event listeners on
 * data-action attributes — no window globals needed.
 */

import { scrollToSection, selectedFiles } from './views/shared.js';
import { loadData, exportData, closeImportDataModal, processImportData, _setRefreshFns as setDataRefs } from './views/data.js';
import { refreshDashboard } from './views/dashboard.js';
import { showTab } from './views/tabs.js';
import {
  refreshUsersTable, toggleUserSelection, toggleSelectAllUsers, selectAllUsers, deselectAllUsers,
  addManualPoints, closeAddPointsModal, submitManualPoints, filterUsers, toggleUserSort, toggleUserSortOrder,
  bulkAwardPoints, closeBulkAwardPointsModal, submitBulkAwardPoints,
  bulkAssignTeam, closeBulkAssignTeamModal, submitBulkAssignTeam, bulkExportUsers,
  viewUserDetails, updateUserSortButtons, _setRefreshFns as setUserRefs,
} from './views/users.js';
import {
  createTeam, openCreateTeamModal, closeCreateTeamModal,
  openManageTeamMembers, closeManageTeamMembersModal, addUsersToTeam, removeUserFromTeam, deleteTeam,
  refreshTeamsTable, updateTeamSortButtons, filterTeams, toggleTeamSort, toggleTeamSortOrder,
  _setRefreshFns as setTeamRefs,
} from './views/teams.js';
import {
  refreshActivitiesTable, toggleActivitySelection, toggleSelectAllActivities, selectAllActivities, deselectAllActivities,
  bulkAdjustPoints, closeBulkAdjustPointsModal, submitBulkAdjustPoints,
  bulkDeleteActivities, bulkExportActivities, editActivity,
  filterActivities, toggleActivitySort, toggleActivitySortOrder, updateActivitySortButtons,
  _setRefreshFns as setActivityRefs,
} from './views/activities.js';
import { updatePointConfig, loadConfiguration, resetToDefaults, saveConfiguration, exportConfig } from './views/config.js';
import { processAllFiles, updateFileList, _setRefreshFns as setImportRefs } from './views/import.js';
import {
  generateLeaderboardReport, generateActivityReport, generateSummaryReport,
  resetMonthlyLeaderboard, confirmMonthlyReset, _setRefreshFns as setReportRefs,
} from './views/reports.js';

// ── Wire cross-module references ────────────────────────────────────

setDataRefs({ loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable });
setUserRefs({ refreshDashboard, refreshActivitiesTable, refreshTeamsTable });
setTeamRefs({ refreshDashboard });
setActivityRefs({ refreshDashboard, refreshUsersTable, refreshTeamsTable });
setImportRefs({ refreshDashboard });
setReportRefs({ refreshDashboard, refreshUsersTable });

// ── Action dispatch map ─────────────────────────────────────────────

const ACTIONS = {
  showTab:                    (el) => showTab(el.dataset.tab),
  scrollToSection:            (el, e) => scrollToSection(e, el.dataset.section),
  exportData,
  clickCourseFiles:           () => document.getElementById('courseFiles').click(),
  clickTeamsFiles:            () => document.getElementById('teamsFiles').click(),
  processAllFiles,
  processImportData,
  closeImportDataModal,
  // Users
  addManualPoints,
  closeAddPointsModal,
  submitManualPoints,
  filterUsers,
  toggleUserSort:             (el) => toggleUserSort(el.dataset.field),
  toggleUserSortOrder,
  toggleSelectAllUsers,
  selectAllUsers,
  deselectAllUsers,
  bulkAwardPoints,
  closeBulkAwardPointsModal,
  submitBulkAwardPoints,
  bulkAssignTeam,
  closeBulkAssignTeamModal,
  submitBulkAssignTeam,
  bulkExportUsers,
  viewUserDetails:            (el) => viewUserDetails(el.dataset.email),
  toggleUserSelection:        (el) => toggleUserSelection(el.dataset.email),
  // Teams
  openCreateTeamModal,
  closeCreateTeamModal,
  createTeam,
  openManageTeamMembers:      (el) => openManageTeamMembers(el.dataset.teamId),
  closeManageTeamMembersModal,
  addUsersToTeam,
  removeUserFromTeam:         (el) => removeUserFromTeam(el.dataset.teamId, el.dataset.email),
  deleteTeam:                 (el) => deleteTeam(el.dataset.teamId),
  filterTeams,
  toggleTeamSort:             (el) => toggleTeamSort(el.dataset.field),
  toggleTeamSortOrder,
  // Activities
  filterActivities,
  toggleActivitySort:         (el) => toggleActivitySort(el.dataset.field),
  toggleActivitySortOrder,
  toggleSelectAllActivities,
  selectAllActivities,
  deselectAllActivities,
  bulkAdjustPoints,
  closeBulkAdjustPointsModal,
  submitBulkAdjustPoints,
  bulkDeleteActivities,
  bulkExportActivities,
  editActivity:               (el) => editActivity(el.dataset.activityId),
  toggleActivitySelection:    (el) => toggleActivitySelection(el.dataset.activityId),
  // Config
  updatePointConfig,
  resetToDefaults,
  saveConfiguration,
  exportConfig,
  // Reports
  generateLeaderboardReport,
  generateActivityReport,
  generateSummaryReport,
  resetMonthlyLeaderboard,
  confirmMonthlyReset,
};

// ── Delegated event listeners ───────────────────────────────────────

function handleAction(event) {
  const el = event.target.closest('[data-action]');
  if (!el) return;

  const trigger = el.dataset.trigger;
  if (trigger && trigger !== event.type) return;

  const action = ACTIONS[el.dataset.action];
  if (action) action(el, event);
}

document.addEventListener('click', handleAction);
document.addEventListener('change', handleAction);
document.addEventListener('keyup', handleAction);

// ── Bootstrap ───────────────────────────────────────────────────────

function initApp() {
  document.getElementById('courseFiles').addEventListener('change', (e) => {
    selectedFiles.course = Array.from(e.target.files);
    updateFileList('course', selectedFiles.course);
  });
  document.getElementById('teamsFiles').addEventListener('change', (e) => {
    selectedFiles.teams = Array.from(e.target.files);
    updateFileList('teams', selectedFiles.teams);
  });

  loadData();

  setTimeout(() => {
    updateUserSortButtons();
    updateActivitySortButtons();
    updateTeamSortButtons();
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
