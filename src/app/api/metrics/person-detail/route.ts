import { NextRequest, NextResponse } from "next/server";
import { sql, and, gte, lte, eq, or, isNotNull, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pullRequests, users, repos, prReviews } from "@/lib/db/schema";
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

  return NextResponse.json({
    user,
    weeklyPrs: weeklyPrs.map((r) => ({
      week: formatDate(r.week),
      count: r.count,
      linesChanged: (r.additions ?? 0) + (r.deletions ?? 0),
    })),
    weeklyReviews: weeklyReviews.map((r) => ({ week: formatDate(r.week), count: r.count })),
    recentPrs,
  });
}
