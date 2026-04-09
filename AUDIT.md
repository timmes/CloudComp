# CloudComp Exhaustive Codebase Audit

**Date:** 2026-04-09
**File:** `cloud_comp_app.html` -- 4247 lines, single self-contained HTML file
**Total JS functions:** 95
**No other source files exist.** The `src/` directory described in CLAUDE.md has not been created.

---

## 1. Module Map -- Every Logical Concern

### A. Markup & Style (lines 1-1531)

| Lines | Concern | Notes |
|-------|---------|-------|
| 1-8 | Document head, CDN imports | Tailwind CDN (`cdn.tailwindcss.com`), XLSX 0.18.5 CDN |
| 9-51 | Custom CSS | `.tab-button`, `.scroll-table`, `.status-indicator`, `.card-hover`, `.sort-controls`, smooth scroll |
| 53-80 | Header bar | Version badge (says v1.2), data status indicator, Import/Export/Readme buttons |
| 82-111 | Tab navigation | 8 tabs: Dashboard, Import, Users, Teams, Activities, Config, Reports, Manual |
| 113-246 | Dashboard section | 6 stat cards, user leaderboard table, team leaderboard table, recent activities, activity charts |
| 248-303 | Import section | Two file upload zones (course + Teams meeting), Process button, import results/log area |
| 305-385 | Users section | Search, sort controls (currentMonth/total), bulk actions bar, users table with checkboxes |
| 387-441 | Teams section | Search, sort controls (members/currentMonth/total), teams table |
| 443-528 | Activities section | Sort controls (points/date), filter dropdown, bulk actions bar, activities table with checkboxes |
| 530-714 | Configuration section | 18 point-config input fields organized by category (AWS types, general, events, quizzes, hackathons), save/reset/export buttons |
| 716-754 | Reports section | 3 report generation buttons, monthly reset button |
| 756-1321 | Manual section | 10 documentation sections (getting started, dashboard, importing, users, teams, activities, config, reports, tips, troubleshooting) |
| 1323-1335 | Footer | Credits |
| 1337-1352 | Import Data modal | JSON file input for restoring backups |
| 1354-1381 | Add Points modal | Email, title, points, description fields |
| 1383-1415 | Create Team modal | Name, description, color select |
| 1417-1452 | Manage Team Members modal | Available users multi-select, current members list |
| 1454-1478 | Bulk Award Points modal | Title, points-per-user, description |
| 1480-1499 | Bulk Assign Team modal | Team select dropdown |
| 1501-1530 | Bulk Adjust Points modal | Adjustment type (add/subtract/multiply/set), value, reason |

### B. JavaScript (lines 1532-4247)

#### B1. State Management (lines 1532-1606)

| Lines | Concern |
|-------|---------|
| 1534-1579 | `appData` initialization (users Map, activities array, inProgressActivities array, teams Map, config object with pointConfig, metadata) |
| 1581-1584 | `selectedFiles` initialization (course array, teams array) |
| 1586-1590 | `bulkSelection` initialization (users Set, activities Set) |
| 1592-1606 | `sortState` initialization (users, activities, teams -- each has field + ascending) |

#### B2. Utility Functions (lines 1608-1638)

| Lines | Function | Purpose |
|-------|----------|---------|
| 1609-1617 | `log(message)` | Appends timestamped message to `#importLog` innerHTML and console.log |
| 1619-1621 | `getCurrentMonth()` | Returns `YYYY-MM` string from `new Date()` |
| 1623-1625 | `formatDate(dateStr)` | Returns `toLocaleDateString()` |
| 1627-1629 | `formatNumber(num)` | Returns `toLocaleString()` |
| 1632-1638 | `scrollToSection(event, sectionId)` | Smooth-scrolls to an element by ID |

#### B3. Data Persistence (lines 1641-1841)

