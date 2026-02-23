import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceMembers, workspaces } from "@/lib/db/schema";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();

    const allWorkspaces = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, auth.user.id));

    return NextResponse.json({
      user: auth.user,
      workspace: auth.workspace,
      workspaces: allWorkspaces,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
