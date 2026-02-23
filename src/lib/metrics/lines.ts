import { sql, and, gte, lte, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users } from "../db/schema";
import { getWorkspaceRepoIds } from "../db/workspace-scope";

export async function getLinesPerPerson(workspaceId: number, startDate: number, endDate: number) {
  const repoIds = await getWorkspaceRepoIds(workspaceId);
  if (repoIds.length === 0) return [];

  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      additions: sql<number>`sum(${pullRequests.filteredAdditions})`.as("additions"),
      deletions: sql<number>`sum(${pullRequests.filteredDeletions})`.as("deletions"),
      prCount: sql<number>`count(*)`.as("pr_count"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        inArray(pullRequests.repoId, repoIds),
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`additions DESC`);
}

export async function getLinesPerPR(workspaceId: number, startDate: number, endDate: number) {
  const repoIds = await getWorkspaceRepoIds(workspaceId);
  if (repoIds.length === 0) return [];

  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      avgAdditions: sql<number>`avg(${pullRequests.filteredAdditions})`.as("avg_additions"),
      avgDeletions: sql<number>`avg(${pullRequests.filteredDeletions})`.as("avg_deletions"),
      prCount: sql<number>`count(*)`.as("pr_count"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        inArray(pullRequests.repoId, repoIds),
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`avg_additions DESC`);
}
