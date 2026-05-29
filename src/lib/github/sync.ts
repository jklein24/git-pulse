import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { repos, users, pullRequests, prFiles, prReviews, syncJobs, settings } from "../db/schema";
import {
  createGitHubClient,
  fetchPullRequestDetails,
  fetchPullRequestPage,
  fetchPRFiles,
  type PRFile,
  type PullRequestNode,
  type PullRequestSummary,
  type RateLimit,
} from "./client";
import { transformPR, transformReview, isFileExcluded, computeFilteredStats, toUnix } from "./transforms";

const ONE_YEAR_SEC = 365 * 24 * 60 * 60;
const INCREMENTAL_OVERLAP_SEC = 6 * 60 * 60;
const PR_LOG_INTERVAL = 50;
const DETAIL_BATCH_SIZE = 25;

type UserCache = Map<string, { id: number; avatarUrl: string | null }>;

function log(repo: string, ...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[sync ${ts}] [${repo}]`, ...args);
}

function logRate(repo: string, rateLimit: RateLimit) {
  const resetIn = Math.max(0, Math.round((new Date(rateLimit.resetAt).getTime() - Date.now()) / 60000));
  console.log(
    `[sync] [${repo}] GraphQL rate limit: cost=${rateLimit.cost} remaining=${rateLimit.remaining} resets in ${resetIn}m`,
  );
}

function formatUnix(ts: number): string {
  return new Date(ts * 1000).toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function getExcludeGlobs(): Promise<string[]> {
  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.key, "exclude_globs")).get();
  if (!row?.value) return [];
  try {
    return JSON.parse(row.value);
  } catch {
    return [];
  }
}

async function loadUserCache(): Promise<UserCache> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id, githubLogin: users.githubLogin, avatarUrl: users.avatarUrl })
    .from(users);

  return new Map(rows.map((user) => [user.githubLogin, { id: user.id, avatarUrl: user.avatarUrl }]));
}

async function upsertUser(
  author: { login: string; databaseId?: number; avatarUrl?: string } | null,
  userCache: UserCache,
): Promise<number | null> {
  if (!author) return null;
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const cached = userCache.get(author.login);
  if (cached) {
    if (author.avatarUrl && author.avatarUrl !== cached.avatarUrl) {
      await db.update(users).set({ avatarUrl: author.avatarUrl }).where(eq(users.id, cached.id));
      cached.avatarUrl = author.avatarUrl;
    }
    return cached.id;
  }

  const existing = await db.select().from(users).where(eq(users.githubLogin, author.login)).get();
  if (existing) {
    if (author.avatarUrl && author.avatarUrl !== existing.avatarUrl) {
      await db.update(users).set({ avatarUrl: author.avatarUrl }).where(eq(users.id, existing.id));
    }
    userCache.set(author.login, { id: existing.id, avatarUrl: author.avatarUrl ?? existing.avatarUrl });
    return existing.id;
  }

  const result = await db.insert(users).values({
    githubLogin: author.login,
    githubId: author.databaseId ?? null,
    avatarUrl: author.avatarUrl ?? null,
    firstSeenAt: now,
  }).returning({ id: users.id });

  userCache.set(author.login, { id: result[0].id, avatarUrl: author.avatarUrl ?? null });
  return result[0].id;
}

function filesFromGraphQL(pr: PullRequestNode): PRFile[] | null {
  if (pr.files.totalCount > pr.files.nodes.length) return null;

  return pr.files.nodes.map((f) => ({
    filename: f.path,
    status: f.changeType.toLowerCase(),
    additions: f.additions,
    deletions: f.deletions,
  }));
}

async function processPR(
  pr: PullRequestNode,
  repoId: number,
  owner: string,
  repoName: string,
  client: ReturnType<typeof createGitHubClient>,
  excludeGlobs: string[],
  repoFullName: string,
  userCache: UserCache,
  existing: typeof pullRequests.$inferSelect | null,
  logDetail: boolean,
): Promise<{ isNew: boolean; filesProcessed: number }> {
  const db = getDb();
  const authorId = await upsertUser(pr.author, userCache);
  const transformed = transformPR(pr);

  let prId: number;
  const isNew = !existing;

  if (existing) {
    await db.update(pullRequests).set({
      ...transformed,
      repoId,
      authorId,
    }).where(eq(pullRequests.id, existing.id));
    prId = existing.id;
  } else {
    const result = await db.insert(pullRequests).values({
      ...transformed,
      repoId,
      authorId,
    }).returning({ id: pullRequests.id });
    prId = result[0].id;
  }

  const reviewGithubIds = pr.reviews.nodes.map((review) => review.databaseId).filter((id): id is number => Boolean(id));
  const existingReviewRows = reviewGithubIds.length > 0
    ? await db
      .select({ githubId: prReviews.githubId })
      .from(prReviews)
      .where(inArray(prReviews.githubId, reviewGithubIds))
    : [];
  const existingReviewIds = new Set(existingReviewRows.map((review) => review.githubId));
  const reviewRows: Array<typeof prReviews.$inferInsert> = [];

  for (const review of pr.reviews.nodes) {
    if (existingReviewIds.has(review.databaseId)) continue;

    const reviewerId = await upsertUser(review.author, userCache);
    const transformedReview = transformReview(review);

    reviewRows.push({
      prId,
      reviewerId,
      ...transformedReview,
    });
  }

  if (reviewRows.length > 0) {
    await db.insert(prReviews).values(reviewRows).onConflictDoNothing({ target: prReviews.githubId });
  }

  let filesProcessed = 0;
  const needsFileSync = !existing || (transformed.state === "MERGED" && !existing.mergedAt);
  if (needsFileSync) {
    await db.delete(prFiles).where(eq(prFiles.prId, prId));

    const files = filesFromGraphQL(pr) ?? await fetchPRFiles(client, owner, repoName, pr.number);
    filesProcessed = files.length;
    const fileRows = files.map((f) => ({
      prId,
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      isExcluded: isFileExcluded(f.filename, excludeGlobs),
      patch: null,
    }));

    if (fileRows.length > 0) {
      await db.insert(prFiles).values(fileRows);
    }

    const excluded = fileRows.filter((f) => f.isExcluded).length;
    if (excluded > 0) {
      log(repoFullName, `  PR #${pr.number}: ${files.length} files fetched, ${excluded} excluded by globs`);
    }

    const stats = computeFilteredStats(fileRows);
    await db.update(pullRequests).set(stats).where(eq(pullRequests.id, prId));
  }

  if (logDetail) {
    log(
      repoFullName,
      `  PR #${pr.number} [${transformed.state}]`,
      `by ${pr.author?.login ?? "unknown"}`,
      isNew ? "(new)" : "(updated)",
      `reviews=${pr.reviews.nodes.length} (${reviewRows.length} new)`,
      needsFileSync ? `files=${filesProcessed}` : "(files skipped)",
      `+${pr.additions}/-${pr.deletions}`,
    );
  }

  return { isNew, filesProcessed };
}

