# Architecture Decisions

## ADR-001: Deduplication key contract

**Date:** 2026-04-09
**Status:** Accepted
**Module:** `src/importers/deduplication.js`

### Context

The monolith had four separate dedup checks using inconsistent keys (AUDIT.md Section 4). Course records used `userEmail + courseId` (reliable). Classroom training used `userEmail + ILT_filename_index` (partially reliable — breaks on filename change or row reorder). Teams meetings used `userEmail + meetingId` where `meetingId` was `Date.now() + random` (fully broken — never catches re-imports).

### Decision

A single dedup key for all activity types: **`userId + externalId`**, case-insensitive.

- `userId` is the lowercased email address.
- `externalId` is the stable external identifier from the import source (e.g. `Course ID` column, meeting title + date hash, ILT session identifier).
- Both components are normalised: `userId` lowercased, `externalId` trimmed and lowercased.
- The key is compared as a concatenated string `userId|externalId`.

### Why not compare `activity.id`?

`generateActivityId(userId, externalId)` encodes the same two components, but legacy data may have IDs generated with a different scheme (timestamp-based, random). Comparing the raw components is forward- and backward-compatible.

### Consequences

- **Importers are responsible** for setting `externalId` to a stable, deterministic value. If an importer generates random IDs, dedup will not work — this is the importer's bug, not the dedup module's.
- Classroom training importers must derive `externalId` from file content (e.g. attendee email + session name), not from filename + row index.
- Teams meeting importers must derive `externalId` from meeting title + date, not from `Date.now()`.
- Within-batch dedup is included: two identical rows in one file are caught.

## ADR-002: Campaign participant auto-inclusion

**Date:** 2026-04-09
**Status:** Accepted
**Module:** `src/models/campaign.js`

### Decision

When a team is linked to a campaign via `teamIds`, all members of that team are automatically included as campaign participants. There is no mechanism to exclude individual team members. To exclude someone, remove them from the team or don't link the team.

### Rationale

This matches the simplest mental model: "link a team = everyone on it participates." An exclusion list adds complexity with no current use case.
