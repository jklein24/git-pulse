import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { repos, users, pullRequests, prFiles, prReviews, syncJobs, settings } from "../db/schema";
import { createGitHubClient, fetchPullRequests, fetchPRFiles, type PullRequestNode, type RateLimit } from "./client";
import { transformPR, transformReview, isFileExcluded, computeFilteredStats, toUnix } from "./transforms";

const ONE_YEAR_SEC = 365 * 24 * 60 * 60;

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

async function upsertUser(
  author: { login: string; databaseId?: number; avatarUrl?: string } | null,
): Promise<number | null> {
  if (!author) return null;
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = await db.select().from(users).where(eq(users.githubLogin, author.login)).get();
  if (existing) {
    if (author.avatarUrl && author.avatarUrl !== existing.avatarUrl) {
      await db.update(users).set({ avatarUrl: author.avatarUrl }).where(eq(users.id, existing.id));
    }
    return existing.id;
  }

  const result = await db.insert(users).values({
    githubLogin: author.login,
    githubId: author.databaseId ?? null,
    avatarUrl: author.avatarUrl ?? null,
    firstSeenAt: now,
  }).returning({ id: users.id });

  return result[0].id;
}

async function processPR(
  pr: PullRequestNode,
  repoId: number,
  owner: string,
  repoName: string,
  client: ReturnType<typeof createGitHubClient>,
  excludeGlobs: string[],
  repoFullName: string,
): Promise<{ isNew: boolean; filesProcessed: number }> {
  const db = getDb();
  const authorId = await upsertUser(pr.author);
  const transformed = transformPR(pr);

  const existing = await db.select().from(pullRequests).where(eq(pullRequests.githubId, pr.databaseId)).get();

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

  let newReviews = 0;
  for (const review of pr.reviews.nodes) {
    const reviewerId = await upsertUser(review.author);
    const transformedReview = transformReview(review);

    const existingReview = review.databaseId
      ? await db.select().from(prReviews).where(eq(prReviews.githubId, review.databaseId)).get()
      : null;

    if (!existingReview) {
      await db.insert(prReviews).values({
        prId,
        reviewerId,
        ...transformedReview,
      });
      newReviews++;
    }
  }

  let filesProcessed = 0;
  const needsFileSync = !existing || (transformed.state === "MERGED" && !existing.mergedAt);
  if (needsFileSync) {
    await db.delete(prFiles).where(eq(prFiles.prId, prId));

    const files = await fetchPRFiles(client, owner, repoName, pr.number);
    filesProcessed = files.length;
    const fileRows = files.map((f) => ({
      prId,
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      isExcluded: isFileExcluded(f.filename, excludeGlobs),
      patch: f.patch ?? null,
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

  log(
    repoFullName,
    `  PR #${pr.number} [${transformed.state}]`,
    `by ${pr.author?.login ?? "unknown"}`,
    isNew ? "(new)" : "(updated)",
    `reviews=${pr.reviews.nodes.length} (${newReviews} new)`,
    needsFileSync ? `files=${filesProcessed}` : "(files skipped)",
    `+${pr.additions}/-${pr.deletions}`,
  );

  return { isNew, filesProcessed };
}

export async function syncRepo(repoId: number, opts?: { backfill?: boolean }): Promise<void> {
  const db = getDb();
  const repo = await db.select().from(repos).where(eq(repos.id, repoId)).get();
  if (!repo) throw new Error(`Repo ${repoId} not found`);

  const repoFullName = repo.fullName;
  const isInitialSync = !repo.lastSyncedAt;
  const backfill = opts?.backfill ?? false;
  const cutoffDate = new Date((Math.floor(Date.now() / 1000) - ONE_YEAR_SEC) * 1000).toISOString().slice(0, 10);

  log(repoFullName, `Starting sync (${isInitialSync ? `initial, cutoff=${cutoffDate}` : "incremental"})`);

  const tokenRow = await db.select().from(settings).where(eq(settings.key, "github_pat")).get();
  if (!tokenRow?.value) throw new Error("GitHub not connected — sign in via Settings");

  const client = createGitHubClient(tokenRow.value);
  const excludeGlobs = await getExcludeGlobs();
  const cutoff = Math.floor(Date.now() / 1000) - ONE_YEAR_SEC;

  if (excludeGlobs.length > 0) {
    log(repoFullName, `Exclude globs: ${excludeGlobs.join(", ")}`);
  }

  const job = await db.insert(syncJobs).values({
    repoId,
    status: "RUNNING",
    startedAt: Math.floor(Date.now() / 1000),
    prsProcessed: 0,
  }).returning({ id: syncJobs.id });
  const jobId = job[0].id;

  try {
    let cursor: string | null = null;
    let totalProcessed = 0;
    let totalNew = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFiles = 0;
    let pageNum = 0;
    let consecutiveMerged = 0;
    let done = false;

    while (!done) {
      pageNum++;
      const { prs, pageInfo, rateLimit } = await fetchPullRequests(client, repo.owner, repo.name, cursor);

      const oldest = prs.length > 0 ? prs[prs.length - 1].updatedAt : "n/a";
      const newest = prs.length > 0 ? prs[0].updatedAt : "n/a";
      log(
        repoFullName,
        `Page ${pageNum}: ${prs.length} PRs`,
        `(newest=${newest.slice(0, 10)}, oldest=${oldest.slice(0, 10)})`,
        `hasMore=${pageInfo.hasNextPage}`,
      );
      logRate(repoFullName, rateLimit);

      for (const pr of prs) {
        const updatedAt = toUnix(pr.updatedAt);
        if (updatedAt && updatedAt < cutoff) {
          log(repoFullName, `Reached cutoff at PR #${pr.number} (updatedAt=${pr.updatedAt.slice(0, 10)}). Stopping.`);
          done = true;
          break;
        }

        const createdAt = toUnix(pr.createdAt);
        if (backfill && createdAt && createdAt < cutoff) {
          totalSkipped++;
          continue;
        }

        const existing = await db.select({ state: pullRequests.state })
          .from(pullRequests)
          .where(eq(pullRequests.githubId, pr.databaseId))
          .get();
        if (existing?.state === "MERGED") {
          consecutiveMerged++;
          totalSkipped++;
          if (!backfill && consecutiveMerged >= 10) {
            log(repoFullName, `Hit ${consecutiveMerged} consecutive already-merged PRs. Stopping early.`);
            done = true;
            break;
          }
          continue;
        }
        consecutiveMerged = 0;

        const result = await processPR(pr, repoId, repo.owner, repo.name, client, excludeGlobs, repoFullName);
        totalProcessed++;
        if (result.isNew) totalNew++;
        else totalUpdated++;
        totalFiles += result.filesProcessed;
      }

      await db.update(syncJobs).set({ prsProcessed: totalProcessed }).where(eq(syncJobs.id, jobId));

      if (!pageInfo.hasNextPage) {
        log(repoFullName, "Reached last page of results.");
        break;
      }
      cursor = pageInfo.endCursor;
    }

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - (await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).get())!.startedAt;

    log(repoFullName, `Sync complete in ${elapsed}s: ${totalProcessed} PRs (${totalNew} new, ${totalUpdated} updated, ${totalSkipped} skipped-merged), ${totalFiles} files fetched`);

    await db.update(syncJobs).set({
      status: "COMPLETED",
      completedAt: now,
      prsProcessed: totalProcessed,
    }).where(eq(syncJobs.id, jobId));

    await db.update(repos).set({ lastSyncedAt: now }).where(eq(repos.id, repoId));
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
    const allFiles = await db.select().from(prFiles);
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
    const files = await db.select().from(prFiles).where(eq(prFiles.prId, pr.id));
    const stats = computeFilteredStats(files);
    await db.update(pullRequests).set(stats).where(eq(pullRequests.id, pr.id));
  }
}
