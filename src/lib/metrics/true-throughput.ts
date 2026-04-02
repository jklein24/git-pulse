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
