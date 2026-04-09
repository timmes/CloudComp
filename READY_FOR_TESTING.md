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