| Lines | Function | Purpose |
|-------|----------|---------|
| 1641-1681 | `loadData()` | Reads `cloudCompData` from localStorage, reconstitutes Maps from Objects, calls `loadConfiguration` and `refreshDashboard` |
| 1683-1709 | `saveData()` | Serializes appData (converting Maps to Objects), writes to localStorage |
| 1712-1714 | `autoSave()` | Thin wrapper that calls `saveData()` |
| 1717-1738 | `exportData()` | Serializes appData to JSON, triggers download via `downloadJSON` |
| 1741-1743 | `importData()` | Shows import data modal |
| 1745-1748 | `closeImportDataModal()` | Hides modal, clears file input |
| 1750-1821 | `processImportData()` | Reads uploaded JSON file, validates structure, confirms with user, replaces all appData, calls autoSave + refresh |
| 1823-1833 | `downloadJSON(data, filename)` | Creates Blob, generates object URL, triggers download, revokes URL |
| 1835-1841 | `updateDataStatus(type, message)` | Updates header status indicator class and text |

#### B4. Tab Management (lines 1844-1894)

| Lines | Function | Purpose |
|-------|----------|---------|
| 1844-1894 | `showTab(tabName)` | Clears bulk selections, hides all `.tab-content`, removes `.active` from all `.tab-button`, shows selected section, refreshes relevant table |

#### B5. Dashboard Rendering (lines 1897-2073)

| Lines | Function | Purpose |
|-------|----------|---------|
| 1897-1921 | `refreshDashboard()` | Updates 6 stat cards, calls `updateLeaderboard`, `updateTeamLeaderboard`, `updateRecentActivities`, `updateActivityCharts` |
| 1923-1947 | `updateLeaderboard()` | Sorts users by `currentMonthPoints` desc, renders top 10 into `#leaderboardBody` via innerHTML |
| 1949-2007 | `updateTeamLeaderboard()` | Calls `updateAllTeamPoints`, sorts teams by `currentMonthPoints` desc, renders top 5 into `#teamLeaderboardBody` |
| 2009-2031 | `updateRecentActivities()` | **Sorts `appData.activities` in-place** by completedDate desc, renders top 10 |
| 2033-2073 | `updateActivityCharts()` | Counts course types, shows top 5 distribution, monthly count, completion rate percentage |

#### B6. Team Management (lines 2076-2457)

| Lines | Function | Purpose |
|-------|----------|---------|
| 2076-2113 | `createTeam()` | Reads modal fields, checks duplicate names, creates team object with timestamp ID, saves |
| 2115-2117 | `openCreateTeamModal()` | Shows modal |
| 2119-2125 | `closeCreateTeamModal()` | Hides modal, clears form |
| 2127-2154 | `openManageTeamMembers(teamId)` | Populates available-users select (excluding current members), shows member list |
| 2156-2158 | `closeManageTeamMembersModal()` | Hides modal |
| 2160-2190 | `addUsersToTeam()` | Adds selected users to team.members, sets user.teamId, recalculates points |
| 2192-2213 | `removeUserFromTeam(teamId, userEmail)` | Removes from team.members, deletes user.teamId, recalculates points |
| 2215-2242 | `updateTeamMembersList(teamId)` | Renders current members in manage-modal via innerHTML |
| 2244-2258 | `updateTeamPoints(teamId)` | Sums `currentMonthPoints` and `totalPoints` from member user objects |
| 2260-2264 | `updateAllTeamPoints()` | Iterates all teams, calls `updateTeamPoints` for each |
| 2266-2289 | `deleteTeam(teamId)` | Confirms, removes teamId from all members, deletes from Map |
| 2291-2389 | `refreshTeamsTable()` | Calls `updateAllTeamPoints`, sorts, renders all teams into `#teamsTableBody` via innerHTML |
| 2392-2401 | `toggleTeamSort(field)` | Toggles sort field/direction for teams |
| 2404-2407 | `toggleTeamSortOrder()` | Toggles ascending/descending for teams |
| 2409-2442 | `updateTeamSortButtons()` | Highlights active sort button, updates order label |
| 2444-2457 | `filterTeams()` | Hides/shows table rows based on search text match |

#### B7. Point Configuration (lines 2460-2572)

| Lines | Function | Purpose |
|-------|----------|---------|
| 2460-2491 | `updatePointConfig()` | Reads 18 DOM input values into `appData.config.pointConfig` via `parseInt` |
| 2493-2524 | `loadConfiguration()` | Writes 18 config values from `appData.config.pointConfig` to DOM inputs |
| 2526-2558 | `resetToDefaults()` | Sets 18 DOM inputs to hardcoded default values, calls `updatePointConfig` |
| 2560-2568 | `saveConfiguration()` | Calls `updatePointConfig` + `autoSave`, shows confirmation message |
| 2570-2572 | `exportConfig()` | Downloads config as JSON |

