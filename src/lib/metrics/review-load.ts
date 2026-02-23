import { sql, and, gte, lte, eq, isNotNull, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { prReviews, pullRequests, users } from "../db/schema";
import { getWorkspaceRepoIds } from "../db/workspace-scope";

export async function getReviewLoad(workspaceId: number, startDate: number, endDate: number) {
  const repoIds = await getWorkspaceRepoIds(workspaceId);
  if (repoIds.length === 0) return [];

  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      reviewCount: sql<number>`count(*)`.as("review_count"),
    })
    .from(prReviews)
    .innerJoin(pullRequests, eq(prReviews.prId, pullRequests.id))
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .where(
      and(
        inArray(pullRequests.repoId, repoIds),
        isNotNull(prReviews.submittedAt),
        gte(prReviews.submittedAt, startDate),
        lte(prReviews.submittedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`review_count DESC`);
}
