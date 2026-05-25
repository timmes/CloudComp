# Ready for Testing

Modules listed here are extracted, code-reviewed, and ready for the Quality agent to write tests against.

| Module | Exports | Status | Notes |
|--------|---------|--------|-------|
| `src/models/points.js` | `DEFAULT_POINT_CONFIG`, `calculateCoursePoints`, `calculateQuizBonus`, `calculateHackathonPoints`, `calculateMeetingPoints`, `getTotalPoints`, `getMonthPoints`, `getCampaignPoints` | TESTED | Pure functions, no DOM/storage deps. All 18 point values match monolith. Case-insensitive courseType matching. 67 tests. |
| `src/core/storage.js` | `load`, `save`, `remove`, `getQuotaUsedKB`, `setQuotaWarningHandler` | TESTED | Only module that touches localStorage. 4 MB quota guard returns `false` on breach. Never throws. 32 tests. |
| `src/core/events.js` | `EVENTS`, `on`, `off`, `emit` | TESTED | Minimal pub/sub bus. 7 event constants. Wires `STORAGE_QUOTA_WARNING` to storage.js on import. 21 tests. |
| `src/core/state.js` | `getUsers`, `getUser`, `getTeams`, `getActivities`, `getCampaigns`, `getCampaign`, `getConfig`, `upsertUser`, `upsertTeam`, `addActivity`, `upsertCampaign`, `deleteCampaign`, `updateConfig`, `loadFromStorage`, `exportJSON`, `importJSON`, `_resetForTesting` | TESTED | Single source of truth. Reads return shallow copies. Writes persist + emit DATA_CHANGED. 73 tests. |
| `src/models/user.js` | `createUser`, `addPointsToUser` | TESTED | User typedef + factory + immutable point adder. 21 tests. |
| `src/models/team.js` | `createTeam`, `calculateTeamPoints`, `calculateTeamMonthPoints` | TESTED | Team typedef + factory + point aggregation. 19 tests. |
| `src/models/activity.js` | `createActivity`, `generateActivityId` | TESTED | Activity typedef + factory + deterministic ID. 28 tests. |
| `src/models/campaign.js` | `createCampaign`, `isCampaignActive`, `getCampaignParticipantIds`, `getCampaignLeaderboard`, `getCampaignTeamLeaderboard` | TESTED | Campaign typedef + participant auto-inclusion via teams + leaderboards with tie-breaking. 38 tests. |
| `src/models/index.js` | _(barrel)_ | TESTED | Re-exports all 20 model functions. 20 tests. |
| `src/importers/deduplication.js` | `isDuplicate`, `deduplicateBatch` | TESTED | Key: `userId + externalId`, case-insensitive. Within-batch dedup included. Does not mutate inputs. Contract documented in ARCH_DECISIONS.md (ADR-001). 24 tests. |
| `src/importers/course-importer.js` | `importCourseFile` | TESTED | Parses XLSX/CSV via injected XLSX lib. Auto-detects ILT vs standard course format. Returns `Promise<ImportResult>`. Supports `dryRun`. Per-row fault tolerance. ILT "Not Completed" bug fixed. 35 tests. |
| `src/importers/teams-importer.js` | `importTeamsFile` | TESTED | Parses Teams meeting CSV strings. Deterministic meetingId from title. Returns `Promise<ImportResult>`. Supports `dryRun`. Extracts date from filename. 27 tests. |

## Changes Since Initial Extraction

### Design System + UI Restyling
- `src/styles/design-tokens.css` — Added: `.cc-modal-*` (modal backdrop/header/body/footer/close), `.cc-input/.cc-select/.cc-textarea` (form controls), `.cc-label/.cc-field-group/.cc-field-hint/.cc-field-row` (form layout), `.cc-btn-danger`, `.cc-empty-state-*` (empty state pattern)
- `index.html` — All 8 modals restyled with design system classes. Emojis removed from modal titles. Close X buttons added.
- Empty states added: dashboard (cloud icon + CTA), teams table, campaigns table.

### Dashboard Enhancements
- `src/views/shared.js` — Added `getCurrentQuarterRange()`, `getCurrentYearPrefix()`. Extended points cache from `{total, month}` to `{total, month, quarter, year}` per user in single O(M) pass. Added `getUserQuarterPoints(email)`, `getUserYearPoints(email)`. Extended `getUserWithPoints`/`getUsersWithPoints` to include `currentQuarterPoints`/`currentYearPoints`.
- `src/views/teams.js` — `updateTeamPoints()` now also computes `currentQuarterPoints` and `currentYearPoints`.
- `src/views/dashboard.js` — Full refactor: module-level filter state (`_subTab`, `_timePeriod`, `_courseTypeFilter`). Exported actions: `setDashboardSubTab`, `setDashboardTimePeriod`, `setDashboardCourseTypeFilter`, `clearDashboardCourseTypeFilter`. On-the-fly `computeUserPoints()` for filtered views. Activity charts always unfiltered (for selection UI). Recent activities responds to both time period and course type filter.
- `index.html` — Dashboard: 4 summary + 3 time-period metric cards. Users/Teams sub-tabs. Month/Quarter/Year toggle. Course-type filter indicator. 2-column leaderboard layout.
- `src/main.js` — Registered 4 new dashboard actions.

