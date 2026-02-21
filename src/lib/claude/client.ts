export interface ClaudeCodeUsageRecord {
  actor: {
    type: string;
    email_address: string;
  };
  date: string; // YYYY-MM-DD
  num_sessions?: number;
  lines_of_code?: {
    added: number;
    removed: number;
  };
  commits_by_claude_code?: number;
  pull_requests_by_claude_code?: number;
  edit_tool?: { accepted: number; rejected: number };
  write_tool?: { accepted: number; rejected: number };
  multi_edit_tool?: { accepted: number; rejected: number };
  notebook_edit_tool?: { accepted: number; rejected: number };
  model_breakdown?: Array<{
    model: string;
    input_tokens?: number;
    output_tokens?: number;
    cache_read_tokens?: number;
    cache_creation_tokens?: number;
    estimated_cost_cents?: number;
  }>;
  terminal_type?: string;
}

interface UsageResponse {
  data: ClaudeCodeUsageRecord[];
  has_more: boolean;
  next_cursor?: string;
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
      console.log(`[claude-sync] ${label}: ${status} error, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

export async function fetchClaudeCodeUsage(
  adminApiKey: string,
  startingAt: string,
  cursor?: string,
): Promise<UsageResponse> {
  const params = new URLSearchParams({
    starting_at: startingAt,
    limit: "1000",
  });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const url = `https://api.anthropic.com/v1/organizations/usage_report/claude_code?${params}`;

  return withRetry(`claude_code usage from ${startingAt}`, async () => {
    const res = await fetch(url, {
      headers: {
        "x-api-key": adminApiKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (!res.ok) {
      const err = new Error(`Claude API error: ${res.status} ${res.statusText}`);
      (err as unknown as { status: number }).status = res.status;
      throw err;
    }

    return res.json();
  });
}

export async function fetchAllClaudeCodeUsage(
  adminApiKey: string,
  startingAt: string,
): Promise<ClaudeCodeUsageRecord[]> {
  const all: ClaudeCodeUsageRecord[] = [];
  let cursor: string | undefined;
  let page = 0;

  while (true) {
    page++;
    const response = await fetchClaudeCodeUsage(adminApiKey, startingAt, cursor);
    all.push(...response.data);
    console.log(`[claude-sync] Page ${page}: ${response.data.length} records (total: ${all.length})`);

    if (!response.has_more || !response.next_cursor) break;
    cursor = response.next_cursor;
  }

  return all;
}

export async function testClaudeConnection(
  adminApiKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    await fetchClaudeCodeUsage(adminApiKey, today);
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
