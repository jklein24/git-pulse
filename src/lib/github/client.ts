import { graphql } from "@octokit/graphql";
import { Octokit } from "@octokit/rest";
import { PULL_REQUESTS_QUERY } from "./queries";

export interface GitHubClient {
  graphql: typeof graphql;
  rest: Octokit;
}

export interface RateLimit {
  cost: number;
  remaining: number;
  resetAt: string;
}

export function createGitHubClient(pat: string): GitHubClient {
  return {
    graphql: graphql.defaults({
      headers: { authorization: `token ${pat}` },
    }),
    rest: new Octokit({ auth: pat }),
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
}

interface PullRequestsResponse {
  repository: {
    pullRequests: {
      pageInfo: { hasNextPage: boolean; endCursor: string };
      nodes: PullRequestNode[];
    };
  };
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

export async function fetchPullRequests(
  client: GitHubClient,
  owner: string,
  name: string,
  cursor?: string | null,
): Promise<{
  prs: PullRequestNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string };
  rateLimit: RateLimit;
}> {
  const result = await withRetry(`${owner}/${name} GraphQL`, async () => {
    const res = await client.graphql<PullRequestsResponse>(PULL_REQUESTS_QUERY, {
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

export async function fetchPRFiles(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<
  Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>
> {
  const files: Array<{
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch?: string;
  }> = [];

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
        patch: f.patch,
      });
    }

    if (response.data.length < 100) break;
    page++;
  }

  return files;
}

export async function testConnection(pat: string): Promise<{ ok: boolean; login?: string; error?: string }> {
  try {
    const client = createGitHubClient(pat);
    const { data } = await client.rest.users.getAuthenticated();
    return { ok: true, login: data.login };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
