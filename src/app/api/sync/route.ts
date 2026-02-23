import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { syncJobs, repos } from "@/lib/db/schema";
import { syncRepo, syncWorkspaceRepos } from "@/lib/github/sync";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export const maxDuration = 300;

async function isSyncRunning(workspaceId: number): Promise<boolean> {
  const db = getDb();
  const running = await db
    .select({ id: syncJobs.id })
    .from(syncJobs)
    .innerJoin(repos, eq(syncJobs.repoId, repos.id))
    .where(and(eq(syncJobs.status, "RUNNING"), eq(repos.workspaceId, workspaceId)))
    .limit(1);
  return running.length > 0;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const jobs = await db
      .select({
        id: syncJobs.id,
        repoId: syncJobs.repoId,
        status: syncJobs.status,
        startedAt: syncJobs.startedAt,
        completedAt: syncJobs.completedAt,
        prsProcessed: syncJobs.prsProcessed,
        error: syncJobs.error,
      })
      .from(syncJobs)
      .innerJoin(repos, eq(syncJobs.repoId, repos.id))
      .where(eq(repos.workspaceId, auth.workspace.id))
      .orderBy(desc(syncJobs.startedAt))
      .limit(10);
    const syncInProgress = await isSyncRunning(auth.workspace.id);
    return NextResponse.json({ syncInProgress, jobs });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if (await isSyncRunning(auth.workspace.id)) {
      return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const repoId = body.repoId;

    const doSync = async () => {
      try {
        if (repoId) {
          await syncRepo(repoId);
        } else {
          await syncWorkspaceRepos(auth.workspace.id);
        }
      } catch (error) {
        console.error("Sync error:", error);
      }
    };

    doSync();

    return NextResponse.json({ started: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
