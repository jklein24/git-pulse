export interface ClaudeCodeUsageRecord {
  actor: {
    type?: string;
    email_address?: string;
    [key: string]: unknown;
  };
  date: string;
  terminal_type?: string;
  core_metrics?: {
    num_sessions?: number;
    lines_of_code?: { added: number; removed: number };
    commits_by_claude_code?: number;
    pull_requests_by_claude_code?: number;
  };
  tool_actions?: {
    edit_tool?: { accepted: number; rejected: number };
    write_tool?: { accepted: number; rejected: number };
    multi_edit_tool?: { accepted: number; rejected: number };
    notebook_edit_tool?: { accepted: number; rejected: number };
  };
  model_breakdown?: Array<{
    model: string;
    tokens?: {
      input?: number;
      output?: number;
      cache_read?: number;
      cache_creation?: number;
    };
    estimated_cost?: {
      currency?: string;
      amount?: number;
    };
  }>;
}

interface UsageResponse {
  data: ClaudeCodeUsageRecord[];
  has_more: boolean;
  next_page?: string;
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
    params.set("page", cursor);
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

function generateDayDates(startingAt: string): string[] {
  const dates: string[] = [];
  const current = new Date(startingAt + "T00:00:00Z");
  const now = new Date();

  while (current <= now) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export async function fetchAllClaudeCodeUsage(
  adminApiKey: string,
  startingAt: string,
): Promise<ClaudeCodeUsageRecord[]> {
  const all: ClaudeCodeUsageRecord[] = [];
  const days = generateDayDates(startingAt);

  console.log(`[claude-sync] Fetching ${days.length} days from ${days[0]} to ${days[days.length - 1]}`);

  for (const day of days) {
    let cursor: string | undefined;

    while (true) {
      const response = await fetchClaudeCodeUsage(adminApiKey, day, cursor);
      all.push(...response.data);

      if (response.data.length > 0) {
        console.log(`[claude-sync] ${day}: ${response.data.length} records (total: ${all.length})`);
      }

      if (!response.has_more || !response.next_page) break;
      cursor = response.next_page;
    }
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
