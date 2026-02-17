import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { prReviews, users } from "../db/schema";

export async function getReviewLoad(startDate: number, endDate: number) {
  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      reviewCount: sql<number>`count(*)`.as("review_count"),
    })
    .from(prReviews)
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .where(
      and(
        isNotNull(prReviews.submittedAt),
        gte(prReviews.submittedAt, startDate),
        lte(prReviews.submittedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`review_count DESC`);
}
