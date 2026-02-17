# Git Productivity Dashboard

GitHub engineering productivity dashboard. Syncs PR data from GitHub into local SQLite, visualizes team metrics via Recharts.

## Quick Start

```
npm install
npm run db:migrate
npm run dev
```

Configure your GitHub PAT and repos in the Settings page at `/settings`.

## Tech Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** with CSS variables defined in `src/app/globals.css`
- **Drizzle ORM** + better-sqlite3 — schema in `src/lib/db/schema.ts`, DB at `./data/productivity.db`
- **Recharts** for all charts
- **Octokit** (GraphQL for bulk PR fetching, REST for per-file stats)
- Path alias: `@/*` → `./src/*`

## Project Structure

```
src/
  app/                    # Next.js App Router pages + API routes
    api/
      metrics/            # One route per metric (throughput, merge-time, etc.)
      repos/route.ts      # CRUD for repo configuration
      settings/route.ts   # Key-value settings
      sync/route.ts       # POST triggers sync, GET returns status
    dashboard/            # Main overview page
    leaderboard/          # Top/bottom engineers by period
    prs/                  # Open PR aging table
    trends/               # Time-series charts for all metrics
    outliers/             # Statistical + trend outlier detection
    settings/             # PAT, repos, globs, churn config
  components/
    charts/               # One chart component per metric
    layout/               # AppShell, Sidebar, Header, MetricCard, DateRangePicker
  lib/
    db/                   # Drizzle schema, connection singleton, migration runner
    github/               # GitHub API client, sync orchestration, GraphQL queries
    metrics/              # Pure metric computation functions (SQL queries via Drizzle)
```

## Key Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run db:generate` — generate Drizzle migrations from schema changes
- `npm run db:migrate` — apply migrations
- `npm run db:studio` — open Drizzle Studio to inspect the database

## Design System

Dark theme ("Midnight Observatory"). Colors, fonts, and spacing are defined as CSS variables in `globals.css` and exposed via Tailwind's `@theme inline` directive.

- **Fonts**: Syne (display/headings via `font-display`), DM Sans (body via `font-body`), DM Mono (data/code via `font-mono`)
- **Colors**: Deep navy backgrounds (`bg-primary`, `bg-secondary`, `bg-tertiary`), cyan accent (`accent`), emerald success, amber warning, coral danger, violet and orange for chart variety
- **Charts**: All charts use a shared dark style — grid `#1E2D4A`, axis text `#4A5E80`, dark tooltips. Gradient fills for area charts.

## Architecture Notes

- **Sync flow**: "Sync Now" button POSTs to `/api/sync` which runs `syncAllRepos()` in the background. Iterates all registered repos, fetches PRs via GraphQL (paginated, ordered by updatedAt DESC), then fetches per-file stats via REST. Initial sync goes back 6 months; subsequent syncs page through everything (no incremental optimization yet). Retries on 502/503/504 with exponential backoff.
- **Metrics**: Computed at query time via SQL aggregation, not materialized. The dataset (~30 engineers, 6 months) is small enough for SQLite to handle instantly. The one pre-computation is `filteredAdditions`/`filteredDeletions` on PRs (glob-based file exclusion).
- **Date range**: Global date context in `DateContext.tsx`. All metric pages consume it; API routes accept `startDate`/`endDate` as unix timestamp query params.
- **Outlier detection**: Three approaches — statistical (>1.5 std devs), top/bottom N, and trend-based (current vs 4-week rolling avg). Combined in `lib/metrics/outliers.ts`.

## Docs

- `SPEC.md` — full product spec (metrics definitions, UI descriptions, user flows)
- `ARCHITECTURE.md` — technical architecture (schema, API strategy, sync flow, build phases)
