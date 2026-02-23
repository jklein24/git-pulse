import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceMembers, appUsers, workspaces } from "@/lib/db/schema";
import { requireAuth, requireWorkspaceAdmin, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    const workspaceId = parseInt(id);

    if (auth.workspace.id !== workspaceId) {
      throw new AuthError("Not a member of this workspace", 403);
    }

    const db = getDb();
    const members = await db
      .select({
        id: workspaceMembers.id,
        userId: appUsers.id,
        githubLogin: appUsers.githubLogin,
        displayName: appUsers.displayName,
        avatarUrl: appUsers.avatarUrl,
        email: appUsers.email,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .innerJoin(appUsers, eq(workspaceMembers.userId, appUsers.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return NextResponse.json(members);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspaceAdmin(request);
    const { id } = await params;
    const workspaceId = parseInt(id);

    if (auth.workspace.id !== workspaceId) {
      throw new AuthError("Not an admin of this workspace", 403);
    }

    const body = await request.json();
    const { githubLogin, role = "member" } = body;

    if (!githubLogin?.trim()) {
      return NextResponse.json({ error: "githubLogin is required" }, { status: 400 });
    }

    const db = getDb();

    const user = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.githubLogin, githubLogin.trim()))
      .then(rows => rows[0]);

    if (!user) {
      return NextResponse.json(
        { error: "User has not signed in yet. They must log in with GitHub first." },
        { status: 404 },
      );
    }

    const existing = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .then(rows => rows[0]);

    if (existing) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const member = await db
      .insert(workspaceMembers)
      .values({
        workspaceId,
        userId: user.id,
        role: role === "admin" ? "admin" : "member",
        invitedBy: auth.user.id,
        joinedAt: Math.floor(Date.now() / 1000),
      })
      .returning()
      .then(rows => rows[0]);

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspaceAdmin(request);
    const { id } = await params;
    const workspaceId = parseInt(id);

    if (auth.workspace.id !== workspaceId) {
      throw new AuthError("Not an admin of this workspace", 403);
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get("memberId");

    if (!memberId) {
      return NextResponse.json({ error: "memberId is required" }, { status: 400 });
    }

    const db = getDb();

    const member = await db
      .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, parseInt(memberId)),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .then(rows => rows[0]);

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.userId === auth.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, parseInt(memberId)));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspaceAdmin(request);
    const { id } = await params;
    const workspaceId = parseInt(id);

    if (auth.workspace.id !== workspaceId) {
      throw new AuthError("Not an admin of this workspace", 403);
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) {
      return NextResponse.json({ error: "memberId and role are required" }, { status: 400 });
    }

    const db = getDb();

    const member = await db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.id, memberId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .then(rows => rows[0]);

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await db
      .update(workspaceMembers)
      .set({ role: role === "admin" ? "admin" : "member" })
      .where(eq(workspaceMembers.id, memberId));

    return NextResponse.json({ updated: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
