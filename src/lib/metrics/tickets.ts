import { sql, and, gte, lte, eq, isNotNull, inArray, notInArray, ne } from "drizzle-orm";
import { getDb } from "../db";
import { jiraIssues, users } from "../db/schema";
import { MONDAY_OFFSET, formatDate } from "./utils";

const IN_REVIEW_STATUSES = new Set(["in review", "code review", "review", "pr review"]);
const IN_PROGRESS_STATUSES = new Set(["in progress", "in development", "doing"]);
const DONE_STATUSES = new Set(["done", "closed", "resolved", "completed"]);
const INACTIVE_EPIC_STATUSES = ["Done", "Cancelled"];
const STALE_THRESHOLD_DAYS = 30;

function bucketStatus(status: string): "todo" | "inProgress" | "inReview" | "done" {
  const s = status.toLowerCase();
  if (DONE_STATUSES.has(s)) return "done";
  if (IN_REVIEW_STATUSES.has(s)) return "inReview";
  if (IN_PROGRESS_STATUSES.has(s)) return "inProgress";
  return "todo";
}

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

export async function getProjectThroughputTrend(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      week: sql<number>`((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) - ((${jiraIssues.resolvedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      projectKey: jiraIssues.projectKey,
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
    .groupBy(sql`week`, jiraIssues.projectKey)
    .orderBy(sql`week`);

  return rows.map((r) => ({
    week: formatDate(r.week),
    projectKey: r.projectKey,
    resolved: r.resolved,
  }));
}

export async function getStatusSnapshot() {
  const db = getDb();

  const rows = await db
    .select({
      projectKey: jiraIssues.projectKey,
      status: jiraIssues.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(jiraIssues)
    .groupBy(jiraIssues.projectKey, jiraIssues.status);

  const byProject = new Map<string, { todo: number; inProgress: number; inReview: number; done: number }>();
  for (const r of rows) {
    const bucket = bucketStatus(r.status);
    const existing = byProject.get(r.projectKey) ?? { todo: 0, inProgress: 0, inReview: 0, done: 0 };
    existing[bucket] += r.count;
    byProject.set(r.projectKey, existing);
  }

  return [...byProject.entries()]
    .map(([projectKey, counts]) => ({ projectKey, ...counts }))
    .sort((a, b) => (b.todo + b.inProgress + b.inReview) - (a.todo + a.inProgress + a.inReview));
}

export async function getActiveEpics(limit = 100) {
  const db = getDb();

  const rows = await db
    .select({
      key: jiraIssues.jiraKey,
      summary: jiraIssues.summary,
      projectKey: jiraIssues.projectKey,
      status: jiraIssues.status,
      dueDate: jiraIssues.dueDate,
      updatedAt: jiraIssues.updatedAt,
      lastChildActivity: sql<number | null>`(
        select max(c.updated_at)
        from jira_issues c
        where c.parent_key = ${jiraIssues.jiraKey}
      )`.as("last_child_activity"),
      totalChildren: sql<number>`(
        select count(*)
        from jira_issues c
        where c.parent_key = ${jiraIssues.jiraKey}
      )`.as("total_children"),
      doneChildren: sql<number>`(
        select count(*)
        from jira_issues c
        where c.parent_key = ${jiraIssues.jiraKey} and c.status = 'Done'
      )`.as("done_children"),
    })
    .from(jiraIssues)
    .where(and(eq(jiraIssues.issueType, "Epic"), notInArray(jiraIssues.status, INACTIVE_EPIC_STATUSES)))
    .orderBy(sql`coalesce(last_child_activity, ${jiraIssues.updatedAt}, ${jiraIssues.createdAt}) desc`)
    .limit(limit);

  return rows.map((r) => ({
    key: r.key,
    summary: r.summary,
    projectKey: r.projectKey,
    status: r.status,
    dueDate: r.dueDate ? formatDate(r.dueDate) : null,
    lastActivity: r.lastChildActivity
      ? formatDate(r.lastChildActivity)
      : r.updatedAt
        ? formatDate(r.updatedAt)
        : null,
    totalChildren: r.totalChildren,
    doneChildren: r.doneChildren,
    percentDone: r.totalChildren > 0 ? Math.round((r.doneChildren / r.totalChildren) * 100) : 0,
  }));
}

export async function getEpicProgress(excludeKeys?: string[], starredKeys?: string[]) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  const fourWeeksAgo = now - 28 * 86400;
  const twoWeeksAgo = now - 14 * 86400;
  const oneWeekAgo = now - 7 * 86400;
  const starredSet = new Set(starredKeys ?? []);

  const conditions = [
    eq(jiraIssues.issueType, "Epic"),
    notInArray(jiraIssues.status, INACTIVE_EPIC_STATUSES),
  ];
  if (excludeKeys && excludeKeys.length > 0) {
    conditions.push(notInArray(jiraIssues.jiraKey, excludeKeys));
  }

  const epics = await db
    .select({
      key: jiraIssues.jiraKey,
      summary: jiraIssues.summary,
      projectKey: jiraIssues.projectKey,
      status: jiraIssues.status,
      assigneeName: jiraIssues.assigneeName,
      dueDate: jiraIssues.dueDate,
      updatedAt: jiraIssues.updatedAt,
      url: jiraIssues.url,
    })
    .from(jiraIssues)
    .where(and(...conditions));
  if (epics.length === 0) return [];

  const keys = epics.map((e) => e.key);

  const childRollup = await db
    .select({
      parentKey: jiraIssues.parentKey,
      totalChildren: sql<number>`count(*)`.as("total_children"),
      doneChildren: sql<number>`sum(case when ${jiraIssues.status} = 'Done' then 1 else 0 end)`.as("done_children"),
      resolvedLast7Days: sql<number>`sum(case when ${jiraIssues.status} = 'Done' and ${jiraIssues.resolvedAt} >= ${oneWeekAgo} then 1 else 0 end)`.as("resolved_last_7d"),
      resolvedLast4Weeks: sql<number>`sum(case when ${jiraIssues.status} = 'Done' and ${jiraIssues.resolvedAt} >= ${fourWeeksAgo} then 1 else 0 end)`.as("resolved_last_4w"),
      liveChildren: sql<number>`sum(case when ${jiraIssues.updatedAt} >= ${twoWeeksAgo} and ${jiraIssues.status} not in ('Done', 'Cancelled', 'Duplicate') then 1 else 0 end)`.as("live_children"),
      maxChildUpdatedAt: sql<number | null>`max(${jiraIssues.updatedAt})`.as("max_child_updated_at"),
    })
    .from(jiraIssues)
    .where(inArray(jiraIssues.parentKey, keys))
    .groupBy(jiraIssues.parentKey);

  const rollupByKey = new Map(childRollup.map((r) => [r.parentKey, r]));

  const staleCutoff = now - STALE_THRESHOLD_DAYS * 86400;

  return epics
    .map((e) => {
      const r = rollupByKey.get(e.key);
      const totalChildren = r?.totalChildren ?? 0;
      const doneChildren = r?.doneChildren ?? 0;
      const resolvedLast7Days = r?.resolvedLast7Days ?? 0;
      const resolvedLast4Weeks = r?.resolvedLast4Weeks ?? 0;
      const liveChildren = r?.liveChildren ?? 0;
      const percentDone = totalChildren > 0 ? Math.round((doneChildren / totalChildren) * 100) : 0;
      const daysUntilDue = e.dueDate ? Math.floor((e.dueDate - now) / 86400) : null;
      const remaining = totalChildren - doneChildren;
      const weeksUntilDue = daysUntilDue !== null ? daysUntilDue / 7 : null;
      const velocityPerWeek = resolvedLast4Weeks / 4;

      const lastActivity = Math.max(e.updatedAt ?? 0, r?.maxChildUpdatedAt ?? 0) || null;
      const isStale = lastActivity !== null && lastActivity < staleCutoff;

      let trackingStatus: "on_track" | "at_risk" | "no_due_date" | "complete";
      if (totalChildren > 0 && doneChildren >= totalChildren) {
        trackingStatus = "complete";
      } else if (daysUntilDue === null) {
        trackingStatus = "no_due_date";
      } else if (daysUntilDue < 0) {
        trackingStatus = "at_risk";
      } else if (weeksUntilDue !== null && velocityPerWeek * weeksUntilDue >= remaining) {
        trackingStatus = "on_track";
      } else {
        trackingStatus = "at_risk";
      }

      return {
        key: e.key,
        summary: e.summary,
        projectKey: e.projectKey,
        status: e.status,
        assigneeName: e.assigneeName,
        url: e.url,
        dueDate: e.dueDate ? formatDate(e.dueDate) : null,
        daysUntilDue,
        totalChildren,
        doneChildren,
        percentDone,
        liveChildren,
        resolvedLast7Days,
        resolvedLast4Weeks,
        velocityPerWeek: Math.round(velocityPerWeek * 10) / 10,
        trackingStatus,
        lastActivity: lastActivity ? formatDate(lastActivity) : null,
        isStale,
        isStarred: starredSet.has(e.key),
      };
    })
    .sort((a, b) => {
      if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
      if (a.isStale !== b.isStale) return a.isStale ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.key.localeCompare(b.key);
    });
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
