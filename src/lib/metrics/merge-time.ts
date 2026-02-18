import { and, gte, lte, eq, isNotNull, sql } from "drizzle-orm";
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

const SIZE_BUCKETS = [
  { label: "XS (1–10)", max: 10 },
  { label: "S (11–50)", max: 50 },
  { label: "M (51–200)", max: 200 },
  { label: "L (201–500)", max: 500 },
  { label: "XL (500+)", max: Infinity },
] as const;

function sizeBucket(loc: number): string {
  for (const b of SIZE_BUCKETS) {
    if (loc <= b.max) return b.label;
  }
  return SIZE_BUCKETS[SIZE_BUCKETS.length - 1].label;
}

export async function getMergeTimeBySize(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      publishedAt: pullRequests.publishedAt,
      mergedAt: pullRequests.mergedAt,
      additions: pullRequests.filteredAdditions,
      deletions: pullRequests.filteredDeletions,
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
    );

  const byBucket: Record<string, number[]> = {};
  for (const row of rows) {
    if (!row.publishedAt || !row.mergedAt) continue;
    const loc = (row.additions ?? 0) + (row.deletions ?? 0);
    const bucket = sizeBucket(loc);
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push(row.mergedAt - row.publishedAt);
  }

  return SIZE_BUCKETS.map((b) => {
    const times = byBucket[b.label] || [];
    return {
      bucket: b.label,
      p50: hoursFromSeconds(median(times)),
      p75: hoursFromSeconds(percentile(times, 75)),
      prCount: times.length,
    };
  });
}
