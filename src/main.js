/**
 * @module main
 *
 * Application entry point. Uses delegated event listeners on
 * data-action attributes — no window globals needed.
 */

import './styles/design-tokens.css';
import { scrollToSection, selectedFiles } from './views/shared.js';
import { toggleTheme } from './views/theme.js';
import {
  loadData, closeImportDataModal, processImportData, openImportDataModal,
  openExportDataModal, closeExportDataModal, confirmExportData,
  _setRefreshFns as setDataRefs,
} from './views/data.js';
import {
  refreshDashboard, setDashboardSubTab, setDashboardTimePeriod,
  setDashboardCourseTypeFilter, clearDashboardCourseTypeFilter,
  setDashboardCampaign,
} from './views/dashboard.js';
import { showTab } from './views/tabs.js';
import {
  refreshUsersTable, toggleUserSelection, toggleSelectAllUsers, selectAllUsers, deselectAllUsers,
  addManualPoints, closeAddPointsModal, submitManualPoints, filterManualPointsUsers, selectManualPointsUser,
  onActivityTypePicked,
  filterUsers, toggleUserSort, toggleUserSortOrder,
  bulkAwardPoints, closeBulkAwardPointsModal, submitBulkAwardPoints,
  bulkAssignTeam, closeBulkAssignTeamModal, submitBulkAssignTeam, bulkExportUsers,
  updateUserSortButtons, _setRefreshFns as setUserRefs,
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
  bulkDeleteActivities, bulkExportActivities,
  filterActivities, toggleActivitySort, toggleActivitySortOrder, updateActivitySortButtons,
  _setRefreshFns as setActivityRefs,
} from './views/activities.js';
import {
  refreshCampaignsTable, openCreateCampaignModal, closeCampaignModal, saveCampaign,
  openEditCampaignModal, deleteCampaignAction, viewCampaign, closeCampaignDetail,
  setCampaignStatus, filterCampaigns, toggleCampaignSort, toggleCampaignSortOrder,
  updateCampaignSortButtons, _setRefreshFns as setCampaignRefs,
} from './views/campaigns.js';
import { updatePointConfig, loadConfiguration, saveConfiguration, openResetDataModal, closeResetDataModal, confirmResetAllData, refreshHistoryTables } from './views/config.js';
import { processAllFiles, updateFileList, _setRefreshFns as setImportRefs } from './views/import.js';
import {
  clickSignupFile, signupFileChosen, closeSignupCampaignModal, submitSignupImport,
  _setRefreshFns as setSignupRefs,
} from './views/signups.js';
import {
  setReportsSubTab, setReportEntity, clearReportEntity, filterReportEntities,
  refreshReports,
} from './views/reports.js';

// ── Wire cross-module references ────────────────────────────────────

setDataRefs({ loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable, refreshHistoryTables });
setUserRefs({ refreshDashboard, refreshActivitiesTable, refreshTeamsTable });
setTeamRefs({ refreshDashboard });
setActivityRefs({ refreshDashboard, refreshUsersTable, refreshTeamsTable });
setCampaignRefs({ refreshDashboard });
setImportRefs({ refreshDashboard, refreshHistoryTables });
setSignupRefs({ refreshDashboard, refreshHistoryTables, refreshCampaignsTable, refreshUsersTable });

// ── Action dispatch map ─────────────────────────────────────────────

const ACTIONS = {
  showTab:                    (el) => showTab(el.dataset.tab),
  scrollToSection:            (el, e) => scrollToSection(e, el.dataset.section),
  toggleTheme,
  // Dashboard
  setDashboardSubTab:          (el) => setDashboardSubTab(el.dataset.tab),
  setDashboardTimePeriod:      (el) => setDashboardTimePeriod(el.dataset.period),
  setDashboardCourseTypeFilter: (el) => setDashboardCourseTypeFilter(el.dataset.courseType),
  clearDashboardCourseTypeFilter,
  setDashboardCampaign:        (el) => setDashboardCampaign(el.value),
  clickCourseFiles:           () => document.getElementById('courseFiles').click(),
  clickTeamsFiles:            () => document.getElementById('teamsFiles').click(),
  clickSignupFile,
  closeSignupCampaignModal,
  submitSignupImport,
  processAllFiles,
  processImportData,
  closeImportDataModal,
  openImportDataModal,
  openExportDataModal,
  closeExportDataModal,
  confirmExportData,
  // Users
  addManualPoints,
  closeAddPointsModal,
  submitManualPoints,
  filterManualPointsUsers,
  selectManualPointsUser:   (el) => selectManualPointsUser(el.dataset.email, el.dataset.name),
  onActivityTypePicked,
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
  // Campaigns
  openCreateCampaignModal,
  closeCampaignModal,
  saveCampaign,
  openEditCampaignModal:    (el) => openEditCampaignModal(el.dataset.campaignId),
  deleteCampaign:           (el) => deleteCampaignAction(el.dataset.campaignId),
  viewCampaign:             (el) => viewCampaign(el.dataset.campaignId),
  closeCampaignDetail,
  setCampaignStatus:        (el) => setCampaignStatus(el.dataset.campaignId, el.dataset.status),
  filterCampaigns,
  toggleCampaignSort:       (el) => toggleCampaignSort(el.dataset.field),
  toggleCampaignSortOrder,
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
  toggleActivitySelection:    (el) => toggleActivitySelection(el.dataset.activityId),
  // Config
  updatePointConfig,
  saveConfiguration,
  openResetDataModal,
  closeResetDataModal,
  confirmResetAllData,
  // Reports
  setReportsSubTab:        (el) => setReportsSubTab(el.dataset.tab),
  setReportEntity:         (el) => setReportEntity(el.dataset.entityType, el.dataset.entityId),
  clearReportEntity,
  filterReportEntities,
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
  document.getElementById('signupFile').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) signupFileChosen(file);
  });

  loadData();

  setTimeout(() => {
    updateUserSortButtons();
    updateActivitySortButtons();
    updateTeamSortButtons();
    updateCampaignSortButtons();
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