async function fetchDetailsById(
  client: ReturnType<typeof createGitHubClient>,
  repoFullName: string,
  ids: string[],
): Promise<Map<string, PullRequestNode>> {
  const details = new Map<string, PullRequestNode>();

  for (const batch of chunk(ids, DETAIL_BATCH_SIZE)) {
    const { prs, rateLimit } = await fetchPullRequestDetails(client, batch);
    for (const pr of prs) {
      details.set(pr.id, pr);
    }
    log(repoFullName, `Fetched details for ${prs.length}/${batch.length} PRs`);
    logRate(repoFullName, rateLimit);
  }

  return details;
}

export async function syncRepo(repoId: number, opts?: { backfill?: boolean }): Promise<void> {
  const db = getDb();
  const repo = await db.select().from(repos).where(eq(repos.id, repoId)).get();
  if (!repo) throw new Error(`Repo ${repoId} not found`);

  const repoFullName = repo.fullName;
  const previousSyncAt = repo.lastSyncedAt;
  const isInitialSync = !previousSyncAt;
  const backfill = opts?.backfill ?? false;
  const syncStartedAt = Math.floor(Date.now() / 1000);
  const cutoff = syncStartedAt - ONE_YEAR_SEC;
  const incrementalStopAt = previousSyncAt && !backfill
    ? Math.max(cutoff, previousSyncAt - INCREMENTAL_OVERLAP_SEC)
    : cutoff;
  const syncMode = backfill
    ? `backfill, cutoff=${formatUnix(cutoff).slice(0, 10)}`
    : isInitialSync
      ? `initial, cutoff=${formatUnix(cutoff).slice(0, 10)}`
      : `incremental, since=${formatUnix(incrementalStopAt)}`;

  log(repoFullName, `Starting sync (${syncMode})`);

  const tokenRow = await db.select().from(settings).where(eq(settings.key, "github_pat")).get();
  if (!tokenRow?.value) throw new Error("GitHub not connected — sign in via Settings");

  const client = createGitHubClient(tokenRow.value);
  const excludeGlobs = await getExcludeGlobs();

  if (excludeGlobs.length > 0) {
    log(repoFullName, `Exclude globs: ${excludeGlobs.join(", ")}`);
  }

  const job = await db.insert(syncJobs).values({
    repoId,
    status: "RUNNING",
    startedAt: syncStartedAt,
    prsProcessed: 0,
  }).returning({ id: syncJobs.id });
  const jobId = job[0].id;

  try {
    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalSkippedMerged = 0;
    let totalUnchanged = 0;
    let totalFiles = 0;
    let pageNum = 0;
    let consecutiveMerged = 0;
    let done = false;
    const userCache = await loadUserCache();

    while (!done) {
      pageNum++;
      const { prs: summaries, pageInfo, rateLimit } = await fetchPullRequestPage(client, repo.owner, repo.name, cursor);
      const existingPrs = summaries.length > 0
        ? await db.select().from(pullRequests).where(inArray(pullRequests.githubId, summaries.map((pr) => pr.databaseId)))
        : [];
      const existingByGithubId = new Map(existingPrs.map((pr) => [pr.githubId, pr]));

      const oldest = summaries.length > 0 ? summaries[summaries.length - 1].updatedAt : "n/a";
      const newest = summaries.length > 0 ? summaries[0].updatedAt : "n/a";
      log(
        repoFullName,
        `Page ${pageNum}: ${summaries.length} PR summaries`,
        `(newest=${newest.slice(0, 10)}, oldest=${oldest.slice(0, 10)})`,
        `hasMore=${pageInfo.hasNextPage}`,
      );
      logRate(repoFullName, rateLimit);

      const detailCandidates: Array<{
        summary: PullRequestSummary;
        existing: typeof pullRequests.$inferSelect | null;
      }> = [];

      for (const summary of summaries) {
        const updatedAt = toUnix(summary.updatedAt);
        if (updatedAt && updatedAt < incrementalStopAt) {
          log(repoFullName, `Reached sync window at PR #${summary.number} (updatedAt=${summary.updatedAt.slice(0, 10)}). Stopping.`);
          done = true;
          break;
        }

        const createdAt = toUnix(summary.createdAt);
        if (backfill && createdAt && createdAt < cutoff) {
          totalSkipped++;
          continue;
        }

        const existing = existingByGithubId.get(summary.databaseId) ?? null;
        if (!backfill && existing?.githubUpdatedAt && updatedAt && existing.githubUpdatedAt >= updatedAt) {
          totalSkipped++;
          totalUnchanged++;
          continue;
        }

        if (existing?.state === "MERGED") {
          consecutiveMerged++;
          totalSkipped++;
          totalSkippedMerged++;
          if (!backfill && isInitialSync && consecutiveMerged >= 10) {
            log(repoFullName, `Hit ${consecutiveMerged} consecutive already-merged PRs. Stopping early.`);
            done = true;
            break;
          }
          continue;
        }
        consecutiveMerged = 0;

        detailCandidates.push({ summary, existing });
      }

      const detailsById = detailCandidates.length > 0
        ? await fetchDetailsById(client, repoFullName, detailCandidates.map((candidate) => candidate.summary.id))
        : new Map<string, PullRequestNode>();

      for (const { summary, existing } of detailCandidates) {
        const pr = detailsById.get(summary.id);
        if (!pr) {
          totalSkipped++;
          log(repoFullName, `  PR #${summary.number}: detail fetch returned no node, skipped`);
          continue;
        }

        const logDetail = totalProcessed < 10 || (totalProcessed + 1) % PR_LOG_INTERVAL === 0;
        const result = await processPR(
          pr,
          repoId,
          repo.owner,
          repo.name,
          client,
          excludeGlobs,
          repoFullName,
          userCache,
          existing,
          logDetail,
        );
        totalProcessed++;
        if (result.isNew) totalNew++;
        else totalUpdated++;
        totalFiles += result.filesProcessed;
      }

      await db.update(syncJobs).set({ prsProcessed: totalProcessed }).where(eq(syncJobs.id, jobId));
      log(
        repoFullName,
        `Page ${pageNum} processed: total=${totalProcessed}`,
        `new=${totalNew}`,
        `updated=${totalUpdated}`,
        `skipped=${totalSkipped}`,
        `unchanged=${totalUnchanged}`,
        `merged-skipped=${totalSkippedMerged}`,
        `details=${detailCandidates.length}`,
        `files=${totalFiles}`,
      );

      if (!pageInfo.hasNextPage) {
        log(repoFullName, "Reached last page of results.");
        break;
      }
      cursor = pageInfo.endCursor;
    }

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - syncStartedAt;

    log(
      repoFullName,
      `Sync complete in ${elapsed}s: ${totalProcessed} PRs`,
      `(${totalNew} new, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalUnchanged} unchanged, ${totalSkippedMerged} skipped-merged),`,
      `${totalFiles} files fetched`,
    );

    await db.update(syncJobs).set({
      status: "COMPLETED",
      completedAt: now,
      prsProcessed: totalProcessed,
    }).where(eq(syncJobs.id, jobId));

    await db.update(repos).set({ lastSyncedAt: syncStartedAt }).where(eq(repos.id, repoId));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    log(repoFullName, `Sync FAILED: ${msg}`);
    await db.update(syncJobs).set({
      status: "FAILED",
      completedAt: Math.floor(Date.now() / 1000),
      error: msg,
    }).where(eq(syncJobs.id, jobId));
    throw error;
  }
}

