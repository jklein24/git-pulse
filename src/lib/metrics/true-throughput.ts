import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prFiles, prReviews, users, settings } from "../db/schema";
import { median, formatDate, MONDAY_OFFSET } from "./utils";

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

  const fileCounts = await db
    .select({
      prId: prFiles.prId,
      fileCount: sql<number>`count(*)`.as("file_count"),
    })
    .from(prFiles)
    .where(eq(prFiles.isExcluded, false))
    .groupBy(prFiles.prId);

  const fileCountMap = new Map(fileCounts.map((r) => [r.prId, r.fileCount]));

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

  const churnWindowSec = await getChurnWindowSeconds();

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