#### B8. Point Calculation Engine (lines 2575-2622)

| Lines | Function | Purpose |
|-------|----------|---------|
| 2575-2622 | `calculatePoints(courseLevel, courseType, activityType, score, placement)` | Returns point value based on activity type, course type keyword matching, then level fallback |

#### B9. File Import Pipeline (lines 2625-3256)

| Lines | Function | Purpose |
|-------|----------|---------|
| 2625-2641 | `updateFileList(type, files)` | Updates file list display text, enables/disables process button |
| 2644-2696 | `processAllFiles()` | Orchestrates sequential processing of all course + Teams files, updates metadata, calls autoSave |
| 2698-2769 | `processCourseFile(file)` | FileReader wrapper, uses XLSX to parse, detects ILT format, falls back to header-row course parsing |
| 2772-2802 | `detectClassroomTrainingFormat(jsonData)` | Heuristic: looks for email in col[1] + "completed" in col[2] within first 10 rows |
| 2805-2904 | `processClassroomTrainingFile(jsonData, filename)` | Iterates rows, creates activities with ILT courseId, dedup by userEmail+courseId |
| 2906-2958 | `processTeamsFile(file)` | FileReader wrapper, calls `parseTeamsMeetingData` + `processTeamsMeetingActivities`, creates users |
| 2962-3051 | `parseTeamsMeetingData(content, filename)` | Line-by-line CSV parser, extracts meeting titles/attendees/emails, generates placeholder emails |
| 3054-3089 | `processTeamsMeetingActivities(meetingData, filename)` | Creates activity objects for each attendee per meeting, dedup by userEmail+meetingId |
| 3091-3255 | `processRecord(record, index, filename)` | Processes a single course record: handles IN PROGRESS vs COMPLETED, dedup, point calculation, user creation/update |
| 3257-3267 | `parseDate(dateStr)` | Parses date string to ISO, returns null on failure |
| 3269-3272 | `getMonthFromDate(isoDate)` | Extracts `YYYY-MM` from ISO date |
| 3274-3298 | `updateImportStats(totalProcessed, totalActivities, totalInProgress)` | Renders import summary cards |

#### B10. User Table & Bulk Operations (lines 3301-3640)

| Lines | Function | Purpose |
|-------|----------|---------|
| 3301-3356 | `refreshUsersTable()` | Sorts users by current sort state, renders all into `#usersTableBody` via innerHTML |
| 3359-3366 | `toggleUserSelection(email)` | Adds/removes email from `bulkSelection.users` |
| 3368-3384 | `toggleSelectAllUsers()` | Checks/unchecks all user checkboxes |
| 3386-3394 | `selectAllUsers()` | Selects all visible users |
| 3396-3404 | `deselectAllUsers()` | Clears all user selections |
| 3406-3430 | `updateBulkSelectionUI(type)` | Shows/hides bulk actions bar, updates count |
| 3433-3441 | `bulkAwardPoints()` | Opens bulk award modal with count |
| 3443-3448 | `closeBulkAwardPointsModal()` | Hides modal, clears fields |
| 3450-3500 | `submitBulkAwardPoints()` | Creates an activity per selected user, updates points, saves |
| 3502-3517 | `bulkAssignTeam()` | Populates team dropdown, opens modal |
| 3519-3522 | `closeBulkAssignTeamModal()` | Hides modal |
| 3524-3565 | `submitBulkAssignTeam()` | Adds users to team, removes from old team, updates points |
| 3567-3594 | `bulkExportUsers()` | Exports selected user data as JSON |
| 3597-3607 | `toggleUserSort(field)` | Toggles sort field/direction |
| 3609-3612 | `toggleUserSortOrder()` | Toggles ascending/descending |
| 3614-3629 | `updateUserSortButtons()` | Highlights active sort button |
| 3631-3639 | `filterUsers()` | Hides/shows rows by text match |

#### B11. Activity Table & Bulk Operations (lines 3641-4013)

