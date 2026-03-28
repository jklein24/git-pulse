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
}

export interface JiraIssueNode {
  key: string;
  fields: JiraIssueFields;
}

interface JiraSearchResponse {
  issues: {
    totalCount: number;
    nodes: JiraIssueNode[];
    isLast?: boolean;
  };
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
  fields: string[] = ["summary", "status", "issuetype", "priority", "assignee", "created", "updated", "resolutiondate", "project"],
  maxResults: number = 100,
  cursor?: string,
): Promise<JiraSearchResponse & { nextPageToken?: string }> {
  // Use site-scoped URL with Basic auth (email:api-token)
  // cloudId can be "foo.atlassian.net" or just "foo" — normalize to site URL
  // Uses GET /rest/api/3/search/jql with cursor-based pagination (nextPageToken)
  const site = cloudId.includes(".") ? cloudId : `${cloudId}.atlassian.net`;
  const params = new URLSearchParams({
    jql,
    fields: fields.join(","),
    maxResults: String(maxResults),
  });
  if (cursor) {
    params.set("nextPageToken", cursor);
  }
  const url = `https://${site}/rest/api/3/search/jql?${params}`;

  return withRetry(`jira search${cursor ? ` cursor=${cursor.slice(0, 20)}...` : ""}`, async () => {
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
    const issues = (data.issues ?? []).map((issue: { key: string; fields: JiraIssueFields }) => ({
      key: issue.key,
      fields: issue.fields,
    }));
    return {
      issues: {
        totalCount: data.total ?? issues.length,
        nodes: issues,
        isLast: data.isLast ?? true,
      },
      nextPageToken: data.nextPageToken ?? undefined,
    };
  });
}

export async function fetchAllJiraIssues(
  cloudId: string,
  apiToken: string,
  userEmail: string,
  jql: string,
  fields?: string[],
): Promise<JiraIssueNode[]> {
  const all: JiraIssueNode[] = [];
  let cursor: string | undefined;
  const pageSize = 100;

  while (true) {
    const response = await searchJiraIssues(cloudId, apiToken, userEmail, jql, fields, pageSize, cursor);
    all.push(...response.issues.nodes);

    console.log(`[jira-sync] Fetched ${response.issues.nodes.length} issues (total: ${all.length})`);

    if (response.issues.isLast || response.issues.nodes.length === 0 || !response.nextPageToken) break;
    cursor = response.nextPageToken;
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
    await searchJiraIssues(site, apiToken, userEmail, "project is not EMPTY", ["summary"], 1, undefined);
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
