import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, appUsers, workspaceMembers, workspaces } from "../db/schema";

const WORKSPACE_COOKIE = "workspace_id";

export interface AuthContext {
  user: {
    id: number;
    githubId: number;
    githubLogin: string;
    displayName: string | null;
    avatarUrl: string | null;
    email: string | null;
  };
  workspace: {
    id: number;
    name: string;
    slug: string;
    role: string;
  };
}

export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  const sessionId = request.cookies.get("session")?.value;
  if (!sessionId) {
    throw new AuthError("Not authenticated", 401);
  }

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const sessionRow = await db
    .select({
      userId: appUsers.id,
      githubId: appUsers.githubId,
      githubLogin: appUsers.githubLogin,
      displayName: appUsers.displayName,
      avatarUrl: appUsers.avatarUrl,
      email: appUsers.email,
    })
    .from(sessions)
    .innerJoin(appUsers, eq(sessions.userId, appUsers.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .then(rows => rows[0]);

  if (!sessionRow) {
    throw new AuthError("Session expired", 401);
  }

  const workspaceIdStr = request.cookies.get(WORKSPACE_COOKIE)?.value;
  const workspaceId = workspaceIdStr ? parseInt(workspaceIdStr) : null;

  let membership;
  if (workspaceId) {
    membership = await db
      .select({
        workspaceId: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, sessionRow.userId),
          eq(workspaceMembers.workspaceId, workspaceId),
        ),
      )
      .then(rows => rows[0]);
  }

  if (!membership) {
    membership = await db
      .select({
        workspaceId: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, sessionRow.userId))
      .limit(1)
      .then(rows => rows[0]);
  }

  if (!membership) {
    throw new AuthError("No workspace access", 403);
  }

  return {
    user: {
      id: sessionRow.userId,
      githubId: sessionRow.githubId,
      githubLogin: sessionRow.githubLogin,
      displayName: sessionRow.displayName,
      avatarUrl: sessionRow.avatarUrl,
      email: sessionRow.email,
    },
    workspace: {
      id: membership.workspaceId,
      name: membership.name,
      slug: membership.slug,
      role: membership.role,
    },
  };
}

export async function requireWorkspaceAdmin(request: NextRequest): Promise<AuthContext> {
  const auth = await requireAuth(request);
  if (auth.workspace.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
  return auth;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function handleAuthError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
