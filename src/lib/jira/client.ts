export interface JiraIssueFields {
  summary: string;
  issuetype?: { name: string };
  priority?: { name: string };
  status?: { name: string };
  assignee?: {
    displayName: string;
    emailAddress?: string;
    accountId: string;
  } | null;
  project?: { key: string };
  created: string;
  updated?: string;
  resolutiondate?: string | null;
  duedate?: string | null;
  parent?: { key: string } | null;
}

export interface JiraIssueNode {
  key: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  nodes: JiraIssueNode[];
  nextPageToken: string | null;
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 4;

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      const isRetryable = status !== undefined && RETRYABLE_STATUSES.has(status);

      if (!isRetryable || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.log(`[jira-sync] ${label}: ${status} error, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

export async function searchJiraIssues(
  cloudId: string,
  apiToken: string,
  userEmail: string,
  jql: string,
  fields: string[] = ["summary", "status", "issuetype", "priority", "assignee", "created", "updated", "resolutiondate", "project", "duedate", "parent"],
  maxResults: number = 100,
  nextPageToken?: string,
): Promise<JiraSearchResponse> {
  // Uses GET /rest/api/3/search/jql (cursor-based via nextPageToken; the old
  // POST /rest/api/3/search with startAt returns 410 Gone).
  const site = cloudId.includes(".") ? cloudId : `${cloudId}.atlassian.net`;
  const params = new URLSearchParams({
    jql,
    fields: fields.join(","),
    maxResults: String(maxResults),
  });
  if (nextPageToken) params.set("nextPageToken", nextPageToken);
  const url = `https://${site}/rest/api/3/search/jql?${params}`;

  return withRetry(`jira search token=${nextPageToken ?? "<start>"}`, async () => {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${userEmail}:${apiToken}`).toString("base64")}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const err = new Error(`Jira API error: ${res.status} ${res.statusText}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }

    const data = await res.json();
    const nodes: JiraIssueNode[] = (data.issues ?? []).map((issue: { key: string; fields: JiraIssueFields }) => ({
      key: issue.key,
      fields: issue.fields,
    }));
    return {
      nodes,
      nextPageToken: data.nextPageToken ?? null,
    };
  });
}

const MAX_FETCH_PAGES = 1000;

export async function fetchAllJiraIssues(
  cloudId: string,
  apiToken: string,
  userEmail: string,
  jql: string,
  fields?: string[],
): Promise<JiraIssueNode[]> {
  const all: JiraIssueNode[] = [];
  const seen = new Set<string>();
  let nextPageToken: string | undefined;
  let pageCount = 0;

  while (pageCount < MAX_FETCH_PAGES) {
    const response = await searchJiraIssues(cloudId, apiToken, userEmail, jql, fields, 100, nextPageToken);

    let newOnThisPage = 0;
    for (const issue of response.nodes) {
      if (seen.has(issue.key)) continue;
      seen.add(issue.key);
      all.push(issue);
      newOnThisPage++;
    }

    pageCount++;
    console.log(`[jira-sync] Page ${pageCount}: +${newOnThisPage} new (total: ${all.length}, dupes: ${response.nodes.length - newOnThisPage})`);

    if (!response.nextPageToken || response.nodes.length === 0 || newOnThisPage === 0) break;
    nextPageToken = response.nextPageToken;
  }

  if (pageCount >= MAX_FETCH_PAGES) {
    console.warn(`[jira-sync] Hit MAX_FETCH_PAGES (${MAX_FETCH_PAGES}) — aborting pagination`);
  }

  return all;
}

export async function testJiraConnection(
  cloudId: string,
  apiToken: string,
  userEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const site = cloudId.includes(".") ? cloudId : `${cloudId}.atlassian.net`;
    await searchJiraIssues(site, apiToken, userEmail, "project is not EMPTY", ["summary"], 1);
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
