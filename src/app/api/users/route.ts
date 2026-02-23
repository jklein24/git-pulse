import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, claudeCodeUsage } from "@/lib/db/schema";
import { remapClaudeUsageUsers } from "@/lib/claude/sync";
import { getWorkspaceSetting } from "@/lib/db/workspace-scope";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const allUsers = await db.select().from(users).orderBy(users.githubLogin);

    const unmappedEmails = await db
      .select({ email: claudeCodeUsage.email })
      .from(claudeCodeUsage)
      .groupBy(claudeCodeUsage.email);

    const mappedEmails = new Set(allUsers.filter((u) => u.email).map((u) => u.email!.toLowerCase()));
    const unmapped = unmappedEmails
      .map((r) => r.email)
      .filter((e) => !mappedEmails.has(e.toLowerCase()));

    return NextResponse.json({ users: allUsers, unmappedEmails: unmapped });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const body = await request.json();
    const { userId, email } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    await db
      .update(users)
      .set({ email: email || null })
      .where(eq(users.id, userId));

    await remapClaudeUsageUsers();

    return NextResponse.json({ saved: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const body = await request.json();

    if (body.action === "auto-detect") {
      const pat = await getWorkspaceSetting(auth.workspace.id, "github_pat");
      if (!pat) {
        return NextResponse.json({ error: "GitHub PAT not configured" }, { status: 400 });
      }

      const allUsers = await db.select().from(users);
      let updated = 0;

      for (const user of allUsers) {
        if (user.email) continue;
        try {
          const res = await fetch(`https://api.github.com/users/${user.githubLogin}`, {
            headers: { Authorization: `token ${pat}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.email) {
              await db.update(users).set({ email: data.email }).where(eq(users.id, user.id));
              updated++;
            }
          }
        } catch {
          // skip on error
        }
      }

      await remapClaudeUsageUsers();
      return NextResponse.json({ updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return handleAuthError(error);
  }
}
