import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users } from "../db/schema";
import { startOfWeek, formatDate, MONDAY_OFFSET } from "./utils";

export async function getTeamThroughput(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      prCount: sql<number>`count(*)`.as("pr_count"),
      additions: sql<number>`sum(${pullRequests.filteredAdditions})`.as("additions"),
      deletions: sql<number>`sum(${pullRequests.filteredDeletions})`.as("deletions"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const contributorRows = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      contributors: sql<number>`count(distinct ${pullRequests.authorId})`.as("contributors"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(sql`week`);

  const contributorsByWeek = new Map(contributorRows.map((r) => [formatDate(r.week), r.contributors]));

  return rows.map((r) => {
    const weekKey = formatDate(r.week);
    const contributors = contributorsByWeek.get(weekKey) || 1;
    const loc = (r.additions ?? 0) + (r.deletions ?? 0);
    return {
      week: weekKey,
      prCount: r.prCount,
      additions: r.additions ?? 0,
      deletions: r.deletions ?? 0,
      loc,
      prsPerContributor: Math.round((r.prCount / contributors) * 10) / 10,
      linesPerContributor: Math.round(loc / contributors),
    };
  });
}

export async function getPrsMergedPerPerson(startDate: number, endDate: number) {
  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin, sql`week`)
    .orderBy(sql`week`);
}
