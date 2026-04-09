/**
 * @module views/tabs
 */

import { bulkSelection } from './shared.js';
import { refreshDashboard } from './dashboard.js';
import { refreshUsersTable } from './users.js';
import { refreshActivitiesTable } from './activities.js';
import { refreshTeamsTable, updateTeamSortButtons } from './teams.js';

export function showTab(tabName) {
  bulkSelection.users.clear();
  bulkSelection.activities.clear();

  const uc = document.getElementById('selectAllUsersCheckbox');
  if (uc) uc.checked = false;
  const ac = document.getElementById('selectAllActivitiesCheckbox');
  if (ac) ac.checked = false;

  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

  document.getElementById(tabName + 'Section').classList.remove('hidden');
  const tb = document.getElementById(tabName + 'Tab');
  if (tb) tb.classList.add('active');

  switch (tabName) {
    case 'dashboard':  refreshDashboard(); break;
    case 'users':      refreshUsersTable(); break;
    case 'activities': refreshActivitiesTable(); break;
    case 'teams':      refreshTeamsTable(); updateTeamSortButtons(); break;
    case 'manual':     window.scrollTo(0, 0); break;
  }
}
