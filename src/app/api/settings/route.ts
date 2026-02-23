import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceSettings } from "@/lib/db/schema";
import { getWorkspaceSetting, setWorkspaceSetting } from "@/lib/db/workspace-scope";
import { testConnection } from "@/lib/github/client";
import { recomputeFilteredStats } from "@/lib/github/sync";
import { requireAuth, requireWorkspaceAdmin, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const rows = await db
      .select()
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, auth.workspace.id));
    const MASKED_KEYS = new Set(["github_pat", "claude_admin_api_key", "jira_api_token"]);
    const result: Record<string, string | boolean | null> = {};
    for (const row of rows) {
      if (row.key === "oauth_state") continue;
      result[row.key] = MASKED_KEYS.has(row.key) && row.value
        ? `${"*".repeat(Math.max(0, row.value.length - 4))}${row.value.slice(-4)}`
        : row.value;
    }
    result._oauthConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
    return NextResponse.json(result);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireWorkspaceAdmin(request);
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    await setWorkspaceSetting(auth.workspace.id, key, value);

    if (key === "github_pat") {
      const result = await testConnection(value);
      return NextResponse.json({ saved: true, connection: result });
    }

    if (key === "exclude_globs") {
      recomputeFilteredStats(auth.workspace.id).catch(console.error);
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
