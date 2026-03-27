import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { syncJiraData, remapJiraUsers } from "@/lib/jira/sync";

let syncInProgress = false;

export async function POST() {
  if (syncInProgress) {
    return NextResponse.json({ error: "Jira sync already in progress" }, { status: 409 });
  }

  syncInProgress = true;

  try {
    const result = await syncJiraData();
    // Always remap — covers both newly unmapped assignees and
    // older rows from before user emails were configured
    await remapJiraUsers();
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}

export async function GET() {
  const db = getDb();
  const lastSynced = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "jira_last_synced"))
    .get();

  return NextResponse.json({
    lastSynced: lastSynced?.value || null,
    syncInProgress,
  });
}
