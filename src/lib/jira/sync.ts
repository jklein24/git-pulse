import { eq, and, isNull, isNotNull } from "drizzle-orm";
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

function buildIssueValues(
  issue: JiraIssueNode,
  emailToUser: Map<string, number>,
  urlPrefix: string,
) {
  const f = issue.fields;
  const assigneeEmail = f.assignee?.emailAddress?.toLowerCase() ?? null;
  const userId = assigneeEmail ? (emailToUser.get(assigneeEmail) ?? null) : null;

  return {
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
    dueDate: parseIsoToUnix(f.duedate),
    parentKey: f.parent?.key ?? null,
    url: `${urlPrefix}${issue.key}`,
  };
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

  const fetchStart = Date.now();
  const jql = `project in (${projects}) AND updated >= "${sinceDate}" ORDER BY updated DESC`;
  const issues = await fetchAllJiraIssues(cloudId, apiToken, userEmail, jql);
  log(`Fetched ${issues.length} issues in ${Math.round((Date.now() - fetchStart) / 100) / 10}s`);

  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const site = cloudId.includes(".") ? cloudId : `${cloudId}.atlassian.net`;
  const urlPrefix = `https://${site}/browse/`;

  const unmappedAssignees = new Set<string>();
  const upsertStart = Date.now();

  for (const issue of issues) {
    const values = buildIssueValues(issue, emailToUser, urlPrefix);
    await db
      .insert(jiraIssues)
      .values(values)
      .onConflictDoUpdate({ target: jiraIssues.jiraKey, set: values });

    const email = issue.fields.assignee?.emailAddress?.toLowerCase();
    if (email && !emailToUser.has(email)) {
      unmappedAssignees.add(email);
    }
  }

  const processed = issues.length;
  log(`Upserted ${processed} issues in ${Math.round((Date.now() - upsertStart) / 100) / 10}s`);

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
  const start = Date.now();

  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const unmapped = await db
    .select({ id: jiraIssues.id, assigneeEmail: jiraIssues.assigneeEmail })
    .from(jiraIssues)
    .where(and(isNull(jiraIssues.userId), isNotNull(jiraIssues.assigneeEmail)))
    .all();

  let remapped = 0;
  for (const row of unmapped) {
    if (!row.assigneeEmail) continue;
    const userId = emailToUser.get(row.assigneeEmail.toLowerCase());
    if (userId) {
      await db.update(jiraIssues).set({ userId }).where(eq(jiraIssues.id, row.id));
      remapped++;
    }
  }

  log(`Remap pass: ${remapped} mapped of ${unmapped.length} candidates in ${Math.round((Date.now() - start) / 100) / 10}s`);
  return remapped;
}
