import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appUsers, workspaceMembers } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Missing code or state")}`);
  }

  const expectedState = request.cookies.get("oauth_state")?.value;
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Invalid state parameter")}`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("OAuth not configured")}`);
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
    );
  }

  const accessToken = tokenData.access_token as string;

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Failed to fetch GitHub profile")}`);
  }
  const ghUser = await userRes.json();

  let email = ghUser.email;
  if (!email) {
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (emailRes.ok) {
      const emails = await emailRes.json();
      const primary = emails.find((e: { primary: boolean }) => e.primary);
      email = primary?.email ?? emails[0]?.email ?? null;
    }
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const existing = (await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.githubId, ghUser.id)))[0];

  let userId: number;
  if (existing) {
    await db.update(appUsers).set({
      githubLogin: ghUser.login,
      displayName: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url,
      email,
      lastLoginAt: now,
    }).where(eq(appUsers.id, existing.id));
    userId = existing.id;
  } else {
    const result = await db.insert(appUsers).values({
      githubId: ghUser.id,
      githubLogin: ghUser.login,
      displayName: ghUser.name || ghUser.login,
      avatarUrl: ghUser.avatar_url,
      email,
      createdAt: now,
      lastLoginAt: now,
    }).returning({ id: appUsers.id });
    userId = result[0].id;
  }

  await createSession(userId);

  const response = NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("clear_state")}`);
  response.cookies.delete("oauth_state");

  const memberships = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .limit(1);

  if (memberships.length > 0) {
    return NextResponse.redirect(`${origin}/dashboard`);
  } else {
    return NextResponse.redirect(`${origin}/onboarding`);
  }
}
