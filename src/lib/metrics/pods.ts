import { sql, and, gte, lte, eq, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users, prReviews, claudeCodeUsage } from "../db/schema";
import { MONDAY_OFFSET, formatDate } from "./utils";

export interface PodHealth {
  pod: string;
  teamGroup: string | null;
  memberCount: number;
  members: Array<{
    login: string;
    avatarUrl: string | null;
    role: string | null;
    prsMerged: number;
    reviewsGiven: number;
    linesAdded: number;
    aiSessions: number;
  }>;
  prsMerged: number;
  reviewsGiven: number;
  totalLinesAdded: number;
  totalAiSessions: number;
  aiAdoptionPct: number;
}

export async function getPodHealth(startDate: number, endDate: number): Promise<PodHealth[]> {
  const db = getDb();

  // Get all users with pod assignments
  const allUsers = await db
    .select({
      id: users.id,
      login: users.githubLogin,
      avatarUrl: users.avatarUrl,
      pod: users.pod,
      teamGroup: users.teamGroup,
      role: users.role,
    })
    .from(users)
    .where(isNotNull(users.pod));

  if (allUsers.length === 0) {
    return [];
  }

  // PRs merged per user in period
  const prsByUser = await db
    .select({
      authorId: pullRequests.authorId,
      prCount: sql<number>`count(*)`.as("pr_count"),
      additions: sql<number>`sum(${pullRequests.filteredAdditions})`.as("additions"),
      deletions: sql<number>`sum(${pullRequests.filteredDeletions})`.as("deletions"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(pullRequests.authorId);

  const prMap = new Map(prsByUser.map((r) => [r.authorId, { count: r.prCount, lines: (r.additions ?? 0) + (r.deletions ?? 0) }]));

  // Reviews given per user in period
  const reviewsByUser = await db
    .select({
      reviewerId: prReviews.reviewerId,
      reviewCount: sql<number>`count(*)`.as("review_count"),
    })
    .from(prReviews)
    .where(
      and(
        gte(prReviews.submittedAt, startDate),
        lte(prReviews.submittedAt, endDate),
      ),
    )
    .groupBy(prReviews.reviewerId);

  const reviewMap = new Map(reviewsByUser.map((r) => [r.reviewerId, r.reviewCount]));

  // AI sessions per user in period
  const startDateStr = new Date(startDate * 1000).toISOString().slice(0, 10);
  const endDateStr = new Date(endDate * 1000).toISOString().slice(0, 10);

  const aiByUser = await db
    .select({
      userId: claudeCodeUsage.userId,
      sessions: sql<number>`sum(${claudeCodeUsage.numSessions})`.as("sessions"),
    })
    .from(claudeCodeUsage)
    .where(
      and(
        gte(claudeCodeUsage.date, startDateStr),
        lte(claudeCodeUsage.date, endDateStr),
      ),
    )
    .groupBy(claudeCodeUsage.userId);

  const aiMap = new Map(aiByUser.map((r) => [r.userId, r.sessions ?? 0]));

  // Group by pod
  const podMap = new Map<string, PodHealth>();

  for (const user of allUsers) {
    if (!user.pod) continue;

    if (!podMap.has(user.pod)) {
      podMap.set(user.pod, {
        pod: user.pod,
        teamGroup: null, // resolved from first non-null member below
        memberCount: 0,
        members: [],
        prsMerged: 0,
        reviewsGiven: 0,
        totalLinesAdded: 0,
        totalAiSessions: 0,
        aiAdoptionPct: 0,
      });
    }

    const pod = podMap.get(user.pod)!;
    const prs = prMap.get(user.id) ?? { count: 0, lines: 0 };
    const reviews = reviewMap.get(user.id) ?? 0;
    const aiSessions = aiMap.get(user.id) ?? 0;

    pod.memberCount++;
    pod.prsMerged += prs.count;
    pod.reviewsGiven += reviews;
    pod.totalLinesAdded += prs.lines;
    pod.totalAiSessions += aiSessions;
    // Resolve teamGroup from first non-null member
    if (!pod.teamGroup && user.teamGroup) {
      pod.teamGroup = user.teamGroup;
    }

    pod.members.push({
      login: user.login,
      avatarUrl: user.avatarUrl,
      role: user.role,
      prsMerged: prs.count,
      reviewsGiven: reviews,
      linesAdded: prs.lines,
      aiSessions,
    });
  }

  // Calculate AI adoption % per pod
  for (const pod of podMap.values()) {
    const usersWithAi = pod.members.filter((m) => m.aiSessions > 0).length;
    pod.aiAdoptionPct = pod.memberCount > 0
      ? Math.round((usersWithAi / pod.memberCount) * 100)
      : 0;
    // Sort members by PRs merged descending
    pod.members.sort((a, b) => b.prsMerged - a.prsMerged);
  }

  return Array.from(podMap.values()).sort((a, b) => b.prsMerged - a.prsMerged);
}

export async function getPodThroughputTrend(startDate: number, endDate: number) {
  const db = getDb();

  const rows = await db
    .select({
      pod: users.pod,
      week: sql<number>`((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) - ((${pullRequests.mergedAt} + ${MONDAY_OFFSET}) % 604800)) - ${MONDAY_OFFSET}`.as("week"),
      prCount: sql<number>`count(*)`.as("pr_count"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        isNotNull(users.pod),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .groupBy(users.pod, sql`week`)
    .orderBy(sql`week`);

  return rows.map((r) => ({
    pod: r.pod,
    week: formatDate(r.week),
    prCount: r.prCount,
  }));
}
