# TrueThroughput Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a weighted throughput metric (TrueThroughput) that scores PRs by complexity using multi-factor log-scaled scoring with a concentration discount, displayed via three new chart views integrated into the dashboard, trends, and leaderboard pages.

**Architecture:** A single new metrics module (`true-throughput.ts`) computes per-PR complexity scores at query time from existing DB tables (no schema changes). One new API route serves weekly, per-person, and distribution data. Three new Recharts chart components render the views. Integration into dashboard, trends, and leaderboard pages follows existing patterns.

**Tech Stack:** TypeScript, Drizzle ORM + SQLite, Next.js App Router API routes, Recharts, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/metrics/true-throughput.ts` | Scoring formula, per-PR computation, weekly/person/distribution aggregation |
| Create | `src/app/api/metrics/true-throughput/route.ts` | API endpoint serving all three data shapes |
| Create | `src/components/charts/TrueThroughputChart.tsx` | Weekly time series (area + bar composed chart) |
| Create | `src/components/charts/TrueThroughputPerPersonChart.tsx` | Horizontal dual-bar ranked chart |
| Create | `src/components/charts/TrueThroughputDistributionChart.tsx` | Histogram with XS/S/M/L/XL buckets |
| Modify | `src/app/dashboard/page.tsx` | Add MetricCard + TrueThroughputChart section |
| Modify | `src/app/trends/page.tsx` | Add TrueThroughput section with all three charts |
| Modify | `src/app/leaderboard/page.tsx` | Add weighted throughput column |
| Modify | `src/app/api/metrics/leaderboard/route.ts` | Include TrueThroughput per-person data |

---

### Task 1: Scoring Function — `scorePR`

**Files:**
- Create: `src/lib/metrics/true-throughput.ts`

This task implements the pure scoring function with no DB access. Later tasks add the data-fetching layer.

- [ ] **Step 1: Create the scoring module with `scorePR` and types**

```ts
// src/lib/metrics/true-throughput.ts
import { median } from "./utils";

export interface PRInput {
  filteredAdditions: number;
  filteredDeletions: number;
  filesChanged: number;
  reviewCount: number;
  hoursToMerge: number;
  churnRatio: number;
}

export interface ScoredPR extends PRInput {
  rawScore: number;
  concentrationMultiplier: number;
  finalScore: number;
  normalizedScore: number;
  bucket: "XS" | "S" | "M" | "L" | "XL";
}

const WEIGHTS = {
  lines: 0.35,
  files: 0.25,
  reviews: 0.20,
  mergeTime: 0.10,
  churn: 0.10,
};

const BUCKET_THRESHOLDS: Array<{ bucket: ScoredPR["bucket"]; max: number }> = [
  { bucket: "XS", max: 0.4 },
  { bucket: "S", max: 0.8 },
  { bucket: "M", max: 1.3 },
  { bucket: "L", max: 2.0 },
];

