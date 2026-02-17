import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users } from "../db/schema";
import { median, percentile, mean as meanFn, formatDate, hoursFromSeconds, MONDAY_OFFSET } from "./utils";

export async function getMergeTimePerPerson(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      publishedAt: pullRequests.publishedAt,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        isNotNull(pullRequests.publishedAt),
        isNotNull(pullRequests.mergedAt),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    );

  const byPerson: Record<string, { times: number[]; avatarUrl: string | null }> = {};
  for (const row of rows) {
    if (!row.publishedAt || !row.mergedAt) continue;
    const duration = row.mergedAt - row.publishedAt;
    if (!byPerson[row.login]) {
      byPerson[row.login] = { times: [], avatarUrl: row.avatarUrl };
    }
    byPerson[row.login].times.push(duration);
  }

  return Object.entries(byPerson).map(([login, data]) => ({
    login,
    avatarUrl: data.avatarUrl,
    medianHours: hoursFromSeconds(median(data.times)),
    meanHours: hoursFromSeconds(meanFn(data.times)),
    prCount: data.times.length,
  }));
}

export async function getMergeTimeTrend(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      publishedAt: pullRequests.publishedAt,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        isNotNull(pullRequests.publishedAt),
        isNotNull(pullRequests.mergedAt),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .orderBy(sql`week`);

  const byWeek: Record<number, number[]> = {};
  for (const row of rows) {
    if (!row.publishedAt || !row.mergedAt) continue;
    const duration = row.mergedAt - row.publishedAt;
    if (!byWeek[row.week]) byWeek[row.week] = [];
    byWeek[row.week].push(duration);
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, times]) => ({
      week: formatDate(Number(week)),
      p50: hoursFromSeconds(percentile(times, 50)),
      p75: hoursFromSeconds(percentile(times, 75)),
      p90: hoursFromSeconds(percentile(times, 90)),
      count: times.length,
    }));
}
