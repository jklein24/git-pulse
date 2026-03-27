import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { jiraIssues, users } from "../db/schema";
import { MONDAY_OFFSET, formatDate } from "./utils";

export async function getTicketThroughput(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      week: sql<number>`((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) - ((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      resolved: sql<number>`count(*)`.as("resolved"),
    })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        isNotNull(jiraIssues.resolvedAt),
        gte(jiraIssues.resolvedAt, startDate),
        lte(jiraIssues.resolvedAt, endDate),
      ),
    )
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  return rows.map((r) => ({
    week: formatDate(r.week),
    resolved: r.resolved,
  }));
}

export async function getTicketsResolvedPerPerson(startDate: number, endDate: number) {
  const db = getDb();

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      resolved: sql<number>`count(*)`.as("resolved"),
      medianCycleDays: sql<number>`null`.as("median_cycle_days"),
    })
    .from(jiraIssues)
    .innerJoin(users, eq(jiraIssues.userId, users.id))
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        isNotNull(jiraIssues.resolvedAt),
        gte(jiraIssues.resolvedAt, startDate),
        lte(jiraIssues.resolvedAt, endDate),
      ),
    )
    .groupBy(users.githubLogin)
    .orderBy(sql`resolved DESC`);
}

export async function getTicketCycleTime(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      week: sql<number>`((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) - ((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      avgCycleDays: sql<number>`avg((${jiraIssues.resolvedAt} - ${jiraIssues.createdAt}) / 86400.0)`.as("avg_cycle_days"),
      medianCycleDays: sql<number>`null`.as("median_cycle_days"),
      ticketCount: sql<number>`count(*)`.as("ticket_count"),
    })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        isNotNull(jiraIssues.resolvedAt),
        gte(jiraIssues.resolvedAt, startDate),
        lte(jiraIssues.resolvedAt, endDate),
      ),
    )
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  return rows.map((r) => ({
    week: formatDate(r.week),
    avgCycleDays: Math.round((r.avgCycleDays ?? 0) * 10) / 10,
    ticketCount: r.ticketCount,
  }));
}

export async function getTicketsByProject(startDate: number, endDate: number) {
  const db = getDb();

  return db
    .select({
      projectKey: jiraIssues.projectKey,
      resolved: sql<number>`sum(case when ${jiraIssues.status} = 'Done' and ${jiraIssues.resolvedAt} >= ${startDate} and ${jiraIssues.resolvedAt} <= ${endDate} then 1 else 0 end)`.as("resolved"),
      inProgress: sql<number>`sum(case when ${jiraIssues.status} = 'In Progress' then 1 else 0 end)`.as("in_progress"),
      total: sql<number>`count(*)`.as("total"),
    })
    .from(jiraIssues)
    .where(
      and(
        gte(jiraIssues.updatedAt, startDate),
        lte(jiraIssues.updatedAt, endDate),
      ),
    )
    .groupBy(jiraIssues.projectKey)
    .orderBy(sql`resolved DESC`);
}

export async function getTicketDataQuality(startDate: number, endDate: number) {
  const db = getDb();

  const total = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        isNotNull(jiraIssues.resolvedAt),
        gte(jiraIssues.resolvedAt, startDate),
        lte(jiraIssues.resolvedAt, endDate),
      ),
    )
    .get();

  const unassigned = await db
    .select({ count: sql<number>`count(*)`.as("count") })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        isNotNull(jiraIssues.resolvedAt),
        gte(jiraIssues.resolvedAt, startDate),
        lte(jiraIssues.resolvedAt, endDate),
        sql`${jiraIssues.assigneeEmail} is null`,
      ),
    )
    .get();

  const totalCount = total?.count ?? 0;
  const unassignedCount = unassigned?.count ?? 0;

  return {
    totalResolved: totalCount,
    unassignedResolved: unassignedCount,
    unassignedPct: totalCount > 0 ? Math.round((unassignedCount / totalCount) * 100) : 0,
  };
}
