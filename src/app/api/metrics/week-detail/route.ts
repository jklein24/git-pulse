import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, lte, or, sql } from "drizzle-orm";
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

  const mergedByRepo = await db
    .select({
      repoFullName: repos.fullName,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(pullRequests)
    .innerJoin(repos, eq(pullRequests.repoId, repos.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, weekStart),
        lt(pullRequests.mergedAt, weekEnd),
      ),
    )
    .groupBy(repos.fullName)
    .orderBy(sql`count desc`);

  const openedByRepo = await db
    .select({
      repoFullName: repos.fullName,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(pullRequests)
    .innerJoin(repos, eq(pullRequests.repoId, repos.id))
    .where(
      and(
        gte(pullRequests.createdAt, weekStart),
        lt(pullRequests.createdAt, weekEnd),
      ),
    )
    .groupBy(repos.fullName)
    .orderBy(sql`count desc`);

  const repoNames = new Set([
    ...mergedByRepo.map((r) => r.repoFullName),
    ...openedByRepo.map((r) => r.repoFullName),
  ]);
  const mergedMap = new Map(mergedByRepo.map((r) => [r.repoFullName, r.count]));
  const openedMap = new Map(openedByRepo.map((r) => [r.repoFullName, r.count]));
  const prsByRepo = [...repoNames]
    .map((repo) => ({
      repo: repo.includes("/") ? repo.split("/")[1] : repo,
      opened: openedMap.get(repo) ?? 0,
      merged: mergedMap.get(repo) ?? 0,
    }))
    .sort((a, b) => (b.opened + b.merged) - (a.opened + a.merged));

  return NextResponse.json({ prs, leaderboard, prsByRepo });
}
