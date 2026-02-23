import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspacePats } from "@/lib/db/schema";
import { requireWorkspaceAdmin, handleAuthError, AuthError } from "@/lib/auth/middleware";
import { encrypt, decrypt } from "@/lib/auth/encryption";
import { Octokit } from "@octokit/rest";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireWorkspaceAdmin(request);
    const { id } = await params;
    const workspaceId = parseInt(id);

    if (auth.workspace.id !== workspaceId) {
      throw new AuthError("Not an admin of this workspace", 403);
    }

    const db = getDb();
    const pats = await db
      .select({
        id: workspacePats.id,
        label: workspacePats.label,
        githubLogin: workspacePats.githubLogin,
        createdAt: workspacePats.createdAt,
      })
      .from(workspacePats)
      .where(eq(workspacePats.workspaceId, workspaceId));

    return NextResponse.json(pats);
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
    const { label, pat } = body;

    if (!label?.trim() || !pat?.trim()) {
      return NextResponse.json({ error: "label and pat are required" }, { status: 400 });
    }

    let githubLogin: string | null = null;
    try {
      const octokit = new Octokit({ auth: pat.trim() });
      const { data } = await octokit.users.getAuthenticated();
      githubLogin = data.login;
    } catch {
      return NextResponse.json({ error: "Invalid PAT — could not authenticate with GitHub" }, { status: 400 });
    }

    const db = getDb();
    const result = await db
      .insert(workspacePats)
      .values({
        workspaceId,
        label: label.trim(),
        encryptedPat: encrypt(pat.trim()),
        githubLogin,
        createdBy: auth.user.id,
        createdAt: Math.floor(Date.now() / 1000),
      })
      .returning({
        id: workspacePats.id,
        label: workspacePats.label,
        githubLogin: workspacePats.githubLogin,
        createdAt: workspacePats.createdAt,
      })
      .then(rows => rows[0]);

    return NextResponse.json(result, { status: 201 });
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
    const patId = searchParams.get("patId");

    if (!patId) {
      return NextResponse.json({ error: "patId is required" }, { status: 400 });
    }

    const db = getDb();

    const existing = await db
      .select({ id: workspacePats.id })
      .from(workspacePats)
      .where(
        and(
          eq(workspacePats.id, parseInt(patId)),
          eq(workspacePats.workspaceId, workspaceId),
        ),
      )
      .then(rows => rows[0]);

    if (!existing) {
      return NextResponse.json({ error: "PAT not found" }, { status: 404 });
    }

    await db.delete(workspacePats).where(eq(workspacePats.id, parseInt(patId)));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