function log2(n: number): number {
  return Math.log2(1 + n);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getBucket(normalizedScore: number): ScoredPR["bucket"] {
  for (const { bucket, max } of BUCKET_THRESHOLDS) {
    if (normalizedScore < max) return bucket;
  }
  return "XL";
}

export function scorePR(pr: PRInput): { rawScore: number; concentrationMultiplier: number; finalScore: number } {
  const lines = pr.filteredAdditions + pr.filteredDeletions;
  const rawScore =
    WEIGHTS.lines * log2(lines) +
    WEIGHTS.files * log2(pr.filesChanged) +
    WEIGHTS.reviews * Math.max(pr.reviewCount, 1) +
    WEIGHTS.mergeTime * log2(pr.hoursToMerge) +
    WEIGHTS.churn * pr.churnRatio;

  const linesPerFile = lines / Math.max(pr.filesChanged, 1);
  const concentrationMultiplier = clamp(linesPerFile / 10, 0.2, 1.0);

  return {
    rawScore,
    concentrationMultiplier,
    finalScore: rawScore * concentrationMultiplier,
  };
}

export function normalizePRScores(prs: Array<PRInput & { authorLogin: string; authorAvatarUrl: string | null; mergedAtWeek: string; prId: number }>): ScoredPR[] {
  // placeholder — implemented in Task 2
  return [];
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manually verify scoring logic with a quick sanity check**

Run:
```bash
node -e "
const { scorePR } = require('./src/lib/metrics/true-throughput');
// Normal feature: 100 lines, 8 files, 2 reviews, 24 hrs, no churn
const normal = scorePR({ filteredAdditions: 80, filteredDeletions: 20, filesChanged: 8, reviewCount: 2, hoursToMerge: 24, churnRatio: 0 });
// Regex rename: 100 lines, 50 files, 1 review, 4 hrs, no churn
const rename = scorePR({ filteredAdditions: 60, filteredDeletions: 40, filesChanged: 50, reviewCount: 1, hoursToMerge: 4, churnRatio: 0 });
// Config tweak: 5 lines, 1 file, 1 review, 2 hrs, no churn
const config = scorePR({ filteredAdditions: 4, filteredDeletions: 1, filesChanged: 1, reviewCount: 1, hoursToMerge: 2, churnRatio: 0 });
console.log('Normal feature:', JSON.stringify(normal));
console.log('Regex rename:', JSON.stringify(rename));
console.log('Config tweak:', JSON.stringify(config));
console.log('Order check: normal > rename > config:', normal.finalScore > rename.finalScore && rename.finalScore > config.finalScore);
"
```

Expected: `Order check: normal > rename > config: true`. The rename's concentration multiplier (100/50 = 2 → 0.2) should heavily discount it. The normal feature (100/8 = 12.5 → 1.0) should get full credit.

Note: This runs via `node -e` against compiled output. If the project uses ESM/TS paths, run `npx tsx -e` instead.

- [ ] **Step 4: Commit**

```bash
git add src/lib/metrics/true-throughput.ts
git commit -m "feat: add TrueThroughput scorePR function"
```

---

### Task 2: Normalization and Aggregation Functions

**Files:**
- Modify: `src/lib/metrics/true-throughput.ts`

- [ ] **Step 1: Replace the placeholder `normalizePRScores` and add aggregation functions**

Replace the placeholder `normalizePRScores` function and add the three public aggregation functions at the end of `src/lib/metrics/true-throughput.ts`:

```ts
export interface ScoredPRWithMeta extends ScoredPR {
  authorLogin: string;
  authorAvatarUrl: string | null;
  mergedAtWeek: string;
  prId: number;
}

export function normalizePRScores(
  prs: Array<PRInput & { authorLogin: string; authorAvatarUrl: string | null; mergedAtWeek: string; prId: number }>
): ScoredPRWithMeta[] {
  const scored = prs.map((pr) => {
    const { rawScore, concentrationMultiplier, finalScore } = scorePR(pr);
    return { ...pr, rawScore, concentrationMultiplier, finalScore, normalizedScore: 0, bucket: "M" as ScoredPR["bucket"] };
  });

  const medianFinal = median(scored.map((s) => s.finalScore));
  const divisor = medianFinal > 0 ? medianFinal : 1;

  for (const s of scored) {
    s.normalizedScore = Math.round((s.finalScore / divisor) * 100) / 100;
    s.bucket = getBucket(s.normalizedScore);
  }

  return scored;
}

export interface WeeklyTrueThroughput {
  week: string;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

export interface PersonTrueThroughput {
  login: string;
  avatarUrl: string | null;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

export interface TrueThroughputDistribution {
  buckets: Array<{ bucket: ScoredPR["bucket"]; count: number; minScore: number; maxScore: number | null }>;
  summary: { totalWeighted: number; totalRaw: number; medianScore: number; avgScore: number };
}

export function aggregateWeekly(scored: ScoredPRWithMeta[]): WeeklyTrueThroughput[] {
  const byWeek = new Map<string, { total: number; count: number }>();
  for (const pr of scored) {
    const entry = byWeek.get(pr.mergedAtWeek) || { total: 0, count: 0 };
    entry.total += pr.normalizedScore;
    entry.count += 1;
    byWeek.set(pr.mergedAtWeek, entry);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { total, count }]) => ({
      week,
      trueThroughput: Math.round(total * 10) / 10,
      rawPrCount: count,
      avgScore: Math.round((total / count) * 100) / 100,
    }));
}

export function aggregatePerPerson(scored: ScoredPRWithMeta[]): PersonTrueThroughput[] {
  const byPerson = new Map<string, { avatarUrl: string | null; total: number; count: number }>();
  for (const pr of scored) {
    const entry = byPerson.get(pr.authorLogin) || { avatarUrl: pr.authorAvatarUrl, total: 0, count: 0 };
    entry.total += pr.normalizedScore;
    entry.count += 1;
    byPerson.set(pr.authorLogin, entry);
  }
  return Array.from(byPerson.entries())
    .map(([login, { avatarUrl, total, count }]) => ({
      login,
      avatarUrl,
      trueThroughput: Math.round(total * 10) / 10,
      rawPrCount: count,
      avgScore: Math.round((total / count) * 100) / 100,
    }))
    .sort((a, b) => b.trueThroughput - a.trueThroughput);
}

export function aggregateDistribution(scored: ScoredPRWithMeta[]): TrueThroughputDistribution {
  const bucketDefs: Array<{ bucket: ScoredPR["bucket"]; minScore: number; maxScore: number | null }> = [
    { bucket: "XS", minScore: 0, maxScore: 0.4 },
    { bucket: "S", minScore: 0.4, maxScore: 0.8 },
    { bucket: "M", minScore: 0.8, maxScore: 1.3 },
    { bucket: "L", minScore: 1.3, maxScore: 2.0 },
    { bucket: "XL", minScore: 2.0, maxScore: null },
  ];

  const counts = new Map<string, number>(bucketDefs.map((b) => [b.bucket, 0]));
  for (const pr of scored) {
    counts.set(pr.bucket, (counts.get(pr.bucket) || 0) + 1);
  }

  const scores = scored.map((s) => s.normalizedScore);
  const totalWeighted = Math.round(scores.reduce((a, b) => a + b, 0) * 10) / 10;

  return {
    buckets: bucketDefs.map((b) => ({ ...b, count: counts.get(b.bucket) || 0 })),
    summary: {
      totalWeighted,
      totalRaw: scored.length,
      medianScore: scored.length > 0 ? Math.round(median(scores) * 100) / 100 : 0,
      avgScore: scored.length > 0 ? Math.round((totalWeighted / scored.length) * 100) / 100 : 0,
    },
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/metrics/true-throughput.ts
git commit -m "feat: add TrueThroughput normalization and aggregation functions"
```

---

### Task 3: Database Query — `computeAllScores`

**Files:**
- Modify: `src/lib/metrics/true-throughput.ts`

This task adds the function that fetches PR data from SQLite and pipes it through the scoring pipeline.

- [ ] **Step 1: Add imports and the `computeAllScores` function**

Add these imports at the top of `src/lib/metrics/true-throughput.ts`:

```ts
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prFiles, prReviews, users, settings } from "../db/schema";
import { median, formatDate, MONDAY_OFFSET } from "./utils";
```

Remove the existing `import { median } from "./utils";` line (now covered above).

Add this function before the aggregation functions:

```ts
async function getChurnWindowSeconds(): Promise<number> {
  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.key, "churn_window_days")).get();
  const days = row?.value ? parseInt(row.value) : 14;
  return days * 86400;
}

export async function computeAllScores(startDate: number, endDate: number): Promise<ScoredPRWithMeta[]> {
  const db = getDb();

  const weekExpr = sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`;

  const rawPRs = await db
    .select({
      prId: pullRequests.id,
      authorLogin: users.githubLogin,
      authorAvatarUrl: users.avatarUrl,
      mergedAt: pullRequests.mergedAt,
      createdAt: pullRequests.createdAt,
      filteredAdditions: pullRequests.filteredAdditions,
      filteredDeletions: pullRequests.filteredDeletions,
      week: weekExpr.as("week"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    );

  if (rawPRs.length === 0) return [];

  // File counts per PR (non-excluded)
  const fileCounts = await db
    .select({
      prId: prFiles.prId,
      fileCount: sql<number>`count(*)`.as("file_count"),
    })
    .from(prFiles)
    .where(eq(prFiles.isExcluded, false))
    .groupBy(prFiles.prId);

  const fileCountMap = new Map(fileCounts.map((r) => [r.prId, r.fileCount]));

  // Review counts per PR (CHANGES_REQUESTED or APPROVED)
  const reviewCounts = await db
    .select({
      prId: prReviews.prId,
      reviewCount: sql<number>`count(*)`.as("review_count"),
    })
    .from(prReviews)
    .where(
      sql`${prReviews.state} IN ('CHANGES_REQUESTED', 'APPROVED')`,
    )
    .groupBy(prReviews.prId);

  const reviewCountMap = new Map(reviewCounts.map((r) => [r.prId, r.reviewCount]));

  // Churn: for each PR, find how many of its files overlap with other PRs within the churn window
  const churnWindowSec = await getChurnWindowSeconds();

  // Get all non-excluded filenames per PR (for PRs in range)
  const allFiles = await db
    .select({
      prId: prFiles.prId,
      filename: prFiles.filename,
    })
    .from(prFiles)
    .where(eq(prFiles.isExcluded, false));

  const filesByPr = new Map<number, Set<string>>();
  for (const f of allFiles) {
    if (!filesByPr.has(f.prId)) filesByPr.set(f.prId, new Set());
    filesByPr.get(f.prId)!.add(f.filename);
  }

  // Build a time-sorted list of PRs for churn window checks
  const sortedPRs = rawPRs
    .filter((p) => p.mergedAt !== null)
    .sort((a, b) => a.mergedAt! - b.mergedAt!);

  const churnRatioMap = new Map<number, number>();
  for (let i = 0; i < sortedPRs.length; i++) {
    const pr = sortedPRs[i];
    const prFileSet = filesByPr.get(pr.prId);
    if (!prFileSet || prFileSet.size === 0) {
      churnRatioMap.set(pr.prId, 0);
      continue;
    }

    const overlapping = new Set<string>();
    for (let j = 0; j < sortedPRs.length; j++) {
      if (i === j) continue;
      const other = sortedPRs[j];
      if (Math.abs(other.mergedAt! - pr.mergedAt!) > churnWindowSec) continue;

      const otherFiles = filesByPr.get(other.prId);
      if (!otherFiles) continue;

      for (const f of prFileSet) {
        if (otherFiles.has(f)) overlapping.add(f);
      }
    }

    churnRatioMap.set(pr.prId, overlapping.size / prFileSet.size);
  }

  const prInputs = rawPRs.map((pr) => ({
    prId: pr.prId,
    authorLogin: pr.authorLogin,
    authorAvatarUrl: pr.authorAvatarUrl,
    mergedAtWeek: formatDate(pr.week),
    filteredAdditions: pr.filteredAdditions ?? 0,
    filteredDeletions: pr.filteredDeletions ?? 0,
    filesChanged: fileCountMap.get(pr.prId) ?? 0,
    reviewCount: reviewCountMap.get(pr.prId) ?? 0,
    hoursToMerge: Math.max(((pr.mergedAt ?? pr.createdAt) - pr.createdAt) / 3600, 0),
    churnRatio: churnRatioMap.get(pr.prId) ?? 0,
  }));

  return normalizePRScores(prInputs);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/metrics/true-throughput.ts
git commit -m "feat: add computeAllScores DB query for TrueThroughput"
```

---

### Task 4: API Route

**Files:**
- Create: `src/app/api/metrics/true-throughput/route.ts`

- [ ] **Step 1: Create the API route**

```ts
// src/app/api/metrics/true-throughput/route.ts
import { NextRequest, NextResponse } from "next/server";
import { computeAllScores, aggregateWeekly, aggregatePerPerson, aggregateDistribution } from "@/lib/metrics/true-throughput";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const scored = await computeAllScores(startDate, endDate);

  return NextResponse.json({
    weeklyTrend: aggregateWeekly(scored),
    perPerson: aggregatePerPerson(scored),
    distribution: aggregateDistribution(scored),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Smoke test the endpoint**

Start dev server if not running: `npm run dev`

Run: `curl -s "http://localhost:3000/api/metrics/true-throughput" | head -c 500`

Expected: JSON response with `weeklyTrend`, `perPerson`, and `distribution` keys. If the database has synced data, the arrays should be non-empty.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/metrics/true-throughput/route.ts
git commit -m "feat: add /api/metrics/true-throughput endpoint"
```

---

### Task 5: TrueThroughputChart Component (Weekly Time Series)

**Files:**
- Create: `src/components/charts/TrueThroughputChart.tsx`

- [ ] **Step 1: Create the chart component**

```tsx
// src/components/charts/TrueThroughputChart.tsx
"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface TrueThroughputData {
  week: string;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

interface TrueThroughputChartProps {
  data: TrueThroughputData[];
  onWeekClick?: (week: string) => void;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  weighted: "#22D3EE",
  rawBar: "#A78BFA",
};

export default function TrueThroughputChart({ data, onWeekClick }: TrueThroughputChartProps) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="ttWeightedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.weighted} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS.weighted} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: COLORS.tooltipBg,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-dm-mono)",
              color: "#E8EDF5",
            }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar
            yAxisId="right"
            dataKey="rawPrCount"
            name="Raw PRs"
            fill={COLORS.rawBar}
            fillOpacity={0.2}
            radius={[4, 4, 0, 0]}
            cursor={onWeekClick ? "pointer" : undefined}
            onClick={onWeekClick ? (entry: { payload?: { week?: string } }) => {
              if (entry?.payload?.week) onWeekClick(entry.payload.week);
            } : undefined}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="trueThroughput"
            name="TrueThroughput"
            fill="url(#ttWeightedGrad)"
            stroke={COLORS.weighted}
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: COLORS.weighted }}
            fillOpacity={1}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/TrueThroughputChart.tsx
git commit -m "feat: add TrueThroughputChart weekly time series component"
```

---

### Task 6: TrueThroughputPerPersonChart Component

**Files:**
- Create: `src/components/charts/TrueThroughputPerPersonChart.tsx`

- [ ] **Step 1: Create the per-person chart component**

```tsx
// src/components/charts/TrueThroughputPerPersonChart.tsx
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface PersonData {
  login: string;
  avatarUrl: string | null;
  trueThroughput: number;
  rawPrCount: number;
  avgScore: number;
}

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
  weighted: "#22D3EE",
  raw: "#A78BFA",
};

export default function TrueThroughputPerPersonChart({ data }: { data: PersonData[] }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
        <BarChart data={data} layout="vertical" barGap={-8}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            dataKey="login"
            type="category"
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            width={100}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: COLORS.tooltipBg,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-dm-mono)",
              color: "#E8EDF5",
            }}
            itemStyle={{ color: "#E8EDF5" }}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", color: COLORS.axis }} />
          <Bar
            dataKey="trueThroughput"
            name="Weighted"
            fill={COLORS.weighted}
            fillOpacity={0.7}
            radius={[0, 6, 6, 0]}
            barSize={16}
          />
          <Bar
            dataKey="rawPrCount"
            name="Raw PRs"
            fill={COLORS.raw}
            fillOpacity={0.3}
            radius={[0, 4, 4, 0]}
            barSize={10}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/TrueThroughputPerPersonChart.tsx