export async function syncAllRepos(): Promise<void> {
  const db = getDb();
  const allRepos = await db.select().from(repos);
  console.log(`[sync] Starting sync for ${allRepos.length} repo(s): ${allRepos.map((r) => r.fullName).join(", ")}`);

  for (const repo of allRepos) {
    await syncRepo(repo.id);
  }

  console.log(`[sync] All repos synced.`);
}

export async function recomputeFilteredStats(): Promise<void> {
  const db = getDb();
  const excludeGlobs = await getExcludeGlobs();

  if (excludeGlobs.length > 0) {
    const allFiles = await db
      .select({ id: prFiles.id, filename: prFiles.filename, isExcluded: prFiles.isExcluded })
      .from(prFiles);
    for (const file of allFiles) {
      const excluded = isFileExcluded(file.filename, excludeGlobs);
      if (excluded !== file.isExcluded) {
        await db.update(prFiles).set({ isExcluded: excluded }).where(eq(prFiles.id, file.id));
      }
    }
  } else {
    await db.update(prFiles).set({ isExcluded: false });
  }

  const prs = await db.select({ id: pullRequests.id }).from(pullRequests);
  for (const pr of prs) {
    const files = await db
      .select({ additions: prFiles.additions, deletions: prFiles.deletions, isExcluded: prFiles.isExcluded })
      .from(prFiles)
      .where(eq(prFiles.prId, pr.id));
    const stats = computeFilteredStats(files);
    await db.update(pullRequests).set(stats).where(eq(pullRequests.id, pr.id));
  }
}
