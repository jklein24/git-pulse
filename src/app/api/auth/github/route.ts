import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "OAuth not configured" }, { status: 500 });
  }

  const state = randomBytes(20).toString("hex");

  const db = getDb();
  await db.insert(settings)
    .values({ key: "oauth_state", value: state })
    .onConflictDoUpdate({ target: settings.key, set: { value: state } });

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "repo",
    state,
  });

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`);
}
