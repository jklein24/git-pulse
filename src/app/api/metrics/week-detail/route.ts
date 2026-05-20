import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pullRequests, users, repos, jiraIssues, settings } from "@/lib/db/schema";
import { getEpicProgress } from "@/lib/metrics/tickets";

function parseEpicKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

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

  const ticketsResolved = await db
    .select({
      key: jiraIssues.jiraKey,
      summary: jiraIssues.summary,
      projectKey: jiraIssues.projectKey,
      parentKey: jiraIssues.parentKey,
      assigneeName: jiraIssues.assigneeName,
    })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        gte(jiraIssues.resolvedAt, weekStart),
        lt(jiraIssues.resolvedAt, weekEnd),
      ),
    );

  const ticketsByProject = await db
    .select({
      projectKey: jiraIssues.projectKey,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(jiraIssues)
    .where(
      and(
        eq(jiraIssues.status, "Done"),
        gte(jiraIssues.resolvedAt, weekStart),
        lt(jiraIssues.resolvedAt, weekEnd),
      ),
    )
    .groupBy(jiraIssues.projectKey)
    .orderBy(sql`count desc`);

  const [excludedRow, starredRow] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "jira_excluded_epics")).get(),
    db.select().from(settings).where(eq(settings.key, "jira_starred_epics")).get(),
  ]);
  const allEpics = await getEpicProgress(parseEpicKeys(excludedRow?.value), parseEpicKeys(starredRow?.value));
  const epicsInMotion = allEpics
    .filter((e) => e.isStarred || (!e.isStale && e.resolvedLast4Weeks > 0))
    .slice(0, 25);

  return NextResponse.json({
    prs,
    leaderboard,
    prsByRepo,
    ticketsResolved,
    ticketsByProject,
    epicsInMotion,
  });
}
