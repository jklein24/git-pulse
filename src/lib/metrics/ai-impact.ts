import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { claudeCodeUsage, pullRequests, users, prReviews } from "../db/schema";
import { formatDate, MONDAY_OFFSET, mean } from "./utils";

function weekExpr(dateField: typeof claudeCodeUsage.date) {
  const unix = sql<number>`cast(strftime('%s', ${dateField}) as integer)`;
  return sql<number>`((${unix} + ${MONDAY_OFFSET}) - ((${unix} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`;
}

export async function getAiUsageVsThroughput(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const aiByPerson = await db
    .select({
      login: users.githubLogin,
      sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
      linesAdded: sql<number>`sum(${claudeCodeUsage.linesAdded})`.as("lines_added"),
      accepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted} + ${claudeCodeUsage.writeToolAccepted} + ${claudeCodeUsage.multiEditToolAccepted})`.as("accepted"),
      rejected: sql<number>`sum(${claudeCodeUsage.editToolRejected} + ${claudeCodeUsage.writeToolRejected} + ${claudeCodeUsage.multiEditToolRejected})`.as("rejected"),
    })
    .from(claudeCodeUsage)
    .innerJoin(users, eq(claudeCodeUsage.userId, users.id))
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(users.githubLogin);

  const prsByPerson = await db
    .select({
      login: users.githubLogin,
      prsMerged: sql<number>`count(*)`.as("prs_merged"),
      loc: sql<number>`sum(${pullRequests.filteredAdditions} + ${pullRequests.filteredDeletions})`.as("loc"),
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
    .groupBy(users.githubLogin);

  const prsMap = new Map(prsByPerson.map((r) => [r.login, r]));
  const weeks = Math.max(1, (endDate - startDate) / 604800);

  return aiByPerson
    .map((ai) => {
      const prs = prsMap.get(ai.login);
      const accepted = ai.accepted ?? 0;
      const rejected = ai.rejected ?? 0;
      return {
        login: ai.login,
        sessionsPerWeek: Math.round(((ai.sessions ?? 0) / weeks) * 10) / 10,
        prsMergedPerWeek: prs ? Math.round((prs.prsMerged / weeks) * 10) / 10 : 0,
        loc: prs?.loc ?? 0,
        acceptRate: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : 0,
      };
    })
    .filter((r) => r.sessionsPerWeek > 0);
}

export async function getAiVelocityImpact(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const mergeTimeByWeek = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      mergeTimeMedian: sql<number>`avg(${pullRequests.mergedAt} - ${pullRequests.createdAt})`.as("merge_time_median"),
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

  const aiAdoptionByWeek = await db
    .select({
      week: weekExpr(claudeCodeUsage.date).as("week"),
      activeUsers: sql<number>`count(distinct ${claudeCodeUsage.email})`.as("active_users"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const totalUsers = await db
    .select({
      count: sql<number>`count(distinct ${pullRequests.authorId})`.as("count"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .get();

  const totalContributors = totalUsers?.count ?? 1;
  const adoptionByWeek = new Map(aiAdoptionByWeek.map((r) => [r.week, r.activeUsers]));

  return mergeTimeByWeek.map((r) => {
    const activeAi = adoptionByWeek.get(r.week) ?? 0;
    return {
      week: formatDate(r.week),
      mergeTimeHours: Math.round(((r.mergeTimeMedian ?? 0) / 3600) * 10) / 10,
      aiAdoptionRate: Math.round((activeAi / totalContributors) * 100),
    };
  });
}

export async function getBeforeAfterComparison(startDate: number, endDate: number) {
  const db = getDb();

  const firstUsage = await db
    .select({
      firstDate: sql<string>`min(${claudeCodeUsage.date})`.as("first_date"),
    })
    .from(claudeCodeUsage)
    .get();

  if (!firstUsage?.firstDate) return null;

  const splitDate = new Date(firstUsage.firstDate + "T00:00:00Z");
  if (isNaN(splitDate.getTime())) return null;

  const splitPoint = Math.floor(splitDate.getTime() / 1000);

  if (splitPoint <= startDate || splitPoint >= endDate) return null;

  async function getPeriodMetrics(from: number, to: number) {
    const db = getDb();
    const result = await db
      .select({
        prsMerged: sql<number>`count(*)`.as("prs_merged"),
        avgMergeTime: sql<number>`avg(${pullRequests.mergedAt} - ${pullRequests.createdAt})`.as("avg_merge_time"),
        avgLoc: sql<number>`avg(${pullRequests.filteredAdditions} + ${pullRequests.filteredDeletions})`.as("avg_loc"),
      })
      .from(pullRequests)
      .where(
        and(
          eq(pullRequests.state, "MERGED"),
          gte(pullRequests.mergedAt, from),
          lte(pullRequests.mergedAt, to),
        ),
      )
      .get();

    const weeks = Math.max(1, (to - from) / 604800);
    return {
      prsPerWeek: result ? Math.round((result.prsMerged / weeks) * 10) / 10 : 0,
      avgMergeTimeHours: result?.avgMergeTime ? Math.round((result.avgMergeTime / 3600) * 10) / 10 : 0,
      avgLoc: result?.avgLoc ? Math.round(result.avgLoc) : 0,
    };
  }

  const before = await getPeriodMetrics(startDate, splitPoint);
  const after = await getPeriodMetrics(splitPoint, endDate);

  return {
    splitDate: formatDate(splitPoint),
    before,
    after,
    delta: {
      prsPerWeek: after.prsPerWeek - before.prsPerWeek,
      avgMergeTimeHours: after.avgMergeTimeHours - before.avgMergeTimeHours,
      avgLoc: after.avgLoc - before.avgLoc,
    },
  };
}