| Lines | Function | Purpose |
|-------|----------|---------|
| 3641-3710 | `refreshActivitiesTable()` | Sorts activities, renders all into `#activitiesTableBody` via innerHTML |
| 3713-3720 | `toggleActivitySelection(activityId)` | Adds/removes from `bulkSelection.activities` |
| 3722-3738 | `toggleSelectAllActivities()` | Checks/unchecks all activity checkboxes |
| 3740-3748 | `selectAllActivities()` | Selects all |
| 3750-3759 | `deselectAllActivities()` | Clears all |
| 3761-3769 | `bulkAdjustPoints()` | Opens adjust-points modal |
| 3771-3776 | `closeBulkAdjustPointsModal()` | Hides modal |
| 3778-3856 | `submitBulkAdjustPoints()` | Applies add/subtract/multiply/set to selected activities, updates user+team points, records adjustment history |
| 3858-3911 | `bulkDeleteActivities()` | Confirms, removes activities via `.splice()`, adjusts user points, updates team points |
| 3913-3943 | `bulkExportActivities()` | Exports selected activity data as JSON |
| 3946-3956 | `toggleActivitySort(field)` | Toggles sort field/direction |
| 3958-3961 | `toggleActivitySortOrder()` | Toggles ascending/descending |
| 3963-3982 | `updateActivitySortButtons()` | Highlights active sort button |
| 3984-4013 | `filterActivities()` | Filters by text search + dropdown (all/current-month/courses/events) |

#### B12. Manual Points & Modals (lines 4016-4088)

| Lines | Function | Purpose |
|-------|----------|---------|
| 4016-4018 | `addManualPoints()` | Shows add-points modal |
| 4020-4027 | `closeAddPointsModal()` | Hides modal, clears fields |
| 4029-4088 | `submitManualPoints()` | Creates manual activity, updates/creates user, saves |

#### B13. Reports & Monthly Reset (lines 4091-4220)

| Lines | Function | Purpose |
|-------|----------|---------|
| 4091-4111 | `generateLeaderboardReport()` | Downloads current-month leaderboard as JSON |
| 4113-4133 | `generateActivityReport()` | Downloads all activities as JSON |
| 4135-4171 | `generateSummaryReport()` | Downloads summary stats + top users/teams as JSON |
| 4173-4208 | `resetMonthlyLeaderboard()` | Confirms, archives current leaderboard as download, zeros all `currentMonthPoints` |
| 4210-4212 | `confirmMonthlyReset()` | Calls `resetMonthlyLeaderboard()` (unnecessary wrapper) |
| 4214-4217 | `viewUserDetails(email)` | **Stub** -- `alert('Feature coming soon!')` |
| 4219-4222 | `editActivity(activityId)` | **Stub** -- `alert('Feature coming soon!')` |

#### B14. Initialization (lines 4224-4247)

| Lines | Function | Purpose |
|-------|----------|---------|
| 4225-4228 | `courseFiles` change listener | Populates `selectedFiles.course` |
| 4230-4233 | `teamsFiles` change listener | Populates `selectedFiles.teams` |
| 4236-4246 | `DOMContentLoaded` handler | Calls `loadData()`, initializes sort buttons after 100ms timeout |

---

## 2. Global Variables

| Variable | Type | What It Stores |
|----------|------|----------------|
| `appData` | Object | Entire application state. Contains: |
| `appData.users` | `Map<email, User>` | All users keyed by lowercase email. User shape: `{ email, name, firstName, lastName, currentMonthPoints, totalPoints, activities: string[], inProgressActivities: string[], joinDate, lastActivity, teamId? }` |
| `appData.activities` | `Array<Activity>` | All completed activities. Activity shape: `{ id, userEmail, courseId, title, level, courseType, pointsEarned, completedDate, score?, source, importDate, monthYear, description?, adjustmentHistory? }` |
| `appData.inProgressActivities` | `Array<InProgressActivity>` | Courses started but not completed. Shape: `{ id, userEmail, courseId, title, level, courseType, progress, startedDate, lastAccessed, estimatedHours, timeSpent, source, importDate, status }` |
| `appData.teams` | `Map<teamId, Team>` | All teams. Team shape: `{ id, name, description, color, members: email[], createdDate, currentMonthPoints, totalPoints }` |
| `appData.config` | Object | `{ pointConfig: {...}, lastReset: 'YYYY-MM', version: '1.1' }` |
| `appData.config.pointConfig` | Object | Nested: `awsCourseTypes`, `generalCourses`, `events`, `hackathons`, `quizzes` (see Section 3) |
| `appData.metadata` | Object | `{ lastImport: ISO|null, totalRecordsProcessed: number, sources: string[] }` |
| `selectedFiles` | Object | `{ course: File[], teams: File[] }` -- files chosen but not yet processed |
| `bulkSelection` | Object | `{ users: Set<email>, activities: Set<activityId> }` -- currently checked items |
| `sortState` | Object | `{ users: {field, ascending}, activities: {field, ascending}, teams: {field, ascending} }` |

