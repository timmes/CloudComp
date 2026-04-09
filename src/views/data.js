/**
 * @module views/data
 *
 * Data lifecycle: load, export, JSON import.
 */

import {
  getUsers, getActivities, getTeams,
  loadFromStorage, exportJSON, importJSON,
  log, updateDataStatus, downloadJSON,
} from './shared.js';

let loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable;
export function _setRefreshFns(fns) {
  ({ loadConfiguration, refreshDashboard, refreshUsersTable, refreshActivitiesTable, refreshTeamsTable } = fns);
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

export function exportData() {
  try {
    const dataToExport = exportJSON();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJSON(dataToExport, `cloud_comp_data_${timestamp}.json`);
    log('Data exported to JSON file');
  } catch (error) {
    log(`Error exporting data: ${error.message}`);
    alert('Error exporting data. Please try again.');
  }
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

      const teamsCount = importedData.teams ? Object.keys(importedData.teams).length : 0;
      const inProgressCount = importedData.inProgressActivities ? importedData.inProgressActivities.length : 0;
      const msg = `This will replace all current data.\n\n- ${Object.keys(importedData.users).length} users\n- ${teamsCount} teams\n- ${importedData.activities.length} completed activities\n- ${inProgressCount} in-progress activities\n\nContinue?`;
      if (!confirm(msg)) return;

      importJSON(importedData);

      if (loadConfiguration) loadConfiguration();
      if (refreshDashboard) refreshDashboard();
      if (refreshUsersTable) refreshUsersTable();
      if (refreshActivitiesTable) refreshActivitiesTable();
      if (refreshTeamsTable) refreshTeamsTable();

      closeImportDataModal();
      const users = getUsers();
      const teams = getTeams();
      const activities = getActivities();
      log(`Data imported successfully: ${Object.keys(users).length} users, ${Object.keys(teams).length} teams, ${activities.length} completed`);
    } catch (error) {
      alert(`Error importing data: ${error.message}`);
      log(`Error importing data: ${error.message}`);
    }
  };
  reader.readAsText(file);
}
