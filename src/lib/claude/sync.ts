import { eq, and } from "drizzle-orm";
import { getDb } from "../db";
import { users, settings, claudeCodeUsage, claudeCodeModelUsage } from "../db/schema";
import { fetchAllClaudeCodeUsage, type ClaudeCodeUsageRecord } from "./client";

function log(...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[claude-sync ${ts}]`, ...args);
}

function normalizeDate(date: string): string {
  return date.slice(0, 10);
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

async function upsertUsageRecord(
  record: ClaudeCodeUsageRecord,
  emailToUser: Map<string, number>,
): Promise<boolean> {
  const db = getDb();
  const rawEmail = record.actor?.email_address;
  if (!rawEmail) {
    log("Skipping record with no email:", JSON.stringify(record.actor), "date:", record.date);
    return false;
  }
  const email = rawEmail.toLowerCase();
  const userId = emailToUser.get(email) ?? null;
  const date = normalizeDate(record.date);

  const core = record.core_metrics;
  const tools = record.tool_actions;
  const models = record.model_breakdown ?? [];
  const totalCostCents = models.reduce((sum, m) => sum + (m.estimated_cost?.amount ?? 0), 0);
  const totalInput = models.reduce((sum, m) => sum + (m.tokens?.input ?? 0), 0);
  const totalOutput = models.reduce((sum, m) => sum + (m.tokens?.output ?? 0), 0);

  const values = {
    userId,
    email,
    date,
    numSessions: core?.num_sessions ?? 0,
    linesAdded: core?.lines_of_code?.added ?? 0,
    linesRemoved: core?.lines_of_code?.removed ?? 0,
    commitsByClaudeCode: core?.commits_by_claude_code ?? 0,
    prsByClaudeCode: core?.pull_requests_by_claude_code ?? 0,
    editToolAccepted: tools?.edit_tool?.accepted ?? 0,
    editToolRejected: tools?.edit_tool?.rejected ?? 0,
    writeToolAccepted: tools?.write_tool?.accepted ?? 0,
    writeToolRejected: tools?.write_tool?.rejected ?? 0,
    multiEditToolAccepted: tools?.multi_edit_tool?.accepted ?? 0,
    multiEditToolRejected: tools?.multi_edit_tool?.rejected ?? 0,
    notebookEditToolAccepted: tools?.notebook_edit_tool?.accepted ?? 0,
    notebookEditToolRejected: tools?.notebook_edit_tool?.rejected ?? 0,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estimatedCostCents: Math.round(totalCostCents),
    terminalType: record.terminal_type ?? null,
  };

  const existing = await db
    .select({ id: claudeCodeUsage.id })
    .from(claudeCodeUsage)
    .where(and(eq(claudeCodeUsage.email, email), eq(claudeCodeUsage.date, date)))
    .get();

  let usageId: number;
  if (existing) {
    await db.update(claudeCodeUsage).set(values).where(eq(claudeCodeUsage.id, existing.id));
    usageId = existing.id;
    await db.delete(claudeCodeModelUsage).where(eq(claudeCodeModelUsage.usageId, usageId));
  } else {
    const result = await db.insert(claudeCodeUsage).values(values).returning({ id: claudeCodeUsage.id });
    usageId = result[0].id;
  }

  if (models.length > 0) {
    await db.insert(claudeCodeModelUsage).values(
      models.map((m) => ({
        usageId,
        model: m.model,
        inputTokens: m.tokens?.input ?? 0,
        outputTokens: m.tokens?.output ?? 0,
        cacheReadTokens: m.tokens?.cache_read ?? 0,
        cacheCreationTokens: m.tokens?.cache_creation ?? 0,
        estimatedCostCents: Math.round(m.estimated_cost?.amount ?? 0),
      })),
    );
  }
  return true;
}

export async function syncClaudeCodeData(): Promise<{ recordsProcessed: number; unmappedEmails: string[] }> {
  const db = getDb();

  const apiKeyRow = await db.select().from(settings).where(eq(settings.key, "claude_admin_api_key")).get();
  if (!apiKeyRow?.value) throw new Error("Claude Admin API key not configured");

  const lastSyncRow = await db.select().from(settings).where(eq(settings.key, "claude_last_synced")).get();

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const startingAt = lastSyncRow?.value || sixMonthsAgo.toISOString().slice(0, 10);

  log(`Fetching Claude Code usage from ${startingAt}`);

  const records = await fetchAllClaudeCodeUsage(apiKeyRow.value, startingAt);
  log(`Fetched ${records.length} usage records`);

  const allUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const unmappedEmails = new Set<string>();
  let processed = 0;

  for (const record of records) {
    const saved = await upsertUsageRecord(record, emailToUser);
    if (!saved) continue;
    processed++;

    const email = record.actor?.email_address?.toLowerCase();
    if (email && !emailToUser.has(email)) {
      unmappedEmails.add(email);
    }
  }

  const yesterday = new Date(Date.now() - 86400000);
  const lastSyncValue = yesterday.toISOString().slice(0, 10);
  await db
    .insert(settings)
    .values({ key: "claude_last_synced", value: lastSyncValue })
    .onConflictDoUpdate({ target: settings.key, set: { value: lastSyncValue } });

  log(`Sync complete: ${processed} records processed, ${unmappedEmails.size} unmapped emails`);

  return { recordsProcessed: processed, unmappedEmails: [...unmappedEmails] };
}

export async function remapClaudeUsageUsers(): Promise<number> {
  const db = getDb();
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  const emailToUser = buildEmailToUserMap(allUsers);

  const unmapped = await db
    .select({ id: claudeCodeUsage.id, email: claudeCodeUsage.email })
    .from(claudeCodeUsage)
    .where(eq(claudeCodeUsage.userId, 0));

  const nullMapped = await db
    .select({ id: claudeCodeUsage.id, email: claudeCodeUsage.email })
    .from(claudeCodeUsage)
    .all();

  let remapped = 0;
  for (const row of nullMapped) {
    const userId = emailToUser.get(row.email.toLowerCase());
    if (userId) {
      await db
        .update(claudeCodeUsage)
        .set({ userId })
        .where(and(eq(claudeCodeUsage.id, row.id)));
      remapped++;
    }
  }

  log(`Remapped ${remapped} usage records to users`);
  return remapped;
}
