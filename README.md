# 🏆 CloudComp - Learning Gamification Platform

> Transform your organization's learning culture with points, leaderboards, and friendly competition!

[![Version](https://img.shields.io/badge/version-1.3-blue.svg)](https://github.com/timmes/cloudcomp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![No Server Required](https://img.shields.io/badge/deployment-local%20files-orange.svg)](#getting-started)

## 🎯 What is CloudComp?

CloudComp is a **zero-setup, browser-based gamification platform** that turns organizational learning into an engaging competition. Track course completions, award points for achievements, and watch your teams climb the leaderboards!

Perfect for **AWS Skills Guilds**, corporate training programs, or any organization looking to boost learning engagement through friendly competition.

### ✨ Why You'll Love It

- 🚀 **Zero Setup** — open a single HTML file in any modern browser
- 🏅 **Instant Gratification** — leaderboards and point tracking update live
- 👥 **Team Competition** — create teams and watch departments compete
- 🎯 **Time-boxed Campaigns** — run focused learning pushes with their own leaderboards
- 📊 **Rich Analytics** — dashboards by month, quarter, year, or all-time
- 💾 **Your Data Stays Yours** — everything lives in your browser's localStorage
- 📱 **Works Everywhere** — any modern browser, any device

## 🎮 Features

### 🏆 Gamification Core
- **Points** — every activity carries a points value, configurable per category
- **Leaderboards** — user and team rankings filterable by Month, Quarter, Year, or Overall
- **Teams** — group users into colorful, named teams; team totals roll up from members
- **Campaigns** — time-boxed competitions with their own participant lists and leaderboard

### 📈 Smart Analytics Dashboard
- **Quick metrics** — Total Users, Teams, Completed activities, Points Awarded, plus This Month / Quarter / Year activity counts
- **Activity Overview** — top course types and a completion-rate metric (filterable: click a course type to scope the rate)
- **User / Team / Campaign sub-tabs** — swap the leaderboard panel between rankings
- **Recent activity feed** — most recent completions for the selected time window
- **Time period filter** — Month, Quarter, Year, or Overall (all-time)

### 🔄 Data Import
- **Excel/CSV course files** — upload via the Import tab; SheetJS parses dates correctly via `cellDates: true`
- **Teams meeting attendance** — extract attendees from meeting reports
- **Multi-file processing** — queue several files; a spinner shows in the Processing Log while work is in flight
- **Smart deduplication** — duplicate activities are detected and either skipped or upgraded (e.g. in-progress → completed)

### 👥 Team Management
- **Team builder** — create teams with custom colors and descriptions
- **Member management** — add/remove members from the Teams tab
- **Automatic point rollup** — team points are recomputed from members on every relevant change

### ⚡ Bulk Operations
- **Multi-select users or activities** with the row checkboxes
- **Bulk award points** to selected users in a single action
- **Bulk assign team** for selected users
- **Bulk adjust** activity points (add / subtract / multiply / set), with reason logged
- **Bulk delete** activities
- **Bulk Export Selected** — download the selected rows as JSON

### 🎯 Campaigns
- Define a campaign with a name, date range, status, and a participant list (direct users + linked teams)
- Active campaigns appear in the dashboard's **Campaigns** sub-tab with their own metrics (participants, active participants, eligible activities, points awarded) and leaderboard
- Manage details (status: draft → active → completed → archived) from the Campaigns tab

## 🚀 Getting Started

### For users — run the built app

The production build is a single self-contained HTML file (no server, no install).

1. Grab `dist/index.html` from the repository (or from a release).
2. Double-click it in your file browser, or open it in any modern browser.
3. Head to the **Import** tab and upload your course/meeting files.

That's it — your data is stored in the browser's localStorage and persists across reloads.

### For developers — build from source

This project uses **Vite + vite-plugin-singlefile** so the dev workflow is standard and the production build collapses into a single HTML file.

```bash
git clone https://github.com/timmes/CloudComp.git
cd CloudComp
npm install

npm run dev      # start the Vite dev server with HMR
npm run build    # produce dist/index.html (single self-contained file)
npm test         # run the Vitest suite
```

### First steps in the app

1. **Import your data** — Excel/CSV course completions and/or Teams meeting CSVs
2. **Create teams** — name them, pick a color, assign members
3. **(Optional) Define campaigns** — for time-boxed challenges
4. **Configure points** — adjust per-category values in the Configuration tab
5. **Watch the dashboard** — leaderboards, recent activity, and campaign stats update live

## 🎯 Perfect For

- **AWS Skills Guilds** — track cloud-learning progress across the org
- **Corporate Training** — gamify professional development programs
- **Bootcamps & Academies** — engage students with friendly competition
- **Team Building** — foster collaboration through shared learning goals
- **Certification Programs** — motivate exam preparation

## 📊 Activity Categories & Default Points

Points are organised into five categories. All values are editable in the **Configuration** tab.

### Self-Paced Digital

| Activity | Default Points |
|---|---:|
| Skill Builder Course | 50 |
| Skill Builder Learning Plan | 150 |
| Cloud Quest Role | 100 |
| Escape Room Challenge | 75 |
| Foundational Training Package | 100 |
| Quiz Completion | 25 |

### Live Learning

| Activity | Default Points |
|---|---:|
| Live Webinar | 25 |
| Workshop (first hour) | 30 |
| Workshop (full + hands-on) | 75 |
| Office Hours Session | 20 |
| Office Hours Question Submitted | 10 |
| Hands-on Challenge | 50 |

### Certifications

| Activity | Default Points |
|---|---:|
| AWS Cloud Practitioner | 200 |
| AI Practitioner | 200 |
| Associate Certification | 300 |
| Professional / Specialty Certification | 500 |
| AWS Jam Challenge | 100 |

### Gamified Events

| Activity | Default Points |
|---|---:|
| Participate in Event | 50 |
| Top 3 Bonus | +100 |
| Participate in Hackathon | 100 |
| Hackathon Prototype Bonus | +200 |

### Community Engagement

| Activity | Default Points |
|---|---:|
| Join Channel | 10 |
| First Question | 10 |
| Share Resource | 15 |
| Champion Knowledge-sharing | 25 |
| Survey Feedback | 10 |

## 🛠️ Tech Stack

- **Vanilla JS (ES modules)** with **JSDoc** type annotations — no React, no TypeScript
- **Vite + `vite-plugin-singlefile`** — builds the whole app into one self-contained `index.html`
- **Vitest** for the unit-test suite (416 tests at v1.3)
- **Tailwind CSS** + **Basecoat UI** design tokens for styling
- **SheetJS (`xlsx`)** for Excel/CSV parsing — loaded from CDN
- **Chart.js** for the YTD charts in the Reports tab — loaded from CDN
- **localStorage** — the only persistence layer; the app works offline after first load

## 📁 Project Structure

```
src/
  core/        # state, storage, events, pub/sub
  models/      # pure data shapes + helpers (user, team, activity, campaign, points)
  importers/   # course / teams CSV+XLSX parsing, dedup, course-type mapping
  views/       # one module per UI tab (dashboard, users, teams, activities, campaigns, …)
  styles/      # design tokens
tests/         # mirrors src/ — vitest unit tests for core, models, importers
index.html     # the app shell (only edited at design time)
dist/index.html  # production build (single self-contained file)
```

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 🎨 What's New in v1.3

### Dashboard
- **Campaigns sub-tab** — pick a campaign and see participants, activities, points, and a per-campaign leaderboard.
- **"Overall" time-period filter** — all-time totals alongside Month / Quarter / Year.
- **Course-type filter scopes Completion Rate** — clicking a course type in Activity Overview now also scopes the completion-rate metric next to it, with a clear label.

### UI / Theme
- **Dark mode** — sun/moon toggle in the header next to Docs. Your choice is persisted to `localStorage` and on first visit the app follows your OS `prefers-color-scheme`. An inline preload script applies the theme before paint so dark-mode users never see a flash of light content.

### Backup & History
- **Full-data export/import** — *Configuration → Backup & Restore*. **Export** downloads `cloud_comp_data_<ISO-timestamp>.json` containing every user, team, activity, campaign, the point configuration, and the history slice itself. **Import** restores from such a file in place (full-replace, with a confirmation summary). Both flows are tracked, so backups round-trip across machines or browsers.
- **Import / Export history** — a new History card in the Configuration tab shows two live-updating tables (Recent Imports / Recent Exports). Each entry records filename, date, type, and stats (e.g. accepted / upgraded / duplicates for file imports; users / teams / activities / campaigns + file size for exports). The 50 most recent of each kind are kept.

### Import
- **Excel-date bug fixed** — `cellDates: true` plus a defensive serial-number guard so `.xlsx` files with date cells no longer collapse every activity to `1/1/1970`.
- **Spinner in the Processing Log** — a small animated indicator runs while imports are in flight.
- **Pre-2000 dates surface as "—"** — legacy data with bogus dates is now flagged visually instead of being misread as 1970.

### Performance
- **Bulk-write import path** — imports now persist the whole batch in a constant number of `localStorage` writes (one each for accepted activities, upgrades, and new users) instead of one per row. The previous per-row writes were O(N²) and could freeze the browser or hit the storage quota on medium imports.

### Users / Activities
- **Last Activity is derived** — computed from each user's most recent completed activity (single source of truth), instead of a separate `user.lastActivity` field that wasn't always set.
- **Stub Actions columns removed** — the placeholder "View" and "Edit" buttons (and their `Feature coming soon!` handlers) are gone.

### Reports
- **Obsolete report exports removed** — the Reports tab's three JSON-export buttons (Leaderboard / Activities / Summary) and the old header **Export** button were unused. Full-data export has been reimagined as part of the new **Backup & Restore** flow in Configuration; the per-tab **Bulk Export Selected** actions are still available for ad-hoc snapshots of selected rows.

## 🔮 Roadmap

- 💯 **Points lock** — prevent edits to historical points while a campaign is active
- 🏅 **Achievement badges** — surface the `user.badges` field with visual rewards for milestones
- 🔍 **Import preview** — see what will be imported before committing
- ⚡ **Quick actions** — keyboard shortcuts / command palette
- 📈 **Per-campaign team leaderboard on the dashboard** — currently only the user leaderboard is shown for the selected campaign

## 🤝 Contributing

We'd love your help making CloudComp even better — bug reports, feature ideas, docs improvements, UI polish, all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

When sending a PR, please:

- Keep changes small and focused
- Run `npm test` and `npm run build` locally first
- Match the existing JSDoc style — no TypeScript, no React

## 📄 License

MIT License — see [LICENSE](LICENSE).

## 🙏 Credits

Created with ❤️ and powered by AI assistance:

- **Tim Huettemeister** — product vision and technical implementation
- **Claude** (Anthropic) — AI pair-programming partner

---

**Ready to gamify your learning?** Grab `dist/index.html`, open it in your browser, and start your learning tournament! 🚀
