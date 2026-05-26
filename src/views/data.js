/**
 * @module views/data
 *
 * Data lifecycle: load, full-data export, full-data JSON import.
 * Both export and import write a record to history so the user has
 * an auditable trail of backups + restores in the Configuration tab.
 */

import {
  getUsers, getActivities, getTeams, getCampaigns,
  loadFromStorage, exportJSON, importJSON,
  addImportHistoryEntry, addExportHistoryEntry,
  log, updateDataStatus, downloadJSON,
} from './shared.js';

let loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable, refreshHistoryTables;
export function _setRefreshFns(fns) {
  ({ loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable, refreshHistoryTables } = fns);
}

export function loadData() {
  try {
    loadFromStorage();
    const users = getUsers();
    const activities = getActivities();
    const teams = getTeams();
    const userCount = Object.keys(users).length;
    const teamCount = Object.keys(teams).length;
    if (userCount > 0 || activities.length > 0) {
      updateDataStatus('success', `Data loaded: ${userCount} users, ${teamCount} teams, ${activities.length} activities`);
      if (loadConfiguration) loadConfiguration();
      if (refreshDashboard) refreshDashboard();
      log('Data loaded successfully from browser storage');
    } else {
      updateDataStatus('warning', 'No existing data found - ready for first import');
      log('No existing data found, starting with empty dataset');
    }
  } catch (error) {
    updateDataStatus('error', 'Error loading data');
    log(`Error loading data: ${error.message}`);
  }
}

// ── Export all data ─────────────────────────────────────────────────

/**
 * Export the full app state (users, teams, activities, campaigns,
 * config, history) as a single JSON file that can later be re-imported.
 * Records an entry in the export history for the Configuration tab.
 */
export function openExportDataModal() {
  const users = getUsers();
  const teams = getTeams();
  const activities = getActivities();
  const campaigns = getCampaigns();

  document.getElementById('exportDataUsers').textContent = Object.keys(users).length;
  document.getElementById('exportDataTeams').textContent = Object.keys(teams).length;
  document.getElementById('exportDataActivities').textContent = activities.length;
  document.getElementById('exportDataCampaigns').textContent = Object.keys(campaigns).length;
  document.getElementById('exportDataModal').classList.remove('hidden');
}

export function closeExportDataModal() {
  document.getElementById('exportDataModal').classList.add('hidden');
}

export function confirmExportData() {
  try {
    const dataToExport = exportJSON();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cloud_comp_data_${timestamp}.json`;

    // downloadJSON serialises identically — measure size so the history
    // entry shows something useful next to the row.
    const sizeBytes = JSON.stringify(dataToExport, null, 2).length;

    downloadJSON(dataToExport, filename);

    addExportHistoryEntry({
      filename,
      date: new Date().toISOString(),
      stats: {
        users: Object.keys(dataToExport.users || {}).length,
        teams: Object.keys(dataToExport.teams || {}).length,
        activities: (dataToExport.activities || []).length,
        campaigns: Object.keys(dataToExport.campaigns || {}).length,
        sizeBytes,
      },
    });
    if (refreshHistoryTables) refreshHistoryTables();

    closeExportDataModal();
    log(`Exported all data to ${filename}`);
  } catch (error) {
    log(`Error exporting data: ${error.message}`);
    alert('Error exporting data. Please try again.');
  }
}

// ── Import all data ─────────────────────────────────────────────────

export function openImportDataModal() {
  document.getElementById('importDataFile').value = '';
  document.getElementById('importDataModal').classList.remove('hidden');
}

export function closeImportDataModal() {
  document.getElementById('importDataModal').classList.add('hidden');
  document.getElementById('importDataFile').value = '';
}

export function processImportData() {
  const fileInput = document.getElementById('importDataFile');
  const file = fileInput.files[0];

  if (!file) { alert('Please select a JSON file to import'); return; }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (!importedData.users || !importedData.activities) {
        alert('Invalid data file format.'); return;
      }

      const usersCount = Object.keys(importedData.users).length;
      const teamsCount = importedData.teams ? Object.keys(importedData.teams).length : 0;
      const campaignsCount = importedData.campaigns ? Object.keys(importedData.campaigns).length : 0;
      const activitiesCount = importedData.activities.length;

      const msg = `This will replace all current data.\n\n- ${usersCount} users\n- ${teamsCount} teams\n- ${activitiesCount} activities\n- ${campaignsCount} campaigns\n\nContinue?`;
      if (!confirm(msg)) return;

      importJSON(importedData);

      // After importJSON the history slice now reflects whatever the
      // imported file carried (or empty). Record the restore as its own
      // entry so the user can see when they last replaced their data.
      addImportHistoryEntry({
        filename: file.name,
        date: new Date().toISOString(),
        type: 'data-restore',
        stats: {
          users: usersCount,
          teams: teamsCount,
          activities: activitiesCount,
          campaigns: campaignsCount,
        },
      });

      if (loadConfiguration) loadConfiguration();
      if (refreshDashboard) refreshDashboard();
      if (refreshUsersTable) refreshUsersTable();
      if (refreshActivitiesTable) refreshActivitiesTable();
      if (refreshTeamsTable) refreshTeamsTable();
      if (refreshHistoryTables) refreshHistoryTables();

      closeImportDataModal();
      log(`Data imported from ${file.name}: ${usersCount} users, ${teamsCount} teams, ${activitiesCount} activities`);
    } catch (error) {
      alert(`Error importing data: ${error.message}`);
      log(`Error importing data: ${error.message}`);
    }
  };
  reader.readAsText(file);
}
