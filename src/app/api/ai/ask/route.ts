import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getReadOnlyDb } from "@/lib/ai/read-only-db";
import { SCHEMA_DESCRIPTION } from "@/lib/ai/schema-description";

const client = new Anthropic();

const MAX_QUESTION_LENGTH = 1000;
const MAX_TURNS = 10;
const MAX_RESULT_LENGTH = 50_000;

const QUERY_DB_TOOL: Anthropic.Tool = {
  name: "query_db",
  description: "Execute a read-only SQL query against the productivity SQLite database. Only SELECT queries are allowed. The settings table cannot be queried.",
  input_schema: {
    type: "object" as const,
    properties: {
      sql: { type: "string", description: "A SELECT SQL query to execute" },
    },
    required: ["sql"],
  },
};

function executeQuery(sqlQuery: string): string {
  const trimmed = sqlQuery.trim();

  if (!/^SELECT\b/i.test(trimmed)) {
    return "Error: Only SELECT queries are allowed.";
  }
  if (/;[\s]*\S/.test(trimmed)) {
    return "Error: Multi-statement queries are not allowed.";
  }
  if (/\bsettings\b/i.test(trimmed)) {
    return "Error: Access to the settings table is not allowed.";
  }

  try {
    const db = getReadOnlyDb();
    const rows = db.prepare(trimmed).all();
    let result = JSON.stringify(rows, null, 2);
    if (result.length > MAX_RESULT_LENGTH) {
      result = result.slice(0, MAX_RESULT_LENGTH) + "\n... (truncated)";
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return `SQL Error: ${msg}`;
  }
}

export async function POST(request: NextRequest) {
  const { question } = await request.json();
  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `Question too long (max ${MAX_QUESTION_LENGTH} chars)` }, { status: 400 });
  }

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are a helpful data analyst for an engineering team's GitHub productivity dashboard. You have access to a SQLite database via the query_db tool.

${SCHEMA_DESCRIPTION}

Guidelines:
- Use filtered_additions and filtered_deletions instead of raw additions/deletions when computing PR size
- All timestamps are unix epoch seconds
- When joining pull_requests to users, use author_id for PR authors and reviewer_id for reviewers
- Keep your answers concise and data-driven
- If you can't answer a question from the available data, say so
- Format numbers nicely (e.g. use commas for thousands)
- Do not access the settings table`,
        messages,
        tools: [QUERY_DB_TOOL],
      });

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
        );

        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(block => ({
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: executeQuery((block.input as { sql: string }).sql),
        }));

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("");

      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Too many tool calls. Please try a simpler question." }, { status: 500 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
