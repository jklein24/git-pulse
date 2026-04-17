export interface PRInput {
  filteredAdditions: number;
  filteredDeletions: number;
  filesChanged: number;
  reviewCount: number;
  hoursToMerge: number;
  churnRatio: number;
}

export type Bucket = "XS" | "S" | "M" | "L" | "XL";

export const WEIGHTS = {
  lines: 0.35,
  files: 0.25,
  reviews: 0.20,
  mergeTime: 0.10,
  churn: 0.10,
};

export const BUCKET_THRESHOLDS: Array<{ bucket: Bucket; max: number }> = [
  { bucket: "XS", max: 0.5 },
  { bucket: "S", max: 1.0 },
  { bucket: "M", max: 2.0 },
  { bucket: "L", max: 4.0 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getBucket(normalizedScore: number): Bucket {
  for (const { bucket, max } of BUCKET_THRESHOLDS) {
    if (normalizedScore < max) return bucket;
  }
  return "XL";
}

export interface ScoreBreakdown {
  linesComponent: number;
  filesComponent: number;
  reviewsComponent: number;
  mergeTimeComponent: number;
  churnComponent: number;
  rawScore: number;
  concentrationMultiplier: number;
  finalScore: number;
}

export function scorePR(pr: PRInput): ScoreBreakdown {
  const lines = pr.filteredAdditions + pr.filteredDeletions;

  const linesComponent = WEIGHTS.lines * Math.sqrt(lines);
  const filesComponent = WEIGHTS.files * Math.sqrt(pr.filesChanged);
  const reviewsComponent = WEIGHTS.reviews * Math.sqrt(Math.max(pr.reviewCount, 1));
  const mergeTimeComponent = WEIGHTS.mergeTime * Math.log2(1 + pr.hoursToMerge);
  const churnComponent = WEIGHTS.churn * pr.churnRatio;

  const rawScore = linesComponent + filesComponent + reviewsComponent + mergeTimeComponent + churnComponent;

  const linesPerFile = lines / Math.max(pr.filesChanged, 1);
  const concentrationMultiplier = clamp(linesPerFile / 25, 0.3, 1.0);

  return {
    linesComponent,
    filesComponent,
    reviewsComponent,
    mergeTimeComponent,
    churnComponent,
    rawScore,
    concentrationMultiplier,
    finalScore: rawScore * concentrationMultiplier,
  };
}
