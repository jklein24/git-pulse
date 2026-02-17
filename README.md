# Git Productivity Dashboard

A self-hosted engineering productivity dashboard that syncs PR data from GitHub into a local SQLite database and visualizes team metrics. Built for engineering leaders tracking ~30 engineers across multiple repos and orgs.

## Setup

```bash
npm install
npm run db:migrate
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) and configure your GitHub PAT and repositories in **Settings**.

## What it tracks

- **Team Throughput** — weekly PRs merged, lines of code, PRs per contributor
- **Average PR Size** — lines changed per PR over time
- **Time to Merge** — p50/p75/p90 from ready-for-review to merge
- **Review Velocity** — median time to first human review (bots excluded)
- **Review Load** — reviews given per person
- **Code Churn** — percentage of new lines modified again within a rolling window
- **Open PR Aging** — currently open PRs with color-coded age bands
- **Leaderboard** — top/bottom contributors by PRs, lines, reviews, merge speed
- **Outlier Detection** — statistical, top/bottom, and trend-based alerts
- **Person Detail** — per-engineer weekly activity chart and PR history

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Summary cards, outlier alerts, throughput chart |
| `/leaderboard` | Ranked table of engineers (click a row for detail) |
| `/person/[login]` | Individual engineer's weekly PRs, reviews, lines + PR table |
| `/trends` | Time-series charts for all metrics |
| `/prs` | Open PR aging table |
| `/outliers` | All detected outliers grouped by type |
| `/settings` | GitHub PAT, repos, file exclusion globs, churn config |

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** with a dark theme ("Midnight Observatory")
- **Drizzle ORM** + better-sqlite3 (local file at `./data/productivity.db`)
- **Recharts** for all charts
- **Octokit** for GitHub API (GraphQL for bulk PR data, REST for per-file stats)

## Data sync

Click "Sync Now" in Settings or POST to `/api/sync`. The initial sync pulls 6 months of history. PRs are fetched via GitHub GraphQL (paginated by `updatedAt`), then per-file stats via REST. File exclusion globs (configured in Settings) are applied to compute `filteredAdditions`/`filteredDeletions`.

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Generate Drizzle migrations from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio to inspect the database |
