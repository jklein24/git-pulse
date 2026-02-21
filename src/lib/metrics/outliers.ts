import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prReviews, users, claudeCodeUsage } from "../db/schema";
import { stddev, mean, rollingAverage, formatDate, MONDAY_OFFSET } from "./utils";

const EXCLUDED_LOGINS = new Set([
  "github-actions", "lightspark-bot", "cursor", "claude",
  "greptile-apps", "graphite-app", "restamp-bot", "coderabbitai", "dependabot",
]);

const EXCLUDED_REVIEW_LOGINS = new Set([
  ...EXCLUDED_LOGINS,
  "mhrheaume",
]);

export interface Outlier {
  login: string;
  avatarUrl: string | null;
  metric: string;
  value: number;
  teamMean: number;
  type: "statistical" | "top" | "bottom" | "trend_decline";
  severity: "info" | "warning";
}

interface PersonMetric {
  login: string;
  avatarUrl: string | null;
  value: number;
}

function detectStatisticalOutliers(data: PersonMetric[], metricName: string, threshold = 2): Outlier[] {
  const values = data.map((d) => d.value);
  const m = mean(values);
  const sd = stddev(values);
  if (sd === 0) return [];

  return data
    .filter((d) => Math.abs(d.value - m) > threshold * sd)
    .map((d) => ({
      login: d.login,
      avatarUrl: d.avatarUrl,
      metric: metricName,
      value: d.value,
      teamMean: Math.round(m * 10) / 10,
      type: "statistical" as const,
      severity: d.value < m ? "warning" as const : "info" as const,
    }));
}

function detectTopBottom(data: PersonMetric[], metricName: string, n = 3): Outlier[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const m = mean(data.map((d) => d.value));
  if (sorted.length < 5) return [];
  const outliers: Outlier[] = [];

  sorted.slice(0, n).forEach((d) => {
    if (d.value > m * 1.5) {
      outliers.push({
        login: d.login,
        avatarUrl: d.avatarUrl,
        metric: metricName,
        value: d.value,
        teamMean: Math.round(m * 10) / 10,
        type: "top",
        severity: "info",
      });
    }
  });

  sorted.slice(-n).forEach((d) => {
    if (d.value < m * 0.5) {
      outliers.push({
        login: d.login,
        avatarUrl: d.avatarUrl,
        metric: metricName,
        value: d.value,
        teamMean: Math.round(m * 10) / 10,
        type: "bottom",
        severity: "warning",
      });
    }
  });

  return outliers;
}

