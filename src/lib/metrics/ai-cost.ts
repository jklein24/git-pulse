import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { claudeCodeUsage, claudeCodeModelUsage, pullRequests } from "../db/schema";
import { formatDate, MONDAY_OFFSET } from "./utils";

function weekExpr(dateField: typeof claudeCodeUsage.date) {
  const unix = sql<number>`cast(strftime('%s', ${dateField}) as integer)`;
  return sql<number>`((${unix} + ${MONDAY_OFFSET}) - ((${unix} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`;
}

export async function getCostTrend(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  const costByWeek = await db
    .select({
      week: weekExpr(claudeCodeUsage.date).as("week"),
      totalCostCents: sql<number>`sum(${claudeCodeUsage.estimatedCostCents})`.as("total_cost_cents"),
      totalLines: sql<number>`sum(${claudeCodeUsage.linesAdded} + ${claudeCodeUsage.linesRemoved})`.as("total_lines"),
      aiPrs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("ai_prs"),
    })
    .from(claudeCodeUsage)
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const prsByWeek = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      prsMerged: sql<number>`count(*)`.as("prs_merged"),
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

  const prsMap = new Map(prsByWeek.map((r) => [r.week, r.prsMerged]));

  return costByWeek.map((r) => {
    const totalCost = (r.totalCostCents ?? 0) / 100;
    const prs = prsMap.get(r.week) ?? 0;
    const lines = r.totalLines ?? 0;
    return {
      week: formatDate(r.week),
      totalCost,
      costPerPr: prs > 0 ? Math.round((totalCost / prs) * 100) / 100 : 0,
      costPer1kLoc: lines > 0 ? Math.round((totalCost / (lines / 1000)) * 100) / 100 : 0,
    };
  });
}

export async function getCostByModel(startDate: number, endDate: number) {
  const db = getDb();
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  return db
    .select({
      model: claudeCodeModelUsage.model,
      costCents: sql<number>`sum(${claudeCodeModelUsage.estimatedCostCents})`.as("cost_cents"),
      inputTokens: sql<number>`sum(${claudeCodeModelUsage.inputTokens})`.as("input_tokens"),
      outputTokens: sql<number>`sum(${claudeCodeModelUsage.outputTokens})`.as("output_tokens"),
    })
    .from(claudeCodeModelUsage)
    .innerJoin(claudeCodeUsage, eq(claudeCodeModelUsage.usageId, claudeCodeUsage.id))
    .where(and(gte(claudeCodeUsage.date, startStr), lte(claudeCodeUsage.date, endStr)))
    .groupBy(claudeCodeModelUsage.model)
    .orderBy(sql`cost_cents desc`);
}