**No other globals exist.** All 95 functions are declared at the top-level `<script>` scope (no modules, no closures wrapping state).

---

## 3. All Point Calculation Rules

### A. Default Point Values (from `appData.config.pointConfig`)

**AWS Course Types** (`awsCourseTypes`):

| Key | Default Points |
|-----|---------------|
| `AWS Builder Lab` | 100 |
| `AWS Cloud Quest` | 75 |
| `AWS Jam Journey` | 150 |
| `AWS Simulearn` | 75 |
| `Certification Exam Preparation` | 100 |
| `Digital Course With Lab` | 100 |

**General Courses** (`generalCourses`):

| Key | Default Points |
|-----|---------------|
| `Classroom Training` | 100 |
| `Digital Courses - Foundational` | 50 |
| `Digital Courses - Associate` | 75 |
| `Digital Courses - Professional` | 100 |
| `Digital Courses - Specialty` | 100 |

**Events** (`events`):

| Key | Default Points |
|-----|---------------|
| `Live Events` | 25 |

**Hackathons** (`hackathons`):

| Key | Default Points |
|-----|---------------|
| `Hackathons - Participation` | 150 |
| `Hackathons - 3rd Place` | 250 |
| `Hackathons - 2nd Place` | 350 |
| `Hackathons - 1st Place` | 450 |

**Quizzes** (`quizzes`):

| Key | Default Points |
|-----|---------------|
| `Quiz Completion` | 20 |
| `Quiz 80%+ Score` | 50 |
| `Quiz Perfect Score` | 70 |

### B. `calculatePoints()` Resolution Order (line 2575)

The function takes `(courseLevel, courseType, activityType='course', score=null, placement=null)` and resolves in this priority:

1. **If `activityType === 'live_event'`** -- return `events['Live Events']` (25)
2. **If `activityType === 'hackathon'`** -- return placement-based value (450/350/250/150)
3. **If `activityType === 'quiz'`** -- return score-based value:
   - `score === 100` -- Perfect (70)
   - `score >= 80` -- 80%+ (50)
   - else -- Completion (20)
4. **If `courseType` exactly matches a key in `awsCourseTypes`** -- return that value
5. **If `courseType` contains a keyword** (checked in this order):
   - `'Builder Lab'` -- 100
   - `'Cloud Quest'` -- 75
   - `'Jam Journey'` -- 150
   - `'Simulearn'` -- 75
   - `'Certification Exam Preparation'` -- 100
   - `'With Lab'` -- 100
   - `'Classroom'` -- 100
6. **If `courseLevel` matches** (case-insensitive):
   - `'fundamental'` -- 50
   - `'intermediate'` -- 75
   - `'advanced'` -- 100
   - `'specialty'` -- 100
7. **Default fallback** -- 50 (`Digital Courses - Foundational`)

### C. Where Points Are Awarded Outside `calculatePoints()`

- **Classroom training** (line 2852): Uses `appData.config.pointConfig.generalCourses['Classroom Training'] || 100` directly, bypassing `calculatePoints()`
- **Manual points** (line 4032): User specifies arbitrary point value
- **Bulk award** (line 3469): User specifies arbitrary point value per user
- **Bulk adjust** (line 3778-3810): add/subtract/multiply/set operations on existing activity points

### D. Quiz Detection Logic (line 3200)

A record is classified as `activityType = 'quiz'` if `courseType` contains `'Quiz'` or `'Card Clash'`. Score is parsed from the `Score` column only in this case.

---

## 4. Duplicate Detection Logic -- Exactly How It Works

