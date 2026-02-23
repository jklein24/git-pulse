import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { recomputeFilteredStats } from "@/lib/github/sync";

export async function GET() {
  const db = getDb();
  const rows = await db.select().from(settings);
  const MASKED_KEYS = new Set(["github_pat", "claude_admin_api_key"]);
  const result: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.key === "oauth_state") continue;
    result[row.key] = MASKED_KEYS.has(row.key) && row.value
      ? `${"*".repeat(Math.max(0, row.value.length - 4))}${row.value.slice(-4)}`
      : row.value;
  }
  return NextResponse.json(result);
}

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { key, value } = body;

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  await db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });

  if (key === "exclude_globs") {
    recomputeFilteredStats().catch(console.error);
  }

  return NextResponse.json({ saved: true });
}
