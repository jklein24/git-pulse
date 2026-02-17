# GitHub Engineering Productivity Dashboard — Architecture

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 14+ (App Router) + React + Tailwind CSS | Full-stack framework, server components for data loading |
| Charts | Recharts | React-native charting, composable, good for dashboards |
| Database | SQLite via Drizzle ORM + better-sqlite3 | Local-first, zero config, fast analytics queries |
| GitHub API | Hybrid GraphQL + REST via Octokit | GraphQL for bulk PR/review fetching, REST for per-file stats |
| Auth | GitHub PAT (v1) | Simple for local use; OAuth for future team deployment |

### Why Drizzle over Prisma
Analytics dashboards need complex aggregate queries (GROUP BY, window functions). Drizzle exposes SQL directly via its query builder and `sql` tag, has near-zero overhead with better-sqlite3, and provides full TypeScript inference.

## Database Schema

### Tables

**repos** — configured GitHub repositories
- `id` INTEGER PRIMARY KEY
- `owner` TEXT, `name` TEXT, `fullName` TEXT (unique)
- `addedAt` INTEGER (unix), `lastSyncedAt` INTEGER, `syncCursor` TEXT

**users** — GitHub contributors
- `id` INTEGER PRIMARY KEY
- `githubLogin` TEXT (unique), `githubId` INTEGER, `avatarUrl` TEXT
- `firstSeenAt` INTEGER (unix)

**pullRequests** — synced PR data
- `id` INTEGER PRIMARY KEY, `githubId` INTEGER (unique)
- `repoId` → repos, `number` INTEGER, `title` TEXT, `authorId` → users
- `state` TEXT (OPEN/MERGED/CLOSED), `isDraft` INTEGER (boolean)
- `createdAt`, `publishedAt`, `mergedAt`, `closedAt` — all INTEGER (unix)
- `additions`, `deletions`, `changedFiles` INTEGER
- `filteredAdditions`, `filteredDeletions` INTEGER (post glob exclusion)
- `url` TEXT
- Indexes: repoId, authorId, mergedAt, state, publishedAt

**prFiles** — per-file change stats
- `id` INTEGER PRIMARY KEY, `prId` → pullRequests
- `filename` TEXT, `status` TEXT, `additions` INTEGER, `deletions` INTEGER
- `isExcluded` INTEGER (boolean, computed from glob patterns)
- `patch` TEXT (for churn analysis)
- Indexes: prId, filename

**prReviews** — reviews on PRs
- `id` INTEGER PRIMARY KEY, `prId` → pullRequests
- `reviewerId` → users, `state` TEXT, `submittedAt` INTEGER, `githubId` INTEGER
- Indexes: prId, reviewerId, submittedAt

**syncJobs** — sync history
- `id` INTEGER PRIMARY KEY, `repoId` → repos (nullable)
- `status` TEXT, `startedAt` INTEGER, `completedAt` INTEGER
- `prsProcessed` INTEGER, `error` TEXT

**settings** — key-value config
- `key` TEXT PRIMARY KEY, `value` TEXT
- Keys: `github_pat`, `exclude_globs`, `churn_window_days`

### Design Decisions
- **Timestamps as Unix integers** for direct SQL comparison
- **`publishedAt`** separates draft time from review time; falls back to `createdAt` if never drafted
- **`filteredAdditions/Deletions`** pre-computed to avoid re-querying per-file data on every render
- **`patch` on prFiles** enables churn analysis
- **WAL mode** for concurrent reads during sync writes

## GitHub API Strategy

### GraphQL — bulk PR + review fetching
Single query fetches 100 PRs with nested reviews, author info, and pagination cursor. Replaces 5+ REST calls per PR.

### REST — per-file change data
`GET /repos/{owner}/{repo}/pulls/{number}/files` for filename, additions, deletions, status, patch.

### Sync Flow

**Initial sync (6-month backfill)**:
1. For each repo, paginate PRs by `UPDATED_AT DESC` via GraphQL
2. Stop when `updatedAt` falls before 6-month cutoff
3. Fetch per-file data via REST for each PR
4. Store GraphQL `endCursor` as `syncCursor` on repo

**Incremental sync**:
1. Query PRs with `UPDATED_AT DESC` from newest
2. Process until encountering an already-seen PR with same `updatedAt`
3. Upsert PR data; fetch per-file data for newly merged PRs

**Rate limits**: 5,000 GraphQL points/hour, 5,000 REST requests/hour. Exponential backoff when low.

## Directory Structure

```
src/
  app/
    layout.tsx                    # root layout with sidebar
    page.tsx                      # redirects to /dashboard
    dashboard/page.tsx
    leaderboard/page.tsx
    prs/page.tsx
    trends/page.tsx
    outliers/page.tsx
    settings/page.tsx
    api/
      sync/route.ts               # POST trigger, GET status
      metrics/
        throughput/route.ts
        merge-time/route.ts
        review-velocity/route.ts
        review-load/route.ts
        lines/route.ts
        churn/route.ts
        leaderboard/route.ts
        outliers/route.ts
        open-prs/route.ts
      repos/route.ts
      settings/route.ts
  lib/
    db/
      index.ts                    # connection singleton + WAL mode
      schema.ts                   # Drizzle table definitions
    github/
      client.ts                   # GraphQL + REST wrapper
      sync.ts                     # sync orchestration
      queries.ts                  # GraphQL query strings
      transforms.ts               # API response → DB mapping
    metrics/
      throughput.ts
      merge-time.ts
      review-velocity.ts
      review-load.ts
      lines.ts
      churn.ts
      outliers.ts
      open-prs.ts
      utils.ts                    # shared math helpers
  components/
    charts/                       # chart components
    layout/                       # Sidebar, Header, DateRangePicker, MetricCard
```
