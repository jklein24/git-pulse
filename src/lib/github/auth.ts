import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export type GitHubTokenSource = "database" | "environment";

export interface GitHubToken {
  token: string;
  source: GitHubTokenSource;
}

export function maskToken(token: string): string {
  return `${"*".repeat(Math.max(0, token.length - 4))}${token.slice(-4)}`;
}

export async function getGitHubToken(): Promise<GitHubToken | null> {
  const db = getDb();
  const tokenRow = await db.select().from(settings).where(eq(settings.key, "github_pat")).get();
  const dbToken = tokenRow?.value?.trim();
  if (dbToken) {
    return { token: dbToken, source: "database" };
  }

  const envToken = process.env.GITHUB_PAT?.trim();
  if (envToken) {
    return { token: envToken, source: "environment" };
  }

  return null;
}