There are **four separate dedup checks**, each using different criteria:

### A. Course Records (`processRecord`, line 3179)

```
Completed: appData.activities.find(a => a.userEmail === email && a.courseId === courseId)
```
- Key: `userEmail` (lowercased) + `courseId` (from spreadsheet `Course ID` column)
- If found: skips the record entirely
- **Reliable** because `courseId` comes from the source data and is deterministic

### B. In-Progress Records (`processRecord`, line 3116)

```
In-progress: appData.inProgressActivities.find(a => a.userEmail === email && a.courseId === courseId)
```
- Key: same `userEmail` + `courseId`
- If found: updates `progress` and `lastAccessed` on the existing record (does NOT create duplicate)
- **Reliable** for the same reason as above

### C. Classroom Training / ILT (`processClassroomTrainingFile`, line 2860)

```
appData.activities.some(a => a.userEmail === activity.userEmail && a.courseId === activity.courseId)
```
- Key: `userEmail` (lowercased) + `courseId`
- `courseId` is generated as: `ILT_${filename.replace(/[^a-zA-Z0-9]/g, '_')}_${index}`
- **Partially reliable**: Dedup works IF you re-import the exact same file (same filename, same row order). But if the filename changes, or rows are reordered, different courseIds are generated and dedup fails.

### D. Teams Meetings (`processTeamsMeetingActivities`, line 3061)

```
appData.activities.find(a => a.userEmail === email && a.courseId === meeting.meetingId)
```
- Key: `userEmail` + `meetingId`
- `meetingId` is generated as: `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
- **Broken**: Because `meetingId` is random + timestamp-based, re-importing the same CSV always generates new meetingIds. Dedup never catches anything across separate imports.

### E. Also-completed check (`processRecord`, line 3185)

When a COMPLETED record matches an existing in-progress record (same `userEmail` + `courseId`), the in-progress entry is removed via `splice()`. The user's `inProgressActivities` list is then filtered by prefix `'inprogress_'` rather than by the specific ID -- this is **overly broad** and would remove ALL in-progress references from that user.

---

## 5. Bugs and Edge Cases

### Confirmed Bugs

1. **`updateRecentActivities` sorts the master array in-place** (line 2010-2011)
   - `appData.activities.sort(...)` mutates the canonical activity list. Every dashboard render reorders the global array. Subsequent code that assumes insertion order or any other ordering will behave unpredictably.

2. **In-progress cleanup is overly broad** (line 3192-3193)
   - When a course completes, the code does `user.inProgressActivities = user.inProgressActivities.filter(id => !id.startsWith('inprogress_'))` which removes ALL in-progress references from the user, not just the one that completed.

3. **Teams meeting dedup is non-functional** (line 2994)
   - `meetingId` uses `Date.now()` + random, so re-importing the same CSV creates entirely new IDs. The dedup check on line 3061 will never find a match from a previous import.

4. **Dead variable `duplicateKey`** (line 3060)
   - Assigned `const duplicateKey = \`${email}|${meeting.meetingId}\`` but never used anywhere.

5. **Classroom training always uses today's date** (line 2810)
   - `const completedDate = new Date().toISOString()` -- all ILT activities are recorded as happening today regardless of when the training actually occurred.

6. **Classroom training always uses current month** (line 2856)
   - `monthYear: currentMonth` -- even if the training happened months ago, points go to the current month.

7. **`parseInt` without NaN guard** (lines 2462-2488)
   - If a user clears a config input field, `parseInt('')` returns `NaN`. This `NaN` is stored in the config and propagates: `calculatePoints` returns `NaN`, activities get `NaN` points, `user.totalPoints` becomes `NaN`.

8. **Version string inconsistency**
   - Header HTML says `v1.2` (line 59)
   - `appData.config.version` says `'1.1'` (line 1572)
   - Manual section says `Version: 1.1` (line 1298)

9. **`filterActivities` uses fragile regex on onclick** (line 3992)
   - `row.querySelector('button').onclick.toString().match(/'([^']+)'/)` -- this parses the stringified onclick handler to extract the activity ID. Will break if the onclick format changes, or if there are no buttons in the row.

