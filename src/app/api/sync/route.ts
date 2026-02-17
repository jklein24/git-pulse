import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { syncJobs, repos } from "@/lib/db/schema";
import { syncRepo, syncAllRepos } from "@/lib/github/sync";

let syncInProgress = false;

export async function GET() {
  const db = getDb();
  const jobs = await db.select().from(syncJobs).orderBy(desc(syncJobs.startedAt)).limit(10);
  return NextResponse.json({ syncInProgress, jobs });
}

export async function POST(request: NextRequest) {
  if (syncInProgress) {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }

  const body = await request.json().catch(() => ({}));
  const repoId = body.repoId;

  syncInProgress = true;

  const doSync = async () => {
    try {
      if (repoId) {
        await syncRepo(repoId);
      } else {
        await syncAllRepos();
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      syncInProgress = false;
    }
  };

  doSync();

  return NextResponse.json({ started: true });
}
