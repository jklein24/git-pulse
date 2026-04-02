# TrueThroughput Metric

A weighted throughput metric that scores PRs by complexity rather than counting them equally. Inspired by DX's TrueThroughput concept.

## Problem

Raw PR count treats a 3-line config tweak the same as a 500-line feature. This distorts productivity signals — someone shipping many trivial PRs looks more productive than someone shipping fewer but more complex ones. Bulk renames and mechanical refactors inflate counts without representing real delivery.

## Scoring Formula

Each merged PR receives a **complexity score** computed from five factors, then adjusted by a concentration heuristic.

### Raw Score

```
rawScore = 0.35 × log₂(1 + filteredLines)
         + 0.25 × log₂(1 + filesChanged)
         + 0.20 × reviewIterations
         + 0.10 × log₂(1 + hoursToMerge)
         + 0.10 × churnRatio
```

| Factor | Weight | Source | Scaling | Rationale |
|--------|--------|--------|---------|-----------|
| Lines changed | 0.35 | `filteredAdditions + filteredDeletions` | log₂ | Primary signal of work volume. Log scaling provides diminishing returns — 1000 lines isn't 100× harder than 10 lines. |
| Files changed | 0.25 | `COUNT(prFiles) WHERE NOT isExcluded` | log₂ | Breadth of change across the codebase. |
| Review iterations | 0.20 | `COUNT(DISTINCT review rounds)` from `prReviews` | linear | Already small (1–5 typically). More rounds suggest the change was substantive enough to require iteration. |
| Time to merge | 0.10 | `(mergedAt - createdAt) / 3600` | log₂ | Lower weight because slow merges can reflect reviewer availability, not just complexity. |
| Churn ratio | 0.10 | Fraction of PR's non-excluded files also modified by another PR merged within the churn window | linear (0–1) | Signals rework and iteration on the same code area. |

### Review Iterations

`COUNT(*)` from `prReviews` where `state IN ('CHANGES_REQUESTED', 'APPROVED')` for the PR. Minimum 1 for any merged PR (even if no formal review was recorded).

### Churn Ratio

For a given PR, check how many of its non-excluded files were also modified in another merged PR within the configured churn window (default 14 days, before or after). The ratio is:

```
churnRatio = filesWithOverlap / totalNonExcludedFiles
```

This reuses the same churn window setting (`churn_window_days`) already in the settings table.

### Concentration Discount

Catches mechanical changes (bulk renames, regex find-replace) that touch many files with minimal per-file changes.

```
linesPerFile = filteredLines / max(filesChanged, 1)
concentrationMultiplier = clamp(linesPerFile / 10, 0.2, 1.0)
```

| Lines/File | Multiplier | Interpretation |
|-----------|------------|----------------|
| 2 | 0.2 | Heavily mechanical — likely rename/reformat |
| 5 | 0.5 | Partially mechanical |
| 10+ | 1.0 | Substantive per-file changes |

Floor of 0.2 ensures mechanical changes still receive some credit.

### Final Score

```
finalScore = rawScore × concentrationMultiplier
```

### Normalization

All PR scores are normalized against the **median final score** of all PRs in the queried date range:

```
normalizedScore = finalScore / medianFinalScore
```

A score of **1.0** means "equivalent to one median-complexity PR." Weekly TrueThroughput is the sum of normalized scores for all PRs merged that week.

### Example Outcomes

| PR Type | Lines | Files | Reviews | Hours | Churn | L/F | ~Score |
|---------|-------|-------|---------|-------|-------|-----|--------|
| Config tweak | 5 | 1 | 1 | 2 | 0 | 5.0 | ~0.2 |
| Regex rename | 100 | 50 | 1 | 4 | 0 | 2.0 | ~0.25 |
| Normal feature | 100 | 8 | 2 | 24 | 0 | 12.5 | ~1.0 |
| Complex feature | 500 | 15 | 4 | 72 | 0.3 | 33.3 | ~1.5 |

## Data Layer

### No Schema Changes

All inputs already exist in the database:
- `pullRequests`: `filteredAdditions`, `filteredDeletions`, `changedFiles`, `createdAt`, `mergedAt`
- `prFiles`: per-file changes with `isExcluded` flag
- `prReviews`: review records with `state` and `submittedAt`
- `settings`: `churn_window_days`

Scores are computed at query time. The dataset (~30 engineers, 6 months) is small enough for SQLite to handle without materialization.

### New File: `src/lib/metrics/true-throughput.ts`

Exports three functions:

#### `getTrueThroughputWeekly(startDate, endDate)`

Returns weekly aggregates:
```ts
Array<{
  week: string;           // ISO date (Monday)
  trueThroughput: number; // sum of normalized scores
  rawPrCount: number;     // count of merged PRs
  avgScore: number;       // mean normalized score
}>
```

