# GitHub Engineering Productivity Dashboard — Product Spec

## Overview

A dashboard for engineering leaders to track team productivity over time using GitHub data. Focused on team-level trends (not individual performance management) with the ability to spot positive and negative outliers. Data is pulled from a configurable list of repos across multiple GitHub orgs.

## Target User

Engineering leader managing ~30 engineers across multiple GitHub repositories and organizations.

## Metrics

### 1. PRs Merged Per Person
Count of merged PRs grouped by author and time period. Displayed as a stacked bar chart (daily/weekly).

### 2. Leaderboard
Top/bottom N contributors by: PRs merged, lines written, reviews given, fastest merge time. Toggleable time windows: last 24h, 7 days, 30 days. Top 3 highlighted green, bottom 3 amber.

### 3. Time to Merge
Duration from `published_at` (when PR left draft) to `merged_at`. Per-person median/mean. Team-wide p50/p75/p90 trended weekly as a line chart.

### 4. Lines Written Per PR / Per Person
`filteredAdditions + filteredDeletions` after glob-based file exclusion (e.g., lock files, generated code). Horizontal bar chart per person, split by additions/deletions.

### 5. Review Velocity
Time from `publishedAt` to first non-self review. Weekly median trend as a line chart.

### 6. Review Load Distribution
Reviews given per person as a bar chart.

### 7. Code Churn Rate
File-level overlap: for files changed in a merged PR, check if the same file was changed in another merged PR within N days (default 14). Churned lines = `min(original.additions, subsequent.changes)`. Rate = churned lines / total additions. Weekly trend line chart.

### 8. Open PR Aging
Currently open PRs with age since publish. Table with color-coded age bands: green <1d, yellow 1-3d, orange 3-7d, red >7d.

### 9. Team-Wide PR Throughput
Weekly PRs merged + LOC as an area chart on the main dashboard.

## Outlier Detection

Applied across all metrics:

1. **Statistical**: Flag anyone >1.5 standard deviations from team mean
2. **Top/Bottom N**: Show top 3 and bottom 3 per metric
3. **Trend-based**: Compare last week to 4-week rolling average; flag when current < 60% of rolling avg

Surfaced as alert badges on dashboard metric cards and a dedicated outliers page.

## UI Pages

### Dashboard (`/dashboard`)
Grid of MetricCard components showing summary stat + sparkline + % change from prior period. Below: outlier alerts section and large team throughput area chart.

### Leaderboard (`/leaderboard`)
Toggle 24h / 7d / 30d. Tables per metric with rank, avatar, login, value. Top 3 green, bottom 3 amber.

### Pull Requests (`/prs`)
Filterable table of open PRs: repo, PR#, title, author, age, size, draft status. Sorted by age descending. Color-coded age bands. Links to GitHub.

### Trends (`/trends`)
Full-width time-series charts (daily/weekly granularity) for each metric. Per-person toggle on each chart.

### Outliers (`/outliers`)
Unified view grouped by detection type: statistical outliers, trend declines, top/bottom performers.

### Settings (`/settings`)
- GitHub PAT (masked input + test connection)
- Repos table (add/remove, search GitHub, last sync time per repo)
- File exclusion glob patterns (add/remove, preview excluded count)
- Churn config (window days, decline threshold)
- Sync status (current/recent jobs with progress)

## User Flows

### Initial Setup
1. Navigate to Settings
2. Enter GitHub PAT and test connection
3. Add repositories by owner/name
4. Trigger initial sync (6-month backfill)
5. Navigate to Dashboard to see metrics

### Daily Use
1. Open Dashboard for team overview
2. Check outlier alerts for anything needing attention
3. Drill into Leaderboard for detailed rankings
4. Check Open PR Aging for stale PRs
5. Review Trends for week-over-week patterns

### Configuration Changes
1. Add/remove repos in Settings
2. Modify file exclusion globs (auto-recomputes filtered LOC)
3. Adjust churn window days
4. Trigger re-sync as needed
