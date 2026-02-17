import { minimatch } from "minimatch";
import type { PullRequestNode } from "./client";

export function toUnix(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function getPublishedAt(pr: PullRequestNode): number | null {
  const readyEvent = pr.timelineItems.nodes[0];
  if (readyEvent) return toUnix(readyEvent.createdAt);
  if (!pr.isDraft) return toUnix(pr.createdAt);
  return null;
}

export function transformPR(pr: PullRequestNode) {
  return {
    githubId: pr.databaseId,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    isDraft: pr.isDraft,
    createdAt: toUnix(pr.createdAt)!,
    publishedAt: getPublishedAt(pr),
    mergedAt: toUnix(pr.mergedAt),
    closedAt: toUnix(pr.closedAt),
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    url: pr.url,
  };
}

export function transformReview(review: PullRequestNode["reviews"]["nodes"][0]) {
  return {
    githubId: review.databaseId,
    state: review.state,
    submittedAt: toUnix(review.submittedAt),
  };
}

export function computeFilteredStats(
  files: Array<{ additions: number | null; deletions: number | null; isExcluded: boolean }>,
): { filteredAdditions: number; filteredDeletions: number } {
  let filteredAdditions = 0;
  let filteredDeletions = 0;
  for (const f of files) {
    if (!f.isExcluded) {
      filteredAdditions += f.additions ?? 0;
      filteredDeletions += f.deletions ?? 0;
    }
  }
  return { filteredAdditions, filteredDeletions };
}

export function isFileExcluded(filename: string, patterns: string[]): boolean {
  return patterns.some((p) => minimatch(filename, p));
}