10. **Bulk award uses shared `courseId`** (line 3466)
    - All activities in a bulk award share the same `courseId: \`bulk_${Date.now()}\``. Since `Date.now()` has millisecond resolution and the loop is synchronous, all activities in a batch get the same courseId. This means subsequent dedup checks could false-positive if the same user appears twice in a bulk selection.

### Edge Cases

11. **Email case normalization is inconsistent**
    - `processRecord` lowercases email (line 3092). `processClassroomTrainingFile` lowercases (line 2847). But `processTeamsFile` does NOT lowercase when creating users (line 2922-2924) -- uses whatever the activity has. This could create duplicate users for the same person.

12. **User creation is inconsistent across importers**
    - Course importer uses `First Name` + `Last Name` from the record
    - Classroom importer uses `row[0]` (the Name column)
    - Teams importer generates `Meeting Attendee ${randomId}` as the name
    - If the same email is first imported from Teams (getting a placeholder name) and later from courses, the name is never updated.

13. **`team.members` can contain emails for deleted/non-existent users**
    - No cleanup happens if a user is somehow removed. The `updateTeamPoints` function uses `appData.users.get(email)` with optional chaining, so it silently treats missing users as 0 points, but the member count in the UI would still show them.

14. **No pagination** -- All users, teams, and activities are rendered in a single pass. With hundreds of activities, this becomes slow and the DOM gets heavy.

15. **`addUsersToTeam` does not remove user from previous team**
    - Unlike `submitBulkAssignTeam` (which does remove from old team), `addUsersToTeam` on line 2167-2177 only sets `user.teamId` without removing from the old team's `members` array. This creates a state where a user appears in two teams' member lists but `user.teamId` only points to the latest one.

16. **Monthly reset does not clear activities' `monthYear`**
    - `resetMonthlyLeaderboard` zeros user `currentMonthPoints` but does not touch the activities themselves. If `getCurrentMonth()` still returns the same month (e.g., reset early in the month), subsequent imports will re-add points to `currentMonthPoints` for the same month's activities because the check on line 3250 (`if (monthYear === getCurrentMonth())`) still matches.

---

## 6. Functions Exceeding 40 Lines

**20 functions** out of 95 total exceed 40 lines:

| Function | Lines | Length | Primary concern |
|----------|-------|--------|-----------------|
| `processRecord` | 3091-3255 | **166** | Course record processing -- handles IN PROGRESS + COMPLETED + dedup + user creation |
| `refreshTeamsTable` | 2291-2389 | **101** | Team table rendering with sort + template |
| `processClassroomTrainingFile` | 2805-2904 | **101** | ILT file processing -- row iteration + dedup + user creation |
| `parseTeamsMeetingData` | 2962-3051 | **92** | Teams CSV line-by-line parser |
| `submitBulkAdjustPoints` | 3778-3856 | **80** | Bulk point adjustment with 4 arithmetic modes |
| `processCourseFile` | 2698-2769 | **74** | XLSX parsing + ILT detection + record processing loop |
| `processImportData` | 1750-1821 | **73** | JSON backup import with validation |
| `refreshActivitiesTable` | 3641-3710 | **72** | Activity table rendering with sort + template |
| `submitManualPoints` | 4029-4088 | **62** | Manual point award with user creation |
| `updateTeamLeaderboard` | 1949-2007 | **60** | Team leaderboard rendering |
| `refreshUsersTable` | 3301-3356 | **58** | User table rendering with sort + template |
| `processTeamsFile` | 2906-2958 | **56** | Teams file reading + user creation |
| `bulkDeleteActivities` | 3858-3911 | **55** | Bulk activity deletion with point reversal |
| `processAllFiles` | 2644-2696 | **54** | Import orchestrator |
| `showTab` | 1844-1894 | **53** | Tab switching + refresh dispatch |
| `submitBulkAwardPoints` | 3450-3500 | **52** | Bulk point award |
| `calculatePoints` | 2575-2622 | **50** | Point calculation with cascading rules |
| `submitBulkAssignTeam` | 3524-3565 | **43** | Bulk team assignment |
| `updateActivityCharts` | 2033-2073 | **43** | Chart section rendering |
| `loadData` | 1641-1681 | **42** | localStorage deserialization |

The longest function (`processRecord` at 166 lines) handles 4 different code paths and should be the highest priority for extraction.
