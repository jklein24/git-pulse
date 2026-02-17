import { and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prReviews, users } from "../db/schema";
import { median, formatDate } from "./utils";

export async function getReviewIterationsTrend(startDate: number, endDate: number) {
  const db = getDb();

  const prs = await db
    .select({
      prId: pullRequests.id,
      authorId: pullRequests.authorId,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        isNotNull(pullRequests.mergedAt),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    );

  const reviews = await db
    .select({
      prId: prReviews.prId,
      reviewerId: prReviews.reviewerId,
      reviewerLogin: users.githubLogin,
    })
    .from(prReviews)
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .where(isNotNull(prReviews.submittedAt));

  const botPattern = /(-bot|bot)$|-apps?$/i;
  const reviewCountByPr: Record<number, number> = {};
  for (const r of reviews) {
    if (botPattern.test(r.reviewerLogin)) continue;
    reviewCountByPr[r.prId] = (reviewCountByPr[r.prId] || 0) + 1;
  }

  const byWeek: Record<number, number[]> = {};
  for (const pr of prs) {
    if (!pr.mergedAt) continue;
    const count = reviewCountByPr[pr.prId] || 0;
    if (count === 0) continue;

    const week = pr.mergedAt - (pr.mergedAt % 604800);
    if (!byWeek[week]) byWeek[week] = [];
    byWeek[week].push(count);
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, counts]) => ({
      week: formatDate(Number(week)),
      medianIterations: Math.round(median(counts) * 10) / 10,
      avgIterations: Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 10) / 10,
      prCount: counts.length,
    }));
}
