import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaces, workspaceMembers, appUsers, sessions } from "@/lib/db/schema";
import { AuthError, handleAuthError } from "@/lib/auth/middleware";
import { getSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      throw new AuthError("Not authenticated", 401);
    }

    const body = await request.json();
    const { name, slug } = body;

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    const existing = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug.trim()))
      .then(rows => rows[0]);

    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    const workspace = await db
      .insert(workspaces)
      .values({
        name: name.trim(),
        slug: slug.trim(),
        createdAt: now,
        createdBy: session.userId,
      })
      .returning()
      .then(rows => rows[0]);

    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: session.userId,
      role: "admin",
      joinedAt: now,
    });

    const response = NextResponse.json(workspace, { status: 201 });
    response.cookies.set("workspace_id", String(workspace.id), {
      path: "/",
      maxAge: 30 * 86400,
      httpOnly: false,
    });

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}
