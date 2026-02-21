import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { syncClaudeCodeData, remapClaudeUsageUsers } from "@/lib/claude/sync";

let syncInProgress = false;

export async function POST() {
  if (syncInProgress) {
    return NextResponse.json({ error: "Claude sync already in progress" }, { status: 409 });
  }

  syncInProgress = true;

  try {
    const result = await syncClaudeCodeData();
    if (result.unmappedEmails.length > 0) {
      await remapClaudeUsageUsers();
    }
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
    .where(eq(settings.key, "claude_last_synced"))
    .get();

  return NextResponse.json({
    lastSynced: lastSynced?.value || null,
    syncInProgress,
  });
}
