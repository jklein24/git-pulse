import { sql, type SQL, type AnyColumn } from "drizzle-orm";

// Logins for bots/apps that submit automated reviews (e.g. greptile-apps, restamp-bot,
// graphite-app). Excluded from human review metrics. The JS predicate and SQL condition
// below are two encodings of the same rule — "login ends in 'bot', '-app', or '-apps'" —
// and must stay in sync.
export const BOT_LOGIN_PATTERN = /(-bot|bot)$|-apps?$/i;

export function isBotLogin(login: string): boolean {
  return BOT_LOGIN_PATTERN.test(login);
}

export function notBotLoginSql(loginColumn: AnyColumn): SQL {
  return sql`lower(${loginColumn}) NOT LIKE '%bot' AND lower(${loginColumn}) NOT LIKE '%-app' AND lower(${loginColumn}) NOT LIKE '%-apps'`;
}

export function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function rollingAverage(values: number[], windowSize: number): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return mean(window);
}

export function startOfDay(unix: number): number {
  const d = new Date(unix * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export function startOfWeek(unix: number): number {
  const d = new Date(unix * 1000);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return Math.floor(d.getTime() / 1000);
}

export const MONDAY_OFFSET = 259200;

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

export function hoursFromSeconds(seconds: number): number {
  return Math.round((seconds / 3600) * 10) / 10;
}
