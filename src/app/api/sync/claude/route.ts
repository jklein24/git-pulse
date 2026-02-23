import { NextRequest, NextResponse } from "next/server";
import { syncClaudeCodeData, remapClaudeUsageUsers } from "@/lib/claude/sync";
import { getWorkspaceSetting } from "@/lib/db/workspace-scope";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export const maxDuration = 300;

let syncInProgress = false;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if (syncInProgress) {
      return NextResponse.json({ error: "Claude sync already in progress" }, { status: 409 });
    }

    syncInProgress = true;

    try {
      const result = await syncClaudeCodeData(auth.workspace.id);
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
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const lastSynced = await getWorkspaceSetting(auth.workspace.id, "claude_last_synced");

    return NextResponse.json({
      lastSynced: lastSynced || null,
      syncInProgress,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
