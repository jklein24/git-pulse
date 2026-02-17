import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pullRequests, users, repos } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekStart = Number(searchParams.get("weekStart"));
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const weekEnd = weekStart + 604800;
  const db = getDb();

  const prs = await db
    .select({
      number: pullRequests.number,
      title: pullRequests.title,
      url: pullRequests.url,
      mergedAt: pullRequests.mergedAt,
      filteredAdditions: pullRequests.filteredAdditions,
      filteredDeletions: pullRequests.filteredDeletions,
      authorLogin: users.githubLogin,
      avatarUrl: users.avatarUrl,
      repoFullName: repos.fullName,
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .innerJoin(repos, eq(pullRequests.repoId, repos.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, weekStart),
        lt(pullRequests.mergedAt, weekEnd),
      ),
    )
    .orderBy(pullRequests.mergedAt);

  const leaderboard = await db
    .select({
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      prCount: sql<number>`count(*)`.as("pr_count"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, weekStart),
        lt(pullRequests.mergedAt, weekEnd),
      ),
    )
    .groupBy(users.githubLogin, users.avatarUrl)
    .orderBy(sql`pr_count desc`);

  return NextResponse.json({ prs, leaderboard });
}