export async function getOutliers(startDate: number, endDate: number): Promise<Outlier[]> {
  const db = getDb();
  const outliers: Outlier[] = [];

  const prsMerged = await db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
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
    .groupBy(users.githubLogin);

  const prData: PersonMetric[] = prsMerged
    .filter((r) => r.count >= 3 && !EXCLUDED_LOGINS.has(r.login))
    .map((r) => ({
      login: r.login,
      avatarUrl: r.avatarUrl,
      value: r.count,
    }));

  outliers.push(...detectTopBottom(prData, "PRs Merged"));
  outliers.push(...detectStatisticalOutliers(prData, "PRs Merged"));

  const reviewCounts = await db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      count: sql<number>`count(*)`.as("count"),
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
    .groupBy(users.githubLogin);

  const reviewData: PersonMetric[] = reviewCounts
    .filter((r) => r.count >= 3 && !EXCLUDED_REVIEW_LOGINS.has(r.login))
    .map((r) => ({
      login: r.login,
      avatarUrl: r.avatarUrl,
      value: r.count,
    }));

  outliers.push(...detectTopBottom(reviewData, "Reviews Given"));
  outliers.push(...detectStatisticalOutliers(reviewData, "Reviews Given"));

  const linesData = await db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      loc: sql<number>`sum(${pullRequests.filteredAdditions}) + sum(${pullRequests.filteredDeletions})`.as("loc"),
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

  const locMetrics: PersonMetric[] = linesData
    .filter((r) => (r.loc ?? 0) >= 10 && !EXCLUDED_LOGINS.has(r.login))
    .map((r) => ({
      login: r.login,
      avatarUrl: r.avatarUrl,
      value: r.loc ?? 0,
    }));

  outliers.push(...detectTopBottom(locMetrics, "Lines Written"));
  outliers.push(...detectStatisticalOutliers(locMetrics, "Lines Written"));

  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  try {
    const aiSessionsData = await db
      .select({
        login: users.githubLogin,
        avatarUrl: users.avatarUrl,
        sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
        accepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted} + ${claudeCodeUsage.writeToolAccepted} + ${claudeCodeUsage.multiEditToolAccepted})`.as("accepted"),
        rejected: sql<number>`sum(${claudeCodeUsage.editToolRejected} + ${claudeCodeUsage.writeToolRejected} + ${claudeCodeUsage.multiEditToolRejected})`.as("rejected"),
      })
      .from(claudeCodeUsage)
      .innerJoin(users, eq(claudeCodeUsage.userId, users.id))
      .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
      .groupBy(users.githubLogin);

    if (aiSessionsData.length >= 3) {
      const sessionMetrics: PersonMetric[] = aiSessionsData
        .filter((r) => !EXCLUDED_LOGINS.has(r.login))
        .map((r) => ({
          login: r.login,
          avatarUrl: r.avatarUrl,
          value: r.sessions ?? 0,
        }));

      const teamMeanSessions = mean(sessionMetrics.map((d) => d.value));

      const allContributors = prsMerged
        .filter((r) => !EXCLUDED_LOGINS.has(r.login))
        .map((r) => r.login);

      const aiLogins = new Set(aiSessionsData.map((r) => r.login));
      for (const login of allContributors) {
        if (!aiLogins.has(login)) {
          const user = prsMerged.find((r) => r.login === login);
          outliers.push({
            login,
            avatarUrl: user?.avatarUrl ?? null,
            metric: "AI Sessions (low adoption)",
            value: 0,
            teamMean: Math.round(teamMeanSessions * 10) / 10,
            type: "bottom",
            severity: "warning",
          });
        }
      }

      for (const r of aiSessionsData) {
        if (EXCLUDED_LOGINS.has(r.login)) continue;
        const accepted = r.accepted ?? 0;
        const rejected = r.rejected ?? 0;
        const total = accepted + rejected;
        if (total >= 10) {
          const rate = Math.round((accepted / total) * 100);
          if (rate < 50) {
            outliers.push({
              login: r.login,
              avatarUrl: r.avatarUrl,
              metric: "AI Accept Rate (low)",
              value: rate,
              teamMean: 50,
              type: "bottom",
              severity: "warning",
            });
          }
        }
      }
    }
  } catch {
    // AI data may not exist yet
  }

  const seen = new Set<string>();
  return outliers.filter((o) => {
    const key = `${o.login}:${o.metric}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getTrendOutliers(endDate: number): Promise<Outlier[]> {
  const oneWeek = 604800;
  const fourWeeks = 4 * oneWeek;
  const lastWeekStart = endDate - oneWeek;
  const rollingStart = endDate - fourWeeks - oneWeek;

  const db = getDb();
  const outliers: Outlier[] = [];

  const weeklyPRs = await db
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
        gte(pullRequests.mergedAt, rollingStart),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin, sql`week`);

  const byPerson: Record<string, { avatarUrl: string | null; weeks: Record<number, number> }> = {};
  for (const row of weeklyPRs) {
    if (EXCLUDED_LOGINS.has(row.login)) continue;
    if (!byPerson[row.login]) {
      byPerson[row.login] = { avatarUrl: row.avatarUrl, weeks: {} };
    }
    byPerson[row.login].weeks[row.week] = row.count;
  }

  const lastWeekNum = ((lastWeekStart + MONDAY_OFFSET) - ((lastWeekStart + MONDAY_OFFSET) % oneWeek)) - MONDAY_OFFSET;

  for (const [login, data] of Object.entries(byPerson)) {
    const currentWeekValue = data.weeks[lastWeekNum] ?? 0;
    const priorWeeks = Object.entries(data.weeks)
      .filter(([w]) => Number(w) < lastWeekNum)
      .map(([, v]) => v);

    if (priorWeeks.length < 3) continue;

    const rolling = rollingAverage(priorWeeks, 4);
    if (rolling >= 3 && currentWeekValue < rolling * 0.4) {
      outliers.push({
        login,
        avatarUrl: data.avatarUrl,
        metric: "PRs Merged (trend decline)",
        value: currentWeekValue,
        teamMean: Math.round(rolling * 10) / 10,
        type: "trend_decline",
        severity: "warning",
      });
    }
  }

  return outliers;
}
