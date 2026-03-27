import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { users, settings, jiraIssues } from "../db/schema";
import { fetchAllJiraIssues, type JiraIssueNode } from "./client";

function log(...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[jira-sync ${ts}]`, ...args);
}

function parseIsoToUnix(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return isNaN(ms) ? null : Math.floor(ms / 1000);
}

function buildEmailToUserMap(allUsers: { id: number; email: string | null }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const u of allUsers) {
    if (u.email) {
      map.set(u.email.toLowerCase(), u.id);
    }
  }
  return map;
}

async function upsertIssue(
  issue: JiraIssueNode,
  emailToUser: Map<string, number>,
): Promise<boolean> {
  const db = getDb();
  const f = issue.fields;

  const assigneeEmail = f.assignee?.emailAddress?.toLowerCase() ?? null;
  const userId = assigneeEmail ? (emailToUser.get(assigneeEmail) ?? null) : null;
  const cloudId = await db.select().from(settings).where(eq(settings.key, "jira_cloud_id")).get();

  const values = {
    jiraKey: issue.key,
    projectKey: f.project?.key ?? issue.key.split("-")[0],
    summary: f.summary,
    issueType: f.issuetype?.name ?? null,
    priority: f.priority?.name ?? null,
    status: f.status?.name ?? "Unknown",
    assigneeEmail,
    assigneeName: f.assignee?.displayName ?? null,
    userId,
    createdAt: parseIsoToUnix(f.created) ?? Math.floor(Date.now() / 1000),
    updatedAt: parseIsoToUnix(f.updated),
    resolvedAt: parseIsoToUnix(f.resolutiondate),
    url: cloudId?.value ? `https://${cloudId.value}/browse/${issue.key}` : null,
  };

  const existing = await db
    .select({ id: jiraIssues.id })
    .from(jiraIssues)
    .where(eq(jiraIssues.jiraKey, issue.key))
    .get();

  if (existing) {
    await db.update(jiraIssues).set(values).where(eq(jiraIssues.id, existing.id));
  } else {
    await db.insert(jiraIssues).values(values);
  }
  return true;
}

export async function syncJiraData(): Promise<{
  issuesProcessed: number;
  unmappedAssignees: string[];
}> {
  const db = getDb();

  const cloudIdRow = await db.select().from(settings).where(eq(settings.key, "jira_cloud_id")).get();
  const tokenRow = await db.select().from(settings).where(eq(settings.key, "jira_api_token")).get();
  const emailRow = await db.select().from(settings).where(eq(settings.key, "jira_user_email")).get();
  const projectsRow = await db.select().from(settings).where(eq(settings.key, "jira_projects")).get();

  if (!cloudIdRow?.value || !tokenRow?.value || !emailRow?.value) {
    throw new Error("Jira credentials not configured (need cloud ID, API token, and user email)");
  }

  const cloudId = cloudIdRow.value;
  const apiToken = tokenRow.value;
  const userEmail = emailRow.value;
  const projects = projectsRow?.value || "SP, AT, ENG, PE, SEC, LP";

  const lastSyncRow = await db.select().from(settings).where(eq(settings.key, "jira_last_synced")).get();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sinceDate = lastSyncRow?.value || sixMonthsAgo.toISOString().slice(0, 10);

  log(`Fetching Jira issues from ${sinceDate} for projects: ${projects}`);

  const jql = `project in (${projects}) AND updated >= "${sinceDate}" ORDER BY updated DESC`;
  const issues = await fetchAllJiraIssues(cloudId, apiToken, userEmail, jql);
  log(`Fetched ${issues.length} issues`);

  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const unmappedAssignees = new Set<string>();
  let processed = 0;

  for (const issue of issues) {
    await upsertIssue(issue, emailToUser);
    processed++;

    const email = issue.fields.assignee?.emailAddress?.toLowerCase();
    if (email && !emailToUser.has(email)) {
      unmappedAssignees.add(email);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(settings)
    .values({ key: "jira_last_synced", value: today })
    .onConflictDoUpdate({ target: settings.key, set: { value: today } });

  log(`Sync complete: ${processed} issues processed, ${unmappedAssignees.size} unmapped assignees`);

  return { issuesProcessed: processed, unmappedAssignees: [...unmappedAssignees] };
}

export async function remapJiraUsers(): Promise<number> {
  const db = getDb();
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const unmapped = await db
    .select({ id: jiraIssues.id, assigneeEmail: jiraIssues.assigneeEmail })
    .from(jiraIssues)
    .all();

  let remapped = 0;
  for (const row of unmapped) {
    if (!row.assigneeEmail) continue;
    const userId = emailToUser.get(row.assigneeEmail.toLowerCase());
    if (userId) {
      await db
        .update(jiraIssues)
        .set({ userId })
        .where(eq(jiraIssues.id, row.id));
      remapped++;
    }
  }

  log(`Remapped ${remapped} issues to users`);
  return remapped;
}
