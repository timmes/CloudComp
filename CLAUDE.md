# CloudComp — Claude Code Orchestrator Context

## What this app does
Browser-based gamification platform for AWS Skills Guilds.
Tracks course completions, awards points, runs team/individual leaderboards.
Zero-server — ships as a single self-contained HTML file using localStorage.

## Non-negotiables
- Build output must be a single self-contained HTML file (Vite + vite-plugin-singlefile)
- Tailwind CDN + Basecoat UI CDN are the design system — no React, no build-time CSS
- localStorage is the only persistence layer
- Must work offline after first load

## Tech stack
- Vanilla JS (ES modules), no TypeScript, JSDoc for type annotations
- Vite for bundling
- Vitest for unit tests
- Basecoat UI (CDN) + Tailwind (CDN) for design system

## Agent assignments
- .claude/agents/architect.md  → src/core/, src/models/, src/importers/
- .claude/agents/frontend.md   → design system, Basecoat components, build pipeline
- .claude/agents/features.md   → src/views/, src/features/, new feature implementation
- .claude/agents/quality.md    → tests/, error handling audit, definition of done

## Extraction order (do not reorder)
1. src/models/points.js         — pure scoring logic
2. src/core/storage.js          — localStorage wrapper
3. src/core/events.js           — pub/sub event bus
4. src/core/state.js            — single source of truth
5. src/models/*.js              — User, Team, Activity, Campaign
6. src/importers/deduplication.js
7. src/importers/course-importer.js
8. src/importers/teams-importer.js

## Key constraints per agent
- Architect: no DOM access, no React, JSDoc on all exports, max 40 lines per function
- Frontend: Basecoat classes first, never hardcode hex, build output < 400KB
- Features: never call localStorage directly, always use state.js, paginate all tables at 25 rows
- Quality: never fix bugs — write failing tests, log to QUALITY_ISSUES.md, tag the right agent