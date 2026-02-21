import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { claudeCodeUsage, claudeCodeModelUsage, users, pullRequests } from "../db/schema";
import { formatDate, MONDAY_OFFSET } from "./utils";

function dateToUnix(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 1000);
}

function weekExpr(dateField: typeof claudeCodeUsage.date) {
  const unix = sql<number>`cast(strftime('%s', ${dateField}) as integer)`;
  return sql<number>`((${unix} + ${MONDAY_OFFSET}) - ((${unix} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`;
}

export async function getTeamAiUsageTrend(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return db
    .select({
      week: weekExpr(claudeCodeUsage.date).as("week"),
      sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
      linesAdded: sql<number>`sum(${claudeCodeUsage.linesAdded})`.as("lines_added"),
      linesRemoved: sql<number>`sum(${claudeCodeUsage.linesRemoved})`.as("lines_removed"),
      activeUsers: sql<number>`count(distinct ${claudeCodeUsage.email})`.as("active_users"),
      commits: sql<number>`sum(${claudeCodeUsage.commitsByClaudeCode})`.as("commits"),
      prs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("prs"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(sql`week`)
    .orderBy(sql`week`);
}

export async function getAiVsHumanOutput(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const aiRows = await db
    .select({
      week: weekExpr(claudeCodeUsage.date).as("week"),
      aiLines: sql<number>`sum(${claudeCodeUsage.linesAdded} + ${claudeCodeUsage.linesRemoved})`.as("ai_lines"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const humanRows = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      humanLines: sql<number>`sum(${pullRequests.filteredAdditions} + ${pullRequests.filteredDeletions})`.as("human_lines"),
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

  const humanByWeek = new Map(humanRows.map((r) => [r.week, r.humanLines ?? 0]));
  const aiByWeek = new Map(aiRows.map((r) => [r.week, r.aiLines ?? 0]));
  const allWeeks = [...new Set([...humanByWeek.keys(), ...aiByWeek.keys()])].sort();

  return allWeeks.map((week) => {
    const human = humanByWeek.get(week) ?? 0;
    const ai = aiByWeek.get(week) ?? 0;
    const total = human + ai;
    return {
      week: formatDate(week),
      humanLines: human,
      aiLines: ai,
      aiPercent: total > 0 ? Math.round((ai / total) * 1000) / 10 : 0,
    };
  });
}

export async function getToolAcceptanceTrend(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return db
    .select({
      week: weekExpr(claudeCodeUsage.date).as("week"),
      editAccepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted})`.as("edit_accepted"),
      editRejected: sql<number>`sum(${claudeCodeUsage.editToolRejected})`.as("edit_rejected"),
      writeAccepted: sql<number>`sum(${claudeCodeUsage.writeToolAccepted})`.as("write_accepted"),
      writeRejected: sql<number>`sum(${claudeCodeUsage.writeToolRejected})`.as("write_rejected"),
      multiEditAccepted: sql<number>`sum(${claudeCodeUsage.multiEditToolAccepted})`.as("multi_edit_accepted"),
      multiEditRejected: sql<number>`sum(${claudeCodeUsage.multiEditToolRejected})`.as("multi_edit_rejected"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(sql`week`)
    .orderBy(sql`week`);
}

export async function getPerPersonAiStats(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
      linesAdded: sql<number>`sum(${claudeCodeUsage.linesAdded})`.as("lines_added"),
      linesRemoved: sql<number>`sum(${claudeCodeUsage.linesRemoved})`.as("lines_removed"),
      commits: sql<number>`sum(${claudeCodeUsage.commitsByClaudeCode})`.as("commits"),
      prs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("prs"),
      accepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted} + ${claudeCodeUsage.writeToolAccepted} + ${claudeCodeUsage.multiEditToolAccepted})`.as("accepted"),
      rejected: sql<number>`sum(${claudeCodeUsage.editToolRejected} + ${claudeCodeUsage.writeToolRejected} + ${claudeCodeUsage.multiEditToolRejected})`.as("rejected"),
      costCents: sql<number>`sum(${claudeCodeUsage.estimatedCostCents})`.as("cost_cents"),
    })
    .from(claudeCodeUsage)
    .innerJoin(users, eq(claudeCodeUsage.userId, users.id))
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(users.githubLogin)
    .orderBy(sql`sessions desc`);
}

export async function getAdoptionHeatmap(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return db
    .select({
      login: users.githubLogin,
      week: weekExpr(claudeCodeUsage.date).as("week"),
      sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
    })
    .from(claudeCodeUsage)
    .innerJoin(users, eq(claudeCodeUsage.userId, users.id))
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(users.githubLogin, sql`week`)
    .orderBy(sql`week`);
}

export async function getAiSummaryCards(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const aiStats = await db
    .select({
      totalSessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("total_sessions"),
      aiPrs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("ai_prs"),
      totalCostCents: sql<number>`sum(${claudeCodeUsage.estimatedCostCents})`.as("total_cost_cents"),
      accepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted} + ${claudeCodeUsage.writeToolAccepted} + ${claudeCodeUsage.multiEditToolAccepted})`.as("accepted"),
      rejected: sql<number>`sum(${claudeCodeUsage.editToolRejected} + ${claudeCodeUsage.writeToolRejected} + ${claudeCodeUsage.multiEditToolRejected})`.as("rejected"),
      activeAiUsers: sql<number>`count(distinct ${claudeCodeUsage.email})`.as("active_ai_users"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .get();

  const totalContributors = await db
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

  const totalMergedPrs = await db
    .select({
      count: sql<number>`count(*)`.as("count"),
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

  const activeContributors = totalContributors?.count ?? 0;
  const activeAiUsers = aiStats?.activeAiUsers ?? 0;
  const totalCostCents = aiStats?.totalCostCents ?? 0;
  const mergedPrs = totalMergedPrs?.count ?? 1;
  const accepted = aiStats?.accepted ?? 0;
  const rejected = aiStats?.rejected ?? 0;

  return {
    adoptionRate: activeContributors > 0 ? Math.round((activeAiUsers / activeContributors) * 100) : 0,
    aiAssistedPrs: aiStats?.aiPrs ?? 0,
    costPerMergedPr: mergedPrs > 0 ? Math.round(totalCostCents / mergedPrs) / 100 : 0,
    toolAcceptRate: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 1000) / 10 : 0,
  };
}