### Activity Status Model
- `src/models/activity.js` — Added `status: 'completed' | 'in_progress' | 'enrolled'` field, defaults to `'completed'`.
- `src/core/state.js` — Added `migrateActivities()` for backward compat (backfills `status: 'completed'` on legacy records). Applied in `loadFromStorage` and `importJSON`. Added `status` filter to `getActivities`. Added `replaceActivity(activity)` for status upgrades.
- `src/importers/course-importer.js` — No longer discards IN PROGRESS/ENROLLED rows. Added `mapStatus()` helper. Non-completed activities get `pointsEarned: 0` and `completedDate: null`.
- `src/importers/deduplication.js` — Added `isStatusUpgrade()`. `isDuplicate()` returns false for status upgrades. `deduplicateBatch()` returns `upgrades` array + `stats.upgraded` count.
- `src/models/points.js` — Added `if (a.status && a.status !== 'completed') continue` guard to `getTotalPoints`, `getMonthPoints`, `getCampaignPoints`.
- `src/views/shared.js` — Same status guard in `ensurePointsCache()`. Re-exports `replaceActivity`.
- `src/views/dashboard.js` — `computeCompletionRate()` replaces hardcoded 100%. Status guard in `computeUserPoints()`.
- `src/views/activities.js` — Added Status column with colored badges. Added `statusLabel()` and `statusClass()` helpers.
- `src/views/import.js` — `commitImportResult()` handles `upgrades` via `replaceActivity()`. Updated dedup log message.
- `index.html` — Added Status header to activities table.

### Dashboard Enhancements
- `src/views/shared.js` — Added `getCurrentQuarterRange()`, `getCurrentYearPrefix()`. Extended points cache to `{total, month, quarter, year}`. Added `getUserQuarterPoints`, `getUserYearPoints`.
- `src/views/teams.js` — `updateTeamPoints()` computes `currentQuarterPoints` and `currentYearPoints`.
- `src/views/dashboard.js` — Full refactor: sub-tabs (users/teams), time-period toggle (month/quarter/year), course-type filter, `computeUserPoints()` for filtered views, `computeCompletionRate()`. Recent activities responds to all filters.
- `index.html` — Dashboard: 4 summary + 3 time-period metric cards, sub-tabs, time-period toggle, course-type filter indicator, 2-column leaderboard layout. `dashboardContent` hidden by default (prevents flash).
- `src/main.js` — Registered dashboard filter actions.

### Reports View Revamp
- `src/views/reports.js` — Full rewrite: sub-tabs (users/teams), entity search with autocomplete, Chart.js YTD bar chart + course-type doughnut, summary metrics, JSON exports kept. Removed `resetMonthlyLeaderboard`, `confirmMonthlyReset`, `_setRefreshFns`.
- `src/views/tabs.js` — Added `refreshReports()` on tab switch.
- `index.html` — Chart.js CDN added. Reports section replaced with sub-tabs, search, charts, export buttons. Dashboard Reset button removed.
- `src/main.js` — Updated reports imports/ACTIONS.

### Configuration View Revamp
- `src/views/config.js` — Removed `resetToDefaults`, `exportConfig`. Added `openResetDataModal`, `closeResetDataModal`, `confirmResetAllData`. Uses `importJSON` to wipe data.
- `index.html` — Config restyled with `cc-settings-row` pattern. Removed export/reset-defaults buttons. Added "Reset All Data" section with confirmation modal requiring "confirm deletion" text input.

### Import View Restyle
- `index.html` — Import section restyled with `cc-settings-row` pattern matching config layout. Two rows: Course Activities + MS Teams Meetings.
- `src/views/import.js` — Import stats use `cc-metric` cards.

### UI Consistency
- `index.html` — All search inputs (users, teams, campaigns, activities) use `cc-input` style matching reports.
- `src/views/users.js` — Empty state added for users table. "Add Points" button moved to activities view.
- `src/views/activities.js` — Empty state added. "Add Points" button added.
- `src/views/users.js` — Manual points modal: user email field replaced with search-with-autocomplete (`filterManualPointsUsers`, `selectManualPointsUser`).
- `src/main.js` — Registered manual points search actions.

### Point Configuration Revamp (v2.0)
- `src/models/points.js` — New `DEFAULT_POINT_CONFIG` with 5 categories (selfPacedDigital, liveLearning, certifications, gamifiedEvents, communityEngagement), 27 values. Replaced `calculateCoursePoints`, `calculateQuizBonus`, `calculateHackathonPoints`, `calculateMeetingPoints` with single `calculateActivityPoints(category, subCategory, config)`.
- **New:** `src/importers/course-type-map.js` — Mapping table (`COURSE_TYPE_RULES`) translating raw CourseType strings to `(category, subCategory)` pairs. `resolveCourseMapping()` function. Default: `Skill Builder 2-8h`.
- `src/importers/course-importer.js` — Uses `resolveCourseMapping()` + `calculateActivityPoints()`. Removed `resolveTypeAndPoints`.
- `src/importers/teams-importer.js` — Uses `calculateActivityPoints('liveLearning', 'Live Webinar', config)`.
- `src/core/state.js` — Version bumped to 2.0. Added `migrateConfig()` to replace old v1.x configs with new defaults.
- `src/views/config.js` — Rewritten with `FIELD_MAP` constant and `readSection`/`writeSection` helpers. 26 fields across 5 sections.
- `src/models/index.js` — Updated barrel exports (17 members, down from 20).
- `src/views/shared.js` — Updated re-exports: `calculateActivityPoints` replaces 4 old functions.
- `index.html` — 26 settings rows across 5 labeled sections (Self-Paced Digital Training, Live Learning Sessions, Certifications & Exams, Gamified Events & Challenges, Community Engagement).
