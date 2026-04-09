# Quality Issues

## [ARCH] getCampaignTeamLeaderboard — team member exclusion is impossible
- Module: `src/models/campaign.js`
- Test: `tests/models/campaign.test.js:321` — "does not include points from team members who are not campaign participants"
- Expected: When a team is linked via `teamIds`, only members who also appear in `participantIds` should have their points counted toward the team total
- Actual: `getCampaignParticipantIds` auto-includes ALL members of linked teams (per architect spec line 237), making it impossible for a team member to NOT be a campaign participant when their team is linked. The test expects 100 points (alice only) but gets 150 (alice + bob) because bob is auto-included via team t1.
- Root cause: Ambiguity in the architect spec — `getCampaignParticipantIds` unions participantIds + team members (lines 230-238), but the quality spec test case (line 271) assumes team members can be excluded from participation. These two requirements contradict each other.
- Resolution: Auto-inclusion accepted as intended. Linking a team via `teamIds` means all its members are campaign participants. Test updated to assert 150 points (alice + bob) and memberCount 2.
- Status: RESOLVED

## [ARCH] ILT importer treats "Not Completed" as completed
- Module: `src/importers/course-importer.js`
- Test: `tests/importers/course-importer.test.js:280` — "skips rows without completed status and adds warning"
- Expected: A row with status "Not Completed" should be skipped (not imported as an activity)
- Actual: `processILTRow` (line 164) checks `!status.toLowerCase().includes('completed')`. The string "Not Completed" contains the substring "completed", so it passes the check and gets imported as a completed activity.
- Root cause: Substring matching is too permissive. The monolith had the same bug (AUDIT.md line 2835 uses the same `.includes('completed')` pattern). The check should match the word "Completed" more strictly — e.g. trimming then checking equality, or using a regex like `/^completed$/i`.
- Resolution: Changed `processILTRow` line 164 from `status.toLowerCase().includes('completed')` to `status.toLowerCase() !== 'completed'` (strict equality). 405/405 tests pass.
- Status: RESOLVED
