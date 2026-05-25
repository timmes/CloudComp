# Quality Issues

_Last updated: 2026-04-15_
_Test run: 416/416 passed (13 test files)_

---

## Test Suite Status

All tests pass. No failures.

---

## Coverage Gaps (all resolved)

All gaps identified below have been resolved with 52 new tests.

---

### GAP-001 — `src/importers/course-type-map.js` has zero tests — RESOLVED (19 tests added)

**Module:** `src/importers/course-type-map.js`
**Exports:** `COURSE_TYPE_RULES`, `DEFAULT_COURSE_MAPPING`, `resolveCourseMapping`
**Introduced in:** Point Configuration Revamp v2.0
**Test file missing:** `tests/importers/course-type-map.test.js` does not exist.

`resolveCourseMapping()` is called by both `course-importer.js` and indirectly by `teams-importer.js`. It is a pure function with branching logic — first-match wins on ordered rules, case-insensitive substring match, and a fallback default. None of these paths are exercised in isolation.

Paths not covered:
- Each of the 12 `COURSE_TYPE_RULES` entries resolving correctly
- Default fallback when no rule matches
- Case-insensitivity of the match
- Null/undefined `courseType` input (the `?? ''` guard)
- Rule ordering (e.g. `'jam journey'` must match before `'jam'`)

**Assign to:** architect agent

---

### GAP-002 — `state.js` new functions `replaceActivity`, `migrateActivities`, `migrateConfig` are untested — RESOLVED (14 tests added)

**Module:** `src/core/state.js`
**Functions:** `replaceActivity`, `migrateActivities` (private but exercised via `loadFromStorage`/`importJSON`), `migrateConfig` (private, exercised via `loadFromStorage`)
**Introduced in:** Activity Status Model change set

The existing `state.test.js` imports and tests 16 functions but does not cover:
- `replaceActivity`: returns `true` on success, `false` when id not found, replaces without mutation, persists and emits `DATA_CHANGED`
- `migrateActivities` via `loadFromStorage`: legacy records without a `status` field should have `status: 'completed'` backfilled after load
- `migrateActivities` via `importJSON`: same backfill path
- `migrateConfig` via `loadFromStorage`: a stored config with `version < '2.0'` (or no `version`) should be replaced with `DEFAULT_POINT_CONFIG` and `version: '2.0'`
- `getActivities({ status: 'in_progress' })`: the `status` filter added to `getActivities` has no test at all

**Assign to:** architect agent

---

### GAP-003 — `deduplication.js` status-upgrade logic is untested — RESOLVED (11 tests added)

**Module:** `src/importers/deduplication.js`
**Functions:** `isStatusUpgrade` (private), `isDuplicate` (status-upgrade branch), `deduplicateBatch` (upgrades array + stats.upgraded)
**Introduced in:** Activity Status Model change set

Existing `deduplication.test.js` covers 18 cases but none touch the status-upgrade path added in this change set:

- `isDuplicate` should return `false` when incoming has a higher status rank than the existing match (e.g. `enrolled` → `completed`)
- `isDuplicate` should still return `true` when incoming has equal or lower status rank (e.g. `completed` → `in_progress`)
- `deduplicateBatch` should populate `result.upgrades` and leave `result.accepted` unchanged for upgrade rows
- `deduplicateBatch` `stats.upgraded` should count upgrade rows
- `deduplicateBatch` regression: a status-upgraded row within a subsequent import batch should itself be upgradeable again (the `existingByKey.set(key, activity)` path inside the loop)

**Assign to:** architect agent

---

### GAP-004 — `activity.js` `status` field default and validation untested — RESOLVED (5 tests added)

**Module:** `src/models/activity.js`
**Introduced in:** Activity Status Model change set

`activity.test.js` confirms `status` appears in the list of 12 keys (line 150) but never tests:
- Default value is `'completed'` when `status` is not supplied
- Explicit `'in_progress'` and `'enrolled'` values are preserved as-is
- Any other string value is accepted (no validation today — noting absence of rejection test)

**Assign to:** architect agent

---

## Summary

| Gap ID | Module | Tests Added | Status |
|--------|--------|-------------|--------|
| GAP-001 | `src/importers/course-type-map.js` | 19 tests in `tests/importers/course-type-map.test.js` | RESOLVED |
| GAP-002 | `src/core/state.js` | 14 tests appended to `tests/core/state.test.js` | RESOLVED |
| GAP-003 | `src/importers/deduplication.js` | 11 tests appended to `tests/importers/deduplication.test.js` | RESOLVED |
| GAP-004 | `src/models/activity.js` | 5 tests appended to `tests/models/activity.test.js` | RESOLVED |
