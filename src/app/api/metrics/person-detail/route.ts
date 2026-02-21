import { NextRequest, NextResponse } from "next/server";
import { sql, and, gte, lte, eq, or, isNotNull, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pullRequests, users, repos, prReviews, claudeCodeUsage } from "@/lib/db/schema";
import { formatDate, MONDAY_OFFSET } from "@/lib/metrics/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const login = searchParams.get("login");
  if (!login) {
    return NextResponse.json({ error: "login is required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const db = getDb();

  const userRows = await db
    .select({ login: users.githubLogin, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.githubLogin, login))
    .limit(1);

  if (userRows.length === 0) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const user = userRows[0];

  const weeklyPrs = await db
    .select({
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      count: sql<number>`count(*)`.as("count"),
      additions: sql<number>`sum(${pullRequests.filteredAdditions})`.as("additions"),
      deletions: sql<number>`sum(${pullRequests.filteredDeletions})`.as("deletions"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(users.githubLogin, login),
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const weeklyReviews = await db
    .select({
      week: sql<number>`((${prReviews.submittedAt} + ${MONDAY_OFFSET}) - ((${prReviews.submittedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(prReviews)
    .innerJoin(users, eq(prReviews.reviewerId, users.id))
    .where(
      and(
        eq(users.githubLogin, login),
        isNotNull(prReviews.submittedAt),
        gte(prReviews.submittedAt, startDate),
        lte(prReviews.submittedAt, endDate),
      ),
    )
    .groupBy(sql`week`)
    .orderBy(sql`week`);

  const recentPrs = await db
    .select({
      number: pullRequests.number,
      title: pullRequests.title,
      url: pullRequests.url,
      state: pullRequests.state,
      mergedAt: pullRequests.mergedAt,
      createdAt: pullRequests.createdAt,
      filteredAdditions: pullRequests.filteredAdditions,
      filteredDeletions: pullRequests.filteredDeletions,
      repoFullName: repos.fullName,
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .innerJoin(repos, eq(pullRequests.repoId, repos.id))
    .where(
      and(
        eq(users.githubLogin, login),
        or(
          and(eq(pullRequests.state, "MERGED"), gte(pullRequests.mergedAt, startDate), lte(pullRequests.mergedAt, endDate)),
          and(eq(pullRequests.state, "OPEN"), gte(pullRequests.createdAt, startDate), lte(pullRequests.createdAt, endDate)),
        ),
      ),
    )
    .orderBy(
      sql`case when ${pullRequests.mergedAt} is not null then ${pullRequests.mergedAt} else 0 end desc`,
      desc(pullRequests.createdAt),
    );

  const userRecord = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.githubLogin, login))
    .get();

  let aiWeekly: Array<{ week: string; sessions: number; aiPrs: number; costCents: number }> = [];
  let aiSummary = { sessions: 0, aiPrs: 0, aiCommits: 0, acceptRate: 0, costCents: 0 };

  if (userRecord?.id) {
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);

    const weekExpr = sql<number>`((cast(strftime('%s', ${claudeCodeUsage.date}) as integer) + ${MONDAY_OFFSET}) - ((cast(strftime('%s', ${claudeCodeUsage.date}) as integer) + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`;

    const aiWeeklyRows = await db
      .select({
        week: weekExpr.as("week"),
        sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
        aiPrs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("ai_prs"),
        costCents: sql<number>`sum(${claudeCodeUsage.estimatedCostCents})`.as("cost_cents"),
      })
      .from(claudeCodeUsage)
      .where(
        and(
          eq(claudeCodeUsage.userId, userRecord.id),
          gte(claudeCodeUsage.date, startStr),
          lte(claudeCodeUsage.date, endStr),
        ),
      )
      .groupBy(sql`week`)
      .orderBy(sql`week`);

    aiWeekly = aiWeeklyRows.map((r) => ({
      week: formatDate(r.week),
      sessions: r.sessions ?? 0,
      aiPrs: r.aiPrs ?? 0,
      costCents: r.costCents ?? 0,
    }));

    const aiTotal = await db
      .select({
        sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
        aiPrs: sql<number>`sum(${claudeCodeUsage.prsByClaudeCode})`.as("ai_prs"),
        aiCommits: sql<number>`sum(${claudeCodeUsage.commitsByClaudeCode})`.as("ai_commits"),
        accepted: sql<number>`sum(${claudeCodeUsage.editToolAccepted} + ${claudeCodeUsage.writeToolAccepted} + ${claudeCodeUsage.multiEditToolAccepted})`.as("accepted"),
        rejected: sql<number>`sum(${claudeCodeUsage.editToolRejected} + ${claudeCodeUsage.writeToolRejected} + ${claudeCodeUsage.multiEditToolRejected})`.as("rejected"),
        costCents: sql<number>`sum(${claudeCodeUsage.estimatedCostCents})`.as("cost_cents"),
      })
      .from(claudeCodeUsage)
      .where(
        and(
          eq(claudeCodeUsage.userId, userRecord.id),
          gte(claudeCodeUsage.date, startStr),
          lte(claudeCodeUsage.date, endStr),
        ),
      )
      .get();

    if (aiTotal) {
      const accepted = aiTotal.accepted ?? 0;
      const rejected = aiTotal.rejected ?? 0;
      aiSummary = {
        sessions: aiTotal.sessions ?? 0,
        aiPrs: aiTotal.aiPrs ?? 0,
        aiCommits: aiTotal.aiCommits ?? 0,
        acceptRate: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : 0,
        costCents: aiTotal.costCents ?? 0,
      };
    }
  }

  return NextResponse.json({
    user,
    weeklyPrs: weeklyPrs.map((r) => ({
      week: formatDate(r.week),
      count: r.count,
      linesChanged: (r.additions ?? 0) + (r.deletions ?? 0),
    })),
    weeklyReviews: weeklyReviews.map((r) => ({ week: formatDate(r.week), count: r.count })),
    recentPrs,
    aiWeekly,
    aiSummary,
  });
}