#### `getTrueThroughputPerPerson(startDate, endDate)`

Returns per-contributor aggregates:
```ts
Array<{
  login: string;
  avatarUrl: string;
  trueThroughput: number; // sum of normalized scores
  rawPrCount: number;
  avgScore: number;       // mean normalized score per PR
}>
```

#### `getTrueThroughputDistribution(startDate, endDate)`

Returns score bucket counts:
```ts
{
  buckets: Array<{
    bucket: 'XS' | 'S' | 'M' | 'L' | 'XL';
    count: number;
    minScore: number;
    maxScore: number;
  }>;
  summary: {
    totalWeighted: number;
    totalRaw: number;
    medianScore: number;
    avgScore: number;
  };
}
```

Bucket thresholds (normalized scores):
- **XS**: < 0.4
- **S**: 0.4 – 0.8
- **M**: 0.8 – 1.3
- **L**: 1.3 – 2.0
- **XL**: > 2.0

### Internal: `scorePR(pr)` and `computeAllScores(startDate, endDate)`

`computeAllScores` is the shared internal function that:
1. Fetches all merged PRs in the date range
2. Joins file counts (non-excluded) and review counts per PR
3. Computes per-PR churn ratio by checking file overlap with nearby PRs
4. Applies the scoring formula to each PR
5. Computes the median and normalizes
6. Returns the full list of scored PRs for the three public functions to aggregate

## API

### `GET /api/metrics/true-throughput`

Query params: `startDate`, `endDate` (unix timestamps, same as all other metric endpoints).

Response:
```json
{
  "weeklyTrend": [
    { "week": "2026-03-24", "trueThroughput": 38.2, "rawPrCount": 47, "avgScore": 0.81 }
  ],
  "perPerson": [
    { "login": "alice", "avatarUrl": "...", "trueThroughput": 12.4, "rawPrCount": 8, "avgScore": 1.55 }
  ],
  "distribution": {
    "buckets": [
      { "bucket": "XS", "count": 8, "minScore": 0, "maxScore": 0.4 },
      { "bucket": "S", "count": 14, "minScore": 0.4, "maxScore": 0.8 },
      { "bucket": "M", "count": 12, "minScore": 0.8, "maxScore": 1.3 },
      { "bucket": "L", "count": 9, "minScore": 1.3, "maxScore": 2.0 },
      { "bucket": "XL", "count": 4, "minScore": 2.0, "maxScore": null }
    ],
    "summary": {
      "totalWeighted": 38.2,
      "totalRaw": 47,
      "medianScore": 1.0,
      "avgScore": 0.81
    }
  }
}
```

## UI Components

### New Chart Components

All in `src/components/charts/`, following existing patterns (Recharts, dark theme colors, responsive containers).

#### `TrueThroughputChart.tsx`

Weekly time series. ComposedChart with:
- Faded purple bars for raw PR count (background context)
- Cyan area + line for TrueThroughput (primary visual)
- Dual Y axes: left for TrueThroughput, right for raw count
- Tooltip showing both values and the ratio
- Click handler for week drill-down (same pattern as existing ThroughputChart)

#### `TrueThroughputPerPersonChart.tsx`

Horizontal dual-bar chart ranked by weighted score. Each row shows:
- Contributor name (left)
- Cyan bar for TrueThroughput, overlaid thinner purple bar for raw PR count
- Score + raw count (right)

Sorted descending by TrueThroughput. Respects `hideIndividualMetrics` setting.

#### `TrueThroughputDistributionChart.tsx`

Vertical bar histogram with 5 buckets (XS/S/M/L/XL), each a distinct color matching the existing palette:
- XS: cyan (#22D3EE)
- S: green (#34D399)
- M: purple (#A78BFA)
- L: amber (#FBBF24)
- XL: coral (#F87171)

Summary row below showing total weighted, total raw, median, and average.

### Integration Points

#### Dashboard Page (`src/app/dashboard/page.tsx`)

- Add a **TrueThroughput MetricCard** to the existing grid, showing:
  - Total weighted throughput for the period
  - Percent change (first half vs second half, same pattern as existing PRs Merged card)
  - Sparkline from weekly trend data
  - Subtitle: "{rawCount} raw PRs"
- Add **TrueThroughputChart** below the existing Team Throughput section

#### Trends Page (`src/app/trends/`)

- Add a "TrueThroughput" section containing all three chart components
- Weekly trend chart at full width
- Per-person and distribution charts side by side below

#### Leaderboard Page (`src/app/leaderboard/`)

- Add a "Weighted Throughput" column showing each person's TrueThroughput score alongside existing metrics
