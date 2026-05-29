import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { PULL_REQUEST_DETAILS_QUERY, PULL_REQUESTS_PAGE_QUERY } from "./queries";

export interface GitHubClient {
  graphql: typeof graphql;
  rest: Octokit;
}

export interface RateLimit {
  cost: number;
  remaining: number;
  resetAt: string;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
}

export function createGitHubClient(token: string): GitHubClient {
  return {
    graphql: graphql.defaults({
      headers: { authorization: `token ${token}` },
    }),
    rest: new Octokit({ auth: token }),
  };
}

export interface PullRequestNode {
  id: string;
  databaseId: number;
  number: number;
  title: string;
  state: "OPEN" | "MERGED" | "CLOSED";
  isDraft: boolean;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
  updatedAt: string;
  author: {
    login: string;
    databaseId?: number;
    avatarUrl?: string;
  } | null;
  timelineItems: {
    nodes: Array<{ createdAt: string }>;
  };
  reviews: {
    nodes: Array<{
      id: string;
      databaseId: number;
      state: string;
      submittedAt: string;
      author: {
        login: string;
        databaseId?: number;
        avatarUrl?: string;
      } | null;
    }>;
  };
  files: {
    totalCount: number;
    nodes: Array<{
      path: string;
      additions: number;
      deletions: number;
      changeType: string;
    }>;
  };
}

export interface PullRequestSummary {
  id: string;
  databaseId: number;
  number: number;
  state: "OPEN" | "MERGED" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

interface PullRequestsPageResponse {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: PullRequestSummary[];
    };
  };
  rateLimit: RateLimit;
}

interface PullRequestDetailsResponse {
  nodes: Array<PullRequestNode | null>;
  rateLimit: RateLimit;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
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
      console.log(`[sync] ${label}: ${status} error, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

export async function fetchPullRequestPage(
  client: GitHubClient,
  owner: string,
  name: string,
  cursor?: string | null,
): Promise<{
  prs: PullRequestSummary[];
  pageInfo: { hasNextPage: boolean; endCursor: string };
  rateLimit: RateLimit;
}> {
  const result = await withRetry(`${owner}/${name} PR page`, async () => {
    const res = await client.graphql<PullRequestsPageResponse>(PULL_REQUESTS_PAGE_QUERY, {
      owner,
      name,
      cursor: cursor || null,
      orderBy: { field: "UPDATED_AT", direction: "DESC" },
    });

    if (!res?.repository?.pullRequests) {
      const err = new Error(`GitHub returned empty response for ${owner}/${name} (repository or pullRequests is null)`);
      (err as unknown as { status: number }).status = 502;
      throw err;
    }

    return res;
  });

  return {
    prs: result.repository.pullRequests.nodes,
    pageInfo: result.repository.pullRequests.pageInfo,
    rateLimit: result.rateLimit,
  };
}

export async function fetchPullRequestDetails(
  client: GitHubClient,
  ids: string[],
): Promise<{ prs: PullRequestNode[]; rateLimit: RateLimit }> {
  if (ids.length === 0) {
    throw new Error("fetchPullRequestDetails requires at least one id");
  }

  const result = await withRetry(`PR detail batch (${ids.length})`, () =>
    client.graphql<PullRequestDetailsResponse>(PULL_REQUEST_DETAILS_QUERY, { ids }),
  );

  return {
    prs: result.nodes.filter((node): node is PullRequestNode => node !== null),
    rateLimit: result.rateLimit,
  };
}

export async function fetchPRFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRFile[]> {
  const files: PRFile[] = [];

  let page = 1;
  while (true) {
    const response = await withRetry(`${owner}/${repo}#${prNumber} files`, () =>
      client.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
        page,
      }),
    );

    for (const f of response.data) {
      files.push({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      });
    }

    if (response.data.length < 100) break;
    page++;
  }

  return files;
}

export async function testConnection(token: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const client = createGitHubClient(token);
    const { data } = await client.rest.users.getAuthenticated();
    return { ok: true, login: data.login };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
