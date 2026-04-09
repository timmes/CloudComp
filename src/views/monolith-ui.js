        // Global state — provided by bridge.js via window.appData
        const appData = window.appData;

        let selectedFiles = {
            course: [],
            teams: []
        };

        // Bulk selection tracking
        let bulkSelection = {
            users: new Set(),
            activities: new Set()
        };

        // Sort state management
        let sortState = {
            users: {
                field: 'currentMonthPoints',
                ascending: false // false = most points first (descending)
            },
            activities: {
                field: 'pointsEarned',
                ascending: false // false = most points first (descending)
            },
            teams: {
                field: 'currentMonthPoints',
                ascending: false // false = most points first (descending)
            }
        };

        // Utility functions
        function log(message) {
            const logElement = document.getElementById('importLog');
            if (logElement) {
                const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
                logElement.innerHTML += `[${timestamp}] ${message}\n`;
                logElement.scrollTop = logElement.scrollHeight;
            }
            console.log(message);
        }

        function getCurrentMonth() {
            return new Date().toISOString().slice(0, 7);
        }

        function formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString();
        }

        function formatNumber(num) {
            return num.toLocaleString();
        }

        // Smooth scroll for manual navigation
        function scrollToSection(event, sectionId) {
            event.preventDefault();
            const element = document.getElementById(sectionId);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // ── Data management — delegated to state.js via bridge ────────

        // state.js functions (provided by bridge on window)
        const _loadFromStorage = window.__stateAPI.loadFromStorage;
        const _exportJSON = window.__stateAPI.exportJSON;
        const _importJSON = window.__stateAPI.importJSON;

        function loadData() {
            try {
                _loadFromStorage();
                if (appData.users.size > 0 || appData.activities.length > 0) {
                    updateDataStatus('success', `Data loaded: ${appData.users.size} users, ${appData.teams.size} teams, ${appData.activities.length} activities`);
                    loadConfiguration();
                    refreshDashboard();
                    log('✅ Data loaded successfully from browser storage');
                } else {
                    updateDataStatus('warning', 'No existing data found - ready for first import');
                    log('ℹ️ No existing data found, starting with empty dataset');
                }
            } catch (error) {
                updateDataStatus('error', 'Error loading data');
                log(`❌ Error loading data: ${error.message}`);
            }
        }

        // state.js auto-persists on every write via upsertUser/addActivity/etc.
        // autoSave syncs any in-place config mutations back to state.js.
        function saveData() { return true; }
        function autoSave() {
            window.__stateAPI.updateConfig(appData.config);
            return true;
        }

        function exportData() {
            try {
                const dataToExport = _exportJSON();
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                downloadJSON(dataToExport, `cloud_comp_data_${timestamp}.json`);
                log('📥 Data exported to JSON file');
            } catch (error) {
                log(`❌ Error exporting data: ${error.message}`);
                alert('Error exporting data. Please try again.');
            }
        }

        function importData() {
            document.getElementById('importDataModal').classList.remove('hidden');
        }

        function closeImportDataModal() {
            document.getElementById('importDataModal').classList.add('hidden');
            document.getElementById('importDataFile').value = '';
        }

        function processImportData() {
            const fileInput = document.getElementById('importDataFile');
            const file = fileInput.files[0];

            if (!file) {
                alert('Please select a JSON file to import');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedData = JSON.parse(e.target.result);

                    if (!importedData.users || !importedData.activities) {
                        alert('Invalid data file format. Please select a valid cloud_comp_data_*.json file.');
                        return;
                    }

                    const teamsCount = importedData.teams ? Object.keys(importedData.teams).length : 0;
                    const inProgressCount = importedData.inProgressActivities ? importedData.inProgressActivities.length : 0;
                    const confirmMessage = `This will replace all current data with the imported data.\n\nImported data contains:\n- ${Object.keys(importedData.users).length} users\n- ${teamsCount} teams\n- ${importedData.activities.length} completed activities\n- ${inProgressCount} in-progress activities\n\nContinue?`;

                    if (!confirm(confirmMessage)) return;

                    _importJSON(importedData);

                    loadConfiguration();
                    refreshDashboard();
                    refreshUsersTable();
                    refreshActivitiesTable();
                    refreshTeamsTable();

                    closeImportDataModal();
                    log(`✅ Data imported successfully: ${appData.users.size} users, ${appData.teams.size} teams, ${appData.activities.length} completed`);
                } catch (error) {
                    alert(`Error importing data: ${error.message}`);
                    log(`❌ Error importing data: ${error.message}`);
                }
            };

            reader.readAsText(file);
        }

        function downloadJSON(data, filename) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        function updateDataStatus(type, message) {
            const statusElement = document.getElementById('dataStatus');
            const indicator = statusElement.querySelector('.status-indicator');
            
            indicator.className = `status-indicator status-${type}`;
            statusElement.querySelector('span').textContent = message;
        }

        // Tab management
        function showTab(tabName) {
            // Clear bulk selections when switching tabs
            bulkSelection.users.clear();
            bulkSelection.activities.clear();
            
            const usersCheckbox = document.getElementById('selectAllUsersCheckbox');
            if (usersCheckbox) usersCheckbox.checked = false;
            
            const activitiesCheckbox = document.getElementById('selectAllActivitiesCheckbox');
            if (activitiesCheckbox) activitiesCheckbox.checked = false;
            
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            
            // Remove active class from all buttons
            document.querySelectorAll('.tab-button').forEach(button => {
                button.classList.remove('active');
            });
            
            // Show selected tab and activate button
            document.getElementById(tabName + 'Section').classList.remove('hidden');
            
            // Only activate tab button if it exists (manual doesn't have a tab button in nav)
            const tabButton = document.getElementById(tabName + 'Tab');
            if (tabButton) {
                tabButton.classList.add('active');
            }
            
            // Refresh content based on tab
            switch(tabName) {
                case 'dashboard':
                    refreshDashboard();
                    break;
                case 'users':
                    refreshUsersTable();
                    break;
                case 'activities':
                    refreshActivitiesTable();
                    break;
                case 'teams':
                    refreshTeamsTable();
                    updateTeamSortButtons();
                    break;
                case 'manual':
                    // Scroll to top when opening manual
                    window.scrollTo(0, 0);
                    break;
            }
        }

        // Dashboard functions
        function refreshDashboard() {
            const currentMonth = getCurrentMonth();
            
            // Update stats
            document.getElementById('totalUsers').textContent = formatNumber(appData.users.size);
            document.getElementById('completedActivities').textContent = formatNumber(appData.activities.length);
            document.getElementById('inProgressActivities').textContent = formatNumber(appData.inProgressActivities.length);
            document.getElementById('totalTeams').textContent = formatNumber(appData.teams.size);
            
            const totalPoints = Array.from(appData.users.values()).reduce((sum, user) => sum + user.totalPoints, 0);
            document.getElementById('totalPointsAwarded').textContent = formatNumber(totalPoints);
            
            const currentMonthActivities = appData.activities.filter(a => a.monthYear === currentMonth).length;
            document.getElementById('currentMonthActivities').textContent = formatNumber(currentMonthActivities);
            
            // Update leaderboards
            updateLeaderboard();
            updateTeamLeaderboard();
            
            // Update recent activities
            updateRecentActivities();
            
            // Update activity charts
            updateActivityCharts();
        }

        function updateLeaderboard() {
            const currentMonth = getCurrentMonth();
            const leaderboard = Array.from(appData.users.values())
                .filter(user => user.currentMonthPoints > 0)
                .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
                .slice(0, 10);

            const tbody = document.getElementById('leaderboardBody');
            tbody.innerHTML = leaderboard.map((user, index) => `
                <tr class="${index < 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : 'hover:bg-gray-50'}">
                    <td class="px-4 py-3">
                        <span class="font-bold ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-600' : 'text-gray-800'}">
                            ${index + 1}${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                        </span>
                    </td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-gray-900">${user.name}</div>
                        <div class="text-sm text-gray-500">${user.email}</div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="font-bold text-purple-600">${formatNumber(user.currentMonthPoints)}</span>
                    </td>
                </tr>
            `).join('');
        }

        function updateTeamLeaderboard() {
            // Update all team points first
            updateAllTeamPoints();
            
            const teams = Array.from(appData.teams.values())
                .filter(team => team.currentMonthPoints > 0)
                .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
                .slice(0, 5); // Show top 5 teams
            
            const tbody = document.getElementById('teamLeaderboardBody');
            
            if (teams.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="px-4 py-3 text-center text-gray-500 text-sm">
                            No team activity this month
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = teams.map((team, index) => {
                const colorClass = {
                    blue: 'bg-blue-100 text-blue-800',
                    green: 'bg-green-100 text-green-800',
                    purple: 'bg-purple-100 text-purple-800',
                    orange: 'bg-orange-100 text-orange-800',
                    pink: 'bg-pink-100 text-pink-800',
                    teal: 'bg-teal-100 text-teal-800',
                    indigo: 'bg-indigo-100 text-indigo-800',
                    red: 'bg-red-100 text-red-800'
                }[team.color] || 'bg-gray-100 text-gray-800';
                
                return `
                    <tr class="${index < 3 ? 'bg-gradient-to-r from-teal-50 to-cyan-50' : 'hover:bg-gray-50'}">
                        <td class="px-4 py-3">
                            <span class="font-bold ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-600' : index === 2 ? 'text-orange-600' : 'text-gray-800'}">
                                ${index + 1}${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
                            </span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex items-center">
                                <span class="px-2 py-1 text-xs rounded-full ${colorClass} mr-2">
                                    ${team.name.substring(0, 2).toUpperCase()}
                                </span>
                                <div class="font-medium text-gray-900">${team.name}</div>
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-gray-600">${team.members.length}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="font-bold text-teal-600">${formatNumber(team.currentMonthPoints)}</span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function updateRecentActivities() {
            const recentActivities = appData.activities
                .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
                .slice(0, 10);

            const container = document.getElementById('recentActivities');
            container.innerHTML = recentActivities.map(activity => {
                const user = appData.users.get(activity.userEmail);
                return `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div class="flex-1">
                            <div class="font-medium text-gray-900">${user?.name || activity.userEmail}</div>
                            <div class="text-sm text-gray-600">${activity.title}</div>
                            <div class="text-xs text-gray-500">${formatDate(activity.completedDate)}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold text-purple-600">+${activity.pointsEarned}</div>
                            <div class="text-xs text-gray-500">${activity.courseType}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function updateActivityCharts() {
            const chartContainer = document.getElementById('activityCharts');
            
            // Course type distribution
            const courseTypes = {};
            appData.activities.forEach(activity => {
                const type = activity.courseType || 'Unknown';
                courseTypes[type] = (courseTypes[type] || 0) + 1;
            });

            const topCourseTypes = Object.entries(courseTypes)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);

            chartContainer.innerHTML = `
                <div class="text-center">
                    <h4 class="font-medium text-gray-900 mb-3">Top Course Types</h4>
                    <div class="space-y-2">
                        ${topCourseTypes.map(([type, count]) => `
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-600 truncate">${type}</span>
                                <span class="font-medium text-blue-600">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="text-center">
                    <h4 class="font-medium text-gray-900 mb-3">Monthly Activity</h4>
                    <div class="text-3xl font-bold text-green-600">${appData.activities.filter(a => a.monthYear === getCurrentMonth()).length}</div>
                    <div class="text-sm text-gray-500">This Month</div>
                </div>
                <div class="text-center">
                    <h4 class="font-medium text-gray-900 mb-3">Completion Rate</h4>
                    <div class="text-3xl font-bold text-purple-600">
                        ${appData.activities.length + appData.inProgressActivities.length > 0 ? 
                            Math.round((appData.activities.length / (appData.activities.length + appData.inProgressActivities.length)) * 100) : 0}%
                    </div>
                    <div class="text-sm text-gray-500">Activities Completed</div>
                </div>
            `;
        }

        // Team Management Functions
        function createTeam() {
            const name = document.getElementById('teamName').value.trim();
            const description = document.getElementById('teamDescription').value.trim();
            const color = document.getElementById('teamColor').value;
            
            if (!name) {
                alert('Please enter a team name');
                return;
            }
            
            // Check for duplicate team names
            const existingTeam = Array.from(appData.teams.values()).find(t => t.name.toLowerCase() === name.toLowerCase());
            if (existingTeam) {
                alert('A team with this name already exists');
                return;
            }
            
            const teamId = `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const team = {
                id: teamId,
                name: name,
                description: description,
                color: color,
                members: [], // Array of user emails
                createdDate: new Date().toISOString(),
                currentMonthPoints: 0,
                totalPoints: 0
            };
            
            appData.teams.set(teamId, team);
            
            closeCreateTeamModal();
            refreshTeamsTable(); // This will now apply current sorting
            refreshDashboard();
            autoSave();
            
            log(`✅ Team created: ${name}`);
        }

        function openCreateTeamModal() {
            document.getElementById('createTeamModal').classList.remove('hidden');
        }

        function closeCreateTeamModal() {
            document.getElementById('createTeamModal').classList.add('hidden');
            // Clear form
            document.getElementById('teamName').value = '';
            document.getElementById('teamDescription').value = '';
            document.getElementById('teamColor').value = 'blue';
        }

        function openManageTeamMembers(teamId) {
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            // Set team info
            document.getElementById('managingTeamName').textContent = team.name;
            document.getElementById('managingTeamDescription').textContent = team.description || 'No description';
            document.getElementById('manageTeamMembersModal').dataset.teamId = teamId;
            
            // Populate available users (exclude those already in this team)
            const availableSelect = document.getElementById('availableUsers');
            availableSelect.innerHTML = '';
            
            Array.from(appData.users.values())
                .filter(user => !team.members.includes(user.email))
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach(user => {
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = `${user.name} (${user.email})`;
                    availableSelect.appendChild(option);
                });
            
            // Show current members
            updateTeamMembersList(teamId);
            
            document.getElementById('manageTeamMembersModal').classList.remove('hidden');
        }

        function closeManageTeamMembersModal() {
            document.getElementById('manageTeamMembersModal').classList.add('hidden');
        }

        function addUsersToTeam() {
            const teamId = document.getElementById('manageTeamMembersModal').dataset.teamId;
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            const selectedOptions = Array.from(document.getElementById('availableUsers').selectedOptions);
            
            selectedOptions.forEach(option => {
                const email = option.value;
                if (!team.members.includes(email)) {
                    team.members.push(email);
                    
                    // Update user's team assignment
                    const user = appData.users.get(email);
                    if (user) {
                        user.teamId = teamId;
                    }
                }
            });
            
            // Recalculate team points
            updateTeamPoints(teamId);
            
            // Refresh the modal and tables
            openManageTeamMembers(teamId);
            refreshTeamsTable(); // This will now apply current sorting
            refreshDashboard();
            autoSave();
            
            log(`✅ Added ${selectedOptions.length} users to team ${team.name}`);
        }

        function removeUserFromTeam(teamId, userEmail) {
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            team.members = team.members.filter(email => email !== userEmail);
            
            // Remove team assignment from user
            const user = appData.users.get(userEmail);
            if (user && user.teamId === teamId) {
                delete user.teamId;
            }
            
            // Recalculate team points
            updateTeamPoints(teamId);
            
            updateTeamMembersList(teamId);
            refreshTeamsTable(); // This will now apply current sorting
            refreshDashboard();
            autoSave();
            
            log(`✅ Removed user from team ${team.name}`);
        }

        function updateTeamMembersList(teamId) {
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            const container = document.getElementById('teamMembersList');
            
            if (team.members.length === 0) {
                container.innerHTML = '<p class="text-gray-500 text-sm">No members yet</p>';
                return;
            }
            
            container.innerHTML = team.members.map(email => {
                const user = appData.users.get(email);
                return `
                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                            <div class="font-medium text-gray-900">${user?.name || email}</div>
                            <div class="text-sm text-gray-500">${email}</div>
                            <div class="text-xs text-gray-600">Points this month: ${user?.currentMonthPoints || 0}</div>
                        </div>
                        <button onclick="removeUserFromTeam('${teamId}', '${email}')" 
                                class="text-red-600 hover:text-red-800 text-sm">
                            Remove
                        </button>
                    </div>
                `;
            }).join('');
        }

        function updateTeamPoints(teamId) {
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            // Calculate team points from member points
            team.currentMonthPoints = team.members.reduce((sum, email) => {
                const user = appData.users.get(email);
                return sum + (user?.currentMonthPoints || 0);
            }, 0);
            
            team.totalPoints = team.members.reduce((sum, email) => {
                const user = appData.users.get(email);
                return sum + (user?.totalPoints || 0);
            }, 0);
        }

        function updateAllTeamPoints() {
            appData.teams.forEach((team, teamId) => {
                updateTeamPoints(teamId);
            });
        }

        function deleteTeam(teamId) {
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            if (!confirm(`Are you sure you want to delete the team "${team.name}"? This cannot be undone.`)) {
                return;
            }
            
            // Remove team assignment from all members
            team.members.forEach(email => {
                const user = appData.users.get(email);
                if (user && user.teamId === teamId) {
                    delete user.teamId;
                }
            });
            
            appData.teams.delete(teamId);
            
            refreshTeamsTable(); // This will now apply current sorting
            refreshDashboard();
            autoSave();
            
            log(`🗑️ Team deleted: ${team.name}`);
        }

        function refreshTeamsTable() {
            const tbody = document.getElementById('teamsTableBody');
            
            // Update all team points first
            updateAllTeamPoints();
            
            let teams = Array.from(appData.teams.values());
            
            // Apply sorting
            teams.sort((a, b) => {
                let aValue, bValue;
                
                if (sortState.teams.field === 'members') {
                    aValue = a.members.length;
                    bValue = b.members.length;
                } else {
                    aValue = a[sortState.teams.field];
                    bValue = b[sortState.teams.field];
                }
                
                // Handle different data types
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }
                
                if (sortState.teams.ascending) {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
            
            if (teams.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                            No teams created yet. Click "Create Team" to get started.
                        </td>
                    </tr>
                `;
                return;
            }
            
            tbody.innerHTML = teams.map(team => {
                const colorClass = {
                    blue: 'bg-blue-100 text-blue-800',
                    green: 'bg-green-100 text-green-800',
                    purple: 'bg-purple-100 text-purple-800',
                    orange: 'bg-orange-100 text-orange-800',
                    pink: 'bg-pink-100 text-pink-800',
                    teal: 'bg-teal-100 text-teal-800',
                    indigo: 'bg-indigo-100 text-indigo-800',
                    red: 'bg-red-100 text-red-800'
                }[team.color] || 'bg-gray-100 text-gray-800';
                
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                            <div class="flex items-center">
                                <span class="px-2 py-1 text-xs rounded-full ${colorClass} mr-2">
                                    ${team.name.substring(0, 2).toUpperCase()}
                                </span>
                                <div>
                                    <div class="font-medium text-gray-900">${team.name}</div>
                                    <div class="text-sm text-gray-500">${team.description || 'No description'}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-gray-600">${team.members.length}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="font-bold text-teal-600">${formatNumber(team.currentMonthPoints)}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="font-medium text-gray-900">${formatNumber(team.totalPoints)}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-sm text-gray-500">${formatDate(team.createdDate)}</span>
                        </td>
                        <td class="px-4 py-3">
                            <div class="flex space-x-2">
                                <button onclick="openManageTeamMembers('${team.id}')" 
                                        class="text-blue-600 hover:text-blue-800 text-sm">
                                    Manage
                                </button>
                                <button onclick="deleteTeam('${team.id}')" 
                                        class="text-red-600 hover:text-red-800 text-sm">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
            
            updateTeamSortButtons();
        }

        // Sort toggle functions for Teams
        function toggleTeamSort(field) {
            if (sortState.teams.field === field) {
                // Same field, toggle order
                sortState.teams.ascending = !sortState.teams.ascending;
            } else {
                // Different field, set new field and default to descending (most first)
                sortState.teams.field = field;
                sortState.teams.ascending = false;
            }
            refreshTeamsTable();
        }

        function toggleTeamSortOrder() {
            sortState.teams.ascending = !sortState.teams.ascending;
            refreshTeamsTable();
        }

        function updateTeamSortButtons() {
            // Reset all buttons
            ['sortMembers', 'sortTeamCurrentMonth', 'sortTeamTotal'].forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.className = 'px-3 py-1 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors';
                }
            });
            
            // Highlight active field
            let activeField;
            if (sortState.teams.field === 'members') {
                activeField = 'sortMembers';
            } else if (sortState.teams.field === 'currentMonthPoints') {
                activeField = 'sortTeamCurrentMonth';
            } else {
                activeField = 'sortTeamTotal';
            }
            
            const activeBtn = document.getElementById(activeField);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 border border-blue-300';
            }
            
            // Update sort order button
            const orderBtn = document.getElementById('sortOrderTeam');
            if (orderBtn) {
                if (sortState.teams.field === 'members') {
                    orderBtn.textContent = sortState.teams.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
                } else {
                    orderBtn.textContent = sortState.teams.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
                }
            }
        }

        function filterTeams() {
            const searchTerm = document.getElementById('teamSearch').value.toLowerCase();
            const rows = document.querySelectorAll('#teamsTableBody tr');
            
            // Don't filter if there's an empty state message
            if (rows.length === 1 && rows[0].querySelector('td[colspan]')) {
                return;
            }
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        }

        // Configuration functions (same as POC but integrated)
        function updatePointConfig() {
            // AWS Course Types
            appData.config.pointConfig.awsCourseTypes['AWS Builder Lab'] = parseInt(document.getElementById('awsBuilderLab').value);
            appData.config.pointConfig.awsCourseTypes['AWS Cloud Quest'] = parseInt(document.getElementById('awsCloudQuest').value);
            appData.config.pointConfig.awsCourseTypes['AWS Jam Journey'] = parseInt(document.getElementById('awsJamJourney').value);
            appData.config.pointConfig.awsCourseTypes['AWS Simulearn'] = parseInt(document.getElementById('awsSimulearn').value);
            appData.config.pointConfig.awsCourseTypes['Certification Exam Preparation'] = parseInt(document.getElementById('certExamPrep').value);
            appData.config.pointConfig.awsCourseTypes['Digital Course With Lab'] = parseInt(document.getElementById('digitalCourseWithLab').value);
            
            // General Course Categories
            appData.config.pointConfig.generalCourses['Classroom Training'] = parseInt(document.getElementById('classroomTraining').value);
            appData.config.pointConfig.generalCourses['Digital Courses - Foundational'] = parseInt(document.getElementById('digitalFoundational').value);
            appData.config.pointConfig.generalCourses['Digital Courses - Associate'] = parseInt(document.getElementById('digitalAssociate').value);
            appData.config.pointConfig.generalCourses['Digital Courses - Professional'] = parseInt(document.getElementById('digitalProfessional').value);
            appData.config.pointConfig.generalCourses['Digital Courses - Specialty'] = parseInt(document.getElementById('digitalSpecialty').value);
            
            // Events
            appData.config.pointConfig.events['Live Events'] = parseInt(document.getElementById('liveEvents').value);
            
            // Hackathons
            appData.config.pointConfig.hackathons['Hackathons - Participation'] = parseInt(document.getElementById('hackathonParticipation').value);
            appData.config.pointConfig.hackathons['Hackathons - 3rd Place'] = parseInt(document.getElementById('hackathon3rd').value);
            appData.config.pointConfig.hackathons['Hackathons - 2nd Place'] = parseInt(document.getElementById('hackathon2nd').value);
            appData.config.pointConfig.hackathons['Hackathons - 1st Place'] = parseInt(document.getElementById('hackathon1st').value);
            
            // Quizzes
            appData.config.pointConfig.quizzes['Quiz Completion'] = parseInt(document.getElementById('quizCompletion').value);
            appData.config.pointConfig.quizzes['Quiz 80%+ Score'] = parseInt(document.getElementById('quiz80Plus').value);
            appData.config.pointConfig.quizzes['Quiz Perfect Score'] = parseInt(document.getElementById('quizPerfect').value);
            
            log('🔧 Point configuration updated');
        }

        function loadConfiguration() {
            const config = appData.config.pointConfig;
            
            // AWS Course Types
            document.getElementById('awsBuilderLab').value = config.awsCourseTypes['AWS Builder Lab'];
            document.getElementById('awsCloudQuest').value = config.awsCourseTypes['AWS Cloud Quest'];
            document.getElementById('awsJamJourney').value = config.awsCourseTypes['AWS Jam Journey'];
            document.getElementById('awsSimulearn').value = config.awsCourseTypes['AWS Simulearn'];
            document.getElementById('certExamPrep').value = config.awsCourseTypes['Certification Exam Preparation'];
            document.getElementById('digitalCourseWithLab').value = config.awsCourseTypes['Digital Course With Lab'];
            
            // General Course Categories
            document.getElementById('classroomTraining').value = config.generalCourses['Classroom Training'];
            document.getElementById('digitalFoundational').value = config.generalCourses['Digital Courses - Foundational'];
            document.getElementById('digitalAssociate').value = config.generalCourses['Digital Courses - Associate'];
            document.getElementById('digitalProfessional').value = config.generalCourses['Digital Courses - Professional'];
            document.getElementById('digitalSpecialty').value = config.generalCourses['Digital Courses - Specialty'];
            
            // Events
            document.getElementById('liveEvents').value = config.events['Live Events'];
            
            // Hackathons
            document.getElementById('hackathonParticipation').value = config.hackathons['Hackathons - Participation'];
            document.getElementById('hackathon3rd').value = config.hackathons['Hackathons - 3rd Place'];
            document.getElementById('hackathon2nd').value = config.hackathons['Hackathons - 2nd Place'];
            document.getElementById('hackathon1st').value = config.hackathons['Hackathons - 1st Place'];
            
            // Quizzes
            document.getElementById('quizCompletion').value = config.quizzes['Quiz Completion'];
            document.getElementById('quiz80Plus').value = config.quizzes['Quiz 80%+ Score'];
            document.getElementById('quizPerfect').value = config.quizzes['Quiz Perfect Score'];
        }

        function resetToDefaults() {
            // AWS Course Types
            document.getElementById('awsBuilderLab').value = 100;
            document.getElementById('awsCloudQuest').value = 75;
            document.getElementById('awsJamJourney').value = 150;
            document.getElementById('awsSimulearn').value = 75;
            document.getElementById('certExamPrep').value = 100;
            document.getElementById('digitalCourseWithLab').value = 100;
            
            // General Course Categories
            document.getElementById('classroomTraining').value = 100;
            document.getElementById('digitalFoundational').value = 50;
            document.getElementById('digitalAssociate').value = 75;
            document.getElementById('digitalProfessional').value = 100;
            document.getElementById('digitalSpecialty').value = 100;
            
            // Events
            document.getElementById('liveEvents').value = 25;
            
            // Hackathons
            document.getElementById('hackathonParticipation').value = 150;
            document.getElementById('hackathon3rd').value = 250;
            document.getElementById('hackathon2nd').value = 350;
            document.getElementById('hackathon1st').value = 450;
            
            // Quizzes
            document.getElementById('quizCompletion').value = 20;
            document.getElementById('quiz80Plus').value = 50;
            document.getElementById('quizPerfect').value = 70;
            
            updatePointConfig();
            log('🔄 Configuration reset to defaults');
        }

        function saveConfiguration() {
            updatePointConfig();
            autoSave(); // Auto-save configuration changes
            const status = document.getElementById('configStatus');
            status.textContent = '✅ Configuration saved!';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }

        function exportConfig() {
            downloadJSON(appData.config, 'cloud_comp_config.json');
        }

        // Point calculation — delegates to src/models/points.js
        const {
            calculateCoursePoints: _coursePoints,
            calculateQuizBonus: _quizBonus,
            calculateHackathonPoints: _hackathonPoints,
            calculateMeetingPoints: _meetingPoints,
        } = window.__pointsAPI;

        function calculatePoints(courseLevel, courseType, activityType = 'course', score = null, placement = null) {
            const config = appData.config.pointConfig;
            if (activityType === 'live_event') return _meetingPoints(config);
            if (activityType === 'hackathon') return _hackathonPoints(placement, config);
            if (activityType === 'quiz') return _quizBonus(score, config);
            return _coursePoints(courseType, courseLevel, config);
        }

        // File handling
        function updateFileList(type, files) {
            const listElement = document.getElementById(type + 'FileList');
            if (files.length === 0) {
                listElement.innerHTML = '';
                return;
            }
            
            if (files.length === 1) {
                listElement.innerHTML = `<div class="text-xs"><strong>1 file selected:</strong><br>${files[0].name}</div>`;
            } else {
                const fileList = Array.from(files).map((f, index) => `${index + 1}. ${f.name}`).join('<br>');
                listElement.innerHTML = `<div class="text-xs"><strong>${files.length} files selected:</strong><br>${fileList}</div>`;
            }
            
            const hasFiles = selectedFiles.course.length > 0 || selectedFiles.teams.length > 0;
            document.getElementById('processBtn').disabled = !hasFiles;
        }

        // ── Import processing — delegates to extracted importers ──────

        const { importCourseFile: _importCourse, importTeamsFile: _importTeams, deduplicateBatch: _dedup } = window.__importAPI;

        async function processAllFiles() {
            if (!selectedFiles.course.length && !selectedFiles.teams.length) {
                alert('Please select files to process');
                return;
            }

            log('🚀 Starting multi-file processing...');
            log(`📁 Course files: ${selectedFiles.course.length}`);
            log(`👥 Teams files: ${selectedFiles.teams.length}`);
            document.getElementById('importResults').classList.remove('hidden');

            let totalProcessed = 0;
            let totalActivities = 0;

            for (const file of selectedFiles.course) {
                const result = await processCourseFile(file);
                totalProcessed += result.processed;
                totalActivities += result.activities;
            }

            for (const file of selectedFiles.teams) {
                const result = await processTeamsFile(file);
                totalProcessed += result.processed;
                totalActivities += result.activities;
            }

            log(`✅ Multi-file processing complete!`);
            log(`📊 Total: ${totalActivities} completed activities from ${totalProcessed} records`);

            updateImportStats(totalProcessed, totalActivities, 0);
            refreshDashboard();
            await autoSave();

            selectedFiles.course = [];
            selectedFiles.teams = [];
            updateFileList('course', []);
            updateFileList('teams', []);
            document.getElementById('processBtn').disabled = true;
        }

        async function processCourseFile(file) {
            log(`📚 Processing course file: ${file.name}`);
            try {
                const buffer = await file.arrayBuffer();
                const result = await _importCourse(buffer, window.XLSX, {
                    config: appData.config.pointConfig,
                    filename: file.name,
                });
                result.warnings.forEach(w => log(`⚠️ ${file.name}: ${w}`));
                result.errors.forEach(e => log(`❌ ${file.name}: ${e}`));
                if (result.errors.length > 0) {
                    return { processed: 0, activities: 0 };
                }
                commitImportResult(result);
                log(`✅ ${file.name}: ${result.activities.length} activities, ${result.users.length} users`);
                return { processed: result.activities.length + result.warnings.length, activities: result.activities.length };
            } catch (error) {
                log(`❌ Error processing ${file.name}: ${error.message}`);
                return { processed: 0, activities: 0 };
            }
        }

        async function processTeamsFile(file) {
            log(`👥 Processing Teams file: ${file.name}`);
            try {
                const text = await file.text();
                const result = await _importTeams(text, {
                    config: appData.config.pointConfig,
                    filename: file.name,
                });
                result.warnings.forEach(w => log(`⚠️ ${file.name}: ${w}`));
                result.errors.forEach(e => log(`❌ ${file.name}: ${e}`));
                if (result.errors.length > 0) {
                    return { processed: 0, activities: 0 };
                }
                commitImportResult(result);
                log(`✅ ${file.name}: ${result.activities.length} meeting attendance activities`);
                return { processed: result.activities.length + result.warnings.length, activities: result.activities.length };
            } catch (error) {
                log(`❌ Error processing Teams file ${file.name}: ${error.message}`);
                return { processed: 0, activities: 0 };
            }
        }

        function commitImportResult(result) {
            // Deduplicate against existing activities
            const { accepted } = _dedup(result.activities, appData.activities);

            // Commit accepted activities
            for (const activity of accepted) {
                appData.activities.push(activity);
            }

            // Commit new users (upsert — won't overwrite existing)
            const currentMonth = getCurrentMonth();
            for (const user of result.users) {
                if (!appData.users.has(user.email)) {
                    appData.users.set(user.email, {
                        ...user,
                        currentMonthPoints: 0,
                        totalPoints: 0,
                    });
                }
            }

            // Update user points from accepted activities
            for (const activity of accepted) {
                const user = appData.users.get(activity.userId);
                if (user) {
                    user.totalPoints = (user.totalPoints || 0) + activity.pointsEarned;
                    const actMonth = activity.completedDate ? activity.completedDate.slice(0, 7) : null;
                    if (actMonth === currentMonth) {
                        user.currentMonthPoints = (user.currentMonthPoints || 0) + activity.pointsEarned;
                    }
                }
            }

            if (accepted.length > 0) {
                log(`📊 Dedup: ${accepted.length} accepted, ${result.activities.length - accepted.length} duplicates skipped`);
            }
        }

        function updateImportStats(totalProcessed, totalActivities, totalInProgress = 0) {
            const statsContainer = document.getElementById('importStats');
            statsContainer.innerHTML = `
                <div class="bg-blue-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-blue-600">${formatNumber(totalProcessed)}</div>
                    <div class="text-sm text-blue-800">Records Processed</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-green-600">${formatNumber(totalActivities)}</div>
                    <div class="text-sm text-green-800">Completed Activities</div>
                </div>
                <div class="bg-orange-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-orange-600">${formatNumber(totalInProgress)}</div>
                    <div class="text-sm text-orange-800">In Progress</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-purple-600">${formatNumber(appData.users.size)}</div>
                    <div class="text-sm text-purple-800">Total Users</div>
                </div>
                <div class="bg-indigo-50 p-4 rounded-lg text-center">
                    <div class="text-2xl font-bold text-indigo-600">${formatNumber(Array.from(appData.users.values()).reduce((sum, user) => sum + user.totalPoints, 0))}</div>
                    <div class="text-sm text-indigo-800">Points Awarded</div>
                </div>
            `;
        }

        // User management functions
        function refreshUsersTable() {
            const tbody = document.getElementById('usersTableBody');
            let users = Array.from(appData.users.values());
            
            // Apply sorting
            users.sort((a, b) => {
                let aValue = a[sortState.users.field];
                let bValue = b[sortState.users.field];
                
                // Handle different data types
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }
                
                if (sortState.users.ascending) {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
            
            tbody.innerHTML = users.map(user => `
                <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3">
                        <input type="checkbox" 
                               class="user-checkbox rounded" 
                               value="${user.email}"
                               onchange="toggleUserSelection('${user.email}')"
                               ${bulkSelection.users.has(user.email) ? 'checked' : ''}>
                    </td>
                    <td class="px-4 py-3">
                        <div class="font-medium text-gray-900">${user.name}</div>
                        <div class="text-sm text-gray-500">${user.email}</div>
                    </td>
                    <td class="px-4 py-3">
                        <span class="font-bold text-purple-600">${formatNumber(user.currentMonthPoints)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="font-medium text-gray-900">${formatNumber(user.totalPoints)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-gray-600">${user.activities?.length || 0}</span>
                    </td>
                    <td class="px-4 py-3">
                        <span class="text-sm text-gray-500">${formatDate(user.lastActivity)}</span>
                    </td>
                    <td class="px-4 py-3">
                        <button onclick="viewUserDetails('${user.email}')" class="text-blue-600 hover:text-blue-800 text-sm">View</button>
                    </td>
                </tr>
            `).join('');
            
            updateUserSortButtons();
            updateBulkSelectionUI('users');
        }

        // Bulk selection functions for Users
        function toggleUserSelection(email) {
            if (bulkSelection.users.has(email)) {
                bulkSelection.users.delete(email);
            } else {
                bulkSelection.users.add(email);
            }
            updateBulkSelectionUI('users');
        }

        function toggleSelectAllUsers() {
            const checkbox = document.getElementById('selectAllUsersCheckbox');
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            
            if (checkbox.checked) {
                userCheckboxes.forEach(cb => {
                    cb.checked = true;
                    bulkSelection.users.add(cb.value);
                });
            } else {
                userCheckboxes.forEach(cb => {
                    cb.checked = false;
                });
                bulkSelection.users.clear();
            }
            updateBulkSelectionUI('users');
        }

        function selectAllUsers() {
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            userCheckboxes.forEach(cb => {
                cb.checked = true;
                bulkSelection.users.add(cb.value);
            });
            document.getElementById('selectAllUsersCheckbox').checked = true;
            updateBulkSelectionUI('users');
        }

        function deselectAllUsers() {
            const userCheckboxes = document.querySelectorAll('.user-checkbox');
            userCheckboxes.forEach(cb => {
                cb.checked = false;
            });
            bulkSelection.users.clear();
            document.getElementById('selectAllUsersCheckbox').checked = false;
            updateBulkSelectionUI('users');
        }

        function updateBulkSelectionUI(type) {
            if (type === 'users') {
                const count = bulkSelection.users.size;
                const bulkActionsBar = document.getElementById('userBulkActions');
                const countElement = document.getElementById('selectedUsersCount');
                
                if (count > 0) {
                    bulkActionsBar.classList.remove('hidden');
                    countElement.textContent = count;
                } else {
                    bulkActionsBar.classList.add('hidden');
                }
            } else if (type === 'activities') {
                const count = bulkSelection.activities.size;
                const bulkActionsBar = document.getElementById('activityBulkActions');
                const countElement = document.getElementById('selectedActivitiesCount');
                
                if (count > 0) {
                    bulkActionsBar.classList.remove('hidden');
                    countElement.textContent = count;
                } else {
                    bulkActionsBar.classList.add('hidden');
                }
            }
        }

        // Bulk operations for Users
        function bulkAwardPoints() {
            if (bulkSelection.users.size === 0) {
                alert('Please select users first');
                return;
            }
            
            document.getElementById('bulkAwardUserCount').textContent = bulkSelection.users.size;
            document.getElementById('bulkAwardPointsModal').classList.remove('hidden');
        }

        function closeBulkAwardPointsModal() {
            document.getElementById('bulkAwardPointsModal').classList.add('hidden');
            document.getElementById('bulkActivityTitle').value = '';
            document.getElementById('bulkPoints').value = '';
            document.getElementById('bulkDescription').value = '';
        }

        function submitBulkAwardPoints() {
            const title = document.getElementById('bulkActivityTitle').value.trim();
            const points = parseInt(document.getElementById('bulkPoints').value);
            const description = document.getElementById('bulkDescription').value.trim();

            if (!title || !points) {
                alert('Please fill in all required fields');
                return;
            }

            let successCount = 0;
            bulkSelection.users.forEach(email => {
                const activity = {
                    id: `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    userEmail: email,
                    courseId: `bulk_${Date.now()}`,
                    title: title,
                    level: 'manual',
                    courseType: 'Bulk Award',
                    pointsEarned: points,
                    completedDate: new Date().toISOString(),
                    score: null,
                    source: 'bulk_award',
                    importDate: new Date().toISOString(),
                    monthYear: getCurrentMonth(),
                    description: description
                };

                appData.activities.push(activity);

                const user = appData.users.get(email);
                if (user) {
                    user.activities = user.activities || [];
                    user.activities.push(activity.id);
                    user.totalPoints += points;
                    user.currentMonthPoints += points;
                    user.lastActivity = new Date().toISOString();
                    successCount++;
                }
            });

            closeBulkAwardPointsModal();
            deselectAllUsers();
            refreshDashboard();
            refreshUsersTable();
            refreshActivitiesTable();
            autoSave();

            log(`✅ Bulk awarded ${points} points to ${successCount} users for "${title}"`);
            alert(`Successfully awarded ${points} points to ${successCount} users!`);
        }

        function bulkAssignTeam() {
            if (bulkSelection.users.size === 0) {
                alert('Please select users first');
                return;
            }
            
            // Populate team dropdown
            const select = document.getElementById('bulkTeamSelect');
            select.innerHTML = '<option value="">Choose a team...</option>';
            appData.teams.forEach(team => {
                select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
            });
            
            document.getElementById('bulkAssignUserCount').textContent = bulkSelection.users.size;
            document.getElementById('bulkAssignTeamModal').classList.remove('hidden');
        }

        function closeBulkAssignTeamModal() {
            document.getElementById('bulkAssignTeamModal').classList.add('hidden');
            document.getElementById('bulkTeamSelect').value = '';
        }

        function submitBulkAssignTeam() {
            const teamId = document.getElementById('bulkTeamSelect').value;
            
            if (!teamId) {
                alert('Please select a team');
                return;
            }
            
            const team = appData.teams.get(teamId);
            if (!team) return;
            
            let successCount = 0;
            bulkSelection.users.forEach(email => {
                if (!team.members.includes(email)) {
                    team.members.push(email);
                    
                    const user = appData.users.get(email);
                    if (user) {
                        // Remove from previous team if exists
                        if (user.teamId) {
                            const oldTeam = appData.teams.get(user.teamId);
                            if (oldTeam) {
                                oldTeam.members = oldTeam.members.filter(e => e !== email);
                            }
                        }
                        user.teamId = teamId;
                        successCount++;
                    }
                }
            });
            
            updateTeamPoints(teamId);
            closeBulkAssignTeamModal();
            deselectAllUsers();
            refreshUsersTable();
            refreshTeamsTable();
            refreshDashboard();
            autoSave();
            
            log(`✅ Bulk assigned ${successCount} users to team ${team.name}`);
            alert(`Successfully assigned ${successCount} users to team ${team.name}!`);
        }

        function bulkExportUsers() {
            if (bulkSelection.users.size === 0) {
                alert('Please select users first');
                return;
            }
            
            const exportData = {
                title: 'Selected Users Export',
                exportDate: new Date().toISOString(),
                users: Array.from(bulkSelection.users).map(email => {
                    const user = appData.users.get(email);
                    return {
                        email: user.email,
                        name: user.name,
                        currentMonthPoints: user.currentMonthPoints,
                        totalPoints: user.totalPoints,
                        activities: user.activities?.length || 0,
                        teamId: user.teamId,
                        lastActivity: user.lastActivity
                    };
                })
            };
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadJSON(exportData, `selected_users_${timestamp}.json`);
            
            log(`📥 Exported ${bulkSelection.users.size} selected users`);
        }

        // Sort toggle functions for Users
        function toggleUserSort(field) {
            if (sortState.users.field === field) {
                // Same field, toggle order
                sortState.users.ascending = !sortState.users.ascending;
            } else {
                // Different field, set new field and default to descending (most first)
                sortState.users.field = field;
                sortState.users.ascending = false;
            }
            refreshUsersTable();
        }

        function toggleUserSortOrder() {
            sortState.users.ascending = !sortState.users.ascending;
            refreshUsersTable();
        }

        function updateUserSortButtons() {
            // Reset all buttons
            ['sortCurrentMonth', 'sortTotal'].forEach(id => {
                const btn = document.getElementById(id);
                btn.className = 'px-3 py-1 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors';
            });
            
            // Highlight active field
            const activeField = sortState.users.field === 'currentMonthPoints' ? 'sortCurrentMonth' : 'sortTotal';
            const activeBtn = document.getElementById(activeField);
            activeBtn.className = 'px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 border border-blue-300';
            
            // Update sort order button
            const orderBtn = document.getElementById('sortOrderUser');
            orderBtn.textContent = sortState.users.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
        }

        function filterUsers() {
            const searchTerm = document.getElementById('userSearch').value.toLowerCase();
            const rows = document.querySelectorAll('#usersTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        }

        function refreshActivitiesTable() {
            const tbody = document.getElementById('activitiesTableBody');
            let activities = [...appData.activities];
            
            // Apply sorting
            activities.sort((a, b) => {
                let aValue, bValue;
                
                if (sortState.activities.field === 'pointsEarned') {
                    aValue = a.pointsEarned;
                    bValue = b.pointsEarned;
                } else if (sortState.activities.field === 'completedDate') {
                    aValue = new Date(a.completedDate);
                    bValue = new Date(b.completedDate);
                }
                
                if (sortState.activities.ascending) {
                    return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
                } else {
                    return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
                }
            });
            
            tbody.innerHTML = activities.map(activity => {
                const user = appData.users.get(activity.userEmail);
                return `
                    <tr class="hover:bg-gray-50">
                        <td class="px-4 py-3">
                            <input type="checkbox" 
                                   class="activity-checkbox rounded" 
                                   value="${activity.id}"
                                   onchange="toggleActivitySelection('${activity.id}')"
                                   ${bulkSelection.activities.has(activity.id) ? 'checked' : ''}>
                        </td>
                        <td class="px-4 py-3">
                            <div class="font-medium text-gray-900">${user?.name || activity.userEmail}</div>
                        </td>
                        <td class="px-4 py-3">
                            <div class="font-medium text-gray-900">${activity.title}</div>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-sm text-gray-600">${activity.courseType}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="px-2 py-1 text-xs rounded-full ${
                                activity.level === 'fundamental' ? 'bg-green-100 text-green-800' :
                                activity.level === 'intermediate' ? 'bg-blue-100 text-blue-800' :
                                activity.level === 'advanced' ? 'bg-purple-100 text-purple-800' :
                                'bg-gray-100 text-gray-800'
                            }">${activity.level}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="font-bold text-purple-600">${activity.pointsEarned}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-sm text-gray-500">${formatDate(activity.completedDate)}</span>
                        </td>
                        <td class="px-4 py-3">
                            <span class="text-xs text-gray-500">${activity.source}</span>
                        </td>
                        <td class="px-4 py-3">
                            <button onclick="editActivity('${activity.id}')" class="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            updateActivitySortButtons();
            updateBulkSelectionUI('activities');
        }

        // Bulk selection functions for Activities
        function toggleActivitySelection(activityId) {
            if (bulkSelection.activities.has(activityId)) {
                bulkSelection.activities.delete(activityId);
            } else {
                bulkSelection.activities.add(activityId);
            }
            updateBulkSelectionUI('activities');
        }

        function toggleSelectAllActivities() {
            const checkbox = document.getElementById('selectAllActivitiesCheckbox');
            const activityCheckboxes = document.querySelectorAll('.activity-checkbox');
            
            if (checkbox.checked) {
                activityCheckboxes.forEach(cb => {
                    cb.checked = true;
                    bulkSelection.activities.add(cb.value);
                });
            } else {
                activityCheckboxes.forEach(cb => {
                    cb.checked = false;
                });
                bulkSelection.activities.clear();
            }
            updateBulkSelectionUI('activities');
        }

        function selectAllActivities() {
            const activityCheckboxes = document.querySelectorAll('.activity-checkbox');
            activityCheckboxes.forEach(cb => {
                cb.checked = true;
                bulkSelection.activities.add(cb.value);
            });
            document.getElementById('selectAllActivitiesCheckbox').checked = true;
            updateBulkSelectionUI('activities');
        }

        function deselectAllActivities() {
            const activityCheckboxes = document.querySelectorAll('.activity-checkbox');
            activityCheckboxes.forEach(cb => {
                cb.checked = false;
            });
            bulkSelection.activities.clear();
            document.getElementById('selectAllActivitiesCheckbox').checked = false;
            updateBulkSelectionUI('activities');
        }

        // Bulk operations for Activities
        function bulkAdjustPoints() {
            if (bulkSelection.activities.size === 0) {
                alert('Please select activities first');
                return;
            }
            
            document.getElementById('bulkAdjustActivityCount').textContent = bulkSelection.activities.size;
            document.getElementById('bulkAdjustPointsModal').classList.remove('hidden');
        }

        function closeBulkAdjustPointsModal() {
            document.getElementById('bulkAdjustPointsModal').classList.add('hidden');
            document.getElementById('bulkAdjustType').value = 'add';
            document.getElementById('bulkAdjustValue').value = '';
            document.getElementById('bulkAdjustReason').value = '';
        }

        function submitBulkAdjustPoints() {
            const adjustType = document.getElementById('bulkAdjustType').value;
            const value = parseFloat(document.getElementById('bulkAdjustValue').value);
            const reason = document.getElementById('bulkAdjustReason').value.trim();

            if (!value || isNaN(value)) {
                alert('Please enter a valid value');
                return;
            }

            let successCount = 0;
            const affectedUsers = new Set();

            bulkSelection.activities.forEach(activityId => {
                const activity = appData.activities.find(a => a.id === activityId);
                if (activity) {
                    const oldPoints = activity.pointsEarned;
                    let newPoints = oldPoints;

                    switch(adjustType) {
                        case 'add':
                            newPoints = oldPoints + value;
                            break;
                        case 'subtract':
                            newPoints = Math.max(0, oldPoints - value);
                            break;
                        case 'multiply':
                            newPoints = Math.round(oldPoints * value);
                            break;
                        case 'set':
                            newPoints = value;
                            break;
                    }

                    const pointDiff = newPoints - oldPoints;
                    activity.pointsEarned = newPoints;
                    activity.adjustmentHistory = activity.adjustmentHistory || [];
                    activity.adjustmentHistory.push({
                        date: new Date().toISOString(),
                        type: adjustType,
                        value: value,
                        oldPoints: oldPoints,
                        newPoints: newPoints,
                        reason: reason
                    });

                    // Update user's points
                    const user = appData.users.get(activity.userEmail);
                    if (user) {
                        user.totalPoints += pointDiff;
                        if (activity.monthYear === getCurrentMonth()) {
                            user.currentMonthPoints += pointDiff;
                        }
                        affectedUsers.add(activity.userEmail);
                    }

                    successCount++;
                }
            });

            // Update team points for affected users
            affectedUsers.forEach(email => {
                const user = appData.users.get(email);
                if (user && user.teamId) {
                    updateTeamPoints(user.teamId);
                }
            });

            closeBulkAdjustPointsModal();
            deselectAllActivities();
            refreshDashboard();
            refreshActivitiesTable();
            refreshUsersTable();
            refreshTeamsTable();
            autoSave();

            log(`✅ Bulk adjusted points for ${successCount} activities (${adjustType} ${value})`);
            alert(`Successfully adjusted points for ${successCount} activities!`);
        }

        function bulkDeleteActivities() {
            if (bulkSelection.activities.size === 0) {
                alert('Please select activities first');
                return;
            }

            if (!confirm(`Are you sure you want to delete ${bulkSelection.activities.size} activities? This cannot be undone.`)) {
                return;
            }

            const affectedUsers = new Set();
            let successCount = 0;

            bulkSelection.activities.forEach(activityId => {
                const activityIndex = appData.activities.findIndex(a => a.id === activityId);
                if (activityIndex !== -1) {
                    const activity = appData.activities[activityIndex];
                    
                    // Update user's points
                    const user = appData.users.get(activity.userEmail);
                    if (user) {
                        user.totalPoints -= activity.pointsEarned;
                        if (activity.monthYear === getCurrentMonth()) {
                            user.currentMonthPoints -= activity.pointsEarned;
                        }
                        // Remove activity from user's list
                        user.activities = user.activities.filter(id => id !== activityId);
                        affectedUsers.add(activity.userEmail);
                    }

                    // Remove the activity
                    appData.activities.splice(activityIndex, 1);
                    successCount++;
                }
            });

            // Update team points for affected users
            affectedUsers.forEach(email => {
                const user = appData.users.get(email);
                if (user && user.teamId) {
                    updateTeamPoints(user.teamId);
                }
            });

            deselectAllActivities();
            refreshDashboard();
            refreshActivitiesTable();
            refreshUsersTable();
            refreshTeamsTable();
            autoSave();

            log(`🗑️ Bulk deleted ${successCount} activities`);
            alert(`Successfully deleted ${successCount} activities!`);
        }

        function bulkExportActivities() {
            if (bulkSelection.activities.size === 0) {
                alert('Please select activities first');
                return;
            }

            const exportData = {
                title: 'Selected Activities Export',
                exportDate: new Date().toISOString(),
                activities: Array.from(bulkSelection.activities).map(activityId => {
                    const activity = appData.activities.find(a => a.id === activityId);
                    const user = appData.users.get(activity.userEmail);
                    return {
                        user: user?.name || activity.userEmail,
                        email: activity.userEmail,
                        activity: activity.title,
                        courseType: activity.courseType,
                        level: activity.level,
                        points: activity.pointsEarned,
                        completedDate: activity.completedDate,
                        source: activity.source,
                        adjustmentHistory: activity.adjustmentHistory
                    };
                })
            };

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadJSON(exportData, `selected_activities_${timestamp}.json`);

            log(`📥 Exported ${bulkSelection.activities.size} selected activities`);
        }

        // Sort toggle functions for Activities
        function toggleActivitySort(field) {
            if (sortState.activities.field === field) {
                // Same field, toggle order
                sortState.activities.ascending = !sortState.activities.ascending;
            } else {
                // Different field, set new field and default to descending (most/recent first)
                sortState.activities.field = field;
                sortState.activities.ascending = false;
            }
            refreshActivitiesTable();
        }

        function toggleActivitySortOrder() {
            sortState.activities.ascending = !sortState.activities.ascending;
            refreshActivitiesTable();
        }

        function updateActivitySortButtons() {
            // Reset all buttons
            ['sortPoints', 'sortDate'].forEach(id => {
                const btn = document.getElementById(id);
                btn.className = 'px-3 py-1 text-xs rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors';
            });
            
            // Highlight active field
            const activeField = sortState.activities.field === 'pointsEarned' ? 'sortPoints' : 'sortDate';
            const activeBtn = document.getElementById(activeField);
            activeBtn.className = 'px-3 py-1 text-xs rounded-lg bg-blue-100 text-blue-800 border border-blue-300';
            
            // Update sort order button
            const orderBtn = document.getElementById('sortOrderActivity');
            if (sortState.activities.field === 'pointsEarned') {
                orderBtn.textContent = sortState.activities.ascending ? 'Least First ⬆️' : 'Most First ⬇️';
            } else {
                orderBtn.textContent = sortState.activities.ascending ? 'Oldest First ⬆️' : 'Recent First ⬇️';
            }
        }

        function filterActivities() {
            const searchTerm = document.getElementById('activitySearch').value.toLowerCase();
            const filter = document.getElementById('activityFilter').value;
            const currentMonth = getCurrentMonth();
            const rows = document.querySelectorAll('#activitiesTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const activityId = row.querySelector('button').onclick.toString().match(/'([^']+)'/)[1];
                const activity = appData.activities.find(a => a.id === activityId);
                
                let showRow = text.includes(searchTerm);
                
                if (showRow && filter !== 'all') {
                    switch(filter) {
                        case 'current-month':
                            showRow = activity?.monthYear === currentMonth;
                            break;
                        case 'courses':
                            showRow = !activity?.courseType?.includes('Meeting');
                            break;
                        case 'events':
                            showRow = activity?.courseType?.includes('Meeting') || activity?.level === 'live_event';
                            break;
                    }
                }
                
                row.style.display = showRow ? '' : 'none';
            });
        }

        // Modal functions
        function addManualPoints() {
            document.getElementById('addPointsModal').classList.remove('hidden');
        }

        function closeAddPointsModal() {
            document.getElementById('addPointsModal').classList.add('hidden');
            // Clear form
            document.getElementById('manualUserEmail').value = '';
            document.getElementById('manualActivityTitle').value = '';
            document.getElementById('manualPoints').value = '';
            document.getElementById('manualDescription').value = '';
        }

        function submitManualPoints() {
            const email = document.getElementById('manualUserEmail').value.trim().toLowerCase();
            const title = document.getElementById('manualActivityTitle').value.trim();
            const points = parseInt(document.getElementById('manualPoints').value);
            const description = document.getElementById('manualDescription').value.trim();

            if (!email || !title || !points) {
                alert('Please fill in all required fields');
                return;
            }

            // Create manual activity
            const activity = {
                id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userEmail: email,
                courseId: `manual_${Date.now()}`,
                title: title,
                level: 'manual',
                courseType: 'Manual Award',
                pointsEarned: points,
                completedDate: new Date().toISOString(),
                score: null,
                source: 'manual_entry',
                importDate: new Date().toISOString(),
                monthYear: getCurrentMonth(),
                description: description
            };

            appData.activities.push(activity);

            // Update or create user
            if (!appData.users.has(email)) {
                appData.users.set(email, {
                    email: email,
                    name: email.split('@')[0],
                    firstName: '',
                    lastName: '',
                    currentMonthPoints: 0,
                    totalPoints: 0,
                    activities: [],
                    joinDate: new Date().toISOString(),
                    lastActivity: new Date().toISOString()
                });
            }

            const user = appData.users.get(email);
            user.activities = user.activities || [];
            user.activities.push(activity.id);
            user.totalPoints += points;
            user.currentMonthPoints += points;
            user.lastActivity = new Date().toISOString();

            closeAddPointsModal();
            refreshDashboard();
            refreshUsersTable();
            refreshActivitiesTable();
            autoSave(); // Auto-save after manual points

            log(`✅ Manual points awarded: ${points} to ${email} for "${title}"`);
        }

        // Report functions
        function generateLeaderboardReport() {
            const currentMonth = getCurrentMonth();
            const leaderboard = Array.from(appData.users.values())
                .filter(user => user.currentMonthPoints > 0)
                .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints);

            const reportData = {
                title: `Leaderboard Report - ${currentMonth}`,
                generated: new Date().toISOString(),
                data: leaderboard.map((user, index) => ({
                    rank: index + 1,
                    name: user.name,
                    email: user.email,
                    currentMonthPoints: user.currentMonthPoints,
                    totalPoints: user.totalPoints,
                    activities: user.activities?.length || 0
                }))
            };

            downloadJSON(reportData, `cloud_comp_leaderboard_${currentMonth}.json`);
        }

        function generateActivityReport() {
            const reportData = {
                title: 'Activity Report',
                generated: new Date().toISOString(),
                data: appData.activities.map(activity => {
                    const user = appData.users.get(activity.userEmail);
                    return {
                        user: user?.name || activity.userEmail,
                        email: activity.userEmail,
                        activity: activity.title,
                        courseType: activity.courseType,
                        level: activity.level,
                        points: activity.pointsEarned,
                        completedDate: activity.completedDate,
                        source: activity.source
                    };
                })
            };

            downloadJSON(reportData, `cloud_comp_activities_${new Date().toISOString().slice(0, 10)}.json`);
        }

        function generateSummaryReport() {
            const currentMonth = getCurrentMonth();
            const reportData = {
                title: 'Summary Report',
                generated: new Date().toISOString(),
                summary: {
                    totalUsers: appData.users.size,
                    totalTeams: appData.teams.size,
                    totalActivities: appData.activities.length,
                    totalPoints: Array.from(appData.users.values()).reduce((sum, user) => sum + user.totalPoints, 0),
                    currentMonthActivities: appData.activities.filter(a => a.monthYear === currentMonth).length,
                    currentMonthPoints: Array.from(appData.users.values()).reduce((sum, user) => sum + user.currentMonthPoints, 0),
                    lastImport: appData.metadata.lastImport,
                    sources: appData.metadata.sources
                },
                topUsers: Array.from(appData.users.values())
                    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
                    .slice(0, 10)
                    .map(user => ({
                        name: user.name,
                        email: user.email,
                        currentMonthPoints: user.currentMonthPoints,
                        totalPoints: user.totalPoints
                    })),
                topTeams: Array.from(appData.teams.values())
                    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
                    .slice(0, 5)
                    .map(team => ({
                        name: team.name,
                        members: team.members.length,
                        currentMonthPoints: team.currentMonthPoints,
                        totalPoints: team.totalPoints
                    }))
            };

            downloadJSON(reportData, `cloud_comp_summary_${new Date().toISOString().slice(0, 10)}.json`);
        }

        function resetMonthlyLeaderboard() {
            if (!confirm('Are you sure you want to reset the monthly leaderboard? This will set all current month points to 0.')) {
                return;
            }

            // Archive current month
            const currentMonth = getCurrentMonth();
            const archiveData = {
                month: currentMonth,
                resetDate: new Date().toISOString(),
                leaderboard: Array.from(appData.users.values())
                    .filter(user => user.currentMonthPoints > 0)
                    .sort((a, b) => b.currentMonthPoints - a.currentMonthPoints)
                    .map(user => ({
                        name: user.name,
                        email: user.email,
                        points: user.currentMonthPoints
                    }))
            };

            downloadJSON(archiveData, `cloud_comp_leaderboard_archive_${currentMonth}.json`);

            // Reset all users' current month points
            appData.users.forEach(user => {
                user.currentMonthPoints = 0;
            });

            // Update config
            appData.config.lastReset = currentMonth;

            refreshDashboard();
            refreshUsersTable();
            autoSave(); // Auto-save after reset

            log(`🔄 Monthly leaderboard reset for ${currentMonth}`);
        }

        function confirmMonthlyReset() {
            resetMonthlyLeaderboard();
        }

        function viewUserDetails(email) {
            // Placeholder for user detail view
            alert(`User details for ${email} - Feature coming soon!`);
        }

        function editActivity(activityId) {
            // Placeholder for activity editing
            alert(`Edit activity ${activityId} - Feature coming soon!`);
        }

        // ── Initialization (called by main.js) ────────────────────────
        function initApp() {
            // File input handlers
            document.getElementById('courseFiles').addEventListener('change', function(e) {
                selectedFiles.course = Array.from(e.target.files);
                updateFileList('course', selectedFiles.course);
            });

            document.getElementById('teamsFiles').addEventListener('change', function(e) {
                selectedFiles.teams = Array.from(e.target.files);
                updateFileList('teams', selectedFiles.teams);
            });

            log('☁️ Cloud Comp Admin initialized');
            loadData();

            // Initialize sort button states
            setTimeout(() => {
                updateUserSortButtons();
                updateActivitySortButtons();
                updateTeamSortButtons();
            }, 100);
        }

        // ── Expose functions to window for HTML inline handlers ──────
        Object.assign(window, {
            // Tab / navigation
            showTab,
            scrollToSection,

            // Import
            processAllFiles,
            processImportData,
            closeImportDataModal,

            // Export
            exportData,
            exportConfig,

            // Users
            addManualPoints,
            closeAddPointsModal,
            submitManualPoints,
            filterUsers,
            toggleUserSort,
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
            viewUserDetails,
            toggleUserSelection,

            // Teams
            openCreateTeamModal,
            closeCreateTeamModal,
            createTeam,
            openManageTeamMembers,
            closeManageTeamMembersModal,
            addUsersToTeam,
            removeUserFromTeam,
            deleteTeam,
            filterTeams,
            toggleTeamSort,
            toggleTeamSortOrder,

            // Activities
            filterActivities,
            toggleActivitySort,
            toggleActivitySortOrder,
            toggleSelectAllActivities,
            selectAllActivities,
            deselectAllActivities,
            bulkAdjustPoints,
            closeBulkAdjustPointsModal,
            submitBulkAdjustPoints,
            bulkDeleteActivities,
            bulkExportActivities,
            editActivity,
            toggleActivitySelection,

            // Configuration
            updatePointConfig,
            resetToDefaults,
            saveConfiguration,

            // Reports
            generateLeaderboardReport,
            generateActivityReport,
            generateSummaryReport,
            resetMonthlyLeaderboard,
            confirmMonthlyReset,

            // Init (for main.js)
            initApp,
        });
