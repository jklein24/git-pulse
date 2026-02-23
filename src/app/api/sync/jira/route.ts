import { NextRequest, NextResponse } from "next/server";
import { syncJiraData, remapJiraUsers } from "@/lib/jira/sync";
import { getWorkspaceSetting } from "@/lib/db/workspace-scope";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

let syncInProgress = false;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    if (syncInProgress) {
      return NextResponse.json({ error: "Jira sync already in progress" }, { status: 409 });
    }

    syncInProgress = true;

    try {
      const result = await syncJiraData(auth.workspace.id);
      await remapJiraUsers();
      return NextResponse.json(result);
    } finally {
      syncInProgress = false;
    }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "name" in e) {
      return handleAuthError(e);
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const lastSynced = await getWorkspaceSetting(auth.workspace.id, "jira_last_synced");

    return NextResponse.json({
      lastSynced: lastSynced || null,
      syncInProgress,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