git commit -m "feat: add TrueThroughputPerPersonChart component"
```

---

### Task 7: TrueThroughputDistributionChart Component

**Files:**
- Create: `src/components/charts/TrueThroughputDistributionChart.tsx`

- [ ] **Step 1: Create the distribution chart component**

```tsx
// src/components/charts/TrueThroughputDistributionChart.tsx
"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";

interface BucketData {
  bucket: "XS" | "S" | "M" | "L" | "XL";
  count: number;
  minScore: number;
  maxScore: number | null;
}

interface DistributionSummary {
  totalWeighted: number;
  totalRaw: number;
  medianScore: number;
  avgScore: number;
}

const BUCKET_COLORS: Record<string, string> = {
  XS: "#22D3EE",
  S: "#34D399",
  M: "#A78BFA",
  L: "#FBBF24",
  XL: "#F87171",
};

const COLORS = {
  grid: "#1E2D4A",
  axis: "#4A5E80",
  tooltipBg: "#0D1220",
  tooltipBorder: "#1E2D4A",
};

function formatRange(min: number, max: number | null): string {
  if (max === null) return `> ${min}`;
  return `${min} – ${max}`;
}

export default function TrueThroughputDistributionChart({
  buckets,
  summary,
}: {
  buckets: BucketData[];
  summary: DistributionSummary;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={buckets}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)", fontWeight: 600 }}
            axisLine={{ stroke: COLORS.grid }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.axis, fontFamily: "var(--font-dm-mono)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: COLORS.tooltipBg,
              border: `1px solid ${COLORS.tooltipBorder}`,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "var(--font-dm-mono)",
              color: "#E8EDF5",
            }}
            formatter={(value: number, _name: string, props: { payload: BucketData }) => [
              `${value} PRs (score ${formatRange(props.payload.minScore, props.payload.maxScore)})`,
              props.payload.bucket,
            ]}
            cursor={{ fill: "rgba(34, 211, 238, 0.04)" }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} fillOpacity={0.85}>
            {buckets.map((entry) => (
              <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-between mt-4 pt-3 border-t border-border text-xs font-mono">
        <div>
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Total</span>
          <div className="text-text-primary mt-0.5">
            {summary.totalRaw} PRs → <span className="text-accent font-semibold">{summary.totalWeighted} weighted</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Avg Score</span>
          <div className="text-text-primary mt-0.5">{summary.avgScore}</div>
        </div>
        <div className="text-right">
          <span className="text-text-muted uppercase tracking-wider text-[10px]">Median</span>
          <div className="text-text-primary mt-0.5">{summary.medianScore}</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/TrueThroughputDistributionChart.tsx
git commit -m "feat: add TrueThroughputDistributionChart component"
```

---

### Task 8: Dashboard Integration

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add TrueThroughput data fetching and MetricCard**

Add import at the top of `src/app/dashboard/page.tsx`:

```ts
import TrueThroughputChart from "@/components/charts/TrueThroughputChart";
```

Add state inside `DashboardPage`:

```ts
const [ttWeekly, setTtWeekly] = useState<Array<{ week: string; trueThroughput: number; rawPrCount: number; avgScore: number }>>([]);
const [ttSummary, setTtSummary] = useState<{ totalWeighted: number; totalRaw: number } | null>(null);
```

Add the fetch to the existing `Promise.all` in the `useEffect`:

```ts
fetch(`/api/metrics/true-throughput?startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()).catch(() => ({})),
```

In the `.then` callback, add (the new fetch will be the 4th argument — adjust the destructuring accordingly):

```ts
if (ttData.weeklyTrend) setTtWeekly(ttData.weeklyTrend);
if (ttData.distribution?.summary) setTtSummary(ttData.distribution.summary);
```

- [ ] **Step 2: Add MetricCard to the grid**

Add this MetricCard after the "Additions" card, before the AI-Assisted PRs card:

```tsx
<MetricCard
  title="TrueThroughput"
  value={ttSummary ? ttSummary.totalWeighted : "–"}
  sparklineData={ttWeekly.map((w) => ({ value: w.trueThroughput }))}
  accentColor="#22D3EE"
/>
```

- [ ] **Step 3: Add TrueThroughputChart section**

Add this after the existing Team Throughput `<div>` section (after the closing `</div>` of the Team Throughput chart):

```tsx
{ttWeekly.length > 0 && (
  <div>
    <h2 className="text-lg font-display font-semibold mb-4 text-text-secondary">TrueThroughput</h2>
    <TrueThroughputChart data={ttWeekly} onWeekClick={handleWeekClick} />
  </div>
)}
```

- [ ] **Step 4: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No errors

Open `http://localhost:3000/dashboard` in the browser and verify:
- The TrueThroughput MetricCard appears in the top grid
- The TrueThroughput chart renders below the existing Team Throughput chart

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: integrate TrueThroughput into dashboard page"
```

---

### Task 9: Trends Page Integration

**Files:**
- Modify: `src/app/trends/page.tsx`

- [ ] **Step 1: Add imports, state, and fetch**

Add imports at the top of `src/app/trends/page.tsx`:

```ts
import TrueThroughputChart from "@/components/charts/TrueThroughputChart";
import TrueThroughputPerPersonChart from "@/components/charts/TrueThroughputPerPersonChart";
import TrueThroughputDistributionChart from "@/components/charts/TrueThroughputDistributionChart";
```

Add state variables inside `TrendsPage`:

```ts
const [ttWeekly, setTtWeekly] = useState<Array<{ week: string; trueThroughput: number; rawPrCount: number; avgScore: number }>>([]);
const [ttPerPerson, setTtPerPerson] = useState<Array<{ login: string; avatarUrl: string | null; trueThroughput: number; rawPrCount: number; avgScore: number }>>([]);
const [ttDistribution, setTtDistribution] = useState<{ buckets: Array<{ bucket: "XS" | "S" | "M" | "L" | "XL"; count: number; minScore: number; maxScore: number | null }>; summary: { totalWeighted: number; totalRaw: number; medianScore: number; avgScore: number } } | null>(null);
```

Add to the existing `Promise.all`:

```ts
fetch(`/api/metrics/true-throughput?${qs}`).then((r) => r.json()).catch(() => ({})),
```

In the `.then` callback, add (adjust the destructuring to include the new `tt` argument):

```ts
if (tt.weeklyTrend) setTtWeekly(tt.weeklyTrend);
if (tt.perPerson) setTtPerPerson(tt.perPerson);
if (tt.distribution) setTtDistribution(tt.distribution);
```

- [ ] **Step 2: Add TrueThroughput section to the JSX**

Add this section after the existing "Team Throughput" section and before the "Productivity Concentration" section:

```tsx
{ttWeekly.length > 0 && (
  <section>
    <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">
      TrueThroughput
      <InfoTooltip text="Weighted throughput that scores PRs by complexity (lines, files, reviews, merge time, churn) with a concentration discount for mechanical changes. A score of 1.0 = one median-complexity PR." />
    </h2>
    <TrueThroughputChart data={ttWeekly} onWeekClick={handleWeekClick} />
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {ttPerPerson.length > 0 && (
        <div>
          <h3 className="text-sm font-display font-semibold mb-3 text-text-muted">Per Person</h3>
          <TrueThroughputPerPersonChart data={ttPerPerson} />
        </div>
      )}
      {ttDistribution && (
        <div>
          <h3 className="text-sm font-display font-semibold mb-3 text-text-muted">Score Distribution</h3>
          <TrueThroughputDistributionChart buckets={ttDistribution.buckets} summary={ttDistribution.summary} />
        </div>
      )}
    </div>
  </section>
)}
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No errors

Open `http://localhost:3000/trends` and verify all three charts render in the TrueThroughput section.

- [ ] **Step 4: Commit**

```bash
git add src/app/trends/page.tsx
git commit -m "feat: integrate TrueThroughput into trends page"
```

---

### Task 10: Leaderboard Integration

**Files:**
- Modify: `src/app/api/metrics/leaderboard/route.ts`
- Modify: `src/app/leaderboard/page.tsx`

- [ ] **Step 1: Add TrueThroughput data to the leaderboard API**

In `src/app/api/metrics/leaderboard/route.ts`, add import:

```ts
import { computeAllScores, aggregatePerPerson } from "@/lib/metrics/true-throughput";
```

Add to the `Promise.all`:

```ts
computeAllScores(startDate, endDate).then(aggregatePerPerson).catch(() => []),
```

Add the result to the destructured array (adjust naming — e.g., `ttPerPerson`).

After the existing `leaderboard` array is built, merge TrueThroughput data:

```ts
const ttByLogin = new Map(ttPerPerson.map((r) => [r.login, r]));
const leaderboard = Object.values(people)
  .map((p) => {
    const tt = ttByLogin.get(p.login);
    return {
      ...p,
      trueThroughput: tt?.trueThroughput ?? 0,
      ttAvgScore: tt?.avgScore ?? 0,
    };
  })
  .sort((a, b) => b.prsMerged - a.prsMerged);
```

- [ ] **Step 2: Add the column to the leaderboard page**

In `src/app/leaderboard/page.tsx`, add `trueThroughput: number; ttAvgScore: number;` to the `LeaderboardEntry` interface.

Add a column header after the "PRs" column:

```tsx
<th className="px-4 py-3 text-right">Weighted</th>
```

Add the cell in each row, after the PRs cell:

```tsx
<td className="px-4 py-3 text-right font-mono text-accent">{entry.trueThroughput.toFixed(1)}</td>
```

- [ ] **Step 3: Verify it compiles and renders**

Run: `npx tsc --noEmit`
Expected: No errors

Open `http://localhost:3000/leaderboard` and verify the "Weighted" column appears with values.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/metrics/leaderboard/route.ts src/app/leaderboard/page.tsx
git commit -m "feat: add TrueThroughput column to leaderboard"
```

---

### Task 11: Build Verification

- [ ] **Step 1: Run full production build**

Run: `npm run build`
Expected: Build completes without errors

- [ ] **Step 2: Spot-check all pages**

Open each page and verify no runtime errors:
- `http://localhost:3000/dashboard` — MetricCard + chart
- `http://localhost:3000/trends` — all three TrueThroughput charts
- `http://localhost:3000/leaderboard` — Weighted column

- [ ] **Step 3: Commit any build fixes if needed**

If any TypeScript or lint issues were found, fix and commit:

```bash
git add -A
git commit -m "fix: resolve build issues for TrueThroughput"
```
