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
