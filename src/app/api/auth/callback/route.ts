import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { testConnection } from "@/lib/github/client";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent("Missing code or state")}`);
  }

  const db = getDb();
  const stored = await db.select().from(settings).where(eq(settings.key, "oauth_state"));
  const expectedState = stored[0]?.value;

  await db.delete(settings).where(eq(settings.key, "oauth_state"));

  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent("Invalid state parameter")}`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent("OAuth not configured")}`);
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
  }

  const token = tokenData.access_token as string;
  const result = await testConnection(token);
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/settings?error=${encodeURIComponent(result.error || "Token verification failed")}`);
  }

  await db.insert(settings)
    .values({ key: "github_pat", value: token })
    .onConflictDoUpdate({ target: settings.key, set: { value: token } });

  await db.insert(settings)
    .values({ key: "github_login", value: result.login! })
    .onConflictDoUpdate({ target: settings.key, set: { value: result.login! } });

  return NextResponse.redirect(`${origin}/settings?connected=true`);
}
