import { sql, and, gte, lte, eq, isNotNull, ne } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prReviews, users } from "../db/schema";
import { median, formatDate, hoursFromSeconds } from "./utils";

export async function getReviewVelocityTrend(startDate: number, endDate: number) {
  const db = getDb();

  const prs = await db
    .select({
      prId: pullRequests.id,
      publishedAt: pullRequests.publishedAt,
      authorId: pullRequests.authorId,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        isNotNull(pullRequests.publishedAt),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    );

  const reviews = await db
    .select({
      prId: prReviews.prId,
      reviewerId: prReviews.reviewerId,
      submittedAt: prReviews.submittedAt,
      reviewerLogin: users.githubLogin,
    })
    .from(prReviews)
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .where(isNotNull(prReviews.submittedAt))
    .orderBy(prReviews.submittedAt);

  const botPattern = /(-bot|bot)$|-apps?$/i;
  const reviewsByPr: Record<number, Array<{ reviewerId: number | null; submittedAt: number }>> = {};
  for (const r of reviews) {
    if (!r.submittedAt) continue;
    if (botPattern.test(r.reviewerLogin)) continue;
    if (!reviewsByPr[r.prId]) reviewsByPr[r.prId] = [];
    reviewsByPr[r.prId].push({ reviewerId: r.reviewerId, submittedAt: r.submittedAt });
  }

  const byWeek: Record<number, number[]> = {};
  for (const pr of prs) {
    if (!pr.publishedAt || !pr.mergedAt) continue;
    const prReviewList = reviewsByPr[pr.prId] || [];
    const firstNonSelf = prReviewList.find((r) => r.reviewerId !== pr.authorId);
    if (!firstNonSelf) continue;

    const velocity = firstNonSelf.submittedAt - pr.publishedAt;
    if (velocity < 0) continue;

    const week = pr.mergedAt - (pr.mergedAt % 604800);
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(velocity);
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, times]) => ({
      week: formatDate(Number(week)),
      medianHours: hoursFromSeconds(median(times)),
      count: times.length,
    }));
}
