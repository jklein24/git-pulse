import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { prReviews, pullRequests, users } from "../db/schema";
import { notBotLoginSql } from "./utils";

// Counts distinct PRs each user reviewed (not raw review events, which double-count
// multiple reviews on the same PR), excluding self-authored PRs and bot/app reviewers.
export async function getReviewLoad(startDate: number, endDate: number) {
  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      reviewCount: sql<number>`count(distinct ${prReviews.prId})`.as("review_count"),
    })
    .from(prReviews)
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .innerJoin(pullRequests, eq(prReviews.prId, pullRequests.id))
    .where(
      and(
        isNotNull(prReviews.submittedAt),
        gte(prReviews.submittedAt, startDate),
        lte(prReviews.submittedAt, endDate),
        sql`(${pullRequests.authorId} IS NULL OR ${pullRequests.authorId} <> ${prReviews.reviewerId})`,
        notBotLoginSql(users.githubLogin),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`review_count DESC`);
}
